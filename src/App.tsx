import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  ChevronLeft, 
  Lock, 
  Clock, 
  Share2, 
  Heart, 
  MessageSquare, 
  List,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  X,
  Menu,
  Loader2,
  Settings,
  Plus,
  Trash2,
  Edit3,
  Save,
  Unlock,
  LogOut,
  ShieldCheck,
  RotateCcw,
  Users,
  Sparkles,
  Star,
  Copy,
  FileText
} from 'lucide-react';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc, 
  deleteDoc,
  addDoc
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User 
} from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
import { CHAPTERS as INITIAL_CHAPTERS, type Chapter } from './constants';
import { cn } from './lib/utils';
import ShinyText from './components/ShinyText';

export type Genre = 'Sci-Fi' | 'BL' | 'Terror Psicológico' | 'Romance' | 'Fantasía' | 'Drama' | 'Misterio' | 'Thriller' | 'Contemporáneo' | 'Todos';

export interface StoryInfo {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  status: 'Disponible' | 'Próximamente' | 'En Progreso';
  chapters?: number;
  releaseDate?: string;
  genres: Genre[];
  isFeatured?: boolean;
}

export const CATALOG_DATA: StoryInfo[] = [
  {
    id: 'el-acto',
    title: 'El Acto',
    author: 'Sam C.',
    description: '"Una inmersión profunda en la psique humana a través del arte y la obsesión. La historia que definió una nueva era editorial."',
    coverUrl: 'https://i.postimg.cc/cCqGfwZb/1774848486059-edit-237685009748444.png',
    status: 'Disponible',
    chapters: 27,
    genres: ['Sci-Fi', 'BL', 'Terror Psicológico'],
    isFeatured: true
  },
  {
    id: 'hana',
    title: 'Hana',
    author: 'Carolina',
    description: 'Una historia que desafía los límites de la narrativa convencional.',
    coverUrl: '',
    status: 'Próximamente',
    releaseDate: 'Estreno en 2 días',
    genres: ['Drama', 'Contemporáneo']
  },
  {
    id: 'ecos-del-manana',
    title: 'Ecos del Mañana',
    author: 'A. R. Vane',
    description: 'En un futuro donde los recuerdos se pueden comprar y vender, un detective busca su propio pasado robado.',
    coverUrl: 'https://picsum.photos/seed/scifi1/800/1200?blur=2',
    status: 'Disponible',
    chapters: 15,
    genres: ['Sci-Fi', 'Thriller', 'Misterio']
  },
  {
    id: 'sombras-de-neón',
    title: 'Sombras de Neón',
    author: 'K. L. Reyes',
    description: 'Dos hackers rivales descubren una conspiración que amenaza con apagar la red global, forzándolos a colaborar.',
    coverUrl: 'https://picsum.photos/seed/neon/800/1200?blur=2',
    status: 'Disponible',
    chapters: 42,
    genres: ['Sci-Fi', 'BL', 'Romance']
  },
  {
    id: 'el-laberinto-de-cristal',
    title: 'El Laberinto de Cristal',
    author: 'M. T. Silva',
    description: 'Un thriller psicológico sobre un arquitecto atrapado en el edificio que él mismo diseñó, donde las leyes de la física parecen no aplicar.',
    coverUrl: 'https://picsum.photos/seed/glass/800/1200?blur=2',
    status: 'En Progreso',
    chapters: 8,
    genres: ['Terror Psicológico', 'Misterio']
  },
  {
    id: 'susurros-del-bosque',
    title: 'Susurros del Bosque',
    author: 'Elena M.',
    description: 'Una antigua maldición despierta en un pequeño pueblo, y solo dos forasteros pueden detenerla antes de que consuma todo.',
    coverUrl: 'https://picsum.photos/seed/forest/800/1200?blur=2',
    status: 'Próximamente',
    releaseDate: 'Otoño 2026',
    genres: ['Fantasía', 'Terror Psicológico']
  }
];

