'use client';

import { useState, useRef } from 'react';
import { UploadCloud, Trash2 } from 'lucide-react';

interface ImageDropzoneProps {
  fieldPath: string;
  label: string;
  height?: string; 
  watch: any;
  setValue: any;
  errors: any;
  setPendingFiles: React.Dispatch<React.SetStateAction<Record<string, File>>>;
  setPreviews: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  previews: Record<string, string>;
}

export default function ImageDropzone({
  fieldPath,
  label,
  height = 'h-32',
  watch,
  setValue,
  errors,
  setPendingFiles,
  setPreviews,
  previews,
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentUrl = watch(fieldPath);
  const previewUrl = previews[fieldPath] || currentUrl;

  // Core handler for when a file is selected or dropped
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }
    
    // Save the actual file for uploading later
    setPendingFiles((prev) => ({ ...prev, [fieldPath]: file }));
    
    // Create a local blob URL for instant preview
    const objectUrl = URL.createObjectURL(file);
    setPreviews((prev) => ({ ...prev, [fieldPath]: objectUrl }));
    
    // Update the react-hook-form value so validation passes
    setValue(fieldPath, file.name, { shouldValidate: true });
  };

  // --- NATIVE DRAG AND DROP HANDLERS ---
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Prevents the browser from opening the image in a new tab
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
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the file dialog when clicking delete
    
    // Clean up the local blob URL to prevent memory leaks
    if (previews[fieldPath]) {
      URL.revokeObjectURL(previews[fieldPath]);
    }
    
    // Remove from states
    setPendingFiles((prev) => {
      const copy = { ...prev };
      delete copy[fieldPath];
      return copy;
    });
    
    setPreviews((prev) => {
      const copy = { ...prev };
      delete copy[fieldPath];
      return copy;
    });
    
    // Clear the react-hook-form value
    setValue(fieldPath, "", { shouldValidate: true });
    
    // Reset the hidden input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
        {label}
      </label>

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
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center backdrop-blur-sm">
            <button 
              type="button" 
              onClick={handleRemove} 
              className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-colors shadow-lg transform hover:scale-105"
            >
              <Trash2 size={16} /> Remove Image
            </button>
          </div>
        </div>
      ) : (
        /* NATIVE HTML5 DROPZONE */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ease-in-out
            ${height}
            ${isDragging ? 'border-brand-gold bg-brand-gold/5' : 'border-gray-300 bg-gray-50 hover:border-brand-blue hover:bg-gray-100'}
            ${errors[fieldPath] ? 'border-red-300 bg-red-50' : ''}
          `}
        >
          {/* Hidden file input triggered by the div click */}
          <input 
            type="file" 
            ref={inputRef} 
            onChange={handleChange} 
            accept="image/*" 
            className="hidden" 
          />
          
          <UploadCloud 
            size={24} 
            className={`mb-2 ${isDragging ? 'text-brand-gold animate-bounce' : 'text-gray-400'}`} 
          />
          <p className="text-xs text-gray-500 font-medium text-center px-4">
            {isDragging ? 'Drop image here!' : 'Click or drag image here'}
          </p>
        </div>
      )}
      
      {/* Error Message */}
      {errors && errors[fieldPath] && (
        <p className="text-red-500 text-[10px] font-bold mt-1">
          {errors[fieldPath]?.message as string}
        </p>
      )}
    </div>
  );
}