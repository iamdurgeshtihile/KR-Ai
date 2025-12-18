export enum AppMode {
  ANIMAL_BEHAVIOR = 'ANIMAL_BEHAVIOR',
  VET_DERM = 'VET_DERM',
  CROP_DOCTOR = 'CROP_DOCTOR',
  MARKET_INSIGHTS = 'MARKET_INSIGHTS'
}

export interface ModeConfig {
  id: AppMode;
  title: string;
  description: string;
  icon: string;
  acceptedFileTypes?: string;
  inputLabel?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isAudio?: boolean;
}

export interface AnalysisResult {
  text: string;
  audioData?: string; // Base64 audio for TTS
  groundingUrls?: Array<{title: string, uri: string}>;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  mode: AppMode;
  result: string;
  groundingUrls?: Array<{title: string, uri: string}>;
  previewText: string;
}