export default function App() {
  const [selectedStory, setSelectedStory] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [view, setView] = useState<'catalog' | 'story-detail' | 'reading' | 'admin'>('catalog');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookmarks, setBookmarks] = useState<Record<number, number>>({});
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlurred, setIsBlurred] = useState(false);
  const [showSecurityWarning, setShowSecurityWarning] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [newChapterNotify, setNewChapterNotify] = useState<Chapter | null>(null);
  const [prevChapters, setPrevChapters] = useState<Chapter[]>([]);
  const [notifyProgress, setNotifyProgress] = useState(100);

  const NOTIFY_DURATION = 8000; // 8 seconds

  const ADMIN_EMAIL = "samuelcasseresbx@gmail.com";

  useEffect(() => {
    // Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === ADMIN_EMAIL);
    });

    // Chapters Listener
    const q = query(collection(db, 'chapters'), orderBy('id', 'asc'));
    const unsubscribeChapters = onSnapshot(q, (snapshot) => {
      const fetchedChapters = snapshot.docs.map(doc => ({
        ...doc.data(),
        docId: doc.id
      })) as (Chapter & { docId: string })[];
      
      if (fetchedChapters.length === 0 && isAdmin) {
        // Initial migration if empty (only if admin is logged in)
        INITIAL_CHAPTERS.forEach(async (c) => {
          await setDoc(doc(db, 'chapters', `chapter-${c.id}`), {
            ...c,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        });
      } else {
        // Check for newly unlocked chapters
        if (prevChapters.length > 0 && !isAdmin) {
          const newlyUnlocked = fetchedChapters.find(c => {
            const prev = prevChapters.find(p => p.id === c.id);
            return prev && prev.isLocked && !c.isLocked;
          });
          
          if (newlyUnlocked) {
            setNewChapterNotify(newlyUnlocked);
          }
        }

        // Check for new chapters on initial load for returning users
        if (prevChapters.length === 0 && fetchedChapters.length > 0 && !isAdmin) {
          const lastSeenId = Number(localStorage.getItem('el-acto-last-seen-id') || '0');
          const latestUnlocked = [...fetchedChapters].reverse().find(c => !c.isLocked);
          
          if (latestUnlocked && latestUnlocked.id > lastSeenId) {
            setNewChapterNotify(latestUnlocked);
          }
        }

        setChapters(fetchedChapters);
        setPrevChapters(fetchedChapters);
      }
    });

    // Prevent right-click and long-press
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);

    // Prevent copy, cut, paste, and drag
    const handleCopy = (e: ClipboardEvent) => e.preventDefault();
    const handleDrag = (e: DragEvent) => e.preventDefault();
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCopy);
    document.addEventListener('paste', handleCopy);
    document.addEventListener('dragstart', handleDrag);

    // Detect PrintScreen and other keys
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        setShowSecurityWarning(true);
        setTimeout(() => setShowSecurityWarning(false), 3000);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Blur on focus loss
    const handleBlur = () => setIsBlurred(true);
    const handleFocus = () => setIsBlurred(false);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    // Simulate initial loading
    const timer = setTimeout(() => setIsLoading(false), 3500);
    
    const saved = localStorage.getItem('el-acto-bookmarks');
    if (saved) {
      try {
        setBookmarks(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading bookmarks", e);
      }
    }

    return () => {
      unsubscribeAuth();
      unsubscribeChapters();
      clearTimeout(timer);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCopy);
      document.removeEventListener('paste', handleCopy);
      document.removeEventListener('dragstart', handleDrag);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAdmin]);

  const saveBookmark = useCallback((chapterId: number, scrollY: number) => {
    setBookmarks(prev => {
      const newBookmarks = { ...prev, [chapterId]: scrollY };
      localStorage.setItem('el-acto-bookmarks', JSON.stringify(newBookmarks));
      return newBookmarks;
    });
  }, []);

  const handleChapterClick = (chapter: Chapter) => {
    if (!chapter.isLocked) {
      setSelectedChapter(chapter);
      setView('reading');
      
      // Update last seen ID
      localStorage.setItem('el-acto-last-seen-id', String(chapter.id));
      if (newChapterNotify?.id === chapter.id) {
        setNewChapterNotify(null);
      }
      
      // Check if there's a bookmark for this chapter
      const savedPos = bookmarks[chapter.id];
      setTimeout(() => {
        window.scrollTo({ top: savedPos || 0, behavior: savedPos ? 'smooth' : 'auto' });
      }, 100);
    } else {
      setShowLockedModal(true);
    }
  };

  const handleStorySelect = (storyId: string) => {
    setSelectedStory(storyId);
    setView('story-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    if (view === 'reading') {
      setView('story-detail');
    } else {
      setView('catalog');
      setSelectedStory(null);
    }
    setSelectedChapter(null);
  };

  const playNotificationSound = () => {
    const audio = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_7833388c4b.mp3');
    audio.volume = 0.4;
    audio.play().catch(e => console.log("Audio playback blocked until user interaction", e));
  };

  useEffect(() => {
    if (newChapterNotify) {
      playNotificationSound();
      setNotifyProgress(100);
      
      const interval = setInterval(() => {
        setNotifyProgress(prev => Math.max(0, prev - (100 / (NOTIFY_DURATION / 100))));
      }, 100);

      const timer = setTimeout(() => {
        setNewChapterNotify(null);
      }, NOTIFY_DURATION);

      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [newChapterNotify]);
  const handleAdminClick = () => {
    if (isAdmin) {
      setView('admin');
      setAdminClickCount(0);
      return;
    }
    
    setAdminClickCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        signInWithPopup(auth, googleProvider)
          .then((result) => {
            if (result.user.email === ADMIN_EMAIL) {
              setView('admin');
            }
          })
          .catch(console.error);
        return 0;
      }
      return next;
    });
  };

  return (
    <div className={cn(
      "min-h-screen bg-bg text-ink selection:bg-accent selection:text-bg transition-all duration-500 font-sans",
      isBlurred && "blur-xl grayscale"
    )}>
      {/* Grain Overlay */}
      <div className="fixed inset-0 z-[1000] pointer-events-none opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      
      <AnimatePresence mode="wait">
        {isLoading ? (
          <LoadingScreen key="loading" onAuthorClick={handleAdminClick} />
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            {/* Real-time Notification */}
            <AnimatePresence>
              {newChapterNotify && (
                <motion.div
                  initial={{ y: -120, opacity: 0, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -120, opacity: 0, scale: 0.9 }}
                  className="fixed top-6 left-1/2 -translate-x-1/2 z-[400] w-[95%] max-w-md"
                >
                  <div className="relative overflow-hidden bg-black/95 backdrop-blur-xl p-5 rounded-3xl border border-accent/40 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-5">
                    {/* Progress Bar Background */}
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
                      <motion.div 
                        className="h-full bg-accent"
                        initial={{ width: "100%" }}
                        animate={{ width: `${notifyProgress}%` }}
                        transition={{ ease: "linear" }}
                      />
                    </div>

                    <motion.div 
                      animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ 
                        duration: 2, 
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="w-14 h-14 bg-accent/20 rounded-2xl flex items-center justify-center text-accent shrink-0 shadow-[0_0_20px_rgba(242,125,38,0.2)]"
                    >
                      <BookOpen size={28} />
                    </motion.div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                        </span>
                        <p className="text-[10px] font-mono text-accent uppercase tracking-[0.2em] font-bold">Nueva Entrega</p>
                      </div>
                      <h4 className="text-lg font-serif font-bold truncate leading-tight">
                        {newChapterNotify.title}
                      </h4>
                      <p className="text-xs text-muted truncate opacity-70">Capítulo {newChapterNotify.id} ya disponible</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => handleChapterClick(newChapterNotify)}
                        className="px-5 py-2 bg-accent text-bg text-xs font-bold rounded-xl hover:bg-accent/80 transition-all shadow-lg shadow-accent/20 active:scale-95"
                      >
                        Leer
                      </button>
                      <button 
                        onClick={() => setNewChapterNotify(null)}
                        className="px-5 py-2 bg-white/5 text-muted text-[10px] font-bold rounded-xl hover:bg-white/10 transition-colors active:scale-95"
                      >
                        Ignorar
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {view === 'catalog' ? (
                <div key="catalog-wrapper">
                  <Navbar onAdminClick={handleAdminClick} />
                  <CatalogView 
                    onStorySelect={handleStorySelect}
                    onAuthorClick={handleAdminClick}
                  />
                </div>
              ) : view === 'story-detail' ? (
                <div key="story-detail-wrapper">
                  <Navbar onAdminClick={handleAdminClick} onBack={goBack} />
                  <HomeView 
                    storyId={selectedStory!}
                    onChapterClick={handleChapterClick} 
                    bookmarks={bookmarks}
                    chapters={chapters}
                    onAuthorClick={handleAdminClick}
                    isAdmin={isAdmin}
                    onAuthorMessageClick={() => setShowThankYou(true)}
                    onBack={goBack}
                  />
                </div>
              ) : view === 'reading' ? (
                <ReadingView 
                  key="reading" 
                  chapter={selectedChapter!} 
                  onBack={goBack} 
                  onSaveBookmark={saveBookmark}
                  currentBookmark={bookmarks[selectedChapter!.id]}
                  onFinish={() => setShowThankYou(true)}
                  isLastChapter={selectedChapter!.id === 27}
                />
              ) : (
                <AdminView 
                  key="admin" 
                  chapters={chapters} 
                  onBack={() => setView('home')} 
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security Warning Toast */}
      <AnimatePresence>
        {showSecurityWarning && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] px-8 py-4 bg-red-500/90 text-white font-bold rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3"
          >
            <Lock size={20} />
            <span>Capturas de pantalla y copias no permitidas</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Locked Chapter Modal */}
      <AnimatePresence>
        {showLockedModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLockedModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-black/95 backdrop-blur-xl p-8 rounded-3xl border border-accent/30 shadow-2xl text-center space-y-6"
            >
              <button 
                onClick={() => setShowLockedModal(false)}
                className="absolute top-4 right-4 p-2 text-muted hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto text-accent">
                <Lock size={32} />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-serif font-bold">Próximamente</h2>
                <p className="text-muted leading-relaxed">
                  Este capítulo se desbloqueará muy pronto. Estamos preparando un <span className="text-accent font-bold">catálogo completo</span> con nuevos estrenos de <span className="text-accent font-bold">SAM C.</span>
                </p>
                <p className="text-xs font-mono text-accent/60 uppercase tracking-widest pt-2">
                  Faltan 2 días para el gran lanzamiento
                </p>
              </div>

              <button 
                onClick={() => setShowLockedModal(false)}
                className="w-full py-4 bg-accent text-bg font-bold rounded-full hover:bg-accent/80 transition-colors"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Thank You Modal */}
      <AnimatePresence>
        {showThankYou && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-0 md:p-12">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowThankYou(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
            />
            
            {/* Immersive Background Gradients */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                  x: [0, 50, 0],
                  y: [0, 30, 0]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-accent/20 blur-[120px] rounded-full" 
              />
              <motion.div 
                animate={{ 
                  scale: [1.2, 1, 1.2],
                  opacity: [0.2, 0.4, 0.2],
                  x: [0, -50, 0],
                  y: [0, -30, 0]
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-accent/10 blur-[120px] rounded-full" 
              />
            </div>

            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 100 }}
              className="relative w-full h-full max-w-6xl bg-zinc-900/40 border-x border-white/5 md:rounded-[3rem] md:border overflow-hidden flex flex-col md:flex-row"
            >
              {/* Left Side: Visual/Atmospheric */}
              <div className="hidden md:block w-1/3 relative border-r border-white/5 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black z-10" />
                <img 
                  src={CATALOG_DATA.find(s => s.id === selectedStory)?.coverUrl || "https://i.postimg.cc/cCqGfwZb/1774848486059-edit-237685009748444.png"} 
                  className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale hover:grayscale-0 transition-all duration-1000 scale-110 hover:scale-100"
                  alt="Atmosphere"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-12 left-12 z-20 space-y-2">
                  <p className="text-accent font-mono text-[10px] uppercase tracking-[0.4em] font-bold">{CATALOG_DATA.find(s => s.id === selectedStory)?.title || 'Obra'}</p>
                  <h3 className="text-4xl font-serif italic text-white leading-none">Fin de la función.</h3>
                </div>
              </div>

              {/* Right Side: Content */}
              <div className="flex-1 p-8 md:p-20 flex flex-col justify-center relative overflow-y-auto custom-scrollbar">
                <button 
                  onClick={() => setShowThankYou(false)}
                  className="absolute top-8 right-8 p-2 text-muted hover:text-white transition-colors z-50"
                >
                  <X size={24} />
                </button>

                <div className="max-w-xl space-y-12">
                  <motion.div 
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-[1px] w-12 bg-accent" />
                      <span className="text-accent font-mono text-xs tracking-[0.3em] uppercase">Nota del Autor</span>
                    </div>
                    <h2 className="text-6xl md:text-8xl font-serif italic font-bold tracking-tighter leading-[0.85]">
                      Gracias por <br />
                      <span className="text-accent">sentir</span> esto.
                    </h2>
                  </motion.div>

                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="space-y-8"
                  >
                    <p className="text-xl md:text-2xl text-white/80 font-light leading-relaxed font-serif italic">
                      "Ha sido una experiencia sorprendente y linda compartir esta historia contigo. Cada palabra fue escrita pensando en el eco que dejaría en tu alma."
                    </p>
                    <p className="text-muted leading-relaxed text-lg">
                      Espero que <span className="text-white italic">{CATALOG_DATA.find(s => s.id === selectedStory)?.title || 'esta obra'}</span> haya resonado en ti tanto como lo hizo en mí al crearlo. Esta historia ahora también te pertenece.
                    </p>
                  </motion.div>

                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="pt-12 flex flex-col sm:flex-row items-start sm:items-center gap-12"
                  >
                    <div className="flex flex-col">
                      <span className="text-accent font-hand text-5xl mb-2">By SAM C.</span>
                      <span className="text-[10px] font-mono text-muted uppercase tracking-[0.3em]">Autor Original</span>
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => {
                          setShowThankYou(false);
                          setView('home');
                          setSelectedChapter(null);
                        }}
                        className="px-10 py-4 bg-white text-black font-bold rounded-full hover:bg-accent hover:text-white transition-all duration-500 shadow-2xl active:scale-95 text-sm uppercase tracking-widest"
                      >
                        Cerrar Telón
                      </button>
                    </div>
                  </motion.div>
                </div>

                {/* Decorative Vertical Text */}
                <div className="absolute right-8 bottom-24 hidden lg:block">
                  <p className="writing-mode-vertical text-[10px] font-mono text-white/10 uppercase tracking-[0.5em] rotate-180">
                    UNA HISTORIA ORIGINAL • 2026 • SAM C.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LoadingScreen(_props: { key?: string | number; onAuthorClick?: () => void }) {
  const authorName = "By SAM C.";
  
  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
      className="fixed inset-0 z-[200] bg-bg flex flex-col items-center justify-center space-y-8"
    >
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="text-center"
        >
          <span className="text-accent font-mono text-xs tracking-[0.3em] uppercase mb-4 block">
            Presentando
          </span>
          <h2 className="text-4xl md:text-6xl font-serif italic tracking-tight">
            Una Historia Original
          </h2>
        </motion.div>
      </div>

      <div className="flex items-center justify-center">
        <motion.div
          initial="hidden"
          animate="visible"
          className="flex cursor-pointer"
          onClick={_props.onAuthorClick}
        >
          {authorName.split("").map((char, index) => (
            <motion.span
              key={index}
              variants={{
                hidden: { opacity: 0, width: 0 },
                visible: { 
                  opacity: 1, 
                  width: "auto",
                  transition: { 
                    delay: 1.5 + (index * 0.1),
                    duration: 0.2
                  } 
                }
              }}
              className={cn(
                "text-2xl md:text-4xl font-hand text-accent",
                char === " " ? "mr-3" : ""
              )}
            >
              {char}
            </motion.span>
          ))}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ 
              delay: 1.5,
              duration: 0.8, 
              repeat: Infinity,
              ease: "linear"
            }}
            className="w-1 h-8 md:h-10 bg-accent ml-1 self-end mb-1"
          />
        </motion.div>
      </div>

      {/* Decorative elements */}
      <motion.div 
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.5, duration: 1.5, ease: "easeInOut" }}
        className="w-24 h-[1px] bg-white/20"
      />
    </motion.div>
  );
}

