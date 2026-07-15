// 按钮组件 / Button component

import type { ReactNode, MouseEvent } from 'react';

interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonProps['variant'], string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
};

const SIZE_CLASSES: Record<ButtonProps['size'], string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({ variant, size, loading, disabled, icon, onClick, children }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]}`}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {!loading && icon}
      {children}
    </button>
  );
}
