/**
 * PeoplePay585 — Employees Page
 * Full employee directory with search, filters, Kanban/List toggle, smart buttons, and create/edit modals.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Users, LayoutGrid, List, Mail, Phone, Edit2, Shield } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

interface Employee {
  id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  department_id: number | null;
  department: { id: number; name: string; code: string } | null;
  employee_type: string;
  joining_date: string;
  status: string;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  roles?: string[];
}

interface Department {
  id: number;
  name: string;
  code: string;
}

const defaultForm = {
  employee_number: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  job_title: '',
  department_id: '',
  employee_type: 'full_time',
  joining_date: new Date().toISOString().slice(0, 10),
  gender: '',
  date_of_birth: '',
  address: '',
  city: '',
  state: '',
};

const deptColors = [
  'from-blue-500 to-cyan-500',
  'from-violet-500 to-purple-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-indigo-500 to-blue-500',
];

export default function EmployeesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const departmentId = searchParams.get('department');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(defaultForm);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', search, statusFilter, departmentId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (departmentId) params.department_id = departmentId;
      params.limit = '1000';
      const res = await api.get('/employees', { params });
      return res.data;
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get('/departments')).data,
  });

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/employees', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee created');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to create'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put(`/employees/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee updated');
      closeModal();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to update'),
  });

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
    setForm(defaultForm);
  };

  const openEdit = (emp: Employee) => {
    setEditId(emp.id);
    setForm({
      employee_number: emp.employee_number,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      phone: emp.phone || '',
      job_title: emp.job_title || '',
      department_id: emp.department_id?.toString() || '',
      employee_type: emp.employee_type,
      joining_date: emp.joining_date,
      gender: emp.gender || '',
      date_of_birth: emp.date_of_birth || '',
      address: emp.address || '',
      city: emp.city || '',
      state: emp.state || '',
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      ...form,
      department_id: form.department_id ? parseInt(form.department_id) : null,
      phone: form.phone || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      job_title: form.job_title || null,
    };

    if (editId) {
      const { employee_number: _, joining_date: __, ...updateData } = payload;
      updateMut.mutate({ id: editId, data: updateData });
    } else {
      createMut.mutate(payload);
    }
  };

  const employees: Employee[] = data?.employees || [];

  const deptGroups = employees.reduce<Record<string, Employee[]>>((acc, emp) => {
    const deptName = emp.department?.name || 'Unassigned';
    if (!acc[deptName]) acc[deptName] = [];
    acc[deptName].push(emp);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        subtitle={
          <div className="flex items-center gap-2">
            <span>{data?.total || 0} employees</span>
            {departmentId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-xs font-medium border border-primary-200">
                Department: {departments?.find((d: any) => d.id === Number(departmentId))?.name || `ID ${departmentId}`}
                <button onClick={() => { searchParams.delete('department'); setSearchParams(searchParams); }} className="hover:text-primary-900 ml-1 rounded hover:bg-primary-100 p-0.5">
                  &times;
                </button>
              </span>
            )}
          </div>
        }
        action={
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-base ${
                  viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <List size={14} /> List
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-base ${
                  viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LayoutGrid size={14} /> Kanban
              </button>
            </div>
            <button
              onClick={() => { setForm(defaultForm); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base"
            >
              <Plus size={16} /> Add Employee
            </button>
          </div>
        }
      />

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or employee number..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-base"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {isLoading ? (
        <div className="p-12 text-center">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
        </div>
      ) : employees.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <Users size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No employees found</p>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Object.entries(deptGroups).map(([deptName, emps], idx) => (
            <div key={deptName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className={`bg-gradient-to-r ${deptColors[idx % deptColors.length]} px-4 py-3 text-white`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{deptName}</h3>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{emps.length}</span>
                </div>
              </div>
              <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
                {emps.map((emp) => (
                  <div
                    key={emp.id}
                    onClick={() => navigate(`/employees/${emp.id}`)}
                    className="bg-slate-50 rounded-lg hover:bg-slate-100 transition-base cursor-pointer border border-slate-100 flex flex-col overflow-hidden group"
                  >
                    <div className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                          {emp.first_name[0]}{emp.last_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 text-sm truncate">{emp.full_name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{emp.job_title || 'No role'}</p>
                          {emp.roles && emp.roles.length > 0 && (
                            <p className="text-[10px] text-primary-600 truncate mt-0.5 font-medium">
                              <Shield size={10} className="inline mr-1 -mt-0.5" />
                              {emp.roles.map(r => r.replace(/_/g, ' ')).join(', ')}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={emp.status} />
                      </div>
                    </div>
                    <div className="px-4 py-2.5 bg-slate-100/50 flex items-center justify-between border-t border-slate-100/80">
                      <div className="flex items-center gap-2 text-slate-400">
                        <button className="hover:text-primary-600 transition-colors p-1" title="Message" onClick={(e) => e.stopPropagation()}><Mail size={14} /></button>
                        <button className="hover:text-primary-600 transition-colors p-1" title="Call" onClick={(e) => e.stopPropagation()}><Phone size={14} /></button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); openEdit(emp); }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Department</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Job Role</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">System Roles</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr 
                    key={emp.id} 
                    onClick={() => navigate(`/employees/${emp.id}`)}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-base cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-white font-semibold text-xs">
                          {emp.first_name[0]}{emp.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{emp.full_name}</p>
                          <p className="text-xs text-slate-500">{emp.employee_number} &middot; {emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{emp.department?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.job_title || '—'}</td>
                    <td className="px-4 py-3">
                      {emp.roles && emp.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {emp.roles.map(r => (
                            <span key={r} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary-50 text-primary-700 text-[10px] font-medium rounded capitalize">
                              <Shield size={9} />
                              {r.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{emp.employee_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3"><StatusBadge status={emp.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(emp); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-base"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editId ? 'Edit Employee' : 'Add New Employee'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
              <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label>
              <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email *</label>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
              <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none">
                <option value="">-- Select --</option>
                {(departments || []).map((d: Department) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Job Role</label>
              <input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select value={form.employee_type} onChange={(e) => setForm({ ...form, employee_type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none">
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none">
                <option value="">-- Select --</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            {!editId && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Joining Date *</label>
                <input required type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
              <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-base">Cancel</button>
            <button type="submit" disabled={createMut.isPending || updateMut.isPending}
              className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 disabled:opacity-50 transition-base">
              {createMut.isPending || updateMut.isPending ? 'Saving...' : editId ? 'Save Changes' : 'Create Employee'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
