import React, { useState, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Camera, RotateCcw, Check, X } from 'lucide-react';

export function CameraCapture({ onCapture, label = 'Use Camera' }) {
  const [open, setOpen] = useState(false);
  const [captured, setCaptured] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = useCallback(async (facing) => {
    // Stop previous stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing || 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStreaming(true);
      setCaptured(null);
    } catch (err) {
      console.error('Camera error:', err);
      // Fallback to any available camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStreaming(true);
        setCaptured(null);
      } catch {
        setStreaming(false);
      }
    }
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setCaptured(null);
    setTimeout(() => startCamera(facingMode), 300);
  }, [startCamera, facingMode]);

  const handleClose = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
    setCaptured(null);
    setOpen(false);
  }, []);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCaptured(dataUrl);
    // Stop camera after capture
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
  }, []);

  const retake = useCallback(() => {
    setCaptured(null);
    startCamera(facingMode);
  }, [startCamera, facingMode]);

  const switchCamera = useCallback(() => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    startCamera(newFacing);
  }, [facingMode, startCamera]);

  const confirmPhoto = useCallback(() => {
    if (!captured) return;
    // Convert data URL to File
    fetch(captured)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        handleClose();
      });
  }, [captured, onCapture, handleClose]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="gap-1.5"
        data-testid="camera-capture-btn"
      >
        <Camera className="w-3.5 h-3.5" /> {label}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-sm flex items-center gap-2">
              <Camera className="w-4 h-4" /> Capture Document
            </DialogTitle>
          </DialogHeader>

          <div className="relative bg-black aspect-[4/3] overflow-hidden">
            {!captured ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!streaming && (
                  <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                    Starting camera...
                  </div>
                )}
              </>
            ) : (
              <img src={captured} alt="Captured" className="w-full h-full object-contain" />
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <DialogFooter className="p-3 flex justify-between gap-2">
            {!captured ? (
              <>
                <Button variant="ghost" size="sm" onClick={switchCamera} data-testid="camera-switch-btn">
                  <RotateCcw className="w-4 h-4 mr-1" /> Flip
                </Button>
                <Button size="sm" onClick={takePhoto} disabled={!streaming} data-testid="camera-shutter-btn" className="min-w-[120px]">
                  <Camera className="w-4 h-4 mr-1" /> Capture
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClose}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={retake} data-testid="camera-retake-btn">
                  <RotateCcw className="w-4 h-4 mr-1" /> Retake
                </Button>
                <Button size="sm" onClick={confirmPhoto} data-testid="camera-confirm-btn" className="min-w-[120px] bg-emerald-600 hover:bg-emerald-700">
                  <Check className="w-4 h-4 mr-1" /> Use Photo
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
