import React from 'react';
import { ModeConfig } from '../types';

interface ModeCardProps {
  mode: ModeConfig;
  onClick: (mode: ModeConfig) => void;
}

export const ModeCard: React.FC<ModeCardProps> = ({ mode, onClick }) => {
  return (
    <button
      onClick={() => onClick(mode)}
      className="flex flex-col items-center justify-center p-6 bg-white border border-emerald-100 rounded-[2.5rem] shadow-md hover:shadow-xl hover:border-emerald-500 transition-all duration-300 text-center w-full group relative overflow-hidden h-full min-h-[160px]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="mb-4 text-4xl p-3 bg-emerald-50 rounded-2xl group-hover:scale-110 transition-transform duration-500 shadow-inner">
        {mode.icon}
      </div>
      
      <div className="space-y-1 relative z-10">
        <h3 className="text-sm font-bold text-emerald-900 group-hover:text-emerald-600 transition-colors">
          {mode.title}
        </h3>
        <p className="text-[10px] text-emerald-600/50 font-bold uppercase tracking-widest line-clamp-1">
           Precision AI
        </p>
      </div>

      <div className="absolute bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
         <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
      </div>
    </button>
  );
};