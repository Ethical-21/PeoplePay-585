/**
 * PeoplePay585 — Attendance Widget
 * Self-service check-in/check-out with live elapsed timer, welcome greeting, and live clock.
 * Matches HRMS OXP reference: Welcome back, current time, Today hours.
 */

import { useState, useEffect, useCallback } from 'react';
import { Clock, LogIn, LogOut, Timer, Sun } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

interface AttendanceStatus {
  status: 'not_checked_in' | 'checked_in' | 'checked_out';
  employee_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  worked_hours: number | null;
  total_worked_hours?: number;
}

export default function AttendanceWidget() {
  const [data, setData] = useState<AttendanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/attendance/my-status');
      setData(res.data);
    } catch {
      // User might not have an employee profile linked
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Live clock — update every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Live elapsed timer when checked in
  useEffect(() => {
    if (!data || data.status !== 'checked_in' || !data.check_in) return;

    const checkInTime = new Date(data.check_in).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.floor((now - checkInTime) / 1000);
      const hrs = Math.floor(diff / 3600).toString().padStart(2, '0');
      const mins = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const secs = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${hrs}:${mins}:${secs}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [data]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      await api.post('/attendance/check-in');
      toast.success('Checked in successfully!');
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Check-in failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      await api.post('/attendance/check-out');
      toast.success('Checked out successfully!');
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Check-out failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-3">
        <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-3 mb-3 bg-white rounded-xl border border-slate-200 p-4 text-center">
        <p className="text-sm font-medium text-slate-500">Attendance Not Available</p>
        <p className="text-xs text-slate-400 mt-1">No employee profile linked to your account.</p>
      </div>
    );
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const getGreeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getElapsedFormatted = () => {
    let totalSecs = 0;
    if (data.total_worked_hours) {
      totalSecs += Math.floor(data.total_worked_hours * 3600);
    }
    
    if (data.status === 'checked_in' && data.check_in) {
      const checkInTime = new Date(data.check_in).getTime();
      const endTime = Date.now();
      totalSecs += Math.floor((endTime - checkInTime) / 1000);
    }

    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
  };

  const firstName = data.employee_name?.split(' ')[0] || 'there';

  return (
    <div className="mx-3 mb-3 bg-gradient-to-br from-primary-50 to-violet-50 rounded-xl border border-primary-100 overflow-hidden">
      {/* Header with greeting */}
      <div className="px-3.5 pt-3.5 pb-2">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 bg-primary-100 rounded-md flex items-center justify-center">
            <Sun size={13} className="text-primary-600" />
          </div>
          <span className="text-xs font-semibold text-primary-700">{getGreeting()}</span>
          <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            data.status === 'checked_in' ? 'bg-emerald-100 text-emerald-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            {data.status === 'checked_in' ? '● Online' : 'Offline'}
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-800">Welcome back, {firstName}!</p>
      </div>

      {/* Live Clock */}
      <div className="px-3.5 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock size={12} className="text-slate-400" />
          <span className="text-[11px] text-slate-500 font-mono">
            {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Timer size={12} className="text-slate-400" />
          <span className="text-[11px] text-slate-500">
            Today: <span className="font-semibold text-slate-700">{getElapsedFormatted()}</span>
          </span>
        </div>
      </div>

      {/* Status Info */}
      {data.status === 'checked_in' && (
        <div className="text-center px-3.5 pb-2">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Timer size={14} className="text-primary-600 animate-pulse" />
            <span className="text-lg font-bold text-primary-700 font-mono">{elapsed}</span>
          </div>
          <p className="text-[10px] text-slate-500">
            In since {data.check_in ? formatTime(data.check_in) : '--'}
          </p>
        </div>
      )}

      {data.status === 'not_checked_in' && data.total_worked_hours !== undefined && data.total_worked_hours > 0 && (
        <div className="text-center px-3.5 pb-2">
          <p className="text-sm font-bold text-emerald-600">{data.total_worked_hours.toFixed(1)}h worked</p>
          <p className="text-[10px] text-slate-500">
            Last session: {data.check_in ? formatTime(data.check_in) : '--'} → {data.check_out ? formatTime(data.check_out) : '--'}
          </p>
        </div>
      )}

      {/* Action Button */}
      <div className="px-3.5 pb-3.5 pt-1">
        {data.status === 'not_checked_in' && (
          <button
            onClick={handleCheckIn}
            disabled={actionLoading}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-sm hover:shadow"
          >
            <LogIn size={13} />
            {actionLoading ? 'Checking in...' : 'Check In'}
          </button>
        )}

        {data.status === 'checked_in' && (
          <button
            onClick={handleCheckOut}
            disabled={actionLoading}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition-all shadow-sm hover:shadow"
          >
            <LogOut size={13} />
            {actionLoading ? 'Checking out...' : 'Check Out'}
          </button>
        )}


      </div>
    </div>
  );
}
