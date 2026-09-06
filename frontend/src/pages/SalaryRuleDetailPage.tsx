/**
 * PeoplePay585 — Salary Rule Detail Page
 * Form view for viewing/editing/creating a salary rule.
 * Matches HRMS OXP reference with two-column layout and computation options.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Save, Loader2, AlertCircle, Pencil, Trash2, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';

interface SalaryStructure {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
}

const categories = [
  { value: 'basic', label: 'Basic' },
  { value: 'allowance', label: 'Allowance' },
  { value: 'gross', label: 'Gross' },
  { value: 'deduction', label: 'Deduction' },
  { value: 'net', label: 'Net' },
];

const calcTypes = [
  { value: 'fixed', label: 'Fixed Amount' },
  { value: 'percentage', label: 'Percentage of Wage' },
  { value: 'formula', label: 'Python Code / Formula' },
];

interface FormState {
  name: string;
  code: string;
  category: string;
  sequence: string;
  structure_id: string;
  calculation_type: string;
  fixed_amount: string;
  percentage: string;
  percentage_of: string;
  formula: string;
  is_active: boolean;
  appears_on_payslip: boolean;
}

const emptyForm: FormState = {
  name: '',
  code: '',
  category: 'basic',
  sequence: '10',
  structure_id: '',
  calculation_type: 'fixed',
  fixed_amount: '',
  percentage: '',
  percentage_of: 'BASIC',
  formula: '',
  is_active: true,
  appears_on_payslip: true,
};

export default function SalaryRuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !id || id === 'new';
  const [editing, setEditing] = useState(isNew);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: rule, isLoading, error } = useQuery({
    queryKey: ['salary-rule', id],
    queryFn: async () => (await api.get(`/salary/rules/${id}`)).data,
    enabled: !isNew,
  });

  const { data: structures = [] } = useQuery<SalaryStructure[]>({
    queryKey: ['salary-structures'],
    queryFn: async () => (await api.get('/salary/structures')).data,
  });

  useEffect(() => {
    if (rule && !isNew) {
      setForm({
        name: rule.name || '',
        code: rule.code || '',
        category: rule.category || 'basic',
        sequence: String(rule.sequence ?? 10),
        structure_id: String(rule.structure_id || ''),
        calculation_type: rule.calculation_type || 'fixed',
        fixed_amount: rule.fixed_amount != null ? String(rule.fixed_amount) : '',
        percentage: rule.percentage != null ? String(rule.percentage) : '',
        percentage_of: rule.percentage_of || 'BASIC',
        formula: rule.formula || '',
        is_active: rule.is_active ?? true,
        appears_on_payslip: rule.appears_on_payslip ?? true,
      });
    }
  }, [rule, isNew]);

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      category: form.category,
      sequence: parseInt(form.sequence) || 1,
      structure_id: parseInt(form.structure_id),
      calculation_type: form.calculation_type,
      is_active: form.is_active,
      appears_on_payslip: form.appears_on_payslip,
    };
    if (form.calculation_type === 'fixed') {
      payload.fixed_amount = parseFloat(form.fixed_amount) || 0;
    }
    if (form.calculation_type === 'percentage') {
      payload.percentage = parseFloat(form.percentage) || 0;
      payload.percentage_of = form.percentage_of.trim().toUpperCase();
    }
    if (form.calculation_type === 'formula') {
      payload.formula = form.formula.trim();
    }
    return payload;
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (isNew) {
        return api.post('/salary/rules', payload);
      }
      return api.put(`/salary/rules/${id}`, payload);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['salary-rules'] });
      qc.invalidateQueries({ queryKey: ['salary-rule', id] });
      qc.invalidateQueries({ queryKey: ['salary-structures'] });
      toast.success(isNew ? 'Salary rule created!' : 'Salary rule updated!');
      if (isNew) {
        navigate(`/salary/rules/${res.data.id}`, { replace: true });
      } else {
        setEditing(false);
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to save'),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.delete(`/salary/rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-rules'] });
      qc.invalidateQueries({ queryKey: ['salary-structures'] });
      toast.success('Salary rule deleted.');
      navigate('/salary/rules');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to delete'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Rule name is required.');
    if (!form.code.trim()) return toast.error('Code is required.');
    if (!form.structure_id) return toast.error('Salary structure is required.');
    if (!form.sequence || parseInt(form.sequence) < 1) return toast.error('Sequence must be a positive number.');
    if (form.calculation_type === 'percentage' && (!form.percentage || parseFloat(form.percentage) <= 0))
      return toast.error('Percentage is required and must be > 0.');
    if (form.calculation_type === 'percentage' && !form.percentage_of.trim())
      return toast.error('Percentage of (rule code) is required.');
    if (form.calculation_type === 'formula' && !form.formula.trim())
      return toast.error('Formula expression is required.');
    saveMut.mutate();
  };

  const set = (field: keyof FormState, value: string | boolean) =>
    setForm((p) => ({ ...p, [field]: value }));

  /* ── Loading ── */
  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (!isNew && (error || !rule)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle size={40} className="text-rose-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-900">Salary Rule not found</h2>
          <button
            onClick={() => navigate('/salary/rules')}
            className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-base"
          >
            <ArrowLeft size={16} /> Back to Salary Rules
          </button>
        </div>
      </div>
    );
  }

  const currentStructureName = structures.find((s) => String(s.id) === form.structure_id)?.name || rule?.structure_name || '';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <button
          onClick={() => navigate('/salary/rules')}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-600 mb-3 transition-base group"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Salary Rules</span>
          <ChevronRight size={14} className="text-slate-400" />
          <span className="text-slate-800 font-medium">{isNew ? 'New Rule' : form.name || 'Rule'}</span>
        </button>

        <PageHeader
          title={isNew ? 'Salary Rule / New' : `Salary Rule / ${form.name}`}
          subtitle="Form view"
          action={
            !isNew && !editing ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base"
                >
                  <Pencil size={16} /> Edit
                </button>
                <button
                  onClick={() => { if (confirm('Delete this salary rule?')) deleteMut.mutate(); }}
                  className="flex items-center gap-2 px-4 py-2.5 border border-rose-200 text-rose-600 rounded-xl text-sm font-medium hover:bg-rose-50 transition-base"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {/* LEFT COLUMN */}
            <div className="space-y-5">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rule Name</label>
                {editing ? (
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    className="mt-1.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base"
                    placeholder="e.g. Basic Salary"
                    required
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    {form.name}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Code</label>
                {editing ? (
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => set('code', e.target.value.toUpperCase())}
                    className="mt-1.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base"
                    placeholder="e.g. BASIC"
                    required
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-mono font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    {form.code}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Category</label>
                {editing ? (
                  <select
                    value={form.category}
                    onChange={(e) => set('category', e.target.value)}
                    className="mt-1.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base"
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1.5 text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100 capitalize">
                    {form.category}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sequence</label>
                {editing ? (
                  <input
                    type="number"
                    value={form.sequence}
                    onChange={(e) => set('sequence', e.target.value)}
                    min={1}
                    className="mt-1.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base"
                    required
                  />
                ) : (
                  <p className="mt-1.5 text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    {form.sequence}
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-5">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Salary Structure</label>
                {editing ? (
                  <select
                    value={form.structure_id}
                    onChange={(e) => set('structure_id', e.target.value)}
                    className="mt-1.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base"
                    required
                  >
                    <option value="">Select Structure...</option>
                    {structures.filter((s) => s.is_active).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1.5 text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    {currentStructureName}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Computation</label>
                {editing ? (
                  <select
                    value={form.calculation_type}
                    onChange={(e) => set('calculation_type', e.target.value)}
                    className="mt-1.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base"
                  >
                    {calcTypes.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1.5 text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    {calcTypes.find((c) => c.value === form.calculation_type)?.label || form.calculation_type}
                  </p>
                )}
              </div>

              {/* Conditional fields based on calculation_type */}
              {form.calculation_type === 'fixed' && (
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Fixed Amount</label>
                  {editing ? (
                    <input
                      type="number"
                      value={form.fixed_amount}
                      onChange={(e) => set('fixed_amount', e.target.value)}
                      step="0.01"
                      className="mt-1.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base"
                      placeholder="e.g. 50000"
                    />
                  ) : (
                    <p className="mt-1.5 text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                      {form.fixed_amount ? `₹${Number(form.fixed_amount).toLocaleString('en-IN')}` : '—'}
                    </p>
                  )}
                </div>
              )}

              {form.calculation_type === 'percentage' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Percentage (%)</label>
                    {editing ? (
                      <input
                        type="number"
                        value={form.percentage}
                        onChange={(e) => set('percentage', e.target.value)}
                        step="0.01"
                        min="0"
                        max="100"
                        className="mt-1.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base"
                        placeholder="e.g. 20"
                      />
                    ) : (
                      <p className="mt-1.5 text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                        {form.percentage ? `${form.percentage}%` : '—'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Percentage Of (Rule Code)</label>
                    {editing ? (
                      <input
                        type="text"
                        value={form.percentage_of}
                        onChange={(e) => set('percentage_of', e.target.value.toUpperCase())}
                        className="mt-1.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base"
                        placeholder="e.g. BASIC"
                      />
                    ) : (
                      <p className="mt-1.5 text-sm font-mono font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                        {form.percentage_of || '—'}
                      </p>
                    )}
                  </div>
                </>
              )}

              {form.calculation_type === 'formula' && (
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Formula Expression</label>
                  {editing ? (
                    <textarea
                      value={form.formula}
                      onChange={(e) => set('formula', e.target.value)}
                      rows={3}
                      className="mt-1.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base resize-none"
                      placeholder="e.g. GROSS - PF - TAX"
                    />
                  ) : (
                    <p className="mt-1.5 text-sm font-mono font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100 whitespace-pre-wrap">
                      {form.formula || '—'}
                    </p>
                  )}
                </div>
              )}

              {/* Quantity (always 1 — display for reference) */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Quantity</label>
                <p className="mt-1.5 text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                  1
                </p>
              </div>
            </div>
          </div>

          {/* Toggles */}
          {editing && (
            <div className="flex flex-wrap items-center gap-6 mt-6 pt-5 border-t border-slate-100">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => set('is_active', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/20"
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.appears_on_payslip}
                  onChange={(e) => set('appears_on_payslip', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/20"
                />
                Appears on Payslip
              </label>
            </div>
          )}
        </div>

        {/* Computation Options Reference */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Info size={16} className="text-primary-500" />
            Computation options from the source
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`rounded-lg p-3 border-2 transition-base ${form.calculation_type === 'fixed' ? 'border-primary-400 bg-primary-50' : 'border-slate-100 bg-slate-50'}`}>
              <p className="text-sm font-semibold text-slate-900">Fixed Amount</p>
              <p className="text-xs text-slate-500 mt-0.5">Uses a fixed monetary value configured on the rule.</p>
            </div>
            <div className={`rounded-lg p-3 border-2 transition-base ${form.calculation_type === 'percentage' ? 'border-primary-400 bg-primary-50' : 'border-slate-100 bg-slate-50'}`}>
              <p className="text-sm font-semibold text-slate-900">Percentage of Wage</p>
              <p className="text-xs text-slate-500 mt-0.5">Calculates a % of another rule's computed value (e.g. BASIC).</p>
            </div>
            <div className={`rounded-lg p-3 border-2 transition-base ${form.calculation_type === 'formula' ? 'border-primary-400 bg-primary-50' : 'border-slate-100 bg-slate-50'}`}>
              <p className="text-sm font-semibold text-slate-900">Python Code / Formula</p>
              <p className="text-xs text-slate-500 mt-0.5">Safe arithmetic expression using rule codes as variables.</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Rules execute in sequence order. Use previous rule codes (e.g. BASIC, GROSS) as variables in formulas. Example: <code className="bg-slate-100 px-1 rounded">GROSS - PF - PT</code>
          </p>
        </div>

        {/* Action Buttons */}
        {editing && (
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 shadow-lg shadow-primary-600/20 transition-base"
            >
              <Save size={16} />
              {saveMut.isPending ? 'Saving...' : isNew ? 'Create Rule' : 'Save Changes'}
            </button>
            {!isNew && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  if (rule) {
                    setForm({
                      name: rule.name || '',
                      code: rule.code || '',
                      category: rule.category || 'basic',
                      sequence: String(rule.sequence ?? 10),
                      structure_id: String(rule.structure_id || ''),
                      calculation_type: rule.calculation_type || 'fixed',
                      fixed_amount: rule.fixed_amount != null ? String(rule.fixed_amount) : '',
                      percentage: rule.percentage != null ? String(rule.percentage) : '',
                      percentage_of: rule.percentage_of || 'BASIC',
                      formula: rule.formula || '',
                      is_active: rule.is_active ?? true,
                      appears_on_payslip: rule.appears_on_payslip ?? true,
                    });
                  }
                }}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-base"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
