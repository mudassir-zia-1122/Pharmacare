import clsx from 'clsx';

const variants = {
  green:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  red:    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  amber:  'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  blue:   'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  slate:  'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export function Badge({ children, variant = 'slate', className = '', dot = false }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold',
      variants[variant],
      className,
    )}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full bg-current')} />}
      {children}
    </span>
  );
}

/** Convenience wrappers for common statuses */
export function StatusBadge({ status }) {
  const map = {
    active:     { label: 'Active',      variant: 'green'  },
    inactive:   { label: 'Inactive',    variant: 'slate'  },
    discontinued:{ label: 'Discontinued',variant: 'slate' },
    expired:    { label: 'Expired',     variant: 'red'    },
    recalled:   { label: 'Recalled',    variant: 'red'    },
    quarantined:{ label: 'Quarantined', variant: 'amber'  },
    low_stock:  { label: 'Low Stock',   variant: 'amber'  },
    pending:    { label: 'Pending',     variant: 'blue'   },
    received:   { label: 'Received',    variant: 'green'  },
    partial:    { label: 'Partial',     variant: 'amber'  },
    completed:  { label: 'Completed',   variant: 'green'  },
    returned:   { label: 'Returned',    variant: 'red'    },
    processed:  { label: 'Processed',   variant: 'blue'   },
    verified:   { label: 'Verified',    variant: 'green'  },
  };
  const cfg = map[status] || { label: status, variant: 'slate' };
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>;
}

export function RoleBadge({ role }) {
  const map = {
    admin:         { label: 'Admin',         variant: 'purple' },
    pharmacist:    { label: 'Pharmacist',    variant: 'blue'   },
    stock_manager: { label: 'Stock Manager', variant: 'amber'  },
    cashier:       { label: 'Cashier',       variant: 'green'  },
    doctor:        { label: 'Doctor',        variant: 'blue'   },
    reception:     { label: 'Receptionist',  variant: 'amber'  },
  };
  const cfg = map[role] || { label: role, variant: 'slate' };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
