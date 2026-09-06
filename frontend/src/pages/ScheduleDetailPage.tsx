/**
 * PeoplePay585 — Working Schedule Detail / Form Page
 * Full create/edit/view page with dynamic Add Day / Remove Day,
 * auto-calculated hours, and real backend persistence.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, Save, Trash2, Plus, X, Clock, Timer, Building2, Globe, AlertTriangle,
} from 'lucide-react';

/* ─── Types ─── */
interface DayRow {
  day: string;
  start: string;
  end: string;
  breakMin: number;
}

interface Schedule {
  id: number;
  name: string;
  company: string;
  timezone: string;
  status: string;
  monday_start: string | null; monday_end: string | null;
  tuesday_start: string | null; tuesday_end: string | null;
  wednesday_start: string | null; wednesday_end: string | null;
  thursday_start: string | null; thursday_end: string | null;
  friday_start: string | null; friday_end: string | null;
  saturday_start: string | null; saturday_end: string | null;
  sunday_start: string | null; sunday_end: string | null;
  break_duration_minutes: number;
  total_weekly_hours: number;
  working_days_count: number;
  working_days: string[];
  assigned_contracts_count: number;
  created_at: string;
}

const ALL_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const TIMEZONES = [
  'Asia/Kolkata', 'UTC', 'US/Eastern', 'US/Pacific', 'Europe/London',
  'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney',
];

function computeDayHours(start: string, end: string, breakMin: number): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const totalMin = (eh * 60 + em) - (sh * 60 + sm) - breakMin;
  return totalMin > 0 ? Math.round((totalMin / 60) * 100) / 100 : 0;
}

function formatHours(h: number): string {
  if (h === 0) return '0h';
  const whole = Math.floor(h);
  const frac = h - whole;
  if (frac === 0) return `${whole}h`;
  return `${h}h`;
}

