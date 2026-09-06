/**
 * PeoplePay585 — Attendance Detail / Form Page
 * View, Edit, and Create attendance records.
 * Matches HRMS OXP reference: breadcrumb, two-column layout, edit mode, notes.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit2, Save, X, Trash2, Clock,
  User, Building, Calendar, LogIn, LogOut, Timer, FileText, UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { StatusBadge } from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

interface AttendanceDetail {
  id: number;
  employee_id: number;
  employee_name: string | null;
  employee_number: string | null;
  department_name: string | null;
  manager_name: string | null;
  date: string;
  check_in: string;
  check_out: string | null;
  worked_hours: number | null;
  overtime_hours: number | null;
  status: string;
  notes: string | null;
  created_at: string;
}

interface EmployeeOption {
  id: number;
  full_name: string;
  employee_number: string;
}

export default function AttendanceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !id || id === 'new';

  const [isEditing, setIsEditing] = useState(isNew);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: '',
    date: new Date().toISOString().slice(0, 10),
    check_in: '',
    check_out: '',
    status: 'present',
    notes: '',
  });

  // Fetch attendance record
  const { data: attendance, isLoading, isError } = useQuery<AttendanceDetail>({
    queryKey: ['attendance_detail', id],
    queryFn: async () => (await api.get(`/attendance/${id}`)).data,
    enabled: !isNew,
  });

  // Fetch employees for the create form
  const { data: employeesData } = useQuery<{ employees: EmployeeOption[] }>({
    queryKey: ['employees_list_for_form'],
    queryFn: async () => (await api.get('/employees', { params: { limit: 200 } })).data,
    enabled: isNew || isEditing,
  });
  const employees: EmployeeOption[] = employeesData?.employees || [];

  // Populate form when entering edit mode
  useEffect(() => {
    if (attendance && isEditing && !isNew) {
      setForm({
        employee_id: String(attendance.employee_id),
        date: attendance.date,
        check_in: attendance.check_in ? toLocalDatetimeInput(attendance.check_in) : '',
        check_out: attendance.check_out ? toLocalDatetimeInput(attendance.check_out) : '',
        status: attendance.status,
        notes: attendance.notes || '',
      });
    }
  }, [attendance, isEditing, isNew]);

  // Mutations
  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/attendance', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Attendance record created');
      navigate(`/attendance/${res.data.id}`);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to create'),
  });

  const updateMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.put(`/attendance/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance_detail', id] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Attendance updated');
      setIsEditing(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to update'),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/attendance/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Attendance record deleted');
      navigate('/attendance');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to delete'),
  });

  // Helpers
  function toLocalDatetimeInput(iso: string): string {
    try {
      const d = new Date(iso);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day}T${h}:${min}`;
    } catch { return ''; }
  }

  function formatDateTime(iso: string): string {
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
  }

  function formatHoursMinutes(decimal: number | null | undefined): string {
    if (decimal === null || decimal === undefined) return '0h 00m';
    const hours = Math.floor(decimal);
    const minutes = Math.round((decimal - hours) * 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }

  // Save handler
  const handleSave = () => {
    if (isNew) {
      if (!form.employee_id || !form.check_in) {
        toast.error('Employee and Check In are required');
        return;
      }
      const payload: Record<string, unknown> = {
        employee_id: Number(form.employee_id),
        date: form.date,
        check_in: new Date(form.check_in).toISOString(),
        status: form.status,
      };
      if (form.check_out) payload.check_out = new Date(form.check_out).toISOString();
      if (form.notes) payload.notes = form.notes;
      createMut.mutate(payload);
    } else {
      const payload: Record<string, unknown> = {};
      if (form.check_in) payload.check_in = new Date(form.check_in).toISOString();
      if (form.check_out) payload.check_out = new Date(form.check_out).toISOString();
      if (form.status) payload.status = form.status;
      if (form.notes !== undefined) payload.notes = form.notes;
      updateMut.mutate(payload);
    }
  };

  // Loading state
  if (!isNew && isLoading) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm text-slate-500">Loading attendance record...</p>
      </div>
    );
  }

  // Error state
  if (!isNew && (isError || !attendance)) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200 max-w-2xl mx-auto mt-8">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Attendance Record Not Found</h2>
        <p className="text-slate-500 mb-6">This record does not exist or you don't have permission to view it.</p>
        <button onClick={() => navigate('/attendance')} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
          Back to Attendance
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/attendance')}
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-0.5">
              <Link to="/attendance" className="hover:text-primary-600">Attendance</Link>
              {!isNew && attendance && (
                <>
                  <span>/</span>
                  <span className="text-slate-700 font-medium">{attendance.employee_name}</span>
                  <span>/</span>
                  <span className="text-slate-700">{formatDate(attendance.date)}</span>
                </>
              )}
              {isNew && <><span>/</span><span className="text-slate-700 font-medium">New Record</span></>}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isNew ? 'New Attendance Record' : 'Attendance Details'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isNew ? 'Create a new attendance record' : 'Form view of one attendance record'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!isNew && !isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-all shadow-sm"
              >
                <Edit2 size={15} />
                Edit
              </button>
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-50 transition-all"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
          {isEditing && (
            <>
              <button
                onClick={handleSave}
                disabled={createMut.isPending || updateMut.isPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                <Save size={15} />
                {createMut.isPending || updateMut.isPending ? 'Saving...' : 'Save'}
              </button>
              {!isNew && (
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all"
                >
                  <X size={15} />
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {/* Left Column */}
            <div className="space-y-5">
              {/* Employee */}
              <FieldRow icon={<User size={16} />} label="Employee">
                {isNew ? (
                  <select
                    value={form.employee_id}
                    onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none bg-white"
                  >
                    <option value="">Select Employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_number})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="font-medium text-slate-900">{attendance?.employee_name || '—'}</span>
                )}
              </FieldRow>

              {/* Date */}
              <FieldRow icon={<Calendar size={16} />} label="Date">
                {isNew ? (
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                  />
                ) : (
                  <span className="text-slate-900">{attendance ? formatDate(attendance.date) : '—'}</span>
                )}
              </FieldRow>

              {/* Check In */}
              <FieldRow icon={<LogIn size={16} className="text-emerald-500" />} label="Check In">
                {isEditing ? (
                  <input
                    type="datetime-local"
                    value={form.check_in}
                    onChange={(e) => setForm({ ...form, check_in: e.target.value })}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                  />
                ) : (
                  <span className="text-emerald-600 font-medium">
                    {attendance?.check_in ? formatDateTime(attendance.check_in) : '—'}
                  </span>
                )}
              </FieldRow>

              {/* Check Out */}
              <FieldRow icon={<LogOut size={16} className="text-rose-500" />} label="Check Out">
                {isEditing ? (
                  <input
                    type="datetime-local"
                    value={form.check_out}
                    onChange={(e) => setForm({ ...form, check_out: e.target.value })}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                  />
                ) : (
                  <span className={attendance?.check_out ? 'text-rose-600 font-medium' : 'text-amber-600'}>
                    {attendance?.check_out ? formatDateTime(attendance.check_out) : 'Missing Check-out'}
                  </span>
                )}
              </FieldRow>
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              {/* Department */}
              {!isNew && (
                <FieldRow icon={<Building size={16} />} label="Department">
                  <span className="text-slate-900">{attendance?.department_name || '—'}</span>
                </FieldRow>
              )}

              {/* Manager */}
              {!isNew && (
                <FieldRow icon={<UserCheck size={16} className="text-violet-500" />} label="Manager">
                  {isEditing ? (
                    <select
                      value={employees.find(e => `${e.full_name}` === attendance?.manager_name)?.id || ''}
                      onChange={async (e) => {
                        const empId = Number(e.target.value);
                        if (!attendance?.department_name || !empId) return;
                        try {
                          // Find the department id from the departments list
                          const deptRes = await api.get('/departments');
                          const dept = deptRes.data.find((d: any) => d.name === attendance.department_name);
                          if (dept) {
                            await api.put(`/departments/${dept.id}`, { manager_id: empId });
                            qc.invalidateQueries({ queryKey: ['attendance_detail', id] });
                            toast.success('Manager updated');
                          }
                        } catch { toast.error('Failed to update manager'); }
                      }}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none bg-white"
                    >
                      <option value="">— Select Manager —</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-900 font-medium">{attendance?.manager_name || '—'}</span>
                  )}
                </FieldRow>
              )}

              {/* Worked Hours */}
              <FieldRow icon={<Clock size={16} />} label="Worked Hours">
                <span className="text-xl font-bold text-slate-900">
                  {isNew ? '—' : formatHoursMinutes(attendance?.worked_hours)}
                </span>
              </FieldRow>

              {/* Overtime */}
              {!isNew && (
                <FieldRow icon={<Timer size={16} />} label="Overtime">
                  <span className={`font-semibold ${(attendance?.overtime_hours || 0) > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {formatHoursMinutes(attendance?.overtime_hours)}
                  </span>
                </FieldRow>
              )}

              {/* Status */}
              <FieldRow icon={<FileText size={16} />} label="Status">
                {isEditing ? (
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none bg-white"
                  >
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                    <option value="half_day">Half Day</option>
                  </select>
                ) : (
                  <StatusBadge status={attendance?.status || 'present'} />
                )}
              </FieldRow>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="border-t border-slate-100 p-6 md:p-8 bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <FileText size={15} className="text-slate-400" />
            Notes
          </h3>
          {isEditing ? (
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Add notes about this attendance record..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none resize-none"
            />
          ) : (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">
              {attendance?.notes || 'No notes for this record.'}
            </p>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Attendance Record"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete this attendance record for <strong>{attendance?.employee_name}</strong> on <strong>{attendance ? formatDate(attendance.date) : ''}</strong>?
          </p>
          <p className="text-sm text-red-600">This action cannot be undone and may affect payroll history.</p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
              className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleteMut.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ── Field Row Component ── */
function FieldRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 items-start">
      <div className="flex items-center gap-2 text-sm text-slate-500 pt-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="col-span-2">{children}</div>
    </div>
  );
}
