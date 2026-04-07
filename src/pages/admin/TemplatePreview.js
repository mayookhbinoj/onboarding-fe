import React, { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { X, FileText, Download } from 'lucide-react';

/**
 * TemplatePreview — Shows the template as a PDF (exact formatting match via LibreOffice conversion)
 */
export default function TemplatePreview({ api, templateId, agreementId, onClose, title }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (templateId) {
      const token = localStorage.getItem('beatx_token');
      // Fetch PDF as blob with auth header, create object URL
      api.get(`/api/agreement-templates/${templateId}/pdf-preview`, { responseType: 'blob' })
        .then(r => {
          const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
          setPdfUrl(url);
          setLoading(false);
        })
        .catch(() => {
          // Fallback: try with token query param
          const url = `${process.env.REACT_APP_BACKEND_URL}/api/agreement-templates/${templateId}/pdf-preview?token=${token}`;
          setPdfUrl(url);
          setLoading(false);
        });
    } else if (agreementId) {
      // Agreement PDF — direct view
      const token = localStorage.getItem('beatx_token');
      api.get(`/api/agreements/${agreementId}`).then(r => {
        const pdfPath = r.data?.pdf_url || r.data?.signed_pdf_url;
        if (pdfPath) {
          setPdfUrl(`${process.env.REACT_APP_BACKEND_URL}${pdfPath}`);
        } else {
          setError('No PDF available for this agreement');
        }
        setLoading(false);
      }).catch(() => { setError('Failed to load agreement'); setLoading(false); });
    }
  }, [templateId, agreementId, api]);

  return (
    <div className="fixed inset-0 z-[90] bg-background flex flex-col">
      {/* Header */}
      <div className="h-12 border-b bg-card flex items-center px-4 gap-3 shrink-0">
        <FileText className="w-4 h-4 text-primary" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold" style={{ fontFamily: 'Space Grotesk' }}>{title || 'Template Preview'}</h2>
          <p className="text-[10px] text-muted-foreground">Exact document preview — formatting matches the original file</p>
        </div>
        {pdfUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={pdfUrl} download><Download className="w-3.5 h-3.5 mr-1" /> Download PDF</a>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden bg-muted/20">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Generating preview...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-destructive mb-2">{error}</p>
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Template Preview"
          />
        ) : null}
      </div>
    </div>
  );
}
