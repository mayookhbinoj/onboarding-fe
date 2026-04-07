import React, { useState, useCallback } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * FormEngine — renders forms from JSON schema/config.
 *
 * @param {Object} props
 * @param {Array} props.fields - Field definitions [{id, label, type, placeholder?, required?, helpText?, options?, validation?, disabled?, defaultValue?, visible?, section?}]
 * @param {Object} props.values - Current form values {fieldId: value}
 * @param {Function} props.onChange - (fieldId, value) => void
 * @param {Object} props.errors - Validation errors {fieldId: errorMessage}
 * @param {Function} props.onSubmit - () => void
 * @param {string} props.submitLabel - Submit button text
 * @param {boolean} props.loading - Submit in progress
 * @param {boolean} props.disabled - Disable all fields
 * @param {number} props.columns - Grid columns (1 or 2, default 1)
 * @param {string} props.className
 */
export default function FormEngine({
  fields = [], values = {}, onChange, errors = {},
  onSubmit, submitLabel = 'Submit', loading = false, disabled = false,
  columns = 1, className = '',
}) {
  const [collapsedSections, setCollapsedSections] = useState({});
  const toggleSection = (s) => setCollapsedSections(prev => ({ ...prev, [s]: !prev[s] }));

  const handleChange = useCallback((id, val) => {
    if (onChange) onChange(id, val);
  }, [onChange]);

  // Group by section
  const sections = {};
  let currentSection = '__default__';
  fields.forEach(f => {
    if (f.type === 'section') { currentSection = f.id; sections[currentSection] = { label: f.label, fields: [] }; return; }
    if (!sections[currentSection]) sections[currentSection] = { label: '', fields: [] };
    sections[currentSection].fields.push(f);
  });

  const renderField = (f) => {
    // Conditional visibility
    if (f.visible !== undefined && typeof f.visible === 'function' && !f.visible(values)) return null;
    if (f.visible === false) return null;

    const val = values[f.id] ?? f.defaultValue ?? '';
    const err = errors[f.id];
    const isDisabled = disabled || f.disabled;

    return (
      <div key={f.id} className="space-y-1.5" data-field={f.id}>
        {f.type !== 'checkbox' && f.type !== 'hidden' && (
          <Label className="text-sm font-medium">{f.label} {f.required && <span className="text-red-500">*</span>}</Label>
        )}

        {f.type === 'text' && <Input value={val} onChange={e => handleChange(f.id, e.target.value)} placeholder={f.placeholder} disabled={isDisabled} className={err ? 'border-red-400' : ''} />}
        {f.type === 'number' && <Input type="number" value={val} onChange={e => handleChange(f.id, e.target.value)} placeholder={f.placeholder} disabled={isDisabled} min={f.min} max={f.max} className={err ? 'border-red-400' : ''} />}
        {f.type === 'email' && <Input type="email" value={val} onChange={e => handleChange(f.id, e.target.value)} placeholder={f.placeholder} disabled={isDisabled} className={err ? 'border-red-400' : ''} />}
        {f.type === 'phone' && <Input type="tel" value={val} onChange={e => handleChange(f.id, e.target.value)} placeholder={f.placeholder || '+91-XXXXXXXXXX'} disabled={isDisabled} className={err ? 'border-red-400' : ''} />}
        {f.type === 'password' && <Input type="password" value={val} onChange={e => handleChange(f.id, e.target.value)} placeholder={f.placeholder} disabled={isDisabled} className={err ? 'border-red-400' : ''} />}
        {f.type === 'date' && <Input type="date" value={val} onChange={e => handleChange(f.id, e.target.value)} disabled={isDisabled} className={err ? 'border-red-400' : ''} />}
        {f.type === 'textarea' && <textarea value={val} onChange={e => handleChange(f.id, e.target.value)} placeholder={f.placeholder} disabled={isDisabled} rows={f.rows || 3} className={`w-full rounded-md border ${err ? 'border-red-400' : 'border-input'} bg-background px-3 py-2 text-sm`} />}
        {f.type === 'hidden' && <input type="hidden" value={val} />}

        {f.type === 'dropdown' && (
          <Select value={val} onValueChange={v => handleChange(f.id, v)} disabled={isDisabled}>
            <SelectTrigger className={err ? 'border-red-400' : ''}><SelectValue placeholder={f.placeholder || 'Select...'} /></SelectTrigger>
            <SelectContent>{(f.options || []).map(o => typeof o === 'string' ? <SelectItem key={o} value={o}>{o}</SelectItem> : <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        )}

        {f.type === 'checkbox' && (
          <div className="flex items-center gap-2">
            <Checkbox checked={!!val} onCheckedChange={v => handleChange(f.id, v)} disabled={isDisabled} id={f.id} />
            <label htmlFor={f.id} className="text-sm cursor-pointer">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
          </div>
        )}

        {f.type === 'radio' && (
          <div className="space-y-1.5">{(f.options || []).map(o => {
            const ov = typeof o === 'string' ? o : o.value;
            const ol = typeof o === 'string' ? o : o.label;
            return <label key={ov} className="flex items-center gap-2 cursor-pointer"><input type="radio" name={f.id} value={ov} checked={val === ov} onChange={() => handleChange(f.id, ov)} disabled={isDisabled} className="rounded-full" /><span className="text-sm">{ol}</span></label>;
          })}</div>
        )}

        {f.helpText && <p className="text-[10px] text-muted-foreground">{f.helpText}</p>}
        {err && <p className="text-[10px] text-red-500">{err}</p>}
      </div>
    );
  };

  return (
    <div className={`space-y-5 ${className}`}>
      {Object.entries(sections).map(([sectionId, section]) => (
        <div key={sectionId}>
          {section.label && (
            <button type="button" onClick={() => toggleSection(sectionId)} className="flex items-center gap-2 w-full text-left mb-3 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
              {collapsedSections[sectionId] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm font-semibold">{section.label}</span>
            </button>
          )}
          {!collapsedSections[sectionId] && (
            <div className={`grid gap-4 ${columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
              {section.fields.map(renderField)}
            </div>
          )}
        </div>
      ))}

      {onSubmit && (
        <Button onClick={onSubmit} disabled={loading || disabled} className="w-full" data-testid="form-engine-submit">
          {loading ? 'Submitting...' : submitLabel}
        </Button>
      )}
    </div>
  );
}
