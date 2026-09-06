/**
 * PeoplePay585 — Time Off Allocations List Page
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Plus, Search, Filter } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';

export default function TimeOffAllocationsPage() {
  const navigate = useNavigate();
  const { isMinRole } = useAuth();
  const isManager = isMinRole('hr_manager');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ['timeoff-allocations', search, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/timeoff/allocations', { params });
      return res.data;
    },
    enabled: isManager,
  });

  if (!isManager) {
    return <div>Access Denied</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Time Off Allocations"
        subtitle="Manage employee leave allocations"
        action={
          <button
            onClick={() => navigate('/timeoff/allocations/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base"
          >
            <Plus size={16} /> New Allocation
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search allocations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-base"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg">
              <Filter size={16} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border-none outline-none bg-transparent text-slate-700"
              >
                <option value="">All Statuses</option>
                <option value="pending">To Approve</option>
                <option value="approved">Approved</option>
                <option value="refused">Refused</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
          </div>
        ) : allocations.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarDays size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No allocations found</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="text-left px-4 py-3 font-medium">Employee</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-right px-4 py-3 font-medium">Allocated</th>
                  <th className="text-right px-4 py-3 font-medium">Taken</th>
                  <th className="text-right px-4 py-3 font-medium">Remaining</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a: any) => (
                  <tr
                    key={a.id}
                    onClick={() => navigate(`/timeoff/allocations/${a.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-base"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {a.employee_name}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {a.type_name}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {a.total_days} {a.total_days === 1 ? 'day' : 'days'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {a.used_days} {a.used_days === 1 ? 'day' : 'days'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {a.remaining_days} {a.remaining_days === 1 ? 'day' : 'days'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
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
