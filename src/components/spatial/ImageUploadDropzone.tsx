"use client";

import { useState, useRef } from "react";
import { UploadCloud } from "lucide-react";

interface Props {
  onUpload: (file: File) => Promise<void>;
  isUploading?: boolean;
  label?: string;
}

export function ImageUploadDropzone({ onUpload, isUploading, label = "Upload Image" }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type.startsWith("image/")) {
      onUpload(file);
    } else {
      alert("Please upload an image file");
    }
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg transition-colors ${
        isDragging ? "border-brand-accent bg-brand-accent/5" : "border-[#332f2a] bg-[#1a1816]"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="cursor-pointer flex flex-col items-center" onClick={() => fileInputRef.current?.click()}>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleChange}
          disabled={isUploading}
        />
        <UploadCloud className={`h-12 w-12 mb-4 ${isUploading ? 'animate-bounce text-brand-accent' : 'text-brand-text-muted'}`} />
        <h3 className="text-white font-medium mb-1">
          {isUploading ? "Uploading & Compressing..." : label}
        </h3>
        <p className="text-sm text-brand-text-muted text-center max-w-xs">
          {isUploading ? "Please wait." : "Drag and drop an image here, or click to browse."}
        </p>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <button
          className="mt-4 px-3 py-1 bg-red-500/20 text-red-500 text-xs rounded z-10"
          onClick={(e) => {
            e.stopPropagation();
            // Create a dummy image file for automated testing
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 600;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#222';
              ctx.fillRect(0, 0, 800, 600);
              ctx.fillStyle = '#fff';
              ctx.font = '30px Arial';
              ctx.fillText('Test Image ' + Math.random().toString().slice(2, 6), 50, 50);
            }
            canvas.toBlob((blob) => {
              if (blob) {
                const file = new File([blob], 'test.webp', { type: 'image/webp' });
                handleFile(file);
              }
            }, 'image/webp');
          }}
        >
          Auto-Upload (Dev Test)
        </button>
      )}
    </div>
  );
}
