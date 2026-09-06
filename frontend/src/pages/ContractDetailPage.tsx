/**
 * PeoplePay585 — Contract Detailed View
 * Shows full contract information with employee link, department, job role, 
 * salary structure, and actions (edit/delete).
 */

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Calendar, DollarSign, Clock, User, Briefcase, Edit2, Trash2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { StatusBadge } from '../components/ui/Badge';

export default function ContractDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  const { data: contract, isLoading, isError } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => (await api.get(`/contracts/${id}`)).data,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules-list'],
    queryFn: async () => (await api.get('/schedules')).data,
  });

  const updateMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put(`/contracts/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract', id] });
      qc.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contract updated');
      setIsEditing(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to update'),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/contracts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contract deleted');
      navigate('/contracts');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to delete'),
  });

  const startEdit = () => {
    setEditForm({
      name: contract.name,
      start_date: contract.start_date,
      end_date: contract.end_date || '',
      wage: contract.wage,
      status: contract.status,
      notes: contract.notes || '',
      working_schedule_id: contract.working_schedule_id || '',
    });
    setIsEditing(true);
  };

  const saveEdit = () => {
    updateMut.mutate({
      ...editForm,
      end_date: editForm.end_date || null,
      wage: parseFloat(editForm.wage),
      notes: editForm.notes || null,
      working_schedule_id: editForm.working_schedule_id ? parseInt(editForm.working_schedule_id) : null,
    });
  };

  const fmt = (n: number | string) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n));

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm text-slate-500">Loading contract details...</p>
      </div>
    );
  }

  if (isError || !contract) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200 max-w-2xl mx-auto mt-8">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Contract Not Found</h2>
        <p className="text-slate-500 mb-6">The contract you are looking for does not exist or you do not have permission to view it.</p>
        <button onClick={() => navigate('/contracts')} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          Back to Contracts
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/contracts')}
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Link to="/contracts" className="hover:text-primary-600">Contracts</Link>
              <span>/</span>
              <span className="text-slate-900 font-medium">{contract.name}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Contract Details</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={contract.status} />
          {!isEditing ? (
            <>
              <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <Edit2 size={14} /> Edit
              </button>
              <button 
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this contract?')) {
                    deleteMut.mutate();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          ) : (
            <>
              <button onClick={saveEdit} disabled={updateMut.isPending} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                <Save size={14} /> {updateMut.isPending ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setIsEditing(false)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <X size={14} /> Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header Section */}
        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
              <FileText size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">{contract.name}</h2>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Link 
                  to={`/employees/${contract.employee_id}`}
                  className="font-medium text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                >
                  {contract.employee_name || `Employee #${contract.employee_id}`}
                </Link>
                {contract.employee_number && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>{contract.employee_number}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 bg-slate-50/50">
          
          {/* Left Column */}
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <User size={16} className="text-primary-500" /> Employee Info
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Employee</span>
                  <Link to={`/employees/${contract.employee_id}`} className="col-span-2 text-sm font-medium text-primary-600 hover:underline">
                    {contract.employee_name || `Employee #${contract.employee_id}`}
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Status</span>
                  <span className="col-span-2">
                    {isEditing ? (
                      <select value={editForm.status} onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                        className="px-2 py-1 rounded border border-slate-200 text-sm w-full">
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="terminated">Terminated</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    ) : (
                      <StatusBadge status={contract.status} />
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Calendar size={16} className="text-primary-500" /> Contract Duration
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Start Date</span>
                  <span className="col-span-2 text-sm font-medium text-slate-900">
                    {isEditing ? (
                      <input type="date" value={editForm.start_date} onChange={(e) => setEditForm({...editForm, start_date: e.target.value})}
                        className="px-2 py-1 rounded border border-slate-200 text-sm w-full" />
                    ) : contract.start_date}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">End Date</span>
                  <span className="col-span-2 text-sm font-medium text-slate-900">
                    {isEditing ? (
                      <input type="date" value={editForm.end_date} onChange={(e) => setEditForm({...editForm, end_date: e.target.value})}
                        className="px-2 py-1 rounded border border-slate-200 text-sm w-full" />
                    ) : (contract.end_date || 'Ongoing')}
                  </span>
                </div>
                {contract.notice_days !== undefined && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-slate-500">Notice Period</span>
                    <span className="col-span-2 text-sm font-medium text-slate-900">{contract.notice_days} days</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <DollarSign size={16} className="text-primary-500" /> Compensation
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Wage / Month</span>
                  <span className="col-span-2 text-sm font-medium text-emerald-600">
                    {isEditing ? (
                      <input type="number" min="1" step="0.01" value={editForm.wage} onChange={(e) => setEditForm({...editForm, wage: e.target.value})}
                        className="px-2 py-1 rounded border border-slate-200 text-sm w-full" />
                    ) : fmt(contract.wage)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Wage Type</span>
                  <span className="col-span-2 text-sm font-medium text-slate-900 capitalize">{contract.wage_type?.toLowerCase()}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Salary Structure</span>
                  <span className="col-span-2 text-sm font-medium text-slate-900">{contract.salary_structure_name || contract.salary_structure_id || '—'}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Clock size={16} className="text-primary-500" /> Working Schedule
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Schedule</span>
                  <span className="col-span-2 text-sm font-medium text-slate-900">
                    {isEditing ? (
                      <select value={editForm.working_schedule_id} onChange={(e) => setEditForm({...editForm, working_schedule_id: e.target.value})}
                        className="px-2 py-1 rounded border border-slate-200 text-sm w-full">
                        <option value="">-- No Schedule --</option>
                        {schedules.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    ) : (
                      contract.schedule_name || contract.working_schedule_id || '—'
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Briefcase size={16} className="text-primary-500" /> Job Details
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Department</span>
                  <span className="col-span-2 text-sm font-medium text-slate-900">{contract.department_name || '—'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-sm text-slate-500">Job Role</span>
                  <span className="col-span-2 text-sm font-medium text-slate-900">{contract.job_role || '—'}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Notes Section */}
        {(contract.notes || isEditing) && (
          <div className="p-6 md:p-8 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Notes</h3>
            {isEditing ? (
              <textarea 
                value={editForm.notes} 
                onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                placeholder="Add contract notes..."
              />
            ) : (
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{contract.notes}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
