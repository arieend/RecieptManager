import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MainView } from './MainView';
import { translations } from '../translations';

describe('MainView', () => {
  const mockProps = {
    user: { displayName: 'Test User' },
    history: [
      { id: '1', storeName: 'Store 1', total: 100, createdAt: new Date().toISOString(), items: [] }
    ],
    onScan: vi.fn(),
    onUpload: vi.fn(),
    onUploadFolder: vi.fn(),
    onHistoryClick: vi.fn(),
    onSessionClick: vi.fn(),
    onSettingsClick: vi.fn(),
    translations,
    language: 'en' as const,
    currencySymbol: '$',
    driveToken: 'mock-token',
    onReconnectDrive: vi.fn(),
    settings: {
      storagePath: 'Receipts',
      directories: { year: true, month: true, day: false },
      autoSave: true,
      syncToSheets: true,
      spreadsheetId: '',
      spreadsheetName: 'Receipts Database',
      currency: 'ILS' as const,
      theme: 'light' as const
    }
  };

  it('renders welcome message with user name', () => {
    render(<MainView {...mockProps} />);
    expect(screen.getByText(/Welcome, Test/i)).toBeInTheDocument();
  });

  it('calls onScan when Scan Receipt is clicked', () => {
    render(<MainView {...mockProps} />);
    const scanBtn = screen.getByRole('button', { name: /Scan Receipt/i });
    fireEvent.click(scanBtn);
    expect(mockProps.onScan).toHaveBeenCalled();
  });

  it('calls onHistoryClick when View All is clicked', () => {
    render(<MainView {...mockProps} />);
    const viewAllBtn = screen.getByRole('button', { name: /View All/i });
    fireEvent.click(viewAllBtn);
    expect(mockProps.onHistoryClick).toHaveBeenCalled();
  });

  it('calls onSessionClick when a history card is clicked', () => {
    render(<MainView {...mockProps} />);
    const historyCard = screen.getByText('Store 1');
    fireEvent.click(historyCard);
    expect(mockProps.onSessionClick).toHaveBeenCalledWith(mockProps.history[0]);
  });

  it('shows drive warning when driveToken is missing', () => {
    render(<MainView {...mockProps} driveToken={null} />);
    expect(screen.getByText(/Google Drive Disconnected/i)).toBeInTheDocument();
    const reconnectBtn = screen.getByRole('button', { name: /Connect Google Drive/i });
    fireEvent.click(reconnectBtn);
    expect(mockProps.onReconnectDrive).toHaveBeenCalled();
  });

  it('renders empty state when history is empty', () => {
    render(<MainView {...mockProps} history={[]} />);
    expect(screen.getByText(translations.en.noHistory)).toBeInTheDocument();
  });
});
