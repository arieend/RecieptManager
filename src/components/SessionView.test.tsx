import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionView } from './SessionView';
import { translations } from '../translations';
import * as geminiService from '../services/geminiService';

// Mock motion to avoid animation issues
vi.mock('motion/react', () => {
  const React = require('react');
  const motion = (Component: any) => Component;
  const tags = ['div', 'span', 'button', 'section', 'h1', 'h2', 'h3', 'p', 'img', 'video', 'canvas', 'svg', 'path', 'line'];
  tags.forEach(tag => {
    (motion as any)[tag] = React.forwardRef(({ children, ...props }: any, ref: any) => {
      const { initial, animate, exit, transition, ...rest } = props;
      return React.createElement(tag, { ...rest, ref }, children);
    });
  });
  return {
    motion,
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

vi.mock('../services/geminiService');

describe('SessionView', () => {
  const mockSession = {
    id: '1',
    userId: 'user1',
    storeName: 'Test Store',
    items: [
      { id: 'i1', name: 'Item 1', price: 10, quantity: 1, assignedTo: ['person-family'], category: 'Food', labels: ['Tag1'] },
    ],
    people: [
      { id: 'person-family', name: 'Family', color: '#ff0000' },
    ],
    tax: 0,
    tip: 0,
    total: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    imageUrl: 'data:image/jpeg;base64,mock',
    driveFileId: '',
    driveLink: '',
    driveFileName: '',
  };

  const mockProps = {
    session: mockSession,
    setSession: vi.fn(),
    onBack: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onChat: vi.fn(),
    translations: translations,
    language: 'en' as const,
    currencySymbol: '$',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders session details correctly', () => {
    render(<SessionView {...mockProps} />);
    expect(screen.getByText('Test Store')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getAllByText('Family').length).toBeGreaterThan(0);
  });

  it('calls onBack when back button is clicked', () => {
    render(<SessionView {...mockProps} />);
    const backBtn = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backBtn);
    expect(mockProps.onBack).toHaveBeenCalled();
  });

  it('calls onSave when save button is clicked', () => {
    render(<SessionView {...mockProps} />);
    const saveBtn = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveBtn);
    expect(mockProps.onSave).toHaveBeenCalled();
  });

  it('calls onDelete when delete button is clicked', () => {
    render(<SessionView {...mockProps} />);
    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteBtn);
    expect(mockProps.onDelete).toHaveBeenCalled();
  });

  it('opens chat when chat button is clicked', () => {
    render(<SessionView {...mockProps} />);
    const chatBtn = screen.getByRole('button', { name: /chat/i });
    fireEvent.click(chatBtn);
    expect(screen.getByText(translations.en.aiAssistant)).toBeInTheDocument();
  });

  it('calls onChat when message is sent', () => {
    render(<SessionView {...mockProps} />);
    fireEvent.click(screen.getByRole('button', { name: /chat/i }));
    const input = screen.getByPlaceholderText(translations.en.typeCommand);
    fireEvent.change(input, { target: { value: 'Assign Item 1 to John' } });
    const sendBtn = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendBtn);
    expect(mockProps.onChat).toHaveBeenCalledWith('Assign Item 1 to John');
  });

  it('calls categorizeItems when regenerate button is clicked', async () => {
    vi.mocked(geminiService.categorizeItems).mockResolvedValueOnce([
      { name: 'Item 1', category: 'New Cat', labels: ['New Tag'] }
    ]);
    render(<SessionView {...mockProps} />);
    const regenerateBtn = screen.getByRole('button', { name: /regenerate/i });
    fireEvent.click(regenerateBtn);
    
    await waitFor(() => {
      expect(geminiService.categorizeItems).toHaveBeenCalled();
      expect(mockProps.setSession).toHaveBeenCalled();
    });
  });

  it('opens image modal when eye icon is clicked', () => {
    render(<SessionView {...mockProps} />);
    const eyeBtn = screen.getByRole('button', { name: /view image/i });
    fireEvent.click(eyeBtn);
    expect(screen.getByText(translations.en.viewOriginal)).toBeInTheDocument();
  });
});
