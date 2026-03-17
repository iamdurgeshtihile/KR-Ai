
import React from 'react';

export const Spinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-6 animate-fade-in">
      <div className="relative">
        <div className="w-16 h-16 border-[3px] border-agri-sand rounded-full"></div>
        <div className="w-16 h-16 border-[3px] border-transparent border-t-agri-forest rounded-full animate-spin absolute top-0 left-0"></div>
        <div className="absolute inset-0 flex items-center justify-center text-xl">🌿</div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-agri-forest font-bold tracking-tight">KrishiX is Thinking</p>
        <p className="text-[10px] uppercase tracking-widest text-agri-clay font-black animate-pulse">Running Diagnostic Protocols</p>
      </div>
    </div>
  );
};
