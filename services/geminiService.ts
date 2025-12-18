import { GoogleGenAI, Modality } from "@google/genai";
import { AppMode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Helper to convert Blob/File to Base64
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64Data = reader.result.split(',')[1];
        resolve(base64Data);
      } else {
        reject(new Error("Failed to read blob"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * 1. FAST RESPONSE: Daily Tip using gemini-2.5-flash-lite
 */
export const getDailyTip = async (): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-latest",
      contents: "Provide a very short, one-sentence practical farming tip for today in Marathi and English.",
    });
    return response.text || "Keep your fields clean and monitor water levels.";
  } catch (e) {
    console.warn("Flash Lite Tip Error", e);
    return "Farm with care today!";
  }
};

/**
 * 2. DIAGNOSTICS: Image/Video Analysis using gemini-3-pro-preview with THINKING
 */
export const analyzeDiagnosticMedia = async (file: File, mode: AppMode): Promise<string> => {
  const base64Data = await blobToBase64(file);
  const mimeType = file.type;

  let systemInstructionText = "You are Kisan-Rakshak AI. ";
  switch (mode) {
    case AppMode.ANIMAL_BEHAVIOR:
      systemInstructionText += "Analyze animal behavior/kinematics for stress/pain.";
      break;
    case AppMode.VET_DERM:
      systemInstructionText += "Analyze skin/dermatological issues in animals.";
      break;
    case AppMode.CROP_DOCTOR:
      systemInstructionText += "Analyze plant pathology (leaves/fruits).";
      break;
  }

  systemInstructionText += `
    \nOUTPUT FORMAT (Markdown):
    Use bold headings (###) and bullet points (*) for clarity.
    
    ### Diagnosis (निदान)
    ...
    
    ### Severity (तीव्रता)
    ...
    
    ### Immediate Action (तात्काळ उपाय)
    * ...
    
    ### Recommended Medicines/Products (शिफारस केलेली औषधे/उत्पादने)
    * List generic active ingredients and common Indian brand names.
    * Mention dosage if applicable.
    * Include organic/natural alternatives if available.
  `;

  // Use Gemini 3 Pro with Thinking for complex diagnosis
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { text: "Analyze this strictly according to medical/agricultural protocols." }
      ]
    },
    config: {
      systemInstruction: systemInstructionText,
      thinkingConfig: { thinkingBudget: 32768 } // High thinking budget for accuracy
    }
  });

  return response.text || "Could not analyze.";
};

/**
 * 3. SEARCH: Market Insights using gemini-2.5-flash with Google Search
 */
export const getMarketInsights = async (query: string): Promise<{text: string, urls: any[]}> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-latest",
    contents: `Find current market prices and news for: ${query}. Summarize in Marathi and English. Use Markdown formatting.`,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  const urls = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.map((c: any) => c.web ? { title: c.web.title, uri: c.web.uri } : null)
    .filter(Boolean) || [];

  return { text: response.text || "No info found.", urls };
};

/**
 * 4. TTS: Generate Speech from Text using gemini-2.5-flash-preview-tts
 */
export const generateSpeech = async (text: string): Promise<string | null> => {
  // Strip special chars for TTS prompt to avoid confusion, keep it short
  // Remove markdown symbols for cleaner speech
  const cleanText = text.replace(/[#*`-]/g, '').substring(0, 400) + "..."; 
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: { parts: [{ text: cleanText }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.[0];
  if (audioPart && audioPart.inlineData) {
    return audioPart.inlineData.data; // Base64 audio
  }
  return null;
};

/**
 * 5. TRANSCRIPTION: Audio to Text using gemini-2.5-flash
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const base64Data = await blobToBase64(audioBlob);
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-latest",
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: 'audio/wav' } }, // Assuming wav from MediaRecorder
        { text: "Transcribe this audio verbatim. If it is in Marathi, translate to English as well." }
      ]
    }
  });

  return response.text || "";
};

/**
 * 6. CHATBOT: General Assistant using gemini-3-pro-preview
 */
export const chatWithAI = async (history: any[], message: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [...history, { role: 'user', parts: [{ text: message }] }],
    config: {
      systemInstruction: "You are an expert Indian agricultural assistant. Answer helpfully in Marathi and English. Use Markdown for formatting."
    }
  });
  return response.text || "I am listening...";
};
