
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, 
  LayoutDashboard, 
  Store, 
  Sprout, 
  User as UserIcon, 
  Search, 
  ShoppingCart, 
  ChevronRight,
  TrendingUp,
  PackageCheck,
  Zap,
  CheckCircle,
  Clock,
  MapPin,
  Plus,
  ArrowRight,
  ShieldCheck,
  Info,
  LogOut,
  WifiOff,
  Wifi,
  CloudUpload,
  Calendar,
  CloudSun,
  BarChart3,
  Timer,
  Cpu
} from 'lucide-react';
import { 
  auth, 
  db, 
  LISTINGS_COLLECTION, 
  ORDERS_COLLECTION, 
  addOrder, 
  updateOrderStatus, 
  deleteListing, 
  addListing, 
  logOut, 
  getUserProfile,
  addHardwareTask,
  HARDWARE_TASKS_COLLECTION
} from './services/firebaseService';
import { 
  UserRole, 
  Listing, 
  Order, 
  CartItem, 
  ProductCategory, 
  SUPPORTED_LANGUAGES, 
  Language,
  AppMode,
  ModeConfig,
  UserProfile
} from './types';
import { 
  analyzeDiagnosticMedia, 
  generateSpeech, 
  playPCM,
  getCropCalendar,
  getPricePredictions,
  predictHarvestDate,
  getLocalizedAdvisory
} from './services/geminiService';
import { ChatInterface } from './components/ChatInterface';
import { FileUpload } from './components/FileUpload';
import { Spinner } from './components/Spinner';
import { Auth } from './components/Auth';
import ReactMarkdown from 'react-markdown';
import { offlineService, QueuedDiagnostic } from './services/offlineService';
import KrishiClawPanel from './components/KrishiClawPanel';
import { t } from './translations';

const MotionDiv = motion.div as any;
const CATEGORIES: ProductCategory[] = ['Vegetable', 'Fruit', 'Dairy', 'Grains'];

