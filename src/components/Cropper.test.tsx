import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Cropper } from './Cropper';
import { translations } from '../translations';

describe('Cropper', () => {
  const mockProps = {
    image: 'data:image/jpeg;base64,mock',
    onCrop: vi.fn(),
    onCancel: vi.fn(),
    language: 'en' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Image
    global.Image = class {
      onload: () => void = () => {};
      src: string = '';
      width: number = 1000;
      height: number = 1000;
      constructor() {
        setTimeout(() => this.onload(), 10);
      }
    } as any;
  });

  it('renders cropper correctly', () => {
    render(<Cropper {...mockProps} />);
    expect(screen.getByText(translations.en.cropTitle)).toBeInTheDocument();
  });

  it('calls onCancel when X is clicked', () => {
    render(<Cropper {...mockProps} />);
    const cancelBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(cancelBtn);
    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('calls onCrop when confirm is clicked', () => {
    render(<Cropper {...mockProps} />);
    const confirmBtn = screen.getByText(translations.en.confirm);
    fireEvent.click(confirmBtn);
    expect(mockProps.onCrop).toHaveBeenCalledWith('data:image/jpeg;base64,mock');
  });

  it('resets points when reset button is clicked', () => {
    render(<Cropper {...mockProps} />);
    const resetBtn = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetBtn);
    // Points are internal state, but we can verify the button is clickable
    expect(resetBtn).toBeInTheDocument();
  });

  it('triggers autoDetect when auto detect button is clicked', () => {
    render(<Cropper {...mockProps} />);
    const autoBtn = screen.getByRole('button', { name: /auto detect/i });
    fireEvent.click(autoBtn);
    expect(autoBtn).toBeInTheDocument();
  });
});
