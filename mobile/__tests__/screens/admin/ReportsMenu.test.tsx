import { render, fireEvent } from '@testing-library/react-native';
import ReportsMenu from '../../../app/(admin)/more/reports/index';
import { router } from 'expo-router';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('ReportsMenu (admin)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders all four report links and navigates on press', async () => {
    const { findByText } = await render(<ReportsMenu />);
    const issuesRow = await findByText(/Issues Report/);
    fireEvent.press(issuesRow);
    expect(router.push).toHaveBeenCalledWith('/more/reports/issues');
  });

  it('navigates to the payments report', async () => {
    const { findByText } = await render(<ReportsMenu />);
    fireEvent.press(await findByText(/Payments Report/));
    expect(router.push).toHaveBeenCalledWith('/more/reports/payments');
  });

  it('navigates to the architectural requests report', async () => {
    const { findByText } = await render(<ReportsMenu />);
    fireEvent.press(await findByText(/Architectural Requests Report/));
    expect(router.push).toHaveBeenCalledWith('/more/reports/architectural-requests');
  });

  it('navigates to the violations report', async () => {
    const { findByText } = await render(<ReportsMenu />);
    fireEvent.press(await findByText(/Violations Report/));
    expect(router.push).toHaveBeenCalledWith('/more/reports/violations');
  });
});
