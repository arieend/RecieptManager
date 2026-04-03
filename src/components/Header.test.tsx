import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Header } from './Header';
import { translations } from '../translations';

describe('Header', () => {
  const mockProps = {
    user: { photoURL: 'http://photo.com' },
    language: 'en' as const,
    setLanguage: vi.fn(),
    onProfileClick: vi.fn(),
    onSettingsClick: vi.fn(),
    onLogout: vi.fn(),
    translations: translations,
  };

  it('renders app title correctly', () => {
    render(<Header {...mockProps} />);
    expect(screen.getByText(translations.en.appTitle)).toBeInTheDocument();
  });

  it('calls setLanguage when language toggle is clicked', () => {
    render(<Header {...mockProps} />);
    const buttons = screen.getAllByRole('button');
    // The first button is the language toggle
    fireEvent.click(buttons[0]);
    expect(mockProps.setLanguage).toHaveBeenCalledWith('he');
  });

  it('calls onProfileClick when profile image is clicked', () => {
    render(<Header {...mockProps} />);
    const profileBtn = screen.getByRole('button', { name: /profile/i });
    fireEvent.click(profileBtn);
    expect(mockProps.onProfileClick).toHaveBeenCalled();
  });

  it('calls onSettingsClick when settings icon is clicked', () => {
    render(<Header {...mockProps} />);
    const buttons = screen.getAllByRole('button');
    // Settings is the 3rd button (Toggle, Profile, Settings, Logout)
    fireEvent.click(buttons[2]);
    expect(mockProps.onSettingsClick).toHaveBeenCalled();
  });

  it('calls onLogout when logout icon is clicked', () => {
    render(<Header {...mockProps} />);
    const buttons = screen.getAllByRole('button');
    // Logout is the 4th button
    fireEvent.click(buttons[3]);
    expect(mockProps.onLogout).toHaveBeenCalled();
  });

  it('renders placeholder icon if user has no photoURL', () => {
    const propsWithoutPhoto = { ...mockProps, user: { photoURL: null } };
    render(<Header {...propsWithoutPhoto} />);
    expect(screen.queryByRole('img', { name: /profile/i })).not.toBeInTheDocument();
  });
});
