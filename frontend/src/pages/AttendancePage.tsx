/**
 * PeoplePay585 — Attendance List Page
 * Matches HRMS OXP "Attendance Flow" reference layout.
 * Search, Today toggle, Employee filter, NEW button, clickable rows → detail.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock, LogIn, LogOut, Plus, Search, CalendarDays,
  Users, Filter, ChevronDown,
} from 'lucide-react';

import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';

interface AttendanceRecord {
  id: number;
  employee_id: number;
  date: string;
  check_in: string;
  check_out: string | null;
  worked_hours: number | null;
  overtime_hours: number | null;
  status: string;
  employee_name?: string;
  employee_number?: string;
  department_name?: string;
  notes?: string;
}

interface EmployeeOption {
  id: number;
  full_name: string;
  employee_number: string;
}

function formatDuration(decimalHours: number | null | undefined | string): string {
  if (!decimalHours) return '0h 0m';
  const num = typeof decimalHours === 'string' ? parseFloat(decimalHours) : decimalHours;
  if (isNaN(num)) return '0h 0m';
  const hrs = Math.floor(num);
  const mins = Math.round((num - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h 0m`;
  return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
}

export default function AttendancePage() {
  const { isMinRole } = useAuth();
  const isHr = isMinRole('hr_manager');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Filters state
  const employeeIdFromUrl = searchParams.get('employee_id');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employeeIdFromUrl || '');
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);

  // Sync URL param
  useEffect(() => {
    if (employeeIdFromUrl) setSelectedEmployeeId(employeeIdFromUrl);
  }, [employeeIdFromUrl]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch employees for filter dropdown
  const { data: employeesData } = useQuery<{ employees: EmployeeOption[] }>({
    queryKey: ['employees_list_for_filter'],
    queryFn: async () => (await api.get('/employees', { params: { limit: 200 } })).data,
  });
  const employees: EmployeeOption[] = employeesData?.employees || [];

  // Build query params
  const buildParams = () => {
    const params: Record<string, string> = {};
    if (selectedEmployeeId) params.employee_id = selectedEmployeeId;
    if (todayOnly) params.date = new Date().toISOString().slice(0, 10);
    if (debouncedSearch) params.search = debouncedSearch;
    params.limit = '200';
    return params;
  };

  // Fetch attendance records
  const { data: records = [], isLoading, isError, refetch } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', selectedEmployeeId, todayOnly, debouncedSearch],
    queryFn: async () => {
      const res = await api.get('/attendance', { params: buildParams() });
      return Array.isArray(res.data) ? res.data : res.data.records || [];
    },
  });

  // Stats
  const totalRecords = records.length;
  const presentCount = records.filter(r => r.status === 'present').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const checkedInCount = records.filter(r => r.check_in && !r.check_out).length;
  const avgHoursNum = records.filter(r => r.worked_hours).length > 0
    ? (records.reduce((s, r) => s + (r.worked_hours || 0), 0) / records.filter(r => r.worked_hours).length)
    : null;
  const avgHours = avgHoursNum !== null ? formatDuration(avgHoursNum) : '-';

  const selectedEmployeeName = employees.find(e => e.id === Number(selectedEmployeeId))?.full_name || '';

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }
    catch { return '—'; }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    catch { return dateStr; }
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setTodayOnly(false);
    setSelectedEmployeeId('');
    setSearchParams({});
  };

  const hasActiveFilters = search || todayOnly || selectedEmployeeId;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Attendance"
        subtitle="List view of employee attendance records"
        action={
          isHr && (
            <button
              onClick={() => navigate('/attendance/new')}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-all shadow-sm shadow-primary-200"
            >
              <Plus size={16} />
              New
            </button>
          )
        }
      />

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search attendance..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none bg-white transition-all"
          />
        </div>

        {/* Today Toggle */}
        <button
          onClick={() => setTodayOnly(!todayOnly)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            todayOnly
              ? 'bg-primary-50 border-primary-200 text-primary-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <CalendarDays size={15} />
          Today
        </button>

        {/* Employee Filter */}
        {isHr && (
          <div className="relative">
            <button
              onClick={() => setEmployeeDropdownOpen(!employeeDropdownOpen)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all min-w-[160px] ${
                selectedEmployeeId
                  ? 'bg-primary-50 border-primary-200 text-primary-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Users size={15} />
              <span className="truncate max-w-[120px]">
                {selectedEmployeeId ? selectedEmployeeName || 'Employee' : 'All Employees'}
              </span>
              <ChevronDown size={14} className={`ml-auto transition-transform ${employeeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {employeeDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-lg z-50 max-h-72 overflow-y-auto py-1">
                <button
                  onClick={() => { setSelectedEmployeeId(''); setEmployeeDropdownOpen(false); setSearchParams({}); }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                    !selectedEmployeeId ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-600'
                  }`}
                >
                  All Employees
                </button>
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => {
                      setSelectedEmployeeId(String(emp.id));
                      setEmployeeDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                      selectedEmployeeId === String(emp.id) ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-600'
                    }`}
                  >
                    <span>{emp.full_name}</span>
                    <span className="text-xs text-slate-400 ml-2">{emp.employee_number}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-all"
          >
            <Filter size={14} />
            Clear
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: totalRecords, color: 'from-blue-500 to-cyan-500' },
          { label: 'Present', value: presentCount, color: 'from-emerald-500 to-teal-500' },
          { label: 'Late', value: lateCount, color: 'from-amber-500 to-orange-500' },
          { label: 'Absent', value: absentCount, color: 'from-red-500 to-rose-500' },
          { label: 'Still In', value: checkedInCount, color: 'from-violet-500 to-purple-500' },
          { label: 'Avg Hours', value: avgHours, color: 'from-indigo-500 to-blue-500' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-3.5">
            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{s.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{s.value}</p>
            <div className={`h-1 w-10 rounded-full bg-gradient-to-r ${s.color} mt-2`} />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500 mt-3">Loading attendance...</p>
          </div>
        ) : isError ? (
          <div className="p-12 text-center">
            <Clock size={40} className="mx-auto text-red-300 mb-3" />
            <p className="text-slate-700 font-medium">Unable to load attendance records</p>
            <p className="text-sm text-slate-500 mt-1">Please try again.</p>
            <button onClick={() => refetch()} className="mt-3 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">Retry</button>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <Clock size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-700 font-medium">No attendance records found</p>
            <p className="text-sm text-slate-500 mt-1">
              {hasActiveFilters ? 'Try adjusting your filters.' : 'Create a new attendance record to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3.5 font-semibold text-slate-600">Employee</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-slate-600">Date</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-slate-600">Check In</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-slate-600">Check Out</th>
                  <th className="text-right px-4 py-3.5 font-semibold text-slate-600">Overtime</th>
                  <th className="text-right px-4 py-3.5 font-semibold text-slate-600">Worked Hours</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/attendance/${r.id}`)}
                    className="border-b border-slate-100 hover:bg-primary-50/30 transition-all cursor-pointer"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-900">{r.employee_name || `Employee #${r.employee_id}`}</p>
                      <p className="text-xs text-slate-500">{r.employee_number}{r.department_name ? ` · ${r.department_name}` : ''}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{formatDate(r.date)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <LogIn size={14} /> {formatTime(r.check_in)}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {r.check_out ? (
                        <div className="flex items-center gap-1.5 text-rose-600">
                          <LogOut size={14} /> {formatTime(r.check_out)}
                        </div>
                      ) : (
                        <span className="text-amber-600 text-xs font-medium bg-amber-50 px-2 py-1 rounded-md">Missing</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {r.overtime_hours && Number(r.overtime_hours) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-orange-600 font-semibold bg-orange-50 px-2 py-0.5 rounded-md text-xs">
                          +{formatDuration(r.overtime_hours)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                      {formatDuration(r.worked_hours)}
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
