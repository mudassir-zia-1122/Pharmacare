import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DEMO_TAG } from '../../data/demoData';

export function PageHeader({ title, subtitle, breadcrumbs = [], actions = null, showDemoTag = false }) {
  return (
    <div className="mb-6">
      {breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-sm text-slate-400 mb-2" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} />}
              {crumb.to ? (
                <Link to={crumb.to} className="hover:text-green-600 transition-colors">{crumb.label}</Link>
              ) : (
                <span className="text-slate-600 dark:text-slate-300 font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
              {showDemoTag && (
                <span className="demo-badge">{DEMO_TAG}</span>
              )}
            </div>
            {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}
