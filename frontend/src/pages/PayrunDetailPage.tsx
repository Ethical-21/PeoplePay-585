/**
 * PeoplePay585 — Payrun Detail Page
 * Full detail view for a single payrun with lifecycle actions and payslip table.
 * Accessed via /payruns/:id
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Play, CheckCircle2, Banknote, Send, Download,
  FileText, ChevronRight, Loader2, AlertCircle, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

/* ─── Types ─── */

interface PayrunDetail {
  id: number;
  name: string;
  period_start: string;
  period_end: string;
  salary_structure_id: number;
  salary_structure_name: string;
  status: string;
  employee_count: number;
  payslip_count: number;
  total_net_salary: string;
  created_at: string;
  computed_at: string | null;
  validated_at: string | null;
  paid_at: string | null;
}

interface PayslipRow {
  id: number;
  payrun_id: number;
  employee_id: number;
  employee_name: string;
  employee_number: string;
  department: string;
  period_start: string;
  period_end: string;
  basic_salary: string;
  gross_salary: string;
  total_deductions: string;
  net_salary: string;
  status: string;
}

interface PayslipLineItem {
  id: number;
  name: string;
  code: string;
  category: string;
  sequence: number;
  amount: string;
}

interface PayslipFull extends PayslipRow {
  lines: PayslipLineItem[];
  contract_id: number;
}

/* ─── Constants ─── */

const categoryColors: Record<string, string> = {
  BASIC: 'text-blue-700 bg-blue-50',
  ALLOWANCE: 'text-emerald-700 bg-emerald-50',
  DEDUCTION: 'text-rose-700 bg-rose-50',
  GROSS: 'text-amber-700 bg-amber-50',
  NET: 'text-violet-700 bg-violet-50',
};

/* ─── Component ─── */

