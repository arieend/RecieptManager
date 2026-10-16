import React, { useState, useRef, useEffect } from 'react';
import { Check, X, Maximize, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './ui/Base';
import { translations } from '../translations';
import { detectReceipt } from '../utils/autocrop';

interface Point {
  x: number;
  y: number;
}

interface CropperProps {
  image: string;
  onCrop: (croppedBase64: string) => void;
  onCancel: () => void;
  language: 'en' | 'he';
  autoDetectEnabled?: boolean;
}

interface EdgeData {
  map: Uint8Array;
  width: number;
  height: number;
}

export const Cropper: React.FC<CropperProps> = ({ 
  image, onCrop, onCancel, language, autoDetectEnabled = true 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [points, setPoints] = useState<Point[]>([
    { x: 10, y: 10 },
    { x: 90, y: 10 },
    { x: 90, y: 90 },
    { x: 10, y: 90 },
  ]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0, displayWidth: 0, displayHeight: 0 });
  const [isDetecting, setIsDetecting] = useState(false);
  const [edgeData, setEdgeData] = useState<EdgeData | null>(null);
  const [edgeOverlayUrl, setEdgeOverlayUrl] = useState<string | null>(null);

  const t = translations[language];

  const animateToPoints = (targetPoints: Point[]) => {
    const duration = 750; // Total interpolation duration in ms
    const startPoints = [...points];
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Smooth dynamic ease-out cubic curve
      const ease = 1 - Math.pow(1 - progress, 3);

      const interpolated = startPoints.map((p, idx) => {
        const target = targetPoints[idx];
        return {
          x: p.x + (target.x - p.x) * ease,
          y: p.y + (target.y - p.y) * ease,
        };
      });

      setPoints(interpolated);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setIsDetecting(false);
      }
    };

    requestAnimationFrame(step);
  };

  const autoDetect = async () => {
    setIsDetecting(true);
    // Start with wide bounds to animate a clean shrink/snap onto the receipt
    setPoints([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]);

    try {
      // Ensure the scanner animation sweeps for at least 800ms for premium UX
      const [boundary] = await Promise.all([
        detectReceipt(image),
        new Promise(resolve => setTimeout(resolve, 800))
      ]);
      animateToPoints(boundary.points);
    } catch (e) {
      console.warn("Auto-cropping detection error", e);
      const fallbackPoints = [
        { x: 15, y: 5 },
        { x: 85, y: 5 },
        { x: 85, y: 95 },
        { x: 15, y: 95 },
      ];
      animateToPoints(fallbackPoints);
    }
  };

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImgSize(prev => ({ ...prev, width: img.width, height: img.height }));
      
      try {
        const tempCanvas = document.createElement('canvas');
        const analyzeWidth = 200;
        const analyzeHeight = Math.round((img.height / img.width) * analyzeWidth);
        
        if (analyzeWidth > 0 && analyzeHeight > 0) {
          tempCanvas.width = analyzeWidth;
          tempCanvas.height = analyzeHeight;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(img, 0, 0, analyzeWidth, analyzeHeight);
            const rawData = tempCtx.getImageData(0, 0, analyzeWidth, analyzeHeight);
            const data = rawData.data;
            
            const totalPix = analyzeWidth * analyzeHeight;
            const grays = new Uint8Array(totalPix);
            for (let i = 0; i < data.length; i += 4) {
              grays[i / 4] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            }
            
            const edgeMap = new Uint8Array(totalPix);
            const mags = new Float32Array(totalPix);
            let maxM = 0;
            
            for (let y = 1; y < analyzeHeight - 1; y++) {
              for (let x = 1; x < analyzeWidth - 1; x++) {
                const idx = y * analyzeWidth + x;
                const gx = grays[idx + 1] - grays[idx - 1];
                const gy = grays[idx + analyzeWidth] - grays[idx - analyzeWidth];
                const mag = Math.sqrt(gx * gx + gy * gy);
                mags[idx] = mag;
                if (mag > maxM) {
                  maxM = mag;
                }
              }
            }
            
            const contrastThreshold = Math.max(15, maxM * 0.25);
            for (let i = 0; i < mags.length; i++) {
              if (mags[i] > contrastThreshold) {
                edgeMap[i] = 1;
              }
            }
            
            setEdgeData({
              map: edgeMap,
              width: analyzeWidth,
              height: analyzeHeight
            });

            // Generate high-performance edge highlight overlay image
            const edgeCanvas = document.createElement('canvas');
            edgeCanvas.width = analyzeWidth;
            edgeCanvas.height = analyzeHeight;
            const edgeCtx = edgeCanvas.getContext('2d');
            if (edgeCtx) {
              const imgData = edgeCtx.createImageData(analyzeWidth, analyzeHeight);
              const data = imgData.data;
              for (let i = 0; i < totalPix; i++) {
                const pixelIdx = i * 4;
                if (edgeMap[i] === 1) {
                  // Beautiful bright green for the snap path guidelines (Emerald 500 vibe)
                  data[pixelIdx] = 16;     // R
                  data[pixelIdx + 1] = 185; // G
                  data[pixelIdx + 2] = 129; // B
                  data[pixelIdx + 3] = 220; // A (highly visible glowing stroke)
                } else {
                  data[pixelIdx] = 0;
                  data[pixelIdx + 1] = 0;
                  data[pixelIdx + 2] = 0;
                  data[pixelIdx + 3] = 0;
                }
              }
              edgeCtx.putImageData(imgData, 0, 0);
              setEdgeOverlayUrl(edgeCanvas.toDataURL());
            }
          }
        }
      } catch (err) {
        console.warn("Failed to generate edge snap data (CORS or canvas issue)", err);
      }

      if (autoDetectEnabled) {
        autoDetect();
      } else {
        setPoints([
          { x: 15, y: 5 },
          { x: 85, y: 5 },
          { x: 85, y: 95 },
          { x: 15, y: 95 },
        ]);
      }
    };
    img.onerror = () => {
      setIsDetecting(false);
      setPoints([
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
        { x: 10, y: 90 },
      ]);
    };
    img.src = image;
  }, [image, autoDetectEnabled]);

  const handleImgLoad = () => {
    if (imgRef.current) {
      setImgSize(prev => ({
        ...prev,
        displayWidth: imgRef.current!.clientWidth,
        displayHeight: imgRef.current!.clientHeight,
      }));
    }
  };

  const handleMouseDown = (idx: number) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDraggingIdx(idx);
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (draggingIdx === null || !imgRef.current) return;

    const rect = imgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    let x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    let y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    if (edgeData) {
      // Proximity threshold of 4% of the image's coordinate space (0-100)
      const SNAP_THRESHOLD_PCT = 4.0;
      
      const px = Math.round((x / 100) * (edgeData.width - 1));
      const py = Math.round((y / 100) * (edgeData.height - 1));
      
      const rx = Math.round((SNAP_THRESHOLD_PCT / 100) * edgeData.width);
      const ry = Math.round((SNAP_THRESHOLD_PCT / 100) * edgeData.height);
      const radius = Math.max(3, Math.min(20, Math.max(rx, ry)));
      
      let bestX = -1;
      let bestY = -1;
      let minDistanceSq = Infinity;
      
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = py + dy;
        if (ny < 0 || ny >= edgeData.height) continue;
        
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = px + dx;
          if (nx < 0 || nx >= edgeData.width) continue;
          
          const distSq = dx * dx + dy * dy;
          if (distSq > radius * radius) continue;
          
          const idx = ny * edgeData.width + nx;
          if (edgeData.map[idx] === 1) {
            if (distSq < minDistanceSq) {
              minDistanceSq = distSq;
              bestX = nx;
              bestY = ny;
            }
          }
        }
      }
      
      if (bestX !== -1 && bestY !== -1) {
        x = (bestX / (edgeData.width - 1)) * 100;
        y = (bestY / (edgeData.height - 1)) * 100;
      }
    }

    const newPoints = [...points];
    newPoints[draggingIdx] = { x, y };
    setPoints(newPoints);
  };

  const isSnapped = (p: Point) => {
    if (!edgeData) return false;
    const px = Math.round((p.x / 100) * (edgeData.width - 1));
    const py = Math.round((p.y / 100) * (edgeData.height - 1));
    if (px < 0 || px >= edgeData.width || py < 0 || py >= edgeData.height) return false;
    const idx = py * edgeData.width + px;
    return edgeData.map[idx] === 1;
  };

  const handleMouseUp = () => setDraggingIdx(null);

  const performCrop = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !imgRef.current) return;

    // For simplicity, we'll do a bounding box crop for now, 
    // as true perspective transform (quadrilateral to rectangle) 
    // requires complex math or a library like glfx.js.
    // However, we can at least crop to the bounding box of the points.
    
    const minX = Math.min(...points.map(p => p.x)) / 100 * imgSize.width;
    const maxX = Math.max(...points.map(p => p.x)) / 100 * imgSize.width;
    const minY = Math.min(...points.map(p => p.y)) / 100 * imgSize.height;
    const maxY = Math.max(...points.map(p => p.y)) / 100 * imgSize.height;

    const width = maxX - minX;
    const height = maxY - minY;

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(
      imgRef.current,
      minX, minY, width, height,
      0, 0, width, height
    );

    onCrop(canvas.toDataURL('image/jpeg', 0.9));
  };

  const resetPoints = () => {
    setPoints([
      { x: 10, y: 10 },
      { x: 90, y: 10 },
      { x: 90, y: 90 },
      { x: 10, y: 90 },
    ]);
  };


  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col">
      <div className="p-4 flex justify-between items-center bg-slate-900 text-white">
        <button onClick={onCancel} className="p-2" aria-label="Close"><X size={24} /></button>
        <h2 className="font-bold">{t.cropTitle}</h2>
        <div className="flex gap-2">
          <button onClick={resetPoints} className="p-2" title="Reset" aria-label="Reset"><RotateCcw size={20} /></button>
          <button onClick={autoDetect} className="p-2" title="Auto Detect" aria-label="Auto Detect"><Maximize size={20} /></button>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center p-4 touch-none"
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="relative inline-block max-w-full max-h-full overflow-hidden">
          <img 
            ref={imgRef}
            src={image} 
            alt="To crop" 
            className="max-w-full max-h-[70vh] object-contain select-none pointer-events-none"
            onLoad={handleImgLoad}
          />
          
          {/* Laser Scanner Line Overlay */}
          {isDetecting && (
            <motion.div 
              initial={{ top: '0%' }}
              animate={{ top: '100%' }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981,0_0_30px_#10b981] z-20 pointer-events-none"
            />
          )}

          {/* Smart Edge Detection Visual HUD */}
          {isDetecting && (
            <div className="absolute inset-0 bg-emerald-950/10 flex items-center justify-center pointer-events-none z-10">
              <div className="bg-slate-900/90 border border-emerald-500/40 text-emerald-400 px-4 py-2 rounded-xl flex items-center gap-2.5 text-xs font-bold tracking-wider uppercase shadow-xl backdrop-blur-md">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{language === 'he' ? 'זיהוי שולי קבלה אוטומטי...' : 'Auto-bounding receipt margins...'}</span>
              </div>
            </div>
          )}

          {/* Edge Snap Guidance Highlight Overlay */}
          {draggingIdx !== null && edgeOverlayUrl && (
            <motion.img 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              src={edgeOverlayUrl}
              alt="Edge Snap Assist Overlay"
              className="absolute inset-0 w-full h-full pointer-events-none object-fill mix-blend-screen z-10"
              style={{ imageRendering: 'pixelated' }}
            />
          )}

          {/* Active edge snap assist indicator */}
          {draggingIdx !== null && (
            <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none z-20">
              <div className="bg-slate-900/85 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase shadow-md backdrop-blur-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{language === 'he' ? 'מגנט שוליים פעיל' : 'Snap Assist Guidelines Active'}</span>
              </div>
            </div>
          )}
          
          {/* SVG Overlay for the crop area */}
          <svg 
            viewBox="0 0 100 100" 
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          >
            <polygon 
              points={points.map(p => `${p.x},${p.y}`).join(' ')}
              className={`fill-emerald-500/20 stroke-emerald-500 stroke-[0.6] transition-opacity duration-300 ${isDetecting ? 'animate-pulse opacity-90' : ''}`}
              strokeDasharray={isDetecting ? "1.5" : undefined}
            />
            {/* Explanatory scanner bounding boxes for maximum detail */}
            {isDetecting && (
              <>
                <polygon 
                  points={points.map(p => `${p.x},${p.y}`).join(' ')}
                  className="fill-transparent stroke-emerald-400 stroke-[0.2] opacity-50"
                  strokeDasharray="0.5"
                />
                {/* Visual anchor corners */}
                {points.map((p, index) => (
                  <circle 
                    key={index} 
                    cx={p.x} 
                    cy={p.y} 
                    r="1.2" 
                    className="fill-emerald-400 stroke-white stroke-[0.2] animate-ping" 
                  />
                ))}
              </>
            )}
          </svg>

          {/* Draggable Handles (disabled during detection) */}
          {!isDetecting && points.map((p, i) => {
            const snapped = isSnapped(p);
            return (
              <div
                key={i}
                className="absolute w-8 h-8 -ml-4 -mt-4 flex items-center justify-center cursor-move pointer-events-auto z-10"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onMouseDown={handleMouseDown(i)}
                onTouchStart={handleMouseDown(i)}
              >
                <div 
                  className={`w-4 h-4 rounded-full shadow-lg transition-all duration-150 ${
                    snapped 
                      ? 'bg-emerald-400 border-2 border-white scale-125 ring-4 ring-emerald-500/30' 
                      : 'bg-white border-2 border-emerald-600 hover:scale-125'
                  }`} 
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 bg-slate-900 flex justify-center">
        <Button 
          variant="primary" 
          size="lg" 
          className="w-full max-w-xs"
          onClick={performCrop}
          leftIcon={<Check size={20} />}
        >
          {t.confirm}
        </Button>
      </div>
    </div>
  );
};
