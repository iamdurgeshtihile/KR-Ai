
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AppMode, Language } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const callAiWithRetry = async <T>(fn: () => Promise<T>, retries = 3, initialDelay = 1000): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error?.status || (error as any)?.response?.status;
      if (status === 500 || status === 429 || !status) {
        const delay = initialDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Base64 failed"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

let audioContext: AudioContext | null = null;

export const playPCM = async (base64Audio: string) => {
  try {
    if (!audioContext) audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    if (audioContext.state === 'suspended') await audioContext.resume();
    const buffer = await decodeAudioData(decodeBase64(base64Audio), audioContext, 24000, 1);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
  } catch (error) {
    console.error("Audio error:", error);
  }
};

export const getDailyTip = async (lang: Language): Promise<string> => {
  return callAiWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Short one-sentence farming tip for today in ${lang.name} and English.`,
    });
    return response.text || "Monitor crops for pests daily.";
  });
};

export const getLocalizedAdvisory = async (lat: number, lng: number, lang: Language): Promise<{text: string, urls: any[]}> => {
  return callAiWithRetry(async () => {
    const prompt = `Search weather and agricultural news for coordinates [${lat}, ${lng}]. 
    Provide a 3-step farmer action plan in ${lang.name} and English. Use Emojis. Focus on immediate tasks like irrigation or harvest based on current rain forecast.`;
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    const urls = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((c: any) => c.web ? { title: c.web.title, uri: c.web.uri } : null)
      .filter(Boolean) || [];
    return { text: response.text || "Intelligence offline.", urls };
  });
};

export const analyzeDiagnosticMedia = async (input: File | string, mode: AppMode, lang: Language): Promise<string> => {
  let base64Data: string;
  let mimeType: string;

  if (typeof input === 'string') {
    // Handle data URL from offline queue
    const parts = input.split(',');
    mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    base64Data = parts[1];
  } else {
    base64Data = await blobToBase64(input);
    mimeType = input.type;
  }

  const context = mode === AppMode.CROP_DOCTOR ? "Plant Pathologist" : "Veterinary Doctor";
  const protocol = `ROLE: You are an expert ${context}. Provide a structured diagnostic report in ${lang.name} and English:
  1. Diagnosis (निदान)
  2. Clinical Observations (लक्षणे)
  3. Severity Level (तीव्रता)
  4. Immediate Action Plan (तात्काळ कृती योजना)
  5. Prevention Tips (प्रतिबंधात्मक उपाय)
  Format as clean Markdown with bold headers.`;

  return callAiWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [{ inlineData: { data: base64Data, mimeType } }, { text: protocol }]
      },
      config: { temperature: 0.1, thinkingConfig: { thinkingBudget: 1000 } }
    });
    return response.text || "Scan inconclusive. Take another photo.";
  });
};

export const generateSpeech = async (text: string, lang: Language): Promise<string | null> => {
  const cleanText = text.replace(/[#*`-]/g, '').substring(0, 300);
  return callAiWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: `Read this in ${lang.name}: ${cleanText}` }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  });
};

export const chatWithAI = async (history: any[], message: string, lang: Language): Promise<string> => {
  return callAiWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [...history, { role: 'user', parts: [{ text: message }] }],
      config: { systemInstruction: `You are the KrishiX Concierge. Expert, helpful, and empathetic. Answer in ${lang.name} and English.` }
    });
    return response.text || "I'm here for your farm.";
  });
};

export const transcribeAudio = async (blob: Blob): Promise<string> => {
  const base64Data = await blobToBase64(blob);
  return callAiWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ inlineData: { data: base64Data, mimeType: 'audio/wav' } }, { text: "Transcribe farmer query." }] }
    });
    return response.text || "";
  });
};

export const getCropCalendar = async (lat: number, lng: number, lang: Language): Promise<string> => {
  return callAiWithRetry(async () => {
    const prompt = `Based on coordinates [${lat}, ${lng}] and current date ${new Date().toLocaleDateString()}, 
    provide a detailed crop calendar for the next 6 months in ${lang.name} and English. 
    Include:
    - What to plant now
    - What to prepare for
    - Expected harvest times for common regional crops.
    Use Google Search to find local agricultural cycles for this specific region.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text || "Calendar unavailable.";
  });
};

export const getPricePredictions = async (crops: string[], lang: Language): Promise<string> => {
  return callAiWithRetry(async () => {
    const prompt = `Analyze current market trends for these crops: ${crops.join(', ')}. 
    Predict price movements for the next 3 months in ${lang.name} and English. 
    Use historical data patterns and current market news via Google Search. 
    Provide actionable advice on when to sell or hold.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    return response.text || "Predictions unavailable.";
  });
};

export const predictHarvestDate = async (crop: string, plantingDate: string, lang: Language): Promise<string> => {
  return callAiWithRetry(async () => {
    const prompt = `A farmer planted ${crop} on ${plantingDate}. 
    Predict the optimal harvest window and provide growth stage milestones in ${lang.name} and English. 
    Consider standard variety durations and common regional factors.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "Prediction unavailable.";
  });
};
