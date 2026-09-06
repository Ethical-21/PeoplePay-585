/**
 * PeoplePay585 — Payslips Page
 * Matches the Excalidraw reference: Employee | Warning | Period | Basic | Gross | Net | Structure | Status
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Receipt, Eye, Download, Search } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/Badge';
import Modal from '../components/ui/Modal';

interface PayslipLine {
  id: number;
  name: string;
  code: string;
  category: string;
  sequence: number;
  amount: string;
}

interface Payslip {
  id: number;
  payrun_id: number;
  employee_id: number;
  contract_id: number;
  period_start: string;
  period_end: string;
  basic_salary: string;
  gross_salary: string;
  total_deductions: string;
  net_salary: string;
  status: string;
  structure_name: string;
  lines: PayslipLine[];
  created_at: string;
  employee_name?: string;
  employee_number?: string;
  department?: string;
}

const categoryColors: Record<string, string> = {
  BASIC: 'text-blue-700 bg-blue-50',
  ALLOWANCE: 'text-emerald-700 bg-emerald-50',
  DEDUCTION: 'text-rose-700 bg-rose-50',
  GROSS: 'text-amber-700 bg-amber-50',
  NET: 'text-violet-700 bg-violet-50',
};

export default function PayslipsPage() {
  const [selected, setSelected] = useState<Payslip | null>(null);
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<number | null>(null);
  const [searchParams] = useSearchParams();
  const employeeIdFilter = searchParams.get('employee_id');

  const { data: payslips = [], isLoading } = useQuery<Payslip[]>({
    queryKey: ['payslips', employeeIdFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (employeeIdFilter) params.employee_id = employeeIdFilter;
      return (await api.get('/payroll/payslips', { params })).data;
    },
  });

  const { data: detail } = useQuery<Payslip>({
    queryKey: ['payslip-detail', selected?.id],
    queryFn: async () => (await api.get(`/payroll/payslips/${selected!.id}`)).data,
    enabled: !!selected,
  });

  const fmt = (n: string | number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n));

  const fmtShort = (n: string | number) => {
    const num = Number(n);
    if (num >= 100000) return `₹${(num / 100000).toFixed(0)}L`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(0)}k`;
    return fmt(num);
  };

  const fmtDate = (d: string) => {
    const dt = new Date(d);
    const day = dt.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[dt.getMonth()]}`;
  };

  const fmtPeriod = (start: string, end: string) => `${fmtDate(start)} — ${fmtDate(end)}`;

  const filtered = payslips.filter((ps) =>
    !search || (ps.employee_name || '').toLowerCase().includes(search.toLowerCase()) || (ps.employee_number || '').toLowerCase().includes(search.toLowerCase())
  );

  const viewDetail = detail || selected;

  // Derive unique period for the period badge
  const uniquePeriods = [...new Set(payslips.map(ps => {
    const d = new Date(ps.period_start);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }))];
  const periodLabel = uniquePeriods.length === 1 ? `Period: ${uniquePeriods[0]}` : `${uniquePeriods.length} periods`;

  const downloadPDF = async (payslipId: number) => {
    setDownloading(payslipId);
    try {
      const res = await api.get(`/payroll/payslips/${payslipId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${payslipId}.pdf`;
      document.body.appendChild(a);
      a.click();
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      toast.success('PDF downloaded successfully');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to download PDF.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payslips"
        subtitle="List view of employee payslips"
      />

      {/* Toolbar: Search + Period Badge */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payslips..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-base"
          />
        </div>
        {uniquePeriods.length > 0 && (
          <div className="px-4 py-2.5 bg-primary-50 border border-primary-200 rounded-xl text-sm font-medium text-primary-700">
            {periodLabel}
          </div>
        )}
        <div className="ml-auto text-sm text-slate-500">{filtered.length} payslips</div>
      </div>

      {/* Payslips Table — matching reference: Employee | Warning | Period | Basic | Gross | Net | Structure | Status */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center"><Receipt size={40} className="mx-auto text-slate-300 mb-3" /><p className="text-slate-500 text-sm">No payslips found</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Employee</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Warning</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Period</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Basic</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Gross</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Net</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Structure</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ps) => {
                  // Warning logic: check for potential issues
                  let warning = '';
                  let warningColor = '';
                  const basic = Number(ps.basic_salary || 0);
                  const gross = Number(ps.gross_salary || 0);
                  const net = Number(ps.net_salary || 0);
                  if (basic === 0 && gross > 0) {
                    warning = 'No basic';
                    warningColor = 'text-amber-500';
                  } else if (net <= 0) {
                    warning = 'Zero net';
                    warningColor = 'text-red-500';
                  } else if (Number(ps.total_deductions) > gross * 0.5) {
                    warning = 'High deductions';
                    warningColor = 'text-amber-500';
                  }

                  return (
                    <tr key={ps.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-base cursor-pointer" onClick={() => setSelected(ps)}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{ps.employee_name || `Employee #${ps.employee_id}`}</p>
                      </td>
                      <td className="px-4 py-3">
                        {warning ? (
                          <span className={`text-xs font-medium italic ${warningColor}`}>{warning}</span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {fmtPeriod(ps.period_start, ps.period_end)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900 whitespace-nowrap">{fmtShort(ps.basic_salary)}</td>
                      <td className="px-4 py-3 text-right text-slate-900 whitespace-nowrap">{fmtShort(ps.gross_salary)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 whitespace-nowrap">{fmtShort(ps.net_salary)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{ps.structure_name || 'Regular'}</td>
                      <td className="px-4 py-3"><StatusBadge status={ps.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setSelected(ps)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-base" title="View Details">
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => downloadPDF(ps.id)}
                            disabled={downloading === ps.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-base disabled:opacity-50"
                            title="Download PDF"
                          >
                            <Download size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Helpful note */}
      <p className="text-xs text-slate-400 italic">
        Useful note: selecting any payslip opens the detailed salary computation and PDF action for that employee.
      </p>

      {/* Detail Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Payslip Detail" size="lg">
        {viewDetail && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-primary-50 to-violet-50 rounded-xl p-4">
              <div>
                <h3 className="font-semibold text-slate-900">{viewDetail.employee_name || `Employee #${viewDetail.employee_id}`}</h3>
                <p className="text-xs text-slate-500">{viewDetail.employee_number} &middot; {viewDetail.period_start} to {viewDetail.period_end}</p>
                {viewDetail.structure_name && (
                  <p className="text-xs text-slate-500 mt-0.5">Structure: {viewDetail.structure_name}</p>
                )}
              </div>
              <StatusBadge status={viewDetail.status} />
            </div>

            {/* Summary */}
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">Basic</p><p className="text-lg font-bold text-slate-800">{fmt(viewDetail.basic_salary || 0)}</p></div>
              <div className="bg-blue-50 rounded-lg p-3"><p className="text-xs text-blue-600">Gross Salary</p><p className="text-lg font-bold text-blue-700">{fmt(viewDetail.gross_salary)}</p></div>
              <div className="bg-rose-50 rounded-lg p-3"><p className="text-xs text-rose-600">Deductions</p><p className="text-lg font-bold text-rose-700">-{fmt(viewDetail.total_deductions)}</p></div>
              <div className="bg-emerald-50 rounded-lg p-3"><p className="text-xs text-emerald-600">Net Salary</p><p className="text-lg font-bold text-emerald-700">{fmt(viewDetail.net_salary)}</p></div>
            </div>

            {/* Line Items */}
            {viewDetail.lines && viewDetail.lines.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Salary Breakdown</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Component</th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-600">Category</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-600">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewDetail.lines
                        .sort((a, b) => a.sequence - b.sequence)
                        .map((line) => (
                          <tr key={line.id} className="border-t border-slate-100">
                            <td className="px-4 py-2">
                              <span className="font-medium text-slate-900">{line.name}</span>
                              <span className="ml-2 text-xs text-slate-400 font-mono">{line.code}</span>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${categoryColors[line.category.toUpperCase()] || 'bg-slate-100 text-slate-700'}`}>
                                {line.category.toUpperCase()}
                              </span>
                            </td>
                            <td className={`px-4 py-2 text-right font-semibold ${line.category.toUpperCase() === 'DEDUCTION' ? 'text-rose-600' : line.category.toUpperCase() === 'NET' ? 'text-emerald-600' : 'text-slate-900'}`}>
                              {line.category.toUpperCase() === 'DEDUCTION' ? '-' : ''}{fmt(line.amount)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PDF Download Button */}
            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => downloadPDF(viewDetail.id)}
                disabled={downloading === viewDetail.id}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-base"
              >
                <Download size={16} />
                {downloading === viewDetail.id ? 'Downloading...' : 'Download PDF'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
