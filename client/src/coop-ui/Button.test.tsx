import { fireEvent, render, screen } from '@testing-library/react';
import { Mail } from 'lucide-react';
import React from 'react';

import '@testing-library/jest-dom/extend-expect';

import { Link, MemoryRouter } from 'react-router-dom';

import { Button } from './Button';

describe('Button component', () => {
  it('renders with default props', () => {
    render(<Button>Click Me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it('applies variant classes correctly', () => {
    render(<Button color="red">Delete</Button>);
    const button = screen.getByRole('button', { name: /delete/i });
    expect(button).toHaveClass('bg-red-600');
  });

  it('applies size classes correctly', () => {
    render(<Button size="lg">Large Button</Button>);
    const button = screen.getByRole('button', { name: /large button/i });
    expect(button).toHaveClass('py-4', 'px-5', 'text-base');
  });

  it('disables the button when loading is true', () => {
    render(<Button loading>Loading...</Button>);
    const button = screen.getByRole('button', { name: /loading/i });
    expect(button).toBeDisabled();
  });

  it('renders a loading spinner when loading is true', () => {
    render(<Button loading>Loading...</Button>);

    const spinner = screen.getByTestId('loading-spinner');

    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('h-4', 'w-4', 'animate-spin');
  });

  it('renders the button as a child component with asChild prop', () => {
    render(
      <MemoryRouter>
        <Button asChild>
          <Link to="/login">Login</Link>
        </Button>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: /login/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/login');
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders startIcon correctly', () => {
    render(<Button startIcon={Mail}>Start Icon</Button>);
    const icon = screen.getByTestId('start-icon');
    expect(icon).toBeInTheDocument();
  });

  it('renders endIcon correctly', () => {
    render(<Button endIcon={Mail}>End Icon</Button>);
    const icon = screen.getByTestId('end-icon');
    expect(icon).toBeInTheDocument();
  });

  it('applies disabled prop correctly', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button', { name: /disabled/i });
    expect(button).toBeDisabled();
  });

  it('renders as an anchor when asChild is true with an anchor child', () => {
    render(
      <Button asChild>
        <a href="/home">Home</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: /home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/home');
  });
});
