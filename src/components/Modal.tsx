import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { Button } from './ui/Base';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-md' }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className={`relative w-full ${maxWidth} bg-white rounded-3xl shadow-2xl overflow-hidden`}
        >
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-xl font-bold text-slate-900">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
              <X size={20} />
            </button>
          </div>
          <div className="p-6">
            {children}
          </div>
          {footer && (
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isDanger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, onClose, onConfirm, title, message, confirmLabel, cancelLabel, isDanger 
}) => (
  <Modal 
    isOpen={isOpen} 
    onClose={onClose} 
    title={title}
    footer={
      <>
        <Button variant="ghost" onClick={onClose} className="flex-1">{cancelLabel}</Button>
        <Button 
          variant={isDanger ? 'danger' : 'primary'} 
          onClick={() => { onConfirm(); onClose(); }} 
          className="flex-1"
        >
          {confirmLabel}
        </Button>
      </>
    }
  >
    <p className="text-slate-600 leading-relaxed">{message}</p>
  </Modal>
);

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel: string;
  initialValue?: string;
  type?: string;
}

export const PromptModal: React.FC<PromptModalProps> = ({ 
  isOpen, onClose, onConfirm, title, label, placeholder, confirmLabel, cancelLabel, initialValue = '', type = 'text'
}) => {
  const [value, setValue] = useState(initialValue);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className="flex-1">{cancelLabel}</Button>
          <Button 
            variant="primary" 
            onClick={() => { onConfirm(value); onClose(); setValue(''); }} 
            disabled={!value.trim()}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">{label}</label>
        <input 
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
        />
      </div>
    </Modal>
  );
};
