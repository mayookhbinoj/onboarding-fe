import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Save, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Lock, Settings, FileText, Users } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }, { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' }, { value: 'date', label: 'Date' }, { value: 'dropdown', label: 'Dropdown' },
  { value: 'textarea', label: 'Text Area' }, { value: 'checkbox', label: 'Checkbox' },
];

function SortableFieldItem({ field, idx, customFields, updateField, removeField, moveField, FIELD_TYPES }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : 'auto' };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 p-4 border rounded-xl bg-white shadow-sm" data-testid={`field-${idx}`}>
      <div className="flex flex-col gap-0.5 pt-2">
        <button type="button" onClick={() => moveField(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing"><GripVertical className="w-4 h-4 text-muted-foreground/30 mx-auto" /></div>
        <button type="button" onClick={() => moveField(idx, 1)} disabled={idx === customFields.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1"><Label className="text-xs font-medium">Field Label</Label><Input value={field.label} onChange={e => updateField(idx, 'label', e.target.value)} placeholder="e.g., Territory" className="h-9" /></div>
          <div className="space-y-1"><Label className="text-xs font-medium">Type</Label><Select value={field.type} onValueChange={v => updateField(idx, 'type', v)}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Placeholder</Label><Input value={field.placeholder || ''} onChange={e => updateField(idx, 'placeholder', e.target.value)} placeholder="Hint text" className="h-8 text-xs" /></div>
          {field.type === 'dropdown' && <div className="space-y-1"><Label className="text-xs text-muted-foreground">Options (comma-separated)</Label><Input value={field.options || ''} onChange={e => updateField(idx, 'options', e.target.value)} placeholder="Option 1, Option 2" className="h-8 text-xs" /></div>}
        </div>
        <div className="flex items-center gap-4 pt-1">
          <div className="flex items-center gap-2"><Switch checked={field.required || false} onCheckedChange={v => updateField(idx, 'required', v)} id={`req-${field.id}`} /><label htmlFor={`req-${field.id}`} className="text-xs cursor-pointer">{field.required ? <Badge className="text-[9px] bg-red-100 text-red-700">Mandatory</Badge> : <Badge variant="secondary" className="text-[9px]">Optional</Badge>}</label></div>
          <Badge variant="outline" className="text-[9px]">{FIELD_TYPES.find(t => t.value === field.type)?.label || field.type}</Badge>
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 mt-1" onClick={() => removeField(idx)}><Trash2 className="w-4 h-4" /></Button>
    </div>
  );
}

// Standard onboarding form fields — shown as read-only reference
const STANDARD_FIELDS = [
  { id: 'company_name', label: 'Company / Organization Name', defaultRequired: true },
  { id: 'trade_name', label: 'Trade Name', defaultRequired: true },
  { id: 'business_type', label: 'Business Type', defaultRequired: true },
  { id: 'gstin', label: 'GSTIN', defaultRequired: true },
  { id: 'pan', label: 'PAN', defaultRequired: true },
  { id: 'aadhaar_1', label: 'Aadhaar Number', defaultRequired: false },
  { id: 'contact_person_name', label: 'Contact Person Name', defaultRequired: true },
  { id: 'job_role', label: 'Job Role', defaultRequired: true },
  { id: 'phone', label: 'Phone Number', defaultRequired: true },
  { id: 'email', label: 'Email Address', defaultRequired: true },
  { id: 'registered_address', label: 'Registered Address', defaultRequired: true },
  { id: 'communication_address', label: 'Communication Address', defaultRequired: true },
  { id: 'country', label: 'Country', defaultRequired: true },
  { id: 'state', label: 'State', defaultRequired: true },
  { id: 'city', label: 'City', defaultRequired: true },
  { id: 'pincode', label: 'Pincode', defaultRequired: true },
  { id: 'expected_studies_per_month', label: 'Expected Studies per Month', defaultRequired: true },
  { id: 'signatory_name', label: 'Authorized Signatory Name', defaultRequired: true },
];

export default function FormEditor() {
  const { inviteId } = useParams();
  const { api, user } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [stdConfig, setStdConfig] = useState({});
  const [partnerConfig, setPartnerConfig] = useState({ enabled: false, min_partners: 0, max_partners: 20, pre_filled: [], locked_fields: [] });
  const [expandedPrefill, setExpandedPrefill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canEditStd = user?.role === 'super_admin' || user?.role === 'marketing_admin';

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/invites/${inviteId}/custom-fields`);
        setCustomFields(res.data.fields || []);
        setInvite(res.data.invite || null);
        const sc = res.data.invite?.standard_field_config || {};
        setStdConfig(sc);
        const pc = res.data.partner_config || res.data.invite?.partner_config || {};
        if (pc.enabled !== undefined) setPartnerConfig(prev => ({ ...prev, ...pc }));
      } catch { toast.error('Failed to load invite'); navigate('/admin/manage-invites'); }
      setLoading(false);
    })();
  }, [inviteId, api, navigate]);

  const addField = () => {
    setCustomFields(prev => [...prev, { id: `field_${Date.now()}`, label: '', type: 'text', placeholder: '', required: false, options: '' }]);
  };

  const updateField = (idx, key, value) => {
    setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: value } : f));
  };

  const removeField = (idx) => setCustomFields(prev => prev.filter((_, i) => i !== idx));

  const moveField = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= customFields.length) return;
    setCustomFields(prev => { const arr = [...prev]; [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]; return arr; });
  };

  const saveFields = async () => {
    for (const f of customFields) {
      if (!f.label.trim()) { toast.error('All fields need a label'); return; }
    }
    setSaving(true);
    try {
      await api.put(`/api/invites/${inviteId}/custom-fields`, { fields: customFields, standard_field_config: stdConfig, partner_config: partnerConfig });
      toast.success('Form fields saved. Super Admin & Compliance Admin notified.');
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
    setSaving(false);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = customFields.findIndex(f => f.id === active.id);
      const newIndex = customFields.findIndex(f => f.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) setCustomFields(arrayMove(customFields, oldIndex, newIndex));
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="form-editor-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/manage-invites')}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Customize Form</h1>
          {invite && <p className="text-sm text-muted-foreground">{invite.first_name} {invite.last_name} — {invite.email}</p>}
        </div>
        <Button onClick={saveFields} disabled={saving} className="gap-1.5"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}</Button>
      </div>

      {/* Standard Fields — toggle on/off + mandatory */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /> Standard Fields</CardTitle>
          {canEditStd ? <p className="text-[10px] text-muted-foreground mt-1">Toggle fields on/off and set mandatory status per invite link.</p> : <p className="text-[10px] text-muted-foreground mt-1">Standard fields shown on the form. Contact Super Admin or Marketing Admin to customize.</p>}
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {STANDARD_FIELDS.map(f => {
              const cfg = stdConfig[f.id] || {};
              const enabled = cfg.enabled !== undefined ? cfg.enabled : true;
              const required = cfg.required !== undefined ? cfg.required : f.defaultRequired;
              return (
                <div key={f.id} className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${enabled ? 'bg-muted/30' : 'bg-muted/10 opacity-50'}`}>
                  {canEditStd && (
                    <Switch checked={enabled} onCheckedChange={v => setStdConfig(prev => ({ ...prev, [f.id]: { ...prev[f.id], enabled: v, required: v ? (prev[f.id]?.required ?? f.defaultRequired) : false } }))} />
                  )}
                  <span className={`flex-1 text-sm ${enabled ? '' : 'line-through text-muted-foreground'}`}>{f.label}</span>
                  {enabled && canEditStd ? (
                    <button onClick={() => setStdConfig(prev => ({ ...prev, [f.id]: { ...prev[f.id], enabled: true, required: !(prev[f.id]?.required ?? f.defaultRequired) } }))}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${required ? 'bg-red-100 text-red-700 border-red-300' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>
                      {required ? 'Mandatory' : 'Optional'}
                    </button>
                  ) : enabled ? (
                    <Badge className={`text-[9px] ${required ? 'bg-red-100 text-red-700 border-red-300' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>{required ? 'Mandatory' : 'Optional'}</Badge>
                  ) : null}
                  {!canEditStd && <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-gray-300'}`} />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Partner Configuration */}
      <Card className="border-orange-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-orange-600" /> Partner Configuration</CardTitle>
            <Switch checked={partnerConfig.enabled} onCheckedChange={v => setPartnerConfig(prev => ({ ...prev, enabled: v }))} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{partnerConfig.enabled ? 'Partner section will appear on the form. Pre-fill partners and lock fields below.' : 'Partner section disabled for this invite link.'}</p>
        </CardHeader>
        {partnerConfig.enabled && (
          <CardContent className="space-y-4">
            {/* Min/Max */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Minimum Partners Required</Label><Input type="number" min="0" max="50" value={partnerConfig.min_partners} onChange={e => setPartnerConfig(prev => ({ ...prev, min_partners: parseInt(e.target.value) || 0 }))} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Maximum Partners Allowed</Label><Input type="number" min="1" max="50" value={partnerConfig.max_partners} onChange={e => setPartnerConfig(prev => ({ ...prev, max_partners: parseInt(e.target.value) || 20 }))} className="h-8 text-xs" /></div>
            </div>

            {/* Locked Fields */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Lock Fields (read-only for recipient)</Label>
              <div className="flex flex-wrap gap-1.5">
                {['full_name', 'din', 'pan', 'aadhaar', 'email', 'phone', 'designation', 'share_pct'].map(f => (
                  <button key={f} type="button" onClick={() => setPartnerConfig(prev => ({ ...prev, locked_fields: prev.locked_fields?.includes(f) ? prev.locked_fields.filter(x => x !== f) : [...(prev.locked_fields || []), f] }))} className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${partnerConfig.locked_fields?.includes(f) ? 'bg-orange-100 text-orange-700 border-orange-300' : 'bg-muted/50 text-muted-foreground border-border'}`}>
                    {f === 'full_name' ? 'Name' : f === 'share_pct' ? 'Share %' : f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} {partnerConfig.locked_fields?.includes(f) ? <Lock className="w-2.5 h-2.5 inline ml-0.5" /> : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Pre-filled Partners */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Pre-filled Partners ({partnerConfig.pre_filled?.length || 0})</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setPartnerConfig(prev => ({ ...prev, pre_filled: [...(prev.pre_filled || []), { id: `pf_${Date.now()}`, full_name: '', din: '', pan: '', aadhaar: '', email: '', phone: '', designation: '', share_pct: '' }] }))}><Plus className="w-3 h-3" /> Add</Button>
              </div>
              {(partnerConfig.pre_filled || []).length === 0 && <p className="text-[10px] text-muted-foreground py-2">No pre-filled partners. The recipient will add their own.</p>}
              {(partnerConfig.pre_filled || []).map((pf, idx) => (
                <div key={pf.id} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50/50 cursor-pointer" onClick={() => setExpandedPrefill(expandedPrefill === idx ? null : idx)}>
                    <span className="text-[10px] font-semibold text-orange-700 w-16">Partner {idx + 1}</span>
                    <span className="text-xs flex-1 truncate">{pf.full_name || 'Unnamed'}</span>
                    {pf.share_pct && <Badge variant="secondary" className="text-[8px]">{pf.share_pct}%</Badge>}
                    <button type="button" onClick={e => { e.stopPropagation(); setPartnerConfig(prev => ({ ...prev, pre_filled: prev.pre_filled.filter((_, i) => i !== idx) })); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                    {expandedPrefill === idx ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                  {expandedPrefill === idx && (
                    <div className="p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-[10px]">Full Name</Label><Input value={pf.full_name} onChange={e => { const arr = [...partnerConfig.pre_filled]; arr[idx] = { ...arr[idx], full_name: e.target.value }; setPartnerConfig(prev => ({ ...prev, pre_filled: arr })); }} className="h-7 text-xs" /></div>
                        <div><Label className="text-[10px]">Designation</Label><Input value={pf.designation} onChange={e => { const arr = [...partnerConfig.pre_filled]; arr[idx] = { ...arr[idx], designation: e.target.value }; setPartnerConfig(prev => ({ ...prev, pre_filled: arr })); }} className="h-7 text-xs" placeholder="e.g., Partner" /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div><Label className="text-[10px]">DIN</Label><Input value={pf.din} onChange={e => { const arr = [...partnerConfig.pre_filled]; arr[idx] = { ...arr[idx], din: e.target.value }; setPartnerConfig(prev => ({ ...prev, pre_filled: arr })); }} className="h-7 text-xs" /></div>
                        <div><Label className="text-[10px]">PAN</Label><Input value={pf.pan} onChange={e => { const arr = [...partnerConfig.pre_filled]; arr[idx] = { ...arr[idx], pan: e.target.value.toUpperCase() }; setPartnerConfig(prev => ({ ...prev, pre_filled: arr })); }} className="h-7 text-xs" maxLength={10} /></div>
                        <div><Label className="text-[10px]">Share %</Label><Input type="number" value={pf.share_pct} onChange={e => { const arr = [...partnerConfig.pre_filled]; arr[idx] = { ...arr[idx], share_pct: e.target.value }; setPartnerConfig(prev => ({ ...prev, pre_filled: arr })); }} className="h-7 text-xs" min="0" max="100" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><Label className="text-[10px]">Email</Label><Input value={pf.email} onChange={e => { const arr = [...partnerConfig.pre_filled]; arr[idx] = { ...arr[idx], email: e.target.value }; setPartnerConfig(prev => ({ ...prev, pre_filled: arr })); }} className="h-7 text-xs" /></div>
                        <div><Label className="text-[10px]">Phone</Label><Input value={pf.phone} onChange={e => { const arr = [...partnerConfig.pre_filled]; arr[idx] = { ...arr[idx], phone: e.target.value }; setPartnerConfig(prev => ({ ...prev, pre_filled: arr })); }} className="h-7 text-xs" /></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Custom Fields Editor */}
      <Card className="border-indigo-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Settings className="w-4 h-4 text-indigo-600" /> Custom Fields ({customFields.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={addField} className="gap-1.5 text-xs"><Plus className="w-3.5 h-3.5" /> Add Field</Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">These fields are added to the onboarding form for this specific invite link only.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {customFields.length === 0 && (
            <div className="py-8 text-center border-2 border-dashed rounded-xl">
              <Settings className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No custom fields</p>
              <p className="text-xs text-muted-foreground/70">Click "Add Field" to add custom questions to this form</p>
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={customFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
          {customFields.map((field, idx) => (
            <SortableFieldItem key={field.id} field={field} idx={idx} customFields={customFields}
              updateField={updateField} removeField={removeField} moveField={moveField}
              FIELD_TYPES={FIELD_TYPES} />
          ))}
          </SortableContext>
          </DndContext>

          {customFields.length > 0 && (
            <Button variant="outline" size="sm" onClick={addField} className="w-full gap-1.5 border-dashed"><Plus className="w-3.5 h-3.5" /> Add Another Field</Button>
          )}
        </CardContent>
      </Card>

      {/* Save bar */}
      {customFields.length > 0 && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={saveFields} disabled={saving} className="gap-1.5 shadow-lg"><Save className="w-4 h-4" /> {saving ? 'Saving...' : `Save ${customFields.length} Field(s)`}</Button>
        </div>
      )}
    </div>
  );
}
