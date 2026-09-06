/**
 * PeoplePay585 — Time Off Type Detail / Configuration Page
 * Full configuration view with edit mode, color picker, and all required fields.
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Save, X, ArrowLeft, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import PageHeader from '../components/ui/PageHeader';

// Predefined color palette for the color picker
const COLOR_PALETTE = [
  { name: 'Blue',    hex: '#3B82F6' },
  { name: 'Indigo',  hex: '#6366F1' },
  { name: 'Purple',  hex: '#8B5CF6' },
  { name: 'Pink',    hex: '#EC4899' },
  { name: 'Rose',    hex: '#F43F5E' },
  { name: 'Red',     hex: '#EF4444' },
  { name: 'Orange',  hex: '#F97316' },
  { name: 'Amber',   hex: '#F59E0B' },
  { name: 'Yellow',  hex: '#EAB308' },
  { name: 'Lime',    hex: '#84CC16' },
  { name: 'Green',   hex: '#22C55E' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Teal',    hex: '#14B8A6' },
  { name: 'Cyan',    hex: '#06B6D4' },
  { name: 'Sky',     hex: '#0EA5E9' },
  { name: 'Slate',   hex: '#64748B' },
];

function getColorName(hex: string | null | undefined): string {
  if (!hex) return 'None';
  const found = COLOR_PALETTE.find(c => c.hex.toLowerCase() === hex.toLowerCase());
  return found ? found.name : hex;
}

function getColorHex(val: string | null | undefined): string {
  if (!val) return '#3B82F6';
  // If it's already a hex code
  if (val.startsWith('#')) return val;
  // Check if it's a named color from palette
  const found = COLOR_PALETTE.find(c => c.name.toLowerCase() === val.toLowerCase());
  return found ? found.hex : '#3B82F6';
}

interface TimeOffTypeData {
  id: number;
  name: string;
  code: string;
  is_paid: boolean;
  color: string | null;
  unit: string;
  requires_allocation: boolean;
  is_active: boolean;
  approval: string;
  work_entry_type: string | null;
  configuration_notes: string | null;
  created_at: string;
}

export default function TimeOffTypeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !id || id === 'new';

  const [isEditing, setIsEditing] = useState(isNew);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    name: '',
    code: '',
    is_paid: true,
    color: '#3B82F6',
    unit: 'DAYS',
    requires_allocation: true,
    is_active: true,
    approval: 'Manager',
    work_entry_type: '',
    configuration_notes: '',
  });

  const { data: typeData, isLoading, isError } = useQuery<TimeOffTypeData>({
    queryKey: ['timeoff-type', id],
    queryFn: async () => {
      if (isNew) return null as any;
      const res = await api.get(`/timeoff/types/${id}`);
      return res.data;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (typeData) {
      setForm({
        name: typeData.name || '',
        code: typeData.code || '',
        is_paid: typeData.is_paid ?? true,
        color: typeData.color || '#3B82F6',
        unit: (typeData.unit || 'DAYS').toUpperCase(),
        requires_allocation: typeData.requires_allocation ?? true,
        is_active: typeData.is_active ?? true,
        approval: typeData.approval || 'Manager',
        work_entry_type: typeData.work_entry_type || '',
        configuration_notes: typeData.configuration_notes || '',
      });
    }
  }, [typeData]);

  // Close color picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      if (isNew) {
        return await api.post('/timeoff/types', data);
      } else {
        return await api.put(`/timeoff/types/${id}`, data);
      }
    },
    onSuccess: (res) => {
      toast.success(isNew ? 'Time Off Type created' : 'Time Off Type updated');
      qc.invalidateQueries({ queryKey: ['timeoff-types'] });
      qc.invalidateQueries({ queryKey: ['timeoff-type', id] });
      setIsEditing(false);
      if (isNew) {
        navigate(`/timeoff/types/${res.data.id}`);
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to save'),
  });

  const deleteMut = useMutation({
    mutationFn: async () => await api.delete(`/timeoff/types/${id}`),
    onSuccess: () => {
      toast.success('Time Off Type deleted');
      qc.invalidateQueries({ queryKey: ['timeoff-types'] });
      navigate('/timeoff/types');
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to delete'),
  });

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error('Type Name is required');
      return;
    }
    if (!form.code.trim()) {
      toast.error('Code is required');
      return;
    }
    if (!['DAYS', 'HOURS'].includes(form.unit)) {
      toast.error('Unit must be Days or Hours');
      return;
    }

    saveMut.mutate({
      name: form.name.trim(),
      code: form.code.trim(),
      is_paid: form.is_paid,
      color: form.color,
      unit: form.unit,
      requires_allocation: form.requires_allocation,
      is_active: form.is_active,
      approval: form.approval,
      work_entry_type: form.work_entry_type || null,
      configuration_notes: form.configuration_notes || null,
    });
  };

  const handleCancel = () => {
    if (isNew) {
      navigate('/timeoff/types');
      return;
    }
    // Reset form to original data
    if (typeData) {
      setForm({
        name: typeData.name || '',
        code: typeData.code || '',
        is_paid: typeData.is_paid ?? true,
        color: typeData.color || '#3B82F6',
        unit: (typeData.unit || 'DAYS').toUpperCase(),
        requires_allocation: typeData.requires_allocation ?? true,
        is_active: typeData.is_active ?? true,
        approval: typeData.approval || 'Manager',
        work_entry_type: typeData.work_entry_type || '',
        configuration_notes: typeData.configuration_notes || '',
      });
    }
    setIsEditing(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Error / not found
  if (!isNew && (isError || !typeData)) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/timeoff/types')}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-base"
        >
          <ArrowLeft size={16} /> Back to Leave Types
        </button>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <h2 className="text-xl font-semibold text-slate-900">Time Off Type Not Found</h2>
          <p className="text-sm text-slate-500 mt-2">The requested time off type does not exist or could not be loaded.</p>
        </div>
      </div>
    );
  }

  const displayUnit = form.unit === 'HOURS' ? 'Hours' : 'Days';

  // Read-only value display component
  const ReadOnlyField = ({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
      {children || (
        <div className="px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50/50 text-sm text-slate-900 font-medium min-h-[40px] flex items-center">
          {value || <span className="text-slate-400 italic">—</span>}
        </div>
      )}
    </div>
  );

  // Edit field component
  const EditField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );

  const inputClass = "w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all bg-white";
  const selectClass = inputClass;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/timeoff/types')}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-base"
      >
        <ArrowLeft size={16} /> Back to Leave Types
      </button>

      {/* Page Header */}
      <PageHeader
        title={isNew ? 'New Time Off Type' : `Time Off Type / ${typeData?.name}`}
        subtitle={isNew ? 'Create a new time off type configuration' : 'Form view of one time off type'}
        action={
          <div className="flex items-center gap-3">
            {!isNew && !isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => { if (confirm('Are you sure you want to delete this time off type?')) deleteMut.mutate() }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-base"
                >
                  <Trash2 size={16} /> Delete
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base"
                >
                  <Pencil size={16} /> Edit
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-base"
                >
                  <X size={16} /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveMut.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-lg shadow-primary-600/20 transition-base disabled:opacity-50"
                >
                  <Save size={16} /> {isNew ? 'Create Type' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Main Configuration Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">

            {/* ─── LEFT COLUMN ─── */}
            <div className="space-y-6">
              {/* Type Name */}
              {isEditing ? (
                <EditField label="Type Name">
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. Paid Time Off"
                  />
                </EditField>
              ) : (
                <ReadOnlyField label="Type Name" value={form.name} />
              )}

              {/* Code */}
              {isEditing ? (
                <EditField label="Code">
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. PTO"
                  />
                </EditField>
              ) : (
                <ReadOnlyField label="Code" value={form.code} />
              )}

              {/* Unit */}
              {isEditing ? (
                <EditField label="Unit">
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className={selectClass}
                  >
                    <option value="DAYS">Days</option>
                    <option value="HOURS">Hours</option>
                  </select>
                </EditField>
              ) : (
                <ReadOnlyField label="Unit" value={displayUnit} />
              )}

              {/* Requires Allocation */}
              {isEditing ? (
                <EditField label="Requires Allocation">
                  <select
                    value={form.requires_allocation ? 'true' : 'false'}
                    onChange={(e) => setForm({ ...form, requires_allocation: e.target.value === 'true' })}
                    className={selectClass}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </EditField>
              ) : (
                <ReadOnlyField label="Requires Allocation" value={form.requires_allocation ? 'Yes' : 'No'} />
              )}

              {/* Active */}
              {isEditing ? (
                <EditField label="Active">
                  <select
                    value={form.is_active ? 'true' : 'false'}
                    onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}
                    className={selectClass}
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </EditField>
              ) : (
                <ReadOnlyField label="Active">
                  <div className="px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50/50 text-sm font-medium min-h-[40px] flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${form.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <span className={form.is_active ? 'text-emerald-700' : 'text-slate-500'}>{form.is_active ? 'True' : 'False'}</span>
                  </div>
                </ReadOnlyField>
              )}
            </div>

            {/* ─── RIGHT COLUMN ─── */}
            <div className="space-y-6">
              {/* Approval */}
              {isEditing ? (
                <EditField label="Approval">
                  <select
                    value={form.approval}
                    onChange={(e) => setForm({ ...form, approval: e.target.value })}
                    className={selectClass}
                  >
                    <option value="Manager">Manager</option>
                    <option value="Officer">Officer</option>
                    <option value="No Validation">No Validation</option>
                  </select>
                </EditField>
              ) : (
                <ReadOnlyField label="Approval" value={form.approval} />
              )}

              {/* Payroll / Work Entry */}
              {isEditing ? (
                <EditField label="Payroll / Work Entry">
                  <input
                    type="text"
                    value={form.work_entry_type}
                    onChange={(e) => setForm({ ...form, work_entry_type: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. Leave Work Entry"
                  />
                </EditField>
              ) : (
                <ReadOnlyField label="Payroll / Work Entry" value={form.work_entry_type || '—'} />
              )}

              {/* Display Color */}
              {isEditing ? (
                <EditField label="Display Color">
                  <div className="relative" ref={colorPickerRef}>
                    <button
                      type="button"
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all bg-white flex items-center gap-3 text-left hover:border-slate-300"
                    >
                      <span
                        className="w-5 h-5 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                        style={{ backgroundColor: getColorHex(form.color) }}
                      />
                      <span className="text-slate-900 font-medium">{getColorName(form.color)}</span>
                    </button>

                    {showColorPicker && (
                      <div className="absolute top-full left-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl p-4 z-50 w-72">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Select Color</p>
                        <div className="grid grid-cols-8 gap-2 mb-4">
                          {COLOR_PALETTE.map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              onClick={() => {
                                setForm({ ...form, color: c.hex });
                                setShowColorPicker(false);
                              }}
                              className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                                form.color === c.hex
                                  ? 'border-slate-900 ring-2 ring-slate-900/20 scale-110'
                                  : 'border-white shadow-sm hover:border-slate-300'
                              }`}
                              style={{ backgroundColor: c.hex }}
                              title={c.name}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                          <label className="text-xs text-slate-500 font-medium">Custom:</label>
                          <input
                            type="color"
                            value={getColorHex(form.color)}
                            onChange={(e) => setForm({ ...form, color: e.target.value })}
                            className="w-8 h-8 rounded cursor-pointer border border-slate-200"
                          />
                          <input
                            type="text"
                            value={form.color}
                            onChange={(e) => setForm({ ...form, color: e.target.value })}
                            className="flex-1 px-2 py-1 rounded border border-slate-200 text-xs font-mono"
                            placeholder="#3B82F6"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </EditField>
              ) : (
                <ReadOnlyField label="Display Color">
                  <div className="px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50/50 text-sm font-medium min-h-[40px] flex items-center gap-3">
                    <span
                      className="w-5 h-5 rounded-full border-2 border-white shadow-sm flex-shrink-0"
                      style={{ backgroundColor: getColorHex(form.color) }}
                    />
                    <span className="text-slate-900">{getColorName(form.color)}</span>
                  </div>
                </ReadOnlyField>
              )}

              {/* Is Paid */}
              {isEditing ? (
                <EditField label="Is Paid">
                  <select
                    value={form.is_paid ? 'true' : 'false'}
                    onChange={(e) => setForm({ ...form, is_paid: e.target.value === 'true' })}
                    className={selectClass}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </EditField>
              ) : (
                <ReadOnlyField label="Is Paid" value={form.is_paid ? 'Yes' : 'No'} />
              )}
            </div>
          </div>
        </div>

        {/* Configuration Notes Section */}
        <div className="border-t border-slate-200 p-6 md:p-8">
          {isEditing ? (
            <EditField label="Configuration Notes">
              <textarea
                value={form.configuration_notes}
                onChange={(e) => setForm({ ...form, configuration_notes: e.target.value })}
                rows={4}
                className={`${inputClass} resize-none`}
                placeholder="Add any notes about this time off type configuration..."
              />
            </EditField>
          ) : (
            <ReadOnlyField label="Configuration Notes">
              <div className="px-4 py-3 rounded-lg border border-slate-200 bg-slate-50/50 text-sm text-slate-700 min-h-[80px] whitespace-pre-wrap leading-relaxed">
                {form.configuration_notes || <span className="text-slate-400 italic">No configuration notes</span>}
              </div>
            </ReadOnlyField>
          )}
        </div>

        {/* Info Footer */}
        {!isNew && !isEditing && (
          <div className="border-t border-slate-100 px-6 md:px-8 py-4 bg-slate-50/50">
            <p className="text-xs text-slate-400">
              Time Off Type drives approval behavior and whether a request needs an allocation. 
              Created {typeData?.created_at ? new Date(typeData.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