const AI_MODES: ModeConfig[] = [
  { id: AppMode.CROP_DOCTOR, title: 'crop_doctor', description: 'crop_doctor_desc', icon: '🌱' },
  { id: AppMode.VET_DERM, title: 'vet_derm', description: 'vet_derm_desc', icon: '🐄' },
  { id: AppMode.ANIMAL_BEHAVIOR, title: 'animal_behavior', description: 'animal_behavior_desc', icon: '🐕' },
  { id: AppMode.CROP_CALENDAR, title: 'crop_calendar', description: 'crop_calendar_desc', icon: '📅' },
  { id: AppMode.PRICE_PREDICTIONS, title: 'market_trends', description: 'market_trends_desc', icon: '📈' },
  { id: AppMode.MARKET_INSIGHTS, title: 'weather_advisory', description: 'weather_advisory_desc', icon: '🌦️' },
  { id: AppMode.HARVEST_PREDICTOR, title: 'harvest_timer', description: 'harvest_timer_desc', icon: '⏱️' }
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [language, setLanguage] = useState<Language>(SUPPORTED_LANGUAGES[0]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [newListingForm, setNewListingForm] = useState<Partial<Listing>>({
    name: '',
    price: 0,
    category: 'Vegetable',
    unit: 'kg',
    stockQuantity: 10,
    description: '',
    certified: false
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ProductCategory | 'All'>('All');
  const [isAddingListing, setIsAddingListing] = useState(false);
  const [activeAiMode, setActiveAiMode] = useState<ModeConfig | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isExecutingTask, setIsExecutingTask] = useState(false);

  // Hardware Task Listener
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = db.collection(HARDWARE_TASKS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'modified') {
            const task = change.doc.data();
            if (task.status === 'executing') {
              showToast(`🤖 Krishiclaw: ${t('executing', language.code)} ${task.type}...`, "success");
            } else if (task.status === 'completed') {
              showToast(`✅ Krishiclaw: ${task.type} ${t('finished', language.code)}!`, "success");
            } else if (task.status === 'failed') {
              showToast(`❌ Krishiclaw: ${task.type} ${t('failed', language.code)}!`, "error");
            }
          }
        });
      });

    return () => unsubscribe();
  }, [currentUser]);
  const [showChat, setShowChat] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [harvestForm, setHarvestForm] = useState({ crop: '', date: '' });

  // Geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("Geolocation error:", err)
      );
    }
  }, []);

  // Online/Offline Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('You are back online! Syncing data...', 'success');
      processOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('You are offline. Some features may be limited.', 'error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial queue check
    updateQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateQueueCount = async () => {
    const count = await offlineService.getQueueCount();
    setQueuedCount(count);
  };

  const processOfflineQueue = async () => {
    const queued = await offlineService.getQueuedDiagnostics();
    if (queued.length === 0) return;

    showToast(`Syncing ${queued.length} diagnostic reports...`, 'success');
    
    for (const item of queued) {
      try {
        const result = await analyzeDiagnosticMedia(item.imageData, item.mode as any, language);
        // We could save this to history or notify the user
        console.log('Processed offline diagnostic:', result);
        if (item.id) await offlineService.clearQueuedDiagnostic(item.id);
      } catch (err) {
        console.error('Failed to process offline item:', err);
      }
    }
    updateQueueCount();
  };

  // Auth State Listener
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const profile = await getUserProfile(user.uid);
        setCurrentUser(profile as UserProfile);
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // Firestore Subscriptions
  useEffect(() => {
    if (!currentUser) return;

    // Listings Subscription - Simple query (no composite index needed)
    const unsubListings = db.collection(LISTINGS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .onSnapshot((snap) => {
        setListings(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Listing[]);
      }, (err) => console.error("Listings error:", err));

    /** 
     * FIXED: Orders Subscription
     * We removed .orderBy('timestamp', 'desc') from the server-side query.
     * Combining .where() and .orderBy() on different fields requires a composite index.
     * By sorting on the client-side instead, we fix the "missing index" error instantly.
     */
    let ordersQuery: any = db.collection(ORDERS_COLLECTION);
    
    if (currentUser.role === UserRole.FARMER) {
      ordersQuery = ordersQuery.where('farmerId', '==', currentUser.uid);
    } else {
      ordersQuery = ordersQuery.where('consumerId', '==', currentUser.uid);
    }

    const unsubOrders = ordersQuery
      .onSnapshot((snap: any) => {
        const fetchedOrders = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as Order[];
        
        // Robust Client-Side Sort
        const sorted = fetchedOrders.sort((a, b) => {
          const getTime = (ts: any) => {
            if (!ts) return Date.now(); // Handle local latency compensation
            if (ts.toMillis) return ts.toMillis(); // Handle Firestore Timestamp object
            if (typeof ts === 'number') return ts; // Handle raw numeric timestamp
            return 0;
          };
          return getTime(b.timestamp) - getTime(a.timestamp);
        });

        setOrders(sorted);
      }, (err: any) => {
        console.error("Orders access error:", err);
      });

    return () => { 
      unsubListings(); 
      unsubOrders(); 
    };
  }, [currentUser]);

  const showToast = useCallback((msgKey: string, type: 'success' | 'error' = 'success', isRaw: boolean = false) => {
    const msg = isRaw ? msgKey : t(msgKey, language.code);
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, [language.code]);

  const handleCheckout = async () => {
    if (!currentUser || cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const rzp = new (window as any).Razorpay({
      key: "rzp_test_R63nysub7CBtrS",
      amount: total * 100,
      currency: "INR",
      name: "KrishiX Bazaar",
      handler: async () => {
        try {
          const farmerGroups: Record<string, CartItem[]> = {};
          cart.forEach(item => {
            const listing = listings.find(l => l.id === item.listingId);
            if (listing && listing.userId) {
              if (!farmerGroups[listing.userId]) farmerGroups[listing.userId] = [];
              farmerGroups[listing.userId].push(item);
            }
          });

          for (const [farmerId, items] of Object.entries(farmerGroups)) {
            await addOrder({ 
              farmerId,
              consumerId: currentUser.uid,
              items, 
              totalPrice: items.reduce((s, i) => s + (i.price * i.quantity), 0),
              customerName: currentUser.displayName, 
              customerAddress: 'Verified Farmer Network' 
            });
          }
          
          setCart([]);
          setIsCartOpen(false);
          showToast("order_success");
          setActiveTab('home');
        } catch (e) {
          console.error("Checkout failed:", e);
          showToast("order_failed", "error");
        }
      }
    });
    rzp.open();
  };

  const myStallListings = useMemo(() => {
    if (!currentUser) return [];
    return listings.filter(l => l.userId === currentUser.uid);
  }, [listings, currentUser]);

  const filteredMarketListings = useMemo(() => {
    return listings.filter(l => 
      (activeCategory === 'All' || l.category === activeCategory) &&
      (l.name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );
  }, [listings, activeCategory, searchQuery]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-agri-ivory"><Spinner /></div>;

  return (
    <div className={`min-h-screen pb-24 bg-slate-50 font-${language.code === 'en' ? 'sans' : language.code}`}>
      <AnimatePresence>
        {toast && (
          <MotionDiv initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} 
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 rounded-2xl shadow-2xl text-white font-bold flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-600' : 'bg-agri-forest'}`}>
            {toast.type === 'error' ? <Info className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            {toast.msg}
          </MotionDiv>
        )}
      </AnimatePresence>

      <header className="glass sticky top-0 z-50 p-4 border-b border-agri-sand/30">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('home')}>
            <div className="w-10 h-10 bg-agri-forest rounded-xl flex items-center justify-center text-xl shadow-lg">🌾</div>
            <h1 className="text-xl font-black text-agri-forest leading-none">KrishiX</h1>
          </div>
          <div className="flex items-center gap-2">
            {currentUser && (
              <>
                {!isOnline && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase animate-pulse">
                    <WifiOff className="w-3 h-3" /> {t('offline', language.code)}
                  </div>
                )}
                {queuedCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-agri-forest text-white rounded-full text-[10px] font-black uppercase">
                    <CloudUpload className="w-3 h-3 animate-bounce" /> {queuedCount} {t('pending', language.code)}
                  </div>
                )}
                {currentUser.role === UserRole.CONSUMER && (
                  <button onClick={() => setIsCartOpen(true)} className="relative p-3 bg-agri-sand/50 rounded-full hover:bg-agri-sand transition-all active:scale-90">
                    <ShoppingCart className="w-6 h-6 text-agri-forest" />
                    {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white font-black">{cart.length}</span>}
                  </button>
                )}
                <div className="h-8 w-px bg-agri-sand/50 mx-2" />
              </>
            )}
            <select 
              value={language.code} 
              onChange={(e) => {
                const lang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
                if (lang) setLanguage(lang);
              }}
              className="bg-agri-sand/50 text-agri-forest text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-full border-none outline-none focus:ring-2 focus:ring-agri-forest cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.nativeName}</option>
              ))}
            </select>
            {currentUser && <button onClick={() => logOut()} className="p-3 bg-red-50 text-red-600 rounded-full hover:bg-red-100"><LogOut className="w-6 h-6" /></button>}
          </div>
        </div>
      </header>

      {!currentUser ? (
        <Auth language={language} />
      ) : (
        <>
          <main className="max-w-2xl mx-auto p-4 py-6">
        {currentUser.role === UserRole.CONSUMER && activeTab === 'home' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-agri-forest to-agri-moss rounded-[3rem] p-8 text-white relative overflow-hidden shadow-2xl">
              <div className="relative z-10 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">{t('hello', language.code)}, {currentUser.displayName.split(' ')[0]}</p>
                <h2 className="text-3xl font-black leading-tight">{t('fresh_harvest', language.code)}</h2>
              </div>
              <ShoppingBag className="absolute -bottom-8 -right-8 w-48 h-48 opacity-10 rotate-12" />
            </div>

            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-agri-moss w-5 h-5 group-focus-within:text-agri-forest transition-colors" />
              <input type="text" placeholder={t('search_placeholder', language.code)} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border-2 border-agri-sand rounded-3xl py-5 pl-14 pr-6 focus:ring-8 focus:ring-agri-forest/5 focus:border-agri-forest outline-none transition-all font-bold text-agri-forest shadow-sm" />
            </div>

            <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
              <button onClick={() => setActiveCategory('All')} className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeCategory === 'All' ? 'bg-agri-forest text-white shadow-xl' : 'bg-white text-agri-moss border border-agri-sand'}`}>{t('all', language.code)}</button>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setActiveCategory(c)} className={`px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeCategory === c ? 'bg-agri-forest text-white shadow-xl' : 'bg-white text-agri-moss border border-agri-sand'}`}>{t(c.toLowerCase(), language.code)}</button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 pb-12">
              {filteredMarketListings.map(l => (
                <MotionDiv layout key={l.id} className="bg-white rounded-[2.5rem] p-4 product-card-shadow border border-white flex flex-col group">
                  <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden mb-4 bg-agri-ivory">
                    <img src={l.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={l.name} />
                    {l.certified && (
                      <div className="absolute top-3 left-3 bg-agri-forest text-white text-[8px] font-black uppercase px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-1 backdrop-blur-md">
                        <ShieldCheck className="w-3 h-3" /> {t('ai_verified', language.code)}
                      </div>
                    )}
                  </div>
                  <div className="px-1 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-black text-agri-forest leading-tight text-lg mb-1">{l.name}</h3>
                      <p className="text-[10px] text-agri-moss font-bold uppercase tracking-widest flex items-center gap-1"><MapPin className="w-3 h-3" /> {l.farmerName}</p>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex flex-col">
                        <span className="text-xl font-black text-agri-forest">₹{l.price}</span>
                        <span className="text-[8px] font-bold text-agri-moss uppercase opacity-50">{language.code === 'en' ? 'per' : ''} {l.unit}</span>
                      </div>
                      <button onClick={() => {
                        setCart(prev => {
                          const existing = prev.find(i => i.listingId === l.id);
                          if (existing) return prev.map(i => i.listingId === l.id ? { ...i, quantity: i.quantity + 1 } : i);
                          return [...prev, { listingId: l.id, name: l.name, price: l.price, quantity: 1, unit: l.unit, image: l.image }];
                        });
                        showToast(`${t('added_to_cart', language.code)}: ${l.name}`, 'success', true);
                      }} className="p-3 bg-agri-forest text-white rounded-2xl hover:bg-agri-moss shadow-lg transition-all active:scale-90"><Plus className="w-6 h-6" /></button>
                    </div>
                  </div>
                </MotionDiv>
              ))}
            </div>
          </div>
        )}

        {currentUser.role === UserRole.FARMER && activeTab === 'home' && (
          <div className="space-y-8 pb-12">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-3xl font-black text-agri-forest">{t('market_desk', language.code)}</h2>
              <div className="px-4 py-2 bg-agri-leaf/10 text-agri-moss rounded-full text-[10px] font-black uppercase tracking-widest border border-agri-leaf/20">{t('active', language.code)}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-agri-forest p-8 rounded-[3rem] text-white space-y-2 shadow-2xl relative overflow-hidden">
                <TrendingUp className="absolute -bottom-4 -right-4 w-24 h-24 opacity-10" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50">{t('monthly_sales', language.code)}</p>
                <h2 className="text-4xl font-black">₹{orders.reduce((s,o) => s + (o.totalPrice || 0), 0).toLocaleString()}</h2>
              </div>
              <div className="bg-white p-8 rounded-[3rem] border border-agri-sand/50 shadow-sm space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-agri-moss">Pending Orders</p>
                <h2 className="text-4xl font-black text-agri-forest">{orders.filter(o => o.status !== 'Delivered').length}</h2>
              </div>
            </div>

            <section className="space-y-4">
              <h3 className="text-xl font-black text-agri-forest px-2">Farmer's Inbox</h3>
              <div className="space-y-3">
                {orders.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-agri-sand italic font-bold text-agri-moss">No sales yet...</div>
                ) : (
                  orders.map(o => (
                    <div key={o.id} className="bg-white p-6 rounded-[2.5rem] border border-agri-sand shadow-sm flex items-center justify-between group hover:border-agri-forest transition-all">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-agri-ivory rounded-2xl flex items-center justify-center text-2xl">📦</div>
                        <div>
                          <h4 className="font-black text-agri-forest text-base">{o.items?.[0]?.name || 'Basket'}</h4>
                          <p className="text-[10px] text-agri-moss font-black uppercase tracking-[0.2em]">{o.customerName || 'Anonymous'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-agri-forest mb-2">₹{o.totalPrice}</p>
                        <select value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value as any)}
                          className="bg-agri-sand/50 border-none rounded-xl px-4 py-2 text-[10px] font-black uppercase text-agri-forest outline-none">
                          <option value="Pending">Pending</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Shipped">Shipped</option>
                          <option value="Delivered">Delivered</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {currentUser.role === UserRole.FARMER && activeTab === 'stall' && (
          <div className="space-y-8 pb-12">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-3xl font-black text-agri-forest">{t('my_produce', language.code)}</h2>
              <button onClick={() => {
                setNewListingForm({ name: '', price: 0, category: 'Vegetable', unit: 'kg', stockQuantity: 50, description: '', certified: false });
                setIsAddingListing(true);
              }} className="p-4 bg-agri-forest text-white rounded-[2rem] shadow-2xl transition-all"><Plus className="w-7 h-7" /></button>
            </div>
            
            <div className="grid gap-4">
              {myStallListings.length === 0 ? (
                <div className="text-center py-32 bg-white rounded-[3rem] border-3 border-dashed border-agri-sand/30 flex flex-col items-center gap-4">
                  <Store className="w-16 h-16 opacity-10" />
                  <p className="font-black text-agri-moss opacity-40 uppercase tracking-widest text-xs">{t('stall_empty', language.code)}</p>
                </div>
              ) : (
                myStallListings.map(l => (
                  <div key={l.id} className="bg-white p-5 rounded-[2.5rem] border border-agri-sand flex items-center gap-5 shadow-sm">
                    <img src={l.image} className="w-24 h-24 rounded-3xl object-cover" alt="" />
                    <div className="flex-1">
                      <h4 className="font-black text-agri-forest text-lg">{l.name}</h4>
                      <p className="text-[10px] text-agri-moss font-black uppercase tracking-widest">{l.stockQuantity} {l.unit} {t('in_stock', language.code)}</p>
                      <p className="text-xl font-black text-agri-forest mt-1">₹{l.price}</p>
                    </div>
                    <button onClick={() => deleteListing(l.id)} className="p-4 bg-red-50 text-red-400 rounded-3xl hover:bg-red-500 hover:text-white transition-all">
                      <ShoppingBag className="w-6 h-6" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'smart' && (
          <div className="space-y-8 pb-12">
            <div className="bg-agri-forest p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
               <Zap className="absolute top-4 right-4 text-agri-leaf opacity-20 w-32 h-32" />
               <h2 className="text-4xl font-black mb-3">{t('precision_ai', language.code)}</h2>
               <p className="text-agri-sand font-bold opacity-80 leading-relaxed text-sm">{t('precision_ai_desc', language.code)}</p>
            </div>
            
            {!activeAiMode ? (
              <div className="grid grid-cols-1 gap-4">
                {AI_MODES.map(m => (
                  <button key={m.id} onClick={() => setActiveAiMode(m)} className="p-8 bg-white border border-agri-sand rounded-[3rem] flex items-center gap-8 text-left hover:border-agri-forest hover:shadow-xl transition-all group">
                    <div className="text-5xl p-5 bg-agri-ivory rounded-3xl group-hover:scale-110 transition-transform">{m.icon}</div>
                    <div><h3 className="font-black text-xl text-agri-forest">{t(m.title, language.code)}</h3><p className="text-sm text-agri-moss font-medium">{t(m.description, language.code)}</p></div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                <button onClick={() => { setActiveAiMode(null); setAiResult(null); }} className="px-6 py-2 bg-agri-sand text-agri-forest font-black text-[10px] uppercase tracking-widest rounded-full">← {t('tools', language.code)}</button>
                {!aiResult ? (
                   <div className="glass p-10 rounded-[3rem] shadow-xl space-y-8">
                      <h3 className="text-2xl font-black text-agri-forest flex items-center gap-3">{activeAiMode.icon} {t(activeAiMode.title, language.code)}</h3>
                      
                      {[AppMode.CROP_DOCTOR, AppMode.VET_DERM, AppMode.ANIMAL_BEHAVIOR].includes(activeAiMode.id) && (
                        <FileUpload label={t('sample_media_required', language.code)} acceptedTypes="image/*" onFileSelect={async (file) => {
                          if (!isOnline) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              await offlineService.queueDiagnostic(activeAiMode.id, reader.result as string);
                              updateQueueCount();
                              showToast(t('diagnostic_queued', language.code), "success");
                              setActiveAiMode(null);
                            };
                            reader.readAsDataURL(file);
                            return;
                          }
                          setIsScanning(true);
                          try {
                            const result = await analyzeDiagnosticMedia(file, activeAiMode.id, language);
                            setAiResult(result);
                          } catch (e) {
                            showToast(t('diagnostic_failed', language.code), "error");
                          } finally {
                            setIsScanning(false);
                          }
                        }} />
                      )}

                      {activeAiMode.id === AppMode.CROP_CALENDAR && (
                        <div className="space-y-4">
                          <p className="text-sm font-bold text-agri-moss">{t('using_location', language.code)}: {location ? `${location.lat.toFixed(2)}, ${location.lng.toFixed(2)}` : t('detecting', language.code)}</p>
                          <button 
                            disabled={!location || isScanning}
                            onClick={async () => {
                              if (!location) return;
                              setIsScanning(true);
                              try {
                                const result = await getCropCalendar(location.lat, location.lng, language);
                                setAiResult(result);
                              } catch (e) {
                                showToast("Failed to fetch calendar", "error");
                              } finally {
                                setIsScanning(false);
                              }
                            }}
                            className="w-full py-6 bg-agri-forest text-white rounded-3xl font-black shadow-xl disabled:opacity-50"
                          >
                            {isScanning ? <Spinner /> : 'Generate Local Calendar'}
                          </button>
                        </div>
                      )}

                      {activeAiMode.id === AppMode.MARKET_INSIGHTS && (
                        <div className="space-y-4">
                          <p className="text-sm font-bold text-agri-moss">Fetching real-time weather & advisory for your region...</p>
                          <button 
                            disabled={!location || isScanning}
                            onClick={async () => {
                              if (!location) return;
                              setIsScanning(true);
                              try {
                                const result = await getLocalizedAdvisory(location.lat, location.lng, language);
                                setAiResult(result.text);
                              } catch (e) {
                                showToast("Failed to fetch advisory", "error");
                              } finally {
                                setIsScanning(false);
                              }
                            }}
                            className="w-full py-6 bg-agri-forest text-white rounded-3xl font-black shadow-xl disabled:opacity-50"
                          >
                            {isScanning ? <Spinner /> : 'Get Weather Advisory'}
                          </button>
                        </div>
                      )}

                      {activeAiMode.id === AppMode.PRICE_PREDICTIONS && (
                        <div className="space-y-4">
                          <p className="text-sm font-bold text-agri-moss">Predicting trends for your current stall items...</p>
                          <button 
                            disabled={isScanning || myStallListings.length === 0}
                            onClick={async () => {
                              setIsScanning(true);
                              try {
                                const crops = myStallListings.map(l => l.name);
                                const result = await getPricePredictions(crops, language);
                                setAiResult(result);
                              } catch (e) {
                                showToast("Failed to fetch predictions", "error");
                              } finally {
                                setIsScanning(false);
                              }
                            }}
                            className="w-full py-6 bg-agri-forest text-white rounded-3xl font-black shadow-xl disabled:opacity-50"
                          >
                            {isScanning ? <Spinner /> : t('analyze_market', language.code)}
                          </button>
                          {myStallListings.length === 0 && <p className="text-[10px] text-red-500 font-bold text-center">Add items to your stall first!</p>}
                        </div>
                      )}

                      {activeAiMode.id === AppMode.HARVEST_PREDICTOR && (
                        <div className="space-y-4">
                          <h4 className="font-black text-agri-forest">{t('harvest_predictor', language.code)}</h4>
                          <input 
                            type="text" 
                            placeholder={t('crop_name', language.code)} 
                            className="w-full p-4 bg-agri-ivory rounded-2xl border border-agri-sand outline-none font-bold"
                            value={harvestForm.crop}
                            onChange={(e) => setHarvestForm({...harvestForm, crop: e.target.value})}
                          />
                          <input 
                            type="date" 
                            className="w-full p-4 bg-agri-ivory rounded-2xl border border-agri-sand outline-none font-bold"
                            value={harvestForm.date}
                            onChange={(e) => setHarvestForm({...harvestForm, date: e.target.value})}
                          />
                          <button 
                            disabled={isScanning || !harvestForm.crop || !harvestForm.date}
                            onClick={async () => {
                              setIsScanning(true);
                              try {
                                const result = await predictHarvestDate(harvestForm.crop, harvestForm.date, language);
                                setAiResult(result);
                              } catch (e) {
                                showToast("order_failed", "error");
                              } finally {
                                setIsScanning(false);
                              }
                            }}
                            className="w-full py-6 bg-agri-forest text-white rounded-3xl font-black shadow-xl disabled:opacity-50"
                          >
                            {isScanning ? <Spinner /> : t('predict_harvest', language.code)}
                          </button>
                        </div>
                      )}
                   </div>
                ) : (
                  <div className="space-y-6 animate-slide-up">
                    <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-agri-leaf/30 prose prose-sm prose-agri max-w-none">
                      <ReactMarkdown>{aiResult}</ReactMarkdown>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={async () => { const audio = await generateSpeech(aiResult, language); if (audio) playPCM(audio); }} className="py-5 bg-agri-forest text-white rounded-[2rem] font-black shadow-xl">🔊 {t('speak', language.code)}</button>
                      <button onClick={() => { setAiResult(null); setActiveAiMode(null); }} className="py-5 bg-white border-2 border-agri-forest text-agri-forest rounded-[2rem] font-black">{t('close', language.code)}</button>
                    </div>
                    
                    {activeAiMode && [AppMode.CROP_DOCTOR, AppMode.VET_DERM].includes(activeAiMode.id) && (
                      <button 
                        disabled={isExecutingTask}
                        onClick={async () => {
                          setIsExecutingTask(true);
                          try {
                            const taskType = aiResult.toLowerCase().includes('prune') ? 'PRUNE' : 'HARVEST';
                            await addHardwareTask({
                              type: taskType,
                              coordinates: location || undefined,
                              metadata: { diagnosticResult: aiResult.substring(0, 100) }
                            });
                            showToast("confirm_intervention");
                          } catch (e) {
                            showToast("update_failed", "error");
                          } finally {
                            setIsExecutingTask(false);
                          }
                        }}
                        className="w-full py-6 bg-yellow-500 text-white rounded-[2rem] font-black shadow-xl flex items-center justify-center gap-3"
                      >
                        <Cpu className="w-6 h-6" />
                        {isExecutingTask ? <Spinner /> : t('execute_intervention', language.code)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'krishiclaw' && (
          <div className="pb-12">
            <KrishiClawPanel language={language} farmContext={{ location, myStallListings }} />
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-agri-sand shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.1)] px-8 h-24 rounded-t-[3rem]">
        <div className="max-w-2xl mx-auto flex items-center justify-between h-full">
          {currentUser.role === UserRole.CONSUMER ? (
            <>
              <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-agri-forest scale-110' : 'text-agri-moss opacity-30'}`}><Store className="w-6 h-6" /><span className="text-[9px] font-black uppercase">{t('market', language.code)}</span></button>
              <button onClick={() => setActiveTab('smart')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'smart' ? 'text-agri-forest scale-110' : 'text-agri-moss opacity-30'}`}><Sprout className="w-6 h-6" /><span className="text-[9px] font-black uppercase tracking-tighter">{t('ai_help', language.code)}</span></button>
              <button onClick={() => setShowChat(true)} className="flex flex-col items-center gap-1 text-agri-moss opacity-30"><Zap className="w-6 h-6" /><span className="text-[9px] font-black uppercase">{t('chat', language.code)}</span></button>
              <button onClick={() => setIsCartOpen(true)} className="flex flex-col items-center gap-1 text-agri-moss opacity-30"><ShoppingCart className="w-6 h-6" /><span className="text-[9px] font-black uppercase">{t('cart', language.code)}</span></button>
            </>
          ) : (
            <>
              <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-agri-forest scale-110' : 'text-agri-moss opacity-30'}`}><LayoutDashboard className="w-6 h-6" /><span className="text-[9px] font-black uppercase">{t('home', language.code)}</span></button>
              <button onClick={() => setActiveTab('stall')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'stall' ? 'text-agri-forest scale-110' : 'text-agri-moss opacity-30'}`}><Store className="w-6 h-6" /><span className="text-[9px] font-black uppercase">{t('stall', language.code)}</span></button>
              <button onClick={() => setActiveTab('smart')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'smart' ? 'text-agri-forest scale-110' : 'text-agri-moss opacity-30'}`}><Sprout className="w-6 h-6" /><span className="text-[9px] font-black uppercase">{t('ai_doctor', language.code)}</span></button>
              <button onClick={() => setActiveTab('krishiclaw')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'krishiclaw' ? 'text-agri-forest scale-110' : 'text-agri-moss opacity-30'}`}><Cpu className="w-6 h-6" /><span className="text-[9px] font-black uppercase tracking-tighter">{t('krishiclaw', language.code)}</span></button>
            </>
          )}
        </div>
      </nav>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCartOpen(false)} className="fixed inset-0 bg-agri-forest/20 backdrop-blur-sm z-[100]" />
            <MotionDiv initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 200 }} 
              className="fixed bottom-0 left-0 right-0 bg-white z-[110] rounded-t-[3.5rem] p-10 max-w-2xl mx-auto max-h-[85vh] flex flex-col shadow-2xl">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black text-agri-forest">{t('shopping_basket', language.code)}</h2>
                <button onClick={() => setIsCartOpen(false)} className="p-3 bg-agri-ivory rounded-2xl">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar">
                {cart.length === 0 ? <p className="text-center py-20 text-agri-moss font-bold opacity-30">{t('basket_empty', language.code)}</p> : cart.map(item => (
                  <div key={item.listingId} className="flex items-center gap-6 bg-agri-ivory/50 p-5 rounded-3xl">
                    <img src={item.image} className="w-20 h-20 rounded-2xl object-cover" alt="" />
                    <div className="flex-1">
                      <h4 className="font-black text-agri-forest text-lg">{item.name}</h4>
                      <p className="text-xs font-black text-agri-moss">₹{item.price} / {item.unit}</p>
                    </div>
                    <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-inner">
                      <button onClick={() => setCart(prev => prev.map(i => i.listingId === item.listingId ? { ...i, quantity: Math.max(0, i.quantity - 1) } : i).filter(i => i.quantity > 0))}>-</button>
                      <span className="font-black">{item.quantity}</span>
                      <button onClick={() => setCart(prev => prev.map(i => i.listingId === item.listingId ? { ...i, quantity: i.quantity + 1 } : i))}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              {cart.length > 0 && (
                <div className="mt-10 space-y-4">
                  <div className="flex justify-between font-black text-2xl text-agri-forest px-4">
                    <span>{t('all', language.code)}</span>
                    <span>₹{cart.reduce((s, i) => s + (i.price * i.quantity), 0)}</span>
                  </div>
                  <button onClick={handleCheckout} className="w-full py-6 bg-agri-forest text-white rounded-[2.5rem] font-black text-xl shadow-2xl">{t('proceed_to_pay', language.code)}</button>
                </div>
              )}
            </MotionDiv>
          </>
        )}
      </AnimatePresence>

      {/* Listing Form */}
      <AnimatePresence>
        {isAddingListing && (
          <div className="fixed inset-0 z-[200] bg-agri-forest/40 backdrop-blur-md flex items-end sm:items-center justify-center">
            <MotionDiv initial={{ y: '100%' }} animate={{ y: 0 }} className="bg-white w-full max-w-lg rounded-t-[4rem] p-10 max-h-[95vh] overflow-y-auto shadow-2xl">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black text-agri-forest">{t('new_produce', language.code)}</h2>
                <button onClick={() => setIsAddingListing(false)} className="p-3 bg-agri-ivory rounded-2xl">✕</button>
              </div>
              <div className="space-y-8">
                <FileUpload label={t('snap_photo', language.code)} acceptedTypes="image/*" onFileSelect={(f) => {
                  const reader = new FileReader();
                  reader.onloadend = () => setNewListingForm(prev => ({ ...prev, image: reader.result as string }));
                  reader.readAsDataURL(f);
                }} />
                <input type="text" placeholder={t('item_name', language.code)} value={newListingForm.name} onChange={(e) => setNewListingForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full p-6 bg-agri-ivory/50 rounded-3xl border-2 border-agri-sand outline-none font-bold text-lg" />
                <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder={t('price', language.code)} onChange={(e) => setNewListingForm(p => ({ ...p, price: parseInt(e.target.value) }))}
                    className="w-full p-6 bg-agri-ivory/50 rounded-3xl border-2 border-agri-sand outline-none font-bold" />
                  <select onChange={(e) => setNewListingForm(p => ({ ...p, unit: e.target.value }))}
                    className="w-full p-6 bg-agri-ivory/50 rounded-3xl border-2 border-agri-sand outline-none font-black">
                    <option value="kg">kg</option>
                    <option value="ltr">ltr</option>
                    <option value="bunch">bunch</option>
                  </select>
                </div>
                <button onClick={async () => {
                  if (!newListingForm.name || !newListingForm.image || !currentUser) return;
                  try {
                    await addListing({ 
                      ...newListingForm, 
                      userId: currentUser.uid, 
                      farmerName: currentUser.displayName, 
                      certified: newListingForm.certified || false 
                    });
                    setIsAddingListing(false);
                    showToast("stall_updated");
                  } catch (e) {
                    showToast("update_failed", "error");
                  }
                }} className="w-full py-6 bg-agri-forest text-white rounded-[2.5rem] font-black text-xl shadow-2xl">{t('launch_to_market', language.code)}</button>
              </div>
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>

      <ChatInterface isOpen={showChat} onClose={() => setShowChat(false)} currentLanguage={language} />
      {isScanning && <div className="fixed inset-0 z-[300] bg-agri-forest/95 flex flex-col items-center justify-center text-white backdrop-blur-xl"><Spinner /></div>}
        </>
      )}
    </div>
  );
};

export default App;
