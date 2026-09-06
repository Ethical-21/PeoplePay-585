/**
 * PeoplePay585 — Working Schedules List Page
 * Table layout with search, filter, columns toggle, and List/Calendar tabs.
 * Matches the mockup reference.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { Plus, Timer, Search, Calendar, Filter, Columns, List } from 'lucide-react';

interface Schedule {
  id: number;
  name: string;
  company: string;
  timezone: string;
  status: string;
  total_weekly_hours: number;
  working_days_count: number;
  working_days: string[];
  assigned_contracts_count: number;
  break_duration_minutes: number;
  created_at: string;
}

/* ─── Column definitions ─── */
const ALL_COLUMNS = [
  { key: 'name', label: 'Schedule Name', default: true },
  { key: 'days', label: 'Days / Week', default: true },
  { key: 'hours', label: 'Hours / Week', default: true },
  { key: 'company', label: 'Company', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'contracts', label: 'Contracts', default: false },
  { key: 'timezone', label: 'Timezone', default: false },
];

export default function SchedulesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filter state
  const [showFilter, setShowFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);

  // Columns state
  const [showColumns, setShowColumns] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    new Set(ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  );
  const columnsRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilter(false);
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) setShowColumns(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter) params.status = statusFilter;
    if (companyFilter) params.company = companyFilter;
    return params;
  }, [debouncedSearch, statusFilter, companyFilter]);

  const { data: schedules = [], isLoading, isError } = useQuery<Schedule[]>({
    queryKey: ['schedules', queryParams],
    queryFn: () => api.get('/schedules', { params: queryParams }).then(r => r.data),
  });

  const toggleColumn = (key: string) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Don't allow hiding the name column
        if (key === 'name') return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setStatusFilter('');
    setCompanyFilter('');
  };

  const hasActiveFilters = statusFilter || companyFilter;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Working Schedules</h1>
          <p className="text-sm text-slate-500 mt-1">Manage weekly work schedules for employee contracts</p>
        </div>
        <button
          onClick={() => navigate('/schedules/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus size={16} />
          New Schedule
        </button>
      </div>

      {/* ── Content Card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-slate-200 px-6">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'list'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <List size={16} /> List
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'calendar'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Calendar size={16} /> Calendar
          </button>
        </div>

        {activeTab === 'list' ? (
          <>
            {/* Search / Filter / Columns bar */}
            <div className="flex items-center gap-3 px-6 py-4 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search schedules..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>

              {/* Filter dropdown */}
              <div ref={filterRef} className="relative">
                <button
                  onClick={() => { setShowFilter(!showFilter); setShowColumns(false); }}
                  className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    hasActiveFilters
                      ? 'border-primary-300 bg-primary-50 text-primary-700'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Filter size={14} />
                  Filter
                  {hasActiveFilters && (
                    <span className="w-4 h-4 bg-primary-600 text-white rounded-full text-[10px] flex items-center justify-center">
                      {(statusFilter ? 1 : 0) + (companyFilter ? 1 : 0)}
                    </span>
                  )}
                </button>
                {showFilter && (
                  <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-lg py-3 z-50">
                    <div className="px-4 pb-2 mb-2 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Filters</span>
                      {hasActiveFilters && (
                        <button onClick={clearFilters} className="text-xs text-primary-600 hover:underline">Clear all</button>
                      )}
                    </div>
                    <div className="px-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">All</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Company</label>
                        <input
                          type="text"
                          value={companyFilter}
                          onChange={(e) => setCompanyFilter(e.target.value)}
                          placeholder="Filter by company..."
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Columns dropdown */}
              <div ref={columnsRef} className="relative">
                <button
                  onClick={() => { setShowColumns(!showColumns); setShowFilter(false); }}
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Columns size={14} />
                  Columns
                </button>
                {showColumns && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-slate-200 shadow-lg py-2 z-50">
                    {ALL_COLUMNS.map(col => (
                      <label key={col.key} className="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleCols.has(col.key)}
                          onChange={() => toggleColumn(col.key)}
                          disabled={col.key === 'name'}
                          className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Table ── */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-y border-slate-200">
                  <tr>
                    {visibleCols.has('name') && (
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Schedule Name</th>
                    )}
                    {visibleCols.has('days') && (
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Days / Week</th>
                    )}
                    {visibleCols.has('hours') && (
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hours / Week</th>
                    )}
                    {visibleCols.has('company') && (
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                    )}
                    {visibleCols.has('status') && (
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    )}
                    {visibleCols.has('contracts') && (
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contracts</th>
                    )}
                    {visibleCols.has('timezone') && (
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Timezone</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={visibleCols.size} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-7 h-7 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                          <span className="text-sm text-slate-500">Loading working schedules...</span>
                        </div>
                      </td>
                    </tr>
                  ) : isError ? (
                    <tr>
                      <td colSpan={visibleCols.size} className="px-6 py-12 text-center">
                        <p className="text-sm text-red-500">Unable to load working schedules. Please try again.</p>
                      </td>
                    </tr>
                  ) : schedules.length === 0 ? (
                    <tr>
                      <td colSpan={visibleCols.size} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Timer size={32} className="text-slate-300" />
                          <p className="text-sm text-slate-500">
                            {debouncedSearch || hasActiveFilters
                              ? 'No schedules match your search or filters.'
                              : 'No working schedules found.'}
                          </p>
                          {(debouncedSearch || hasActiveFilters) && (
                            <button
                              onClick={() => { setSearch(''); clearFilters(); }}
                              className="text-xs text-primary-600 hover:underline mt-1"
                            >
                              Clear search & filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    schedules.map(s => (
                      <tr
                        key={s.id}
                        onClick={() => navigate(`/schedules/${s.id}`)}
                        className="hover:bg-primary-50/40 cursor-pointer transition-colors group"
                      >
                        {visibleCols.has('name') && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-primary-200 transition-colors">
                                <Timer size={16} className="text-primary-600" />
                              </div>
                              <span className="font-medium text-slate-900 group-hover:text-primary-700 transition-colors">{s.name}</span>
                            </div>
                          </td>
                        )}
                        {visibleCols.has('days') && (
                          <td className="px-6 py-4 text-slate-700">{s.working_days_count}</td>
                        )}
                        {visibleCols.has('hours') && (
                          <td className="px-6 py-4 text-slate-700 font-medium">{s.total_weekly_hours}h</td>
                        )}
                        {visibleCols.has('company') && (
                          <td className="px-6 py-4 text-slate-600">{s.company}</td>
                        )}
                        {visibleCols.has('status') && (
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              s.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              {s.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        )}
                        {visibleCols.has('contracts') && (
                          <td className="px-6 py-4 text-slate-600">{s.assigned_contracts_count}</td>
                        )}
                        {visibleCols.has('timezone') && (
                          <td className="px-6 py-4 text-slate-500 text-xs">{s.timezone}</td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer with count */}
            {!isLoading && schedules.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400">
                {schedules.length} schedule{schedules.length !== 1 ? 's' : ''}
              </div>
            )}
          </>
        ) : (
          /* Calendar tab placeholder */
          <div className="p-12 text-center">
            <Calendar size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-sm text-slate-500">Calendar view coming soon.</p>
            <p className="text-xs text-slate-400 mt-1">Switch to List view to manage working schedules.</p>
          </div>
        )}
      </div>
    </div>
  );
}
