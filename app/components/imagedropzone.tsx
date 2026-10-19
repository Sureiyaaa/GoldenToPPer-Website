'use client';

import { useState, useRef } from 'react';
import { UploadCloud, Trash2, Loader2 } from 'lucide-react';

interface ImageDropzoneProps {
  fieldPath: string;
  label: string;
  height?: string; 
  watch?: any;
  setValue?: any;
  errors?: any;
  setPendingFiles?: React.Dispatch<React.SetStateAction<Record<string, File>>>;
  setPreviews?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  previews?: Record<string, string>;
  value?: string;
  onFileSelect?: (file: File) => void;
  onImageRemove?: () => void;
  validateFile?: (file: File) => string | null;
  disabled?: boolean;
  isUploading?: boolean;
  allowReplacement?: boolean;
}

export default function ImageDropzone({
  fieldPath,
  label,
  height = 'h-32',
  watch,
  setValue,
  errors = {},
  setPendingFiles,
  setPreviews,
  previews = {},
  value,
  onFileSelect,
  onImageRemove,
  validateFile,
  disabled = false,
  isUploading = false,
  allowReplacement = false,
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState('');

  const currentUrl = value ?? watch?.(fieldPath);
  const previewUrl = previews[fieldPath] || currentUrl;

  // Core handler for when a file is selected or dropped
  const processFile = (file: File) => {
    if (disabled) return;
    if (validateFile) {
      const error = validateFile(file);
      setFileError(error || '');
      if (error) return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }
    setFileError('');
    if (onFileSelect) {
      onFileSelect(file);
      return;
    }
    
    // Save the actual file for uploading later
    setPendingFiles?.((prev) => ({ ...prev, [fieldPath]: file }));
    
    // Create a local blob URL for instant preview
    const objectUrl = URL.createObjectURL(file);
    if (previews[fieldPath]?.startsWith('blob:')) URL.revokeObjectURL(previews[fieldPath]);
    setPreviews?.((prev) => ({ ...prev, [fieldPath]: objectUrl }));
    
    // Update the react-hook-form value so validation passes
    setValue?.(fieldPath, file.name, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  // --- NATIVE DRAG AND DROP HANDLERS ---
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevents the browser from opening the image in a new tab
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };

  // Handler for clicking the box to open file explorer
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the file dialog when clicking delete
    if (disabled) return;
    setFileError('');
    if (onImageRemove) {
      onImageRemove();
      return;
    }
    
    // Clean up the local blob URL to prevent memory leaks
    if (previews[fieldPath]) {
      URL.revokeObjectURL(previews[fieldPath]);
    }
    
    // Remove from states
    setPendingFiles?.((prev) => {
      const copy = { ...prev };
      delete copy[fieldPath];
      return copy;
    });
    
    setPreviews?.((prev) => {
      const copy = { ...prev };
      delete copy[fieldPath];
      return copy;
    });
    
    // Clear the react-hook-form value
    setValue?.(fieldPath, "", {
      shouldValidate: true,
      shouldDirty: true,
    });
    
    // Reset the hidden input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div
      onDragOver={!previewUrl || allowReplacement ? handleDragOver : undefined}
      onDragLeave={!previewUrl || allowReplacement ? handleDragLeave : undefined}
      onDrop={!previewUrl || allowReplacement ? handleDrop : undefined}
      aria-busy={isUploading}
      className={`flex flex-col gap-1 w-full ${isDragging ? 'rounded-xl ring-2 ring-brand-gold' : ''}`}
    >
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
        {label}
      </label>
      <input
        type="file"
        ref={inputRef}
        onChange={handleChange}
        accept="image/*"
        aria-label={`${label} file`}
        disabled={disabled}
        className="hidden"
      />

      {/* If we have an image, show the full auto-scaling preview */}
      {previewUrl ? (
        <div className="relative w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group">
          {/* h-auto allows the image to show its true proportions without cropping */}
          <img 
            src={previewUrl} 
            alt={label} 
            className="w-full h-auto block object-contain max-h-[500px]" 
          />
          
          {/* Hover Overlay with Delete Button */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 flex flex-wrap gap-2 items-center justify-center backdrop-blur-sm">
            {allowReplacement && <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-2 bg-brand-blue text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-brand-gold transition-colors shadow-lg disabled:opacity-40"
            >
              <UploadCloud size={16} /> Replace Image
            </button>}
            <button 
              type="button" 
              onClick={handleRemove} 
              disabled={disabled}
              className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-colors shadow-lg transform hover:scale-105"
            >
              <Trash2 size={16} /> Remove Image
            </button>
          </div>
        </div>
      ) : (
        /* NATIVE HTML5 DROPZONE */
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          aria-label={`Choose ${label}`}
          onClick={() => { if (!disabled) inputRef.current?.click(); }}
          onKeyDown={(event) => {
            if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ease-in-out
            ${height}
            ${isDragging ? 'border-brand-gold bg-brand-gold/5' : 'border-gray-300 bg-gray-50 hover:border-brand-blue hover:bg-gray-100'}
            ${errors[fieldPath] ? 'border-red-300 bg-red-50' : ''}
          `}
        >
          <UploadCloud 
            size={24} 
            className={`mb-2 ${isDragging ? 'text-brand-gold animate-bounce' : 'text-gray-400'}`} 
          />
          <p className="text-xs text-gray-500 font-medium text-center px-4">
            {isDragging ? 'Drop image here!' : 'Click or drag image here'}
          </p>
        </div>
      )}
      {isUploading && <p role="status" className="mt-2 flex items-center gap-2 text-xs text-brand-blue"><Loader2 size={14} className="animate-spin" /> Uploading image…</p>}
      {fileError && <p role="alert" className="mt-1 text-[10px] font-bold text-red-500">{fileError}</p>}
      
      {/* Error Message */}
      {errors && errors[fieldPath] && (
        <p className="text-red-500 text-[10px] font-bold mt-1">
          {errors[fieldPath]?.message as string}
        </p>
      )}
    </div>
  );
}
