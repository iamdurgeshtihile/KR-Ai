import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { AppMode, ModeConfig, HistoryItem } from './types';
import { ModeCard } from './components/ModeCard';
import { FileUpload } from './components/FileUpload';
import { Spinner } from './components/Spinner';
import { ChatInterface } from './components/ChatInterface';
import { HistoryModal } from './components/HistoryModal';
import { 
  analyzeDiagnosticMedia, 
  getDailyTip, 
  generateSpeech,
  getMarketInsights 
} from './services/geminiService';

const MODES: ModeConfig[] = [
  {
    id: AppMode.ANIMAL_BEHAVIOR,
    title: 'Animal Behavior',
    description: 'Video/GIF analysis for stress & pain detection.',
    icon: '🐄',
    acceptedFileTypes: 'video/*,image/gif',
    inputLabel: 'Video/GIF',
  },
  {
    id: AppMode.VET_DERM,
    title: 'Vet Derm-Scan',
    description: 'Skin lesion & rash identification.',
    icon: '🐕',
    acceptedFileTypes: 'image/*',
    inputLabel: 'Photo',
  },
  {
    id: AppMode.CROP_DOCTOR,
    title: 'Crop Doctor',
    description: 'Leaf disease & pest diagnosis.',
    icon: '🌱',
    acceptedFileTypes: 'image/*',
    inputLabel: 'Leaf Photo',
  },
  {
    id: AppMode.MARKET_INSIGHTS,
    title: 'Market Insights',
    description: 'Real-time prices via Google Search.',
    icon: '📈',
    inputLabel: '', // Not used
    acceptedFileTypes: '' // Not used
  }
];

