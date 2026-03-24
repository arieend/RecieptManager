import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, Zap, ZapOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScannerProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  onFallback: () => void;
  language: 'en' | 'he';
}

export const Scanner: React.FC<ScannerProps> = ({ onCapture, onClose, onFallback, language }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const startCamera = async (mode: 'user' | 'environment') => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setStream(newStream);
      setError(null);
    } catch (err: any) {
      console.error("Camera error:", err);
      setError(language === 'he' ? 'לא ניתן לגשת למצלמה. אנא וודאו שנתתם הרשאות.' : 'Could not access camera. Please ensure permissions are granted.');
    }
  };

  useEffect(() => {
    startCamera(facingMode);
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
        
        // Draw the video frame to the canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(base64);
      }
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
    >
      {/* Header */}
      <div className="absolute top-0 inset-x-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
        <button 
          onClick={onClose}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <X size={24} />
        </button>
        <div className="flex gap-4">
          <button 
            onClick={toggleCamera}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <RefreshCw size={24} />
          </button>
        </div>
      </div>

      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="p-8 text-center text-white flex flex-col gap-4">
            <p className="mb-2">{error}</p>
            <button 
              onClick={() => startCamera(facingMode)}
              className="px-6 py-3 bg-emerald-600 rounded-xl font-bold"
            >
              {language === 'he' ? 'נסה שוב' : 'Try Again'}
            </button>
            <button 
              onClick={onFallback}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-colors"
            >
              {language === 'he' ? 'השתמש במצלמת המערכת' : 'Use System Camera'}
            </button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              onLoadedMetadata={() => setIsCameraReady(true)}
              className="w-full h-full object-cover"
            />
            
            {/* Scanner Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[80%] aspect-[3/4] border-2 border-emerald-500/50 rounded-2xl relative shadow-[0_0_0_100vmax_rgba(0,0,0,0.5)]">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl" />
                
                {/* Scanning Line Animation */}
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

      {/* Controls */}
      <div className="p-8 bg-black flex justify-center items-center">
        <button 
          onClick={capture}
          disabled={!isCameraReady}
          className="w-20 h-20 bg-white rounded-full flex items-center justify-center border-4 border-white/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
        >
          <div className="w-16 h-16 bg-white rounded-full border-2 border-black/10" />
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </motion.div>
  );
};
