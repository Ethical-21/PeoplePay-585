/**
 * PeoplePay585 — User Management Page (Admin Only)
 * CRUD for user accounts with employee linking, role assignment, and invitation management.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import toast from 'react-hot-toast';
import {
  Plus, Search, Shield, RefreshCw, Edit2, X, Trash2,
  CheckCircle2, Clock, AlertTriangle, Mail
} from 'lucide-react';

interface UserItem {
  id: number;
  email: string;
  full_name: string;
  roles: string[];
  is_active: boolean;
  must_change_password: boolean;
  invitation_status: string;
  employee_id: number | null;
  employee_name: string | null;
  employee_number: string | null;
  department: string | null;
  department_id: number | null;
  created_at: string;
}

interface Employee {
  id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  user_id: number | null;
}

const ROLES = [
  { value: 'employee', label: 'Employee' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'hr_payroll_user', label: 'HR Payroll User' },
  { value: 'hr_payroll_manager', label: 'HR Payroll Manager' },
  { value: 'admin', label: 'Admin' },
];

const STATUS_BADGES: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  not_invited: { color: 'bg-slate-100 text-slate-600', icon: <Clock size={12} />, label: 'Not Invited' },
  pending: { color: 'bg-amber-100 text-amber-700', icon: <Clock size={12} />, label: 'Pending' },
  sent: { color: 'bg-blue-100 text-blue-700', icon: <Mail size={12} />, label: 'Sent' },
  accepted: { color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={12} />, label: 'Accepted' },
  expired: { color: 'bg-red-100 text-red-700', icon: <AlertTriangle size={12} />, label: 'Expired' },
  failed: { color: 'bg-red-100 text-red-700', icon: <AlertTriangle size={12} />, label: 'Failed' },
};

export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);

  // Create form state
  const [createMode, setCreateMode] = useState<'existing' | 'new'>('existing');
  const [formEmployeeId, setFormEmployeeId] = useState<number | ''>('');
  const [formEmail, setFormEmail] = useState('');
  const [formRoles, setFormRoles] = useState<string[]>(['employee']);
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formDepartmentId, setFormDepartmentId] = useState<number | ''>('');

  // Edit form state
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [editDepartmentId, setEditDepartmentId] = useState<number | ''>('');

  const { data: users = [], isLoading } = useQuery<UserItem[]>({
    queryKey: ['users', search, roleFilter],
    queryFn: () =>
      api.get('/users', { params: { search: search || undefined, role: roleFilter || undefined } })
        .then((r) => r.data),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees-for-user'],
    queryFn: () => api.get('/employees', { params: { limit: 1000 } }).then((r) => r.data),
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['departments-for-user'],
    queryFn: () => api.get('/departments').then(r => r.data),
  });
  const departments = Array.isArray(departmentsData) ? departmentsData : (departmentsData?.departments || []);

  const availableEmployees = (employeesData?.employees || []).filter(
    (e: Employee) => e.user_id === null
  );

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      api.post('/users', data),
    onSuccess: (res) => {
      toast.success(`User account created for ${res.data.full_name}`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees-for-user'] });
      resetForm();
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to create user.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      api.put(`/users/${id}`, data),
    onSuccess: () => {
      toast.success('User updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditUser(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to update user.'),
  });

  const resendMutation = useMutation({
    mutationFn: (id: number) => api.post(`/users/${id}/resend-invitation`),
    onSuccess: () => {
      toast.success('Invitation resent. Check server console for temp password.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to resend.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      toast.success('User deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['employees-for-user'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to delete user.'),
  });

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to completely remove user ${name}? This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setShowCreate(false);
    setCreateMode('existing');
    setFormEmployeeId('');
    setFormEmail('');
    setFormRoles(['employee']);
    setFormFirstName('');
    setFormLastName('');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (createMode === 'existing') {
      if (!formEmployeeId || !formEmail) return;
      createMutation.mutate({ employee_id: Number(formEmployeeId), email: formEmail, roles: formRoles });
    } else {
      const payload: any = { email: formEmail, roles: formRoles };
      if (createMode === 'new') {
        if (!formFirstName || !formLastName) {
          toast.error("First name and last name are required for new employee");
          return;
        }
        payload.first_name = formFirstName;
        payload.last_name = formLastName;
        if (formDepartmentId !== '') {
          payload.department_id = formDepartmentId;
        }
      }
      createMutation.mutate(payload);
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    updateMutation.mutate({
      id: editUser.id,
      data: {
        full_name: editFullName,
        email: editEmail,
        roles: editRoles,
        is_active: editActive,
        department_id: editDepartmentId || null,
      },
    });
  };

  const openEdit = (user: UserItem) => {
    setEditUser(user);
    setEditFullName(user.full_name || '');
    setEditEmail(user.email || '');
    setEditRoles(user.roles || []);
    setEditActive(user.is_active);
    setEditDepartmentId(user.department_id || '');
  };

  // When employee selected, auto-fill email
  const handleEmployeeSelect = (empId: number) => {
    setFormEmployeeId(empId);
    const emp = availableEmployees.find((e: Employee) => e.id === empId);
    if (emp && emp.email) setFormEmail(emp.email);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase">Admin Only</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">Manage user accounts, roles, and access</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-base"
        >
          <Plus size={16} />
          Create User Account
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => resetForm()}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Create User Account</h2>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
              <button
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${createMode === 'existing' ? 'bg-white shadow-sm text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setCreateMode('existing')}
              >
                Existing Employee
              </button>
              <button
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${createMode === 'new' ? 'bg-white shadow-sm text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}
                onClick={() => setCreateMode('new')}
              >
                New Employee
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {createMode === 'existing' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Employee *</label>
                  <select
                    value={formEmployeeId}
                    onChange={(e) => handleEmployeeSelect(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    <option value="">Select an employee...</option>
                    {availableEmployees.map((emp: Employee) => (
                      <option key={emp.id} value={emp.id}>{emp.employee_number} — {emp.full_name}</option>
                    ))}
                  </select>
                  {availableEmployees.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">All employees already have user accounts.</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                      <input
                        type="text"
                        value={formFirstName}
                        onChange={(e) => setFormFirstName(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                      <input
                        type="text"
                        value={formLastName}
                        onChange={(e) => setFormLastName(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                    <select
                      value={formDepartmentId}
                      onChange={(e) => setFormDepartmentId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="">No Department</option>
                      {departments.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Work Email *</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Roles *</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm text-slate-700 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={formRoles.includes(r.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormRoles([...formRoles, r.value]);
                          } else {
                            // Require at least one role
                            if (formRoles.length > 1) {
                              setFormRoles(formRoles.filter(role => role !== r.value));
                            } else {
                              toast.error("User must have at least one role.");
                            }
                          }
                        }}
                        className="rounded text-primary-600 focus:ring-primary-500"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Edit User: {editUser.full_name}</h2>
              <button onClick={() => setEditUser(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                <select
                  value={editDepartmentId}
                  onChange={(e) => setEditDepartmentId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">No Department</option>
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Roles</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 text-sm text-slate-700 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={editRoles.includes(r.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditRoles([...editRoles, r.value]);
                          } else {
                            if (editRoles.length > 1) {
                              setEditRoles(editRoles.filter(role => role !== r.value));
                            } else {
                              toast.error("User must have at least one role.");
                            }
                          }
                        }}
                        className="rounded text-primary-600 focus:ring-primary-500"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="rounded"
                  />
                  Account Active
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditUser(null)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Invitation</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Loading users...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No users found.</td></tr>
              ) : (
                users.map((u) => {
                  const badge = STATUS_BADGES[u.invitation_status] || STATUS_BADGES.not_invited;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => openEdit(u)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-700 font-semibold text-xs">{u.full_name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{u.full_name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.employee_name ? (
                          <div>
                            <p className="text-sm text-slate-700">{u.employee_number}</p>
                            <p className="text-xs text-slate-500">{u.department || '—'}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No employee linked</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(u.roles || []).map(r => (
                            <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 text-[10px] font-medium rounded-full">
                              <Shield size={10} />
                              {r.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                            <CheckCircle2 size={10} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-xs font-medium rounded-full">
                            <AlertTriangle size={10} /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${badge.color}`}>
                          {badge.icon} {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openEdit(u)}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Edit user"
                          >
                            <Edit2 size={14} />
                          </button>
                          {u.invitation_status !== 'accepted' && (
                            <button
                              onClick={() => resendMutation.mutate(u.id)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Resend invitation"
                            >
                              <RefreshCw size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(u.id, u.full_name)}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete user"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
