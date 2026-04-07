import React from 'react';
import { Badge } from './ui/badge';
import { Circle, Clock, FileText, ShieldCheck, Package, CheckCircle, AlertTriangle, Send, Eye, UserPlus, Truck, DollarSign } from 'lucide-react';

const STATUS_CONFIG = {
  INVITED: { label: 'Invited', icon: UserPlus, className: 'bg-sky-50 text-sky-800 border-sky-200' },
  LINK_OPENED: { label: 'Link Opened', icon: Eye, className: 'bg-sky-50 text-sky-800 border-sky-200' },
  VIDEOS_VIEWED: { label: 'Videos Viewed', icon: Eye, className: 'bg-blue-50 text-blue-800 border-blue-200' },
  FORM_IN_PROGRESS: { label: 'Form In Progress', icon: Clock, className: 'bg-slate-50 text-slate-800 border-slate-200' },
  FORM_SUBMITTED: { label: 'Form Submitted', icon: FileText, className: 'bg-blue-50 text-blue-800 border-blue-200' },
  AGREEMENT_DRAFT_GENERATED: { label: 'Agreement Generated', icon: FileText, className: 'bg-slate-50 text-slate-800 border-slate-200' },
  AGREEMENT_SENT: { label: 'Agreement Sent', icon: Send, className: 'bg-amber-50 text-amber-800 border-amber-200' },
  AWAITING_SIGNATURE: { label: 'Awaiting Signature', icon: Clock, className: 'bg-amber-50 text-amber-800 border-amber-200' },
  SIGNED_RECEIVED: { label: 'Signed', icon: CheckCircle, className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  COMPLIANCE_REVIEW: { label: 'Compliance Review', icon: ShieldCheck, className: 'bg-amber-50 text-amber-800 border-amber-200' },
  COMPLIANCE_APPROVED: { label: 'Approved', icon: CheckCircle, className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  COMPLIANCE_REJECTED: { label: 'Rejected', icon: AlertTriangle, className: 'bg-rose-50 text-rose-800 border-rose-200' },
  INVENTORY_PROCESSING: { label: 'Inventory Processing', icon: Package, className: 'bg-amber-50 text-amber-800 border-amber-200' },
  SHIPPED: { label: 'Shipped', icon: Truck, className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  SENT_TO_PROCUREMENT: { label: 'Sent to Procurement', icon: Package, className: 'bg-amber-50 text-amber-800 border-amber-200' },
  FINANCE_NOTIFIED: { label: 'Finance Review', icon: DollarSign, className: 'bg-amber-50 text-amber-800 border-amber-200' },
  ONBOARDING_COMPLETE: { label: 'Completed', icon: CheckCircle, className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status?.replace(/_/g, ' ') || 'Unknown', icon: Circle, className: 'bg-slate-50 text-slate-800 border-slate-200' };
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.className} text-xs font-medium gap-1 whitespace-nowrap`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}
