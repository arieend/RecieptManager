import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, Zap, ZapOff, RefreshCw, Layers, FileText, Check, Plus, Trash2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations } from '../translations';
import { Cropper } from './Cropper';
import { Button } from './ui/Base';

interface ScannerProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  onFallback: () => void;
  language: 'en' | 'he';
  initialStream?: MediaStream | null;
  initialError?: string | null;
}

export const Scanner: React.FC<ScannerProps> = ({ 
  onCapture, onClose, onFallback, language, initialStream, initialError 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(initialStream || null);
  const [error, setError] = useState<string | null>(initialError || null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
  const [isLongReceiptMode, setIsLongReceiptMode] = useState(false);
  const [capturedParts, setCapturedParts] = useState<string[]>([]);
  const [currentCapture, setCurrentCapture] = useState<string | null>(null);
  const [isStitching, setIsStitching] = useState(false);

  const t = translations[language];

  const [hasAttempted, setHasAttempted] = useState(false);

  const [isIframe] = useState(() => window.self !== window.top);

  const startCamera = async (mode: 'user' | 'environment') => {
    // Only skip if we have an initial stream AND we haven't tried to change anything yet
    if (initialStream && !hasAttempted) {
      setHasAttempted(true);
      return;
    }
    setHasAttempted(true);
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser does not support camera access");
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      setStream(newStream);
      setError(null);
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.toLowerCase().includes('denied')) {
        setError(t.cameraPermissionDenied);
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError(language === 'he' ? 'לא נמצאה מצלמה במכשיר זה.' : 'No camera found on this device.');
      } else if (err.message?.toLowerCase().includes('dismissed')) {
        setError(t.cameraPermissionDismissed);
      } else {
        setError(t.cameraGenericError);
      }
    }
  };

  // Separate effect for attaching stream to video element
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (initialStream) {
      setStream(initialStream);
    } else if (!error) {
      startCamera(facingMode);
    }
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setCurrentCapture(base64);
      }
    }
  };

  const handleCrop = (croppedBase64: string) => {
    if (isLongReceiptMode) {
      setCapturedParts(prev => [...prev, croppedBase64]);
      setCurrentCapture(null);
    } else {
      onCapture(croppedBase64);
    }
  };

  const stitchParts = async () => {
    if (capturedParts.length === 0) return;
    setIsStitching(true);

    try {
      const images = await Promise.all(capturedParts.map(src => {
        return new Promise<HTMLImageElement>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = src;
        });
      }));

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const maxWidth = Math.max(...images.map(img => img.width));
      const totalHeight = images.reduce((sum, img) => sum + img.height, 0);

      canvas.width = maxWidth;
      canvas.height = totalHeight;

      let currentY = 0;
      images.forEach(img => {
        ctx.drawImage(img, 0, currentY);
        currentY += img.height;
      });

      onCapture(canvas.toDataURL('image/jpeg', 0.8));
    } catch (e) {
      console.error("Stitching error:", e);
    } finally {
      setIsStitching(false);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNativeCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        onCapture(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
    >
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        onChange={handleNativeCapture}
      />
      {/* Cropper Overlay (if active) */}
      <AnimatePresence>
        {currentCapture && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-[120]"
          >
            <Cropper 
              image={currentCapture} 
              onCrop={handleCrop} 
              onCancel={() => setCurrentCapture(null)} 
              language={language} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header (hidden if cropper is active) */}
      {!currentCapture && (
        <div className="absolute top-0 inset-x-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
          <button 
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
          <div className="flex gap-4">
            <button 
              onClick={() => setIsLongReceiptMode(!isLongReceiptMode)}
              className={`p-2 rounded-full transition-colors flex items-center gap-2 px-4 ${isLongReceiptMode ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
              title={isLongReceiptMode ? t.longReceiptMode : t.singleReceiptMode}
              aria-label={isLongReceiptMode ? "Long Receipt Mode" : "Single Receipt Mode"}
            >
              {isLongReceiptMode ? <Layers size={20} /> : <FileText size={20} />}
              <span className="text-xs font-bold hidden sm:inline">
                {isLongReceiptMode ? t.longReceiptMode : t.singleReceiptMode}
              </span>
            </button>
            <button 
              onClick={toggleCamera}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              aria-label="Toggle Camera"
            >
              <RefreshCw size={24} />
            </button>
          </div>
        </div>
      )}

      {/* Camera View (always mounted but hidden if cropper is active) */}
      <div className={`flex-1 relative overflow-hidden flex items-center justify-center ${currentCapture ? 'invisible' : 'visible'}`}>
        {error ? (
          <div className="p-8 text-center text-white flex flex-col gap-8 max-w-sm">
            <div className="space-y-6">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={40} className="text-red-500" />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-black text-white tracking-tight italic uppercase">
                  {language === 'he' ? 'שגיאת מצלמה' : 'Camera Error'}
                </p>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {error}
                </p>
              </div>

              {isIframe && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-left space-y-3">
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <Zap size={14} />
                    {language === 'he' ? 'פתרון מהיר' : 'Quick Fix'}
                  </p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {language === 'he' 
                      ? 'דפדפנים לעיתים חוסמים גישה למצלמה בתוך תצוגה מקדימה. פתיחת האפליקציה בלשונית חדשה פותרת זאת בדרך כלל.' 
                      : 'Browsers often block camera access in preview mode. Opening the app in a new tab usually fixes this.'}
                  </p>
                  <button 
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} />
                    {language === 'he' ? 'פתח בלשונית חדשה' : 'Open in New Tab'}
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-3">
              <Button 
                variant="primary" 
                onClick={() => startCamera(facingMode)}
                className="w-full"
              >
                {language === 'he' ? 'נסה שוב' : 'Try Again'}
              </Button>
              <Button 
                variant="outline" 
                onClick={onFallback}
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                {language === 'he' ? 'בחר קובץ מהגלריה' : 'Choose from Gallery'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              onLoadedMetadata={() => setIsCameraReady(true)}
              className="w-full h-full object-cover"
            />
            
            {/* Scanner Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[80%] aspect-[3/4] border-2 border-emerald-500/50 rounded-2xl relative shadow-[0_0_0_100vmax_rgba(0,0,0,0.5)]">
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl" />
                
                <motion.div 
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-0.5 bg-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                />
              </div>
            </div>
            
            <p className="absolute bottom-32 inset-x-0 text-center text-white/70 text-sm font-medium">
              {language === 'he' ? 'מקמו את הקבלה בתוך המסגרת' : 'Position the receipt within the frame'}
            </p>
          </>
        )}
      </div>

      {/* Captured Parts Preview (for Long Receipt) */}
      <AnimatePresence>
        {isLongReceiptMode && capturedParts.length > 0 && !currentCapture && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="absolute bottom-32 inset-x-0 p-4 flex gap-2 overflow-x-auto bg-black/50 backdrop-blur-md"
          >
            {capturedParts.map((part, idx) => (
              <div key={idx} className="relative flex-shrink-0">
                <img src={part} className="h-20 rounded-lg border border-white/20" alt={`Part ${idx}`} />
                <button 
                  onClick={() => setCapturedParts(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      {!currentCapture && (
        <div className="p-8 bg-black flex justify-between items-center gap-4">
          <div className="w-20" /> {/* Spacer */}
          
          <button 
            onClick={capture}
            disabled={!isCameraReady || isStitching}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center border-4 border-white/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            aria-label="Capture"
          >
            <div className="w-16 h-16 bg-white rounded-full border-2 border-black/10" />
          </button>

          <div className="w-20 flex justify-center">
            {isLongReceiptMode && capturedParts.length > 0 && (
              <Button 
                variant="primary" 
                size="icon" 
                className="w-14 h-14 rounded-full bg-emerald-600"
                onClick={stitchParts}
                isLoading={isStitching}
              >
                <Check size={24} />
              </Button>
            )}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </motion.div>
  );
};
