/**
 * PeoplePay585 — Contracts Page
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

interface Contract {
  id: number;
  employee_id: number;
  name: string;
  start_date: string;
  end_date: string | null;
  wage: number;
  wage_type: string;
  status: string;
  employee_name?: string;
  employee_number?: string;
}

interface Employee { id: number; full_name: string; employee_number: string; }

export default function ContractsPage() {
  const { isMinRole } = useAuth();
  const isHr = isMinRole('hr_manager');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const employeeIdFilter = searchParams.get('employee_id');
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({
    employee_id: '', name: '', start_date: new Date().toISOString().slice(0, 10),
    end_date: '', wage: '', wage_type: 'monthly', working_schedule_id: '',
  });

  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ['contracts', searchTerm, employeeIdFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (employeeIdFilter) params.append('employee_id', employeeIdFilter);
      return (await api.get(`/contracts?${params.toString()}`)).data;
    },
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees-list'],
    queryFn: async () => {
      const res = await api.get('/employees');
      return res.data.employees || res.data;
    },
  });

  const { data: schedules = [] } = useQuery<any[]>({
    queryKey: ['schedules-list'],
    queryFn: async () => (await api.get('/schedules')).data,
  });

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => api.post('/contracts', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contract created');
      setShowModal(false);
    },
    onError: (e: any) => {
      const detail = e.response?.data?.detail;
      if (Array.isArray(detail)) {
        toast.error(detail[0].msg || 'Validation error');
      } else {
        toast.error(detail || 'Failed to create contract');
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({
      employee_id: parseInt(form.employee_id),
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date || null,
      wage: parseFloat(form.wage),
      wage_type: form.wage_type,
      working_schedule_id: form.working_schedule_id ? parseInt(form.working_schedule_id) : null,
    });
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        subtitle={`${contracts.length} contracts`}
        action={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search contracts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none w-64 shadow-sm"
              />
            </div>
            {isHr && (
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 border-slate-200 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base">
                <Plus size={16} /> New Contract
              </button>
            )}
          </div>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" /></div>
        ) : contracts.length === 0 ? (
          <div className="p-12 text-center"><FileText size={40} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-500 text-sm">No contracts found</p></div>
        ) : !isHr ? (
          <div className="p-6 space-y-4">
            {contracts.map((c) => (
              <div key={c.id} className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                <div className={`absolute top-0 bottom-0 left-0 w-2 ${c.status === 'active' ? 'bg-emerald-500' : c.status === 'expired' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                <div className="p-4 pl-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-lg">{c.name}</h3>
                    <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                      <span className="font-medium bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">{c.start_date}</span>
                      <span>→</span>
                      <span className="font-medium bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">{c.end_date || 'Ongoing'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-900 text-xl">{fmt(c.wage)} <span className="text-sm font-normal text-slate-500 capitalize">/ {c.wage_type?.toLowerCase()}</span></div>
                    <div className="mt-2"><StatusBadge status={c.status} /></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Contract</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Period</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Wage</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr 
                    key={c.id} 
                    onClick={() => navigate(`/contracts/${c.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-base cursor-pointer select-none"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.employee_name || `Employee #${c.employee_id}`}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{c.start_date} → {c.end_date || 'Ongoing'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(c.wage)}</td>
                    <td className="px-4 py-3 text-slate-600 capitalize text-xs">{c.wage_type?.toLowerCase()}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Contract">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Employee *</label>
            <select required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
              <option value="">-- Select Employee --</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_number})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contract Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
              <input required type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Wage *</label>
              <input required type="number" min="1" step="0.01" value={form.wage} onChange={(e) => setForm({ ...form, wage: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Wage Type</label>
              <select value={form.wage_type} onChange={(e) => setForm({ ...form, wage_type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
                <option value="monthly">Monthly</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Working Schedule</label>
            <select value={form.working_schedule_id} onChange={(e) => setForm({ ...form, working_schedule_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
              <option value="">-- No Schedule (Default) --</option>
              {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-base">Cancel</button>
            <button type="submit" disabled={createMut.isPending}
              className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-base">
              {createMut.isPending ? 'Creating...' : 'Create Contract'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