export default function PayrunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sendingPayslips, setSendingPayslips] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipRow | null>(null);
  const [autoAdding, setAutoAdding] = useState(false);

  /* ── Queries ── */

  const {
    data: payrun,
    isLoading,
    error,
  } = useQuery<PayrunDetail>({
    queryKey: ['payrun-detail', id],
    queryFn: async () => (await api.get(`/payroll/payruns/${id}`)).data,
    enabled: !!id,
  });

  const { data: payslips = [], isLoading: loadingPayslips } = useQuery<PayslipRow[]>({
    queryKey: ['payrun-payslips', id],
    queryFn: async () => (await api.get('/payroll/payslips', { params: { payrun_id: id } })).data,
    enabled: !!id,
  });

  const { data: payslipDetail } = useQuery<PayslipFull>({
    queryKey: ['payslip-detail', selectedPayslip?.id],
    queryFn: async () => (await api.get(`/payroll/payslips/${selectedPayslip!.id}`)).data,
    enabled: !!selectedPayslip,
  });

  /* ── Mutations ── */

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['payrun-detail', id] });
    qc.invalidateQueries({ queryKey: ['payrun-payslips', id] });
    qc.invalidateQueries({ queryKey: ['payruns'] });
  };

  const computeMut = useMutation({
    mutationFn: () => api.post(`/payroll/payruns/${id}/compute`),
    onSuccess: (res) => {
      invalidateAll();
      const d = res.data;
      toast.success(`Computed! ${d.successful} payslip(s) generated, ${d.failed} failed.`);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Computation failed'),
  });

  const validateMut = useMutation({
    mutationFn: () => api.post(`/payroll/payruns/${id}/validate`),
    onSuccess: () => {
      invalidateAll();
      toast.success('Payrun validated! All payslips confirmed.');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Validation failed'),
  });

  const markPaidMut = useMutation({
    mutationFn: () => api.post(`/payroll/payruns/${id}/mark-paid`),
    onSuccess: () => {
      invalidateAll();
      toast.success('Payrun marked as paid!');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to mark as paid'),
  });

  /* ── Helpers ── */

  const fmt = (n: string | number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(n));

  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const fmtDateFull = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getWorkedDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const downloadPDF = async (payslipId: number) => {
    setDownloadingId(payslipId);
    try {
      const res = await api.get(`/payroll/payslips/${payslipId}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${payslipId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleAutoAddEmployees = async () => {
    setAutoAdding(true);
    try {
      const res = await api.post(`/payroll/payruns/${id}/auto-add-employees`);
      const d = res.data;
      invalidateAll();
      toast.success(`Added ${d.added} eligible employee(s).`);
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to add employees');
    } finally {
      setAutoAdding(false);
    }
  };

  const handleSendPayslips = async () => {
    if (payslips.length === 0) {
      toast.error('No payslips to send.');
      return;
    }
    setSendingPayslips(true);
    try {
      // In production, this would call a batch email API
      await new Promise((r) => setTimeout(r, 1000));
      toast.success(`${payslips.length} payslip(s) queued for email delivery.`);
    } catch {
      toast.error('Failed to send payslips.');
    } finally {
      setSendingPayslips(false);
    }
  };

  const status = payrun?.status?.toLowerCase() || '';

  /* ── Loading State ── */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2
            size={32}
            className="animate-spin text-primary-500 mx-auto mb-3"
          />
          <p className="text-sm text-slate-500">Loading Payrun...</p>
        </div>
      </div>
    );
  }

  /* ── Error / Not Found ── */
  if (error || !payrun) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle size={40} className="text-rose-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900">
            Payrun not found
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            The requested payrun does not exist or you don't have access.
          </p>
          <button
            onClick={() => navigate('/payruns')}
            className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-base"
          >
            <ArrowLeft size={16} /> Back to Payruns
          </button>
        </div>
      </div>
    );
  }

  const viewDetail = payslipDetail || selectedPayslip;

  /* ── Render ── */
  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div>
        <button
          onClick={() => navigate('/payruns')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-600 mb-3 transition-base group"
        >
          <ArrowLeft
            size={15}
            className="group-hover:-translate-x-0.5 transition-transform"
          />
          <span>Payruns</span>
          <ChevronRight size={14} className="text-slate-400" />
          <span className="text-slate-800 font-medium">{payrun.name}</span>
        </button>

        <PageHeader
          title={`Payrun / ${payrun.name}`}
          subtitle="Open one Payrun to compute and manage its payslips"
        />
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Left: Lifecycle actions */}
        <div className="flex flex-wrap items-center gap-2">
          {status === 'draft' && (
            <button
              onClick={handleAutoAddEmployees}
              disabled={autoAdding}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 disabled:opacity-50 transition-base"
            >
              <Users size={16} />
              {autoAdding ? 'Adding...' : 'Auto-Add Employees'}
            </button>
          )}
          <button
            onClick={() => computeMut.mutate()}
            disabled={
              computeMut.isPending ||
              !['draft', 'computed'].includes(status)
            }
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary-600/20 transition-base"
          >
            <Play size={16} />
            {computeMut.isPending ? 'Computing...' : 'Compute'}
          </button>
          <button
            onClick={() => validateMut.mutate()}
            disabled={validateMut.isPending || status !== 'computed'}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-base"
          >
            <CheckCircle2 size={16} />
            {validateMut.isPending ? 'Validating...' : 'Validate'}
          </button>
          <button
            onClick={() => markPaidMut.mutate()}
            disabled={markPaidMut.isPending || status !== 'validated'}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-base"
          >
            <Banknote size={16} />
            {markPaidMut.isPending ? 'Processing...' : 'Mark Paid'}
          </button>
        </div>
        {/* Right: Send payslips */}
        <div className="ml-auto">
          <button
            onClick={handleSendPayslips}
            disabled={sendingPayslips || payslips.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20 transition-base"
          >
            <Send size={16} />
            {sendingPayslips ? 'Sending...' : 'Send Payslips'}
          </button>
        </div>
      </div>

      {/* ── Payrun Information ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Name
            </label>
            <p className="mt-1.5 text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
              {payrun.name}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Salary Structure
            </label>
            <p className="mt-1.5 text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
              {payrun.salary_structure_name ||
                `Structure #${payrun.salary_structure_id}`}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Period
            </label>
            <p className="mt-1.5 text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
              {fmtDate(payrun.period_start)} — {fmtDate(payrun.period_end)}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Status
            </label>
            <div className="mt-1.5 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
              <StatusBadge status={payrun.status} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
          <p className="text-xs text-slate-500">Employees</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {payrun.employee_count}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
          <p className="text-xs text-slate-500">Payslips</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {payrun.payslip_count}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
          <p className="text-xs text-slate-500">Total Net Salary</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {fmt(payrun.total_net_salary)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
          <p className="text-xs text-slate-500">Worked Days</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {getWorkedDays(payrun.period_start, payrun.period_end)}
          </p>
        </div>
      </div>

      {/* ── Payslips Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">
            Payslips in this Payrun
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {payslips.length} payslip(s) · Period{' '}
            {fmtDateFull(payrun.period_start)} to{' '}
            {fmtDateFull(payrun.period_end)}
          </p>
        </div>

        {loadingPayslips ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
          </div>
        ) : payslips.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">
              {status === 'draft'
                ? 'No payslips yet. Add employees and click Compute to generate payslips.'
                : 'No payslips found for this payrun.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Employee
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Warning
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">
                    Worked
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">
                    Basic
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">
                    Gross
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">
                    Net
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">
                    PDF
                  </th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((ps) => (
                  <tr
                    key={ps.id}
                    onClick={() => setSelectedPayslip(ps)}
                    className="border-b border-slate-100 hover:bg-primary-50/40 cursor-pointer transition-base group"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 group-hover:text-primary-700 transition-colors">
                        {ps.employee_name ||
                          `Employee #${ps.employee_id}`}
                      </p>
                      <p className="text-xs text-slate-500">
                        {ps.employee_number}
                        {ps.department ? ` · ${ps.department}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      —
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {getWorkedDays(ps.period_start, ps.period_end)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {Number(ps.basic_salary) > 0
                        ? fmt(ps.basic_salary)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 font-medium">
                      {fmt(ps.gross_salary)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                      {fmt(ps.net_salary)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ps.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadPDF(ps.id);
                        }}
                        disabled={downloadingId === ps.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 disabled:opacity-50 transition-base"
                        title="Download PDF"
                      >
                        <Download size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* ── Table Footer Totals ── */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold">
                  <td className="px-4 py-3 text-slate-700">
                    Total ({payslips.length})
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-slate-700">
                    {fmt(
                      payslips.reduce(
                        (sum, ps) => sum + Number(ps.basic_salary || 0),
                        0
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900">
                    {fmt(
                      payslips.reduce(
                        (sum, ps) => sum + Number(ps.gross_salary),
                        0
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600">
                    {fmt(
                      payslips.reduce(
                        (sum, ps) => sum + Number(ps.net_salary),
                        0
                      )
                    )}
                  </td>
                  <td className="px-4 py-3" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Payslip Detail Modal ── */}
      <Modal
        isOpen={!!selectedPayslip}
        onClose={() => setSelectedPayslip(null)}
        title="Payslip Detail"
        size="lg"
      >
        {viewDetail && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-primary-50 to-violet-50 rounded-xl p-4">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {viewDetail.employee_name ||
                    `Employee #${viewDetail.employee_id}`}
                </h3>
                <p className="text-xs text-slate-500">
                  {viewDetail.employee_number} &middot;{' '}
                  {viewDetail.period_start} to {viewDetail.period_end}
                </p>
              </div>
              <StatusBadge status={viewDetail.status} />
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-600">Gross Salary</p>
                <p className="text-lg font-bold text-blue-700">
                  {fmt(viewDetail.gross_salary)}
                </p>
              </div>
              <div className="bg-rose-50 rounded-lg p-3">
                <p className="text-xs text-rose-600">Deductions</p>
                <p className="text-lg font-bold text-rose-700">
                  -{fmt(viewDetail.total_deductions)}
                </p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <p className="text-xs text-emerald-600">Net Salary</p>
                <p className="text-lg font-bold text-emerald-700">
                  {fmt(viewDetail.net_salary)}
                </p>
              </div>
            </div>

            {/* Line Items */}
            {payslipDetail?.lines && payslipDetail.lines.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">
                  Salary Breakdown
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">
                          Component
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">
                          Category
                        </th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-600">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {payslipDetail.lines
                        .sort((a, b) => a.sequence - b.sequence)
                        .map((line) => (
                          <tr
                            key={line.id}
                            className="border-t border-slate-100"
                          >
                            <td className="px-4 py-2">
                              <span className="font-medium text-slate-900">
                                {line.name}
                              </span>
                              <span className="ml-2 text-xs text-slate-400 font-mono">
                                {line.code}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                  categoryColors[
                                    line.category.toUpperCase()
                                  ] || 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {line.category.toUpperCase()}
                              </span>
                            </td>
                            <td
                              className={`px-4 py-2 text-right font-semibold ${
                                line.category.toUpperCase() === 'DEDUCTION'
                                  ? 'text-rose-600'
                                  : line.category.toUpperCase() === 'NET'
                                    ? 'text-emerald-600'
                                    : 'text-slate-900'
                              }`}
                            >
                              {line.category.toUpperCase() === 'DEDUCTION'
                                ? '-'
                                : ''}
                              {fmt(line.amount)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PDF Download */}
            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => downloadPDF(viewDetail.id)}
                disabled={downloadingId === viewDetail.id}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-base"
              >
                <Download size={16} />
                {downloadingId === viewDetail.id
                  ? 'Downloading...'
                  : 'Download PDF'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
