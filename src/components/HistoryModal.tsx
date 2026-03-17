import React from 'react';
import { HistoryItem, AppMode } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onShare: (text: string) => void;
  onClear: () => void;
}

const getModeIcon = (mode: AppMode) => {
  switch (mode) {
    case AppMode.CROP_DOCTOR: return '🌱';
    case AppMode.VET_DERM: return '🐄';
    case AppMode.ANIMAL_BEHAVIOR: return '🐕';
    case AppMode.MARKET_INSIGHTS: return '📈';
    default: return '📄';
  }
};

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, onSelect, onShare, onClear }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-emerald-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md max-h-[85vh] rounded-[3rem] shadow-2xl flex flex-col animate-scale-up overflow-hidden border border-white/20">
        <div className="p-6 border-b border-emerald-50 flex justify-between items-center bg-emerald-50/30">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-emerald-900 rounded-2xl flex items-center justify-center text-2xl shadow-xl">📜</div>
            <div>
              <h2 className="text-xl font-bold text-emerald-900">Archive</h2>
              <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-widest">Saved Diagnostics</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white border border-emerald-100 text-emerald-900 hover:bg-emerald-50 rounded-2xl transition-all shadow-sm">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-emerald-50/10">
          {history.length === 0 ? (
            <div className="text-center py-24 text-emerald-200">
              <div className="text-6xl mb-6 grayscale opacity-30">📂</div>
              <p className="font-bold text-emerald-900/40 text-lg italic">Archive Empty</p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="w-full flex items-start gap-4 p-5 bg-white border border-emerald-100 rounded-[2rem] hover:border-emerald-500 hover:shadow-xl transition-all group"
              >
                <button 
                  onClick={() => onSelect(item)}
                  className="flex-1 text-left"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-3xl p-3 bg-emerald-50 rounded-2xl group-hover:scale-110 transition-transform">
                      {getModeIcon(item.mode)}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-emerald-900 group-hover:text-emerald-600 transition-colors line-clamp-1 mb-1">
                    {item.previewText.split('\n')[0].replace(/\*\*/g, '') || "Untitled Report"}
                  </h4>
                  <p className="text-xs text-emerald-600/50 font-medium line-clamp-2 italic">
                     {item.previewText}
                  </p>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onShare(item.result); }}
                  className="p-3 text-emerald-500 bg-emerald-50 hover:bg-emerald-900 hover:text-white rounded-full transition-all active:scale-90"
                >
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                   </svg>
                </button>
              </div>
            ))
          )}
        </div>

        {history.length > 0 && (
          <div className="p-6 bg-emerald-50/50">
            <button
              onClick={onClear}
              className="w-full py-4 text-xs text-red-600 font-bold bg-white border border-red-100 rounded-2xl hover:bg-red-500 hover:text-white transition-all tracking-widest uppercase shadow-sm"
            >
              Clear Entire Archive
            </button>
          </div>
        )}
      </div>
    </div>
  );
};