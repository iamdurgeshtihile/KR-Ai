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
      className="flex flex-col items-start p-6 bg-white border border-green-100 rounded-2xl shadow-sm hover:shadow-xl hover:border-green-300 transition-all duration-300 text-left w-full h-full group"
    >
      <div className="mb-4 text-4xl p-3 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
        {mode.icon}
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-green-700">
        {mode.title}
      </h3>
      <p className="text-gray-500 text-sm leading-relaxed">
        {mode.description}
      </p>
    </button>
  );
};
