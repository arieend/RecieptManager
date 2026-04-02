import React from 'react';
import { motion } from 'motion/react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200",
    secondary: "bg-emerald-500 text-white hover:bg-emerald-400 border border-emerald-400",
    outline: "bg-white border border-slate-200 text-slate-700 hover:border-emerald-500",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
    danger: "bg-red-50 text-red-600 hover:bg-red-100"
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3",
    lg: "px-8 py-4 text-lg",
    icon: "p-2"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
        />
      ) : (
        <>
          {leftIcon && <span className="mr-2 rtl:ml-2 rtl:mr-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="ml-2 rtl:mr-2 rtl:ml-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => {
  const hasBg = className.includes('bg-');
  return (
    <div 
      onClick={onClick}
      className={`${!hasBg ? 'bg-white' : ''} rounded-3xl border border-slate-200 shadow-sm ${onClick ? 'cursor-pointer hover:border-emerald-500 transition-all' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; color?: string; onRemove?: () => void }> = ({ children, color, onRemove }) => (
  <div 
    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm font-bold"
    style={{ backgroundColor: color || '#10b981' }}
  >
    {children}
    {onRemove && (
      <button onClick={onRemove} className="hover:bg-black/10 rounded-full p-0.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    )}
  </div>
);
