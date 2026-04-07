import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, PlayCircle, Eye, Upload, X, Film, Image, FileText } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

export default function VideosManagement() {
  const { api } = useAuth();
  const [videos, setVideos] = useState([]);
  const [posters, setPosters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showPosterCreate, setShowPosterCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'initial', url: '', duration: '', order: 1, source: 'upload' });
  const [creating, setCreating] = useState(false);
  const [mp4File, setMp4File] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  // Poster form
  const [posterForm, setPosterForm] = useState({ title: '', description: '', category: 'poster', order: 1 });
  const [posterFile, setPosterFile] = useState(null);
  const [posterUploading, setPosterUploading] = useState(false);
  const [posterPreview, setPosterPreview] = useState(null);
  const [activeTab, setActiveTab] = useState('videos');

  useEffect(() => { loadVideos(); loadPosters(); }, []);

  const loadVideos = async () => { try { const r = await api.get('/api/videos'); setVideos(r.data); } catch {} setLoading(false); };
  const loadPosters = async () => { try { const r = await api.get('/api/posters'); setPosters(r.data); } catch {} };

  const createVideo = async () => {
    if (form.source === 'upload' && mp4File) {
      setUploading(true);
      try {
        const fd = new FormData(); fd.append('file', mp4File); fd.append('title', form.title); fd.append('description', form.description); fd.append('type', form.type); fd.append('duration', form.duration); fd.append('order', form.order);
        await api.post('/api/videos/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Video uploaded!'); setShowCreate(false); resetForm(); loadVideos();
      } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed'); }
      setUploading(false);
    } else {
      setCreating(true);
      try {
        await api.post('/api/videos', { ...form, source: 'youtube' });
        toast.success('Video added!'); setShowCreate(false); resetForm(); loadVideos();
      } catch { toast.error('Failed'); }
      setCreating(false);
    }
  };
  const resetForm = () => { setForm({ title: '', description: '', type: 'initial', url: '', duration: '', order: 1, source: 'upload' }); setMp4File(null); };

  const deleteVideo = async (id) => { if (!window.confirm('Delete?')) return; try { await api.delete(`/api/videos/${id}`); toast.success('Deleted'); loadVideos(); } catch {} };
  const deletePoster = async (id) => { if (!window.confirm('Delete?')) return; try { await api.delete(`/api/posters/${id}`); toast.success('Deleted'); loadPosters(); } catch {} };

  const uploadPoster = async () => {
    if (!posterFile || !posterForm.title) return;
    setPosterUploading(true);
    try {
      const fd = new FormData(); fd.append('file', posterFile); fd.append('title', posterForm.title); fd.append('description', posterForm.description); fd.append('category', posterForm.category); fd.append('order', posterForm.order);
      await api.post('/api/posters/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Uploaded!'); setShowPosterCreate(false); setPosterForm({ title: '', description: '', category: 'poster', order: 1 }); setPosterFile(null); loadPosters();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setPosterUploading(false);
  };

  const initial = videos.filter(v => v.type === 'initial' && v.is_active);
  const comprehensive = videos.filter(v => v.type === 'comprehensive' && v.is_active);

  const VideoCard = ({ v, color }) => (
    <Card className="animate-row-in"><CardContent className="p-3 flex items-center gap-3">
      <PlayCircle className={`w-8 h-8 ${color} shrink-0`} />
      <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{v.title}</p><div className="flex items-center gap-2"><p className="text-xs text-muted-foreground">{v.duration}</p>{v.source === 'upload' && <Badge className="text-[8px] bg-indigo-100 text-indigo-700">MP4</Badge>}</div></div>
      <Button variant="ghost" size="icon" onClick={() => setPreview(v)} title="Preview"><Eye className="w-3.5 h-3.5 text-muted-foreground" /></Button>
      <Button variant="ghost" size="icon" onClick={() => deleteVideo(v._id)} title="Delete"><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
    </CardContent></Card>
  );

  const CATEGORY_ICONS = { poster: Image, banner: Image, article: FileText };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Space Grotesk' }}>Media Library</h1><p className="text-sm text-muted-foreground mt-1">Manage videos, posters, banners, and articles</p></div>

      <Tabs defaultValue="videos" className="w-full" onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid grid-cols-2 w-auto min-w-[300px]"><TabsTrigger value="videos">Videos</TabsTrigger><TabsTrigger value="posters">Posters & Media</TabsTrigger></TabsList>
          {activeTab === 'videos' && <Button onClick={() => { const count = videos.filter(v => v.is_active !== false && v.type === form.type).length; setForm(f => ({...f, order: count + 1})); setShowCreate(true); }}><Plus className="w-4 h-4 mr-2" /> Add Video</Button>}
          {activeTab === 'posters' && <Button onClick={() => { const count = posters.filter(p => p.category === posterForm.category).length; setPosterForm(f => ({...f, order: count + 1})); setShowPosterCreate(true); }}><Plus className="w-4 h-4 mr-2" /> Upload Media</Button>}
        </div>

        {/* ═══ VIDEOS TAB ═══ */}
        <TabsContent value="videos" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div><h2 className="text-base font-semibold mb-3">Initial Videos</h2><div className="space-y-2">{initial.map(v => <VideoCard key={v._id} v={v} color="text-primary" />)}{initial.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No initial videos</p>}</div></div>
            <div><h2 className="text-base font-semibold mb-3">Comprehensive Videos</h2><div className="space-y-2">{comprehensive.map(v => <VideoCard key={v._id} v={v} color="text-emerald-600" />)}{comprehensive.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No comprehensive videos</p>}</div></div>
          </div>
        </TabsContent>

        {/* ═══ POSTERS TAB ═══ */}
        <TabsContent value="posters" className="space-y-4">
          {posters.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-xl"><Image className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" /><p className="text-sm text-muted-foreground">No posters or media uploaded yet</p></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {posters.map(p => {
                const isImage = ['png','jpg','jpeg','webp','gif'].includes(p.file_ext);
                const isPdf = p.file_ext === 'pdf';
                return (
                  <Card key={p._id} className="overflow-hidden group">
                    <div className="aspect-[4/3] bg-muted/30 relative">
                      {isImage ? <img src={`${BACKEND}${p.file_url}`} alt={p.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="flex items-center justify-center h-full"><FileText className="w-12 h-12 text-muted-foreground/20" /></div>}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => setPosterPreview(p)}><Eye className="w-4 h-4" /></Button>
                        <Button size="icon" variant="secondary" className="h-8 w-8 text-red-600" onClick={() => deletePoster(p._id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                    <CardContent className="p-2.5">
                      <p className="text-xs font-medium truncate">{p.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5"><Badge variant="outline" className="text-[8px] capitalize">{p.category}</Badge><span className="text-[9px] text-muted-foreground uppercase">{p.file_ext}</span></div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ ADD VIDEO DIALOG ═══ */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Video</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm({...form, type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="initial">Initial</SelectItem><SelectItem value="comprehensive">Comprehensive</SelectItem></SelectContent></Select>
            </div>

            {/* Source toggle */}
            <div className="space-y-1.5">
              <Label>Source</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button type="button" variant={form.source === 'youtube' ? 'default' : 'outline'} onClick={() => setForm({...form, source: 'youtube'})} className="gap-2 h-10"><PlayCircle className="w-4 h-4" /> YouTube URL</Button>
                <Button type="button" variant={form.source === 'upload' ? 'default' : 'outline'} onClick={() => setForm({...form, source: 'upload'})} className="gap-2 h-10"><Upload className="w-4 h-4" /> Upload MP4</Button>
              </div>
            </div>

            {/* Source-specific content */}
            {form.source === 'youtube' ? (
              <div className="space-y-1.5 mt-3">
                <Label>Video URL (YouTube embed)</Label>
                <Input value={form.url} onChange={e => setForm({...form, url: e.target.value})} placeholder="https://www.youtube.com/embed/..." />
              </div>
            ) : (
              <div className="space-y-1.5 mt-3">
                <Label>MP4 File</Label>
                <label className="cursor-pointer block">
                  <div className="border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center hover:border-primary/50 transition-colors">
                    <Film className="w-8 h-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">{mp4File ? mp4File.name : 'Click to select MP4 file'}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Max 500MB</p>
                  </div>
                  <input type="file" accept=".mp4,.mov,.webm" className="hidden" onChange={e => {
                    const file = e.target.files[0];
                    setMp4File(file || null);
                    // Auto-detect duration
                    if (file) {
                      const video = document.createElement('video');
                      video.preload = 'metadata';
                      video.onloadedmetadata = () => {
                        const dur = Math.round(video.duration);
                        const mins = Math.floor(dur / 60);
                        const secs = dur % 60;
                        setForm(f => ({...f, duration: `${mins}:${String(secs).padStart(2,'0')}`}));
                        URL.revokeObjectURL(video.src);
                      };
                      video.src = URL.createObjectURL(file);
                    }
                  }} />
                </label>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="space-y-1.5"><Label>Duration</Label><Input value={form.duration} onChange={e => setForm({...form, duration: e.target.value.replace(/[^0-9:]/g, '')})} placeholder="5:30" /></div>
              <div className="space-y-1.5"><Label>Display Order</Label><Input type="number" min="1" max={(() => { const c = videos.filter(v => v.is_active !== false && v.type === form.type).length; return c + 1; })()} value={form.order} onChange={e => { const max = videos.filter(v => v.is_active !== false && v.type === form.type).length + 1; setForm({...form, order: Math.max(1, Math.min(max, parseInt(e.target.value) || 1))}); }} /></div>
            </div>

            <Button onClick={createVideo} disabled={creating || uploading || !form.title || (form.source === 'youtube' && !form.url) || (form.source === 'upload' && !mp4File)} className="w-full">
              {uploading ? 'Uploading...' : creating ? 'Adding...' : 'Add Video'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ ADD POSTER DIALOG ═══ */}
      <Dialog open={showPosterCreate} onOpenChange={setShowPosterCreate}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Upload Media</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Title</Label><Input value={posterForm.title} onChange={e => setPosterForm({...posterForm, title: e.target.value})} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={posterForm.description} onChange={e => setPosterForm({...posterForm, description: e.target.value})} /></div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={posterForm.category} onValueChange={v => setPosterForm({...posterForm, category: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="poster">Poster</SelectItem><SelectItem value="banner">Banner</SelectItem><SelectItem value="article">Article (PDF)</SelectItem><SelectItem value="image">Image</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-1.5">
              <Label>File</Label>
              <label className="cursor-pointer block">
                <div className="border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center hover:border-primary/50 transition-colors">
                  <Image className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">{posterFile ? posterFile.name : 'Click to select file'}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG, WEBP, GIF, PDF — Max 25MB</p>
                </div>
                <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.pdf" className="hidden" onChange={e => setPosterFile(e.target.files[0] || null)} />
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>Display Order</Label>
              {(() => { const sameCat = posters.filter(p => p.category === posterForm.category); const count = sameCat.length; const maxOrder = count + 1; return (<Input type="number" min="1" max={maxOrder} value={Math.min(posterForm.order, maxOrder)} onChange={e => setPosterForm({...posterForm, order: Math.max(1, Math.min(maxOrder, parseInt(e.target.value) || 1))})} />); })()}
            </div>
            <Button onClick={uploadPoster} disabled={posterUploading || !posterForm.title || !posterFile} className="w-full">{posterUploading ? 'Uploading...' : 'Upload'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ VIDEO PREVIEW ═══ */}
      {preview && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b"><p className="text-sm font-semibold">{preview.title}</p><Button size="sm" variant="ghost" onClick={() => setPreview(null)}><X className="w-4 h-4" /></Button></div>
            <div className="aspect-video bg-black">
              {preview.source === 'upload' && preview.file_url ? <video src={`${BACKEND}${preview.file_url}`} controls autoPlay className="w-full h-full" /> : preview.url ? <iframe src={preview.url} className="w-full h-full" allowFullScreen title={preview.title} /> : <div className="flex items-center justify-center h-full text-white/50">No preview</div>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ POSTER PREVIEW ═══ */}
      {posterPreview && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" onClick={() => setPosterPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b"><p className="text-sm font-semibold">{posterPreview.title}</p><Button size="sm" variant="ghost" onClick={() => setPosterPreview(null)}><X className="w-4 h-4" /></Button></div>
            {posterPreview.file_ext === 'pdf' ? <iframe src={`${BACKEND}${posterPreview.file_url}`} className="w-full h-[80vh]" title={posterPreview.title} /> : <img src={`${BACKEND}${posterPreview.file_url}`} alt={posterPreview.title} className="w-full max-h-[80vh] object-contain" />}
          </div>
        </div>
      )}
    </div>
  );
}
