import { GoogleGenAI } from "@google/genai";
import firebase from "firebase/compat/app";
import { AppMode, Language } from "../types";
import { db, HARDWARE_TASKS_COLLECTION, addHardwareTask } from "./firebaseService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface HardwareDevice {
  id: string;
  type: 'pump' | 'fertilizer_dispenser' | 'weather_station' | 'sensor';
  name: string;
  status: 'online' | 'offline' | 'error';
  lastUpdate: number;
  currentReading?: number;
}

export interface FarmOperation {
  id: string;
  type: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  progress: number;
  targetValues: Record<string, any>;
  deviceIds: string[];
  confirmationRequired: boolean;
  estimatedDuration: number;
}

class KrishiClawService {
  async getDevices(): Promise<HardwareDevice[]> {
    return [
      { id: 'pump-001', name: 'ESP32 Irrigation Pump', type: 'pump', status: 'online', lastUpdate: Date.now(), currentReading: 0 },
      { id: 'ws-001', name: 'DHT11 Temp Sensor', type: 'weather_station', status: 'online', lastUpdate: Date.now(), currentReading: 0 },
      { id: 'hum-001', name: 'DHT11 Humidity Sensor', type: 'sensor', status: 'online', lastUpdate: Date.now(), currentReading: 0 },
      { id: 'soil-001', name: 'Soil Moisture Sensor', type: 'sensor', status: 'online', lastUpdate: Date.now(), currentReading: 0 },
    ];
  }

  async createHardwareTask(action: string, params: any) {
    return addHardwareTask({
      type: action.toUpperCase(),
      metadata: {
        ...params,
        source: 'KrishiClaw_Panel',
        timestamp: Date.now()
      }
    });
  }

  async updateTaskStatus(taskId: string, status: 'executing' | 'completed' | 'failed', progress: number = 0) {
    return db.collection(HARDWARE_TASKS_COLLECTION).doc(taskId).update({
      status,
      progress,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async parseIntent(command: string, lang: Language): Promise<any> {
    const prompt = `You are KrishiClaw NLU. Analyze this farmer's command: "${command}" in ${lang.name}.
    Extract the action (irrigation, fertilization, weather, or unknown) and parameters.
    Return JSON: { "action": "...", "params": {...}, "requiresConfirmation": boolean, "hindiLabel": "...", "englishLabel": "..." }`;

    const callWithRetry = async (retries = 3): Promise<any> => {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: { responseMimeType: "application/json" }
          });
          return JSON.parse(response.text || '{}');
        } catch (e: any) {
          console.warn(`NLU Attempt ${i + 1} failed:`, e);
          if (i === retries - 1) throw e;
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
    };

    try {
      return await callWithRetry();
    } catch (e) {
      console.error("NLU Final Error:", e);
      return { action: 'unknown', requiresConfirmation: false };
    }
  }
}

export const krishiClawService = new KrishiClawService();
