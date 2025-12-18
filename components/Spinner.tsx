import React from 'react';

export const Spinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
      <p className="text-green-700 font-medium animate-pulse">Analyzing with Kisan-Rakshak AI...</p>
    </div>
  );
};
