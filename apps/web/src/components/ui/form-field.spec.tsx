import { render, screen } from '@testing-library/react';
import { FormField } from './form-field';

describe('FormField', () => {
  it('renders the label associated with the input', () => {
    render(<FormField id="email" label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('id', 'email');
  });

  it('shows an error message and marks the input invalid', () => {
    render(<FormField id="email" label="Email" error="Required" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('shows the hint when there is no error', () => {
    render(<FormField id="pw" label="Password" hint="At least 8 chars." />);
    expect(screen.getByText('At least 8 chars.')).toBeInTheDocument();
  });

  it('hides the hint once an error is present', () => {
    render(
      <FormField
        id="pw"
        label="Password"
        hint="At least 8 chars."
        error="Too short"
      />,
    );
    expect(screen.queryByText('At least 8 chars.')).not.toBeInTheDocument();
    expect(screen.getByText('Too short')).toBeInTheDocument();
  });
});
