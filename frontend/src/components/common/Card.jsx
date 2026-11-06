import clsx from 'clsx';

export function Card({ children, className = '', padding = true, ...props }) {
  return (
    <div
      className={clsx(
        'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm',
        padding && 'p-6',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={clsx('flex items-start justify-between mb-4', className)}>
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, trendLabel, iconBg = 'bg-green-100 dark:bg-green-900/30', iconColor = 'text-green-600' }) {
  const isPositive = trend > 0;
  return (
    <Card className="flex items-start gap-4">
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', iconBg)}>
        {Icon && <Icon size={24} className={iconColor} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{value}</p>
        {(trend !== undefined || subtitle) && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {trend !== undefined && (
              <span className={isPositive ? 'text-green-600' : 'text-red-500'}>
                {isPositive ? '↑' : '↓'} {Math.abs(trend)}%
              </span>
            )}{' '}
            {trendLabel || subtitle}
          </p>
        )}
      </div>
    </Card>
  );
}
