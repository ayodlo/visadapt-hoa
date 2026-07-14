import { render, fireEvent } from '@testing-library/react-native';
import { ChipSelect } from '@/components/ChipSelect';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

const options: { value: Priority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

describe('ChipSelect', () => {
  it('renders every option', async () => {
    const { getByText } = await render(<ChipSelect options={options} value="LOW" onChange={() => {}} />);
    expect(getByText('Low')).toBeTruthy();
    expect(getByText('Medium')).toBeTruthy();
    expect(getByText('High')).toBeTruthy();
  });

  it('calls onChange with the pressed option value', async () => {
    const onChange = jest.fn();
    const { getByText } = await render(<ChipSelect options={options} value="LOW" onChange={onChange} />);
    fireEvent.press(getByText('High'));
    expect(onChange).toHaveBeenCalledWith('HIGH');
  });

  it('still calls onChange when the already-active option is pressed again', async () => {
    const onChange = jest.fn();
    const { getByText } = await render(<ChipSelect options={options} value="MEDIUM" onChange={onChange} />);
    fireEvent.press(getByText('Medium'));
    expect(onChange).toHaveBeenCalledWith('MEDIUM');
  });
});
