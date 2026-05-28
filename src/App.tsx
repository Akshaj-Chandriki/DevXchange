/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  Gamepad2,
  Bot,
  Coins,
  Cpu,
  Shield,
  Terminal,
  Users,
  ArrowRight,
  Layers,
  Award,
  ArrowDown,
  ChevronRight,
  RefreshCw,
  Send,
  Lock,
  Compass,
  Check,
  Sparkles,
  LogOut,
  X,
  Star,
  Calendar
} from 'lucide-react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  serverTimestamp, 
  getDocFromServer,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

const discordWidgetIframeSrc = 'https://discord.com/widget?id=1067584930103721010&theme=dark';

export default function App() {
  // Navigation & Filtering
  const [activeTab, setActiveTab] = useState('all');

  // Authentication State
  const [user, setUser] = useState<{ name: string; email: string; photoURL: string } | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showGoogleGoogleModal, setShowGoogleModal] = useState(false);

  // Platform Metrics from database in real-time
  const [platformStats, setPlatformStats] = useState<{ deliveredCount: number; overallRating: number }>({
    deliveredCount: 0,
    overallRating: 0
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({
          name: currentUser.displayName || 'Authorized User',
          email: currentUser.email || '',
          photoURL: currentUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=256&auto=format&fit=crop',
        });
      } else {
        setUser(null);
      }
    });

    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return () => unsubscribe();
  }, []);

  // Listen to public review ratings real-time
  useEffect(() => {
    let unsubscribeRatings = () => {};
    try {
      const ratingsQuery = query(collection(db, 'ratings'), orderBy('createdAt', 'desc'));
      unsubscribeRatings = onSnapshot(ratingsQuery, (snapshot) => {
        const ratingsData: any[] = [];
        snapshot.forEach((doc) => {
          ratingsData.push({ id: doc.id, ...doc.data() });
        });
        setAllRatings(ratingsData);
      }, (error) => {
        console.error("Error loading ratings: ", error);
      });
    } catch (e) {
      console.error("Ratings sync error: ", e);
    }
    return () => unsubscribeRatings();
  }, []);

  // Listen to platform stats from database in real-time
  useEffect(() => {
    let unsubscribeStats = () => {};
    try {
      unsubscribeStats = onSnapshot(doc(db, 'stats', 'platform'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPlatformStats({
            deliveredCount: typeof data.deliveredCount === 'number' ? data.deliveredCount : 0,
            overallRating: typeof data.overallRating === 'number' ? data.overallRating : 0,
          });
        } else {
          setPlatformStats({
            deliveredCount: 0,
            overallRating: 0,
          });
        }
      }, (error) => {
        console.error("Error loading platform stats from DB: ", error);
        setPlatformStats({
          deliveredCount: 0,
          overallRating: 0,
        });
      });
    } catch (e) {
      console.error("Stats sync error: ", e);
      setPlatformStats({
        deliveredCount: 0,
        overallRating: 0,
      });
    }
    return () => unsubscribeStats();
  }, []);

  // Listen to user's tickets real-time
  useEffect(() => {
    if (!user) {
      setMyTickets([]);
      return;
    }
    let unsubscribeTickets = () => {};
    try {
      const ticketsQuery = query(
        collection(db, 'tickets'),
        where('userId', '==', auth.currentUser?.uid || '')
      );
      unsubscribeTickets = onSnapshot(ticketsQuery, (snapshot) => {
        const ticketsData: any[] = [];
        snapshot.forEach((doc) => {
          ticketsData.push({ id: doc.id, ...doc.data() });
        });
        // Sort newest first
        ticketsData.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });
        setMyTickets(ticketsData);
      }, (error) => {
        console.error("Error loading tickets: ", error);
      });
    } catch (e) {
      console.error("Tickets sync error: ", e);
    }
    return () => unsubscribeTickets();
  }, [user]);

  // Ticketing Form State
  const [discordUsername, setDiscordUsername] = useState('');
  const [projectType, setProjectType] = useState('Discord Setup');
  const [projectDetails, setProjectDetails] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [ticketSubTab, setTicketSubTab] = useState<'create' | 'history'>('create');

  // Real-time Firestore state
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [allRatings, setAllRatings] = useState<any[]>([]);

  // Rating and review input state
  const [ratingTicketId, setRatingTicketId] = useState<string | null>(null);
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [ratingFeedback, setRatingFeedback] = useState<string>('');
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  // Dynamic platforms metrics connected directly to Firestore stats document
  const totalDelivered = platformStats.deliveredCount;
  const averageRating = platformStats.overallRating.toFixed(1);

  // How It Works / Details Wizard State
  const [wizardStep, setWizardStep] = useState(1);
  const [orderCategory, setOrderCategory] = useState('discord');
  const [orderPayment, setOrderPayment] = useState('steam_game');
  const [orderUrgency, setOrderUrgency] = useState('standard');

  // Interactive System Demos state
  // 1. Weather chatbot demo state
  const [weatherCity, setWeatherCity] = useState('Tokyo');
  const [chatbotPersonality, setChatbotPersonality] = useState<'genz' | 'dev' | 'gamer'>('genz');
  const [chatbotReply, setChatbotReply] = useState('No cap, input your city and hit roast, fr.');
  const [isChatbotTyping, setIsChatbotTyping] = useState(false);

  // 2. Minecraft Tab config state
  const [mcServerName, setMcServerName] = useState('TOKEN NETWORK');
  const [mcTabTheme, setMcTabTheme] = useState<'cyberpunk' | 'classic' | 'abyss'>('cyberpunk');

  // 3. Discord role previewer state
  const [selectedDiscordRole, setSelectedDiscordRole] = useState<'owner' | 'staff' | 'vip' | 'gamer'>('staff');

  // Mascot Chat Console State
  const [mascotChatIndex, setMascotChatIndex] = useState(0);
  const [currentMascotMessage, setCurrentMascotMessage] = useState(
    "Yo! I'm XChangeBot. I run around DevXchange making sure our projects are fire. Need a Minecraft config, AI assistant, or Discord set up but don't have PayPal? I got you. Click an option!"
  );

  const mascotOptions = [
    { text: "What payment methods do you accept?", reply: "We strictly trade in Steam Gift Cards, direct Steam game gifts via friend network, and digital gift cards (Digital Gifts like Apple, Google Play, Amazon, and Robux). Gamers rejoice!" },
    { text: "How does the working proof live-stream work?", reply: "Before you pay, we stream your exact working setup (Discord server permissions, working MC server, custom python dashboard, etc.) via Discord Live or Twitch. 100% scam-free, absolute trust." },
    { text: "How fast do you build?", reply: "Standard projects take 1-3 days! If you bribe me with a AAA steam release, we can pull all-nighters and ship within 12 hours. Fr, we do not sleep when caffeine is supplied." },
  ];

  const handleMascotSelect = (index: number, replyText: string) => {
    setMascotChatIndex(index);
    setCurrentMascotMessage(replyText);
  };

  // Weather Bot Reply Emulator
  const generateWeatherRoast = () => {
    setIsChatbotTyping(true);
    setChatbotReply('Analyzing sky atmosphere arrays...');
    setTimeout(() => {
      const cityClean = weatherCity.trim() || 'Your City';
      if (chatbotPersonality === 'genz') {
        const genzQuotes = [
          `Bro, the weather in ${cityClean} is literally giving main character depression fr fr. Highly recommend logging off, skull emoji.`,
          `No cap, ${cityClean} is absolute garbage vibes right now. It's mid. Stay inside, lock down, grind ranks.`,
          `Sheesh! ${cityClean} is currently doing the absolute most. High key unhinged atmosphere. 10/10 would not touching grass today.`,
          `${cityClean} is lowkey a simulation. The graphics are bad, skies are gray, and frame rate is sub-20. L climate.`
        ];
        setChatbotReply(genzQuotes[Math.floor(Math.random() * genzQuotes.length)]);
      } else if (chatbotPersonality === 'dev') {
        const devQuotes = [
          `${cityClean} weather config reports Status 503: Sunshine Offline. Excess humidity leaks in localized modules. Run chmod +x raincoat.sh.`,
          `Local forecast at ${cityClean}: Sky array index out of bounds. Debugging outdoor assets is deprecated anyway. Stay in IDE.`,
          `Sky shaders in ${cityClean} failed compilation. 99+ warnings, 1 fatal error: SunshineNotFoundException. Setup neon strip lights in your cave instead.`,
          `Warning: ${cityClean} current weather exceeds limits. Stack overflow of damp atmosphere. Revert current system to cozy bed mode.`
        ];
        setChatbotReply(devQuotes[Math.floor(Math.random() * devQuotes.length)]);
      } else {
        const gamerQuotes = [
          `Squad up! ${cityClean} is experiencing optimal cooling levels for an overclocked cooling loops. Thermals are pristine. Launching lobby.`,
          `Current zone modifiers in ${cityClean}: Storm damage active, 2x threat hazard index. Safe zone is exclusively your cozy screen room.`,
          `ALERT: ${cityClean} biome has hostile environment. Spawn camping highly likely outside. Boot up DevXchange and request custom code.`,
          `${cityClean} is currently in full PvE mode. The weather is so toxic it drains your HP bar. Equipping headphones is recommended.`
        ];
        setChatbotReply(gamerQuotes[Math.floor(Math.random() * gamerQuotes.length)]);
      }
      setIsChatbotTyping(false);
    }, 600);
  };

  // Handle Real Google Login Flow via Popup
  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Google Sign-In failed: ", err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setTicketSubmitted(false);
    } catch (err) {
      console.error("Sign-Out failed: ", err);
    }
  };

  // Submit Ticket to Firestore and open Native Email link
  const handleSubmitTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!discordUsername || !projectDetails) return;

    const ticketsRef = collection(db, 'tickets');
    // Generate document reference with custom randomized base
    const customDocId = `t_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newDocRef = doc(ticketsRef, customDocId);

    try {
      // Create ticket in Firestore ensuring it passes the eight pillars
      await setDoc(newDocRef, {
        discordUsername,
        projectType,
        projectDetails,
        status: 'open',
        userId: auth.currentUser?.uid || '',
        email: auth.currentUser?.email || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        urgency: orderUrgency,
        paymentMethod: orderPayment
      });
    } catch (error) {
      // Catch and log the strict error JSON format for diagnostics
      handleFirestoreError(error, OperationType.CREATE, `tickets/${customDocId}`);
    }

    // Package ticket details as fallback / visual helper
    const subject = encodeURIComponent(`[DevXchange Order] ${projectType} - ${discordUsername}`);
    const body = encodeURIComponent(
      `========================================\n` +
      `         DEVXCHANGE ORDER TICKET        \n` +
      `========================================\n\n` +
      `Ticket Document ID: ${customDocId}\n` +
      `Discord Username : ${discordUsername}\n` +
      `Project Type     : ${projectType}\n` +
      `Contact Email    : ${auth.currentUser?.email || 'Not Signed In'}\n` +
      `Urgency          : ${orderUrgency}\n` +
      `Payment Method   : ${orderPayment}\n\n` +
      `[PROJECT REQUIREMENTS & BUDGET]:\n` +
      `${projectDetails}\n\n` +
      `========================================\n` +
      `Submitted and saved to Firestore secure database.\n`
    );

    // Open mailto link
    const mailtoUrl = `mailto:melonorian1@gmail.com?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;

    // Display success
    setTicketSubmitted(true);
  };

  // Cancel an active ticket/order
  const handleCancelTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
    }
  };

  // Mark ticket/order as completed (delivered)
  const handleCompleteTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        status: 'completed',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
    }
  };

  // Submit verified platform review rating
  const handleSubmitReview = async (ticketId: string, ticketProjectType: string) => {
    if (!user) return;
    setIsSubmittingRating(true);
    const customRatingId = `r_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    try {
      await setDoc(doc(db, 'ratings', customRatingId), {
        ticketId: ticketId,
        userId: auth.currentUser?.uid || '',
        userName: auth.currentUser?.displayName || 'Authorized Client',
        userPhoto: auth.currentUser?.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=256&auto=format&fit=crop',
        rating: ratingStars,
        feedback: ratingFeedback.trim() || 'Outstanding work! Very professional setup.',
        projectType: ticketProjectType,
        createdAt: serverTimestamp()
      });
      // Reset inputs & close drawer
      setRatingTicketId(null);
      setRatingStars(5);
      setRatingFeedback('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `ratings/${customRatingId}`);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  return (
    <div className="relative min-h-screen font-sans bg-[#0b0c10] text-[#f3f4f6] selection:bg-yellow-500 selection:text-black overflow-x-hidden">
      
      {/* Background ambient lighting overlay */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[500px] h-[550px] bg-yellow-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* STYLISH NAVIGATION BAR */}
      <div className="border-b border-yellow-500/20 bg-black/60 backdrop-blur-md sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          
          <div className="flex items-center space-x-3.5">
            <div className="relative w-11 h-11 rounded-xl overflow-hidden border-2 border-yellow-500 bg-zinc-950 shadow-glow-yellow flex items-center justify-center">
              <Terminal className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <span className="font-display font-bold text-xl tracking-wider text-white">
                Dev<span className="text-yellow-400 font-extrabold glow-accent">Xchange</span>
              </span>
              <div className="flex items-center space-x-1.5 -mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-[9px] text-emerald-400 tracking-wider font-bold">DEV SHOP ONLINE</span>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <a href="#portfolio" className="text-gray-300 hover:text-white transition-colors text-sm font-medium tracking-wide">
              Portfolio
            </a>
            <a href="#how-it-works" className="text-gray-300 hover:text-white transition-colors text-sm font-medium tracking-wide">
              How It Works
            </a>
            <a href="#order" className="text-gray-300 hover:text-white transition-colors text-sm font-medium tracking-wide">
              Submit Ticket
            </a>
            <div className="h-4 w-[1px] bg-zinc-800" />
            <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-xs">
              <span className="text-yellow-400 font-bold font-mono">Accepting</span>
              <span className="text-zinc-400">Steam, Digital Gifts</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3 bg-zinc-950/90 border border-zinc-800 px-3 py-1.5 rounded-xl">
                <img 
                  src={user.photoURL} 
                  alt={user.name} 
                  className="w-7 h-7 rounded-lg border border-yellow-400 object-cover shrink-0" 
                />
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-white leading-none">{user.name}</p>
                  <p className="text-[9px] text-zinc-500 leading-none mt-1">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1 px-1.5 bg-zinc-900 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 rounded-lg hover:border-rose-500/30 border border-transparent transition-all flex items-center"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 px-4 py-2 rounded-xl text-xs sm:text-xs font-bold transition-all flex items-center space-x-2"
              >
                <div className="w-3 h-3 bg-white rounded-full flex items-center justify-center p-0.5 shrink-0">
                  <svg viewBox="0 0 24 24" className="w-full h-full">
                    <path fill="#4285F4" d="M23.75 12.27c0-.83-.07-1.64-.2-2.42H12v4.58h6.61c-.29 1.5-.1.3-1.12 2.18v3.63h3.5c2.05-1.89 3.23-4.67 3.23-7.97z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.5-3.63c-.98.66-2.23 1.05-4.43 1.05-3.41 0-6.3-2.3-7.33-5.39H1.1v3.74C3.07 20.3 7.15 24 12 24y"/>
                    <path fill="#FBBC05" d="M4.67 13.12c-.26-.77-.4-1.6-.4-2.45s.14-1.68.4-2.45V4.48H1.1a12.02 12.02 0 0 0 0 10.38z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.93 1.19 15.24 0 12 0 7.15 0 3.07 3.7 1.1 8.22l3.57 3.51c1.03-3.1 3.92-5.41 7.33-5.41y"/>
                  </svg>
                </div>
                <span>Google Sign-In</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-8 flex flex-col justify-center space-y-6">
            <div className="inline-flex items-center space-x-2 self-start py-1.5 px-3.5 rounded-full bg-zinc-900/90 border border-yellow-500/30 text-[11px] font-mono tracking-wider text-yellow-500">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>DIGITAL GIFTS & STEAM TRADE</span>
            </div>

            <h1 className="font-display font-black text-4xl sm:text-6xl lg:text-7xl leading-[1.1] text-white tracking-tight">
              No PayPal?<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-sky-400 glow-accent font-extrabold">
                No Problem.
              </span>
            </h1>

            <p className="max-w-2xl text-zinc-400 text-base sm:text-lg leading-relaxed">
              Hire professional developers for your <span className="text-sky-400 font-semibold">Discord servers</span>, <span className="text-yellow-400 font-semibold">Minecraft plugins</span>, or <span className="text-purple-400 font-semibold">AI setups</span>, and pay using Steam games or digital gift cards. Secure, streamlined, and client-approved.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              {user ? (
                <a
                  href="#order"
                  className="px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-display font-bold text-base rounded-2xl transition-all shadow-glow-yellow flex items-center justify-center space-x-3"
                  id="hero_logged_in_btn"
                >
                  <MessageSquare className="w-5 h-5 animate-pulse" />
                  <span>Open an Order Ticket</span>
                </a>
              ) : (
                <button
                  onClick={handleGoogleLogin}
                  className="px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-display font-bold text-base rounded-2xl transition-all shadow-glow-yellow flex items-center justify-center space-x-3"
                  id="hero_signin_btn"
                >
                  <span>🔑 Sign in with Google to Order</span>
                </button>
              )}
              <a
                href="#portfolio"
                className="px-8 py-4 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white font-display text-sm font-semibold rounded-2xl transition-all border border-zinc-700/60 flex items-center justify-center space-x-2"
              >
                <span>Browse Portfolio & Custom Demos</span>
                <ArrowDown className="w-4 h-4 text-zinc-500 animate-bounce" />
              </a>
            </div>

            {/* Quick stats / highlights */}
            <div className="pt-8 border-t border-zinc-900/65 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                  <Coins className="w-4 h-4 text-yellow-400" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Payments</div>
                  <div className="text-xs font-semibold text-zinc-300">Steam & Digital Gifts</div>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-sky-500/10 rounded-xl border border-sky-500/20">
                  <Shield className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Security</div>
                  <div className="text-xs font-semibold text-zinc-300">Working Proof Core</div>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
                  <Cpu className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Core focus</div>
                  <div className="text-xs font-semibold text-zinc-300">AI / MC / Discord</div>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Community</div>
                  <div className="text-xs font-semibold text-zinc-300">Active Live Widgets</div>
                </div>
              </div>
            </div>
          </div>

          {/* Hero right: FAQ Bot / System Assistant */}
          <div className="lg:col-span-4 relative flex flex-col items-center">
            <div className="absolute inset-0 bg-yellow-500/10 rounded-full filter blur-[50px] pointer-events-none transform -translate-y-6" />

            <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-2xl flex flex-col overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-yellow-500 via-sky-500 to-purple-500" />
              
              <div className="flex justify-between items-center pb-2.5 border-b border-zinc-800">
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4 text-yellow-400" />
                  <span className="font-mono text-xs tracking-wider text-zinc-300 font-semibold uppercase">SYSTEM FAQS</span>
                </div>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-900 border border-emerald-500/20 text-[9px] text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse" />
                  ONLINE
                </span>
              </div>

              {/* Centered Tech Core Visual */}
              <div className="py-6 flex flex-col items-center justify-center">
                <div className="relative w-28 h-28 rounded-full border-2 border-yellow-400/40 bg-zinc-900 flex items-center justify-center shadow-glow-yellow animate-pulse">
                  <div className="absolute inset-2 rounded-full border border-dashed border-sky-400/30 animate-[spin_20s_linear_infinite]" />
                  <Cpu className="w-10 h-10 text-yellow-400" />
                  <div className="absolute -bottom-1.5 bg-yellow-400 text-black text-[9px] font-black font-mono px-2 py-0.5 rounded uppercase">
                    XChangeBot
                  </div>
                </div>
              </div>

              {/* Bot Dialogue Stream */}
              <div className="space-y-4 text-xs pt-3 border-t border-zinc-900">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg shrink-0 border border-yellow-500/30 bg-zinc-950 flex items-center justify-center shadow-inner">
                    <Terminal className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div className="flex-1 space-y-1 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                    <p className="font-mono text-[9px] font-bold text-yellow-500 uppercase tracking-widest">SYSTEM CHAT:</p>
                    <p className="text-zinc-200 font-sans leading-relaxed text-[11px]">{currentMascotMessage}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider block">Interactive FAQ Options:</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {mascotOptions.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleMascotSelect(i, opt.reply)}
                        className={`text-left p-2.5 rounded-xl font-sans text-[11px] border transition-all ${
                          mascotChatIndex === i
                            ? 'bg-yellow-400/10 border-yellow-400/50 text-yellow-300'
                            : 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                      >
                        ⚡ {opt.text}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* PORTFOLIO SECTION */}
      <section id="portfolio" className="bg-[#101216] border-y border-zinc-900 py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-zinc-900">
            <div>
              <div className="flex items-center space-x-2 text-sky-400 font-mono text-xs uppercase tracking-widest font-bold">
                <Compass className="w-4 h-4 shrink-0" />
                <span>EXCELLENCE IN EVERY SECTOR</span>
              </div>
              <h2 className="font-display font-bold text-3xl sm:text-5xl text-white mt-2">
                Our Showcase Work
              </h2>
              <p className="text-zinc-400 max-w-xl text-xs sm:text-sm mt-2">
                Click tabs or customize variables on our live interactive system sandboxes below to see how we build software with absolute precision.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center space-x-2 bg-zinc-950/80 p-1.5 rounded-xl border border-zinc-800">
              {['all', 'ai', 'minecraft', 'discord'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all ${
                    activeTab === cat
                      ? 'bg-yellow-400 text-black font-extrabold shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Card 1: GenZ Weather Chatbot */}
            {(activeTab === 'all' || activeTab === 'ai') && (
              <div className="bg-[#14171d] rounded-2xl border border-zinc-800/80 overflow-hidden flex flex-col justify-between group hover:border-purple-500/50 transition-all duration-300 shadow-xl">
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center space-x-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest">
                      <Bot className="w-3 h-3 shrink-0" />
                      <span>AI Chatbot v1.1</span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-glow-purple" />
                  </div>

                  <h3 className="text-xl font-display font-bold text-white tracking-wide">
                    GenZ Weather Chatbot v1.1
                  </h3>

                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    An unhinged, high-functioning AI bot with custom personality profiles. It responds in slang, dev jargon, or gamer modes depending on configuration.
                  </p>

                  {/* Sandbox Widget */}
                  <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800 flex flex-col space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-2 text-[10px] text-zinc-500 uppercase font-bold">
                      <span className="text-purple-400 flex items-center space-x-1">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Interactive Emulator</span>
                      </span>
                      <span>ACTIVE</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-zinc-500 uppercase">Target City:</label>
                      <input
                        type="text"
                        value={weatherCity}
                        onChange={(e) => setWeatherCity(e.target.value)}
                        className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded text-white w-full text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-zinc-500 uppercase">Bot Personality:</label>
                      <div className="grid grid-cols-3 gap-1">
                        {['genz', 'dev', 'gamer'].map((p) => (
                          <button
                            key={p}
                            onClick={() => setChatbotPersonality(p as any)}
                            className={`py-1 text-[9px] rounded uppercase font-bold border transition-all ${
                              chatbotPersonality === p
                                ? 'bg-purple-600 border-purple-400 text-white'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={generateWeatherRoast}
                      className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded text-[10px] uppercase tracking-wider flex items-center justify-center space-x-1"
                    >
                      <span>Roast Climate</span>
                    </button>

                    <div className="bg-black/80 p-2 rounded text-[10px] text-zinc-300">
                      <span className="text-purple-400 font-bold font-sans block mb-0.5">💬 Response:</span>
                      <p className="font-sans italic">{chatbotReply}</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-900 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 font-mono font-bold">Node.js / REST Matrix</span>
                  <a
                    href="#order"
                    onClick={() => {
                      setProjectType('AI Chatbot');
                      setProjectDetails('I want a custom weather/moderation bot focused on specific fun personalities.');
                    }}
                    className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center space-x-1"
                  >
                    <span>Request Copy</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* Card 2: Token Network Minecraft Server */}
            {(activeTab === 'all' || activeTab === 'minecraft') && (
              <div className="bg-[#14171d] rounded-2xl border border-zinc-800/80 overflow-hidden flex flex-col justify-between group hover:border-yellow-500/50 transition-all duration-300 shadow-xl">
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center space-x-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest">
                      <Gamepad2 className="w-3 h-3 shrink-0" />
                      <span>Minecraft Setups</span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-glow-yellow" />
                  </div>

                  <h3 className="text-xl font-display font-bold text-white tracking-wide">
                    Token Network Server
                  </h3>

                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    Custom plugin configurations, fully optimized server files to handle huge player metrics, and beautiful customized TAB layouts.
                  </p>

                  {/* Sandbox Widget */}
                  <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800 flex flex-col space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-2 text-[10px] text-zinc-500 uppercase font-bold">
                      <span className="text-yellow-400 flex items-center space-x-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>TAB Editor</span>
                      </span>
                      <span>PREVIEW</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-zinc-500 uppercase">Server Title:</label>
                      <input
                        type="text"
                        value={mcServerName}
                        onChange={(e) => setMcServerName(e.target.value.toUpperCase())}
                        className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded text-white w-full text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] text-zinc-500 uppercase">Style:</label>
                      <div className="grid grid-cols-3 gap-1">
                        {['cyberpunk', 'classic', 'abyss'].map((t) => (
                          <button
                            key={t}
                            onClick={() => setMcTabTheme(t as any)}
                            className={`py-1 text-[9px] rounded uppercase font-bold border transition-all ${
                              mcTabTheme === t
                                ? 'bg-yellow-500 text-black font-extrabold border-yellow-400'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Minecraft TAB view mockup */}
                    <div className="bg-[#111] p-2.5 rounded border border-yellow-500/10 text-[9px]">
                      <div className="text-center font-bold">
                        {mcTabTheme === 'cyberpunk' && (
                          <span className="text-yellow-400">&#10022; {mcServerName} &#10022;</span>
                        )}
                        {mcTabTheme === 'classic' && (
                          <span className="text-green-500 font-bold">[!] {mcServerName}</span>
                        )}
                        {mcTabTheme === 'abyss' && (
                          <span className="text-sky-400 font-bold">&#8704; {mcServerName} &#8704;</span>
                        )}
                      </div>
                      <div className="flex justify-between text-[8px] text-zinc-500 mt-2 border-t border-zinc-900 pt-1">
                        <span>[Owner] Sun_O</span>
                        <span className="text-green-400">15ms</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-900 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 font-mono font-bold">Paper / Purpur 1.20</span>
                  <a
                    href="#order"
                    onClick={() => {
                      setProjectType('Minecraft Setup');
                      setProjectDetails('I need a fully optimized server setup including config performance guidelines and clean layouts.');
                    }}
                    className="text-xs font-semibold text-yellow-400 hover:text-yellow-300 flex items-center space-x-1"
                  >
                    <span>Request Copy</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {/* Card 3: Professional Discord Server */}
            {(activeTab === 'all' || activeTab === 'discord') && (
              <div className="bg-[#14171d] rounded-2xl border border-zinc-800/80 overflow-hidden flex flex-col justify-between group hover:border-blue-500/50 transition-all duration-300 shadow-xl">
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center space-x-1.5 bg-sky-500/10 text-sky-400 border border-sky-500/30 px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest">
                      <Shield className="w-3 h-3 shrink-0" />
                      <span>Discord Guilds</span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shadow-glow-blue" />
                  </div>

                  <h3 className="text-xl font-display font-bold text-white tracking-wide">
                    Professional Discord setup
                  </h3>

                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    Extremely secure custom role hierarchies, automated anti-raid rules, professional tickets configurations, and welcome logic blocks.
                  </p>

                  {/* Sandbox Widget */}
                  <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800 flex flex-col space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-2 text-[10px] text-zinc-500 uppercase font-bold">
                      <span className="text-sky-400 flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>Roles Inspect</span>
                      </span>
                      <span>ACTIVE</span>
                    </div>

                    <div className="grid grid-cols-4 gap-1">
                      {['owner', 'staff', 'vip', 'gamer'].map((role) => (
                        <button
                          key={role}
                          onClick={() => setSelectedDiscordRole(role as any)}
                          className={`py-1 text-[8px] rounded uppercase font-bold border transition-all ${
                            selectedDiscordRole === role
                              ? 'bg-sky-500 text-black font-extrabold border-sky-400'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>

                    <div className="bg-[#18191c] p-2 rounded text-[9px]">
                      <span className="text-zinc-500 text-[8px] uppercase font-bold block mb-1">Previewing Role: {selectedDiscordRole}</span>
                      {selectedDiscordRole === 'owner' && <span className="text-red-400 font-bold">&#128081; MELON_ADMIN [Active]</span>}
                      {selectedDiscordRole === 'staff' && <span className="text-orange-400 font-bold">✈ Tech_Officer_1 [Online]</span>}
                      {selectedDiscordRole === 'vip' && <span className="text-pink-400">✦ digital_supporter [Online]</span>}
                      {selectedDiscordRole === 'gamer' && <span className="text-zinc-300">🎮 gamer_crew [Playing Minecraft]</span>}
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-900 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 font-mono font-bold">API Integration Enabled</span>
                  <a
                    href="#order"
                    onClick={() => {
                      setProjectType('Discord Setup');
                      setProjectDetails('I need a professional Discord community layout with secure verified roles and tickets.');
                    }}
                    className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center space-x-1"
                  >
                    <span>Request Copy</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-sky-500/5 rounded-full blur-[150px] pointer-events-none" />

        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center space-x-2 text-yellow-400 font-mono text-xs uppercase tracking-widest font-bold">
            <Award className="w-4 h-4 text-yellow-400" />
            <span>TRANSPARENT SYSTEM</span>
          </div>
          <h2 className="font-display font-black text-3xl sm:text-5xl text-white">
            Simple 3-Step Work Flow
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            We work entirely on sandbox environments and show you working video proof before you even submit payment details.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch relative">
          
          <div className="bg-[#13151a] p-8 rounded-2xl border border-zinc-800 flex flex-col justify-between relative pt-12 group hover:border-zinc-700 transition-all">
            <div className="absolute -top-5 left-8 w-10 h-10 rounded-xl bg-yellow-400 text-black font-display font-extrabold flex items-center justify-center shadow-lg text-lg">
              01
            </div>
            <div className="space-y-3">
              <h3 className="font-display font-bold text-xl text-white">Browse Portfolio</h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                Browse our real-time interactive preview models above. Select whether you're building an <strong className="text-purple-400">AI Personality Bot</strong>, optimizing <strong className="text-yellow-400">Minecraft Servers/Configurations</strong>, or building robust <strong className="text-sky-400">Discord Guild Networks</strong>.
              </p>
            </div>
          </div>

          <div className="bg-[#13151a] p-8 rounded-2xl border border-zinc-800 flex flex-col justify-between relative pt-12 group hover:border-zinc-700 transition-all">
            <div className="absolute -top-5 left-8 w-10 h-10 rounded-xl bg-purple-500 text-white font-display font-extrabold flex items-center justify-center shadow-lg text-lg">
              02
            </div>
            <div className="space-y-3">
              <h3 className="font-display font-bold text-xl text-white">Open A Ticket</h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                Log in securely below using Google Sign-In and fill out the structured requirements document. Or hop on our official Discord Server Widget below to discuss configurations with active staff members instantly.
              </p>
            </div>
          </div>

          <div className="bg-[#13151a] p-8 rounded-2xl border border-zinc-800 flex flex-col justify-between relative pt-12 group hover:border-zinc-700 transition-all">
            <div className="absolute -top-5 left-8 w-10 h-10 rounded-xl bg-sky-500 text-black font-display font-extrabold flex items-center justify-center shadow-lg text-lg">
              03
            </div>
            <div className="space-y-3">
              <h3 className="font-display font-bold text-xl text-white">Stream Working Proof</h3>
              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                Our engineering team develops on custom testing sandboxes. We live-stream 100% video-proof validation of all security rules, plugin speeds, and bot replies. Only pay using Steam games or Digital Gifts after you approve.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* THE ORDER TICKET SECTION (LOCKED / UNLOCKED) */}
      <section id="order" className="bg-[#0b0c10] border-t border-zinc-900 py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-4xl mx-auto">
          
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center space-x-2 text-yellow-400 font-mono text-xs uppercase tracking-widest font-bold">
              <Compass className="w-4 h-4" />
              <span>ACTIVE ORDERS PLATFORM</span>
            </div>
            <h2 className="font-display font-black text-3xl sm:text-5xl text-white">
              Secures Project Ticket Office
            </h2>
            <p className="text-zinc-400 text-sm max-w-lg mx-auto leading-relaxed">
              Open a secure trackable ticket. Our head administrator <strong className="text-yellow-400 font-semibold">melonorian1@gmail.com</strong> handles scheduling, streaming setup, and contracts.
            </p>
          </div>

          <div className="bg-[#14171d] rounded-3xl border border-zinc-800 overflow-hidden relative shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 to-sky-400" />
            
            <div className="p-8 sm:p-12 relative z-10">
              
              <AnimatePresence mode="wait">
                {!user ? (
                  /* LOCKED AUTH CARD */
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="flex flex-col items-center justify-center py-10 text-center space-y-6"
                  >
                    <div className="p-4 bg-zinc-950 rounded-2xl border border-yellow-500/10 text-yellow-500/80 shadow-inner">
                      <Lock className="w-12 h-12 stroke-[1.5]" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xl sm:text-2xl font-display font-bold text-white">
                        Access Restricted
                      </h3>
                      <p className="text-zinc-400 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
                        Please Sign in with Google above to open an active project ticket.
                      </p>
                    </div>

                    <button
                      onClick={handleGoogleLogin}
                      className="px-8 py-3.5 bg-yellow-400 hover:bg-yellow-300 text-black font-display font-bold text-sm rounded-xl transition-all shadow-glow-yellow flex items-center space-x-3"
                    >
                      <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center p-0.5">
                        <svg viewBox="0 0 24 24" className="w-full h-full">
                          <path fill="#4285F4" d="M23.75 12.27c0-.83-.07-1.64-.2-2.42H12v4.58h6.61c-.29 1.5-.1.3-1.12 2.18v3.63h3.5c2.05-1.89 3.23-4.67 3.23-7.97z"/>
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.5-3.63c-.98.66-2.23 1.05-4.43 1.05-3.41 0-6.3-2.3-7.33-5.39H1.1v3.74C3.07 20.3 7.15 24 12 24y"/>
                          <path fill="#FBBC05" d="M4.67 13.12c-.26-.77-.4-1.6-.4-2.45s.14-1.68.4-2.45V4.48H1.1a12.02 12.02 0 0 0 0 10.38z"/>
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.93 1.19 15.24 0 12 0 7.15 0 3.07 3.7 1.1 8.22l3.57 3.51c1.03-3.1 3.92-5.41 7.33-5.41y"/>
                        </svg>
                      </div>
                      <span>Open Form with Google Sign-In</span>
                    </button>
                  </motion.div>
                ) : ticketSubmitted ? (
                  /* SUCCESS TICKET CREATED */
                  <motion.div 
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-8 text-center space-y-6"
                  >
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                      <Check className="w-8 h-8" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-2xl font-display font-bold text-white">Ticket Package Transmitted!</h3>
                      <p className="text-zinc-400 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
                        Ticket Submitted! Head administrator <strong className="text-yellow-400">melonorian1@gmail.com</strong> will review your request shortly. 
                      </p>
                      <p className="text-zinc-500 text-[11px] font-mono leading-relaxed mt-1">
                        We have also launched your default email software client to transmit specifications natively.
                      </p>
                    </div>

                    <button
                      onClick={() => setTicketSubmitted(false)}
                      className="px-6 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs transition-all"
                    >
                      Fill another ticket
                    </button>
                  </motion.div>
                ) : (
                  /* ACTIVE TICKET WINDOW - UNLOCKED */
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                      <div className="flex space-x-6">
                        <button
                          type="button"
                          onClick={() => setTicketSubTab('create')}
                          className={`pb-2 text-sm font-semibold border-b-2 transition-all ${
                            ticketSubTab === 'create'
                              ? 'border-yellow-400 text-white font-bold'
                              : 'border-transparent text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Open New Ticket
                        </button>
                        <button
                          type="button"
                          onClick={() => setTicketSubTab('history')}
                          className={`pb-2 text-sm font-semibold border-b-2 transition-all relative ${
                            ticketSubTab === 'history'
                              ? 'border-yellow-400 text-white font-bold'
                              : 'border-transparent text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          My Tickets
                          {myTickets.length > 0 && (
                            <span className="absolute -top-1.5 -right-4 px-1.5 py-0.5 text-[8px] bg-yellow-500 text-black font-black font-mono rounded-full leading-none">
                              {myTickets.length}
                            </span>
                          )}
                        </button>
                      </div>
                      <span className="hidden sm:inline-block text-[10px] font-mono bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full uppercase">Authenticated Mode</span>
                    </div>

                    {ticketSubTab === 'create' ? (
                      <form onSubmit={handleSubmitTicket} className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-400">Your Discord Username *</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. shin_chan#9211"
                              value={discordUsername}
                              onChange={(e) => setDiscordUsername(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all font-sans"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-400">Project Type *</label>
                            <select
                              value={projectType}
                              onChange={(e) => setProjectType(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all font-sans cursor-pointer"
                            >
                              <option value="Discord Setup">Discord Config Setup</option>
                              <option value="Minecraft Setup">Minecraft Plugin Configurations</option>
                              <option value="AI Chatbot">AI Custom Personality Bot</option>
                              <option value="Web Development">Full Stack Web Code / Custom Web App</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-400">Project Details, Deliverables & Budget Offer *</label>
                          <textarea
                            required
                            rows={4}
                            placeholder="e.g. I need a Discord server setup with dynamic ticket logic. I am ready to offer a direct Steam digital trading key for 'Dead Space Remake' or equivalent Digital Giftcard."
                            value={projectDetails}
                            onChange={(e) => setProjectDetails(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-400 transition-all font-sans"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-display font-extrabold text-sm rounded-xl transition-all shadow-glow-yellow flex items-center justify-center space-x-2"
                        >
                          <Send className="w-4 h-4" />
                          <span>Submit Ticket via E-Mail Client</span>
                        </button>
                      </form>
                    ) : (
                      /* TICKET HISTORY WITH RATINGS & SIMULATOR */
                      <div className="space-y-6">
                        {myTickets.length === 0 ? (
                          <div className="text-center py-12 px-4 border border-dashed border-zinc-800 rounded-2xl">
                            <Compass className="w-8 h-8 text-zinc-650 text-zinc-600 mx-auto opacity-40 mb-3 animate-pulse" />
                            <p className="text-sm font-semibold text-zinc-300">No Orders or Tickets Found</p>
                            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 leading-relaxed">
                              You haven't submitted any service tickets yet. Go ahead and click "Open New Ticket" to launch your first request!
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                            {myTickets.map((ticket) => {
                              const ticketReview = allRatings.find((r) => r.ticketId === ticket.id);
                              const isRatingThis = ratingTicketId === ticket.id;

                              return (
                                <div key={ticket.id} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/40 relative hover:border-zinc-700 transition-all text-left">
                                  {/* Ticket details top */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-3 mb-4">
                                    <div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs font-mono font-bold text-yellow-500 uppercase">
                                          {ticket.projectType}
                                        </span>
                                        <span className="text-zinc-750 text-zinc-700">•</span>
                                        <span className="text-[10px] font-mono text-zinc-500">
                                          ID: {ticket.id}
                                        </span>
                                      </div>
                                      <p className="text-sm font-bold text-white mt-1">
                                        Discord Username: <span className="text-zinc-300">{ticket.discordUsername}</span>
                                      </p>
                                    </div>
                                    
                                    {/* Status Badge */}
                                    <div>
                                      {ticket.status === 'open' && (
                                        <span className="inline-flex items-center px-2.5 py-1 bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-[10px] font-bold uppercase rounded-md">
                                          Pending Dev Proof
                                        </span>
                                      )}
                                      {ticket.status === 'completed' && (
                                        <span className="inline-flex items-center px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded-md animate-pulse">
                                          Delivered & Confirmed
                                        </span>
                                      )}
                                      {ticket.status === 'cancelled' && (
                                        <span className="inline-flex items-center px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-semibold uppercase rounded-md">
                                          Cancelled
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-xs text-zinc-400 leading-relaxed bg-zinc-950 p-3.5 rounded-xl border border-zinc-904 border-zinc-900">
                                    <span className="block text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider mb-1">Specifications & Requirements:</span>
                                    {ticket.projectDetails}
                                  </div>

                                  {/* Dynamic action row */}
                                  <div className="mt-4 pt-4 border-t border-zinc-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center space-x-2 text-zinc-500 font-mono text-[10px]">
                                      <Calendar className="w-3.5 h-3.5" />
                                      <span>
                                        {ticket.createdAt?.seconds 
                                          ? new Date(ticket.createdAt.seconds * 1000).toLocaleDateString()
                                          : 'Just now'}
                                      </span>
                                      {ticket.paymentMethod && (
                                        <>
                                          <span>•</span>
                                          <span className="capitalize">{ticket.paymentMethod.replace('_', ' ')}</span>
                                        </>
                                      )}
                                    </div>

                                    <div className="flex items-center space-x-2.5">
                                      {ticket.status === 'open' && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleCancelTicket(ticket.id)}
                                            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 hover:text-red-400 hover:border-red-500/30 border border-zinc-800 rounded-lg font-bold transition-all text-[11px]"
                                          >
                                            Cancel Order
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleCompleteTicket(ticket.id)}
                                            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg font-extrabold transition-all text-[11px] shadow-sm flex items-center space-x-1"
                                          >
                                            <span>✓ Confirm Delivery</span>
                                          </button>
                                        </>
                                      )}

                                      {/* No actions needed for completed orders */}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>

          {/* DISCORD SERVER LIVE WIDGET */}
          <div className="mt-12 bg-zinc-950/60 p-6 rounded-3xl border border-zinc-800 text-center space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left">
                <h4 className="font-display font-bold text-lg text-white">💬 Join our Live Discord</h4>
                <p className="text-zinc-500 text-xs sm:text-xs">Real-time chat with active devs and digital trade mediators</p>
              </div>

              <a 
                href="https://discord.gg/kaYZqTUrSp"
                target="_blank" 
                rel="noreferrer"
                className="px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-2"
              >
                <span>💬 Open an Order Ticket on Discord</span>
              </a>
            </div>

            {/* Embed Zone for Discord Live Widget */}
            <div className="w-full h-44 rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 bg-opacity-70 flex items-center justify-center">
              <iframe 
                src={discordWidgetIframeSrc}
                width="100%" 
                height="100%" 
                allowFullScreen={false} 
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts" 
                title="DevXchange Discord Community Widget"
                className="border-none w-full h-full"
              />
            </div>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 bg-black/80 py-12 px-4 sm:px-6 lg:px-8 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto space-y-4">
          <p className="font-display font-semibold tracking-wider text-zinc-400 text-sm">
            Dev<span className="text-yellow-400">Xchange</span> Portfolio & Order Client
          </p>
          <p className="max-w-md mx-auto leading-relaxed">
            All code sandbox demonstrations are live replicas. Trades are handled securely via head administrator <strong>melonorian1@gmail.com</strong>. We are not affiliated with PayPal, Steam, Mojang, or Discord Inc.
          </p>
          <div className="pt-4 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-600 font-mono">
            <span>© 2026 DEVXCHANGE SYSTEMS</span>
            <span>Coded with pristine modern layout styling</span>
          </div>
        </div>
      </footer>



    </div>
  );
}
