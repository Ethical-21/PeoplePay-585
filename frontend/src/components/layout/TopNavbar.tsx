/**
 * PeoplePay585 — Top Navigation Bar
 * Horizontal navbar replacing the sidebar. Role-aware dropdowns, responsive hamburger menu.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Users, FileText, Clock, CalendarOff, DollarSign,
  Calculator, Receipt, LogOut, Building2, Timer,
  ChevronDown, Menu, X, UserCog, LayoutDashboard,
  ClipboardList, CalendarDays,
} from 'lucide-react';


/* ─── Types ─── */
interface NavDropdownItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  minRole: string;
}

interface NavEntry {
  label: string;
  icon: React.ReactNode;
  minRole: string;
  to?: string;               // direct link (no dropdown)
  activePaths?: string[];     // paths that keep this entry highlighted
  children?: NavDropdownItem[];
}

/* ─── Navigation config ─── */
const navEntries: NavEntry[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard size={17} />,
    minRole: 'employee',
    to: '/',
    activePaths: ['/'],
  },
  {
    label: 'Employees',
    icon: <Users size={17} />,
    minRole: 'hr_manager',
    activePaths: ['/employees', '/departments'],
    children: [
      { to: '/employees', icon: <Users size={16} />, label: 'All Employees', minRole: 'hr_manager' },
      { to: '/departments', icon: <Building2 size={16} />, label: 'Departments', minRole: 'hr_manager' },
    ],
  },
  {
    label: 'Contracts',
    icon: <FileText size={17} />,
    minRole: 'employee',
    activePaths: ['/contracts', '/schedules'],
    children: [
      { to: '/contracts', icon: <FileText size={16} />, label: 'Contracts', minRole: 'employee' },
      { to: '/schedules', icon: <Timer size={16} />, label: 'Work Schedules', minRole: 'hr_manager' },
    ],
  },
  {
    label: 'Attendance',
    icon: <Clock size={17} />,
    minRole: 'employee',
    to: '/attendance',
    activePaths: ['/attendance'],
  },
  {
    label: 'Time Off',
    icon: <CalendarOff size={17} />,
    minRole: 'employee',
    activePaths: ['/timeoff'],
    children: [
      { to: '/timeoff/requests', icon: <CalendarOff size={16} />, label: 'Requests', minRole: 'employee' },
      { to: '/timeoff/allocations', icon: <CalendarDays size={16} />, label: 'Allocations', minRole: 'hr_manager' },
      { to: '/timeoff/types', icon: <ClipboardList size={16} />, label: 'Leave Types', minRole: 'hr_manager' },
    ],
  },
  {
    label: 'Payroll',
    icon: <DollarSign size={17} />,
    minRole: 'employee',
    activePaths: ['/salary', '/payruns', '/payslips'],
    children: [
      { to: '/payruns', icon: <Calculator size={16} />, label: 'Payruns', minRole: 'hr_payroll_user' },
      { to: '/payslips', icon: <Receipt size={16} />, label: 'Payslips', minRole: 'employee' },
      { to: '/salary/structures', icon: <DollarSign size={16} />, label: 'Salary Structures', minRole: 'hr_payroll_user' },
      { to: '/salary/rules', icon: <ClipboardList size={16} />, label: 'Salary Rules', minRole: 'hr_payroll_user' },
    ],
  },
  {
    label: 'Admin',
    icon: <UserCog size={17} />,
    minRole: 'admin',
    to: '/users',
    activePaths: ['/users'],
  },
];

