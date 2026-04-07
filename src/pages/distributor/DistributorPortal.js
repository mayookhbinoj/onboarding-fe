import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Progress } from '../../components/ui/progress';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import StatusBadge from '../../components/StatusBadge';
import { CameraCapture } from '../../components/CameraCapture';
import { toast } from 'sonner';
import { Activity, PlayCircle, CheckCircle, XCircle, FileText, Video, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Save, Send, Upload, Lock, Eye, Building, User, Users, MapPin, CreditCard, Package, Shield, ShieldCheck, Clock, AlertCircle, Camera, Plus, Trash2, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortablePartnerItem({ p, idx, isOpen, setExpandedPartner, movePartner, updatePartner, removePartner, lockedFields, shareValid }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const partners = []; // placeholder for length check — not needed for rendering

  return (
    <div ref={setNodeRef} style={style} className={`border rounded-xl overflow-hidden ${p.is_active ? '' : 'opacity-50'}`}>
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 cursor-pointer" onClick={() => setExpandedPartner(isOpen ? null : idx)}>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing" onClick={e => e.stopPropagation()}><GripVertical className="w-3.5 h-3.5 text-muted-foreground/30" /></div>
        <div className="flex flex-col gap-0.5">
          <button type="button" onClick={e => { e.stopPropagation(); movePartner(idx, -1); }} className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
          <button type="button" onClick={e => { e.stopPropagation(); movePartner(idx, 1); }} className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
        </div>
        <span className="text-xs font-semibold text-primary w-16 shrink-0">Partner {idx + 1}</span>
        <span className="text-xs flex-1 truncate">{p.full_name || 'Unnamed'}</span>
        {p.share_pct && <Badge variant="secondary" className="text-[9px]">{p.share_pct}%</Badge>}
        {!p.is_active && <Badge className="text-[9px] bg-gray-100 text-gray-500">Inactive</Badge>}
        <button type="button" onClick={e => { e.stopPropagation(); updatePartner(idx, 'is_active', !p.is_active); }} className={`text-[9px] px-1.5 py-0.5 rounded border ${p.is_active ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-gray-500 bg-gray-50 border-gray-200'}`}>{p.is_active ? 'Active' : 'Inactive'}</button>
        <button type="button" onClick={e => { e.stopPropagation(); removePartner(idx); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </div>
      {isOpen && (
        <div className="p-3 space-y-3">
          {p._locked && lockedFields?.length > 0 && <p className="text-[9px] text-amber-600 flex items-center gap-1"><Lock className="w-3 h-3" /> Some fields are locked by the admin</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Full Name <span className="text-red-500">*</span></Label><Input value={p.full_name} onChange={e => updatePartner(idx, 'full_name', e.target.value)} placeholder="Full legal name" className="h-8 text-xs" readOnly={p._locked && lockedFields?.includes('full_name') && !!p.full_name} /></div>
            <div className="space-y-1"><Label className="text-xs">Designation</Label><select value={p.designation} onChange={e => updatePartner(idx, 'designation', e.target.value)} disabled={p._locked && lockedFields?.includes('designation') && !!p.designation} className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"><option value="">Select...</option><option value="Designated Partner">Designated Partner</option><option value="Partner">Partner</option><option value="Director">Director</option><option value="Managing Director">Managing Director</option><option value="CEO">CEO</option><option value="CFO">CFO</option><option value="Trustee">Trustee</option><option value="Other">Other</option></select></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">DIN</Label><Input value={p.din} onChange={e => updatePartner(idx, 'din', e.target.value)} className="h-8 text-xs font-mono" readOnly={p._locked && lockedFields?.includes('din') && !!p.din} /></div>
            <div className="space-y-1"><Label className="text-xs">PAN</Label><Input value={p.pan} onChange={e => updatePartner(idx, 'pan', e.target.value.toUpperCase())} maxLength={10} className="h-8 text-xs font-mono" readOnly={p._locked && lockedFields?.includes('pan') && !!p.pan} /></div>
            <div className="space-y-1"><Label className="text-xs">Aadhaar</Label><Input value={p.aadhaar} onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 12); const parts = []; for (let i = 0; i < d.length; i += 4) parts.push(d.slice(i, i + 4)); updatePartner(idx, 'aadhaar', parts.join(' ')); }} maxLength={14} className="h-8 text-xs font-mono" readOnly={p._locked && lockedFields?.includes('aadhaar') && !!p.aadhaar} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={p.email} onChange={e => updatePartner(idx, 'email', e.target.value)} className="h-8 text-xs" readOnly={p._locked && lockedFields?.includes('email') && !!p.email} /></div>
            <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={p.phone} onChange={e => updatePartner(idx, 'phone', e.target.value)} className="h-8 text-xs" readOnly={p._locked && lockedFields?.includes('phone') && !!p.phone} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Date of Joining</Label><Input type="date" value={p.date_of_joining} onChange={e => updatePartner(idx, 'date_of_joining', e.target.value)} className="h-8 text-xs" /></div>
            <div className="space-y-1"><Label className="text-xs">Share %</Label><Input type="number" min="0" max="100" step="0.1" value={p.share_pct} onChange={e => updatePartner(idx, 'share_pct', e.target.value)} className={`h-8 text-xs font-mono ${!shareValid ? 'border-red-400' : ''}`} readOnly={p._locked && lockedFields?.includes('share_pct') && !!p.share_pct} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Address</Label><Input value={p.address} onChange={e => updatePartner(idx, 'address', e.target.value)} className="h-8 text-xs" /></div>
        </div>
      )}
    </div>
  );
}

const API = process.env.REACT_APP_BACKEND_URL;

const STEPS = [
  { id: 'welcome', label: 'Welcome', icon: Activity },
  { id: 'videos', label: 'Watch Videos', icon: Video },
  { id: 'form', label: 'Onboarding Form', icon: FileText },
  { id: 'status', label: 'Status & Agreement', icon: CheckCircle },
  { id: 'comprehensive', label: 'Training Videos', icon: PlayCircle },
];

// ─── Required field definitions ─────────────────────────
// Every field is mandatory EXCEPT: cin, num_sites, territory
// GSTIN fields only required for "registered" entity_type
const REQUIRED_FIELDS_BASE = [
  { key: 'company_name', label: 'Company / Legal Entity Name' },
  { key: 'trade_name', label: 'Trade Name' },
  { key: 'business_type', label: 'Business Type' },
  { key: 'pan', label: 'PAN' },
  { key: 'contact_person_name', label: 'Contact Person Name' },
  { key: 'job_role', label: 'Job Role' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'email', label: 'Email Address' },
  { key: 'registered_address', label: 'Registered Address' },
  { key: 'communication_address', label: 'Communication Address' },
  { key: 'country', label: 'Country' },
  { key: 'state', label: 'State' },
  { key: 'city', label: 'City' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'expected_studies_per_month', label: 'Expected Studies per Month' },
  { key: 'signatory_name', label: 'Authorized Signatory Name' },
  { key: 'signatory_date', label: 'Signatory Date' },
];

function getRequiredFields(entityType, businessType, inviteCategory, standardFieldConfig = {}) {
  const isHospital = inviteCategory === 'hospital';
  const fields = [];
  
  // Check each base field against standard_field_config from the invite
  for (const f of REQUIRED_FIELDS_BASE) {
    const cfg = standardFieldConfig[f.key];
    // If config says disabled, skip entirely
    if (cfg && cfg.enabled === false) continue;
    // If config says optional (required=false), skip from required list
    if (cfg && cfg.required === false) continue;
    fields.push(f);
  }
  
  // Trade name optional for hospitals
  if (isHospital) {
    const idx = fields.findIndex(f => f.key === 'trade_name');
    if (idx !== -1) fields.splice(idx, 1);
    // Territory mandatory for hospitals (unless config says otherwise)
    const terrCfg = standardFieldConfig['territory'];
    if (!terrCfg || terrCfg.enabled !== false) {
      if (!terrCfg || terrCfg.required !== false) {
        fields.push({ key: 'territory', label: 'Regional / Territory' });
      }
    }
  }
  // GSTIN — check config first, then fallback to entity type rules
  const gstCfg = standardFieldConfig['gstin'];
  if (gstCfg) {
    if (gstCfg.enabled !== false && gstCfg.required !== false) {
      fields.push({ key: 'gstin', label: 'GSTIN' });
    }
  } else if (entityType === 'registered' || entityType === 'private_hospital' || entityType === 'government_hospital' || isHospital) {
    fields.push({ key: 'gstin', label: 'GSTIN' });
  }
  // Aadhaar — check config first
  const aadhaarCfg = standardFieldConfig['aadhaar_1'];
  if (aadhaarCfg) {
    if (aadhaarCfg.enabled !== false && aadhaarCfg.required !== false) {
      fields.push({ key: 'aadhaar_1', label: 'Aadhaar Number' });
    }
  } else if (businessType === 'Sole Proprietor') {
    fields.push({ key: 'aadhaar_1', label: 'Aadhaar Number' });
  } else if (businessType === 'Partnership') {
    fields.push({ key: 'aadhaar_1', label: 'Aadhaar Number (Partner 1)' });
  }
  return fields;
}

const OPTIONAL_KEYS = new Set(['cin', 'num_sites', 'website', 'secondary_contact_name', 'secondary_contact_designation', 'secondary_phone', 'secondary_email', 'reference_doctor']);

function isRequired(key, entityType, businessType, stdFieldConfig = {}) {
  // If standard_field_config exists for this key, it overrides ALL hardcoded rules
  const cfg = stdFieldConfig[key];
  if (cfg) {
    if (cfg.enabled === false) return false;
    if (cfg.required === false) return false;
    if (cfg.required === true) return true;
  }
  // Fallback to hardcoded rules only if no config exists
  if (OPTIONAL_KEYS.has(key)) return false;
  if (key === 'gstin' || key === 'billing_gstin') {
    return entityType === 'registered' || entityType === 'private_hospital' || entityType === 'government_hospital';
  }
  if (key === 'aadhaar_1') {
    return businessType === 'Sole Proprietor' || businessType === 'Partnership';
  }
  if (key === 'aadhaar_2') {
    return businessType === 'Partnership';
  }
  return true;
}

function isFieldEnabled(key, stdFieldConfig = {}) {
  const cfg = stdFieldConfig[key];
  if (cfg && cfg.enabled === false) return false;
  return true;
}

// Wrapper that hides fields when disabled via standard_field_config
function FieldWrap({ fieldKey, children }) {
  const cfg = window.__stdFieldConfig || {};
  if (cfg[fieldKey] && cfg[fieldKey].enabled === false) return null;
  return children;
}

// ─── Required label component ───────────────────────────
function ReqLabel({ children, fieldKey, distributorType, businessType, stdFieldConfig: propConfig }) {
  // Use prop config if provided, otherwise try to read from window (set by portal component)
  const cfg = propConfig || window.__stdFieldConfig || {};
  const req = isRequired(fieldKey, distributorType, businessType, cfg);
  return (
    <Label className="flex items-center gap-0.5">
      {children}
      {req && <span className="text-red-500 ml-0.5">*</span>}
    </Label>
  );
}

// ─── Inline error component ─────────────────────────────
function FieldError({ show, message }) {
  if (!show) return null;
  return (
    <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
      <AlertCircle className="w-3 h-3" />
      {message || 'This field is required'}
    </p>
  );
}

// ─── Video Player with playback + watched tracking ──────
function VideoPlayer({ url, title, onWatched }) {
  const [canMark, setCanMark] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // Start timer when component mounts (iframe loads)
    timerRef.current = setTimeout(() => {
      setCanMark(true);
      if (onWatched) onWatched();
    }, 10000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [onWatched]);

  // Convert any YouTube URL to embeddable format
  const toEmbedUrl = (rawUrl) => {
    if (!rawUrl) return '';
    let videoId = '';
    // youtube.com/watch?v=ID
    const watchMatch = rawUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) videoId = watchMatch[1];
    // youtu.be/ID
    const shortMatch = rawUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) videoId = shortMatch[1];
    // youtube.com/embed/ID (already embed)
    const embedMatch = rawUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) videoId = embedMatch[1];
    // youtube-nocookie.com/embed/ID
    const nocookieMatch = rawUrl.match(/youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    if (nocookieMatch) videoId = nocookieMatch[1];
    if (videoId) return `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0`;
    // Not a YouTube URL — return as-is
    return rawUrl;
  };
  const embedUrl = toEmbedUrl(url);

  return (
    <div className="w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
      <iframe
        src={embedUrl}
        title={title}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════
export default function DistributorPortal() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordVerifying, setPasswordVerifying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [videosWatched, setVideosWatched] = useState({});
  const [videosReady, setVideosReady] = useState({});
  const [allVideosWatched, setAllVideosWatched] = useState(false);
  const storageKey = `beatx_form_${token}`;
  const [formData, setFormData] = useState(() => {
    try { const saved = localStorage.getItem(storageKey); return saved ? { ...JSON.parse(saved), signatory_date: new Date().toISOString().split('T')[0] } : { signatory_date: new Date().toISOString().split('T')[0], country: 'India' }; } catch { return { signatory_date: new Date().toISOString().split('T')[0], country: 'India' }; }
  });
  const [formErrors, setFormErrors] = useState({});
  const [formTouched, setFormTouched] = useState(false);

  // Auto-save form data to localStorage
  useEffect(() => {
    if (formTouched) {
      try { localStorage.setItem(storageKey, JSON.stringify(formData)); } catch {}
    }
  }, [formData, formTouched, storageKey]);
  const [partners, setPartners] = useState([]);
  const [expandedPartner, setExpandedPartner] = useState(null);
  const [partnerConfigFromLink, setPartnerConfigFromLink] = useState(null);
  const partnerDndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [formSaving, setFormSaving] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const formSubmittedRef = useRef(false);
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');
  const [gstinVerifying, setGstinVerifying] = useState(false);
  const [variantId, setVariantId] = useState('');
  const [formStartTracked, setFormStartTracked] = useState(false);
  const formLoadTime = useRef(null);
  const [gstinResult, setGstinResult] = useState(null);
  const gstinCacheRef = useRef({});
  const [translations, setTranslations] = useState({});
  const [portalLang, setPortalLang] = useState('en');
  const [translationsLoading, setTranslationsLoading] = useState(false);
                 
  // Translation helper — returns translated label or English fallback
  const t = (key, fallback) => {
    if (portalLang === 'en') return fallback || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (translations[key]) return translations[key];
    return fallback || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  // Wrap children for ReqLabel — translates the label text
  const tl = (fieldKey, englishLabel) => translations[fieldKey] || englishLabel;

  // Custom file input with translated labels
  const TranslatedFileInput = ({ accept, onChange }) => {
    const ref = React.useRef(null);
    const [fileName, setFileName] = React.useState('');
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files[0]; if (f) { setFileName(f.name); onChange(f); } }} />
        <button type="button" onClick={() => ref.current?.click()} className="shrink-0 px-3 py-1.5 text-sm border rounded-md bg-white hover:bg-gray-50 transition-colors">{t('choose_file', 'Choose File')}</button>
        <span className="text-sm text-muted-foreground truncate">{fileName || t('no_file_chosen', 'No file chosen')}</span>
      </div>
    );
  };

  const loadData = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/portal/${token}`);
      // Check if password is required
      if (res.data?.password_required) {
        setPasswordRequired(true);
        setLoading(false);
        return;
      }
      setData(res.data);
      // Set global standard_field_config for ReqLabel components
      window.__stdFieldConfig = res.data?.invite?.standard_field_config || {};
      // Generate CSS to hide disabled fields dynamically
      const cfg = res.data?.invite?.standard_field_config || {};
      const hideRules = Object.entries(cfg)
        .filter(([_, v]) => v.enabled === false)
        .map(([key]) => `[data-field="${key}"] { display: none !important; }`)
        .join('\n');
      // Remove old style tag if exists
      const oldStyle = document.getElementById('field-config-style');
      if (oldStyle) oldStyle.remove();
      if (hideRules) {
        const style = document.createElement('style');
        style.id = 'field-config-style';
        style.textContent = hideRules;
        document.head.appendChild(style);
      }
      // Initialize partner config from link
      const pc = res.data?.partner_config;
      if (pc && pc.enabled) {
        setPartnerConfigFromLink(pc);
        const preFilled = (pc.pre_filled || []).map((pf, idx) => ({
          ...pf, id: pf.id || `pf_${idx}`, is_active: true, signature_status: 'Pending', address: pf.address || '', date_of_joining: pf.date_of_joining || '', _locked: true,
        }));
        const minExtra = Math.max(0, (pc.min_partners || 0) - preFilled.length);
        const emptySlots = Array.from({ length: minExtra }, (_, i) => ({
          id: `empty_${Date.now()}_${i}`, full_name: '', din: '', pan: '', aadhaar: '', email: '', phone: '', designation: '', date_of_joining: '', share_pct: '', signature_status: 'Pending', address: '', is_active: true, _locked: false,
        }));
        setPartners([...preFilled, ...emptySlots]);
      }
      const lang = res.data?.invite?.preferred_language || 'en';
      setPortalLang(lang);
      // Load translations BLOCKING — page shows loading state until translations arrive
      if (lang !== 'en') {
        setTranslationsLoading(true);
        const SARVAM_LANGS = { hi:'hi-IN', bn:'bn-IN', ta:'ta-IN', te:'te-IN', mr:'mr-IN', gu:'gu-IN', kn:'kn-IN', ml:'ml-IN', or:'od-IN', pa:'pa-IN' };
        const sarvamCode = SARVAM_LANGS[lang] || 'hi-IN';
        const firstName = res.data?.distributor?.first_name || res.data?.invite?.first_name || '';
        try {
          const tr = await axios.post(`${API}/api/sarvam/translate-labels`, {
            labels: {
              // Welcome screen
              welcome_greeting: 'Welcome, {name}!',
              welcome_subtitle: 'Complete your registration to get started',
              get_started: 'Get Started',
              // Navigation / Steps
              step_welcome: 'Welcome', step_videos: 'Watch Videos', step_form: 'Onboarding Form',
              step_status: 'Status & Agreement', step_comprehensive: 'Training Videos',
              next: 'Next', back: 'Back', continue_btn: 'Continue',
              continue_to_form: 'Continue to Onboarding Form',
              // Video step
              intro_videos: 'Introduction Videos',
              video_mandatory_note: 'The first video is mandatory. Remaining videos are optional — you may skip them to proceed.',
              video_single_note: 'Please watch the video to continue.',
              i_watched: 'I Watched This Video', please_watch: 'Please watch the video first...',
              video_completed: 'Video completed',
              required_label: 'Required', optional_label: 'Optional', completed_label: 'Completed',
              // Form step
              form_title: 'Distributor Onboarding Form',
              fields_mandatory: 'Fields marked with * are mandatory',
              save_draft: 'Save Draft', saving: 'Saving...', submit: 'Submit Form', submitting: 'Submitting...',
              // Entity type
              registered_entity: 'Registered Entity', private_entity: 'Unregistered Entity',
              unregistered_entity: 'Unregistered Entity',
              gst_registered_form: 'GST registered business form',
              non_gst_form: 'Non-GST / unregistered form',
              // GSTIN
              gstin_verification: 'GSTIN Verification',
              gstin_instruction: 'Enter your 15-character GSTIN. It will be verified automatically and company details will be auto-filled.',
              gstin_verified: 'GSTIN Verified', invalid_gstin: 'Invalid GSTIN',
              gstin_inactive: 'This GSTIN is inactive or invalid, please check and re-enter.',
              gst_maintenance: 'GST Verification Temporarily Unavailable',
              gst_maintenance_note: 'The GST government portal is under maintenance. You can proceed — your GSTIN will be verified later.',
              auto_filled_gstin: 'Auto-filled from GSTIN',
              auto_populated_gst: 'Auto-populated from GST',
              characters: 'characters',
              // Section titles
              basic_info: 'Basic Information', contact_info: 'Contact Information',
              address: 'Address', product_interest: 'Product Interest',
              compliance_docs: 'Compliance Documents', declaration: 'Declaration',
              // Field labels
              company_name: 'Company / Legal Entity Name', trade_name: 'Trade Name', business_type: 'Business Type',
              pan: 'PAN', gstin: 'GSTIN', cin: 'CIN', website: 'Website',
              contact_person_name: 'Contact Person Name', job_role: 'Job Role / Designation',
              phone: 'Phone Number', email: 'Email Address',
              registered_address: 'Registered Address', communication_address: 'Communication Address',
              same_as_registered: 'Same as Registered Address',
              country: 'Country', state: 'State', city: 'City', pincode: 'Pincode',
              expected_studies_per_month: 'Expected Studies per Month',
              signatory_name: 'Authorized Signatory Name', signatory_date: 'Date',
              year_of_incorporation: 'Year of Incorporation', from_gst: 'From GST',
              // Business types
              public_type: 'Public', private_type: 'Private', partnership: 'Partnership',
              sole_proprietor: 'Sole Proprietor', trust: 'Trust', other: 'Other',
              // Aadhaar
              aadhaar_number: 'Aadhaar Number', aadhaar_details: 'Aadhaar Details',
              aadhaar_partner_1: 'Aadhaar (Partner 1)', aadhaar_partner_2: 'Aadhaar (Partner 2)',
              aadhaar_note: 'UIDAI Aadhaar verification • Format: 12 digits with Verhoeff checksum',
              // Buttons
              verify: 'Verify', verified: 'Verified', valid: 'Valid', upload: 'Upload',
              send_otp: 'Send OTP', resend: 'Resend', enter_otp: 'Enter 6-digit OTP',
              // Placeholders
              enter_company: 'Enter company name', enter_name: 'Enter full name',
              enter_email: 'Enter email address', enter_phone: 'Enter phone number',
              enter_address: 'Enter address', enter_number: 'Enter number',
              // Helpers
              auto_filled: 'Auto-filled', optional: 'Optional',
              all_docs_optional: 'All documents are optional. Upload for faster processing.',
              studies_helper: 'Approximate number of Holter/MCT studies you expect to conduct monthly',
              date_auto: "Auto-filled to today's date",
              // Document labels
              pan_card: 'PAN Card', gst_certificate: 'GST Registration Certificate',
              business_registration: 'Business Registration',
              aadhaar_card: 'Aadhaar Card', photo: 'Photo',
              photo_partner_1: 'Photo (Partner 1)', photo_partner_2: 'Photo (Partner 2)',
              photo_upload_note: 'Photo Upload (Optional — JPG/PNG only)',
              uploaded: 'Uploaded',
              choose_file: 'Choose File',
              no_file_chosen: 'No file chosen',
              // Validation
              field_required: 'This field is required',
              invalid_email: 'Please enter a valid email address',
              invalid_phone: 'Please enter a valid phone number',
              accept_declaration: 'You must accept the declaration',
              // Declaration
              declaration_text: "I certify that the above information is true and accurate. I agree to comply with the company's procurement policies and terms.",
              // Status page (Step 3)
              onboarding_status: 'Onboarding Status',
              track_progress: 'Track your onboarding progress',
              last_updated: 'Last updated',
              agreement_status: 'Agreement Status',
              view_agreement_pdf: 'View Agreement PDF',
              comprehensive_unlocked: 'Comprehensive videos are now unlocked!',
              click_training: 'Click below to access training materials',
              view_videos: 'View Videos',
              // Step 4
              comprehensive_training: 'Comprehensive Training',
              advanced_training: 'Advanced training videos for BeatX Lite distributors',
              videos_locked: 'Comprehensive videos will be unlocked after your onboarding is approved',
              check_status: 'Check your status',
              back_to_status: 'Back to Status',
              // Form completion
              form_submitted: 'Form Submitted Successfully',
              thank_you: 'Thank you for completing the onboarding form. Our team will review your submission.',
            },
            target_language: sarvamCode
          });
          setTranslations(tr.data.translations || {});
        } catch {
          // Translation failed — fall back to English silently
        }
        setTranslationsLoading(false);
      }
      if (res.data.form_data?.data) setFormData(prev => ({...prev, ...res.data.form_data.data}));
      const status = res.data.distributor?.status;
      // Don't override step if user just submitted (prevents bounce-back)
      if (!formSubmittedRef.current) {
        if (['FORM_SUBMITTED', 'AGREEMENT_DRAFT_GENERATED', 'AGREEMENT_SENT', 'AWAITING_SIGNATURE', 'SIGNED_RECEIVED', 'COMPLIANCE_REVIEW', 'COMPLIANCE_APPROVED', 'COMPLIANCE_REJECTED', 'INVENTORY_PROCESSING', 'SHIPPED', 'SENT_TO_PROCUREMENT', 'FINANCE_NOTIFIED', 'ONBOARDING_COMPLETE'].includes(status)) {
          setCurrentStep(3);
        } else if (status === 'FORM_IN_PROGRESS') {
          setCurrentStep(2);
        } else if (status === 'VIDEOS_VIEWED') {
          setCurrentStep(2);
        }
      }
      if (res.data.distributor?.videos_watched) setAllVideosWatched(true);
      // If videos are not included, skip directly to form
      if (!formSubmittedRef.current && res.data.include_videos === false && !['FORM_SUBMITTED', 'AGREEMENT_DRAFT_GENERATED', 'AGREEMENT_SENT', 'AWAITING_SIGNATURE', 'SIGNED_RECEIVED', 'COMPLIANCE_REVIEW', 'COMPLIANCE_APPROVED', 'COMPLIANCE_REJECTED', 'INVENTORY_PROCESSING', 'SHIPPED', 'SENT_TO_PROCUREMENT', 'FINANCE_NOTIFIED', 'ONBOARDING_COMPLETE'].includes(status)) {
        setCurrentStep(2);
        setAllVideosWatched(true);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired link');
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Password verification for protected links ────────
  const verifyPassword = async () => {
    if (!passwordInput.trim()) { setPasswordError('Please enter the password'); return; }
    setPasswordVerifying(true);
    setPasswordError('');
    try {
      await axios.post(`${API}/api/portal/${token}/verify-password`, { password: passwordInput });
      // Password correct — reload full portal data bypassing password check
      setPasswordRequired(false);
      setLoading(true);
      // Re-fetch — server will return full data on second call since we just verified
      // Actually, the server returns password_required on GET. We need to pass password or use a session.
      // Simplest approach: store verified flag and re-fetch with a query param
      try {
        const res = await axios.get(`${API}/api/portal/${token}?verified=1`);
        if (!res.data?.password_required) {
          setData(res.data);
          const lang = res.data?.invite?.preferred_language || 'en';
          setPortalLang(lang);
        }
      } catch {}
      setLoading(false);
    } catch (err) {
      setPasswordError(err.response?.data?.detail || 'Incorrect password');
    }
    setPasswordVerifying(false);
  };

  // ─── A/B Metric Tracking ─────────────────────────────
  const trackMetric = useCallback((metric, value = 1) => {
    if (!variantId) return;
    axios.post(`${API}/api/portal-track`, { invite_id: variantId, metric, value }).catch(() => {});
  }, [variantId]);

  // Track view on data load
  useEffect(() => {
    if (data && !variantId) {
      const invId = data.invite?._id;
      if (invId) {
        setVariantId(invId);
        formLoadTime.current = Date.now();
        axios.post(`${API}/api/portal-track`, { invite_id: invId, metric: 'views' }).catch(() => {});
      }
    }
  }, [data, variantId]);

  // ─── Phone OTP handlers ─────────────────────────────
  const sendOtp = async () => {
    if (!formData.phone || formData.phone.trim().length < 6) {
      toast.error('Please enter a valid phone number first');
      return;
    }
    setOtpSending(true);
    try {
      const res = await axios.post(`${API}/api/portal/${token}/send-otp`, { phone: formData.phone });
      setOtpSent(true);
      setDemoOtp(res.data.demo_otp || '');
      toast.success('OTP sent! Check the notification log (demo mode).');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    }
    setOtpSending(false);
  };

  const verifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast.error('Please enter a 6-digit OTP');
      return;
    }
    setOtpVerifying(true);
    try {
      await axios.post(`${API}/api/portal/${token}/verify-otp`, { phone: formData.phone, otp: otpCode });
      setOtpVerified(true);
      toast.success('Phone number verified!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'OTP verification failed');
    }
    setOtpVerifying(false);
  };

  // ─── GSTIN verification handler ──────────────────────
  const verifyGstin = async (gstin) => {
    const cleaned = (gstin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length !== 15) return;
    
    // Check local cache first
    if (gstinCacheRef.current[cleaned]) {
      const cached = gstinCacheRef.current[cleaned];
      setGstinResult(cached);
      applyGstinData(cached);
      return;
    }
    
    setGstinVerifying(true);
    try {
      const res = await axios.get(`${API}/api/verify-gstin/${cleaned}`);
      const result = res.data;
      gstinCacheRef.current[cleaned] = result;
      setGstinResult(result);
      applyGstinData(result);
      
      if (result.valid && result.active) {
        toast.success(`GSTIN verified: ${result.trade_name || result.legal_name}`);
      } else if (result.maintenance) {
        toast.warning('GST verification service is temporarily unavailable. You can proceed and it will be verified later.');
      } else if (result.valid && !result.active) {
        toast.error(`GSTIN is ${result.status || 'Inactive'} — please check and re-enter`);
      } else {
        toast.error(result.error || 'GSTIN not found or invalid');
      }
    } catch (err) {
      setGstinResult({ valid: false, active: false, error: 'Verification failed' });
      toast.error('GSTIN verification failed');
    }
    setGstinVerifying(false);
  };

  const applyGstinData = (result) => {
    if (!result?.valid || !result?.active) return;
    setFormData(prev => {
      const updates = { ...prev };
      if (result.legal_name && !prev.company_name) updates.company_name = result.legal_name;
      if (result.trade_name) updates.trade_name = result.trade_name;
      if (result.state && !prev.state) updates.state = result.state;
      if (result.city && !prev.city) updates.city = result.city;
      if (result.pincode && result.pincode !== '0' && !prev.pincode) updates.pincode = result.pincode;
      if (result.address && !prev.registered_address) updates.registered_address = result.address;
      if (result.constitution && !prev.business_type) {
        const map = { 'Private Limited Company': 'Private', 'Public Limited Company': 'Public', 'Partnership': 'Partnership', 'Proprietorship': 'Sole Proprietor', 'Limited Liability Partnership': 'Partnership', 'Society': 'Public', 'Trust': 'Public', 'Government Department': 'Public', 'Hindu Undivided Family': 'Sole Proprietor' };
        const mapped = map[result.constitution];
        if (mapped) { updates.business_type = mapped; updates.business_type_from_gst = true; }
      }
      // Year of incorporation from GST registration date (format: dd/mm/yyyy)
      if (result.registration_date) {
        const parts = result.registration_date.split('/');
        if (parts.length === 3) { updates.year_established = parts[2]; updates.year_from_gst = true; }
      }
      updates.country = prev.country || 'India';
      return updates;
    });
  };

  // ─── Video handlers ─────────────────────────────────
  const handleVideoReady = (videoId) => {
    setVideosReady(prev => ({ ...prev, [videoId]: true }));
  };

  const handleVideoCheckChange = (videoId, checked) => {
    if (!videosReady[videoId] && checked) return;
    setVideosWatched(prev => ({ ...prev, [videoId]: checked }));
  };

  const markVideosWatched = async () => {
    try {
      await axios.post(`${API}/api/portal/${token}/videos-watched`);
      setAllVideosWatched(true);
      toast.success('Videos completed! Proceed to the onboarding form.');
      setCurrentStep(2);
      loadData();
    } catch (err) { toast.error('Failed to update'); }
  };

  // ─── Form handlers ─────────────────────────────────
  const validateForm = () => {
    const errors = {};
    const entityType = data?.distributor?.entity_type || data?.invite?.entity_type || 'registered';
    const businessType = formData.business_type || '';
    const reqFields = getRequiredFields(entityType, businessType, data?.invite?.invite_category, data?.invite?.standard_field_config || {});
    for (const f of reqFields) {
      const val = formData[f.key];
      if (!val || (typeof val === 'string' && !val.trim())) {
        errors[f.key] = `${f.label} is required`;
      }
    }
    // For registered entities: GSTIN must be verified and active (skip if maintenance)
    if (['registered', 'private_hospital', 'government_hospital'].includes(entityType) && formData.gstin) {
      if (gstinResult && !gstinResult.maintenance && (!gstinResult.valid || !gstinResult.active)) {
        errors.gstin = 'GSTIN must be verified and active before submitting';
      }
    }
    if (!formData.consent) {
      errors.consent = 'You must accept the declaration';
    }
    return errors;
  };

  const saveDraft = async () => {
    setFormSaving(true);
    try {
      await axios.post(`${API}/api/portal/${token}/form-draft`, formData);
      toast.success('Draft saved!');
    } catch (err) { toast.error('Failed to save draft'); }
    setFormSaving(false);
  };

  const submitForm = async () => {
    setFormTouched(true);
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstKey = Object.keys(errors)[0];
      toast.error(`Please fix ${Object.keys(errors).length} validation error(s). First: ${errors[firstKey]}`);
      // Scroll to first error
      const el = document.querySelector(`[data-field="${firstKey}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFormSubmitting(true);
    try {
      // Track A/B metrics
      if (variantId) {
        trackMetric('submissions');
        trackMetric('completed_count');
        if (formLoadTime.current) {
          const elapsed = Math.round((Date.now() - formLoadTime.current) / 1000);
          trackMetric('total_time', elapsed);
        }
      }
      // Include partners data in submission
      const submitData = { ...formData };
      if (partners.length > 0) {
        // Validate total share
        const totalShare = partners.reduce((s, p) => s + (parseFloat(p.share_pct) || 0), 0);
        if (totalShare > 100) { toast.error('Total partner share exceeds 100%'); setFormSubmitting(false); return; }
        submitData.partners = partners;
      }
      await axios.post(`${API}/api/portal/${token}/form-submit`, submitData);
      toast.success('Form submitted successfully!');
      // Clear saved form data
      try { localStorage.removeItem(storageKey); } catch {}
      formSubmittedRef.current = true;
      setCurrentStep(3);
      // Reload data WITHOUT resetting step — fetch fresh status only
      try {
        const res = await axios.get(`${API}/api/portal/${token}`);
        if (res.data && !res.data.password_required) setData(res.data);
      } catch {}
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed');
    }
    setFormSubmitting(false);
  };

  const uploadFile = async (fileType, file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('file_type', fileType);
    try {
      const res = await axios.post(`${API}/api/portal/${token}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadedFiles(prev => ({ ...prev, [fileType]: res.data }));
      setFormData(prev => ({ ...prev, [`${fileType}_file`]: res.data.file_path }));
      toast.success(`${fileType.replace(/_/g, ' ')} uploaded!`);
    } catch (err) { toast.error('Upload failed'); }
  };

  // Helper: check if field has error and form was touched
  const hasError = (key) => formTouched && formErrors[key];

  // ─── Loading / Error states ─────────────────────────
  if (loading || translationsLoading) return <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 gap-3"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />{translationsLoading && <p className="text-sm text-muted-foreground animate-pulse">Loading translations...</p>}</div>;
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 px-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-8 pb-8">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4"><Activity className="w-8 h-8 text-rose-500" /></div>
          <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: 'Space Grotesk' }}>Link Error</h2>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    </div>
  );

  // Password gate for protected links
  if (passwordRequired) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 px-4">
      <Card className="max-w-sm w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold mb-1" style={{ fontFamily: 'Space Grotesk' }}>Password Required</h2>
          <p className="text-sm text-muted-foreground mb-6">This onboarding link is password protected. Enter the password provided by your contact.</p>
          <div className="space-y-3">
            <Input type="password" value={passwordInput} onChange={e => { setPasswordInput(e.target.value); setPasswordError(''); }} placeholder="Enter password" className={`text-center ${passwordError ? 'border-red-400' : ''}`} onKeyDown={e => e.key === 'Enter' && verifyPassword()} data-testid="portal-password-input" />
            {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
            <Button onClick={verifyPassword} disabled={passwordVerifying} className="w-full" data-testid="portal-password-submit">{passwordVerifying ? 'Verifying...' : 'Continue'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const dist = data?.distributor;
  const showComprehensive = data?.show_comprehensive;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Brand Header */}
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <img src="/beatx-logo.jpeg" alt="BeatX" className="h-8 object-contain" />
          <Badge variant="outline" className="text-xs">{dist?.first_name} {dist?.last_name}</Badge>
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-white/80 backdrop-blur-sm border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground sm:hidden">Step {currentStep + 1} of {STEPS.length}</span>
            <div className="hidden sm:flex items-center gap-1 w-full">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isActive = i === currentStep;
                const isDone = i < currentStep || (i === 4 && showComprehensive);
                const isLocked = i === 4 && !showComprehensive;
                return (
                  <React.Fragment key={step.id}>
                    {i > 0 && <div className={`flex-1 h-px ${isDone ? 'bg-primary' : 'bg-border'}`} />}
                    <button
                      onClick={() => { if (isDone || isActive) setCurrentStep(i); }}
                      disabled={isLocked}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md whitespace-nowrap transition-colors duration-150 ${isActive ? 'bg-primary/10 text-primary font-medium' : isDone ? 'text-primary' : isLocked ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}
                    >
                      {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : isLocked ? <Lock className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                      <span className="hidden lg:inline">{t(`step_${step.id}`, step.label)}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          <Progress value={((currentStep + 1) / STEPS.length) * 100} className="mt-2 h-1.5 sm:hidden" />
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">

        {/* ═══ Step 0: Welcome ═══ */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-cyan-50 p-6 sm:p-8">
                <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                  {t('welcome_greeting', `Welcome, {name}!`).replace('{name}', dist?.first_name || '')}
                </h1>
                <p className="text-muted-foreground">
                  {t('welcome_subtitle', 'Complete your registration to get started')}
                </p>
              </div>
              <CardContent className="p-6">
                <Button data-testid="distributor-welcome-start-button" className="mt-2 w-full sm:w-auto" onClick={() => setCurrentStep(1)}>
                  {t('get_started', 'Get Started')} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══ Step 1: Videos ═══ */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>{t('intro_videos', 'Introduction Videos')}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {data?.initial_videos?.length > 1
                  ? t('video_mandatory_note', 'The first video is mandatory. Remaining videos are optional — you may skip them to proceed.')
                  : t('video_single_note', 'Please watch the video to continue.')}
              </p>
            </div>

            {data?.initial_videos?.map((v, vIdx) => {
              const isReady = !!videosReady[v._id];
              const isChecked = !!videosWatched[v._id];
              const isFirst = vIdx === 0;
              const isMandatory = isFirst;

              return (
                <Card key={v._id} className={`overflow-hidden ${isChecked ? 'border-emerald-200' : isMandatory ? 'border-primary/30' : ''}`} data-testid="distributor-step1-video-player">
                  <CardContent className="p-0">
                    {/* Video header */}
                    <div className="px-4 py-3 flex items-center gap-3 border-b bg-muted/20">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isChecked ? 'bg-emerald-100 text-emerald-700' : isMandatory ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {isChecked ? <CheckCircle className="w-4 h-4" /> : vIdx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm">{v.title}</h3>
                        <p className="text-xs text-muted-foreground">{v.description} {v.duration && `— ${v.duration}`}</p>
                      </div>
                      {isMandatory && !isChecked && <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">{t('required_label', 'Required')}</Badge>}
                      {!isMandatory && !isChecked && <Badge variant="outline" className="text-[10px] text-muted-foreground">{t('optional_label', 'Optional')}</Badge>}
                      {isChecked && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">{t('completed_label', 'Completed')}</Badge>}
                    </div>

                    {/* Video player — full width, no side icon */}
                    {!isChecked && (
                      <div className="p-4">
                        <VideoPlayer url={v.url} title={v.title} onWatched={() => handleVideoReady(v._id)} />
                      </div>
                    )}

                    {/* Action button — large and prominent */}
                    <div className="px-4 pb-4">
                      {isChecked ? (
                        <div className="flex items-center gap-2 text-emerald-700 text-sm"><CheckCircle className="w-4 h-4" /> {t('video_completed', 'Video completed')}</div>
                      ) : (
                        <Button
                          className={`w-full h-12 text-sm font-semibold ${isReady ? 'bg-primary hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                          disabled={!isReady}
                          onClick={() => {
                            handleVideoCheckChange(v._id, true);
                          }}
                        >
                          {isReady ? (
                            <><CheckCircle className="w-4 h-4 mr-2" /> {t('i_watched', 'I Watched This Video')}</>
                          ) : (
                            <><Clock className="w-4 h-4 mr-2" /> {t('please_watch', 'Please watch the video first...')}</>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setCurrentStep(0)}><ChevronLeft className="w-4 h-4 mr-1" /> {t('back', 'Back')}</Button>
              <Button
                data-testid="distributor-step1-next-button"
                onClick={markVideosWatched}
                disabled={!videosWatched[data?.initial_videos?.[0]?._id]}
                className="h-12 px-8"
              >
                {t('continue_to_form', 'Continue to Onboarding Form')} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══ Step 2: Onboarding Form ═══ */}
        {currentStep === 2 && (
          <div className="space-y-6" onFocusCapture={() => { if (!formStartTracked && variantId) { setFormStartTracked(true); trackMetric('form_starts'); } }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>{t('form_title', 'Distributor Onboarding Form')}</h2>
                <p className="text-sm text-muted-foreground">{t('fields_mandatory', 'Fields marked with')} <span className="text-red-500">*</span> {portalLang === 'en' ? 'are mandatory' : ''}</p>
              </div>
              <Button variant="outline" size="sm" onClick={saveDraft} disabled={formSaving} data-testid="distributor-form-save-draft-button"><Save className="w-3 h-3 mr-1" />{formSaving ? t('saving', 'Saving...') : t('save_draft', 'Save Draft')}</Button>
            </div>

            {/* Entity type banner */}
            <div className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${(data?.distributor?.entity_type || data?.invite?.entity_type) === 'registered' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <ShieldCheck className="w-4 h-4" />
              <span className="font-medium">{(() => {
                const et = data?.distributor?.entity_type || data?.invite?.entity_type || 'registered';
                const cat = data?.invite?.invite_category;
                if (cat === 'hospital') return et === 'private_hospital' ? 'Private Hospital' : 'Government Hospital';
                return et === 'registered' ? t('registered_entity', 'Registered Entity') : t('unregistered_entity', 'Unregistered Entity');
              })()}</span>
              <span className="text-xs opacity-75">— {(() => {
                const et = data?.distributor?.entity_type || data?.invite?.entity_type || 'registered';
                const cat = data?.invite?.invite_category;
                if (cat === 'hospital') return 'GST registered — GSTIN verification required';
                return et === 'registered' ? t('gst_registered_form', 'GST registered business form') : t('non_gst_form', 'Non-GST / unregistered form');
              })()}</span>
            </div>

            {/* GSTIN Verification (shown for registered entities and all hospitals, unless disabled by config) */}
            {(() => {
              const gstCfg = (data?.invite?.standard_field_config || {}).gstin;
              if (gstCfg && gstCfg.enabled === false) return null;
              const isRegistered = ['registered', 'private_hospital', 'government_hospital'].includes(data?.distributor?.entity_type || data?.invite?.entity_type);
              if (!isRegistered && !gstCfg) return null;
              const gstRequired = gstCfg ? (gstCfg.required !== false) : isRegistered;
              return (
              <Card className="border-primary/30" data-testid="distributor-form-gstin-verify">
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> GSTIN Verification {gstRequired && <span className="text-red-500">*</span>}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">Enter your 15-character GSTIN. It will be verified automatically and company details will be auto-filled.</p>
                  <div className="space-y-2" data-field="gstin">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 space-y-1">
                        <Input
                          value={formData.gstin || ''}
                          onChange={e => {
                            const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
                            setFormData({...formData, gstin: val, billing_gstin: val});
                            if (val.length < 15) { setGstinResult(null); }
                          }}
                          onBlur={() => {
                            if ((formData.gstin || '').length === 15) verifyGstin(formData.gstin);
                          }}
                          placeholder="e.g., 33AANCR6153P1ZQ"
                          maxLength={15}
                          className={`font-mono tracking-wider text-sm uppercase ${
                            gstinResult?.valid && gstinResult?.active ? 'border-emerald-400 bg-emerald-50/50' :
                            gstinResult && (!gstinResult.valid || !gstinResult.active) ? 'border-red-400 bg-red-50/50' :
                            hasError('gstin') ? 'border-red-400' : ''
                          }`}
                        />
                        <p className="text-[10px] text-muted-foreground">{(formData.gstin || '').length}/15 characters</p>
                      </div>
                      {gstinVerifying && <div className="pt-2"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" /></div>}
                      {gstinResult?.valid && gstinResult?.active && <div className="pt-2"><CheckCircle className="w-5 h-5 text-emerald-600" /></div>}
                      {gstinResult?.maintenance && <div className="pt-2"><AlertCircle className="w-5 h-5 text-amber-500" /></div>}
                      {gstinResult && !gstinResult.maintenance && (!gstinResult.valid || !gstinResult.active) && <div className="pt-2"><XCircle className="w-5 h-5 text-red-500" /></div>}
                    </div>
                    {gstinResult?.valid && gstinResult?.active && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm space-y-1">
                        <div className="flex items-center gap-2 text-emerald-800"><CheckCircle className="w-4 h-4" /><span className="font-medium">GSTIN Verified — {gstinResult.status}</span></div>
                        <p className="text-xs text-emerald-700">Legal Name: <strong>{gstinResult.legal_name}</strong></p>
                        {gstinResult.trade_name && gstinResult.trade_name !== gstinResult.legal_name && <p className="text-xs text-emerald-700">Trade Name: {gstinResult.trade_name}</p>}
                        <p className="text-xs text-emerald-700">{gstinResult.constitution} | Registered: {gstinResult.registration_date}</p>
                        {gstinResult.address && <p className="text-xs text-emerald-700">{gstinResult.address}</p>}
                      </div>
                    )}
                    {gstinResult && (!gstinResult.valid || !gstinResult.active) && !gstinResult.maintenance && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                        <div className="flex items-center gap-2 text-red-800"><XCircle className="w-4 h-4" /><span className="font-medium">{gstinResult.status ? `GSTIN is ${gstinResult.status}` : 'Invalid GSTIN'}</span></div>
                        <p className="text-xs text-red-700 mt-1">{gstinResult.error || 'This GSTIN is inactive or invalid, please check and re-enter.'}</p>
                      </div>
                    )}
                    {gstinResult?.maintenance && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                        <div className="flex items-center gap-2 text-amber-800"><AlertCircle className="w-4 h-4" /><span className="font-medium">GST Verification Temporarily Unavailable</span></div>
                        <p className="text-xs text-amber-700 mt-1">The GST government portal is under maintenance. You can proceed — your GSTIN will be verified later.</p>
                      </div>
                    )}
                    <FieldError show={hasError('gstin')} />
                  </div>
                </CardContent>
              </Card>
              );
            })()}

            {/* Section 1: Basic Information */}
            <Card data-testid="distributor-form-section-basic-info">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Building className="w-4 h-4" /> {t('basic_info', 'Basic Information')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2" data-field="company_name">
                  <ReqLabel fieldKey="company_name" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>
                    {data?.invite?.invite_category === 'hospital' ? tl('hospital_name', 'Hospital or Clinic Name') : tl('company_name', 'Company / Legal Entity Name')}
                  </ReqLabel>
                  <Input value={formData.company_name || ''} onChange={e => setFormData({...formData, company_name: e.target.value})} className={`${hasError('company_name') ? 'border-red-400' : ''} ${gstinResult?.valid && gstinResult?.active && formData.company_name === gstinResult.legal_name ? 'bg-emerald-50/30' : ''}`} />
                  {gstinResult?.valid && gstinResult?.active && formData.company_name === gstinResult.legal_name && <p className="text-[10px] text-emerald-600">Auto-filled from GSTIN</p>}
                  <FieldError show={hasError('company_name')} />
                </div>
                <div className="space-y-2" data-field="trade_name">
                  <ReqLabel fieldKey="trade_name" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('trade_name', 'Trade Name')}</ReqLabel>
                  <Input value={formData.trade_name || ''} onChange={e => setFormData({...formData, trade_name: e.target.value})} className={`${hasError('trade_name') ? 'border-red-400' : ''} ${gstinResult?.valid && gstinResult?.active && formData.trade_name === gstinResult.trade_name ? 'bg-emerald-50/30' : ''}`} />
                  {gstinResult?.valid && gstinResult?.active && formData.trade_name === gstinResult.trade_name && <p className="text-[10px] text-emerald-600">Auto-filled from GSTIN</p>}
                  <FieldError show={hasError('trade_name')} />
                </div>
                <div className="space-y-2" data-field="business_type">
                  <ReqLabel fieldKey="business_type" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('business_type', 'Business Type')}</ReqLabel>
                  {formData.business_type_from_gst && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 mb-1">{t('auto_populated_gst', 'Auto-populated from GST')}</Badge>
                  )}
                  <RadioGroup value={formData.business_type || ''} onValueChange={v => { if (!formData.business_type_from_gst) setFormData({...formData, business_type: v}); }} className="flex flex-wrap gap-4" disabled={formData.business_type_from_gst}>
                    {['Public', 'Private', 'Partnership', 'Sole Proprietor', 'Trust', 'Other'].map(bt => {
                      const tKey = bt.toLowerCase().replace(/ /g,'_');
                      const label = translations[tKey + '_type'] || translations[tKey] || bt;
                      return (
                        <div key={bt} className={`flex items-center gap-2 ${formData.business_type_from_gst ? 'opacity-70' : ''}`}><RadioGroupItem value={bt} id={`bt-${bt}`} disabled={formData.business_type_from_gst} /><Label htmlFor={`bt-${bt}`} className="text-sm font-normal">{label}</Label></div>
                      );
                    })}
                  </RadioGroup>
                  <FieldError show={hasError('business_type')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Year of Incorporation — shown only when GST provides it */}
                  {formData.year_from_gst && formData.year_established && (
                    <div className="space-y-2">
                      <Label className="text-sm">Year of Incorporation</Label>
                      <div className="flex items-center gap-2">
                        <Input value={formData.year_established} readOnly className="bg-muted/50 font-mono w-24" />
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">From GST</Badge>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2" data-field="website">
                    <ReqLabel fieldKey="website" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('website', 'Website')}</ReqLabel>
                    <Input value={formData.website || ''} onChange={e => setFormData({...formData, website: e.target.value})} className={hasError('website') ? 'border-red-400' : ''} />
                    <FieldError show={hasError('website')} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2" data-field="cin">
                    <ReqLabel fieldKey="cin" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('cin', 'CIN')}</ReqLabel>
                    <Input value={formData.cin || ''} onChange={e => setFormData({...formData, cin: e.target.value})} />
                  </div>
                  <div className="space-y-2" data-field="pan">
                    <ReqLabel fieldKey="pan" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('pan', 'PAN')}</ReqLabel>
                    <Input value={formData.pan || ''} onChange={e => setFormData({...formData, pan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)})} placeholder="ABCDE1234F" maxLength={10} className={`font-mono tracking-wider ${hasError('pan') ? 'border-red-400' : ''}`} />
                    <FieldError show={hasError('pan')} />
                  </div>
                </div>
                {/* Aadhaar Number fields - only for distributors (not hospitals) */}
                {data?.invite?.invite_category !== 'hospital' && (() => {
                  const bt = formData.business_type;
                  const isSole = bt === 'Sole Proprietor';
                  const isPartnership = bt === 'Partnership';
                  const stdCfg = data?.invite?.standard_field_config || {};
                  const aadhaarCfg = stdCfg.aadhaar_1;
                  // If config explicitly disables it, hide
                  if (aadhaarCfg && aadhaarCfg.enabled === false) return null;
                  // If config explicitly enables it, show regardless of business type
                  // If no config, only show for Sole Proprietor / Partnership
                  const shouldShow = aadhaarCfg ? (aadhaarCfg.enabled !== false) : (isSole || isPartnership);
                  if (!shouldShow) return null;
                  const aadhaarCount = isPartnership ? 2 : 1;
                  const isMandatory = aadhaarCfg ? (aadhaarCfg.required !== false) : (isSole || isPartnership);

                  const formatAadhaar = (val) => {
                    const digits = val.replace(/\D/g, '').slice(0, 12);
                    const parts = [];
                    for (let i = 0; i < digits.length; i += 4) parts.push(digits.slice(i, i + 4));
                    return parts.join(' ');
                  };

                  const verifyAadhaar = async (fieldKey) => {
                    const raw = (formData[fieldKey] || '').replace(/\s/g, '');
                    if (raw.length !== 12) { toast.error('Enter complete 12-digit Aadhaar number'); return; }
                    try {
                      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || ''}/api/aadhaar/validate`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ aadhaar: raw })
                      });
                      const data = await res.json();
                      if (data.valid && data.verified) {
                        toast.success(`Aadhaar verified! Name: ${data.data.name}, State: ${data.data.state}`);
                        setFormData(prev => ({ ...prev, [`${fieldKey}_verified`]: true, [`${fieldKey}_name`]: data.data.name }));
                      } else if (data.valid) {
                        toast.success('Aadhaar format valid (checksum OK)');
                        setFormData(prev => ({ ...prev, [`${fieldKey}_verified`]: 'format_ok' }));
                      } else {
                        toast.error(data.error || 'Invalid Aadhaar');
                      }
                    } catch { toast.error('Verification service unavailable'); }
                  };

                  return (
                    <div className="space-y-3 pt-2 border-t mt-2">
                      <p className="text-xs text-muted-foreground font-medium">Aadhaar Details {isMandatory ? <span className="text-red-500">*</span> : '(Optional)'}</p>
                      <div className={`grid ${isPartnership ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-4`}>
                        {Array.from({ length: aadhaarCount }, (_, idx) => {
                          const fieldKey = `aadhaar_${idx + 1}`;
                          const verified = formData[`${fieldKey}_verified`];
                          return (
                            <div key={fieldKey} className="space-y-2" data-field={fieldKey}>
                              <ReqLabel fieldKey={fieldKey} distributorType={data?.distributor?.entity_type || 'registered'} businessType={bt}>
                                {isPartnership ? `Aadhaar (Partner ${idx + 1})` : 'Aadhaar Number'}
                              </ReqLabel>
                              <div className="flex gap-2">
                                <Input
                                  value={formData[fieldKey] || ''}
                                  onChange={e => setFormData({ ...formData, [fieldKey]: formatAadhaar(e.target.value), [`${fieldKey}_verified`]: false })}
                                  placeholder="XXXX XXXX XXXX"
                                  maxLength={14}
                                  className={`flex-1 font-mono tracking-widest ${hasError(fieldKey) ? 'border-red-400' : verified === true ? 'border-emerald-400' : ''}`}
                                />
                                {verified === true ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0 h-9 flex items-center"><CheckCircle className="w-3 h-3 mr-1" />Verified</Badge>
                                ) : verified === 'format_ok' ? (
                                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 shrink-0 h-9 flex items-center"><CheckCircle className="w-3 h-3 mr-1" />Valid</Badge>
                                ) : (
                                  <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => verifyAadhaar(fieldKey)} disabled={(formData[fieldKey] || '').replace(/\s/g, '').length !== 12}>
                                    Verify
                                  </Button>
                                )}
                              </div>
                              {formData[`${fieldKey}_name`] && <p className="text-xs text-emerald-600">Name: {formData[`${fieldKey}_name`]}</p>}
                              <FieldError show={hasError(fieldKey)} />
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-muted-foreground">UIDAI Aadhaar verification • Format: 12 digits with Verhoeff checksum</p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Dynamic Partners Section */}
            {(() => {
              const bt = formData.business_type;
              const pcEnabled = partnerConfigFromLink?.enabled;
              const showPartners = pcEnabled || (bt === 'Partnership');
              if (!showPartners) return null;

              const maxP = partnerConfigFromLink?.max_partners || 20;
              const lockedFields = partnerConfigFromLink?.locked_fields || [];
              const canAddMore = partners.length < maxP;
              const addPartner = () => {
                if (!canAddMore) { toast.info(`Maximum ${maxP} partners allowed`); return; }
                setPartners(prev => [...prev, { id: `p_${Date.now()}`, full_name: '', din: '', pan: '', aadhaar: '', email: '', phone: '', designation: '', date_of_joining: '', share_pct: '', signature_status: 'Pending', address: '', is_active: true, _locked: false }]);
                setExpandedPartner(partners.length);
              };
              const updatePartner = (idx, key, val) => {
                const p = partners[idx];
                // Prevent editing locked fields on pre-filled partners
                if (p?._locked && lockedFields.includes(key) && p[key]) return;
                setPartners(prev => prev.map((pp, i) => i === idx ? { ...pp, [key]: val } : pp));
              };
              const removePartner = (idx) => {
                if (partners[idx]?._locked) { toast.error('Pre-configured partners cannot be removed'); return; }
                setPartners(prev => prev.filter((_, i) => i !== idx));
                toast.success(`Partner ${idx + 1} removed`);
              };
              const movePartner = (idx, dir) => {
                const ni = idx + dir;
                if (ni < 0 || ni >= partners.length) return;
                setPartners(prev => { const arr = [...prev]; [arr[idx], arr[ni]] = [arr[ni], arr[idx]]; return arr; });
              };
              const totalShare = partners.reduce((s, p) => s + (parseFloat(p.share_pct) || 0), 0);
              const shareValid = totalShare <= 100;

              const handlePartnerDragEnd = (event) => {
                const { active, over } = event;
                if (active.id !== over?.id) {
                  const oldIdx = partners.findIndex(p => p.id === active.id);
                  const newIdx = partners.findIndex(p => p.id === over.id);
                  if (oldIdx !== -1 && newIdx !== -1) setPartners(arrayMove(partners, oldIdx, newIdx));
                }
              };

              return (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Partners / Directors</CardTitle>
                      <Button type="button" variant="outline" size="sm" onClick={addPartner} disabled={!canAddMore} className="gap-1 text-xs"><Plus className="w-3 h-3" /> Add Partner</Button>
                      <label className="cursor-pointer">
                        <Button type="button" variant="outline" size="sm" className="gap-1 text-xs" asChild><span><Upload className="w-3 h-3" /> Import CSV</span></Button>
                        <input type="file" accept=".csv,.xlsx" className="hidden" onChange={async (e) => {
                          const file = e.target.files[0]; if (!file) return;
                          try {
                            const fd = new FormData(); fd.append('file', file);
                            const res = await axios.post(`${API}/api/partner-import-validate`, fd, { headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${localStorage.getItem('beatx_token')}` } });
                            if (res.data?.partners) {
                              setPartners(prev => [...prev, ...res.data.partners.map(p => ({ ...p, _locked: false }))]);
                              toast.success(`${res.data.count} partner(s) imported`);
                            }
                          } catch (err) {
                            const detail = err.response?.data?.detail;
                            if (detail?.errors) {
                              toast.error(`${detail.message}`);
                              detail.errors.forEach(e => toast.error(`Row ${e.row}: ${e.field} — ${e.error}`, { duration: 6000 }));
                            } else { toast.error(typeof detail === 'string' ? detail : 'Import failed'); }
                          }
                          e.target.value = '';
                        }} />
                      </label>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{partners.length} partner(s) added {totalShare > 0 ? `• Total share: ${totalShare.toFixed(1)}%` : ''} {!shareValid ? <span className="text-red-500 font-medium">— exceeds 100%!</span> : ''}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {partners.length === 0 && (
                      <div className="py-6 text-center border-2 border-dashed rounded-xl">
                        <Users className="w-6 h-6 mx-auto text-muted-foreground/20 mb-2" />
                        <p className="text-xs text-muted-foreground">No partners added yet. Click "Add Partner" above.</p>
                      </div>
                    )}
                    <DndContext sensors={partnerDndSensors} collisionDetection={closestCenter} onDragEnd={handlePartnerDragEnd}>
                    <SortableContext items={partners.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    {partners.map((p, idx) => {
                      const isOpen = expandedPartner === idx;
                      return (
                        <SortablePartnerItem key={p.id} p={p} idx={idx} isOpen={isOpen}
                          setExpandedPartner={setExpandedPartner} movePartner={movePartner}
                          updatePartner={updatePartner} removePartner={removePartner}
                          lockedFields={lockedFields} shareValid={shareValid} />
                      );
                    })}
                    </SortableContext>
                    </DndContext>
                    {partners.length > 0 && canAddMore && (
                      <Button type="button" variant="outline" size="sm" onClick={addPartner} className="w-full gap-1 border-dashed text-xs"><Plus className="w-3 h-3" /> Add Another Partner</Button>
                    )}
                    {!canAddMore && partners.length > 0 && <p className="text-[10px] text-muted-foreground text-center">Maximum {maxP} partners reached</p>}
                  </CardContent>
                </Card>
              );
            })()}

            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" /> {t('contact_info', 'Contact Information')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* Primary Contact */}
                {data?.invite?.invite_category === 'hospital' && <p className="text-xs font-semibold text-primary">Primary Contact *</p>}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2" data-field="contact_person_name"><ReqLabel fieldKey="contact_person_name" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('contact_person_name', 'Contact Person Name')}</ReqLabel><Input value={formData.contact_person_name || ''} onChange={e => setFormData({...formData, contact_person_name: e.target.value})} className={hasError('contact_person_name') ? 'border-red-400' : ''} /><FieldError show={hasError('contact_person_name')} /></div>
                  <div className="space-y-2" data-field="job_role"><ReqLabel fieldKey="job_role" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('job_role', data?.invite?.invite_category === 'hospital' ? 'Designation' : 'Job Role')}</ReqLabel><Input value={formData.job_role || ''} onChange={e => setFormData({...formData, job_role: e.target.value})} className={hasError('job_role') ? 'border-red-400' : ''} /><FieldError show={hasError('job_role')} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2" data-field="phone">
                    <ReqLabel fieldKey="phone" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('phone', 'Phone Number')}</ReqLabel>
                    <Input value={formData.phone || ''} onChange={e => { const digits = e.target.value.replace(/\D/g, '').slice(0, 10); setFormData({...formData, phone: digits}); }} className={`${hasError('phone') ? 'border-red-400' : ''}`} placeholder="10-digit mobile number" maxLength={10} />
                    <p className="text-[10px] text-muted-foreground">{(formData.phone || '').length}/10 digits</p>
                    <FieldError show={hasError('phone')} />
                  </div>
                  <div className="space-y-2" data-field="email">
                    <ReqLabel fieldKey="email" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('email', 'Email Address')}</ReqLabel>
                    <Input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className={`${hasError('email') ? 'border-red-400' : ''}`} placeholder="email@example.com" />
                    <FieldError show={hasError('email')} />
                  </div>
                </div>

                {/* Secondary Contact — Hospital only */}
                {data?.invite?.invite_category === 'hospital' && (
                  <>
                    <div className="border-t pt-4 mt-2">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">Secondary Contact <span className="font-normal text-muted-foreground/60">(Optional)</span></p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Secondary Contact Name</Label><Input value={formData.secondary_contact_name || ''} onChange={e => setFormData({...formData, secondary_contact_name: e.target.value})} placeholder="Full name" /></div>
                      <div className="space-y-2"><Label>Designation</Label><Input value={formData.secondary_contact_designation || ''} onChange={e => setFormData({...formData, secondary_contact_designation: e.target.value})} placeholder="e.g. Head of Department" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Phone</Label><Input value={formData.secondary_phone || ''} onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 10); setFormData({...formData, secondary_phone: d}); }} placeholder="10-digit" maxLength={10} /></div>
                      <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.secondary_email || ''} onChange={e => setFormData({...formData, secondary_email: e.target.value})} placeholder="email@example.com" /></div>
                    </div>
                  </>
                )}

                {/* Reference Doctor — Hospital only */}
                {data?.invite?.invite_category === 'hospital' && (
                  <div className="border-t pt-4">
                    <div className="space-y-2"><Label>Reference Doctor Name <span className="text-muted-foreground text-[10px]">(Optional)</span></Label><Input value={formData.reference_doctor || ''} onChange={e => setFormData({...formData, reference_doctor: e.target.value})} placeholder="Dr. Full Name" /></div>
                  </div>
                )}

                {/* Territory — Hospital only (mandatory) */}
                {data?.invite?.invite_category === 'hospital' && (
                  <div className="space-y-2" data-field="territory">
                    <ReqLabel fieldKey="territory" distributorType="registered">Regional / Territory</ReqLabel>
                    <Input value={formData.territory || ''} onChange={e => setFormData({...formData, territory: e.target.value})} className={hasError('territory') ? 'border-red-400' : ''} placeholder="e.g. South India, Karnataka" />
                    <FieldError show={hasError('territory')} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section 3: Address */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4" /> {t('address', 'Address')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2" data-field="registered_address"><ReqLabel fieldKey="registered_address" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('registered_address', 'Registered Address')}</ReqLabel><Textarea value={formData.registered_address || ''} onChange={e => setFormData({...formData, registered_address: e.target.value})} rows={2} className={hasError('registered_address') ? 'border-red-400' : ''} /><FieldError show={hasError('registered_address')} /></div>
                <div className="space-y-2" data-field="communication_address">
                  <div className="flex items-center justify-between">
                    <ReqLabel fieldKey="communication_address" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('communication_address', 'Communication Address')}</ReqLabel>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                      <input type="checkbox" className="rounded" checked={formData.comm_same_as_reg || false} onChange={e => {
                        const same = e.target.checked;
                        setFormData(prev => ({ ...prev, comm_same_as_reg: same, communication_address: same ? prev.registered_address : prev.communication_address }));
                      }} />
                      {t('same_as_registered', 'Same as Registered Address')}
                    </label>
                  </div>
                  <Textarea value={formData.communication_address || ''} onChange={e => setFormData({...formData, communication_address: e.target.value, comm_same_as_reg: false})} rows={2} className={hasError('communication_address') ? 'border-red-400' : ''} disabled={formData.comm_same_as_reg} />
                  <FieldError show={hasError('communication_address')} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-2" data-field="country"><ReqLabel fieldKey="country" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('country', 'Country')}</ReqLabel><Input value={formData.country || 'India'} onChange={e => setFormData({...formData, country: e.target.value})} className={hasError('country') ? 'border-red-400' : ''} /><FieldError show={hasError('country')} /></div>
                  <div className="space-y-2" data-field="state"><ReqLabel fieldKey="state" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('state', 'State')}</ReqLabel><Input value={formData.state || ''} onChange={e => setFormData({...formData, state: e.target.value})} className={hasError('state') ? 'border-red-400' : ''} /><FieldError show={hasError('state')} /></div>
                  <div className="space-y-2" data-field="city"><ReqLabel fieldKey="city" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('city', 'City')}</ReqLabel><Input value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} className={hasError('city') ? 'border-red-400' : ''} /><FieldError show={hasError('city')} /></div>
                  <div className="space-y-2" data-field="pincode"><ReqLabel fieldKey="pincode" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('pincode', 'Pincode')}</ReqLabel><Input value={formData.pincode || ''} onChange={e => setFormData({...formData, pincode: e.target.value.replace(/\D/g, '').slice(0, 6)})} maxLength={6} className={hasError('pincode') ? 'border-red-400' : ''} /><FieldError show={hasError('pincode')} /></div>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Product Interest */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4" /> {t('product_interest', 'Product Interest')}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-w-sm" data-field="expected_studies_per_month">
                  <ReqLabel fieldKey="expected_studies_per_month" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('expected_studies_per_month', 'Expected Studies per Month')}</ReqLabel>
                  <Input type="number" min="0" value={formData.expected_studies_per_month || ''} onChange={e => setFormData({...formData, expected_studies_per_month: e.target.value.replace(/\D/g, '')})} placeholder="Enter number" className={`font-mono text-lg ${hasError('expected_studies_per_month') ? 'border-red-400' : ''}`} />
                  <p className="text-[10px] text-muted-foreground">{t('studies_helper', 'Approximate number of Holter/MCT studies you expect to conduct monthly')}</p>
                  <FieldError show={hasError('expected_studies_per_month')} />
                </div>
              </CardContent>
            </Card>

            {/* Section 5: Compliance Documents (all optional) */}
            <Card data-testid="distributor-form-upload-zone">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><Upload className="w-4 h-4" /> {t('compliance_docs', 'Compliance Documents')}</CardTitle>
                <CardDescription className="text-xs">{t('all_docs_optional', 'All documents are optional. Upload for faster processing.')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-0.5">{t('pan_card', 'PAN Card')}</Label>
                  <div className="border-2 border-dashed rounded-xl p-4 bg-white/70 hover:bg-white transition-colors">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TranslatedFileInput accept=".pdf,.jpg,.jpeg,.png" onChange={f => uploadFile('pan_card', f)} />
                      <CameraCapture label={t('use_camera', 'Use Camera')} onCapture={(file) => uploadFile('pan_card', file)} />
                    </div>
                    {uploadedFiles.pan_card && <p className="text-xs text-emerald-600 mt-1">{t('uploaded', 'Uploaded')}: {uploadedFiles.pan_card.file_name}</p>}
                  </div>
                </div>
                {(data?.distributor?.entity_type || data?.invite?.entity_type) === 'registered' && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-0.5">{t('gst_certificate', 'GST Registration Certificate')}</Label>
                    <div className="border-2 border-dashed rounded-xl p-4 bg-white/70 hover:bg-white transition-colors">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TranslatedFileInput accept=".pdf,.jpg,.jpeg,.png" onChange={f => uploadFile('gst_certificate', f)} />
                        <CameraCapture label={t('use_camera', 'Use Camera')} onCapture={(file) => uploadFile('gst_certificate', file)} />
                      </div>
                      {uploadedFiles.gst_certificate && <p className="text-xs text-emerald-600 mt-1">{t('uploaded', 'Uploaded')}: {uploadedFiles.gst_certificate.file_name}</p>}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="flex items-center gap-0.5">{t('business_registration', 'Business Registration')}</Label>
                  <div className="border-2 border-dashed rounded-xl p-4 bg-white/70 hover:bg-white transition-colors">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TranslatedFileInput accept=".pdf,.jpg,.jpeg,.png" onChange={f => uploadFile('business_registration', f)} />
                      <CameraCapture label={t('use_camera', 'Use Camera')} onCapture={(file) => uploadFile('business_registration', file)} />
                    </div>
                    {uploadedFiles.business_registration && <p className="text-xs text-emerald-600 mt-1">{t('uploaded', 'Uploaded')}: {uploadedFiles.business_registration.file_name}</p>}
                  </div>
                </div>

                {/* Dynamic Aadhaar uploads based on business type */}
                {formData.aadhaar_1 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-0.5">{formData.business_type === 'Partnership' ? t('aadhaar_partner_1', 'Aadhaar Card (Partner 1)') : t('aadhaar_card', 'Aadhaar Card')}</Label>
                    <div className="border-2 border-dashed rounded-xl p-4 bg-white/70 hover:bg-white transition-colors">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TranslatedFileInput accept=".pdf,.jpg,.jpeg,.png" onChange={f => uploadFile('aadhaar_1_doc', f)} />
                        <CameraCapture label={t('use_camera', 'Use Camera')} onCapture={(file) => uploadFile('aadhaar_1_doc', file)} />
                      </div>
                      {uploadedFiles.aadhaar_1_doc && <p className="text-xs text-emerald-600 mt-1">{t('uploaded', 'Uploaded')}: {uploadedFiles.aadhaar_1_doc.file_name}</p>}
                    </div>
                  </div>
                )}
                {formData.aadhaar_2 && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-0.5">{t('aadhaar_partner_2', 'Aadhaar Card (Partner 2)')}</Label>
                    <div className="border-2 border-dashed rounded-xl p-4 bg-white/70 hover:bg-white transition-colors">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TranslatedFileInput accept=".pdf,.jpg,.jpeg,.png" onChange={f => uploadFile('aadhaar_2_doc', f)} />
                        <CameraCapture label={t('use_camera', 'Use Camera')} onCapture={(file) => uploadFile('aadhaar_2_doc', file)} />
                      </div>
                      {uploadedFiles.aadhaar_2_doc && <p className="text-xs text-emerald-600 mt-1">{t('uploaded', 'Uploaded')}: {uploadedFiles.aadhaar_2_doc.file_name}</p>}
                    </div>
                  </div>
                )}

                {/* Photo uploads */}
                <div className="pt-2 border-t mt-2">
                  <p className="text-xs text-muted-foreground font-medium mb-3 flex items-center gap-1"><Camera className="w-3 h-3" /> {t('photo_upload_note', 'Photo Upload (Optional — JPG/PNG only)')}</p>
                  <div className={`grid ${formData.business_type === 'Partnership' ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                    <div className="space-y-2">
                      <Label>{formData.business_type === 'Partnership' ? t('photo_partner_1', 'Photo (Partner 1)') : t('photo', 'Photo')}</Label>
                      <div className="border-2 border-dashed rounded-xl p-4 bg-white/70 hover:bg-white transition-colors">
                        <input type="file" accept=".jpg,.jpeg,.png" onChange={e => {
                          if (e.target.files[0]) {
                            uploadFile('photo_1', e.target.files[0]);
                            // Create thumbnail preview
                            const reader = new FileReader();
                            reader.onload = (ev) => setFormData(prev => ({...prev, photo_1_preview: ev.target.result}));
                            reader.readAsDataURL(e.target.files[0]);
                          }
                        }} className="text-sm" />
                        {formData.photo_1_preview && <img src={formData.photo_1_preview} alt="Preview" className="w-20 h-20 object-cover rounded-lg mt-2 border" />}
                        {!formData.photo_1_preview && uploadedFiles.photo_1 && <p className="text-xs text-emerald-600 mt-1">{t('uploaded', 'Uploaded')}: {uploadedFiles.photo_1.file_name}</p>}
                      </div>
                    </div>
                    {formData.business_type === 'Partnership' && (
                      <div className="space-y-2">
                        <Label>{t('photo_partner_2', 'Photo (Partner 2)')}</Label>
                        <div className="border-2 border-dashed rounded-xl p-4 bg-white/70 hover:bg-white transition-colors">
                          <input type="file" accept=".jpg,.jpeg,.png" onChange={e => {
                            if (e.target.files[0]) {
                              uploadFile('photo_2', e.target.files[0]);
                              const reader = new FileReader();
                              reader.onload = (ev) => setFormData(prev => ({...prev, photo_2_preview: ev.target.result}));
                              reader.readAsDataURL(e.target.files[0]);
                            }
                          }} className="text-sm" />
                          {formData.photo_2_preview && <img src={formData.photo_2_preview} alt="Preview" className="w-20 h-20 object-cover rounded-lg mt-2 border" />}
                          {!formData.photo_2_preview && uploadedFiles.photo_2 && <p className="text-xs text-emerald-600 mt-1">{t('uploaded', 'Uploaded')}: {uploadedFiles.photo_2.file_name}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Declaration */}
            <Card>
              <CardHeader><CardTitle className="text-sm">{t('declaration', 'Declaration')} <span className="text-red-500">*</span></CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-2" data-field="consent">
                  <Checkbox checked={formData.consent || false} onCheckedChange={c => setFormData({...formData, consent: c})} />
                  <label className="text-sm text-muted-foreground">{t('declaration_text', "I certify that the above information is true and accurate. I agree to comply with the company's procurement policies and terms.")}</label>
                </div>
                <FieldError show={hasError('consent')} message={t('accept_declaration', 'You must accept the declaration')} />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2" data-field="signatory_name"><ReqLabel fieldKey="signatory_name" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{tl('signatory_name', 'Authorized Signatory Name')}</ReqLabel><Input value={formData.signatory_name || ''} onChange={e => setFormData({...formData, signatory_name: e.target.value})} className={hasError('signatory_name') ? 'border-red-400' : ''} /><FieldError show={hasError('signatory_name')} /></div>
                  <div className="space-y-2" data-field="signatory_date"><ReqLabel fieldKey="signatory_date" distributorType={data?.distributor?.entity_type || data?.invite?.entity_type || 'registered'}>{t('signatory_date', 'Date')}</ReqLabel><Input type="date" value={formData.signatory_date || new Date().toISOString().split('T')[0]} readOnly className="bg-muted/50" /><p className="text-[10px] text-muted-foreground">{t('date_auto', "Auto-filled to today's date")}</p></div>
                </div>
              </CardContent>
            </Card>

            {/* Custom Fields (per-link) */}
            {data?.custom_fields?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Additional Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {data.custom_fields.map(cf => (
                    <div key={cf.id} className="space-y-2" data-field={cf.id}>
                      <Label className="text-sm">{cf.label} {cf.required && <span className="text-red-500">*</span>}</Label>
                      {cf.type === 'text' && <Input value={formData[`custom_${cf.id}`] || ''} onChange={e => setFormData({...formData, [`custom_${cf.id}`]: e.target.value})} placeholder={cf.placeholder || ''} />}
                      {cf.type === 'number' && <Input type="number" value={formData[`custom_${cf.id}`] || ''} onChange={e => setFormData({...formData, [`custom_${cf.id}`]: e.target.value})} placeholder={cf.placeholder || ''} />}
                      {cf.type === 'email' && <Input type="email" value={formData[`custom_${cf.id}`] || ''} onChange={e => setFormData({...formData, [`custom_${cf.id}`]: e.target.value})} placeholder={cf.placeholder || ''} />}
                      {cf.type === 'phone' && <Input type="tel" value={formData[`custom_${cf.id}`] || ''} onChange={e => setFormData({...formData, [`custom_${cf.id}`]: e.target.value})} placeholder={cf.placeholder || ''} />}
                      {cf.type === 'date' && <Input type="date" value={formData[`custom_${cf.id}`] || ''} onChange={e => setFormData({...formData, [`custom_${cf.id}`]: e.target.value})} />}
                      {cf.type === 'textarea' && <textarea value={formData[`custom_${cf.id}`] || ''} onChange={e => setFormData({...formData, [`custom_${cf.id}`]: e.target.value})} placeholder={cf.placeholder || ''} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />}
                      {cf.type === 'checkbox' && (
                        <div className="flex items-center gap-2">
                          <Checkbox checked={formData[`custom_${cf.id}`] || false} onCheckedChange={v => setFormData({...formData, [`custom_${cf.id}`]: v})} />
                          <span className="text-sm text-muted-foreground">{cf.placeholder || cf.label}</span>
                        </div>
                      )}
                      {cf.type === 'dropdown' && (
                        <select value={formData[`custom_${cf.id}`] || ''} onChange={e => setFormData({...formData, [`custom_${cf.id}`]: e.target.value})} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                          <option value="">{cf.placeholder || 'Select...'}</option>
                          {(cf.options || '').split(',').map(opt => opt.trim()).filter(Boolean).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-2 sticky bottom-0 bg-gradient-to-t from-blue-50 to-transparent pb-4 pt-6">
              <Button variant="outline" onClick={() => setCurrentStep(1)}><ChevronLeft className="w-4 h-4 mr-1" /> {t('back', 'Back')}</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={saveDraft} disabled={formSaving}><Save className="w-3 h-3 mr-1" /> {t('save_draft', 'Save Draft')}</Button>
                <Button onClick={submitForm} disabled={formSubmitting} data-testid="distributor-form-submit-button">
                  <Send className="w-3 h-3 mr-1" /> {formSubmitting ? t('submitting', 'Submitting...') : t('submit', 'Submit Form')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Step 3: Status Tracker ═══ */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div><h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>{t('onboarding_status', 'Onboarding Status')}</h2><p className="text-sm text-muted-foreground">{t('track_progress', 'Track your onboarding progress')}</p></div>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <StatusBadge status={dist?.status} />
                  <span className="text-sm text-muted-foreground">{t('last_updated', 'Last updated')}: {dist?.updated_at ? new Date(dist.updated_at).toLocaleString() : '-'}</span>
                </div>
                <div className="relative pl-6 space-y-4" data-testid="distributor-status-timeline">
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                  {(dist?.status_history || []).map((h, i) => {
                    const isLatest = i === (dist?.status_history?.length || 0) - 1;
                    return (
                      <div key={i} className="relative">
                        <div className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-background ${isLatest ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                        <StatusBadge status={h.status} />
                        <p className="text-xs text-muted-foreground mt-0.5">{h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            {data?.agreement && (
              <Card>
                <CardHeader><CardTitle className="text-sm">{t('agreement_status', 'Agreement Status')}</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-2"><Badge variant="outline">{data.agreement.status}</Badge>{data.agreement.signing_method && <Badge variant="secondary">{data.agreement.signing_method}</Badge>}</div>
                  {data.agreement.pdf_url && <Button variant="link" size="sm" className="p-0" asChild><a href={`${API}${data.agreement.pdf_url}`} target="_blank" rel="noreferrer">{t('view_agreement_pdf', 'View Agreement PDF')}</a></Button>}
                </CardContent>
              </Card>
            )}
            {showComprehensive && (
              <Card className="border-primary/30 bg-accent/20">
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <div><p className="font-medium text-sm">{t('comprehensive_unlocked', 'Comprehensive videos are now unlocked!')}</p><p className="text-xs text-muted-foreground">{t('click_training', 'Click below to access training materials')}</p></div>
                  <Button size="sm" className="ml-auto" onClick={() => setCurrentStep(4)}>{t('view_videos', 'View Videos')} <ChevronRight className="w-3 h-3 ml-1" /></Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ═══ Step 4: Comprehensive Videos ═══ */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div><h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk' }}>{t('comprehensive_training', 'Comprehensive Training')}</h2><p className="text-sm text-muted-foreground">{t('advanced_training', 'Advanced training videos for BeatX Lite distributors')}</p></div>
            {showComprehensive ? (
              <div className="space-y-4" data-testid="distributor-comprehensive-videos-grid">
                {data?.comprehensive_videos?.map(v => (
                  <Card key={v._id}>
                    <CardContent className="p-4">
                      <h3 className="font-medium text-sm mb-1">{v.title}</h3>
                      <p className="text-xs text-muted-foreground mb-3">{v.description} - {v.duration}</p>
                      <div className="aspect-video rounded-lg overflow-hidden bg-black">
                        <iframe src={(() => { const m = v.url?.match(/[?&]v=([a-zA-Z0-9_-]{11})/); const s = v.url?.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/); const id = m?.[1] || s?.[1] || v.url?.match(/embed\/([a-zA-Z0-9_-]{11})/)?.[1]; return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : v.url; })()} title={v.title} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Lock className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">{t('videos_locked', 'Comprehensive videos will be unlocked after your onboarding is approved')}</p>
                  <Button variant="link" onClick={() => setCurrentStep(3)}>{t('check_status', 'Check your status')}</Button>
                </CardContent>
              </Card>
            )}
            <Button variant="outline" onClick={() => setCurrentStep(3)}><ChevronLeft className="w-4 h-4 mr-1" /> {t('back_to_status', 'Back to Status')}</Button>
          </div>
        )}
      </main>
    </div>
  );
}
