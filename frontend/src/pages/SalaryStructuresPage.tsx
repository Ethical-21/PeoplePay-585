/**
 * PeoplePay585 — Salary Structures Page
 * 
 * List view: Structure Name | Rules | Employees | Active
 * Detail view: Editable structure info + Salary Rules table (Rule Name | Code | Category | Sequence)
 * 
 * Structures represent employee types (Regular Salary, Intern Salary, Contractor, etc.)
 * Each structure contains salary rules that define the payslip computation.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, Plus, Search, ArrowLeft,
  Pencil, Trash2, Save, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';

interface SalaryRule {
  id: number;
  name: string;
  code: string;
  category: string;
  sequence: number;
  calculation_type: string;
  fixed_amount: number | null;
  percentage: number | null;
  percentage_of: string | null;
  formula: string | null;
  is_active: boolean;
  appears_on_payslip: boolean;
}

interface SalaryStructure {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  rules: SalaryRule[];
  employee_count: number;
  created_at: string;
  updated_at: string;
}

const categoryColors: Record<string, string> = {
  BASIC: 'bg-blue-100 text-blue-700',
  ALLOWANCE: 'bg-emerald-100 text-emerald-700',
  DEDUCTION: 'bg-rose-100 text-rose-700',
  GROSS: 'bg-amber-100 text-amber-700',
  NET: 'bg-violet-100 text-violet-700',
};

export default function SalaryStructuresPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewStructureModal, setShowNewStructureModal] = useState(false);
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [editingStruct, setEditingStruct] = useState(false);

  // Structure form state
  const [structForm, setStructForm] = useState({ name: '', code: '', description: '' });

  // Editable structure fields (for detail view)
  const [editStructFields, setEditStructFields] = useState({ name: '', is_active: true, description: '' });

  // Rule form state
  const [ruleForm, setRuleForm] = useState({
    name: '', code: '', category: 'basic', sequence: '10',
    calculation_type: 'fixed', fixed_amount: '', percentage: '',
    percentage_of: 'BASIC', formula: '',
  });

  const { data: structures = [], isLoading } = useQuery<SalaryStructure[]>({
    queryKey: ['salary-structures'],
    queryFn: async () => (await api.get('/salary/structures')).data,
  });

  const selected = structures.find((s) => s.id === selectedId) || null;

  // Sync edit fields when selection changes
  useEffect(() => {
    if (selected) {
      setEditStructFields({
        name: selected.name,
        is_active: selected.is_active,
        description: selected.description || '',
      });
    }
  }, [selected?.id, selected?.name, selected?.is_active, selected?.description]);

  const filtered = structures.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
  );

  // Derive "type" from structure name for display
  const getStructType = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('intern')) return 'Intern';
    if (lower.includes('contract')) return 'Contractor';
    if (lower.includes('freelance')) return 'Freelancer';
    if (lower.includes('part')) return 'Part-time';
    return 'Full-time';
  };

  // --- Mutations ---
  const createStructMut = useMutation({
    mutationFn: (d: typeof structForm) => api.post('/salary/structures', d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['salary-structures'] });
      toast.success('Structure created');
      setShowNewStructureModal(false);
      setStructForm({ name: '', code: '', description: '' });
      setSelectedId(res.data.id);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const updateStructMut = useMutation({
    mutationFn: (data: { name: string; is_active: boolean; description: string }) =>
      api.put(`/salary/structures/${selectedId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-structures'] });
      toast.success('Structure updated');
      setEditingStruct(false);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const createRuleMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/salary/rules', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-structures'] });
      toast.success('Rule added');
      setShowNewRuleModal(false);
      setRuleForm({
        name: '', code: '', category: 'basic', sequence: '10',
        calculation_type: 'fixed', fixed_amount: '', percentage: '',
        percentage_of: 'BASIC', formula: '',
      });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const deleteRuleMut = useMutation({
    mutationFn: (ruleId: number) => api.delete(`/salary/rules/${ruleId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-structures'] });
      toast.success('Rule deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  });

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleForm.name.trim() || !ruleForm.code.trim()) return toast.error('Name and code required.');
    const payload: Record<string, unknown> = {
      structure_id: selectedId,
      name: ruleForm.name.trim(),
      code: ruleForm.code.trim().toUpperCase(),
      category: ruleForm.category,
      sequence: parseInt(ruleForm.sequence) || 10,
      calculation_type: ruleForm.calculation_type,
      is_active: true,
      appears_on_payslip: true,
    };
    if (ruleForm.calculation_type === 'fixed') {
      payload.fixed_amount = parseFloat(ruleForm.fixed_amount) || 0;
    } else if (ruleForm.calculation_type === 'percentage') {
      payload.percentage = parseFloat(ruleForm.percentage) || 0;
      payload.percentage_of = ruleForm.percentage_of.trim().toUpperCase();
    } else if (ruleForm.calculation_type === 'formula') {
      payload.formula = ruleForm.formula.trim();
    }
    createRuleMut.mutate(payload);
  };

  // ─── DETAIL VIEW (matches reference image 2) ───
  if (selected) {
    const sortedRules = [...(selected.rules || [])].sort((a, b) => a.sequence - b.sequence);

    return (
      <div className="space-y-6">
        {/* Back + Title */}
        <div>
          <button
            onClick={() => { setSelectedId(null); setEditingStruct(false); }}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-primary-600 mb-3 transition-base group"
          >
            <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Salary Structures</span>
          </button>

          <PageHeader
            title={`Salary Structure / ${selected.name}`}
            subtitle="Form view with its salary rules"
          />
        </div>

        {/* Structure Info Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Structure Name */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Structure Name</label>
              {editingStruct ? (
                <input
                  type="text"
                  value={editStructFields.name}
                  onChange={(e) => setEditStructFields({ ...editStructFields, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base"
                />
              ) : (
                <p className="text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                  {selected.name}
                </p>
              )}
            </div>

            {/* Active */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Active</label>
              {editingStruct ? (
                <select
                  value={editStructFields.is_active ? 'true' : 'false'}
                  onChange={(e) => setEditStructFields({ ...editStructFields, is_active: e.target.value === 'true' })}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <p className="text-sm font-semibold bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                  {selected.is_active ? (
                    <span className="text-emerald-600">Active</span>
                  ) : (
                    <span className="text-slate-400">Inactive</span>
                  )}
                </p>
              )}
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Type</label>
              <p className="text-sm font-semibold text-slate-900 bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                {getStructType(selected.name)}
              </p>
            </div>
          </div>

          {/* Edit / Save Buttons */}
          <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-100">
            {editingStruct ? (
              <>
                <button
                  onClick={() => updateStructMut.mutate(editStructFields)}
                  disabled={updateStructMut.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-base"
                >
                  <Save size={14} /> {updateStructMut.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingStruct(false);
                    setEditStructFields({
                      name: selected.name,
                      is_active: selected.is_active,
                      description: selected.description || '',
                    });
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-base"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditingStruct(true)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-base"
              >
                <Pencil size={14} /> Edit Structure
              </button>
            )}
          </div>
        </div>

        {/* Salary Rules Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-slate-900">Salary Rules</h3>
            <button
              onClick={() => setShowNewRuleModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 transition-base"
            >
              <Plus size={14} /> Add Rule
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            {sortedRules.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-5 py-3 font-medium text-slate-600 text-xs">Rule Name</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs">Code</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 text-xs">Sequence</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 text-xs w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRules.map((rule) => (
                    <tr
                      key={rule.id}
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition-base"
                    >
                      <td className="px-5 py-3 font-medium text-primary-700 cursor-pointer hover:text-primary-900" onClick={() => navigate(`/salary/rules/${rule.id}`)}>
                        {rule.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{rule.code}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                            categoryColors[rule.category.toUpperCase()] || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {rule.category.charAt(0).toUpperCase() + rule.category.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{rule.sequence}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => navigate(`/salary/rules/${rule.id}`)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-base"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Delete rule "${rule.name}"?`)) deleteRuleMut.mutate(rule.id); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-base"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-500">No rules configured yet.</p>
                <button
                  onClick={() => setShowNewRuleModal(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-base"
                >
                  <Plus size={14} /> Add First Rule
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Helpful notes */}
        <p className="text-xs text-slate-400 italic">
          Useful note: rule order matters. Keep sequence visible so participants understand the calculation order.
          Rules created here is just for reference.
        </p>
        <p className="text-xs text-slate-400 italic">
          Configured structure is selected when a Payrun is created.
        </p>

        {/* Add Rule Modal */}
        <Modal isOpen={showNewRuleModal} onClose={() => setShowNewRuleModal(false)} title={`Add Rule to "${selected.name}"`} size="lg">
          <form onSubmit={handleCreateRule} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rule Name *</label>
                <input required value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  placeholder="e.g. Basic Salary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Code *</label>
                <input required value={ruleForm.code} onChange={(e) => setRuleForm({ ...ruleForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  placeholder="e.g. BASIC" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <select value={ruleForm.category} onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
                  <option value="basic">Basic</option>
                  <option value="allowance">Allowance</option>
                  <option value="gross">Gross</option>
                  <option value="deduction">Deduction</option>
                  <option value="net">Net</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sequence</label>
                <input type="number" value={ruleForm.sequence} onChange={(e) => setRuleForm({ ...ruleForm, sequence: e.target.value })}
                  min={1} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Calculation Type</label>
              <select value={ruleForm.calculation_type} onChange={(e) => setRuleForm({ ...ruleForm, calculation_type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
                <option value="fixed">Fixed Amount</option>
                <option value="percentage">Percentage</option>
                <option value="formula">Formula</option>
              </select>
            </div>

            {ruleForm.calculation_type === 'fixed' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fixed Amount</label>
                <input type="number" value={ruleForm.fixed_amount} onChange={(e) => setRuleForm({ ...ruleForm, fixed_amount: e.target.value })}
                  step="0.01" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  placeholder="e.g. 50000" />
              </div>
            )}

            {ruleForm.calculation_type === 'percentage' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Percentage (%)</label>
                  <input type="number" value={ruleForm.percentage} onChange={(e) => setRuleForm({ ...ruleForm, percentage: e.target.value })}
                    step="0.01" min="0" max="100" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    placeholder="e.g. 20" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Percentage Of (Rule Code)</label>
                  <input type="text" value={ruleForm.percentage_of} onChange={(e) => setRuleForm({ ...ruleForm, percentage_of: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    placeholder="e.g. BASIC" />
                </div>
              </div>
            )}

            {ruleForm.calculation_type === 'formula' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Formula Expression</label>
                <textarea value={ruleForm.formula} onChange={(e) => setRuleForm({ ...ruleForm, formula: e.target.value })} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                  placeholder="e.g. GROSS - PF - PT" />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setShowNewRuleModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-base">Cancel</button>
              <button type="submit" disabled={createRuleMut.isPending}
                className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-base">
                {createRuleMut.isPending ? 'Adding...' : 'Add Rule'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ─── LIST VIEW (matches reference image 1) ───
  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Structures"
        subtitle="List view"
        action={
          <button
            onClick={() => setShowNewStructureModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base"
          >
            <Plus size={16} /> NEW
          </button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search structures..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-base"
        />
      </div>

      {/* Structures Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center"><Loader2 size={32} className="animate-spin text-primary-500 mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No salary structures found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 font-medium text-slate-600">Structure Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Rules</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Employees</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Active</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((struct) => (
                <tr
                  key={struct.id}
                  onClick={() => setSelectedId(struct.id)}
                  className="border-b border-slate-100 hover:bg-slate-50/50 transition-base cursor-pointer group"
                >
                  <td className="px-6 py-4 font-medium text-primary-700 group-hover:text-primary-800">{struct.name}</td>
                  <td className="px-4 py-4 text-slate-600">{struct.rules?.length || 0} rules</td>
                  <td className="px-4 py-4 text-slate-600">{struct.employee_count} employees</td>
                  <td className="px-4 py-4">
                    {struct.is_active ? (
                      <span className="text-emerald-600 font-medium">Active</span>
                    ) : (
                      <span className="text-slate-400">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Helpful notes */}
      <p className="text-xs text-slate-400 italic">
        Structures group salary rules; rules define the ordered salary computation used by a payslip. Both require List and Form views.
      </p>
      <p className="text-xs text-slate-400 italic">
        Useful note: the Salary Structure selected on a Payrun determines which set of salary rules will calculate each payslip.
      </p>

      {/* New Structure Modal */}
      <Modal isOpen={showNewStructureModal} onClose={() => setShowNewStructureModal(false)} title="New Salary Structure">
        <form onSubmit={(e) => { e.preventDefault(); createStructMut.mutate(structForm); }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input required value={structForm.name} onChange={(e) => setStructForm({ ...structForm, name: e.target.value })}
              placeholder="e.g. Regular Salary, Intern Salary, Contractor"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Code *</label>
            <input required value={structForm.code} onChange={(e) => setStructForm({ ...structForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. STD_MONTHLY, INTERN, CONTRACTOR"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={structForm.description} onChange={(e) => setStructForm({ ...structForm, description: e.target.value })} rows={3}
              placeholder="Describe the employee type this structure applies to..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setShowNewStructureModal(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-base">Cancel</button>
            <button type="submit" disabled={createStructMut.isPending}
              className="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-base">
              {createStructMut.isPending ? 'Creating...' : 'Create Structure'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
