'use client';

import { useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  autoComplete?: string;
  leftIcon?: ReactNode;
}

export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Enter password',
  required = false,
  minLength,
  className = '',
  id,
  name,
  disabled = false,
  autoComplete = 'current-password',
  leftIcon,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  // Build className: use custom className if provided, otherwise use default
  // Always add pr-10 for the eye icon button space
  // Add pl-10 if leftIcon is provided and no custom className
  let finalClassName = className || 'input-field';
  if (!className && leftIcon) {
    finalClassName += ' pl-10';
  }
  if (!className || !className.includes('pr-')) {
    finalClassName += ' pr-10';
  }

  return (
    <div className="relative">
      {leftIcon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {/* @ts-ignore - React 19 type compatibility issue */}
          {leftIcon}
        </div>
      )}
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className={finalClassName}
        id={id}
        name={name}
        disabled={disabled}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
        tabIndex={-1}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? (
          <EyeOff className="h-5 w-5" />
        ) : (
          <Eye className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}

