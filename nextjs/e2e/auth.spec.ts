import { test, expect } from '@playwright/test';

test('unauthenticated user is redirected to /login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('login page renders the sign-in form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Portal HOA' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('shows error for invalid credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('nobody@example.com');
  await page.getByLabel('Password').fill('wrongpassword');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Invalid email or password')).toBeVisible();
});

test('admin can sign in with valid credentials', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@portalhoa.local');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
  await expect(page).toHaveURL(/\/dashboard/);
});

test('logout clears session and redirects to /login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('admin@portalhoa.local');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
