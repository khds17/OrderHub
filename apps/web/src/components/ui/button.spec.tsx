import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when activated', async () => {
    const user = userEvent.setup();
    const handler = jest.fn();
    render(<Button onClick={handler}>Go</Button>);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('respects the disabled attribute', async () => {
    const user = userEvent.setup();
    const handler = jest.fn();
    render(
      <Button onClick={handler} disabled>
        Go
      </Button>,
    );
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(handler).not.toHaveBeenCalled();
  });
});
