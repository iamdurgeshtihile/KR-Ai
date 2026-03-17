
export enum AppMode {
  ANIMAL_BEHAVIOR = 'ANIMAL_BEHAVIOR',
  VET_DERM = 'VET_DERM',
  CROP_DOCTOR = 'CROP_DOCTOR',
  MARKET_INSIGHTS = 'MARKET_INSIGHTS',
  DIRECT_MARKET = 'DIRECT_MARKET',
  CROP_CALENDAR = 'CROP_CALENDAR',
  PRICE_PREDICTIONS = 'PRICE_PREDICTIONS',
  HARVEST_PREDICTOR = 'HARVEST_PREDICTOR',
  KRISHICLAW = 'KRISHICLAW'
}

export enum UserRole {
  FARMER = 'FARMER',
  CONSUMER = 'CONSUMER'
}

export type ProductCategory = 'Vegetable' | 'Fruit' | 'Dairy' | 'Grains';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
}

export interface Listing {
  id: string;
  userId: string;
  name: string;
  price: number;
  category: string;
  unit: string;
  stockQuantity: number;
  image: string;
  farmerName: string;
  certified: boolean;
  description: string;
  createdAt?: any;
}

export interface Order {
  id: string;
  farmerId: string;
  consumerId: string;
  items: CartItem[];
  totalPrice: number;
  customerName: string;
  customerAddress: string;
  timestamp: any; // Changed from number to any for Firestore Timestamps
  status: 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered';
}

export interface CartItem {
  listingId: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  image: string;
}

export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
];

export interface ModeConfig {
  id: AppMode;
  title: string;
  description: string;
  icon: string;
}

export interface HistoryItem {
  id: string;
  userId: string;
  timestamp: number;
  mode: AppMode;
  result: string;
  previewText: string;
  createdAt: string;
}

export interface CropCalendarEntry {
  crop: string;
  plantingWindow: string;
  harvestWindow: string;
  tips: string;
}

export interface PricePrediction {
  crop: string;
  currentPrice: number;
  predictedPrice: number;
  trend: 'up' | 'down' | 'stable';
  reasoning: string;
}
