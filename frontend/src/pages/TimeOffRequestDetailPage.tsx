/**
 * PeoplePay585 — Time Off Request Detail Page
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, ArrowLeft, Check, X as XIcon, Trash2, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';

export default function TimeOffRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isMinRole, user } = useAuth();
  const isManager = isMinRole('hr_manager');
  const isNew = !id || id === 'new';

  const [form, setForm] = useState({
    employee_id: '',
    time_off_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
  });

  const { data: request, isLoading } = useQuery({
    queryKey: ['timeoff-request', id],
    queryFn: async () => {
      if (isNew) return null;
      const res = await api.get(`/timeoff/requests/${id}`);
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
    enabled: isManager,
  });

  useEffect(() => {
    if (request) {
      setForm({
        employee_id: request.employee_id.toString(),
        time_off_type_id: request.time_off_type_id.toString(),
        start_date: request.start_date,
        end_date: request.end_date,
        reason: request.reason || '',
      });
    } else if (isNew && !isManager && (user as any)?.employee_id) {
      setForm((f) => ({ ...f, employee_id: (user as any).employee_id.toString() }));
    }
  }, [request, isNew, isManager, user]);

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      if (isNew) {
        return await api.post('/timeoff/requests', data);
      } else {
        return await api.put(`/timeoff/requests/${id}`, data);
      }
    },
    onSuccess: () => {
      toast.success(isNew ? 'Request created successfully' : 'Request updated successfully');
      qc.invalidateQueries({ queryKey: ['timeoff-requests'] });
      navigate('/timeoff/requests');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to save request'),
  });

  const approveMut = useMutation({
    mutationFn: async () => await api.post(`/timeoff/requests/${id}/approve`),
    onSuccess: () => {
      toast.success('Request approved');
      qc.invalidateQueries({ queryKey: ['timeoff-request', id] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to approve'),
  });

  const refuseMut = useMutation({
    mutationFn: async () => await api.post(`/timeoff/requests/${id}/refuse`),
    onSuccess: () => {
      toast.success('Request refused');
      qc.invalidateQueries({ queryKey: ['timeoff-request', id] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to refuse'),
  });

  const cancelMut = useMutation({
    mutationFn: async () => await api.post(`/timeoff/requests/${id}/cancel`),
    onSuccess: () => {
      toast.success('Request cancelled');
      qc.invalidateQueries({ queryKey: ['timeoff-request', id] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to cancel'),
  });
  
  const deleteMut = useMutation({
    mutationFn: async () => await api.delete(`/timeoff/requests/${id}`),
    onSuccess: () => {
      toast.success('Request deleted');
      qc.invalidateQueries({ queryKey: ['timeoff-requests'] });
      navigate('/timeoff/requests');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to delete'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMut.mutate({
      employee_id: parseInt(form.employee_id),
      time_off_type_id: parseInt(form.time_off_type_id),
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const isPending = request?.status === 'pending';
  const isApproved = request?.status === 'approved';
  const canEdit = isNew || isPending;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/timeoff/requests')}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-base"
        >
          <ArrowLeft size={16} /> Back to Requests
        </button>
        {!isNew && <StatusBadge status={request.status} />}
      </div>

      <PageHeader
        title={isNew ? 'New Time Off Request' : `Time Off Request #${id}`}
        subtitle={isNew ? 'Submit a new leave request' : `Requested by ${request?.employee_name || 'Employee'}`}
        action={
          <div className="flex items-center gap-3">
            {!isNew && isManager && isPending && (
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
            
            {!isNew && (isPending || isApproved) && (
              <button
                type="button"
                onClick={() => cancelMut.mutate()}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-base"
              >
                <Ban size={16} /> Cancel
              </button>
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
                form="requestForm"
                disabled={saveMut.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base disabled:opacity-50"
              >
                <Save size={16} /> {isNew ? 'Submit Request' : 'Save Changes'}
              </button>
            )}
          </div>
        }
      />

      <form id="requestForm" onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Request Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Employee</label>
                {isManager && canEdit ? (
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
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium">
                    {request?.employee_name || 
                     (isManager ? employees.find((e: any) => e.id.toString() === form.employee_id)?.full_name : user?.full_name) || 
                     'Loading...'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Time Off Type</label>
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
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium">
                    {request?.type_name || 'N/A'}
                  </div>
                )}
              </div>
              
              {(!isNew && request?.allocation_name) && (
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1.5">Allocation Used</label>
                   <div className="px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-700 font-medium flex items-center justify-between">
                     <span>{request.allocation_name}</span>
                   </div>
                 </div>
              )}
            </div>

            <div className="space-y-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Duration</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date</label>
                  {canEdit ? (
                    <input
                      type="date"
                      required
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">{request?.start_date}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">End Date</label>
                  {canEdit ? (
                    <input
                      type="date"
                      required
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">{request?.end_date}</div>
                  )}
                </div>
              </div>

              {!isNew && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Total Days</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-semibold">
                    {request?.days} day{request?.days !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="pt-6 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            {canEdit ? (
              <textarea
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                placeholder="Add a reason for this time off request..."
              />
            ) : (
              <div className="px-3 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 min-h-[100px] whitespace-pre-wrap">
                {request?.reason || <span className="text-slate-400 italic">No description provided</span>}
              </div>
            )}
          </div>
          
        </div>
      </form>
    </div>
  );
}
