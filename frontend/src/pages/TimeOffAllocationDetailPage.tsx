/**
 * PeoplePay585 — Time Off Allocation Detail Page
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, ArrowLeft, Check, X as XIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/Badge';

export default function TimeOffAllocationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState({
    description: '',
    employee_id: '',
    time_off_type_id: '',
    total_days: 0,
    valid_from: '',
    valid_until: '',
    approver_id: '',
  });

  const { data: allocation, isLoading } = useQuery({
    queryKey: ['timeoff-allocation', id],
    queryFn: async () => {
      if (isNew) return null;
      const res = await api.get(`/timeoff/allocations/${id}`);
      return res.data;
    },
    enabled: !isNew,
  });

  const { data: types = [] } = useQuery({
    queryKey: ['timeoff-types'],
    queryFn: async () => (await api.get('/timeoff/types')).data,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      const res = await api.get('/employees');
      return res.data.employees || res.data;
    },
  });

  useEffect(() => {
    if (allocation) {
      setForm({
        description: allocation.description || '',
        employee_id: allocation.employee_id.toString(),
        time_off_type_id: allocation.time_off_type_id.toString(),
        total_days: allocation.total_days,
        valid_from: allocation.valid_from || '',
        valid_until: allocation.valid_until || '',
        approver_id: allocation.approver_id ? allocation.approver_id.toString() : '',
      });
    }
  }, [allocation]);

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      if (isNew) {
        return await api.post('/timeoff/allocations', data);
      } else {
        return await api.put(`/timeoff/allocations/${id}`, data);
      }
    },
    onSuccess: () => {
      toast.success(isNew ? 'Allocation created successfully' : 'Allocation updated successfully');
      qc.invalidateQueries({ queryKey: ['timeoff-allocations'] });
      navigate('/timeoff/allocations');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to save allocation'),
  });

  const approveMut = useMutation({
    mutationFn: async () => await api.post(`/timeoff/allocations/${id}/approve`),
    onSuccess: () => {
      toast.success('Allocation approved');
      qc.invalidateQueries({ queryKey: ['timeoff-allocation', id] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to approve'),
  });

  const refuseMut = useMutation({
    mutationFn: async () => await api.post(`/timeoff/allocations/${id}/refuse`),
    onSuccess: () => {
      toast.success('Allocation refused');
      qc.invalidateQueries({ queryKey: ['timeoff-allocation', id] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to refuse'),
  });
  
  const deleteMut = useMutation({
    mutationFn: async () => await api.delete(`/timeoff/allocations/${id}`),
    onSuccess: () => {
      toast.success('Allocation deleted');
      qc.invalidateQueries({ queryKey: ['timeoff-allocations'] });
      navigate('/timeoff/allocations');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to delete'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMut.mutate({
      description: form.description || null,
      employee_id: parseInt(form.employee_id),
      time_off_type_id: parseInt(form.time_off_type_id),
      total_days: Number(form.total_days),
      year: form.valid_from ? new Date(form.valid_from).getFullYear() : new Date().getFullYear(),
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
      approver_id: form.approver_id ? parseInt(form.approver_id) : null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const isPending = allocation?.status === 'pending';
  const isDraft = allocation?.status === 'draft';
  const canEdit = isNew || isPending || isDraft;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/timeoff/allocations')}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-base"
        >
          <ArrowLeft size={16} /> Back to Allocations
        </button>
        {!isNew && <StatusBadge status={allocation.status} />}
      </div>

      <PageHeader
        title={isNew ? 'New Allocation' : `Allocation: ${allocation?.employee_name || 'Unnamed'}`}
        subtitle={isNew ? 'Create a new leave allocation' : `${allocation?.type_name || ''} — ${allocation?.employee_name || 'Employee'}`}
        action={
          <div className="flex items-center gap-3">
            {!isNew && (isPending || isDraft) && (
              <>
                <button
                  type="button"
                  onClick={() => approveMut.mutate()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-base"
                >
                  <Check size={16} /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => refuseMut.mutate()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 shadow-lg shadow-red-600/20 transition-base"
                >
                  <XIcon size={16} /> Refuse
                </button>
              </>
            )}

            {!isNew && (
              <button
                type="button"
                onClick={() => { if(confirm('Are you sure?')) deleteMut.mutate() }}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-base"
              >
                <Trash2 size={16} /> Delete
              </button>
            )}

            {canEdit && (
              <button
                type="submit"
                form="allocationForm"
                disabled={saveMut.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base disabled:opacity-50"
              >
                <Save size={16} /> {isNew ? 'Create Allocation' : 'Save Changes'}
              </button>
            )}
          </div>
        }
      />

      <form id="allocationForm" onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* LEFT COLUMN */}
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Allocation Details</h3>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee</label>
                {canEdit ? (
                  <select
                    required
                    value={form.employee_id}
                    onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  >
                    <option value="">-- Select Employee --</option>
                    {employees.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.full_name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-slate-900 font-medium">
                    {allocation?.employee_name || '-'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
                {canEdit ? (
                  <select
                    required
                    value={form.time_off_type_id}
                    onChange={(e) => setForm({ ...form, time_off_type_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  >
                    <option value="">-- Select Type --</option>
                    {types.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-slate-900 font-medium">
                    {allocation?.type_name || '-'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Allocated</label>
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                      value={form.total_days}
                      onChange={(e) => setForm({ ...form, total_days: parseFloat(e.target.value) })}
                      className="w-32 px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                    <span className="text-sm text-slate-500">days</span>
                  </div>
                ) : (
                  <div className="text-sm text-slate-900">
                    {allocation?.total_days} {allocation?.total_days === 1 ? 'day' : 'days'}
                  </div>
                )}
              </div>

              {!isNew && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Taken</label>
                    <div className="text-sm text-slate-900">
                      {allocation?.used_days} {allocation?.used_days === 1 ? 'day' : 'days'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Remaining</label>
                    <div className="text-sm text-slate-900 font-semibold">
                      {allocation?.total_days - allocation?.used_days} {(allocation?.total_days - allocation?.used_days) === 1 ? 'day' : 'days'}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Status & Validation</h3>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
                <div>
                  <StatusBadge status={allocation?.status || 'draft'} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Approver</label>
                {canEdit ? (
                  <select
                    value={form.approver_id}
                    onChange={(e) => setForm({ ...form, approver_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  >
                    <option value="">-- Select Approver --</option>
                    {employees.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.full_name}</option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-slate-900">
                    {allocation?.approver_name ? allocation.approver_name : <span className="text-slate-400 italic">No approver yet</span>}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Validity</label>
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={form.valid_from}
                      onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="date"
                      value={form.valid_until}
                      onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                  </div>
                ) : (
                  <div className="text-sm text-slate-900">
                    {allocation?.valid_from && allocation?.valid_until ? (
                      `${new Date(allocation.valid_from).toLocaleDateString()} to ${new Date(allocation.valid_until).toLocaleDateString()}`
                    ) : (
                      <span className="text-slate-400 italic">No validity period</span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                {canEdit ? (
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                    placeholder="e.g. Annual Leave 2026"
                  />
                ) : (
                  <div className="text-sm text-slate-900 whitespace-pre-wrap">
                    {allocation?.description || <span className="text-slate-400 italic">No description</span>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
