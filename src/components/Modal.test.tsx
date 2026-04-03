import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Modal, ConfirmModal, PromptModal } from './Modal';

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, onClick, className }: any) => <div onClick={onClick} className={className}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('Modal Components', () => {
  describe('Modal', () => {
    it('renders when isOpen is true', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <div>Modal Content</div>
        </Modal>
      );
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
          <div>Modal Content</div>
        </Modal>
      );
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal">
          <div>Modal Content</div>
        </Modal>
      );
      const closeBtn = screen.getByRole('button');
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('ConfirmModal', () => {
    it('calls onConfirm and onClose when confirm button is clicked', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();
      render(
        <ConfirmModal 
          isOpen={true} 
          onClose={onClose} 
          onConfirm={onConfirm} 
          title="Confirm?" 
          message="Are you sure?" 
          confirmLabel="Yes" 
          cancelLabel="No" 
        />
      );
      const confirmBtn = screen.getByText('Yes');
      fireEvent.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('PromptModal', () => {
    it('calls onConfirm with input value', () => {
      const onConfirm = vi.fn();
      render(
        <PromptModal 
          isOpen={true} 
          onClose={vi.fn()} 
          onConfirm={onConfirm} 
          title="Prompt" 
          label="Name" 
          confirmLabel="Submit" 
          cancelLabel="Cancel" 
        />
      );
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Test Value' } });
      const submitBtn = screen.getByText('Submit');
      fireEvent.click(submitBtn);
      expect(onConfirm).toHaveBeenCalledWith('Test Value');
    });
  });
});
