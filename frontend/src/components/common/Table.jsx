import clsx from 'clsx';

export function Table({ children, className = '' }) {
  return (
    <div className="overflow-x-auto">
      <table className={clsx('w-full text-sm border-collapse', className)}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }) {
  return (
    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      {children}
    </thead>
  );
}

export function Th({ children, className = '', ...props }) {
  return (
    <th
      className={clsx(
        'px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Tbody({ children }) {
  return (
    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
      {children}
    </tbody>
  );
}

export function Tr({ children, className = '', onClick, ...props }) {
  return (
    <tr
      onClick={onClick}
      className={clsx(
        'bg-white dark:bg-slate-900 transition-colors duration-100',
        onClick && 'cursor-pointer',
        'hover:bg-slate-50 dark:hover:bg-slate-800',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className = '', ...props }) {
  return (
    <td
      className={clsx('px-4 py-3 text-slate-700 dark:text-slate-300', className)}
      {...props}
    >
      {children}
    </td>
  );
}