/* ─── Dropdown Component ─── */
function Dropdown({
  entry,
  isActive,
}: {
  entry: NavEntry;
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isMinRole } = useAuth();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const visibleChildren = (entry.children || []).filter((c) => isMinRole(c.minRole));
  if (visibleChildren.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-base ${
          isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        {entry.icon}
        <span>{entry.label}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-200/50 py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          {visibleChildren.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              onClick={() => setOpen(false)}
              className={({ isActive: childActive }) =>
                `flex items-center gap-2.5 px-4 py-2.5 text-sm transition-base ${
                  childActive
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              {child.icon}
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main TopNavbar ─── */
export default function TopNavbar() {
  const { user, logout, isMinRole } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  // Close user menu on Escape
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [userMenuOpen]);

  const isEntryActive = useCallback(
    (entry: NavEntry) => {
      if (entry.to === '/' && location.pathname === '/') return true;
      if (entry.to === '/') return false;
      return (entry.activePaths || []).some((p) =>
        p === '/' ? location.pathname === '/' : location.pathname.startsWith(p)
      );
    },
    [location.pathname]
  );

  const visibleEntries = navEntries.filter((e) => isMinRole(e.minRole));

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* ── Left: Logo + Nav ── */}
          <div className="flex items-center gap-1">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2 mr-6 flex-shrink-0">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PP</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold text-slate-900 leading-tight">PeoplePay585</h1>
              </div>
            </NavLink>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {visibleEntries.map((entry) => {
                const active = isEntryActive(entry);
                if (entry.children) {
                  return <Dropdown key={entry.label} entry={entry} isActive={active} />;
                }
                return (
                  <NavLink
                    key={entry.label}
                    to={entry.to!}
                    end={entry.to === '/'}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-base ${
                      active
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {entry.icon}
                    <span>{entry.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* ── Right: User + Mobile Toggle ── */}
          <div className="flex items-center gap-2">
            {/* User Menu (Desktop) */}
            <div ref={userRef} className="relative hidden lg:block">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-100 transition-base"
              >
                <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-700 font-semibold text-xs">
                    {user?.full_name?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="text-left hidden xl:block">
                  <p className="text-sm font-medium text-slate-900 leading-tight truncate max-w-[120px]">
                    {user?.full_name}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight capitalize">
                    {user?.roles?.[0]?.replace(/_/g, ' ')}
                  </p>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-200/50 py-2 z-50">
                  {/* User info header */}
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-900">{user?.full_name}</p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                    <p className="text-[10px] text-primary-600 font-medium capitalize mt-0.5">
                      {user?.roles?.[0]?.replace(/_/g, ' ')}
                    </p>
                  </div>
                  {/* Logout */}
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-600 hover:text-danger-600 hover:bg-danger-50 transition-base"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-base"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Menu ── */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white max-h-[calc(100vh-56px)] overflow-y-auto">
          <nav className="p-3 space-y-1">
            {visibleEntries.map((entry) => {
              if (entry.children) {
                const visibleChildren = entry.children.filter((c) => isMinRole(c.minRole));
                if (visibleChildren.length === 0) return null;
                return (
                  <MobileDropdown
                    key={entry.label}
                    entry={entry}
                    children={visibleChildren}
                    isActive={isEntryActive(entry)}
                  />
                );
              }
              return (
                <NavLink
                  key={entry.label}
                  to={entry.to!}
                  end={entry.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-base ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  {entry.icon}
                  {entry.label}
                </NavLink>
              );
            })}
          </nav>

          {/* Mobile User Section */}
          <div className="border-t border-slate-200 p-3">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-700 font-semibold text-xs">
                  {user?.full_name?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{user?.full_name}</p>
                <p className="text-xs text-slate-500 truncate capitalize">{user?.roles?.[0]?.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-slate-600 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-base"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─── Mobile Dropdown ─── */
function MobileDropdown({
  entry,
  children,
  isActive,
}: {
  entry: NavEntry;
  children: NavDropdownItem[];
  isActive: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-base ${
          isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <span className="flex items-center gap-3">
          {entry.icon}
          {entry.label}
        </span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="ml-6 mt-0.5 space-y-0.5 border-l-2 border-slate-200 pl-3">
          {children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              className={({ isActive: childActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-base ${
                  childActive
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              {child.icon}
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