const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<ModeConfig | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [groundingUrls, setGroundingUrls] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dailyTip, setDailyTip] = useState<string>('Loading daily tip...');
  const [showChat, setShowChat] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load daily tip and history on mount
  useEffect(() => {
    getDailyTip().then(setDailyTip);
    const savedHistory = localStorage.getItem('kisan_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history helper
  const saveToHistory = (mode: AppMode, text: string, urls: any[] = []) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      mode: mode,
      result: text,
      groundingUrls: urls,
      previewText: text.substring(0, 150) + "..."
    };
    
    const updatedHistory = [newItem, ...history].slice(0, 20); // Keep last 20
    setHistory(updatedHistory);
    localStorage.setItem('kisan_history', JSON.stringify(updatedHistory));
  };

  const handleModeSelect = (mode: ModeConfig) => {
    setActiveMode(mode);
    resetState();
  };

  const handleBack = () => {
    setActiveMode(null);
    resetState();
  };

  const resetState = () => {
    setFile(null);
    setSearchQuery('');
    setResult(null);
    setGroundingUrls([]);
    setError(null);
    setIsLoading(false);
    setAudioUrl(null);
  };

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.size > 20 * 1024 * 1024) {
        setError("File too large (>20MB).");
        return;
    }
    setFile(selectedFile);
    setError(null);
  }, []);

  const playTTS = async () => {
    if (!result || audioUrl) return; // Play existing if there
    setIsLoading(true); // Small loading indicator for audio
    try {
      const audioBase64 = await generateSpeech(result);
      if (audioBase64) {
        const url = `data:audio/mp3;base64,${audioBase64}`;
        setAudioUrl(url);
        new Audio(url).play();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!activeMode) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    setAudioUrl(null);

    try {
      let analysisText = "";
      let urls: any[] = [];

      if (activeMode.id === AppMode.MARKET_INSIGHTS) {
        if (!searchQuery.trim()) throw new Error("Please enter a crop or market name.");
        const data = await getMarketInsights(searchQuery);
        analysisText = data.text;
        urls = data.urls;
      } else {
        if (!file) throw new Error("Please upload a file.");
        analysisText = await analyzeDiagnosticMedia(file, activeMode.id);
      }

      setResult(analysisText);
      setGroundingUrls(urls);
      saveToHistory(activeMode.id, analysisText, urls);

    } catch (err: any) {
      setError(err.message || "Error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const restoreHistoryItem = (item: HistoryItem) => {
    const modeConfig = MODES.find(m => m.id === item.mode);
    if (modeConfig) {
      setActiveMode(modeConfig);
      setResult(item.result);
      setGroundingUrls(item.groundingUrls || []);
      setFile(null); // File is not restored
      setShowHistory(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-20 sm:pb-0">
      
      {/* Mobile Sticky Header */}
      <header className="bg-white/95 backdrop-blur-sm sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2" onClick={handleBack}>
            <span className="text-2xl">🚜</span>
            <h1 className="text-lg font-bold text-green-800">Kisan-Rakshak</h1>
          </div>
          
          <div className="flex items-center space-x-2">
             <button 
               onClick={() => setShowHistory(true)}
               className="p-2 text-green-700 hover:bg-green-50 rounded-full transition-colors"
               title="History"
             >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
             </button>
            {activeMode && (
              <button onClick={handleBack} className="p-2 text-gray-500 hover:text-green-600">
                <span className="sr-only">Back</span>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 max-w-lg mx-auto w-full sm:max-w-4xl">
        
        {/* HOME SCREEN */}
        {!activeMode && (
          <div className="space-y-6 animate-fade-in">
            {/* Daily Tip Card */}
            <div className="bg-gradient-to-r from-amber-100 to-orange-50 p-4 rounded-2xl border border-amber-200 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-xl">⚡</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800">Daily Fast Tip</h3>
              </div>
              <p className="text-sm text-gray-800 font-medium italic">"{dailyTip}"</p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">Diagnostics</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {MODES.filter(m => m.id !== AppMode.MARKET_INSIGHTS).map((mode) => (
                  <ModeCard key={mode.id} mode={mode} onClick={handleModeSelect} />
                ))}
              </div>
            </div>

             <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900">Tools</h2>
              <div className="grid grid-cols-1 gap-3">
                 <ModeCard 
                    mode={MODES.find(m => m.id === AppMode.MARKET_INSIGHTS)!} 
                    onClick={handleModeSelect} 
                 />
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE MODE SCREEN */}
        {activeMode && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[50vh]">
            <div className="bg-green-50 p-4 border-b border-green-100">
               <h2 className="text-xl font-bold text-green-900 flex items-center gap-2">
                 <span>{activeMode.icon}</span> {activeMode.title}
               </h2>
            </div>

            <div className="p-4 space-y-6">
              
              {/* Input Section */}
              {!result && !isLoading && (
                <div className="space-y-4">
                  {activeMode.id === AppMode.MARKET_INSIGHTS ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Search Market/Crop</label>
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="e.g., Onion price in Nashik, Wheat diseases"
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                  ) : (
                    <FileUpload 
                      label={activeMode.inputLabel || "Upload"} 
                      acceptedTypes={activeMode.acceptedFileTypes || "*"}
                      onFileSelect={handleFileSelect}
                    />
                  )}

                  <button
                    onClick={handleAnalyze}
                    disabled={!file && !searchQuery}
                    className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold shadow-md active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
                  >
                    {activeMode.id === AppMode.MARKET_INSIGHTS ? "Search Info" : "Analyze Media"}
                  </button>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm text-center border border-red-100">
                      {error}
                    </div>
                  )}
                </div>
              )}

              {/* Loading */}
              {isLoading && <Spinner />}

              {/* Result */}
              {result && (
                <div className="animate-fade-in space-y-4">
                  {/* TTS Button */}
                  <div className="flex justify-end">
                    <button 
                      onClick={playTTS}
                      className="flex items-center space-x-2 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-full hover:bg-green-100"
                    >
                      <span>{audioUrl ? "🔊 Play Again" : "🔈 Read Aloud"}</span>
                    </button>
                    {audioUrl && (
                        <audio src={audioUrl} controls className="hidden" />
                    )}
                  </div>

                  <div className="prose prose-sm prose-green max-w-none bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <ReactMarkdown>{result}</ReactMarkdown>
                  </div>

                  {groundingUrls.length > 0 && (
                    <div className="space-y-2">
                       <h4 className="text-xs font-bold uppercase text-gray-500">Sources</h4>
                       <ul className="text-xs space-y-1">
                         {groundingUrls.map((url, i) => (
                           <li key={i}>
                             <a href={url.uri} target="_blank" rel="noreferrer" className="text-blue-600 truncate block">
                               {url.title || url.uri}
                             </a>
                           </li>
                         ))}
                       </ul>
                    </div>
                  )}

                  <button 
                    onClick={resetState}
                    className="w-full py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50"
                  >
                    Start New Analysis
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button for Chat */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowChat(true)}
          className="bg-green-600 text-white p-4 rounded-full shadow-lg hover:bg-green-700 transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
          title="Open AI Assistant"
        >
          <span className="text-2xl">💬</span>
        </button>
      </div>

      {/* Overlays */}
      <ChatInterface isOpen={showChat} onClose={() => setShowChat(false)} />
      
      <HistoryModal 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)}
        history={history}
        onSelect={restoreHistoryItem}
        onClear={() => {
          localStorage.removeItem('kisan_history');
          setHistory([]);
        }}
      />

    </div>
  );
};

export default App;
