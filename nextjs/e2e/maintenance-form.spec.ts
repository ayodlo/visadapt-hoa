import { test, expect } from '@playwright/test';
import path from 'path';

/** Resident-facing multi-step maintenance submission. */
test.describe('as resident', () => {
  test.use({ storageState: path.join(__dirname, '.auth/resident.json') });

  test('required fields block progress and are announced', async ({ page }) => {
    await page.goto('/dashboard/maintenance');
    await page.getByRole('button', { name: '+ New Request' }).click();

    await expect(page.getByRole('heading', { name: 'Request', level: 2 })).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    const alert = page.getByRole('alert').filter({ hasText: 'Please fix the following' });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Choose a type of request.');
    await expect(alert).toContainText('Enter a short title.');
    // Still on step 1.
    await expect(page.getByRole('heading', { name: 'Request', level: 2 })).toBeVisible();
  });

  test('specific location choices follow the issue location', async ({ page }) => {
    await page.goto('/dashboard/maintenance');
    await page.getByRole('button', { name: '+ New Request' }).click();

    await page.locator('#mr-location').selectOption('INTERIOR');
    await expect(page.locator('#mr-specific')).toBeVisible();
    const interior = await page.locator('#mr-specific option').allTextContents();
    expect(interior).toContain('Kitchen');

    await page.locator('#mr-location').selectOption('EXTERIOR');
    const exterior = await page.locator('#mr-specific option').allTextContents();
    expect(exterior).toContain('Roof');
    expect(exterior).not.toContain('Kitchen');
  });

  test('emergency urgency shows the dispatch warning', async ({ page }) => {
    await page.goto('/dashboard/maintenance');
    await page.getByRole('button', { name: '+ New Request' }).click();
    await fillStepOne(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Details', level: 2 })).toBeVisible();
    await expect(page.locator('#mr-emergency-warning')).toHaveCount(0);

    await page.locator('#mr-urgency').selectOption('EMERGENCY');
    const warning = page.locator('#mr-emergency-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('not an emergency dispatch service');
    // The urgency control points at the warning for assistive tech.
    await expect(page.locator('#mr-urgency')).toHaveAttribute('aria-describedby', 'mr-emergency-warning');
  });

  test('the access step is skipped for common-area requests', async ({ page }) => {
    await page.goto('/dashboard/maintenance');
    await page.getByRole('button', { name: '+ New Request' }).click();
    await fillStepOne(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    await page.locator('#mr-scope').selectOption('HOA_COMMON');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    // Straight to Attachments — no entry-permission questions for common areas.
    await expect(page.getByRole('heading', { name: 'Attachments', level: 2 })).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('heading', { name: 'Details', level: 2 })).toBeVisible();

    // Switching to a private property brings the step back.
    await page.locator('#mr-scope').selectOption('MY_UNIT');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Access', level: 2 })).toBeVisible();
  });

  test('entries survive Back and Next', async ({ page }) => {
    await page.goto('/dashboard/maintenance');
    await page.getByRole('button', { name: '+ New Request' }).click();
    await fillStepOne(page, 'Preserved title');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('#mr-title')).toHaveValue('Preserved title');
    await expect(page.locator('#mr-category')).toHaveValue('PLUMBING');
  });

  test('submits and shows a request number and status', async ({ page }) => {
    await page.goto('/dashboard/maintenance');
    await page.getByRole('button', { name: '+ New Request' }).click();

    const title = `E2E Maintenance ${Date.now()}`;
    await fillStepOne(page, title);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.locator('#mr-scope').selectOption('HOA_COMMON');
    await page.getByRole('button', { name: 'Next', exact: true }).click();   // Attachments
    await page.getByRole('button', { name: 'Next', exact: true }).click();   // Review

    await expect(page.getByRole('heading', { name: 'Review', level: 2 })).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();

    await page.getByRole('button', { name: 'Submit request' }).click();

    const success = page.getByRole('status').filter({ hasText: 'Request submitted' });
    await expect(success).toBeVisible({ timeout: 15000 });
    await expect(success).toContainText(/MR-\d{4}-\d{4}/);
    await expect(success).toContainText('SUBMITTED');

    // Clean up via the API so runs don't accumulate requests.
    const all: { id: string; title: string }[] = await (await page.request.get('/api/maintenance')).json();
    const created = all.find((r) => r.title === title);
    if (created) await page.request.delete(`/api/maintenance/${created.id}`);
  });

  test('a resident sees only their own requests', async ({ page }) => {
    const res = await page.request.get('/api/maintenance');
    expect(res.status()).toBe(200);
    const rows: { submittedBy: { id: string } }[] = await res.json();
    const me = await (await page.request.get('/api/auth/me')).json().catch(() => null);
    const myId = me?.user?.id ?? me?.id;
    if (myId && rows.length) {
      expect(rows.every((r) => r.submittedBy.id === myId)).toBe(true);
    }
  });

  test('rejects a request whose values are outside the vocabulary', async ({ page }) => {
    const res = await page.request.post('/api/maintenance', {
      data: {
        category: 'NOT_A_CATEGORY',
        locationType: 'INTERIOR',
        title: 'x',
        description: 'y',
        residentUrgency: 'NORMAL',
        propertyScope: 'MY_UNIT',
      },
    });
    expect(res.status()).toBe(400);
  });

  test('cannot attach a request to a property it does not own', async ({ page }) => {
    const res = await page.request.post('/api/maintenance', {
      data: {
        category: 'PLUMBING',
        locationType: 'INTERIOR',
        title: 'Tenant isolation probe',
        description: 'Should be rejected before creating anything.',
        residentUrgency: 'NORMAL',
        propertyScope: 'MY_UNIT',
        propertyId: 'not-a-real-property-id',
      },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('as admin', () => {
  test.use({ storageState: path.join(__dirname, '.auth/admin.json') });

  test('staff keep the quick-entry form, not the wizard', async ({ page }) => {
    await page.goto('/dashboard/maintenance');
    await page.getByRole('button', { name: '+ New Request' }).click();
    await expect(page.getByPlaceholder('Title')).toBeVisible();
    await expect(page.locator('#mr-category')).toHaveCount(0);
  });
});

async function fillStepOne(page: import('@playwright/test').Page, title = 'E2E maintenance request') {
  await page.locator('#mr-category').selectOption('PLUMBING');
  await page.locator('#mr-location').selectOption('INTERIOR');
  await page.locator('#mr-title').fill(title);
  await page.locator('#mr-description').fill('Automated coverage for the maintenance submission form.');
}
