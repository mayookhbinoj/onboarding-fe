import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import DataTable from '../../components/DataTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import { FileText, Pencil, Trash2, Eye, Plus, Tag, Save, X, AlertTriangle, History, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import TemplatePreview from './TemplatePreview';


// Responsive placeholder bar — shows as many tags as fit in one line, +N expands on click
function PlaceholderBar({ placeholders, onInsert, dark }) {
  const containerRef = React.useRef(null);
  const [expanded, setExpanded] = React.useState(false);
  const [visibleCount, setVisibleCount] = React.useState(placeholders.length);

  React.useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el || expanded) return;
      const children = Array.from(el.querySelectorAll('[data-ph]'));
      if (!children.length) return;
      const containerRight = el.parentElement.getBoundingClientRect().right - 90;
      let count = 0;
      for (const child of children) {
        if (child.getBoundingClientRect().right <= containerRight) count++;
        else break;
      }
      setVisibleCount(Math.max(1, count));
    };
    const timer = setTimeout(measure, 50);
    window.addEventListener('resize', measure);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, [placeholders.length, expanded]);

  const hiddenCount = Math.max(0, placeholders.length - visibleCount);
  const shown = expanded ? placeholders : placeholders.slice(0, visibleCount);

  if (expanded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '4px 0' }}>
        <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, flexShrink: 0 }}>Fields:</span>
        {placeholders.map(tag => (
          <button key={tag} data-ph={tag} onMouseDown={e => e.preventDefault()} onClick={() => onInsert(tag)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 10px', fontSize: 10, border: `1px solid ${dark ? '#555' : '#e2e8f0'}`, borderRadius: 6, background: dark ? '#2d2d2d' : '#fff', color: dark ? '#d4d4d4' : '#334155', cursor: 'pointer', flexShrink: 0 }}>
            <Tag style={{ width: 10, height: 10 }} />{`{{${tag}}}`}
          </button>
        ))}
        <button onClick={() => setExpanded(false)} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', fontSize: 10, border: `1px solid ${dark ? '#555' : '#e2e8f0'}`, borderRadius: 6, color: '#94a3b8', cursor: 'pointer', flexShrink: 0 }}>Show less</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '4px 0' }}>
      <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, flexShrink: 0 }}>Fields:</span>
        {shown.map(tag => (
          <button key={tag} data-ph={tag} onMouseDown={e => e.preventDefault()} onClick={() => onInsert(tag)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 10px', fontSize: 10, border: `1px solid ${dark ? '#555' : '#e2e8f0'}`, borderRadius: 6, background: dark ? '#2d2d2d' : '#fff', color: dark ? '#d4d4d4' : '#334155', cursor: 'pointer', flexShrink: 0 }}>
            <Tag style={{ width: 10, height: 10 }} />{`{{${tag}}}`}
          </button>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button onClick={() => setExpanded(true)} style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', fontSize: 10, border: `1px solid ${dark ? '#4488ff55' : '#3b82f655'}`, borderRadius: 6, background: dark ? '#1e3a5f' : '#eff6ff', color: dark ? '#60a5fa' : '#2563eb', cursor: 'pointer', fontWeight: 600, flexShrink: 0, marginLeft: 6 }}>+{hiddenCount} more</button>
      )}
    </div>
  );
}

