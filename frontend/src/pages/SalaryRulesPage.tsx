/**
 * PeoplePay585 — Salary Rules Page
 * List view with search + structure filter. Matches HRMS OXP reference.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, ChevronRight, Filter } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';

interface SalaryRule {
  id: number;
  structure_id: number;
  structure_name: string;
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
}

interface SalaryStructure {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
}

const categoryColors: Record<string, string> = {
  basic: 'bg-blue-100 text-blue-700',
  allowance: 'bg-emerald-100 text-emerald-700',
  gross: 'bg-amber-100 text-amber-700',
  deduction: 'bg-rose-100 text-rose-700',
  net: 'bg-violet-100 text-violet-700',
};

const calcTypeLabels: Record<string, string> = {
  fixed: 'Fixed Amount',
  percentage: 'Percentage',
  formula: 'Formula',
};

export default function SalaryRulesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [structureFilter, setStructureFilter] = useState<string>('');

  const { data: rules = [], isLoading } = useQuery<SalaryRule[]>({
    queryKey: ['salary-rules'],
    queryFn: async () => (await api.get('/salary/rules')).data,
  });

  const { data: structures = [] } = useQuery<SalaryStructure[]>({
    queryKey: ['salary-structures'],
    queryFn: async () => (await api.get('/salary/structures')).data,
  });

  const filteredRules = useMemo(() => {
    let result = rules;
    if (structureFilter) {
      result = result.filter((r) => r.structure_id === parseInt(structureFilter));
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(term) ||
          r.code.toLowerCase().includes(term) ||
          r.category.toLowerCase().includes(term) ||
          r.structure_name.toLowerCase().includes(term)
      );
    }
    return result;
  }, [rules, search, structureFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Rules"
        subtitle="List view"
        action={
          <button
            onClick={() => navigate('/salary/rules/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base"
          >
            <Plus size={16} /> New
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search salary rules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base"
          />
        </div>

        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <select
            value={structureFilter}
            onChange={(e) => setStructureFilter(e.target.value)}
            className="pl-8 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-base"
          >
            <option value="">All Structures</option>
            {structures.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-500 text-sm">
              {search || structureFilter ? 'No salary rules match your filters.' : 'No salary rules found. Click New to create one.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Rule Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Structure</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Computation</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Sequence</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-600">Active</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => (
                  <tr
                    key={rule.id}
                    onClick={() => navigate(`/salary/rules/${rule.id}`)}
                    className="border-b border-slate-100 hover:bg-primary-50/40 cursor-pointer transition-base group"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900 group-hover:text-primary-700 transition-colors">
                        {rule.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono text-slate-700">
                        {rule.code}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          categoryColors[rule.category.toLowerCase()] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {rule.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{rule.structure_name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {calcTypeLabels[rule.calculation_type] || rule.calculation_type}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                        {rule.sequence}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex w-2.5 h-2.5 rounded-full ${rule.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
