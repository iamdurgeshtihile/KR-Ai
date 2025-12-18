import React from 'react';
import { HistoryItem, AppMode } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

const getModeIcon = (mode: AppMode) => {
  switch (mode) {
    case AppMode.ANIMAL_BEHAVIOR: return '🐄';
    case AppMode.VET_DERM: return '🐕';
    case AppMode.CROP_DOCTOR: return '🌱';
    case AppMode.MARKET_INSIGHTS: return '📈';
    default: return '📄';
  }
};

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, onSelect, onClear }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md max-h-[80vh] rounded-2xl shadow-2xl flex flex-col animate-scale-up">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-green-50 rounded-t-2xl">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📜</span>
            <h2 className="text-lg font-bold text-gray-800">Past Diagnoses</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p>No history yet.</p>
              <p className="text-xs mt-1">Your scans will appear here.</p>
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className="w-full text-left p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-green-200 transition-all group"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-2xl p-2 bg-gray-50 rounded-lg group-hover:bg-green-50 transition-colors">
                    {getModeIcon(item.mode)}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <h4 className="font-bold text-gray-800 line-clamp-1 mb-1 group-hover:text-green-700">
                  {item.previewText.split('\n')[0].replace(/\*\*/g, '') || "Diagnosis Report"}
                </h4>
                <p className="text-xs text-gray-500 line-clamp-2">
                   {item.previewText}
                </p>
              </button>
            ))
          )}
        </div>

        {history.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button
              onClick={onClear}
              className="w-full py-2 text-sm text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors"
            >
              Clear History
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