function Navbar({ onAdminClick, onBack }: { onAdminClick: () => void; onBack?: () => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 left-0 right-0 h-20 md:h-24 z-50 flex items-center justify-between px-6 md:px-16 backdrop-blur-md border-b border-white/5"
      >
        <div className="flex items-center gap-4 md:gap-12">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 md:p-3 hover:bg-white/5 rounded-full transition-colors group"
            >
              <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </button>
          )}
          <div className="flex flex-col group cursor-pointer" onClick={onBack}>
            <span className="text-xl md:text-2xl font-serif italic font-bold tracking-tighter leading-none group-hover:text-accent transition-colors">SAM C.</span>
            <span className="text-[8px] md:text-[9px] font-mono uppercase tracking-[0.5em] text-accent font-bold">Editorial</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-16 text-[11px] font-mono uppercase tracking-[0.4em] text-muted">
          <button className="hover:text-white transition-colors relative group">
            Colección
            <span className="absolute -bottom-2 left-0 w-0 h-[1px] bg-accent transition-all group-hover:w-full" />
          </button>
          <button className="hover:text-white transition-colors relative group">
            Autores
            <span className="absolute -bottom-2 left-0 w-0 h-[1px] bg-accent transition-all group-hover:w-full" />
          </button>
          <button className="hover:text-white transition-colors relative group">
            Sobre Nosotros
            <span className="absolute -bottom-2 left-0 w-0 h-[1px] bg-accent transition-all group-hover:w-full" />
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          <button 
            onClick={onAdminClick}
            className="p-2 md:p-3 hover:bg-white/5 rounded-full transition-colors text-muted hover:text-accent"
          >
            <Settings size={20} />
          </button>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 hover:bg-white/5 rounded-full transition-colors text-muted hover:text-white"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-bg/95 backdrop-blur-xl pt-32 px-8 lg:hidden"
          >
            <div className="flex flex-col gap-12 text-center">
              <button onClick={() => setIsMenuOpen(false)} className="text-2xl font-serif italic font-bold hover:text-accent transition-colors">Colección</button>
              <button onClick={() => setIsMenuOpen(false)} className="text-2xl font-serif italic font-bold hover:text-accent transition-colors">Autores</button>
              <button onClick={() => setIsMenuOpen(false)} className="text-2xl font-serif italic font-bold hover:text-accent transition-colors">Sobre Nosotros</button>
              <div className="h-[1px] w-12 bg-accent/30 mx-auto" />
              <p className="text-[10px] font-mono uppercase tracking-[0.5em] text-muted">© 2026 SAM C. EDITORIAL</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function CatalogView({ 
  onStorySelect,
  onAuthorClick 
}: { 
  onStorySelect: (id: string) => void;
  onAuthorClick: () => void;
  key?: string | number;
}) {
  const [activeFilter, setActiveFilter] = useState<Genre>('Todos');

  // Extract unique genres from all stories
  const allGenres = Array.from(new Set(CATALOG_DATA.flatMap(story => story.genres)));
  const filters: Genre[] = ['Todos', ...allGenres];

  const featuredStory = CATALOG_DATA.find(s => s.isFeatured) || CATALOG_DATA[0];
  const filteredStories = CATALOG_DATA.filter(story => 
    activeFilter === 'Todos' || story.genres.includes(activeFilter)
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen pt-24 md:pt-40 pb-20 md:pb-32 px-6 md:px-8 max-w-[1400px] mx-auto relative"
    >
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-accent/5 blur-[160px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-accent/5 blur-[160px] rounded-full animate-pulse" style={{ animationDelay: '3s' }} />
      </div>

      {/* Hero Section - Featured Story */}
      {featuredStory && (
        <section className="mb-24 md:mb-48">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-20 items-center">
            <div className="lg:col-span-7 relative group">
              <motion.div 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                onClick={() => onStorySelect(featuredStory.id)}
                className="relative aspect-[16/10] overflow-hidden rounded-2xl md:rounded-[3rem] cursor-pointer border border-white/5 group-hover:border-accent/30 transition-all duration-1000 shadow-2xl"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent z-10" />
                {featuredStory.coverUrl ? (
                  <img 
                    src={featuredStory.coverUrl} 
                    className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-[2s] ease-out"
                    alt={featuredStory.title}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                    <BookOpen size={48} className="text-white/20" />
                  </div>
                )}
                <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12 z-20 flex items-center gap-3 md:gap-6">
                  <span className="px-4 py-2 md:px-6 md:py-3 glass rounded-full text-[9px] md:text-[11px] font-mono uppercase tracking-[0.3em] font-bold">Destacado</span>
                  <span className="px-4 py-2 md:px-6 md:py-3 glass rounded-full text-[9px] md:text-[11px] font-mono uppercase tracking-[0.3em] text-accent font-bold">{featuredStory.status}</span>
                </div>
              </motion.div>
              
              {/* Floating Decorative Text */}
              <div className="absolute -right-12 top-1/2 -translate-y-1/2 hidden xl:block pointer-events-none">
                <p className="writing-mode-vertical text-[11px] font-mono text-white/10 uppercase tracking-[0.8em] rotate-180">
                  LITERATURA CONTEMPORÁNEA • 2026
                </p>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-8 md:space-y-12">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="space-y-4 md:space-y-6"
              >
                <div className="flex items-center gap-4">
                  <div className="h-[1px] w-12 md:w-16 bg-accent" />
                  <span className="text-accent font-mono text-[9px] md:text-[11px] uppercase tracking-[0.5em] font-bold">Obra Maestra</span>
                </div>
                <h1 className="text-6xl sm:text-8xl md:text-9xl font-serif italic font-bold tracking-tighter leading-[0.8] text-glow">
                  {featuredStory.title.split(' ')[0]} <br />
                  <span className="text-accent">{featuredStory.title.split(' ').slice(1).join(' ')}</span>
                </h1>
                <p className="text-muted text-lg md:text-xl font-light leading-relaxed max-w-md font-serif italic opacity-80">
                  {featuredStory.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {featuredStory.genres.map(genre => (
                    <span key={genre} className="px-3 py-1 rounded-full border border-white/10 text-[9px] font-mono uppercase tracking-widest text-muted">
                      {genre}
                    </span>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-center gap-6 md:gap-10"
              >
                <button 
                  onClick={() => onStorySelect(featuredStory.id)}
                  className="px-8 py-4 md:px-12 md:py-5 bg-white text-bg font-bold rounded-full hover:bg-accent transition-all duration-500 flex items-center gap-4 group shadow-xl active:scale-95"
                >
                  <span className="text-[10px] md:text-xs uppercase tracking-[0.2em]">Explorar Obra</span>
                  <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                </button>
                {featuredStory.chapters && (
                  <div className="flex flex-col border-l border-white/10 pl-6 md:pl-10">
                    <span className="text-[9px] md:text-[11px] font-mono text-muted uppercase tracking-[0.3em]">Capítulos</span>
                    <span className="text-2xl md:text-3xl font-serif italic font-bold">{featuredStory.chapters}</span>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* Grid Section - Catalog */}
      <section className="mb-24 md:mb-48 space-y-12 md:space-y-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/5 pb-10 gap-8">
          <div className="space-y-4">
            <span className="text-accent font-mono text-[9px] md:text-[11px] uppercase tracking-[0.5em] font-bold">Curaduría</span>
            <h2 className="text-4xl md:text-6xl font-serif italic font-bold tracking-tighter">Catálogo</h2>
          </div>
          <div className="text-[9px] md:text-[11px] font-mono text-muted uppercase tracking-[0.4em] flex flex-wrap items-center gap-4 md:gap-6">
            Filtrar por: 
            {filters.map(filter => (
              <span 
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "cursor-pointer transition-colors pb-1",
                  activeFilter === filter 
                    ? "text-white border-b border-accent" 
                    : "hover:text-white"
                )}
              >
                {filter}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
          {filteredStories.map((story, index) => (
            <motion.div 
              key={story.id}
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onStorySelect(story.id)}
              className="group relative aspect-[3/4] md:aspect-[3/4.5] overflow-hidden rounded-2xl md:rounded-[3rem] cursor-pointer border border-dashed border-white/10 hover:border-accent/40 transition-all duration-1000"
            >
              {story.coverUrl ? (
                <>
                  <div className="absolute inset-0 bg-black/60 z-10 group-hover:bg-black/40 transition-colors duration-700" />
                  <img 
                    src={story.coverUrl} 
                    className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-[2s] ease-out"
                    alt={story.title}
                    referrerPolicy="no-referrer"
                  />
                </>
              ) : (
                <div className="absolute inset-0 bg-black/90 z-10 group-hover:bg-black/80 transition-colors duration-700" />
              )}
              
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 p-8 md:p-12 text-center space-y-6 md:space-y-8">
                {!story.coverUrl && (
                  <div className="w-20 h-20 md:w-28 md:h-28 rounded-full border border-white/5 flex items-center justify-center group-hover:border-accent/40 group-hover:scale-110 transition-all duration-700 relative">
                    <div className="absolute inset-0 bg-accent/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Clock size={28} className="text-muted group-hover:text-accent transition-colors relative z-10" />
                  </div>
                )}
                <div className="space-y-3 md:space-y-4">
                  <span className="text-accent font-mono text-[9px] md:text-[11px] uppercase tracking-[0.4em] font-bold">{story.status}</span>
                  <h3 className="text-5xl md:text-6xl font-serif italic font-bold text-white/20 group-hover:text-white transition-all duration-700 leading-none tracking-tighter">{story.title}</h3>
                  <p className="text-muted/40 text-[9px] md:text-[11px] font-mono uppercase tracking-[0.4em] group-hover:text-muted/80 transition-colors">Por {story.author}</p>
                </div>
                {story.releaseDate && (
                  <div className="pt-4 md:pt-6">
                    <p className="text-[9px] md:text-[11px] font-mono text-accent/60 uppercase tracking-[0.3em] animate-pulse font-bold">{story.releaseDate}</p>
                  </div>
                )}
                <div className="flex flex-wrap justify-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  {story.genres.map(genre => (
                    <span key={genre} className="px-2 py-1 rounded border border-white/20 text-[8px] font-mono uppercase tracking-widest text-white/70">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
              {!story.coverUrl && (
                <div className="absolute inset-0 flex items-center justify-center text-white/[0.01] font-serif text-[15rem] md:text-[30rem] italic leading-none select-none pointer-events-none group-hover:text-white/[0.02] transition-all duration-1000">
                  {story.title.charAt(0)}
                </div>
              )}
            </motion.div>
          ))}

          {/* Future Collaborators Section */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="group relative aspect-[3/4] md:aspect-[3/4.5] overflow-hidden rounded-2xl md:rounded-[3rem] bg-zinc-900/20 border border-white/5 hover:border-accent/30 transition-all duration-1000 p-8 md:p-16 flex flex-col justify-between"
          >
            <div className="space-y-6 md:space-y-8">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-accent/10 rounded-xl md:rounded-2xl text-accent flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <Users size={24} />
              </div>
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-3xl md:text-4xl font-serif italic font-bold text-white">Colaboradores</h3>
                <p className="text-muted text-base md:text-lg leading-relaxed font-light font-serif italic">
                  "Buscamos voces únicas que deseen desafiar los límites de la narrativa convencional."
                </p>
              </div>
            </div>
            <div className="space-y-6 md:space-y-8">
              <div className="flex -space-x-4 md:-space-x-5">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-bg bg-zinc-800 flex items-center justify-center text-[9px] md:text-[11px] font-mono shadow-xl">
                    {i === 1 ? 'C' : i === 2 ? 'S' : i === 3 ? 'A' : '+'}
                  </div>
                ))}
              </div>
              <button className="w-full py-4 md:py-5 glass rounded-full text-[9px] md:text-[11px] font-mono uppercase tracking-[0.3em] hover:bg-white/5 transition-all duration-500 hover:text-accent">
                Unirse al Colectivo
              </button>
            </div>
          </motion.div>

          {/* Iconic Characters Section */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="group relative aspect-[3/4] md:aspect-[3/4.5] overflow-hidden rounded-2xl md:rounded-[3rem] bg-zinc-900/20 border border-white/5 hover:border-accent/30 transition-all duration-1000 p-8 md:p-16 flex flex-col justify-between"
          >
            <div className="space-y-6 md:space-y-8">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-accent/10 rounded-xl md:rounded-2xl text-accent flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <Star size={24} />
              </div>
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-3xl md:text-4xl font-serif italic font-bold text-white">Personajes</h3>
                <p className="text-muted text-base md:text-lg leading-relaxed font-light font-serif italic">
                  "Explora los secretos y perfiles de las figuras más icónicas de nuestras historias."
                </p>
              </div>
            </div>
            <div className="relative glass p-6 md:p-8 rounded-2xl md:rounded-3xl border-dashed border-white/10 text-center group-hover:border-accent/40 transition-colors">
              <span className="text-[9px] md:text-[11px] font-mono uppercase tracking-[0.4em] text-accent animate-pulse font-bold">Muy Pronto</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Catalog Footer */}
      <footer className="pt-20 md:pt-32 border-t border-white/5 flex flex-col lg:flex-row justify-between items-start gap-16 md:gap-20">
        <div className="space-y-6 md:space-y-8 max-w-md">
          <div className="flex flex-col">
            <span className="text-3xl md:text-4xl font-serif italic font-bold tracking-tighter leading-none">SAM C.</span>
            <span className="text-[9px] md:text-[10px] font-mono uppercase tracking-[0.6em] text-accent font-bold">Editorial</span>
          </div>
          <p className="text-sm font-serif italic text-muted leading-relaxed opacity-70">
            "Dedicados a la excelencia narrativa y la innovación visual. Creando puentes entre la imaginación y la realidad a través de la palabra escrita."
          </p>
          <div className="flex gap-4 md:gap-6">
            <button className="p-3 md:p-4 glass rounded-full hover:text-accent transition-all duration-500 hover:scale-110"><Share2 size={18} /></button>
            <button className="p-3 md:p-4 glass rounded-full hover:text-accent transition-all duration-500 hover:scale-110"><Heart size={18} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 md:gap-20 w-full lg:w-auto">
          <div className="space-y-4 md:space-y-6">
            <span className="text-white font-mono text-[10px] md:text-[11px] uppercase tracking-[0.4em] font-bold">Explorar</span>
            <div className="flex flex-col gap-3 md:gap-4 text-[9px] md:text-[11px] font-mono uppercase tracking-[0.3em] text-muted">
              <button className="hover:text-accent transition-colors text-left">Catálogo</button>
              <button className="hover:text-accent transition-colors text-left">Autores</button>
              <button className="hover:text-accent transition-colors text-left">Novedades</button>
            </div>
          </div>
          <div className="space-y-4 md:space-y-6">
            <span className="text-white font-mono text-[10px] md:text-[11px] uppercase tracking-[0.4em] font-bold">Legal</span>
            <div className="flex flex-col gap-3 md:gap-4 text-[9px] md:text-[11px] font-mono uppercase tracking-[0.3em] text-muted">
              <button className="hover:text-accent transition-colors text-left">Privacidad</button>
              <button className="hover:text-accent transition-colors text-left">Términos</button>
              <button className="hover:text-accent transition-colors text-left">Cookies</button>
            </div>
          </div>
          <div className="space-y-4 md:space-y-6">
            <span className="text-white font-mono text-[10px] md:text-[11px] uppercase tracking-[0.4em] font-bold">Social</span>
            <div className="flex flex-col gap-3 md:gap-4 text-[9px] md:text-[11px] font-mono uppercase tracking-[0.3em] text-muted">
              <button className="hover:text-accent transition-colors text-left">Instagram</button>
              <button className="hover:text-accent transition-colors text-left">Twitter</button>
              <button className="hover:text-accent transition-colors text-left">LinkedIn</button>
            </div>
          </div>
        </div>
      </footer>
      
      <div className="mt-20 md:mt-32 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
        <p className="text-[8px] md:text-[10px] font-mono text-muted/30 tracking-[0.5em] uppercase text-center md:text-left">
          © 2026 SAM C. EDITORIAL • TODOS LOS DERECHOS RESERVADOS
        </p>
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[8px] md:text-[10px] font-mono text-accent uppercase tracking-widest">En Línea</span>
        </div>
      </div>
    </motion.div>
  );
}

function HomeView({ 
  storyId,
  onChapterClick, 
  bookmarks,
  chapters,
  onAuthorClick,
  isAdmin,
  onAuthorMessageClick,
  onBack
}: { 
  storyId: string;
  onChapterClick: (c: Chapter) => void; 
  bookmarks: Record<number, number>;
  chapters: Chapter[];
  onAuthorClick: () => void;
  isAdmin: boolean;
  onAuthorMessageClick?: () => void;
  onBack: () => void;
  key?: string | number;
}) {
  const storyInfo = CATALOG_DATA.find(s => s.id === storyId);
  const lastBookmarkedId = Object.keys(bookmarks).map(Number).sort((a, b) => b - a)[0];
  const lastChapter = chapters.find(c => c.id === lastBookmarkedId);

  if (!storyInfo) return null;

  if (storyInfo.status !== 'Disponible') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-16 pt-32 relative overflow-hidden"
      >
        {/* Atmospheric Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-accent/5 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-white/5 blur-[100px] rounded-full animate-pulse delay-700" />
        </div>

        <div className="space-y-12 relative z-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-48 h-48 bg-accent/5 rounded-full flex items-center justify-center mx-auto text-accent border border-accent/10 relative group"
          >
            <div className="absolute inset-0 bg-accent/10 blur-3xl rounded-full group-hover:bg-accent/20 transition-colors duration-1000" />
            <Clock size={72} className="relative z-10 animate-pulse" />
          </motion.div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
              <div className="h-[1px] w-12 bg-accent/30" />
              <span className="text-accent font-mono text-[10px] tracking-[0.5em] uppercase font-bold">{storyInfo.status}</span>
              <div className="h-[1px] w-12 bg-accent/30" />
            </div>
            <h1 className="text-7xl md:text-[10rem] font-serif italic font-bold tracking-tighter leading-none">{storyInfo.title}</h1>
            <p className="text-muted font-mono uppercase tracking-[0.5em] text-xs">Una Obra de {storyInfo.author}</p>
          </div>
        </div>

        <div className="max-w-2xl glass p-16 rounded-[4rem] border-accent/10 space-y-10 relative overflow-hidden group hover:border-accent/30 transition-colors duration-700">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
          <div className="space-y-6">
            <h3 className="text-3xl font-serif italic font-bold">En Construcción Editorial</h3>
            <p className="text-muted leading-relaxed text-xl font-light">
              Estamos curando meticulosamente cada palabra de este nuevo universo. {storyInfo.releaseDate && <span className="text-accent font-bold">{storyInfo.releaseDate}</span>}
            </p>
          </div>
          <div className="pt-6">
            <button 
              onClick={onBack}
              className="px-16 py-5 bg-white text-bg font-bold rounded-full hover:bg-accent hover:scale-105 transition-all duration-500 uppercase tracking-[0.2em] text-[10px]"
            >
              Volver al Catálogo
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto px-6 pt-24 md:pt-40 pb-20 md:pb-32"
    >
      {/* Hero Section - Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-24 items-start mb-24 md:mb-48">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="lg:col-span-5 relative order-2 lg:order-1"
        >
          <div className="absolute -inset-6 md:-inset-12 bg-accent/5 blur-[80px] md:blur-[120px] rounded-full pointer-events-none" />
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-b from-accent/20 to-transparent rounded-2xl md:rounded-3xl blur opacity-0 group-hover:opacity-100 transition duration-1000" />
            {storyInfo.coverUrl ? (
              <img 
                src={storyInfo.coverUrl} 
                alt={`${storyInfo.title} Portada`} 
                className="w-full aspect-[3/4.5] object-cover rounded-2xl md:rounded-3xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.9)] md:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.9)] relative z-10 border border-white/5 group-hover:scale-[1.01] transition-transform duration-1000"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full aspect-[3/4.5] bg-zinc-900 rounded-2xl md:rounded-3xl flex items-center justify-center border border-white/5 relative z-10">
                <BookOpen size={64} className="text-white/20" />
              </div>
            )}
          </div>
          
          {/* Floating Stats */}
          <div className="absolute -bottom-6 -right-6 md:-bottom-12 md:-right-12 glass p-4 md:p-8 rounded-2xl md:rounded-3xl border-white/10 z-20 hidden sm:block animate-float">
            <div className="space-y-2 md:space-y-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  <BookOpen size={16} md:size={18} />
                </div>
                <div>
                  <p className="text-[8px] md:text-[10px] font-mono text-muted uppercase tracking-widest">Volumen</p>
                  <p className="text-sm md:text-lg font-serif italic font-bold">Completo</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="lg:col-span-7 space-y-8 md:space-y-12 pt-0 lg:pt-12 order-1 lg:order-2"
        >
          <div className="space-y-6 md:space-y-8">
            <div className="flex items-center gap-4">
              <div className="h-[1px] w-12 md:w-16 bg-accent" />
              <span className="text-accent font-mono text-[9px] md:text-[10px] uppercase tracking-[0.5em] font-bold">Colección Original</span>
            </div>
            <h1 className="text-6xl sm:text-8xl md:text-[10rem] font-serif font-bold tracking-tighter leading-[0.85]">
              <ShinyText 
                text={storyInfo.title} 
                speed={1.6} 
                color="#ffffff" 
                shineColor="#f27d26" 
                spread={120}
              />
            </h1>
            <div className="flex flex-wrap items-center gap-4 md:gap-6 text-muted font-mono text-[9px] md:text-[11px] uppercase tracking-[0.3em]">
              <span>Escrito por {storyInfo.author}</span>
              <div className="w-1 h-1 rounded-full bg-accent hidden sm:block" />
              <span>{storyInfo.genres.join(' • ')}</span>
            </div>
            <p className="text-muted/80 text-xl md:text-2xl leading-relaxed font-light max-w-2xl font-serif italic">
              {storyInfo.description}
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-6 md:gap-12 border-y border-white/5 py-8 md:py-10">
            <div className="space-y-1 md:space-y-2">
              <span className="text-white/40 font-mono text-[8px] md:text-[9px] uppercase tracking-[0.4em]">Capítulos</span>
              <p className="text-xl md:text-3xl font-serif italic font-bold">{storyInfo.chapters || chapters.length}</p>
            </div>
            <div className="space-y-1 md:space-y-2">
              <span className="text-white/40 font-mono text-[8px] md:text-[9px] uppercase tracking-[0.4em]">Lectores</span>
              <p className="text-xl md:text-3xl font-serif italic font-bold">1.2k+</p>
            </div>
            <div className="space-y-1 md:space-y-2">
              <span className="text-white/40 font-mono text-[8px] md:text-[9px] uppercase tracking-[0.4em]">Calificación</span>
              <p className="text-xl md:text-3xl font-serif italic font-bold">4.9/5</p>
            </div>
          </div>

          <div className="pt-4 md:pt-8 flex flex-wrap gap-4 md:gap-6">
            <button 
              onClick={() => {
                if (storyId === 'el-acto' && chapters.length > 0) {
                  onChapterClick(chapters[0]);
                } else {
                  alert('Los capítulos de esta obra estarán disponibles próximamente.');
                }
              }}
              className="flex-1 sm:flex-none px-8 py-5 md:px-16 md:py-6 bg-white text-bg font-bold rounded-full hover:bg-accent hover:scale-105 transition-all duration-500 flex items-center justify-center gap-4 group uppercase tracking-[0.2em] text-[9px] md:text-[10px]"
            >
              {lastChapter && storyId === 'el-acto' ? 'Reiniciar Lectura' : 'Comenzar Experiencia'}
              <ArrowRight size={16} md:size={18} className="group-hover:translate-x-2 transition-transform duration-500" />
            </button>
            
            {lastChapter && storyId === 'el-acto' && (
              <button 
                onClick={() => onChapterClick(lastChapter)}
                className="flex-1 sm:flex-none px-8 py-5 md:px-16 md:py-6 glass text-white font-bold rounded-full hover:bg-white/10 hover:scale-105 transition-all duration-500 flex items-center justify-center gap-4 group uppercase tracking-[0.2em] text-[9px] md:text-[10px]"
              >
                Continuar Cap. {lastChapter.id}
                <Bookmark size={16} md:size={18} className="text-accent group-hover:scale-125 transition-transform duration-500" />
              </button>
            )}

            <button className="p-5 md:p-6 glass rounded-full hover:bg-white/10 hover:scale-110 transition-all duration-500 text-muted hover:text-white">
              <Share2 size={20} md:size={22} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Chapter List - Table of Contents Style */}
      {storyId === 'el-acto' ? (
        <div className="space-y-12 md:space-y-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8 border-b border-white/5 pb-8 md:pb-12">
            <div className="space-y-3 md:space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-accent" />
                <span className="text-accent font-mono text-[9px] md:text-[10px] uppercase tracking-[0.5em] font-bold">Estructura</span>
              </div>
              <h2 className="text-4xl md:text-7xl font-serif italic font-bold tracking-tighter">Tabla de Contenidos</h2>
            </div>
            <p className="text-muted font-mono text-[9px] md:text-[10px] uppercase tracking-[0.4em] max-w-xs text-left md:text-right">
              Cada capítulo es una pieza del rompecabezas emocional que conforma esta obra.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 md:gap-x-20 gap-y-4 md:gap-y-8">
            {chapters.map((chapter, index) => (
              <motion.div
                key={chapter.id}
                initial={{ opacity: 0, x: index % 2 === 0 ? -10 : 10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * (index % 5) }}
                onClick={() => !chapter.isLocked && onChapterClick(chapter)}
                className={cn(
                  "group flex items-center justify-between py-6 md:py-8 border-b border-white/5 transition-all duration-700",
                  chapter.isLocked 
                    ? "opacity-40 cursor-not-allowed" 
                    : "cursor-pointer hover:border-accent/40"
                )}
              >
                <div className="flex items-center gap-6 md:gap-12">
                  <span className="font-mono text-[10px] md:text-xs text-muted/40 group-hover:text-accent transition-colors duration-500 tracking-[0.3em]">
                    {String(chapter.id).padStart(2, '0')}
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-xl md:text-2xl font-serif italic font-bold group-hover:text-white transition-colors duration-500">
                      {chapter.title}
                    </h3>
                    <p className="text-[8px] md:text-[10px] font-mono text-muted/30 uppercase tracking-widest group-hover:text-muted/60 transition-colors duration-500">
                      {chapter.isLocked ? 'Contenido Restringido' : 'Lectura Disponible'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 md:gap-6">
                  {chapter.isLocked ? (
                    <Lock size={16} md:size={18} className="text-muted/30" />
                  ) : (
                    <div className="flex items-center gap-3 md:gap-4 opacity-0 group-hover:opacity-100 transition-all duration-700 transform translate-x-4 md:translate-x-8 group-hover:translate-x-0">
                      <span className="text-[8px] md:text-[10px] font-mono uppercase tracking-[0.3em] text-accent font-bold hidden sm:block">Explorar</span>
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-accent/30 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-bg transition-all duration-500">
                        <ArrowRight size={14} md:size={16} />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-12 md:space-y-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8 border-b border-white/5 pb-8 md:pb-12">
            <div className="space-y-3 md:space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-accent" />
                <span className="text-accent font-mono text-[9px] md:text-[10px] uppercase tracking-[0.5em] font-bold">Estructura</span>
              </div>
              <h2 className="text-4xl md:text-7xl font-serif italic font-bold tracking-tighter">Tabla de Contenidos</h2>
            </div>
          </div>
          <div className="glass p-12 md:p-20 rounded-3xl text-center space-y-6 border-dashed border-white/10">
            <BookOpen size={48} className="mx-auto text-white/20" />
            <h3 className="text-2xl font-serif italic font-bold text-white/60">Capítulos en Desarrollo</h3>
            <p className="text-muted font-mono text-[10px] uppercase tracking-widest max-w-md mx-auto">
              El autor está trabajando en los capítulos de esta obra. Vuelve pronto para descubrir más.
            </p>
          </div>
        </div>
      )}

      {/* Author Note Section */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-24 md:mt-48 glass p-8 md:p-20 rounded-[2rem] md:rounded-[4rem] border-white/5 relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-64 h-64 md:w-96 md:h-96 bg-accent/5 blur-[80px] md:blur-[120px] rounded-full -mr-32 -mt-32 md:-mr-48 md:-mt-48 group-hover:bg-accent/10 transition-colors duration-1000" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 items-center relative z-10">
          <div className="space-y-6 md:space-y-8">
            <div className="flex items-center gap-4">
              <div className="h-[1px] w-12 bg-accent" />
              <span className="text-accent font-mono text-[9px] md:text-[10px] uppercase tracking-[0.5em] font-bold">Nota del Autor</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-serif italic font-bold tracking-tighter leading-tight">
              Un mensaje de {storyInfo.author} para sus lectores.
            </h2>
            <p className="text-muted text-lg md:text-xl leading-relaxed font-light italic">
              "Esta obra nació de la necesidad de cuestionar qué estamos dispuestos a sacrificar por nuestra pasión. Espero que encuentren en estas líneas un reflejo de sus propias búsquedas."
            </p>
            <button 
              onClick={() => onAuthorMessageClick?.()}
              className="w-full sm:w-auto px-10 py-5 border border-white/10 rounded-full hover:bg-white/5 transition-all duration-500 flex items-center justify-center gap-4 group uppercase tracking-[0.2em] text-[9px] md:text-[10px] font-bold"
            >
              Leer Mensaje Completo
              <MessageSquare size={16} md:size={18} className="text-accent" />
            </button>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-2xl md:rounded-3xl overflow-hidden border border-white/10 grayscale hover:grayscale-0 transition-all duration-1000">
              <img 
                src={`https://picsum.photos/seed/${storyInfo.author.replace(/\s+/g, '')}/800/800`} 
                alt={storyInfo.author}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -bottom-4 -left-4 md:-bottom-8 -left-8 glass p-4 md:p-8 rounded-xl md:rounded-2xl border-white/10">
              <p className="text-xl md:text-2xl font-serif italic font-bold">{storyInfo.author}</p>
              <p className="text-[8px] md:text-[10px] font-mono text-muted uppercase tracking-widest">Autor</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="mt-24 md:mt-48 pt-12 md:pt-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-10 md:gap-12">
        <div className="flex flex-wrap justify-center gap-8 md:gap-12 text-[8px] md:text-[10px] font-mono uppercase tracking-[0.4em] text-muted/40">
          <button className="hover:text-accent transition-colors duration-500">Compartir</button>
          <button className="hover:text-accent transition-colors duration-500">Favoritos</button>
          <button className="hover:text-accent transition-colors duration-500">Reportar</button>
        </div>
        <div className="flex items-center gap-6 md:gap-8">
          <div className="flex gap-4 md:gap-6">
            <button className="text-muted/40 hover:text-white transition-colors duration-500"><Share2 size={16} md:size={18} /></button>
            <button className="text-muted/40 hover:text-white transition-colors duration-500"><Heart size={16} md:size={18} /></button>
          </div>
          <p className="text-[8px] md:text-[10px] font-mono text-muted/20 tracking-[0.5em] uppercase">
            © 2026 SAM C. EDITORIAL
          </p>
        </div>
      </footer>
    </motion.div>
  );
}

function AdminView({ 
  chapters, 
  onBack 
}: { 
  chapters: Chapter[]; 
  onBack: () => void;
  key?: string | number;
}) {
  const [editingChapter, setEditingChapter] = useState<(Chapter & { docId: string }) | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ id: 0, title: '', content: '', isLocked: true });
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = (chapter: Chapter & { docId: string }) => {
    setEditingChapter(chapter);
    setFormData({ id: chapter.id, title: chapter.title, content: chapter.content || '', isLocked: chapter.isLocked });
    setIsAdding(false);
  };

  const handleAddNew = () => {
    const nextId = chapters.length > 0 ? Math.max(...chapters.map(c => c.id)) + 1 : 1;
    setFormData({ id: nextId, title: '', content: '', isLocked: true });
    setIsAdding(true);
    setEditingChapter(null);
  };

  const [isPreview, setIsPreview] = useState(false);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      if (editingChapter) {
        await updateDoc(doc(db, 'chapters', editingChapter.docId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(doc(db, 'chapters', `chapter-${formData.id}`), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      if (isAdding) {
        setIsAdding(false);
      }
    } catch (error) {
      console.error("Error saving chapter:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formData.content);
  };

  const wordCount = formData.content.trim() ? formData.content.trim().split(/\s+/).length : 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleDelete = async (docId: string) => {
    if (confirm("¿Estás seguro de eliminar este capítulo?")) {
      await deleteDoc(doc(db, 'chapters', docId));
    }
  };

  const toggleLock = async (chapter: Chapter & { docId: string }) => {
    await updateDoc(doc(db, 'chapters', chapter.docId), {
      isLocked: !chapter.isLocked,
      updatedAt: serverTimestamp()
    });
  };

  const handleLogout = () => {
    signOut(auth).then(onBack);
  };

  const handleReset = async () => {
    if (confirm("¿Estás seguro de reiniciar todos los capítulos? Esto borrará los cambios actuales y restaurará los 27 capítulos bloqueados.")) {
      setIsSaving(true);
      try {
        for (const c of chapters) {
          await deleteDoc(doc(db, 'chapters', (c as any).docId));
        }
        for (const c of INITIAL_CHAPTERS) {
          await setDoc(doc(db, 'chapters', `chapter-${c.id}`), {
            ...c,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
        alert("Capítulos reiniciados con éxito.");
      } catch (error) {
        console.error("Error resetting chapters:", error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto px-6 pt-40 pb-24"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 border-b border-white/5 pb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-accent" size={20} />
            <span className="text-accent font-mono text-[10px] uppercase tracking-[0.5em] font-bold">Terminal de Gestión</span>
          </div>
          <h1 className="text-6xl font-serif italic font-bold tracking-tighter">Panel Editorial</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleReset}
            disabled={isSaving}
            className="px-8 py-3 glass text-muted font-mono text-[10px] uppercase tracking-widest rounded-full hover:bg-white/5 transition-all disabled:opacity-50 flex items-center gap-3"
          >
            <RotateCcw size={14} className={isSaving ? "animate-spin" : ""} /> Reiniciar Sistema
          </button>
          <button 
            onClick={handleAddNew}
            className="px-8 py-3 bg-white text-bg font-bold rounded-full flex items-center gap-3 hover:bg-accent transition-all duration-500 uppercase tracking-widest text-[10px]"
          >
            <Plus size={16} /> Nuevo Capítulo
          </button>
          <button 
            onClick={handleLogout}
            className="p-3 glass rounded-full text-red-400/60 hover:text-red-400 hover:bg-red-400/5 transition-all duration-500"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Sidebar List */}
        <div className="lg:col-span-4 space-y-4 h-[75vh] overflow-y-auto pr-4 custom-scrollbar">
          <div className="sticky top-0 bg-bg/80 backdrop-blur-md z-10 pb-4 mb-4 border-b border-white/5">
            <p className="text-[9px] font-mono text-muted/40 uppercase tracking-[0.4em]">Índice de Manuscritos ({chapters.length})</p>
          </div>
          {chapters.map(chapter => (
            <motion.div 
              key={chapter.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "p-6 glass rounded-2xl border transition-all duration-500 cursor-pointer group relative overflow-hidden",
                editingChapter?.id === chapter.id ? "border-accent bg-accent/5" : "border-white/5 hover:border-white/20"
              )}
              onClick={() => handleEdit(chapter as Chapter & { docId: string })}
            >
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-6">
                  <span className="font-mono text-[10px] text-muted/30 group-hover:text-accent transition-colors">
                    {String(chapter.id).padStart(2, '0')}
                  </span>
                  <span className="font-serif italic text-lg truncate max-w-[180px] group-hover:text-white transition-colors">
                    {chapter.title}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleLock(chapter as Chapter & { docId: string }); }}
                    className={cn(
                      "p-2 rounded-lg transition-all duration-500", 
                      chapter.isLocked ? "text-muted/30 hover:text-muted" : "text-accent bg-accent/10"
                    )}
                  >
                    {chapter.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete((chapter as any).docId); }}
                    className="p-2 text-muted/20 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all duration-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {editingChapter?.id === chapter.id && (
                <div className="absolute left-0 top-0 w-1 h-full bg-accent" />
              )}
            </motion.div>
          ))}
        </div>

        {/* Editor Area */}
        <div className="lg:col-span-8">
          {(editingChapter || isAdding) ? (
            <motion.form 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              onSubmit={handleSave}
              className="glass p-12 rounded-[3rem] border-white/10 space-y-10 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-3xl font-serif italic font-bold flex items-center gap-4">
                    {isAdding ? 'Nuevo Manuscrito' : `Editando Capítulo ${formData.id}`}
                  </h2>
                  <p className="text-[10px] font-mono text-muted/40 uppercase tracking-widest">
                    {isAdding ? 'Creando entrada en el catálogo' : 'Modificando registro existente'}
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => { setEditingChapter(null); setIsAdding(false); }}
                  className="p-3 glass rounded-full text-muted hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-2 space-y-3">
                  <label className="text-[9px] font-mono text-muted/60 uppercase tracking-[0.3em] ml-2">ID</label>
                  <input 
                    type="number" 
                    value={formData.id}
                    onChange={e => setFormData({...formData, id: parseInt(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-accent outline-none font-mono text-sm transition-all"
                    required
                  />
                </div>
                <div className="md:col-span-10 space-y-3">
                  <label className="text-[9px] font-mono text-muted/60 uppercase tracking-[0.3em] ml-2">Título de la Obra</label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:border-accent outline-none font-serif italic text-xl transition-all"
                    placeholder="Escribe el título aquí..."
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-6">
                    <label className="text-[9px] font-mono text-muted/60 uppercase tracking-[0.3em]">Cuerpo del Manuscrito</label>
                    <div className="flex glass rounded-full p-1">
                      <button 
                        type="button"
                        onClick={() => setIsPreview(false)}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all duration-500",
                          !isPreview ? "bg-white text-bg font-bold" : "text-muted hover:text-white"
                        )}
                      >
                        Editor
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsPreview(true)}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-[9px] font-mono uppercase tracking-widest transition-all duration-500",
                          isPreview ? "bg-white text-bg font-bold" : "text-muted hover:text-white"
                        )}
                      >
                        Vista Previa
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-[10px] font-mono text-muted/30 uppercase tracking-widest">{wordCount} palabras</span>
                    <button 
                      type="button"
                      onClick={handleCopy}
                      className="text-accent hover:text-white transition-colors"
                      title="Copiar Contenido"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="relative group">
                  {isPreview ? (
                    <div className="w-full min-h-[500px] max-h-[60vh] bg-white/[0.02] border border-white/5 rounded-[2rem] px-12 py-12 overflow-y-auto font-serif text-xl leading-relaxed text-white/70 custom-scrollbar">
                      {formData.content.split(/\n\s*\n/).map((para, i) => (
                        <p key={i} className="mb-8 first-letter:text-4xl first-letter:text-accent first-letter:mr-2 first-letter:font-bold">
                          {para}
                        </p>
                      ))}
                      {formData.content === '' && (
                        <div className="h-full flex flex-col items-center justify-center text-muted/20 py-20">
                          <FileText size={48} className="mb-4" />
                          <p className="italic">El manuscrito está vacío...</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <textarea 
                      value={formData.content}
                      onChange={e => setFormData({...formData, content: e.target.value})}
                      onKeyDown={handleKeyDown}
                      className="w-full min-h-[500px] max-h-[60vh] bg-white/[0.02] border border-white/5 rounded-[2rem] px-10 py-10 focus:border-accent/30 outline-none resize-none font-serif text-xl leading-relaxed text-white/80 custom-scrollbar transition-all duration-700"
                      placeholder="Comienza a tejer la historia aquí..."
                      required
                    />
                  )}
                  <div className="absolute bottom-6 right-8 pointer-events-none">
                    <p className="text-[9px] font-mono text-muted/20 uppercase tracking-[0.4em]">Modo Editorial Activo</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-6">
                <div className="flex items-center gap-8">
                  <label className="flex items-center gap-4 cursor-pointer group">
                    <div 
                      onClick={() => setFormData({...formData, isLocked: !formData.isLocked})}
                      className={cn(
                        "w-14 h-7 rounded-full transition-all duration-500 relative border border-white/10",
                        formData.isLocked ? "bg-white/5" : "bg-accent"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-5 h-5 rounded-full transition-all duration-500 shadow-lg",
                        formData.isLocked ? "left-1 bg-muted/40" : "left-8 bg-white"
                      )} />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold text-muted group-hover:text-white transition-colors">
                      {formData.isLocked ? 'Acceso Restringido' : 'Publicación Abierta'}
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-6">
                  <p className="text-[9px] font-mono text-muted/30 uppercase tracking-widest hidden md:block">Presiona Ctrl+S para guardar</p>
                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="px-12 py-5 bg-white text-bg font-bold rounded-full flex items-center gap-4 hover:bg-accent hover:scale-105 transition-all duration-500 uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-white/5"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    {isAdding ? 'Publicar Obra' : 'Sincronizar Cambios'}
                  </button>
                </div>
              </div>
            </motion.form>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-24 glass rounded-[4rem] border-dashed border-white/5 group">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center text-muted/20 mb-8 group-hover:scale-110 group-hover:bg-accent/5 group-hover:text-accent/40 transition-all duration-1000">
                <Edit3 size={48} />
              </div>
              <h3 className="text-3xl font-serif italic font-bold text-muted/40">Selecciona un Manuscrito</h3>
              <p className="text-[10px] font-mono text-muted/20 uppercase tracking-[0.5em] mt-4">
                Listo para la edición y curaduría de contenido.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}


function ReadingView({ 
  chapter, 
  onBack, 
  onSaveBookmark,
  currentBookmark,
  onFinish,
  isLastChapter
}: { 
  chapter: Chapter; 
  onBack: () => void; 
  onSaveBookmark: (id: number, pos: number) => void;
  currentBookmark?: number;
  onFinish?: () => void;
  isLastChapter?: boolean;
  key?: string | number;
}) {
  const [progress, setProgress] = useState(0);
  const [showBookmarkToast, setShowBookmarkToast] = useState(false);

  const handleBookmark = () => {
    onSaveBookmark(chapter.id, window.scrollY);
    setShowBookmarkToast(true);
    setTimeout(() => setShowBookmarkToast(false), 2000);
  };

  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const currentProgress = (window.scrollY / totalHeight) * 100;
      setProgress(currentProgress);
    };

    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      onSaveBookmark(chapter.id, window.scrollY);
    };
  }, [chapter.id, onSaveBookmark]);

  const handleBack = () => {
    onSaveBookmark(chapter.id, window.scrollY);
    onBack();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-bg relative"
    >
      {/* Progress Bar - Minimalist */}
      <div className="fixed top-0 left-0 w-full h-[2px] bg-white/5 z-[100]">
        <motion.div 
          className="h-full bg-accent shadow-[0_0_10px_rgba(242,125,38,0.5)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Floating Navigation - Glassmorphism */}
      <nav className="fixed top-6 md:top-12 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 md:px-6 flex justify-between items-center z-[90] pointer-events-none">
        <motion.button 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          onClick={handleBack}
          className="p-3 md:p-4 glass rounded-full hover:bg-white/10 transition-all duration-500 pointer-events-auto group border-white/5"
        >
          <ChevronLeft size={18} className="md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform" />
        </motion.button>
        
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex gap-2 md:gap-4 pointer-events-auto"
        >
          <button 
            onClick={handleBookmark}
            className={cn(
              "p-3 md:p-4 glass rounded-full transition-all duration-500 border-white/5",
              currentBookmark !== undefined ? "text-accent border-accent/30" : "hover:bg-white/10"
            )}
          >
            {currentBookmark !== undefined ? <BookmarkCheck size={18} className="md:w-5 md:h-5" /> : <Bookmark size={18} className="md:w-5 md:h-5" />}
          </button>
          <button className="p-3 md:p-4 glass rounded-full hover:bg-white/10 transition-all duration-500 border-white/5">
            <Heart size={18} className="md:w-5 md:h-5" />
          </button>
          <button className="p-3 md:p-4 glass rounded-full hover:bg-white/10 transition-all duration-500 border-white/5">
            <Share2 size={18} className="md:w-5 md:h-5" />
          </button>
        </motion.div>
      </nav>

      {/* Bookmark Toast */}
      <AnimatePresence>
        {showBookmarkToast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            className="fixed bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 z-[110] px-6 md:px-10 py-3 md:py-4 bg-white text-bg rounded-full font-mono text-[8px] md:text-[10px] uppercase tracking-[0.3em] font-bold shadow-2xl"
          >
            Progreso Sincronizado
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <article className="max-w-3xl mx-auto px-6 md:px-8 pt-32 md:pt-48 pb-40 md:pb-64">
        <header className="space-y-8 md:space-y-12 text-center mb-20 md:mb-32">
          <div className="flex items-center justify-center gap-4">
            <div className="h-[1px] w-8 md:w-12 bg-accent/30" />
            <span className="text-accent font-mono text-[9px] md:text-[10px] tracking-[0.5em] uppercase font-bold">Capítulo {String(chapter.id).padStart(2, '0')}</span>
            <div className="h-[1px] w-8 md:w-12 bg-accent/30" />
          </div>
          
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-serif font-bold tracking-tighter leading-none">
            <ShinyText 
              text={chapter.title} 
              speed={2} 
              color="#ffffff" 
              shineColor="#f27d26" 
              spread={120}
            />
          </h1>
          
          <div className="flex items-center justify-center gap-4 md:gap-8 pt-4 md:pt-8">
            <div className="flex flex-col items-center gap-1 md:gap-2">
              <span className="text-[8px] md:text-[9px] font-mono text-muted/30 uppercase tracking-widest">Tiempo Est.</span>
              <span className="text-xs md:text-sm font-serif italic">8 min</span>
            </div>
            <div className="w-[1px] h-6 md:h-8 bg-white/5" />
            <div className="flex flex-col items-center gap-1 md:gap-2">
              <span className="text-[8px] md:text-[9px] font-mono text-muted/30 uppercase tracking-widest">Palabras</span>
              <span className="text-xs md:text-sm font-serif italic">{chapter.content?.split(/\s+/).length}</span>
            </div>
          </div>
        </header>

        <div className="space-y-8 md:space-y-12">
          {chapter.content?.split(/\n\s*\n/).map((para, i) => (
            <motion.p 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="text-lg md:text-2xl leading-[1.8] font-light text-white/80 font-serif selection:bg-accent/30 selection:text-white"
            >
              {i === 0 ? (
                <>
                  <span className="text-5xl md:text-7xl font-bold text-accent float-left mr-3 md:mr-4 mt-1 md:mt-2 leading-[0.8] font-serif">
                    {para.charAt(0)}
                  </span>
                  {para.slice(1)}
                </>
              ) : para}
            </motion.p>
          ))}
        </div>

        <footer className="mt-32 md:mt-48 pt-16 md:pt-24 border-t border-white/5 text-center space-y-12 md:space-y-16">
          <div className="space-y-4">
            <p className="text-muted font-serif italic text-xl md:text-2xl">Fin del Capítulo {chapter.id}</p>
            <div className="w-12 md:w-16 h-[1px] bg-accent/30 mx-auto" />
          </div>
          
          <div className="flex flex-col items-center gap-6 md:gap-8">
            {isLastChapter ? (
              <button 
                onClick={onFinish}
                className="w-full md:w-auto px-12 md:px-20 py-5 md:py-6 bg-white text-bg rounded-full hover:bg-accent hover:scale-105 transition-all duration-500 font-bold uppercase tracking-[0.2em] text-[9px] md:text-[10px] shadow-2xl shadow-white/5"
              >
                Finalizar Obra
              </button>
            ) : (
              <button 
                onClick={handleBack}
                className="w-full md:w-auto px-12 md:px-20 py-5 md:py-6 glass rounded-full hover:bg-white/10 hover:scale-105 transition-all duration-500 font-bold uppercase tracking-[0.2em] text-[9px] md:text-[10px] border-white/5"
              >
                Volver al Índice
              </button>
            )}
          </div>

          <div className="pt-16 md:pt-24 space-y-4">
            <p className="text-[8px] md:text-[9px] font-mono text-muted/20 tracking-[0.5em] uppercase">
              © 2026 SAM C. EDITORIAL • TODOS LOS DERECHOS RESERVADOS
            </p>
            <div className="flex justify-center gap-6 md:gap-8 text-muted/20">
              <Share2 size={14} className="md:w-4 md:h-4" />
              <Heart size={14} className="md:w-4 md:h-4" />
              <Bookmark size={14} className="md:w-4 md:h-4" />
            </div>
          </div>
        </footer>
      </article>

      {/* Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-accent/[0.02] blur-[150px] rounded-full -mr-96 -mt-96" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-white/[0.01] blur-[120px] rounded-full -ml-48 -mb-48" />
      </div>
    </motion.div>
  );
}

