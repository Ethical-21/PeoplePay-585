/**
 * PeoplePay585 — Time Off Requests List Page
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, Search, Filter, User } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import EmployeeDashboard from '../components/ui/EmployeeDashboard';

export default function TimeOffPage() {
  const navigate = useNavigate();
  const { isMinRole } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      const res = await api.get('/employees', { params: { limit: 1000 } });
      return res.data.employees || [];
    },
    enabled: isMinRole('hr_manager'),
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['timeoff-requests', search, statusFilter, selectedEmployeeId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (selectedEmployeeId) params.employee_id = selectedEmployeeId;
      const res = await api.get('/timeoff/requests', { params });
      return res.data;
    },
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ['timeoff-allocations', selectedEmployeeId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedEmployeeId) params.employee_id = selectedEmployeeId;
      const res = await api.get('/timeoff/allocations', { params });
      return res.data;
    },
    enabled: !isMinRole('hr_manager') || !!selectedEmployeeId,
  });

  const { data: attendances = [] } = useQuery({
    queryKey: ['attendances', selectedEmployeeId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedEmployeeId) params.employee_id = selectedEmployeeId;
      const res = await api.get('/attendance', { params });
      return res.data;
    },
    enabled: !isMinRole('hr_manager') || !!selectedEmployeeId,
  });

  const shouldShowDashboard = !isMinRole('hr_manager') || !!selectedEmployeeId;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Time Off Requests"
        subtitle="Manage and track leave requests"
        action={
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {isMinRole('hr_manager') && (
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                <User size={16} className="text-slate-400" />
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="text-sm border-none outline-none bg-transparent text-slate-700 min-w-[150px]"
                >
                  <option value="">All Employees</option>
                  {employees.map((e: any) => (
                    <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => navigate('/timeoff/requests/new')}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base"
            >
              <Plus size={16} /> New Request
            </button>
          </div>
        }
      />

      {shouldShowDashboard && (
        <EmployeeDashboard 
          allocations={allocations} 
          requests={requests} 
          attendances={attendances} 
        />
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search requests..."
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
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No requests found</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="text-left px-4 py-3 font-medium">Employee</th>
                  <th className="text-left px-4 py-3 font-medium">Time Off Type</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-left px-4 py-3 font-medium">Start Date</th>
                  <th className="text-left px-4 py-3 font-medium">End Date</th>
                  <th className="text-right px-4 py-3 font-medium">Duration</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r: any) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/timeoff/requests/${r.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-base"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {r.employee_name}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {r.type_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">
                      {r.reason || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.start_date}</td>
                    <td className="px-4 py-3 text-slate-600">{r.end_date}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {r.days} day{r.days !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
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
