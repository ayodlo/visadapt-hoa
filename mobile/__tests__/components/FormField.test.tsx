import { render, fireEvent } from '@testing-library/react-native';
import { FormField } from '@/components/FormField';

describe('FormField', () => {
  it('renders the label', async () => {
    const { getByText } = await render(<FormField label="Email" value="" onChangeText={() => {}} />);
    expect(getByText('Email')).toBeTruthy();
  });

  it('displays the current value', async () => {
    const { getByDisplayValue } = await render(<FormField label="Email" value="a@b.com" onChangeText={() => {}} />);
    expect(getByDisplayValue('a@b.com')).toBeTruthy();
  });

  it('calls onChangeText when typed into', async () => {
    const onChangeText = jest.fn();
    const { getByDisplayValue } = await render(<FormField label="Email" value="" onChangeText={onChangeText} />);
    fireEvent.changeText(getByDisplayValue(''), 'new@value.com');
    expect(onChangeText).toHaveBeenCalledWith('new@value.com');
  });

  it('forwards arbitrary TextInputProps like placeholder and secureTextEntry', async () => {
    const { getByPlaceholderText } = await render(
      <FormField label="Password" value="" onChangeText={() => {}} placeholder="Enter password" secureTextEntry />
    );
    expect(getByPlaceholderText('Enter password')).toBeTruthy();
  });
});
