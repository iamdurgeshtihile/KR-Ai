
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Language } from '../types';
import { chatWithAI, transcribeAudio, generateSpeech, playPCM } from '../services/geminiService';
import { AudioRecorder } from './AudioRecorder';
import { t } from '../translations';

interface ChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: Language;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ isOpen, onClose, currentLanguage }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
       const welcomeText = t('welcome_ai', currentLanguage.code);
       setMessages([{ role: 'model', text: welcomeText }]);
    }
  }, [currentLanguage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isLoading) return;
    
    const userMsg: ChatMessage = { role: 'user', text: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const responseText = await chatWithAI(history, text, currentLanguage);
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
      
      if (autoSpeak) {
        const audioData = await generateSpeech(responseText, currentLanguage);
        if (audioData) await playPCM(audioData);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'model', text: "Service is busy. Retrying..." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    setIsLoading(true);
    try {
      const transcribedText = await transcribeAudio(blob);
      if (transcribedText) {
        setInput(transcribedText);
        handleSend(transcribedText);
      }
    } catch (e) {
      alert("Could not transcribe voice.");
    } finally {
      setIsTranscribing(false);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] bg-emerald-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 font-${currentLanguage.code === 'en' ? 'sans' : currentLanguage.code}`}>
      <div className="bg-white w-full h-[92vh] sm:h-[650px] sm:max-w-md rounded-t-[3rem] sm:rounded-[3rem] flex flex-col shadow-2xl overflow-hidden animate-slide-up border border-white/20">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">🤖</div>
            <div>
              <h3 className="font-bold text-lg leading-none">KrishiX AI</h3>
              <p className="text-[10px] uppercase font-bold text-emerald-100 tracking-widest mt-1">{t('live_in', currentLanguage.code)} {currentLanguage.nativeName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setAutoSpeak(!autoSpeak)} 
              className={`p-3 rounded-2xl transition-all ${autoSpeak ? 'bg-white text-emerald-600' : 'bg-white/10 text-white'}`}
              title="Toggle Auto-Speak"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
            <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-emerald-50/30 custom-scrollbar">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-[2rem] p-4 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-emerald-800 text-white rounded-br-none' 
                  : 'bg-white text-emerald-900 border border-emerald-100 rounded-bl-none font-medium'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && !isTranscribing && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-3xl rounded-bl-none border border-emerald-100 flex space-x-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-150"></div>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-300"></div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 bg-white border-t border-emerald-50 flex flex-col space-y-4 shrink-0">
          {isTranscribing && (
             <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 rounded-full">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping"></div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{t('listening', currentLanguage.code)}</span>
             </div>
          )}
          <div className="flex items-center space-x-3">
            <AudioRecorder 
              onRecordingComplete={handleAudioTranscription} 
              isProcessing={isLoading} 
              className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t('ask_anything', currentLanguage.code)}
              className="flex-1 bg-emerald-50/50 border-2 border-emerald-50 rounded-full px-6 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-medium text-emerald-900"
              disabled={isLoading}
            />
            <button onClick={() => handleSend()} disabled={!input.trim() || isLoading} className="p-4 bg-emerald-900 text-white rounded-full hover:bg-emerald-800 disabled:opacity-30 transition-all shadow-xl active:scale-90">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
