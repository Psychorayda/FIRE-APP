// 输入框组件 / Input component

interface InputProps {
  type: 'text' | 'number' | 'date';
  label?: string;
  value: string | number;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  prefix?: string;
  suffix?: string;
  onChange?: (value: string) => void;
}

export function Input({ type, label, value, error, placeholder, required, disabled, prefix, suffix, onChange }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>
        )}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className={`w-full h-10 rounded-md border bg-white px-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed ${
            prefix ? 'pl-8' : ''
          } ${suffix ? 'pr-8' : ''} ${error ? 'border-red-300' : 'border-gray-300'}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
