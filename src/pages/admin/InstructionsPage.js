import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion';
import { Checkbox } from '../../components/ui/checkbox';
import { Skeleton } from '../../components/ui/skeleton';
import { toast } from 'sonner';
import {
  Users, UserPlus, FileText, ShieldCheck, Truck, Package, Cpu, FlaskConical, DollarSign,
  MessageCircle, Bell, Settings, LayoutDashboard, CheckCircle, ChevronDown, Zap, Lock, Globe,
  BookOpen, Workflow, Pencil, Save, Plus, Trash2, X, GripVertical, Eye
} from 'lucide-react';

const ICON_MAP = {
  LayoutDashboard, Users, UserPlus, FileText, ShieldCheck, Truck, Package, Cpu, FlaskConical,
  DollarSign, MessageCircle, Bell, Settings, Lock, Globe, Zap, BookOpen, Workflow
};
const getIcon = (name) => ICON_MAP[name] || LayoutDashboard;

const GUIDE_COLORS = {
  'dashboard.png': ['#3b82f6','#dbeafe'], 'business_associates.png': ['#0ea5e9','#e0f2fe'],
  'create_invite.png': ['#10b981','#d1fae5'], 'compliance.png': ['#8b5cf6','#ede9fe'],
  'finance.png': ['#f59e0b','#fef3c7'], 'ship_status.png': ['#06b6d4','#cffafe'],
  'device_inventory.png': ['#f97316','#ffedd5'], 'qc_test.png': ['#ec4899','#fce7f3'],
  'messages.png': ['#6366f1','#e0e7ff'], 'templates.png': ['#14b8a6','#ccfbf1'],
};

const ALL_ROLES = ['super_admin','marketing_admin','marketing_associate','compliance_admin','inventory_admin','finance_admin','qcqa_tester'];
const ROLE_LABELS = {
  super_admin: 'Super Admin', marketing_admin: 'Marketing Admin', marketing_associate: 'Marketing Assoc.',
  compliance_admin: 'Compliance', inventory_admin: 'Inventory', finance_admin: 'Finance', qcqa_tester: 'QC/QA',
};

