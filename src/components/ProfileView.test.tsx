import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProfileView } from './ProfileView';
import { translations } from '../translations';

describe('ProfileView', () => {
  const mockUser = {
    displayName: 'Test User',
    email: 'test@example.com',
    photoURL: 'http://photo.com',
  };

  const mockProps = {
    user: mockUser,
    onBack: vi.fn(),
    onLogout: vi.fn(),
    onReconnectDrive: vi.fn(),
    driveToken: 'mock-token',
    translations: translations,
    language: 'en' as const,
  };

  it('renders user information correctly', () => {
    render(<ProfileView {...mockProps} />);
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /profile/i })).toHaveAttribute('src', 'http://photo.com');
  });

  it('calls onBack when back button is clicked', () => {
    render(<ProfileView {...mockProps} />);
    const backBtn = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backBtn);
    expect(mockProps.onBack).toHaveBeenCalled();
  });

  it('calls onLogout when logout button is clicked', () => {
    render(<ProfileView {...mockProps} />);
    const logoutBtn = screen.getByText(translations.en.logout);
    fireEvent.click(logoutBtn);
    expect(mockProps.onLogout).toHaveBeenCalled();
  });

  it('calls onReconnectDrive when reconnect button is clicked', () => {
    render(<ProfileView {...mockProps} />);
    const reconnectBtn = screen.getByText(translations.en.reconnectDrive);
    fireEvent.click(reconnectBtn);
    expect(mockProps.onReconnectDrive).toHaveBeenCalled();
  });

  it('shows connected status when driveToken is present', () => {
    render(<ProfileView {...mockProps} />);
    expect(screen.getByText(translations.en.driveConnected)).toBeInTheDocument();
  });

  it('shows disconnected status when driveToken is null', () => {
    render(<ProfileView {...mockProps} driveToken={null} />);
    expect(screen.getByText(translations.en.driveDisconnected)).toBeInTheDocument();
  });
});