export default function TemplateManagement() {
  const { api } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [metaDialog, setMetaDialog] = useState(null);
  const [previewId, setPreviewId] = useState(null);

  // Editor state
  const [editorDialog, setEditorDialog] = useState(null);
  const [editorHtml, setEditorHtml] = useState('');
  const [editorPlaceholders, setEditorPlaceholders] = useState([]);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorVersion, setEditorVersion] = useState(1);
  const editorRef = useRef(null);
  const savedSelRef = useRef(null);

  const [editorDark, setEditorDark] = useState(false);
  const [imgToolbar, setImgToolbar] = useState(null);
  const scaleContainerRef = React.useRef(null);
  const [pageScale, setPageScale] = useState(1);

  // Constants — A4 page at 96dpi
  const PAGE_W = 794;
  const PAGE_H = 1123;

  // Responsive scaling — PDF.js pattern
  useEffect(() => {
    if (!editorDialog) return;
    const calcScale = () => {
      const container = scaleContainerRef.current;
      if (!container) return;
      const availW = container.clientWidth - 48; // padding
      let scale = availW / PAGE_W;
      scale = Math.min(scale, 1.0);  // Never zoom above 100%
      scale = Math.max(scale, 0.3);  // Never shrink below 30%
      setPageScale(scale);
    };
    // Delay to ensure DOM is ready
    const timer = setTimeout(calcScale, 50);
    window.addEventListener('resize', calcScale);
    return () => { window.removeEventListener('resize', calcScale); clearTimeout(timer); };
  }, [editorDialog]);

  // Save/restore selection for toolbar interactions
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedSelRef.current = sel.getRangeAt(0).cloneRange();
    }
  };
  const restoreSelection = () => {
    if (savedSelRef.current && editorRef.current) {
      editorRef.current.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedSelRef.current);
    }
  };
  const execCmd = (cmd, val) => {
    // If editor already has focus and a live selection, use it directly
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      document.execCommand(cmd, false, val);
    } else {
      // Fallback: restore saved selection (for dropdowns that steal focus)
      restoreSelection();
      document.execCommand(cmd, false, val);
    }
    saveSelection();
  };
  const insertHtmlAtCursor = (html) => {
    const sel = window.getSelection();
    if (!(sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode))) restoreSelection();
    document.execCommand('insertHTML', false, html);
    saveSelection();
  };
  const applyFontSizePx = (px) => {
    const size = parseInt(px);
    if (!size || size < 6 || size > 120) return;
    const sel = window.getSelection();
    if (!(sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode))) restoreSelection();
    document.execCommand('insertHTML', false,
      `<span style="font-size:${size}px">${window.getSelection()?.toString() || ''}</span>`
    );
    saveSelection();
  };

  // Version history state
  const [versionDialog, setVersionDialog] = useState(null);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [expandedVersionRow, setExpandedVersionRow] = useState(null);

  // Upload state
  const [uploadName, setUploadName] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadTarget, setUploadTarget] = useState('all');
  const [uploadFile, setUploadFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTarget, setEditTarget] = useState('all');

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { const res = await api.get('/api/agreement-templates'); setTemplates(res.data); } catch (err) {}
    setLoading(false);
  };

  // ── Upload (.doc/.docx only) ──
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.doc') && !name.endsWith('.docx')) {
      setUploadError('Only .doc and .docx files are accepted. PDF uploads are not allowed.');
      setUploadFile(null); e.target.value = ''; return;
    }
    setUploadError(''); setUploadFile(file);
  };
  const upload = async () => {
    if (!uploadName.trim() || !uploadFile) { toast.error('Name and file required'); return; }
    setSaving(true);
    const fd = new FormData();
    fd.append('name', uploadName); fd.append('description', uploadDesc); fd.append('file', uploadFile);
    try {
      const res = await api.post('/api/agreement-templates', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (uploadTarget !== 'all') await api.put(`/api/agreement-templates/${res.data.template_id}`, { target_entity: uploadTarget });
      toast.success('Template uploaded!');
      setUploadDialog(false); setUploadName(''); setUploadDesc(''); setUploadFile(null); setUploadTarget('all'); setUploadError('');
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); }
    setSaving(false);
  };

  // ── Meta edit ──
  const openMetaEdit = (t) => { setMetaDialog(t); setEditName(t.name); setEditDesc(t.description || ''); setEditTarget(t.target_entity || 'all'); };
  const saveMeta = async () => {
    setSaving(true);
    try { await api.put(`/api/agreement-templates/${metaDialog._id}`, { name: editName, description: editDesc, target_entity: editTarget }); toast.success('Updated!'); setMetaDialog(null); load(); } catch (err) { toast.error('Failed'); }
    setSaving(false);
  };
  const deleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try { await api.delete(`/api/agreement-templates/${id}`); toast.success('Deleted'); load(); } catch (err) { toast.error('Failed'); }
  };

  // ── Editor ──
  // Default form field placeholders from onboarding data
  const DEFAULT_PLACEHOLDERS = [
    'company_name', 'trade_name', 'business_type', 'pan', 'gstin', 'cin',
    'contact_person_name', 'job_role', 'phone', 'email',
    'registered_address', 'communication_address', 'country', 'state', 'city', 'pincode',
    'expected_studies_per_month', 'territory',
    'signatory_name', 'signatory_date', 'year_of_incorporation',
    'secondary_contact_name', 'secondary_contact_designation', 'reference_doctor',
    'date', 'agreement_date', 'effective_date'
  ];

  const openEditor = async (t, version = 0) => {
    setEditorDialog(t); setEditorLoading(true);
    try {
      // Use html-content endpoint — handles both .doc and .docx files
      const res = await api.get(`/api/agreement-templates/${t._id}/html-content?version=${version}`);
      setEditorHtml(res.data.html || '');
      setEditorPlaceholders([...new Set([...DEFAULT_PLACEHOLDERS, ...(res.data.placeholders || res.data.merge_tags || [])])]);
      setEditorVersion(res.data.version || t.version || 1);
    } catch (err) { toast.error('Failed to load template content'); setEditorDialog(null); }
    setEditorLoading(false);
  };

  const saveEditorContent = async () => {
    if (!editorRef.current) return;
    setEditorSaving(true);
    const html = editorRef.current.innerHTML;
    const matches = html.match(/\{\{(\w+)\}\}/g) || [];
    const placeholders = [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
    // Detect DocuSign signature anchors (/sn1/, /sn2/, etc.) in HTML content
    const anchorMatches = html.match(/\/sn\d+\//g) || [];
    const signAnchors = [...new Set(anchorMatches)];
    try {
      const res = await api.post(`/api/agreement-templates/${editorDialog._id}/save-content`, { html, placeholders, sign_anchors: signAnchors });
      toast.success(`Saved as v${res.data.version}!${signAnchors.length > 0 ? ` (${signAnchors.length} signature anchor(s))` : ''}`);
      setEditorVersion(res.data.version);
      setEditorPlaceholders(res.data.placeholders || placeholders);
      load();
    } catch (err) { toast.error(err.response?.data?.detail || 'Save failed'); }
    setEditorSaving(false);
  };

  const insertPlaceholder = (tag) => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(`{{${tag}}}`));
      range.collapse(false);
    } else {
      editorRef.current.innerHTML += `{{${tag}}}`;
    }
  };

  // ── Version History ──
  const openVersionHistory = async (t) => {
    setVersionDialog(t); setVersionsLoading(true);
    try {
      const res = await api.get(`/api/agreement-templates/${t._id}/versions`);
      setVersions(res.data.versions || []);
    } catch (err) { toast.error('Failed to load versions'); }
    setVersionsLoading(false);
  };

  const restoreVersion = async (templateId, version) => {
    if (!window.confirm(`Restore v${version} as the current version?`)) return;
    try {
      await api.post(`/api/agreement-templates/${templateId}/restore-version`, { version });
      toast.success(`Restored v${version}!`);
      await load();
      // Refresh version list with fresh template data
      const tRes = await api.get('/api/agreement-templates');
      const freshT = (tRes.data || []).find(t => t._id === templateId);
      if (freshT) openVersionHistory(freshT);
    } catch (err) { toast.error('Restore failed'); }
  };

  const distTemplates = templates.filter(t => !t.target_entity || t.target_entity === 'all' || t.target_entity === 'distributor');
  const hospTemplates = templates.filter(t => !t.target_entity || t.target_entity === 'all' || t.target_entity === 'hospital');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Agreement Templates</h1><p className="text-sm text-muted-foreground">Manage templates for Distributors and Hospitals</p></div>
        <Button onClick={() => setUploadDialog(true)} data-testid="upload-template-btn"><Plus className="w-4 h-4 mr-2" /> Upload Template</Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList><TabsTrigger value="all">All ({templates.length})</TabsTrigger><TabsTrigger value="distributor">Distributor ({distTemplates.length})</TabsTrigger><TabsTrigger value="hospital">Hospital ({hospTemplates.length})</TabsTrigger></TabsList>
        {['all', 'distributor', 'hospital'].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-4">
            <DataTable
              testId={`templates-${tab}-table`}
              columns={[
                { key: 'name', label: 'Name', render: (v) => <span className="font-medium">{v}</span> },
                { key: 'description', label: 'Description', render: (v) => <span className="text-sm text-muted-foreground truncate max-w-[180px] block">{v || '-'}</span> },
                { key: 'target_entity', label: 'Target', render: (v) => <Badge variant="outline" className="text-xs">{v || 'All'}</Badge> },
                { key: 'version', label: 'Version', render: (v, t) => <button className="flex items-center gap-1 text-sm text-primary hover:underline" onClick={(e) => { e.stopPropagation(); openVersionHistory(t); }}>v{v} <History className="w-3 h-3" /></button> },
                { key: 'merge_tags', label: 'Placeholders', sortable: false, render: (v) => <div className="flex flex-wrap gap-1 max-w-[180px]">{(v || []).slice(0, 3).map(tag => <Badge key={tag} variant="secondary" className="text-[10px]"><Tag className="w-2.5 h-2.5 mr-0.5" />{tag}</Badge>)}{(v || []).length > 3 && <Badge variant="outline" className="text-[10px]">+{v.length - 3}</Badge>}</div> },
                { key: 'updated_at', label: 'Updated', render: (v, t) => <span className="text-sm text-muted-foreground">{(v || t.created_at) ? new Date(v || t.created_at).toLocaleDateString() : ''}</span> },
                { key: '_actions', label: 'Actions', sortable: false, width: '140px', render: (_, t) => (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setPreviewId(t._id); }} title="Preview"><Eye className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); openEditor(t); }} title="Edit Content"><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={(e) => { e.stopPropagation(); openMetaEdit(t); }} title="Edit Details"><FileText className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); deleteTemplate(t._id); }} title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                )},
              ]}
              data={tab === 'all' ? templates : tab === 'distributor' ? distTemplates : hospTemplates}
              loading={loading}
              searchFields={['name', 'description']}
              searchPlaceholder="Search templates..."
              emptyMessage="No templates found"
              exportable
              exportFilename={`templates_${tab}`}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onOpenChange={o => { if (!o) { setUploadDialog(false); setUploadError(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Agreement Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Template Name <span className="text-red-500">*</span></Label><Input value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="e.g., BAA v3" /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} /></div>
            <div className="space-y-2"><Label>Target Entity</Label><Select value={uploadTarget} onValueChange={setUploadTarget}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="distributor">Distributors</SelectItem><SelectItem value="hospital">Hospitals</SelectItem></SelectContent></Select></div>
            <div className="space-y-2">
              <Label>Template File <span className="text-red-500">*</span></Label>
              <Input type="file" accept=".doc,.docx" onChange={handleFileSelect} />
              <p className="text-[10px] text-muted-foreground">Only .doc/.docx. Use {'{{placeholder}}'} for dynamic fields.</p>
              {uploadError && <div className="flex items-center gap-2 p-2 bg-red-50 rounded text-xs text-red-600"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{uploadError}</div>}
            </div>
          </div>
          <DialogFooter><Button onClick={upload} disabled={saving || !uploadName.trim() || !uploadFile}>{saving ? 'Uploading...' : 'Upload'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meta Edit Dialog */}
      <Dialog open={!!metaDialog} onOpenChange={o => { if (!o) setMetaDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Template Details</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={editDesc} onChange={e => setEditDesc(e.target.value)} /></div>
            <div className="space-y-2"><Label>Target</Label><Select value={editTarget} onValueChange={setEditTarget}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="distributor">Distributors</SelectItem><SelectItem value="hospital">Hospitals</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button onClick={saveMeta} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog open={!!versionDialog} onOpenChange={o => { if (!o) setVersionDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Version History — {versionDialog?.name}</DialogTitle></DialogHeader>
          {versionsLoading ? (
            <div className="flex justify-center p-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No version history yet. Edit and save the template to create versions.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {versions.map(v => (
                <div key={v._id} className={`animate-row-in flex items-center justify-between p-3 rounded-lg text-sm ${v.version === versionDialog?.version ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">v{v.version}</span>
                      {v.version === versionDialog?.version && <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">Current</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {v.saved_at ? new Date(v.saved_at).toLocaleString() : '—'}
                      {v.saved_by ? ` by ${v.saved_by}` : ''}
                      {v.placeholder_count > 0 ? ` • ${v.placeholder_count} placeholders` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {v.has_content && <Button variant="ghost" size="sm" className="h-7" onClick={() => { setVersionDialog(null); openEditor(versionDialog, v.version); }}><Eye className="w-3 h-3 mr-1" />View</Button>}
                    {v.version !== versionDialog?.version && <Button variant="outline" size="sm" className="h-7" onClick={() => restoreVersion(versionDialog._id, v.version)}><RotateCcw className="w-3 h-3 mr-1" />Restore</Button>}
                    {v.version !== versionDialog?.version && <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive" onClick={async () => {
                      if (!window.confirm(`Delete version v${v.version}? This cannot be undone.`)) return;
                      try { await api.delete(`/api/agreement-templates/${versionDialog._id}/versions/${v.version}`); toast.success(`Version v${v.version} deleted`); load(); setVersions(prev => prev.filter(vh => vh.version !== v.version)); } catch (err) { toast.error(err.response?.data?.detail || 'Delete failed'); }
                    }}><Trash2 className="w-3 h-3" /></Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full-screen Content Editor */}
      {editorDialog && (
        <div className={`fixed inset-0 z-[100] flex flex-col ${editorDark ? 'bg-[#1e1e1e] text-[#d4d4d4]' : 'bg-background'}`}>
          {/* Header bar */}
          <div className={`h-12 border-b flex items-center px-4 gap-3 shrink-0 ${editorDark ? 'bg-[#252526] border-[#3c3c3c]' : 'bg-card'}`}>
            <FileText className="w-4 h-4 text-primary" />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold truncate">{editorDialog.name} — v{editorVersion}</h2>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">v{editorVersion}</Badge>
            <button className={`h-7 w-7 rounded-md inline-flex items-center justify-center text-xs ${editorDark ? 'bg-[#3c3c3c] text-[#d4d4d4] hover:bg-[#505050]' : 'bg-muted hover:bg-accent'}`} onClick={() => setEditorDark(d => !d)} title="Toggle Dark Mode">{editorDark ? '☀' : '🌙'}</button>
            <Button variant="outline" size="sm" onClick={saveEditorContent} disabled={editorSaving}>
              <Save className="w-3.5 h-3.5 mr-1" />{editorSaving ? 'Saving...' : 'Save as New Version'}
            </Button>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={async () => {
              if (!window.confirm('Reconvert from the original uploaded file? This will replace the current editor content with the original document formatting. Any unsaved placeholders will be lost.')) return;
              try {
                const res = await api.get(`/api/agreement-templates/${editorDialog._id}/html-content?force_reconvert=true`);
                setEditorHtml(res.data.html || '');
                toast.success('Reconverted from original file — add placeholders and save');
              } catch { toast.error('Reconvert failed'); }
            }}>Reconvert from source</Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditorDialog(null)}><X className="w-4 h-4" /></Button>
          </div>

          {/* Placeholder & DocuSign bar */}
          <div className={`border-b px-4 py-1.5 shrink-0 ${editorDark ? 'bg-[#2d2d2d] border-[#3c3c3c]' : 'bg-muted/30'}`}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium shrink-0">Placeholder:</span>
              <Button variant="outline" size="sm" className="h-5 text-[9px]" onClick={() => {
                const tag = prompt('Custom placeholder name (e.g., custom_field):');
                if (tag && /^\w+$/.test(tag)) { setEditorPlaceholders(prev => [...new Set([...prev, tag])]); insertPlaceholder(tag); }
              }}><Plus className="w-2.5 h-2.5 mr-0.5" />Custom</Button>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium shrink-0">DocuSign:</span>
              <Button variant="outline" size="sm" className="h-5 text-[9px] gap-1 border-violet-200 text-violet-700 hover:bg-violet-50" onClick={() => {
                restoreSelection();
                insertHtmlAtCursor('<span contenteditable="false" style="display:inline-block;border:2px dashed #7c3aed;border-radius:6px;padding:6px 16px;color:#7c3aed;font-size:11px;font-weight:600;background:#f5f3ff;user-select:none;">/sn1/</span>&nbsp;');
                toast.success('Distributor signature anchor placed! Undo with Ctrl+Z.');
              }}>Place Signature</Button>
              <Button variant="outline" size="sm" className="h-5 text-[9px] gap-1 border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => {
                restoreSelection();
                insertHtmlAtCursor('<span contenteditable="false" style="display:inline-block;border:2px dashed #d97706;border-radius:6px;padding:6px 16px;color:#d97706;font-size:11px;font-weight:600;background:#fffbeb;user-select:none;">/sn2/</span>&nbsp;');
                toast.success('CEO signature anchor placed! Undo with Ctrl+Z.');
              }}>Place CEO Signature</Button>
            </div>
            <PlaceholderBar placeholders={editorPlaceholders} onInsert={insertPlaceholder} dark={editorDark} />
          </div>

          {/* Toolbar */}
          <div className={`border-b px-3 py-1 flex items-center gap-0.5 shrink-0 flex-wrap ${editorDark ? 'bg-[#2d2d2d] border-[#3c3c3c]' : 'bg-card'}`} onMouseDown={e => { if (!['SELECT','INPUT','OPTION'].includes(e.target.tagName)) e.preventDefault(); }}>
            {/* Undo/Redo */}
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'} text-muted-foreground`} onClick={() => execCmd('undo')} title="Undo (Ctrl+Z)"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg></button>
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'} text-muted-foreground`} onClick={() => execCmd('redo')} title="Redo (Ctrl+Y)"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg></button>
            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Font Family */}
            <select className={`h-7 text-[11px] border rounded px-1 max-w-[120px] ${editorDark ? 'bg-[#3c3c3c] border-[#555] text-[#d4d4d4]' : ''}`} onChange={e => execCmd('fontName', e.target.value)} defaultValue="" title="Font Family">
              <option value="" disabled>Font</option>
              <optgroup label="Document Fonts">
                <option value="Quattrocento Sans">Quattrocento Sans</option>
                <option value="Segoe UI">Segoe UI</option>
              </optgroup>
              <optgroup label="Serif">
                <option value="Georgia">Georgia</option><option value="Times New Roman">Times New Roman</option><option value="Garamond">Garamond</option><option value="Cambria">Cambria</option><option value="Palatino Linotype">Palatino</option><option value="Book Antiqua">Book Antiqua</option><option value="Baskerville">Baskerville</option><option value="Century Schoolbook">Century Schoolbook</option>
              </optgroup>
              <optgroup label="Sans-Serif">
                <option value="Arial">Arial</option><option value="Helvetica">Helvetica</option><option value="Verdana">Verdana</option><option value="Calibri">Calibri</option><option value="Trebuchet MS">Trebuchet MS</option><option value="Segoe UI">Segoe UI</option><option value="Tahoma">Tahoma</option><option value="Lucida Sans">Lucida Sans</option>
              </optgroup>
              <optgroup label="Monospace">
                <option value="Courier New">Courier New</option><option value="Consolas">Consolas</option><option value="Lucida Console">Lucida Console</option>
              </optgroup>
            </select>

            {/* Font Size - dropdown + custom input */}
            <select className={`h-7 text-[11px] border rounded px-1 w-[50px] ${editorDark ? 'bg-[#3c3c3c] border-[#555] text-[#d4d4d4]' : ''}`} onChange={e => { if (e.target.value === 'custom') { const s = prompt('Enter font size in pt (6-72):'); if (s) applyFontSizePx(Math.round(parseFloat(s) * 1.333)); e.target.value = '3'; } else execCmd('fontSize', e.target.value); }} defaultValue="3" title="Font Size">
              <option value="1">8</option><option value="2">10</option><option value="3">12</option><option value="4">14</option><option value="5">18</option><option value="6">24</option><option value="7">36</option><option value="custom">...</option>
            </select>
            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Text Formatting */}
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md font-bold text-sm ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('bold')} title="Bold (Ctrl+B)">B</button>
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md italic text-sm ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('italic')} title="Italic (Ctrl+I)">I</button>
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md underline text-sm ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('underline')} title="Underline (Ctrl+U)">U</button>
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md line-through text-sm ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('strikeThrough')} title="Strikethrough">S</button>
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-[10px] ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('superscript')} title="Superscript (toggle)">X<sup className="text-[7px]">2</sup></button>
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-[10px] ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('subscript')} title="Subscript (toggle)">X<sub className="text-[7px]">2</sub></button>
            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Colors */}
            <label className={`relative h-7 w-7 flex items-center justify-center cursor-pointer rounded-md ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} title="Text Color">
              <span className="text-xs font-bold">A</span><div className="absolute bottom-0.5 left-1 right-1 h-[3px] bg-red-500 rounded" />
              <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" defaultValue="#000000" onChange={e => execCmd('foreColor', e.target.value)} />
            </label>
            <label className={`relative h-7 w-7 flex items-center justify-center cursor-pointer rounded-md ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} title="Highlight">
              <span className="text-xs font-bold bg-yellow-200 px-0.5 rounded text-black">A</span>
              <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" defaultValue="#FFFF00" onChange={e => execCmd('hiliteColor', e.target.value)} />
            </label>
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-[10px] ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('removeFormat')} title="Clear Formatting">x&#818;</button>
            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Alignment */}
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('justifyLeft')} title="Align Left"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg></button>
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('justifyCenter')} title="Align Center"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg></button>
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('justifyRight')} title="Align Right"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg></button>
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('justifyFull')} title="Justify"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg></button>
            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Line Spacing */}
            <select className={`h-7 text-[11px] border rounded px-1 w-[48px] ${editorDark ? 'bg-[#3c3c3c] border-[#555] text-[#d4d4d4]' : ''}`} onChange={e => {
              restoreSelection();
              const sel = window.getSelection();
              if (sel.rangeCount > 0) { let n = sel.anchorNode; while (n && n.nodeType !== 1) n = n.parentNode; if (n && editorRef.current?.contains(n)) n.style.lineHeight = e.target.value; }
            }} defaultValue="1.7" title="Line Spacing">
              <option value="1">1.0</option><option value="1.15">1.15</option><option value="1.5">1.5</option><option value="1.7">1.7</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option>
            </select>

            {/* Indent */}
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('outdent')} title="Decrease Indent"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="11" y2="12"/><line x1="21" y1="18" x2="11" y2="18"/><polyline points="7 8 3 12 7 16"/></svg></button>
            <button className={`h-7 w-7 p-0 inline-flex items-center justify-center rounded-md ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('indent')} title="Increase Indent"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="11" y2="12"/><line x1="21" y1="18" x2="11" y2="18"/><polyline points="3 8 7 12 3 16"/></svg></button>
            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Lists */}
            <button className={`h-7 px-1.5 inline-flex items-center justify-center rounded-md text-[11px] ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('insertUnorderedList')} title="Bullet List">• List</button>
            <button className={`h-7 px-1.5 inline-flex items-center justify-center rounded-md text-[11px] ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('insertOrderedList')} title="Numbered List">1. List</button>
            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Insert Menu */}
            <div className="relative group">
              <button className={`h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} title="Insert">Insert <ChevronDown className="w-3 h-3" /></button>
              <div className={`hidden group-hover:block absolute top-full left-0 border rounded-md shadow-lg z-50 py-1 min-w-[170px] ${editorDark ? 'bg-[#2d2d2d] border-[#3c3c3c]' : 'bg-white'}`} onMouseDown={e => e.stopPropagation()}>
                <button className={`w-full text-left px-3 py-1.5 text-xs ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('insertHorizontalRule')}>Horizontal Line</button>
                <button className={`w-full text-left px-3 py-1.5 text-xs ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => insertHtmlAtCursor('<div style="page-break-after:always;border-top:2px dashed #94a3b8;margin:24px 0;padding:4px 0;text-align:center;color:#94a3b8;font-size:10px;" contenteditable="false">— Page Break —</div><p><br></p>')}>Page Break</button>
                <button className={`w-full text-left px-3 py-1.5 text-xs ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => {
                  const rows = parseInt(prompt('Number of rows:', '3') || '0');
                  const cols = parseInt(prompt('Number of columns:', '3') || '0');
                  if (rows > 0 && cols > 0 && rows <= 20 && cols <= 10) {
                    let h = '<div class="table-wrapper" draggable="true" style="position:relative;margin:16px 0;"><table style="width:100%;border-collapse:collapse;">';
                    for (let r = 0; r < rows; r++) { h += '<tr>'; for (let c = 0; c < cols; c++) { const tag = r === 0 ? 'th' : 'td'; h += `<${tag} style="border:1px solid #d1d5db;padding:8px 10px;text-align:left;font-size:12px;min-width:60px;${r === 0 ? 'background:#f1f5f9;font-weight:600;' : ''}">${r === 0 ? `Col ${c+1}` : '&nbsp;'}</${tag}>`; } h += '</tr>'; }
                    h += '</table></div><p><br></p>';
                    insertHtmlAtCursor(h);
                  }
                }}>Insert Table...</button>
                <button className={`w-full text-left px-3 py-1.5 text-xs ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => {
                  const url = prompt('Image URL:');
                  if (url) insertHtmlAtCursor(`<img src="${url}" style="max-width:100%;height:auto;display:block;margin:12px auto;border-radius:4px;cursor:move;" draggable="true" />`);
                }}>Insert Image...</button>
                <button className={`w-full text-left px-3 py-1.5 text-xs ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => { const url = prompt('Link URL:'); if (url) execCmd('createLink', url); }}>Insert Link...</button>
                <div className={`border-t my-1 ${editorDark ? 'border-[#3c3c3c]' : ''}`} />
                <button className={`w-full text-left px-3 py-1.5 text-xs ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => execCmd('removeFormat')}>Clear All Formatting</button>
                <button className={`w-full text-left px-3 py-1.5 text-xs ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} onClick={() => { const text = editorRef.current?.innerText || ''; const words = text.trim().split(/\s+/).filter(Boolean).length; const chars = text.length; alert(`Words: ${words}\nCharacters: ${chars}`); }}>Word Count</button>
              </div>
            </div>

            {/* Heading */}
            <select className={`h-7 text-[11px] border rounded px-1 w-[85px] ${editorDark ? 'bg-[#3c3c3c] border-[#555] text-[#d4d4d4]' : ''}`} onChange={e => { execCmd('formatBlock', e.target.value); e.target.value = ''; }} defaultValue="" title="Paragraph Style">
              <option value="" disabled>Style</option>
              <option value="p">Normal</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
              <option value="h4">Heading 4</option>
              <option value="blockquote">Quote</option>
              <option value="pre">Code Block</option>
            </select>

            {/* Margin editor */}
            <div className="relative group">
              <button className={`h-7 px-2 inline-flex items-center gap-1 rounded-md text-[11px] ${editorDark ? 'hover:bg-[#3c3c3c]' : 'hover:bg-accent'}`} title="Page Margins">Margins</button>
              <div className={`hidden group-hover:block absolute top-full right-0 border rounded-md shadow-lg z-50 p-3 min-w-[200px] ${editorDark ? 'bg-[#2d2d2d] border-[#3c3c3c]' : 'bg-white'}`} onMouseDown={e => e.stopPropagation()}>
                <p className="text-[10px] font-semibold mb-2">Page Margins (inches)</p>
                {['top','right','bottom','left'].map(side => (
                  <div key={side} className="flex items-center justify-between mb-1">
                    <label className="text-[10px] capitalize">{side}</label>
                    <input type="number" step="0.1" min="0" max="3" defaultValue={side === 'left' ? '0.5' : side === 'right' ? '1' : side === 'top' ? '0.6' : '0.5'} className={`w-16 h-6 text-[10px] border rounded px-1 ${editorDark ? 'bg-[#3c3c3c] border-[#555] text-[#d4d4d4]' : ''}`} onChange={e => {
                      if (editorRef.current) editorRef.current.style[`padding${side.charAt(0).toUpperCase()+side.slice(1)}`] = `${e.target.value}in`;
                    }} />
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Editor body */}
          <div className={`flex-1 overflow-y-auto ${editorDark ? 'bg-[#1e1e1e]' : 'bg-muted/10'}`} style={{ padding: '24px 16px' }}>
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Quattrocento+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap');
              .ph-highlight { background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 0.85em; border: 1px solid #fde68a; margin: 0 2px; display: inline; }
              [contenteditable] ul { list-style-type: disc !important; padding-left: 28px !important; margin: 8px 0 !important; }
              [contenteditable] ol { list-style-type: decimal !important; padding-left: 28px !important; margin: 8px 0 !important; }
              [contenteditable] ul li, [contenteditable] ol li { display: list-item !important; margin-bottom: 4px; }
              [contenteditable] blockquote { border-left: 4px solid #94a3b8; padding-left: 16px; margin: 12px 0; color: #64748b; font-style: italic; }
              [contenteditable] pre { background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 13px; white-space: pre-wrap; margin: 12px 0; }
              [contenteditable] table { cursor: default; position: relative; }
              [contenteditable] table:hover { outline: 2px solid #3b82f6; outline-offset: 2px; }
              [contenteditable] .table-wrapper { cursor: default; }
              [contenteditable] .table-wrapper:hover { outline: 2px solid #3b82f6; outline-offset: 2px; }
              [contenteditable] .table-wrapper[draggable]:hover::before { content: 'Drag to move'; position: absolute; top: -18px; left: 0; background: #3b82f6; color: white; font-size: 9px; padding: 1px 6px; border-radius: 3px; z-index: 5; pointer-events: none; }
              [contenteditable] img { cursor: move; max-width: 100%; }
              [contenteditable] img:hover { outline: 2px solid #3b82f6; outline-offset: 2px; }
              [contenteditable] img[draggable]:hover::after { content: 'Drag'; }
              [contenteditable] hr { border: none; border-top: 2px solid #e2e8f0; margin: 16px 0; }
              .editor-dark [contenteditable] { color: #d4d4d4; }
              .editor-dark [contenteditable] blockquote { border-left-color: #555; color: #aaa; }
              .editor-dark [contenteditable] pre { background: #2d2d2d; color: #d4d4d4; }
              .editor-dark [contenteditable] hr { border-top-color: #555; }
              .editor-dark [contenteditable] table th { background: #333 !important; color: #d4d4d4 !important; }
              .editor-dark [contenteditable] table td, .editor-dark [contenteditable] table th { border-color: #555 !important; }
            `}</style>
            {editorLoading ? (
              <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            ) : (
              <div ref={pageWrapRef} style={{ width: '816px', transformOrigin: 'top center', transform: `scale(${pageScale})`, margin: '0 auto', transition: 'transform 0.15s ease' }}>
              <div className={`shadow-lg border rounded-sm ${editorDark ? 'bg-[#1e1e1e] border-[#3c3c3c] editor-dark' : 'bg-white'}`} style={{ width: '816px' }}>
                <div ref={editorRef} contentEditable suppressContentEditableWarning className="min-h-[600px] max-w-none focus:outline-none" style={{ padding: '1in', lineHeight: 'normal', color: editorDark ? '#d4d4d4' : undefined, position: 'relative' }} dangerouslySetInnerHTML={{ __html: editorHtml }}
                  onMouseUp={saveSelection}
                  onKeyUp={saveSelection}
                  onClick={(e) => {
                    const img = e.target.tagName === 'IMG' ? e.target : e.target.closest?.('img');
                    if (img) {
                      const rect = img.getBoundingClientRect();
                      const scrollEl = editorRef.current?.closest('.overflow-y-auto');
                      const scrollRect = scrollEl?.getBoundingClientRect() || { left: 0, top: 0 };
                      setImgToolbar({ el: img, x: rect.left - scrollRect.left + 8, y: rect.bottom - scrollRect.top + (scrollEl?.scrollTop || 0) + 4 });
                    } else {
                      if (imgToolbar) setImgToolbar(null);
                    }
                  }}
                  onDragStart={e => {
                    const target = e.target.closest?.('.table-wrapper') || (e.target.tagName === 'TABLE' ? e.target : null) || (e.target.tagName === 'IMG' ? e.target : null);
                    if (target) {
                      e.dataTransfer.setData('text/html', target.outerHTML);
                      e.dataTransfer.effectAllowed = 'move';
                      target.style.opacity = '0.3';
                      setTimeout(() => target.remove(), 0);
                    }
                  }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={e => {
                    e.preventDefault();
                    const html = e.dataTransfer.getData('text/html');
                    if (html && editorRef.current) {
                      const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
                      if (range) { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); document.execCommand('insertHTML', false, html); }
                    }
                  }}
                />
              </div>
              </div>
            )}
            {/* Floating image toolbar — appears when clicking an image */}
            {imgToolbar && (
              <div style={{ position: 'absolute', left: imgToolbar.x, top: imgToolbar.y, zIndex: 50 }} onMouseDown={e => e.preventDefault()}>
                <div className={`flex items-center gap-0.5 p-1 rounded-lg shadow-xl border ${editorDark ? 'bg-[#2d2d2d] border-[#555]' : 'bg-white border-gray-200'}`}>
                  {[
                    { icon: '▬', tip: 'Inline', style: 'display:inline;float:none;position:static;' },
                    { icon: '⇤', tip: 'Wrap left', style: 'float:left;margin:0 12px 8px 0;' },
                    { icon: '⇥', tip: 'Wrap right', style: 'float:right;margin:0 0 8px 12px;' },
                    { icon: '⬒', tip: 'Center', style: 'display:block;margin:12px auto;float:none;' },
                    { icon: '⬓', tip: 'Behind', style: 'position:absolute;z-index:-1;opacity:0.4;' },
                    { icon: '⬔', tip: 'In front', style: 'position:absolute;z-index:10;' },
                  ].map(opt => (
                    <button key={opt.tip} title={opt.tip} onClick={() => {
                      if (imgToolbar.el) { imgToolbar.el.style.cssText = opt.style + 'max-width:100%;cursor:pointer;'; }
                      setImgToolbar(null);
                    }} className={`w-7 h-7 text-xs rounded flex items-center justify-center ${editorDark ? 'hover:bg-[#3c3c3c] text-[#d4d4d4]' : 'hover:bg-gray-100'}`}>{opt.icon}</button>
                  ))}
                  <div className={`w-px h-5 mx-0.5 ${editorDark ? 'bg-[#555]' : 'bg-gray-200'}`} />
                  <button title="Delete image" onClick={() => { if (imgToolbar.el) imgToolbar.el.remove(); setImgToolbar(null); }} className="w-7 h-7 text-xs rounded flex items-center justify-center text-red-500 hover:bg-red-50">✕</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {previewId && <TemplatePreview api={api} templateId={previewId} onClose={() => setPreviewId(null)} title="Template Preview" />}
    </div>
  );
}
