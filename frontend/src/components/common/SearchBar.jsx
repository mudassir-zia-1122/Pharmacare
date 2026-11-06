import { Search, X } from 'lucide-react';
import clsx from 'clsx';

export function SearchBar({ value, onChange, placeholder = 'Search…', className = '', onClear }) {
  return (
    <div className={clsx('relative', className)}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={clsx(
          'w-full pl-9 pr-8 py-2 text-sm rounded-lg',
          'bg-white dark:bg-slate-800',
          'border border-slate-300 dark:border-slate-600',
          'text-slate-900 dark:text-slate-100 placeholder:text-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent',
          'transition-colors duration-150',
        )}
      />
      {value && (
        <button
          onClick={() => { onChange(''); onClear?.(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
