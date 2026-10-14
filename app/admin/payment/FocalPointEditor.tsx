'use client';

import { useState, useRef, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

interface FocalPointEditorProps {
  imageUrl: string | undefined;
  focalX: number;
  focalY: number;
  onFocalChange: (x: number, y: number) => void;
  isHidden?: boolean;
  canEdit?: boolean;
}

export default function FocalPointEditor({
  imageUrl,
  focalX,
  focalY,
  onFocalChange,
  isHidden = false,
  canEdit = true,
}: FocalPointEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [inputX, setInputX] = useState<string>(focalX.toFixed(1));
  const [inputY, setInputY] = useState<string>(focalY.toFixed(1));

  // Sync local input state when props change
  useEffect(() => {
    setInputX(focalX.toFixed(1));
    setInputY(focalY.toFixed(1));
  }, [focalX, focalY]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canEdit) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFocalFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !canEdit) return;
    updateFocalFromPointer(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const updateFocalFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(0, Math.min(100, x));
    const clampedY = Math.max(0, Math.min(100, y));

    const roundedX = Math.round(clampedX * 10) / 10;
    const roundedY = Math.round(clampedY * 10) / 10;

    setInputX(roundedX.toFixed(1));
    setInputY(roundedY.toFixed(1));
    onFocalChange(roundedX, roundedY);
  };

  const handleInputChange = (type: 'x' | 'y', value: string) => {
    if (type === 'x') {
      setInputX(value);
    } else {
      setInputY(value);
    }
  };

  const handleInputBlur = (type: 'x' | 'y', value: string) => {
    let num = parseFloat(value);
    if (isNaN(num)) num = type === 'x' ? focalX : focalY;
    num = Math.max(0, Math.min(100, num));
    const rounded = Math.round(num * 10) / 10;

    if (type === 'x') {
      setInputX(rounded.toFixed(1));
      onFocalChange(rounded, focalY);
    } else {
      setInputY(rounded.toFixed(1));
      onFocalChange(focalX, rounded);
    }
  };

  const handleReset = () => {
    setInputX('50.0');
    setInputY('50.0');
    onFocalChange(50, 50);
  };

  return (
    <div className="space-y-3">
      {/* Hidden indicator */}
      {isHidden && (
        <div className="px-3 py-2 rounded-lg bg-gray-100 border border-gray-200">
          <p className="text-[10px] font-semibold text-gray-600">
            Hidden slide preview
          </p>
        </div>
      )}

      {/* Interactive preview */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200 ${
          canEdit ? 'cursor-crosshair' : 'cursor-default'
        } ${isDragging ? 'ring-2 ring-brand-gold/50' : ''}`}
        style={{ touchAction: 'none' }}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Focal point preview"
            className="w-full h-full object-cover select-none pointer-events-none"
            onError={(e) => {
              e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2256%22%3E%3Crect fill=%22%23f3f4f6%22 width=%22100%22 height=%2256%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22sans-serif%22 font-size=%2212%22 fill=%22%23d1d5db%22%3EImage not found%3C/text%3E%3C/svg%3E';
            }}
            style={{
              objectPosition: `${focalX}% ${focalY}%`,
            }}
          />
        )}

        {/* Focal marker */}
        <div
          className="absolute w-6 h-6 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${focalX}%`,
            top: `${focalY}%`,
          }}
        >
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-2 border-brand-gold shadow-lg"></div>
          {/* Inner crosshair */}
          <div className="absolute left-1/2 top-1/2 w-1 h-3 -translate-x-1/2 -translate-y-1/2 bg-brand-gold rounded-full"></div>
          <div className="absolute left-1/2 top-1/2 w-3 h-1 -translate-x-1/2 -translate-y-1/2 bg-brand-gold rounded-full"></div>
        </div>

        {/* Focus hint overlay (shown when not editing) */}
        {!canEdit && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <p className="text-white text-xs font-semibold">No edit permission</p>
          </div>
        )}
      </div>

      {/* Numeric inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-gray-600 mb-1">
            Horizontal
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={inputX}
              onChange={(e) => handleInputChange('x', e.target.value)}
              onBlur={(e) => handleInputBlur('x', e.target.value)}
              disabled={!canEdit}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 disabled:bg-gray-50 disabled:cursor-not-allowed"
              placeholder="50.0"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
              %
            </span>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-600 mb-1">
            Vertical
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={inputY}
              onChange={(e) => handleInputChange('y', e.target.value)}
              onBlur={(e) => handleInputBlur('y', e.target.value)}
              disabled={!canEdit}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 disabled:bg-gray-50 disabled:cursor-not-allowed"
              placeholder="50.0"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">
              %
            </span>
          </div>
        </div>
      </div>

      {/* Reset button */}
      <button
        type="button"
        onClick={handleReset}
        disabled={!canEdit}
        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 bg-white hover:border-brand-gold hover:bg-brand-gold/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <RotateCcw size={13} />
        Reset to Center
      </button>
    </div>
  );
}
