import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content — offset by sidebar width on desktop */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <TopBar onMenuToggle={() => setMobileOpen(true)} />

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>

        {/* Global Footer with Dynamic Year */}
        <footer className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>&copy; {new Date().getFullYear()} PharmaCare Pharmacy Management System. All rights reserved.</span>
          <span>DRAP Compliant • FEFO Batch Expiry Controlled</span>
        </footer>
      </div>
    </div>
  );
}