// ── Guide Card ──
function ScreenGuide({ guide, iconName }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = getIcon(iconName);
  const [iconColor, bgColor] = GUIDE_COLORS[guide.image] || ['#3b82f6','#dbeafe'];

  return (
    <Card className={`overflow-hidden transition-all duration-200 cursor-pointer animate-row-in ${expanded ? 'shadow-lg ring-1 ring-primary/20' : 'hover:shadow-md'}`} onClick={() => setExpanded(!expanded)}>
      <div className="relative h-28 flex items-center justify-center overflow-hidden" style={{ background: `linear-gradient(135deg, ${bgColor}, white)` }}>
        <Icon className="w-14 h-14 opacity-10 absolute -right-2 -top-2" style={{ color: iconColor }} />
        <div className="relative z-10 flex flex-col items-center gap-1.5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${iconColor}, ${iconColor}cc)` }}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        <p className="absolute bottom-2 inset-x-0 text-center text-sm font-semibold" style={{ color: iconColor }}>{guide.title}</p>
      </div>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{guide.description}</p>
        {!expanded && guide.steps?.length > 0 && (
          <div className="flex items-center gap-2 text-[10px] text-primary"><ChevronDown className="w-3 h-3" /><span>{guide.steps.length} steps — click to expand</span></div>
        )}
        {expanded && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {guide.steps?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Step-by-step</p>
                <div className="space-y-1.5">
                  {guide.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 p-1.5 rounded bg-muted/30">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: iconColor }}>{i+1}</div>
                      <p className="text-xs leading-relaxed pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {guide.tips && (
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-[11px] text-amber-800 flex items-start gap-1.5"><Zap className="w-3.5 h-3.5 shrink-0 text-amber-500 mt-0.5" /><span><strong>Pro Tip:</strong> {guide.tips}</span></p>
              </div>
            )}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1 cursor-pointer"><ChevronDown className="w-3 h-3 rotate-180" /><span>Click to collapse</span></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Edit Guide Card ──
function EditGuideCard({ guide, onChange, onRemove }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Input value={guide.title} onChange={e => onChange({...guide, title: e.target.value})} placeholder="Guide title" className="font-semibold text-sm" />
          <Button variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={onRemove}><Trash2 className="w-4 h-4" /></Button>
        </div>
        <Textarea value={guide.description} onChange={e => onChange({...guide, description: e.target.value})} placeholder="Description" rows={2} className="text-xs" />
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Steps (one per line)</p>
          <Textarea value={(guide.steps || []).join('\n')} onChange={e => onChange({...guide, steps: e.target.value.split('\n').filter(Boolean)})} rows={4} className="text-xs font-mono" />
        </div>
        <Input value={guide.tips || ''} onChange={e => onChange({...guide, tips: e.target.value})} placeholder="Pro tip (optional)" className="text-xs" />
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════
export default function InstructionsPage() {
  const { user, api } = useAuth();
  const role = user?.role || '';
  const isSuperAdmin = role === 'super_admin';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('guide');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/instructions');
      setData(res.data);
      setLoading(false);
    } catch { setLoading(false); }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const startEdit = () => { setEditData(JSON.parse(JSON.stringify(data))); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setEditData(null); };
  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.put('/api/instructions', editData);
      toast.success('Instructions saved!');
      setData(editData);
      setEditing(false); setEditData(null);
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-4 p-4">
      <Skeleton className="h-10 w-64" />
      {Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
    </div>
  );
  if (!data) return <div className="text-center py-12 text-muted-foreground">Failed to load instructions</div>;

  const d = editing ? editData : data;

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="instructions-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>User Guide</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {editing ? 'Editing instructions — changes apply to all users on save' : 'Detailed instructions for your role'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{ROLE_LABELS[role] || role}</Badge>
          {isSuperAdmin && !editing && (
            <Button variant="outline" size="sm" onClick={startEdit} data-testid="instructions-edit-btn">
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
            </Button>
          )}
          {editing && (
            <>
              <Button variant="outline" size="sm" onClick={cancelEdit}><X className="w-3.5 h-3.5 mr-1" /> Cancel</Button>
              <Button size="sm" onClick={saveEdit} disabled={saving}><Save className="w-3.5 h-3.5 mr-1" /> {saving ? 'Saving...' : 'Save'}</Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="guide" className="gap-1.5"><BookOpen className="w-3.5 h-3.5" />Feature Guide</TabsTrigger>
          <TabsTrigger value="masterflow" className="gap-1.5"><Workflow className="w-3.5 h-3.5" />Master Flow</TabsTrigger>
          <TabsTrigger value="quickstart" className="gap-1.5"><Zap className="w-3.5 h-3.5" />Quick Start</TabsTrigger>
          <TabsTrigger value="faq" className="gap-1.5"><Bell className="w-3.5 h-3.5" />FAQ</TabsTrigger>
        </TabsList>

        {/* ═══ Feature Guide ═══ */}
        <TabsContent value="guide" className="mt-6">
          {!editing ? (
            <div className="space-y-10">
              {(d.feature_guides || []).map((section, si) => {
                const SectionIcon = getIcon(section.icon);
                return (
                  <div key={si} className="animate-row-in">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><SectionIcon className="w-5 h-5 text-primary" /></div>
                      <div><h2 className="text-lg font-semibold" style={{ fontFamily: 'Space Grotesk' }}>{section.title}</h2>{section.subtitle && <p className="text-xs text-muted-foreground">{section.subtitle}</p>}</div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-5 mb-8">
                      {(section.guides || []).map((guide, gi) => <ScreenGuide key={gi} guide={guide} iconName={section.icon} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-8">
              {(editData.feature_guides || []).map((section, si) => (
                <Card key={si} className="border-primary/20">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input value={section.title} onChange={e => { const g = [...editData.feature_guides]; g[si] = {...g[si], title: e.target.value}; setEditData({...editData, feature_guides: g}); }} placeholder="Section title" className="font-semibold" />
                        <Input value={section.subtitle || ''} onChange={e => { const g = [...editData.feature_guides]; g[si] = {...g[si], subtitle: e.target.value}; setEditData({...editData, feature_guides: g}); }} placeholder="Subtitle" />
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => { const g = editData.feature_guides.filter((_, i) => i !== si); setEditData({...editData, feature_guides: g}); }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                    {/* Role visibility */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1"><Eye className="w-3 h-3" /> Visible to roles:</p>
                      <div className="flex flex-wrap gap-2">
                        {ALL_ROLES.map(r => (
                          <label key={r} className="flex items-center gap-1.5 text-xs">
                            <Checkbox checked={(section.visible_to || []).includes(r)} onCheckedChange={checked => {
                              const g = [...editData.feature_guides];
                              const vis = new Set(g[si].visible_to || []);
                              checked ? vis.add(r) : vis.delete(r);
                              g[si] = {...g[si], visible_to: [...vis]};
                              setEditData({...editData, feature_guides: g});
                            }} />
                            {ROLE_LABELS[r]}
                          </label>
                        ))}
                      </div>
                    </div>
                    {/* Guides */}
                    <div className="space-y-3">
                      {(section.guides || []).map((guide, gi) => (
                        <EditGuideCard key={gi} guide={guide} onChange={updated => {
                          const g = [...editData.feature_guides];
                          g[si].guides[gi] = updated;
                          setEditData({...editData, feature_guides: g});
                        }} onRemove={() => {
                          const g = [...editData.feature_guides];
                          g[si].guides = g[si].guides.filter((_, i) => i !== gi);
                          setEditData({...editData, feature_guides: g});
                        }} />
                      ))}
                      <Button variant="outline" size="sm" onClick={() => {
                        const g = [...editData.feature_guides];
                        g[si].guides = [...(g[si].guides || []), { title: 'New Guide', description: '', steps: [], tips: '', image: 'dashboard.png' }];
                        setEditData({...editData, feature_guides: g});
                      }}><Plus className="w-3 h-3 mr-1" /> Add Guide</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" onClick={() => {
                setEditData({...editData, feature_guides: [...(editData.feature_guides || []), { id: `section_${Date.now()}`, icon: 'LayoutDashboard', title: 'New Section', subtitle: '', visible_to: ALL_ROLES, guides: [] }]});
              }}><Plus className="w-4 h-4 mr-1" /> Add Section</Button>
            </div>
          )}
        </TabsContent>

        {/* ═══ Master Flow ═══ */}
        <TabsContent value="masterflow" className="mt-6 space-y-6">
          {/* Roles */}
          <Card><CardContent className="p-5">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Role Hierarchy & Permissions</h3>
            <div className="space-y-2">
              {(d.master_flow?.roles || []).map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 animate-row-in">
                  <div className="w-3 h-8 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{r.role}</p>
                    <p className="text-xs text-muted-foreground">{r.desc}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">Access: {r.perms}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>

          {/* Onboarding Lifecycle */}
          <Card><CardContent className="p-5">
            <h3 className="text-base font-semibold mb-6 flex items-center gap-2"><UserPlus className="w-5 h-5 text-emerald-600" /> Onboarding Lifecycle</h3>
            <div className="space-y-3 pl-2">
              {(d.master_flow?.onboarding_lifecycle || []).map((s, i) => (
                <div key={i} className="flex items-start gap-4 animate-row-in">
                  <span className="text-sm text-muted-foreground font-medium w-6 text-right shrink-0 pt-2">{i+1}</span>
                  <div className="flex-1 p-3 rounded-lg bg-muted/20 border-l-[3px]" style={{ borderColor: s.color }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-bold">{s.stage}</span>
                      <Badge variant="outline" className="text-[10px] h-5">{s.role}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>

          {/* Device Lifecycle */}
          <Card><CardContent className="p-5">
            <h3 className="text-base font-semibold mb-6 flex items-center gap-2"><Cpu className="w-5 h-5 text-orange-600" /> Device Lifecycle</h3>
            <div className="space-y-3 pl-2">
              {(d.master_flow?.device_lifecycle || []).map((s, i) => (
                <div key={i} className="flex items-start gap-4 animate-row-in">
                  <span className="text-sm text-muted-foreground font-medium w-6 text-right shrink-0 pt-2">{i+1}</span>
                  <div className="flex-1 p-3 rounded-lg bg-muted/20 border-l-[3px]" style={{ borderColor: s.color }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-bold">{s.stage}</span>
                      <Badge variant="outline" className="text-[10px] h-5">{s.role}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>

          {/* Shipment & Returns */}
          <Card><CardContent className="p-5">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><Truck className="w-5 h-5 text-sky-600" /> Shipment & Returns</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold mb-2">Shipment Flow</p>
                <div className="space-y-1.5 text-xs">
                  {(d.master_flow?.shipment_flow || []).map((s, i) => (
                    <div key={i} className="flex items-center gap-2 animate-row-in"><div className="w-5 h-5 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center text-[10px] font-bold shrink-0">{i+1}</div><span>{s}</span></div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2">Return Flow</p>
                <div className="space-y-1.5 text-xs">
                  {(d.master_flow?.return_flow || []).map((s, i) => (
                    <div key={i} className="flex items-center gap-2 animate-row-in"><div className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-[10px] font-bold shrink-0">{i+1}</div><span>{s}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent></Card>

          {/* Communication */}
          <Card><CardContent className="p-5">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><MessageCircle className="w-5 h-5 text-indigo-600" /> Communication</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-3 bg-indigo-50/50 rounded-lg">
                <p className="text-xs font-semibold mb-2 text-indigo-800">Real-Time Chat</p>
                <ul className="space-y-1 text-[10px] text-muted-foreground"><li>• 1:1 messaging with team</li><li>• File attachments</li><li>• Read receipts & presence</li></ul>
              </div>
              <div className="p-3 bg-emerald-50/50 rounded-lg">
                <p className="text-xs font-semibold mb-2 text-emerald-800">Voice Calls</p>
                <ul className="space-y-1 text-[10px] text-muted-foreground"><li>• WebRTC peer-to-peer</li><li>• Background notifications</li><li>• Call quality indicator</li></ul>
              </div>
              <div className="p-3 bg-amber-50/50 rounded-lg">
                <p className="text-xs font-semibold mb-2 text-amber-800">Notifications</p>
                <ul className="space-y-1 text-[10px] text-muted-foreground"><li>• Real-time badge counts</li><li>• Auto-refresh every 15s</li><li>• WebSocket push updates</li></ul>
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ═══ Quick Start ═══ */}
        <TabsContent value="quickstart" className="mt-6">
          <Card><CardContent className="p-6 space-y-5">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" />Getting Started</h3>
            {!editing ? (
              (d.quick_start || []).map((item, i) => {
                const QIcon = getIcon(item.icon);
                return (
                  <div key={i} className="flex items-start gap-4 animate-row-in">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><QIcon className="w-5 h-5 text-primary" /></div>
                    <div><p className="text-sm font-semibold">{item.title}</p><p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p></div>
                  </div>
                );
              })
            ) : (
              <div className="space-y-3">
                {(editData.quick_start || []).map((item, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <Input value={item.title} onChange={e => { const q = [...editData.quick_start]; q[i] = {...q[i], title: e.target.value}; setEditData({...editData, quick_start: q}); }} placeholder="Title" className="text-sm font-semibold" />
                      <Textarea value={item.desc} onChange={e => { const q = [...editData.quick_start]; q[i] = {...q[i], desc: e.target.value}; setEditData({...editData, quick_start: q}); }} rows={2} className="text-xs" />
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => { setEditData({...editData, quick_start: editData.quick_start.filter((_, j) => j !== i)}); }}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setEditData({...editData, quick_start: [...(editData.quick_start || []), {icon: 'Zap', title: 'New Step', desc: ''}]})}><Plus className="w-3 h-3 mr-1" /> Add Step</Button>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* ═══ FAQ ═══ */}
        <TabsContent value="faq" className="mt-6">
          {!editing ? (
            <Accordion type="single" collapsible className="space-y-3">
              {(d.faq || []).map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border rounded-lg px-4 bg-card shadow-sm data-[state=open]:shadow-md transition-shadow duration-200 animate-row-in">
                  <AccordionTrigger className="text-sm font-semibold py-4 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground pb-4 leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="space-y-3">
              {(editData.faq || []).map((faq, i) => (
                <Card key={i} className="border-dashed">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={faq.q} onChange={e => { const f = [...editData.faq]; f[i] = {...f[i], q: e.target.value}; setEditData({...editData, faq: f}); }} placeholder="Question" className="font-semibold text-sm" />
                      <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => setEditData({...editData, faq: editData.faq.filter((_, j) => j !== i)})}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                    <Textarea value={faq.a} onChange={e => { const f = [...editData.faq]; f[i] = {...f[i], a: e.target.value}; setEditData({...editData, faq: f}); }} rows={2} className="text-xs" />
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={() => setEditData({...editData, faq: [...(editData.faq || []), {q: 'New question?', a: 'Answer here'}]})}><Plus className="w-3 h-3 mr-1" /> Add FAQ</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
