import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scanner } from './Scanner';
import { translations } from '../translations';

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

describe('Scanner', () => {
  const mockProps = {
    onCapture: vi.fn(),
    onClose: vi.fn(),
    onFallback: vi.fn(),
    language: 'en' as const,
  };

  const mockStream = {
    getTracks: vi.fn(() => [{ stop: vi.fn() }]),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock navigator.mediaDevices.getUserMedia
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
      writable: true
    });

    // Mock HTMLVideoElement.prototype.play
    vi.spyOn(HTMLVideoElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  });

  it('starts camera on mount', async () => {
    render(<Scanner {...mockProps} />);
    await waitFor(() => {
      expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });
  });

  it('calls onClose when X is clicked', async () => {
    render(<Scanner {...mockProps} />);
    await waitFor(() => expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('toggles long receipt mode', async () => {
    render(<Scanner {...mockProps} />);
    await waitFor(() => expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    const modeBtn = screen.getByRole('button', { name: /single receipt mode/i });
    fireEvent.click(modeBtn);
    expect(screen.getByRole('button', { name: /long receipt mode/i })).toBeInTheDocument();
  });

  it('calls onFallback when fallback button is clicked (on error)', async () => {
    vi.mocked(global.navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(new Error('Denied'));
    render(<Scanner {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText(translations.en.cameraPermissionDenied)).toBeInTheDocument();
    });

    const fallbackBtn = screen.getByText(/Use System Camera/i);
    fireEvent.click(fallbackBtn);
    expect(mockProps.onFallback).toHaveBeenCalled();
  });

  it('captures image when capture button is clicked', async () => {
    const { container } = render(<Scanner {...mockProps} />);
    await waitFor(() => expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    
    // Wait for camera to be "ready"
    const video = container.querySelector('video') as HTMLVideoElement;
    if (video) {
      fireEvent(video, new Event('loadedmetadata'));
    }

    // The capture button is the large white one in the middle.
    const buttons = screen.getAllByRole('button');
    const captureButton = buttons.find(btn => btn.className.includes('w-20 h-20'));
    
    if (captureButton) {
      fireEvent.click(captureButton);
      // It should set currentCapture, which renders Cropper
      await waitFor(() => {
        expect(screen.getByText(translations.en.cropTitle)).toBeInTheDocument();
      });
    }
  });
});
