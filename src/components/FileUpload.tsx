import React, { useState, useRef } from 'react';

interface FileUploadProps {
  label: string;
  acceptedTypes: string;
  onFileSelect: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ label, acceptedTypes, onFileSelect }) => {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    onFileSelect(file);
  };

  const isImageMode = acceptedTypes.includes('image');

  return (
    <div className="w-full space-y-6">
      <div
        className={`relative flex flex-col items-center justify-center w-full h-64 border-3 border-dashed rounded-[3rem] transition-all duration-300 cursor-pointer ${
          dragActive
            ? "border-emerald-500 bg-emerald-50"
            : "border-emerald-100 bg-white hover:border-emerald-300 hover:bg-emerald-50/30 shadow-inner"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-6">
          <div className={`w-16 h-16 rounded-3xl mb-4 transition-all flex items-center justify-center shadow-lg ${dragActive ? 'bg-emerald-500 text-white scale-110' : 'bg-emerald-50 text-emerald-400'}`}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-emerald-900 font-bold mb-1">
            Tap to upload <span className="text-emerald-500 underline">media</span>
          </p>
          <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">{label}</p>
          
          {fileName && (
             <div className="mt-4 px-4 py-2 bg-emerald-900 text-white rounded-2xl text-xs font-bold shadow-xl animate-fade-in flex items-center gap-2">
               <span className="truncate max-w-[150px]">{fileName}</span>
               <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
             </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={acceptedTypes}
          onChange={handleChange}
        />
      </div>

      {isImageMode && (
        <div className="flex flex-col items-center">
          <div className="flex items-center w-full gap-4 mb-4">
            <div className="h-px bg-emerald-100 flex-1"></div>
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">or take live shot</span>
            <div className="h-px bg-emerald-100 flex-1"></div>
          </div>
          
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-4 py-5 px-6 bg-emerald-900 text-white rounded-[2rem] font-bold shadow-xl shadow-emerald-900/20 active:scale-[0.98] transition-all group"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
              📸
            </div>
            <span>Use AI Camera</span>
          </button>
          
          <input
            ref={cameraInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            capture="environment"
            onChange={handleChange}
          />
        </div>
      )}
    </div>
  );
};