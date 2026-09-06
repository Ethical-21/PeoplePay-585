/**
 * PeoplePay585 — Payruns Page
 * Full payroll lifecycle with 2-step creation wizard:
 * Step 1: Period + Structure → CONTINUE
 * Step 2: Employee selection → CREATE PAYRUN
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, CheckCircle, Banknote, Calculator, Eye, Users, ArrowRight, ArrowLeft, UserCheck, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

interface Payrun {
  id: number;
  name: string;
  period_start: string;
  period_end: string;
  salary_structure_id: number;
  status: string;
  employee_count: number;
  payslip_count: number;
  total_net_salary: string;
  created_at: string;
  computed_at: string | null;
  validated_at: string | null;
  paid_at: string | null;
}

interface SalaryStructure { id: number; name: string; code: string; }

export default function PayrunsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [showAddEmp, setShowAddEmp] = useState<Payrun | null>(null);
  const [showPayslips, setShowPayslips] = useState<Payrun | null>(null);
  const [selectedEmps, setSelectedEmps] = useState<number[]>([]);
  const [form, setForm] = useState({ name: '', period_start: '', period_end: '', salary_structure_id: '' });

  const { data: payruns = [], isLoading } = useQuery<Payrun[]>({
    queryKey: ['payruns'],
    queryFn: async () => (await api.get('/payroll/payruns')).data,
  });

  const { data: structures = [] } = useQuery<SalaryStructure[]>({
    queryKey: ['salary-structures'],
    queryFn: async () => (await api.get('/salary/structures')).data,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      const res = await api.get('/employees');
      return res.data.employees || res.data;
    },
  });

  const { data: payslips = [] } = useQuery({
    queryKey: ['payrun-payslips', showPayslips?.id],
    queryFn: async () => (await api.get(`/payroll/payslips`, { params: { payrun_id: showPayslips!.id } })).data,
    enabled: !!showPayslips,
  });

  const createMut = useMutation({
    mutationFn: async (d: Record<string, unknown>) => {
      // Step 1: Create the payrun
      const res = await api.post('/payroll/payruns', d);
      const payrunId = res.data.id;
      // Step 2: Add selected employees
      if (selectedEmps.length > 0) {
        await api.post(`/payroll/payruns/${payrunId}/add-employees`, { employee_ids: selectedEmps });
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payruns'] });
      toast.success('Payrun created with selected employees!');
      closeWizard();
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const addEmpMut = useMutation({
    mutationFn: ({ id, empIds }: { id: number; empIds: number[] }) =>
      api.post(`/payroll/payruns/${id}/add-employees`, { employee_ids: empIds }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payruns'] }); toast.success('Employees added'); setShowAddEmp(null); setSelectedEmps([]); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const computeMut = useMutation({
    mutationFn: (id: number) => api.post(`/payroll/payruns/${id}/compute`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payruns'] }); toast.success('Payrun computed! Payslips generated.'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Computation failed'),
  });

  const validateMut = useMutation({
    mutationFn: (id: number) => api.post(`/payroll/payruns/${id}/validate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payruns'] }); toast.success('Payrun validated'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Validation failed'),
  });

  const payMut = useMutation({
    mutationFn: (id: number) => api.post(`/payroll/payruns/${id}/mark-paid`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payruns'] }); toast.success('Payrun marked as paid!'); },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const closeWizard = () => {
    setShowCreate(false);
    setWizardStep(1);
    setSelectedEmps([]);
    setForm({ name: '', period_start: '', period_end: '', salary_structure_id: '' });
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    // Auto-select all employees
    setSelectedEmps(employees.map((emp: any) => emp.id));
    setWizardStep(2);
  };

  const handleCreatePayrun = () => {
    createMut.mutate({
      name: form.name,
      period_start: form.period_start,
      period_end: form.period_end,
      salary_structure_id: parseInt(form.salary_structure_id),
    });
  };

  const toggleAll = () => {
    if (selectedEmps.length === employees.length) {
      setSelectedEmps([]);
    } else {
      setSelectedEmps(employees.map((emp: any) => emp.id));
    }
  };

  const fmt = (n: string | number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n));

  const statusSteps = ['draft', 'confirmed', 'computed', 'validated', 'paid'];
  const getStepIndex = (status: string) => statusSteps.indexOf(status.toLowerCase());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payruns"
        subtitle="Payroll processing lifecycle"
        action={
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base">
            <Plus size={16} /> New Payrun
          </button>
        }
      />

      {/* Payrun Cards */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
        </div>
      ) : payruns.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Calculator size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No payruns yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payruns.map((pr) => {
            const step = getStepIndex(pr.status);
            return (
              <div key={pr.id}
                onClick={() => navigate(`/payruns/${pr.id}`)}
                className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-primary-200 cursor-pointer transition-base group"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-lg group-hover:text-primary-700 transition-colors">{pr.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {pr.period_start} → {pr.period_end} &middot; {pr.employee_count} employees
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={pr.status} />
                    <ExternalLink size={16} className="text-slate-400 group-hover:text-primary-500 transition-colors" />
                  </div>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center gap-1 mt-4 mb-4">
                  {statusSteps.map((s, i) => (
                    <div key={s} className="flex items-center flex-1">
                      <div className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-primary-500' : 'bg-slate-200'}`} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wider -mt-2 mb-4">
                  {statusSteps.map((s) => <span key={s}>{s}</span>)}
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-3 mb-4 text-center">
                  <div>
                    <p className="text-xs text-slate-500">Employees</p>
                    <p className="text-lg font-bold text-slate-900">{pr.employee_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Payslips</p>
                    <p className="text-lg font-bold text-slate-900">{pr.payslip_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Net</p>
                    <p className="text-lg font-bold text-emerald-600">{fmt(pr.total_net_salary)}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {pr.status.toLowerCase() === 'draft' && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setShowAddEmp(pr); setSelectedEmps([]); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-base">
                        <Users size={13} /> Add Employees
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); computeMut.mutate(pr.id); }} disabled={computeMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-base disabled:opacity-50">
                        <Play size={13} /> {computeMut.isPending ? 'Computing...' : 'Compute'}
                      </button>
                    </>
                  )}
                  {pr.status.toLowerCase() === 'computed' && (
                    <button onClick={(e) => { e.stopPropagation(); validateMut.mutate(pr.id); }} disabled={validateMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-100 transition-base disabled:opacity-50">
                      <CheckCircle size={13} /> {validateMut.isPending ? 'Validating...' : 'Validate'}
                    </button>
                  )}
                  {pr.status.toLowerCase() === 'validated' && (
                    <button onClick={(e) => { e.stopPropagation(); payMut.mutate(pr.id); }} disabled={payMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-base disabled:opacity-50">
                      <Banknote size={13} /> {payMut.isPending ? 'Processing...' : 'Mark as Paid'}
                    </button>
                  )}
                  {pr.payslip_count > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/payruns/${pr.id}`); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-base ml-auto">
                      <Eye size={13} /> View Detail
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2-Step Create Payrun Wizard */}
      <Modal isOpen={showCreate} onClose={closeWizard} title="Create Payrun" size="lg">
        {/* Step Indicator */}
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className={`flex items-center gap-2 ${wizardStep >= 1 ? 'text-primary-700' : 'text-slate-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              wizardStep >= 1 ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-400'
            }`}>1</div>
            <span className="text-sm font-medium">Period & Structure</span>
          </div>
          <div className={`flex-1 h-0.5 ${wizardStep >= 2 ? 'bg-primary-300' : 'bg-slate-200'}`} />
          <div className={`flex items-center gap-2 ${wizardStep >= 2 ? 'text-primary-700' : 'text-slate-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              wizardStep >= 2 ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-400'
            }`}>2</div>
            <span className="text-sm font-medium">Select Employees</span>
          </div>
        </div>

        {wizardStep === 1 ? (
          /* ── Step 1: Period & Structure ── */
          <form onSubmit={handleContinue} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payrun Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. September 2026 Payroll"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Period Start *</label>
                <input required type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Period End *</label>
                <input required type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Salary Structure *</label>
              <select required value={form.salary_structure_id} onChange={(e) => setForm({ ...form, salary_structure_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
                <option value="">-- Select Salary Structure --</option>
                {structures.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={closeWizard} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-base">Cancel</button>
              <button type="submit"
                className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-base">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </form>
        ) : (
          /* ── Step 2: Select Employees ── */
          <div className="space-y-3">
            <div className="bg-primary-50 rounded-lg p-3 text-sm">
              <p className="text-primary-700">
                <span className="font-semibold">{form.name}</span> · {form.period_start} → {form.period_end}
              </p>
              <p className="text-primary-600 text-xs mt-0.5">
                Structure: {structures.find(s => s.id.toString() === form.salary_structure_id)?.name || 'N/A'}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Select employees to include:</p>
              <button onClick={toggleAll} className="text-xs text-primary-600 font-medium hover:underline">
                {selectedEmps.length === employees.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="max-h-[350px] overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-1">
              {employees.map((emp: any) => (
                <label key={emp.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-base ${
                  selectedEmps.includes(emp.id) ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-50 border border-transparent'
                }`}>
                  <input
                    type="checkbox"
                    checked={selectedEmps.includes(emp.id)}
                    onChange={(e) => {
                      setSelectedEmps(e.target.checked
                        ? [...selectedEmps, emp.id]
                        : selectedEmps.filter(id => id !== emp.id)
                      );
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-violet-400 flex items-center justify-center text-white text-xs font-semibold">
                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{emp.full_name}</p>
                    <p className="text-xs text-slate-500">{emp.employee_number} · {emp.department?.name || 'No dept'}</p>
                  </div>
                  {selectedEmps.includes(emp.id) && (
                    <UserCheck size={16} className="text-primary-600 flex-shrink-0" />
                  )}
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <button onClick={() => setWizardStep(1)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-base">
                  <ArrowLeft size={14} /> Back
                </button>
                <span className="text-sm text-slate-500">{selectedEmps.length} employee(s) selected</span>
              </div>
              <button
                onClick={handleCreatePayrun}
                disabled={selectedEmps.length === 0 || createMut.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-base shadow-lg shadow-primary-600/20"
              >
                <Calculator size={16} />
                {createMut.isPending ? 'Creating...' : 'Create Payrun'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Employees Modal (for existing payruns) */}
      <Modal isOpen={!!showAddEmp} onClose={() => setShowAddEmp(null)} title={`Add Employees — ${showAddEmp?.name || ''}`} size="lg">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Select employees to include in this payrun:</p>
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {employees.map((emp: any) => (
              <label key={emp.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedEmps.includes(emp.id)}
                  onChange={(e) => {
                    setSelectedEmps(e.target.checked
                      ? [...selectedEmps, emp.id]
                      : selectedEmps.filter(id => id !== emp.id)
                    );
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-violet-400 flex items-center justify-center text-white text-xs font-semibold">
                  {emp.first_name?.[0]}{emp.last_name?.[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{emp.full_name}</p>
                  <p className="text-xs text-slate-500">{emp.employee_number} &middot; {emp.department?.name || 'No dept'}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-500">{selectedEmps.length} selected</p>
            <div className="flex gap-3">
              <button onClick={() => setShowAddEmp(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-base">Cancel</button>
              <button
                onClick={() => showAddEmp && addEmpMut.mutate({ id: showAddEmp.id, empIds: selectedEmps })}
                disabled={selectedEmps.length === 0 || addEmpMut.isPending}
                className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-base"
              >
                {addEmpMut.isPending ? 'Adding...' : `Add ${selectedEmps.length} Employee${selectedEmps.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* View Payslips Modal */}
      <Modal isOpen={!!showPayslips} onClose={() => setShowPayslips(null)} title={`Payslips — ${showPayslips?.name || ''}`} size="xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Employee</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600 text-xs">Gross</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600 text-xs">Deductions</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600 text-xs">Net Salary</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((ps: any) => (
                <tr key={ps.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{ps.employee_name || `Employee #${ps.employee_id}`}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(ps.gross_salary)}</td>
                  <td className="px-4 py-2.5 text-right text-rose-600">-{fmt(ps.total_deductions)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{fmt(ps.net_salary)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={ps.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}
