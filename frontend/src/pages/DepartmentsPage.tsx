/**
 * PeoplePay585 — Departments Page
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';

interface Dept {
  id: number;
  name: string;
  code: string;
  description: string | null;
  employee_count?: number;
}

export default function DepartmentsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '' });

  const { data: departments = [], isLoading } = useQuery<Dept[]>({
    queryKey: ['departments'],
    queryFn: async () => (await api.get('/departments')).data,
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/departments', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast.success('Department created'); setShowModal(false); setForm({ name: '', code: '', description: '' }); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        subtitle={`${departments.length} departments`}
        action={
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base">
            <Plus size={16} /> New Department
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))
        ) : departments.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No departments created yet</p>
          </div>
        ) : (
          departments.map((dept) => (
            <Link to={`/employees?department=${dept.id}`} key={dept.id} className="block bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-base group cursor-pointer">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                  {dept.code.slice(0, 2)}
                </div>
                <span className="text-xs text-slate-400 font-mono">{dept.code}</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mt-3 group-hover:text-primary-600 transition-colors">{dept.name}</h3>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{dept.description || 'No description'}</p>
              {dept.employee_count !== undefined && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="text-sm text-slate-600">{dept.employee_count} employee{dept.employee_count !== 1 ? 's' : ''}</span>
                </div>
              )}
            </Link>
          ))
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Department">
        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Code *</label>
            <input required maxLength={10} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-base">Cancel</button>
            <button type="submit" disabled={createMut.isPending}
              className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-base">
              {createMut.isPending ? 'Creating...' : 'Create Department'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
