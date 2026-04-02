import React, { useState, useRef, useEffect } from 'react';
import { Check, X, Maximize, RotateCcw } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './ui/Base';
import { translations } from '../translations';

interface Point {
  x: number;
  y: number;
}

interface CropperProps {
  image: string;
  onCrop: (croppedBase64: string) => void;
  onCancel: () => void;
  language: 'en' | 'he';
}

export const Cropper: React.FC<CropperProps> = ({ image, onCrop, onCancel, language }) => {
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

  const t = translations[language];

  const autoDetect = () => {
    // Simple heuristic: try to find a centered rectangle that might be the receipt
    // In a real app, we'd use edge detection.
    setPoints([
      { x: 15, y: 5 },
      { x: 85, y: 5 },
      { x: 85, y: 95 },
      { x: 15, y: 95 },
    ]);
  };

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImgSize(prev => ({ ...prev, width: img.width, height: img.height }));
      autoDetect(); // Automatically run autoDetect when image is loaded
    };
    img.src = image;
  }, [image]);

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
    if (draggingIdx === null || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

    const newPoints = [...points];
    newPoints[draggingIdx] = { x, y };
    setPoints(newPoints);
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
        <button onClick={onCancel} className="p-2"><X size={24} /></button>
        <h2 className="font-bold">{t.cropTitle}</h2>
        <div className="flex gap-2">
          <button onClick={resetPoints} className="p-2" title="Reset"><RotateCcw size={20} /></button>
          <button onClick={autoDetect} className="p-2" title="Auto Detect"><Maximize size={20} /></button>
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
        <div className="relative inline-block max-w-full max-h-full">
          <img 
            ref={imgRef}
            src={image} 
            alt="To crop" 
            className="max-w-full max-h-[70vh] object-contain select-none pointer-events-none"
            onLoad={handleImgLoad}
          />
          
          {/* SVG Overlay for the crop area */}
          <svg 
            viewBox="0 0 100 100" 
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          >
            <polygon 
              points={points.map(p => `${p.x},${p.y}`).join(' ')}
              className="fill-emerald-500/20 stroke-emerald-500 stroke-[0.5]"
            />
            {/* Explicit lines for better visibility if needed, but polygon stroke should work now */}
          </svg>

          {/* Draggable Handles */}
          {points.map((p, i) => (
            <div
              key={i}
              className="absolute w-8 h-8 -ml-4 -mt-4 flex items-center justify-center cursor-move pointer-events-auto z-10"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onMouseDown={handleMouseDown(i)}
              onTouchStart={handleMouseDown(i)}
            >
              <div className="w-4 h-4 bg-white border-2 border-emerald-600 rounded-full shadow-lg" />
            </div>
          ))}
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
