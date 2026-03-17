import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Droplet, 
  Leaf, 
  Bug, 
  CheckCircle, 
  AlertCircle, 
  Volume2, 
  Clock, 
  Activity, 
  ShieldCheck, 
  Cpu,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { krishiClawService, HardwareDevice, FarmOperation } from '../services/krishiClawService';
import { Language } from '../types';
import { db, rtdb, HARDWARE_TASKS_COLLECTION } from '../services/firebaseService';
import { t } from '../translations';
import { AudioRecorder } from './AudioRecorder';
import { transcribeAudio } from '../services/geminiService';

const MotionDiv = motion.div as any;

interface KrishiClawPanelProps {
  language: Language;
  farmContext: any;
}

const KrishiClawPanel: React.FC<KrishiClawPanelProps> = ({ language, farmContext }) => {
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [currentOperation, setCurrentOperation] = useState<FarmOperation | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [autoIrrigation, setAutoIrrigation] = useState(false);
  const [moistureThreshold, setMoistureThreshold] = useState(3000); // Default threshold for raw analogRead
  const [lastAutoTrigger, setLastAutoTrigger] = useState(0);

  useEffect(() => {
    if (isSimulating && currentOperation && currentOperation.status === 'pending') {
      const timer = setTimeout(async () => {
        await krishiClawService.updateTaskStatus(currentOperation.id, 'executing', 50);
        setTimeout(async () => {
          await krishiClawService.updateTaskStatus(currentOperation.id, 'completed', 100);
        }, 2000);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isSimulating, currentOperation]);

  useEffect(() => {
    // Listen to RTDB Telemetry
    const telemetryRef = rtdb.ref('telemetry');
    const onTelemetryChange = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        // Auto-irrigation logic
        if (autoIrrigation && data.soilMoisture > moistureThreshold && Date.now() - lastAutoTrigger > 60000) {
          // Note: Higher raw value usually means drier soil for many analog sensors
          // Adjusting logic: if soilMoisture > threshold (dry), trigger pump
          if (!currentOperation || currentOperation.status === 'completed') {
            handleCommand('Auto-Irrigation: Soil is dry');
            setLastAutoTrigger(Date.now());
          }
        }

        setDevices(prev => prev.map(dev => {
          if (dev.id === 'pump-001') {
            return { ...dev, currentReading: data.soilMoisture, status: 'online', lastUpdate: Date.now() };
          }
          if (dev.id === 'ws-001') {
            return { ...dev, currentReading: data.temperature, status: 'online', lastUpdate: Date.now() };
          }
          if (dev.id === 'hum-001') {
            return { ...dev, currentReading: data.humidity, status: 'online', lastUpdate: Date.now() };
          }
          if (dev.id === 'soil-001') {
            return { ...dev, currentReading: data.soilMoisture, status: 'online', lastUpdate: Date.now() };
          }
          return dev;
        }));
      }
    };
    telemetryRef.on('value', onTelemetryChange);

    // Listen to RTDB Task Status (for ESP32 updates)
    const taskRef = rtdb.ref('hardware_tasks/current_task');
    const onTaskChange = (snapshot: any) => {
      const data = snapshot.val();
      if (data && data.status === 'completed' && currentOperation?.status !== 'completed') {
        setCurrentOperation(prev => prev ? { ...prev, status: 'completed', progress: 100 } : null);
        setExecutionLog(prev => [`[${new Date().toLocaleTimeString()}] ✅ Hardware confirmed: TASK COMPLETED`, ...prev]);
      }
    };
    taskRef.on('value', onTaskChange);

    const loadDevices = async () => {
      const devList = await krishiClawService.getDevices();
      setDevices(devList);
    };
    loadDevices();

    // Real-time Task Listener (Firestore)
    const unsubscribe = db.collection(HARDWARE_TASKS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .onSnapshot((snapshot) => {
        if (!snapshot.empty) {
          const taskData = snapshot.docs[0].data();
          const task = {
            id: snapshot.docs[0].id,
            type: taskData.type,
            status: taskData.status,
            progress: taskData.progress || (taskData.status === 'completed' ? 100 : 0),
            startTime: taskData.createdAt?.toMillis() || Date.now(),
            estimatedDuration: 30,
            targetValues: taskData.metadata || {},
            deviceIds: [],
            confirmationRequired: false
          } as FarmOperation;
          
          setCurrentOperation(task);
          
          // Add to log if status changed
          setExecutionLog(prev => {
            const lastLog = prev[0];
            const newLog = `[${new Date().toLocaleTimeString()}] Hardware Status: ${task.status.toUpperCase()}`;
            if (lastLog !== newLog) return [newLog, ...prev];
            return prev;
          });
        }
      }, (error) => {
        console.error("Firestore Listener Error:", error);
      });

    return () => {
      unsubscribe();
      telemetryRef.off('value', onTelemetryChange);
      taskRef.off('value', onTaskChange);
    };
  }, [currentOperation?.id]);

  const handleCommand = async (cmd: string) => {
    setIsProcessing(true);
    const log = `[${new Date().toLocaleTimeString()}] Farmer Command: ${cmd}`;
    setExecutionLog((prev) => [log, ...prev]);

    const intent = await krishiClawService.parseIntent(cmd, language);
    
    if (intent.action === 'unknown') {
      setExecutionLog((prev) => [`[${new Date().toLocaleTimeString()}] ❌ Unknown command`, ...prev]);
      setIsProcessing(false);
      return;
    }

    if (intent.requiresConfirmation) {
      setPendingConfirmation({ 
        intent,
        confirmation: intent.hindiLabel || `Confirm ${intent.action}?` 
      });
    } else {
      await krishiClawService.createHardwareTask(intent.action, intent.params);
      setExecutionLog((prev) => [`[${new Date().toLocaleTimeString()}] 📡 Task sent to Hardware`, ...prev]);
    }
    setIsProcessing(false);
  };

  const handleConfirmation = async (confirmed: boolean) => {
    if (confirmed && pendingConfirmation) {
      const { intent } = pendingConfirmation;
      await krishiClawService.createHardwareTask(intent.action, intent.params);
      setExecutionLog((prev) => [`[${new Date().toLocaleTimeString()}] 📡 Confirmed: Task sent to Hardware`, ...prev]);
    } else {
      setExecutionLog((prev) => [`[${new Date().toLocaleTimeString()}] ❌ Cancelled by Farmer`, ...prev]);
    }
    setPendingConfirmation(null);
  };

  const handleAudioTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    setIsProcessing(true);
    try {
      const transcribedText = await transcribeAudio(blob);
      if (transcribedText) {
        handleCommand(transcribedText);
      }
    } catch (e) {
      alert("Could not transcribe voice.");
    } finally {
      setIsTranscribing(false);
      setIsProcessing(false);
    }
  };

  return (
    <div className={`space-y-6 font-${language.code === 'en' ? 'sans' : language.code}`}>
      <div className="bg-gradient-to-br from-agri-forest to-agri-moss p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
        <Cpu className="absolute top-4 right-4 text-agri-leaf opacity-20 w-32 h-32" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-yellow-400 fill-yellow-400" />
              <h2 className="text-4xl font-black">KrishiClaw</h2>
            </div>
            <a 
              href="/HardwareSetup.md" 
              target="_blank" 
              className="p-3 bg-white/20 hover:bg-white/30 rounded-2xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest"
            >
              <Settings className="w-4 h-4" />
              Setup Guide
            </a>
          </div>
          <p className="text-agri-sand font-bold opacity-80 max-w-md">
            {t('krishiclaw_desc', language.code)}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{t('system_online', language.code)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voice Control */}
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-agri-sand/50 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-agri-forest flex items-center gap-2">
              <Volume2 className="w-6 h-6" /> {t('voice_commands', language.code)}
            </h3>
            {isProcessing && <Activity className="w-5 h-5 text-agri-moss animate-spin" />}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {[
              { label: 'पानी दे दो', sub: 'Irrigation', icon: '💧' },
              { label: 'खाद डालो', sub: 'Fertilization', icon: '🌾' },
              { label: 'कीटनाशक छिड़ो', sub: 'Pest Control', icon: '🐛' },
              { label: 'मौसम बताओ', sub: 'Weather Check', icon: '⛅' },
            ].map((cmd, idx) => (
              <button
                key={idx}
                onClick={() => handleCommand(cmd.label)}
                disabled={!!currentOperation && currentOperation.status === 'executing'}
                className="flex items-center justify-between p-5 bg-agri-ivory hover:bg-agri-sand/30 rounded-3xl transition-all group disabled:opacity-50"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{cmd.icon}</span>
                  <div className="text-left">
                    <p className="font-black text-agri-forest">{cmd.label}</p>
                    <p className="text-[10px] font-bold text-agri-moss uppercase tracking-widest">{cmd.sub}</p>
                  </div>
                </div>
                <Zap className="w-5 h-5 text-agri-moss opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
          
          <div className="relative flex items-center gap-3">
            <AudioRecorder 
              onRecordingComplete={handleAudioTranscription} 
              isProcessing={isProcessing} 
              className="bg-agri-sand text-agri-forest hover:bg-agri-sand/80"
            />
            <div className="relative flex-1">
              <input 
                type="text" 
                placeholder={t('ask_anything', language.code)}
                className="w-full p-5 bg-slate-50 border-2 border-agri-sand rounded-2xl outline-none focus:border-agri-forest font-bold text-agri-forest pr-12"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCommand((e.target as any).value);
                    (e.target as any).value = '';
                  }
                }}
              />
              {isTranscribing && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-2 h-2 bg-agri-forest rounded-full animate-ping" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Device Status */}
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-agri-sand/50 space-y-6">
          <h3 className="text-xl font-black text-agri-forest flex items-center gap-2">
            <Cpu className="w-6 h-6" /> {t('iot_network', language.code)}
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            {devices.map((device) => (
              <div key={device.id} className="p-5 bg-slate-50 rounded-3xl border border-agri-sand/30 relative overflow-hidden group">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-2 h-2 rounded-full ${device.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <CheckCircle className="w-4 h-4 text-agri-moss opacity-20 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="font-black text-agri-forest text-sm leading-tight mb-1">{device.name}</p>
                  <p className="text-[9px] font-bold text-agri-moss uppercase tracking-widest">{device.type}</p>
                  {device.currentReading !== undefined && (
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-xl font-black text-agri-forest">{device.currentReading}</span>
                      <span className="text-[10px] font-bold text-agri-moss">{device.type === 'sensor' ? '%' : '°C'}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current Operation & Logs */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-sm border border-agri-sand/50 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-agri-forest flex items-center gap-2">
              <Activity className="w-6 h-6" /> {t('live_operations', language.code)}
            </h3>
            {currentOperation && (
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsSimulating(!isSimulating)}
                  className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${isSimulating ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}
                >
                  {isSimulating ? 'Simulating' : 'Manual Mode'}
                </button>
                <span className="px-4 py-1.5 bg-blue-100 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {currentOperation.status}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              {pendingConfirmation ? (
                <MotionDiv initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-yellow-50 p-6 rounded-[2rem] border-2 border-yellow-200 space-y-4">
                  <div className="flex items-center gap-3 text-yellow-700">
                    <AlertCircle className="w-6 h-6" />
                    <p className="font-black text-lg">{t('safety_confirmation', language.code)}</p>
                  </div>
                  <p className="text-yellow-800 font-bold whitespace-pre-wrap">{pendingConfirmation.confirmation}</p>
                  <div className="flex gap-3">
                    <button onClick={() => handleConfirmation(true)} className="flex-1 py-4 bg-yellow-500 text-white rounded-2xl font-black shadow-lg">{t('confirm', language.code)}</button>
                    <button onClick={() => handleConfirmation(false)} className="flex-1 py-4 bg-white text-yellow-700 rounded-2xl font-black border border-yellow-200">{t('cancel', language.code)}</button>
                  </div>
                </MotionDiv>
              ) : currentOperation ? (
                <div className="bg-agri-ivory p-6 rounded-[2rem] space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-2xl font-black text-agri-forest">{currentOperation.type}</h4>
                      <p className="text-xs font-bold text-agri-moss uppercase tracking-widest">Active Task • {currentOperation.deviceIds[0]}</p>
                    </div>
                    <div className="p-3 bg-white rounded-2xl shadow-sm">
                      <Clock className="w-6 h-6 text-agri-forest" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-agri-moss">
                      <span>{t('progress', language.code)}</span>
                      <span>{currentOperation.progress}%</span>
                    </div>
                    <div className="h-4 bg-white rounded-full overflow-hidden shadow-inner">
                      <MotionDiv 
                        initial={{ width: 0 }} 
                        animate={{ width: `${currentOperation.progress}%` }} 
                        className={`h-full ${currentOperation.status === 'completed' ? 'bg-agri-forest' : 'bg-blue-500'}`} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl">
                      <p className="text-[8px] font-black text-agri-moss uppercase mb-1">{t('duration', language.code)}</p>
                      <p className="text-sm font-black text-agri-forest">{currentOperation.estimatedDuration} min</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl">
                      <p className="text-[8px] font-black text-agri-moss uppercase mb-1">{t('started_at', language.code)}</p>
                      <p className="text-sm font-black text-agri-forest">{new Date(currentOperation.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-[200px] flex flex-col items-center justify-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-agri-sand text-agri-moss opacity-40">
                  <Zap className="w-12 h-12 mb-2" />
                  <p className="font-black uppercase tracking-widest text-xs">{t('no_active_ops', language.code)}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-black text-agri-forest uppercase tracking-widest">{t('execution_log', language.code)}</h4>
              <div className="bg-slate-900 p-6 rounded-[2rem] h-[250px] overflow-y-auto font-mono text-[10px] text-agri-leaf space-y-2 shadow-inner">
                {executionLog.length === 0 ? (
                  <p className="opacity-30 italic">{t('waiting_for_commands', language.code)}</p>
                ) : (
                  executionLog.map((log, idx) => (
                    <p key={idx} className="leading-relaxed">
                      <span className="opacity-50 mr-2">❯</span>
                      {log}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 p-6 rounded-[2rem] border border-green-100">
          <p className="text-[10px] font-black text-green-800 uppercase tracking-widest mb-1">{t('water_used', language.code)}</p>
          <p className="text-2xl font-black text-green-900">2,450L</p>
          <p className="text-[9px] font-bold text-green-700 mt-1">{t('last_30_days', language.code)}</p>
        </div>
        <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
          <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1">{t('cost_saved', language.code)}</p>
          <p className="text-2xl font-black text-blue-900">₹4,200</p>
          <p className="text-[9px] font-bold text-blue-700 mt-1">{t('efficiency_gain', language.code)}</p>
        </div>
        <div className="bg-yellow-50 p-6 rounded-[2rem] border border-yellow-100">
          <p className="text-[10px] font-black text-yellow-800 uppercase tracking-widest mb-1">{t('operations', language.code)}</p>
          <p className="text-2xl font-black text-yellow-900">128</p>
          <p className="text-[9px] font-bold text-yellow-700 mt-1">{t('success_rate', language.code)}</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-[2rem] border border-purple-100">
          <p className="text-[10px] font-black text-purple-800 uppercase tracking-widest mb-1">{t('carbon_saved', language.code)}</p>
          <p className="text-2xl font-black text-purple-900">12kg</p>
          <p className="text-[9px] font-bold text-purple-700 mt-1">{t('eco_impact', language.code)}</p>
        </div>
      </div>

      <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 flex items-start gap-4">
        <div className="p-3 bg-emerald-100 rounded-2xl">
          <ShieldCheck className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h4 className="font-black text-emerald-900 mb-1">{t('hardware_integration_title', language.code)}</h4>
          <p className="text-xs text-emerald-800/70 font-medium leading-relaxed">
            {t('hardware_integration_desc', language.code)}
          </p>
        </div>
      </div>

      {/* Auto-Irrigation Settings */}
      <div className="bg-blue-50 p-8 rounded-[3rem] border border-blue-100 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500 text-white rounded-2xl shadow-lg">
              <Droplet className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-black text-blue-900">Smart Auto-Irrigation</h3>
          </div>
          <button 
            onClick={() => setAutoIrrigation(!autoIrrigation)}
            className={`w-14 h-8 rounded-full p-1 transition-all ${autoIrrigation ? 'bg-blue-500' : 'bg-slate-300'}`}
          >
            <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${autoIrrigation ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between text-xs font-black uppercase tracking-widest text-blue-800">
            <span>Dryness Threshold</span>
            <span>{moistureThreshold}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="4095" 
            value={moistureThreshold} 
            onChange={(e) => setMoistureThreshold(parseInt(e.target.value))}
            className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <p className="text-[10px] font-bold text-blue-700/60 leading-relaxed italic">
            * Higher values usually indicate drier soil on ESP32 analog pins. The pump will trigger automatically when moisture exceeds this value.
          </p>
        </div>

        {autoIrrigation && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
            <Activity className="w-3 h-3" /> Monitoring Soil Health...
          </div>
        )}
      </div>
    </div>
  );
};

export default KrishiClawPanel;
