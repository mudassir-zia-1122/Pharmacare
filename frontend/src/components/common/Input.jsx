import clsx from 'clsx';

export function Input({
  label,
  id,
  error,
  hint,
  leftElement,
  rightElement,
  className = '',
  required = false,
  ...props
}) {
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {leftElement && (
          <div className="absolute left-3 text-slate-400 pointer-events-none">
            {leftElement}
          </div>
        )}
        <input
          id={id}
          className={clsx(
            'w-full rounded-lg border bg-white dark:bg-slate-800',
            'text-slate-900 dark:text-slate-100',
            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent',
            'disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:cursor-not-allowed disabled:text-slate-400',
            leftElement  ? 'pl-10' : 'pl-3',
            rightElement ? 'pr-10' : 'pr-3',
            'py-2.5 text-sm',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-slate-300 dark:border-slate-600',
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 text-slate-400">
            {rightElement}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-500 flex items-center gap-1">⚠ {error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Select({ label, id, error, hint, className = '', required = false, children, ...props }) {
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        id={id}
        className={clsx(
          'w-full rounded-lg border bg-white dark:bg-slate-800',
          'text-slate-900 dark:text-slate-100 text-sm',
          'px-3 py-2.5',
          'focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent',
          'transition-colors duration-150',
          error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600',
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500">⚠ {error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Textarea({ label, id, error, hint, className = '', required = false, rows = 3, ...props }) {
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        className={clsx(
          'w-full rounded-lg border bg-white dark:bg-slate-800',
          'text-slate-900 dark:text-slate-100 text-sm',
          'px-3 py-2.5 resize-y',
          'focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent',
          'transition-colors duration-150',
          error ? 'border-red-500' : 'border-slate-300 dark:border-slate-600',
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">⚠ {error}</p>}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
