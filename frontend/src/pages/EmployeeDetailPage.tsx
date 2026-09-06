/**
 * PeoplePay585 — Employee Detailed View (HR Hub)
 */

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Clock, CalendarOff, Receipt, Mail, MapPin, Building, Briefcase } from 'lucide-react';
import api from '../api/client';
import { StatusBadge } from '../components/ui/Badge';

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'work' | 'private'>('work');

  const { data: employee, isLoading, isError } = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => (await api.get(`/employees/${id}`)).data,
  });

  const { data: stats } = useQuery({
    queryKey: ['employee_stats', id],
    queryFn: async () => (await api.get(`/employees/${id}/stats`)).data,
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-sm text-slate-500">Loading employee details...</p>
      </div>
    );
  }

  if (isError || !employee) {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-slate-200 max-w-2xl mx-auto mt-8">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Employee Not Found</h2>
        <p className="text-slate-500 mb-6">The employee you are looking for does not exist or you do not have permission to view them.</p>
        <button onClick={() => navigate('/employees')} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          Back to Employees
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/employees')}
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Link to="/employees" className="hover:text-primary-600">Employees</Link>
              <span>/</span>
              <span className="text-slate-900 font-medium">{employee.full_name}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Employee Details</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={employee.status} />
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header Section */}
        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-start justify-between border-b border-slate-100">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-white font-bold text-3xl shadow-inner flex-shrink-0">
              {employee.first_name[0]}{employee.last_name[0]}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">{employee.full_name}</h2>
              <div className="flex flex-col gap-1.5 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Briefcase size={16} className="text-slate-400" />
                  <span className="font-medium text-slate-700">{employee.job_title || 'No role assigned'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building size={16} className="text-slate-400" />
                  <span>{employee.department?.name || 'No department'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Smart Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 md:pt-0">
            <button onClick={() => navigate(`/contracts?employee_id=${employee.id}`)} className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors group">
              <span className="text-lg font-semibold text-slate-700 group-hover:text-blue-600 mb-1">{stats?.contracts_count ?? '-'}</span>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 group-hover:text-blue-600">
                <FileText size={14} /> Contracts
              </div>
            </button>
            <button onClick={() => navigate(`/timeoff?employee_id=${employee.id}`)} className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-100 hover:border-violet-200 hover:bg-violet-50/50 transition-colors group">
              <span className="text-lg font-semibold text-slate-700 group-hover:text-violet-600 mb-1">{stats?.timeoff_count ?? '-'}</span>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 group-hover:text-violet-600">
                <CalendarOff size={14} /> Time Off
              </div>
            </button>
            <button onClick={() => navigate(`/attendance?employee_id=${employee.id}`)} className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors group">
              <span className="text-lg font-semibold text-slate-700 group-hover:text-emerald-600 mb-1">{stats?.attendance_count ?? '-'}</span>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 group-hover:text-emerald-600">
                <Clock size={14} /> Attendance
              </div>
            </button>
            <button onClick={() => navigate(`/payslips?employee_id=${employee.id}`)} className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-100 hover:border-amber-200 hover:bg-amber-50/50 transition-colors group">
              <span className="text-lg font-semibold text-slate-700 group-hover:text-amber-600 mb-1">{stats?.payslips_count ?? '-'}</span>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 group-hover:text-amber-600">
                <Receipt size={14} /> Payslips
              </div>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-6 md:px-8 border-b border-slate-100 overflow-x-auto hide-scrollbar">
          <button 
            onClick={() => setActiveTab('work')}
            className={`px-4 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'work' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Work Information
          </button>
          <button 
            onClick={() => setActiveTab('private')}
            className={`px-4 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === 'private' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Private Information
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 md:p-8 bg-slate-50/50 min-h-[300px]">
          {activeTab === 'work' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Briefcase size={16} className="text-primary-500" /> Organization</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-sm text-slate-500">Department</span>
                      <span className="col-span-2 text-sm font-medium text-slate-900">{employee.department?.name || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-sm text-slate-500">Job Role</span>
                      <span className="col-span-2 text-sm font-medium text-slate-900">{employee.job_title || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-sm text-slate-500">Employee Type</span>
                      <span className="col-span-2 text-sm font-medium text-slate-900 capitalize">{employee.employee_type.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Clock size={16} className="text-primary-500" /> Work Schedule & Contact</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-sm text-slate-500">Work Email</span>
                      <span className="col-span-2 text-sm font-medium text-slate-900">{employee.email}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-sm text-slate-500">Work Phone</span>
                      <span className="col-span-2 text-sm font-medium text-slate-900">{employee.phone || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-sm text-slate-500">Location</span>
                      <span className="col-span-2 text-sm font-medium text-slate-900">{[employee.city, employee.state].filter(Boolean).join(', ') || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Mail size={16} className="text-primary-500" /> Personal Details</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-sm text-slate-500">Gender</span>
                      <span className="col-span-2 text-sm font-medium text-slate-900 capitalize">{employee.gender || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-sm text-slate-500">Date of Birth</span>
                      <span className="col-span-2 text-sm font-medium text-slate-900">{employee.date_of_birth || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><MapPin size={16} className="text-primary-500" /> Contact Info</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-sm text-slate-500">Address</span>
                      <span className="col-span-2 text-sm font-medium text-slate-900">{employee.address || '—'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-sm text-slate-500">City/State</span>
                      <span className="col-span-2 text-sm font-medium text-slate-900">{[employee.city, employee.state].filter(Boolean).join(', ') || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
