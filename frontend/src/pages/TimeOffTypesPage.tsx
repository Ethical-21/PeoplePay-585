/**
 * PeoplePay585 — Time Off Types List Page
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Search } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';

export default function TimeOffTypesPage() {
  const navigate = useNavigate();
  const { isMinRole } = useAuth();
  const isManager = isMinRole('hr_manager');
  const [search, setSearch] = useState('');

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['timeoff-types'],
    queryFn: async () => {
      const res = await api.get('/timeoff/types');
      return res.data;
    },
    enabled: isManager,
  });

  const filteredTypes = types.filter((t: any) => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.code.toLowerCase().includes(search.toLowerCase()) ||
    (t.approval || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.unit || '').toLowerCase().includes(search.toLowerCase())
  );

  if (!isManager) {
    return <div>Access Denied</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader
        title="Time Off Types"
        subtitle="Manage leave policies and types"
        action={
          <button
            onClick={() => navigate('/timeoff/types/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base"
          >
            <Plus size={16} /> New Leave Type
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search time off types..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-base"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredTypes.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No leave types found</p>
            <p className="text-slate-400 text-sm mt-1">Create your first time off type to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <th className="text-left px-4 py-3 font-medium">Display Name</th>
                  <th className="text-left px-4 py-3 font-medium">Code</th>
                  <th className="text-center px-4 py-3 font-medium">Unit</th>
                  <th className="text-center px-4 py-3 font-medium">Requires Allocation</th>
                  <th className="text-center px-4 py-3 font-medium">Active</th>
                  <th className="text-left px-4 py-3 font-medium">Approval</th>
                </tr>
              </thead>
              <tbody>
                {filteredTypes.map((t: any) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/timeoff/types/${t.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-base"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow-sm"
                          style={{ backgroundColor: t.color || '#3B82F6' }}
                        />
                        <span className="font-medium text-slate-900">{t.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{t.code}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-slate-600 text-xs font-medium">
                        {(t.unit || 'DAYS') === 'HOURS' ? 'Hours' : 'Days'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                        t.requires_allocation 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {t.requires_allocation ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        t.is_active 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${t.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.approval || 'Manager'}</td>
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
