import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SettingsModal } from './SettingsModal';
import { translations } from '../translations';

// Mock motion to avoid animation issues
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('SettingsModal', () => {
  const mockSettings = {
    storagePath: 'Receipts',
    directories: { year: true, month: true, day: false },
    autoSave: true,
    syncToSheets: true,
    spreadsheetId: 'sheet-123',
    spreadsheetName: 'Receipts Database',
    currency: 'ILS' as const,
  };

  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    settings: mockSettings,
    onSave: vi.fn(),
    t: translations.en,
    language: 'en',
  };

  it('renders settings fields correctly', () => {
    render(<SettingsModal {...mockProps} />);
    expect(screen.getByText(translations.en.settings)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Receipts')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sheet-123')).toBeInTheDocument();
  });

  it('updates local state when fields are changed', () => {
    render(<SettingsModal {...mockProps} />);
    const pathInput = screen.getByDisplayValue('Receipts');
    fireEvent.change(pathInput, { target: { value: 'New Path' } });
    expect(pathInput).toHaveValue('New Path');
  });

  it('calls onSave and onClose when save button is clicked', () => {
    render(<SettingsModal {...mockProps} />);
    const saveBtn = screen.getByText(translations.en.saveSettings);
    fireEvent.click(saveBtn);
    expect(mockProps.onSave).toHaveBeenCalled();
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('toggles directory settings', () => {
    render(<SettingsModal {...mockProps} />);
    const dayBtn = screen.getByText(translations.en.day).parentElement;
    if (dayBtn) fireEvent.click(dayBtn);
    // We can't easily check the state without onSave, but we can check if it calls onSave with updated value
    const saveBtn = screen.getByText(translations.en.saveSettings);
    fireEvent.click(saveBtn);
    expect(mockProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
      directories: expect.objectContaining({ day: true })
    }));
  });

  it('toggles autoSave', () => {
    render(<SettingsModal {...mockProps} />);
    const autoSaveBtn = screen.getByText(translations.en.autoSave).parentElement;
    if (autoSaveBtn) fireEvent.click(autoSaveBtn);
    
    const saveBtn = screen.getByText(translations.en.saveSettings);
    fireEvent.click(saveBtn);
    expect(mockProps.onSave).toHaveBeenCalledWith(expect.objectContaining({
      autoSave: false
    }));
  });
});