function formatTime12(time24: string): string {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/* ─── Extract day rows from a schedule response ─── */
function scheduleToRows(s: Schedule): DayRow[] {
  const rows: DayRow[] = [];
  for (const day of ALL_DAYS) {
    const start = (s as any)[`${day}_start`];
    const end = (s as any)[`${day}_end`];
    if (start && end) {
      rows.push({
        day,
        start: start.substring(0, 5),
        end: end.substring(0, 5),
        breakMin: s.break_duration_minutes,
      });
    }
  }
  return rows;
}

/* ─── Convert day rows back to API payload ─── */
function rowsToPayload(rows: DayRow[]): Record<string, any> {
  const payload: Record<string, any> = {};
  for (const day of ALL_DAYS) {
    payload[`${day}_start`] = null;
    payload[`${day}_end`] = null;
  }
  for (const row of rows) {
    payload[`${row.day}_start`] = row.start || null;
    payload[`${row.day}_end`] = row.end || null;
  }
  // Use the break from first row (uniform break across days in current model)
  payload.break_duration_minutes = rows.length > 0 ? rows[0].breakMin : 60;
  return payload;
}

export default function ScheduleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isMinRole } = useAuth();
  const isNew = !id || id === 'new';
  const canEdit = isMinRole('hr_manager');

  // Form state
  const [name, setName] = useState('');
  const [company, setCompany] = useState('My Company');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [status, setStatus] = useState('active');
  const [dayRows, setDayRows] = useState<DayRow[]>([
    { day: 'monday', start: '09:00', end: '18:00', breakMin: 60 },
    { day: 'tuesday', start: '09:00', end: '18:00', breakMin: 60 },
    { day: 'wednesday', start: '09:00', end: '18:00', breakMin: 60 },
    { day: 'thursday', start: '09:00', end: '18:00', breakMin: 60 },
    { day: 'friday', start: '09:00', end: '18:00', breakMin: 60 },
  ]);
  const [isDirty, setIsDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch existing schedule
  const { data: schedule, isLoading, isError } = useQuery<Schedule>({
    queryKey: ['schedule', id],
    queryFn: () => api.get(`/schedules/${id}`).then(r => r.data),
    enabled: !isNew,
  });

  // Populate form from fetched schedule
  useEffect(() => {
    if (schedule) {
      setName(schedule.name);
      setCompany(schedule.company || 'My Company');
      setTimezone(schedule.timezone || 'Asia/Kolkata');
      setStatus(schedule.status || 'active');
      setDayRows(scheduleToRows(schedule));
      setIsDirty(false);
    }
  }, [schedule]);

  // Mutations
  const saveMut = useMutation({
    mutationFn: (data: Record<string, any>) => {
      if (isNew) return api.post('/schedules', data);
      return api.put(`/schedules/${id}`, data);
    },
    onSuccess: (res) => {
      toast.success(isNew ? 'Schedule created!' : 'Schedule updated!');
      qc.invalidateQueries({ queryKey: ['schedules'] });
      qc.invalidateQueries({ queryKey: ['schedule', id] });
      setIsDirty(false);
      if (isNew) {
        navigate(`/schedules/${res.data.id}`, { replace: true });
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to save schedule.'),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/schedules/${id}`),
    onSuccess: () => {
      toast.success('Schedule deleted.');
      qc.invalidateQueries({ queryKey: ['schedules'] });
      navigate('/schedules');
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to delete schedule.'),
  });

  // Computed values
  const totalWeeklyHours = useMemo(
    () => dayRows.reduce((sum, r) => sum + computeDayHours(r.start, r.end, r.breakMin), 0),
    [dayRows]
  );

  const daysPerWeek = dayRows.length;

  const usedDays = useMemo(() => new Set(dayRows.map(r => r.day)), [dayRows]);
  const availableDays = ALL_DAYS.filter(d => !usedDays.has(d));

  // Handlers
  const markDirty = useCallback(() => setIsDirty(true), []);

  const updateRow = (index: number, field: keyof DayRow, value: string | number) => {
    setDayRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
    markDirty();
  };

  const addDay = () => {
    if (availableDays.length === 0) {
      toast.error('All days are already added.');
      return;
    }
    const nextDay = availableDays[0];
    const defaultBreak = dayRows.length > 0 ? dayRows[0].breakMin : 60;
    setDayRows(prev => [...prev, { day: nextDay, start: '09:00', end: '18:00', breakMin: defaultBreak }]);
    markDirty();
  };

  const removeDay = (index: number) => {
    if (dayRows.length <= 1) {
      toast.error('Schedule must have at least one working day.');
      return;
    }
    setDayRows(prev => prev.filter((_, i) => i !== index));
    markDirty();
  };

  const changeDay = (index: number, newDay: string) => {
    if (usedDays.has(newDay) && dayRows[index].day !== newDay) {
      toast.error(`${DAY_LABELS[newDay]} is already in the schedule.`);
      return;
    }
    updateRow(index, 'day', newDay);
  };

  const handleSave = () => {
    // Validations
    if (!name.trim()) {
      toast.error('Schedule name is required.');
      return;
    }
    if (dayRows.length === 0) {
      toast.error('At least one working day is required.');
      return;
    }
    for (const row of dayRows) {
      if (!row.start || !row.end) {
        toast.error(`Start and end times are required for ${DAY_LABELS[row.day]}.`);
        return;
      }
      if (row.end <= row.start) {
        toast.error(`End time must be after start time for ${DAY_LABELS[row.day]}.`);
        return;
      }
      const hours = computeDayHours(row.start, row.end, row.breakMin);
      if (hours <= 0) {
        toast.error(`Break duration exceeds working hours for ${DAY_LABELS[row.day]}.`);
        return;
      }
    }

    const dayPayload = rowsToPayload(dayRows);
    saveMut.mutate({
      name,
      company,
      timezone,
      status,
      ...dayPayload,
    });
  };

  const handleBack = () => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to leave?')) return;
    }
    navigate('/schedules');
  };

  // Loading / Error states
  if (!isNew && isLoading) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm text-slate-500">Loading schedule details...</p>
      </div>
    );
  }

  if (!isNew && (isError || !schedule)) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200 max-w-2xl mx-auto mt-8">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Schedule Not Found</h2>
        <p className="text-slate-500 mb-6">The working schedule you are looking for does not exist.</p>
        <button onClick={() => navigate('/schedules')} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          Back to Working Schedules
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-0.5">
              <Link to="/schedules" className="hover:text-primary-600">Working Schedules</Link>
              <span>/</span>
              <span className="text-slate-900 font-medium">
                {isNew ? 'New Schedule' : name || 'Schedule'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isNew ? 'New Working Schedule' : name}
            </h1>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saveMut.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <Save size={15} />
              {saveMut.isPending ? 'Saving...' : isNew ? 'Create Schedule' : 'Save Changes'}
            </button>
            {!isNew && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Main Form Card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Schedule Info */}
        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Schedule Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty(); }}
              placeholder="e.g. 40 Hours / Week"
              disabled={!canEdit}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          {/* Company */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <span className="flex items-center gap-1.5"><Building2 size={14} /> Company</span>
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => { setCompany(e.target.value); markDirty(); }}
              disabled={!canEdit}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          {/* Days per Week (computed, read-only) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Days per Week</label>
            <div className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 font-medium">
              {daysPerWeek}
            </div>
          </div>
          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <span className="flex items-center gap-1.5"><Globe size={14} /> Timezone</span>
            </label>
            <select
              value={timezone}
              onChange={(e) => { setTimezone(e.target.value); markDirty(); }}
              disabled={!canEdit}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); markDirty(); }}
              disabled={!canEdit}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* ── Weekly Schedule Section ── */}
        <div className="border-t border-slate-200">
          <div className="flex items-center justify-between px-6 md:px-8 py-4">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Clock size={18} className="text-primary-500" />
              Weekly Schedule
            </h3>
            {canEdit && (
              <button
                onClick={addDay}
                disabled={availableDays.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus size={14} />
                Add Day
              </button>
            )}
          </div>

          {/* Weekly schedule table */}
          <div className="px-6 md:px-8 pb-6">
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Day</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Start Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">End Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Break</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hours</th>
                    {canEdit && <th className="w-12 px-4 py-3"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dayRows.map((row, idx) => {
                    const hours = computeDayHours(row.start, row.end, row.breakMin);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <select
                              value={row.day}
                              onChange={(e) => changeDay(idx, e.target.value)}
                              className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none bg-white min-w-[130px]"
                            >
                              <option value={row.day}>{DAY_LABELS[row.day]}</option>
                              {availableDays.map(d => (
                                <option key={d} value={d}>{DAY_LABELS[d]}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-slate-900">{DAY_LABELS[row.day]}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <input
                              type="time"
                              value={row.start}
                              onChange={(e) => updateRow(idx, 'start', e.target.value)}
                              className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                          ) : (
                            <span className="text-slate-700">{formatTime12(row.start)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <input
                              type="time"
                              value={row.end}
                              onChange={(e) => updateRow(idx, 'end', e.target.value)}
                              className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                          ) : (
                            <span className="text-slate-700">{formatTime12(row.end)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={480}
                                value={row.breakMin}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  // Update all rows to same break (model constraint)
                                  setDayRows(prev => prev.map(r => ({ ...r, breakMin: val })));
                                  markDirty();
                                }}
                                className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none text-center"
                              />
                              <span className="text-xs text-slate-400">min</span>
                            </div>
                          ) : (
                            <span className="text-slate-700">{row.breakMin >= 60 ? `${row.breakMin / 60}h` : `${row.breakMin}m`}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${hours > 0 ? 'text-primary-600' : 'text-red-500'}`}>
                            {formatHours(hours)}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => removeDay(idx)}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              title="Remove day"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {dayRows.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-sm text-slate-400">
                        No working days configured. Click "+ Add Day" to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Weekly Hours */}
            <div className="flex justify-end mt-4">
              <div className="flex items-center gap-3 px-5 py-3 bg-primary-50 rounded-xl border border-primary-100">
                <Timer size={18} className="text-primary-600" />
                <div>
                  <p className="text-xs text-primary-600 font-medium">Total Weekly Hours</p>
                  <p className="text-xl font-bold text-primary-700">{formatHours(totalWeeklyHours)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Contract Assignment Info ── */}
        {!isNew && schedule && schedule.assigned_contracts_count > 0 && (
          <div className="border-t border-slate-200 px-6 md:px-8 py-4 bg-amber-50/50">
            <p className="text-sm text-amber-700 flex items-center gap-2">
              <AlertTriangle size={14} />
              This schedule is assigned to <strong>{schedule.assigned_contracts_count}</strong> contract(s).
            </p>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Delete Schedule</h3>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            {schedule && schedule.assigned_contracts_count > 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                <p className="text-sm text-amber-800 flex items-center gap-2">
                  <AlertTriangle size={14} />
                  Cannot delete: assigned to {schedule.assigned_contracts_count} contract(s).
                  Please reassign those contracts first.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-600 mb-4">
                Are you sure you want to delete "<strong>{name}</strong>"?
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              {(!schedule || schedule.assigned_contracts_count === 0) && (
                <button
                  onClick={() => { deleteMut.mutate(); setShowDeleteConfirm(false); }}
                  disabled={deleteMut.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteMut.isPending ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
