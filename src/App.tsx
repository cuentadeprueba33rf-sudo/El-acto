import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  FileText,
  BadgeCheck
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
  const [stories, setStories] = useState<StoryInfo[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookmarks, setBookmarks] = useState<Record<number, number>>({});
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('app-dark-mode');
    return saved ? JSON.parse(saved) : true; // Default to dark mode for "professional" feel
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    localStorage.setItem('app-dark-mode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);
  const [isBlurred, setIsBlurred] = useState(false);
  const [showSecurityWarning, setShowSecurityWarning] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [newChapterNotify, setNewChapterNotify] = useState<Chapter | null>(null);
  const [notifyProgress, setNotifyProgress] = useState(100);

  const NOTIFY_DURATION = 8000; // 8 seconds

  const ADMIN_EMAIL = "samuelcasseresbx@gmail.com";

  const prevChaptersRef = useRef<Chapter[]>([]);

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error?.message || String(error),
      operation,
      path,
      auth: {
        uid: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        verified: auth.currentUser?.emailVerified
      }
    };
    console.error(`Firestore Error [${operation}]:`, JSON.stringify(errInfo));
  };

  useEffect(() => {
    // Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === ADMIN_EMAIL);
    });

    // Stories Listener
    const storiesQuery = query(collection(db, 'stories'), orderBy('title', 'asc'));
    const unsubscribeStories = onSnapshot(storiesQuery, (snapshot) => {
      const fetchedStories = snapshot.docs.map(doc => ({
        ...doc.data(),
        docId: doc.id
      })) as (StoryInfo & { docId: string })[];
      
      const hasElActo = fetchedStories.some(s => s.id === 'el-acto');

      if (isAdmin && !hasElActo) {
        // Initial migration for stories if missing
        CATALOG_DATA.forEach(async (s) => {
          try {
            await setDoc(doc(db, 'stories', s.id), {
              ...s,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } catch (e) {
            handleFirestoreError(e, 'WRITE', `stories/${s.id}`);
          }
        });
      }

      if (fetchedStories.length > 0 || !isAdmin) {
        setStories(fetchedStories);
      }
    }, (error) => {
      handleFirestoreError(error, 'LIST', 'stories');
    });

    // Chapters Listener
    const q = query(collection(db, 'chapters'), orderBy('id', 'asc'));
    const unsubscribeChapters = onSnapshot(q, (snapshot) => {
      const fetchedChapters = snapshot.docs.map(doc => ({
        ...doc.data(),
        docId: doc.id
      })) as (Chapter & { docId: string })[];
      
      const hasElActoChapters = fetchedChapters.some(c => c.storyId === 'el-acto');

      if (isAdmin && !hasElActoChapters) {
        // Initial migration for El Acto if missing
        INITIAL_CHAPTERS.forEach(async (c) => {
          try {
            const docId = `${c.storyId || 'el-acto'}-chapter-${c.id}`;
            await setDoc(doc(db, 'chapters', docId), {
              ...c,
              storyId: c.storyId || 'el-acto',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } catch (e) {
            handleFirestoreError(e, 'WRITE', `chapters/${c.id}`);
          }
        });
      }

      setChapters(fetchedChapters);

      // Check for newly unlocked chapters
      if (prevChaptersRef.current.length > 0 && !isAdmin) {
        const newlyUnlocked = fetchedChapters.find(c => {
          const prev = prevChaptersRef.current.find(p => p.id === c.id);
          return prev && prev.isLocked && !c.isLocked;
        });
        
        if (newlyUnlocked) {
          setNewChapterNotify(newlyUnlocked);
        }
      }

      // Check for new chapters on initial load for returning users
      if (prevChaptersRef.current.length === 0 && fetchedChapters.length > 0 && !isAdmin) {
        // Check for any story's last seen
        const latestUnlocked = [...fetchedChapters].reverse().find(c => !c.isLocked);
        if (latestUnlocked) {
          const lastSeenId = Number(localStorage.getItem(`story-${latestUnlocked.storyId}-last-seen-id`) || '0');
          if (latestUnlocked.id > lastSeenId) {
            setNewChapterNotify(latestUnlocked);
          }
        }
      }

      prevChaptersRef.current = fetchedChapters;
    }, (error) => {
      handleFirestoreError(error, 'LIST', 'chapters');
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

    return () => {
      unsubscribeAuth();
      unsubscribeStories();
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

  useEffect(() => {
    // Load bookmarks for the selected story
    if (selectedStory) {
      const saved = localStorage.getItem(`story-${selectedStory}-bookmarks`);
      if (saved) {
        try {
          setBookmarks(JSON.parse(saved));
        } catch (e) {
          console.error("Error loading bookmarks", e);
          setBookmarks({});
        }
      } else {
        setBookmarks({});
      }
    }
  }, [selectedStory]);

  const saveBookmark = useCallback((chapterId: number, scrollY: number) => {
    if (!selectedStory) return;
    setBookmarks(prev => {
      const newBookmarks = { ...prev, [chapterId]: scrollY };
      localStorage.setItem(`story-${selectedStory}-bookmarks`, JSON.stringify(newBookmarks));
      return newBookmarks;
    });
  }, [selectedStory]);

  const handleChapterClick = (chapter: Chapter) => {
    if (!chapter.isLocked) {
      setSelectedChapter(chapter);
      setView('reading');
      
      // Update last seen ID for this story
      if (selectedStory) {
        localStorage.setItem(`story-${selectedStory}-last-seen-id`, String(chapter.id));
      }
      
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
                  <Navbar 
                    onAdminClick={handleAdminClick} 
                    isDarkMode={isDarkMode} 
                    setIsDarkMode={setIsDarkMode}
                    user={user}
                    isAdmin={isAdmin}
                  />
                  <CatalogView 
                    onStorySelect={handleStorySelect}
                    onAuthorClick={handleAdminClick}
                    stories={stories}
                  />
                </div>
              ) : view === 'story-detail' ? (
                <div key="story-detail-wrapper">
                  <Navbar 
                    onAdminClick={handleAdminClick} 
                    onBack={goBack} 
                    isDarkMode={isDarkMode} 
                    setIsDarkMode={setIsDarkMode}
                    user={user}
                    isAdmin={isAdmin}
                  />
                  <HomeView 
                    storyId={selectedStory!}
                    onChapterClick={handleChapterClick} 
                    bookmarks={bookmarks}
                    chapters={chapters}
                    onAuthorClick={handleAdminClick}
                    isAdmin={isAdmin}
                    onAuthorMessageClick={() => setShowThankYou(true)}
                    onBack={goBack}
                    stories={stories}
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
                  onBack={() => setView('catalog')} 
                  stories={stories}
                  setStories={setStories}
                  isAdmin={isAdmin}
                  handleFirestoreError={handleFirestoreError}
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
                  src={stories.find(s => s.id === selectedStory)?.coverUrl || "https://i.postimg.cc/cCqGfwZb/1774848486059-edit-237685009748444.png"} 
                  className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale hover:grayscale-0 transition-all duration-1000 scale-110 hover:scale-100"
                  alt="Atmosphere"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-12 left-12 z-20 space-y-2">
                  <p className="text-accent font-mono text-[10px] uppercase tracking-[0.4em] font-bold">{stories.find(s => s.id === selectedStory)?.title || 'Obra'}</p>
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
                      Espero que <span className="text-white italic">{stories.find(s => s.id === selectedStory)?.title || 'esta obra'}</span> haya resonado en ti tanto como lo hizo en mí al crearlo. Esta historia ahora también te pertenece.
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
          <span className="text-accent font-sans text-[10px] tracking-[0.3em] uppercase mb-4 block font-bold">
            Presentando
          </span>
          <h2 className="text-4xl md:text-6xl font-display font-bold tracking-tight text-ink">
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
                "text-2xl md:text-4xl font-serif italic text-accent",
                char === " " ? "mr-3" : ""
              )}
            >
              {char}
            </motion.span>
          ))}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2.5, duration: 0.4, type: "spring" }}
            className="ml-2 self-center"
          >
            <BadgeCheck size={24} className="text-blue-500" fill="currentColor" stroke="white" />
          </motion.div>
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
        className="w-24 h-[1px] bg-border"
      />
    </motion.div>
  );
}

function Navbar({ 
  onAdminClick, 
  onBack,
  isDarkMode,
  setIsDarkMode,
  user,
  isAdmin
}: { 
  onAdminClick: () => void; 
  onBack?: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  user: User | null;
  isAdmin: boolean;
}) {
  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 h-20 md:h-24 z-50 flex items-center justify-between px-6 md:px-16 backdrop-blur-md border-b border-border bg-bg/80"
    >
      <div className="flex items-center gap-4 md:gap-8">
        {onBack ? (
          <button 
            onClick={onBack}
            className="p-2 md:p-3 bg-surface border border-border rounded-full hover:bg-ink/5 transition-all group"
          >
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform text-ink" />
          </button>
        ) : (
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-accent rounded-2xl flex items-center justify-center text-bg shadow-lg shadow-accent/20 group-hover:scale-110 transition-all duration-500">
              <BookOpen size={20} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl md:text-2xl font-display font-bold tracking-tighter leading-none text-ink">Editorial</h1>
              <p className="text-[8px] md:text-[9px] font-sans text-muted uppercase tracking-[0.4em]">Colectivo Digital</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 md:gap-8">
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2.5 md:p-3.5 bg-surface border border-border rounded-full hover:bg-ink/5 transition-all duration-500 text-muted hover:text-accent"
          title={isDarkMode ? "Modo Claro" : "Modo Oscuro"}
        >
          {isDarkMode ? <Sparkles size={18} /> : <Clock size={18} />}
        </button>

        {user ? (
          <div className="flex items-center gap-4 md:gap-6">
            {isAdmin && (
              <button 
                onClick={onAdminClick}
                className="px-4 py-2 md:px-6 md:py-2.5 bg-surface border border-border rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] md:tracking-[0.3em] hover:bg-accent hover:text-bg transition-all duration-500 text-ink"
              >
                Panel Editorial
              </button>
            )}
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-accent/30 p-0.5 group cursor-pointer relative">
              <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-full h-full rounded-full object-cover" />
              <div className="absolute inset-0 rounded-full bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ) : (
          <button 
            onClick={() => signInWithPopup(auth, googleProvider)}
            className="px-6 py-2.5 md:px-10 md:py-3 bg-ink text-bg text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] rounded-full hover:bg-accent transition-all duration-500 shadow-lg"
          >
            Ingresar
          </button>
        )}
      </div>
    </motion.nav>
  );
}

function CatalogView({ 
  onStorySelect,
  onAuthorClick,
  stories
}: { 
  onStorySelect: (id: string) => void;
  onAuthorClick: () => void;
  stories: StoryInfo[];
  key?: string | number;
}) {
  const [activeFilter, setActiveFilter] = useState<Genre>('Todos');

  // Extract unique genres from all stories
  const allGenres = Array.from(new Set(stories.flatMap(story => story.genres)));
  const filters: Genre[] = ['Todos', ...allGenres];

  const featuredStory = stories.find(s => s.isFeatured) || stories[0];
  const filteredStories = stories.filter(story => 
    activeFilter === 'Todos' || story.genres.includes(activeFilter)
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen pt-24 md:pt-40 pb-20 md:pb-32 px-6 md:px-12 max-w-[1400px] mx-auto relative"
    >
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-accent/5 blur-[160px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-accent/5 blur-[160px] rounded-full animate-pulse" style={{ animationDelay: '3s' }} />
      </div>

      {/* Hero Section - Featured Story */}
      {featuredStory && (
        <section className="mb-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
            <div className="lg:col-span-7 order-2 lg:order-1 space-y-8">
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4">
                  <div className="h-[1px] w-12 bg-accent" />
                  <span className="text-accent font-sans text-[10px] uppercase tracking-[0.3em] font-semibold">Obra Destacada</span>
                </div>
                <h1 className="text-5xl sm:text-7xl lg:text-8xl font-display font-bold tracking-tight leading-[1.05] text-ink">
                  {featuredStory.title}
                </h1>
                <p className="text-muted text-lg md:text-xl font-serif leading-relaxed max-w-xl">
                  {featuredStory.description}
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  {featuredStory.genres.map(genre => (
                    <span key={genre} className="px-4 py-1.5 rounded-full border border-border text-[10px] font-sans uppercase tracking-widest text-muted">
                      {genre}
                    </span>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-6 pt-4"
              >
                <button 
                  onClick={() => onStorySelect(featuredStory.id)}
                  className="px-10 py-4 bg-ink text-bg font-sans font-medium rounded-full hover:bg-accent transition-all duration-500 flex items-center gap-3 group"
                >
                  <span className="text-[11px] uppercase tracking-[0.2em]">Comenzar Lectura</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
                {featuredStory.chapters && (
                  <div className="flex flex-col border-l border-border pl-6">
                    <span className="text-[10px] font-sans text-muted uppercase tracking-[0.2em]">Capítulos</span>
                    <span className="text-2xl font-display font-bold text-ink">{featuredStory.chapters}</span>
                  </div>
                )}
              </motion.div>
            </div>

            <div className="lg:col-span-5 order-1 lg:order-2">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => onStorySelect(featuredStory.id)}
                className="relative aspect-[4/5] overflow-hidden rounded-[2rem] cursor-pointer group shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]"
              >
                <div className="absolute inset-0 bg-ink/5 group-hover:bg-transparent transition-colors duration-500 z-10" />
                {featuredStory.coverUrl ? (
                  <img 
                    src={featuredStory.coverUrl} 
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out"
                    alt={featuredStory.title}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="absolute inset-0 bg-surface flex items-center justify-center border border-border">
                    <BookOpen size={48} className="text-muted/20" />
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* Grid Section - Catalog */}
      <section className="mb-32 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border pb-8 gap-8">
          <div className="space-y-3">
            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-ink">Catálogo Editorial</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            {filters.map(filter => (
              <button 
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "px-4 py-2 rounded-full text-[10px] font-sans uppercase tracking-widest transition-all duration-300",
                  activeFilter === filter 
                    ? "bg-ink text-bg font-medium" 
                    : "bg-surface border border-border text-muted hover:border-ink/30 hover:text-ink"
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12 md:gap-x-10 md:gap-y-16">
          {filteredStories.map((story, index) => (
            <motion.div 
              key={story.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: index * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onStorySelect(story.id)}
              className="group cursor-pointer flex flex-col"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface shadow-sm group-hover:shadow-xl transition-all duration-500 mb-5">
                {story.coverUrl ? (
                  <img 
                    src={story.coverUrl} 
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    alt={story.title}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-surface">
                    <BookOpen size={24} className="text-muted/20 mb-3" />
                    <span className="text-[9px] font-sans text-muted uppercase tracking-widest">{story.title}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />
                
                {story.status === 'Próximamente' && (
                  <div className="absolute top-3 right-3">
                    <span className="px-3 py-1 bg-surface/90 backdrop-blur-md text-ink text-[8px] font-sans font-medium uppercase tracking-widest rounded-full shadow-sm">Pronto</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 flex-grow">
                <h3 className="font-display font-bold text-lg md:text-xl leading-tight text-ink group-hover:text-accent transition-colors duration-300">{story.title}</h3>
                <p className="text-[10px] font-sans text-muted uppercase tracking-widest flex items-center gap-1">
                  {story.author}
                  {['sam c.', 'samc c.', 'carolina'].includes(story.author.toLowerCase().trim()) && (
                    <BadgeCheck size={12} className="text-blue-500" fill="currentColor" stroke="white" />
                  )}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Bottom Sections */}
      <section className="mb-24 md:mb-48">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Future Collaborators Section */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="group relative aspect-[3/4] md:aspect-[3/4.5] overflow-hidden rounded-[2rem] bg-surface border border-border hover:border-accent/30 transition-all duration-1000 p-8 md:p-16 flex flex-col justify-between shadow-sm hover:shadow-xl"
          >
            <div className="space-y-6 md:space-y-8">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-accent/10 rounded-2xl text-accent flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <Users size={24} />
              </div>
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-3xl md:text-4xl font-display font-bold text-ink">Colaboradores</h3>
                <p className="text-muted text-base md:text-lg leading-relaxed font-serif">
                  "Buscamos voces únicas que deseen desafiar los límites de la narrativa convencional."
                </p>
              </div>
            </div>
            <div className="space-y-6 md:space-y-8">
              <div className="flex -space-x-4 md:-space-x-5">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-surface bg-bg flex items-center justify-center text-[9px] md:text-[11px] font-sans font-medium shadow-sm text-ink">
                    {i === 1 ? 'C' : i === 2 ? 'S' : i === 3 ? 'A' : '+'}
                  </div>
                ))}
              </div>
              <button className="w-full py-4 md:py-5 border border-border rounded-full text-[10px] md:text-[11px] font-sans font-medium uppercase tracking-[0.2em] hover:bg-ink hover:text-bg transition-all duration-500 text-ink">
                Unirse al Colectivo
              </button>
            </div>
          </motion.div>

          {/* Iconic Characters Section */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="group relative aspect-[3/4] md:aspect-[3/4.5] overflow-hidden rounded-[2rem] bg-surface border border-border hover:border-accent/30 transition-all duration-1000 p-8 md:p-16 flex flex-col justify-between shadow-sm hover:shadow-xl"
          >
            <div className="space-y-6 md:space-y-8">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-accent/10 rounded-2xl text-accent flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <Star size={24} />
              </div>
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-3xl md:text-4xl font-display font-bold text-ink">Personajes</h3>
                <p className="text-muted text-base md:text-lg leading-relaxed font-serif">
                  "Conoce a los protagonistas que han marcado un antes y un después en nuestras historias."
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-square rounded-2xl bg-bg flex flex-col items-center justify-center gap-2 border border-border hover:border-accent/30 transition-colors cursor-pointer">
                <span className="text-2xl md:text-3xl font-display font-bold text-ink">H</span>
                <span className="text-[8px] md:text-[10px] font-sans uppercase tracking-widest text-muted">Hana</span>
              </div>
              <div className="aspect-square rounded-2xl bg-bg flex flex-col items-center justify-center gap-2 border border-border hover:border-accent/30 transition-colors cursor-pointer">
                <span className="text-2xl md:text-3xl font-display font-bold text-ink">S</span>
                <span className="text-[8px] md:text-[10px] font-sans uppercase tracking-widest text-muted">Sam</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Catalog Footer */}
      <footer className="pt-20 md:pt-32 border-t border-border flex flex-col lg:flex-row justify-between items-start gap-16 md:gap-20">
        <div className="space-y-6 md:space-y-8 max-w-md">
          <div className="flex flex-col">
            <span className="text-3xl md:text-4xl font-display font-bold tracking-tight leading-none text-ink">SAM C.</span>
            <span className="text-[9px] md:text-[10px] font-sans uppercase tracking-[0.6em] text-accent font-bold mt-2">Editorial</span>
          </div>
          <p className="text-sm font-serif text-muted leading-relaxed">
            "Dedicados a la excelencia narrativa y la innovación visual. Creando puentes entre la imaginación y la realidad a través de la palabra escrita."
          </p>
          <div className="flex gap-4 md:gap-6">
            <button className="p-3 md:p-4 bg-surface border border-border rounded-full hover:text-accent transition-all duration-500 hover:scale-110 text-ink"><Share2 size={18} /></button>
            <button className="p-3 md:p-4 bg-surface border border-border rounded-full hover:text-accent transition-all duration-500 hover:scale-110 text-ink"><Heart size={18} /></button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 md:gap-20 w-full lg:w-auto">
          <div className="space-y-4 md:space-y-6">
            <span className="text-ink font-sans text-[10px] md:text-[11px] uppercase tracking-[0.4em] font-bold">Explorar</span>
            <div className="flex flex-col gap-3 md:gap-4 text-[9px] md:text-[11px] font-sans uppercase tracking-[0.3em] text-muted">
              <button className="hover:text-ink transition-colors text-left">Catálogo</button>
              <button className="hover:text-ink transition-colors text-left">Autores</button>
              <button className="hover:text-ink transition-colors text-left">Novedades</button>
            </div>
          </div>
          <div className="space-y-4 md:space-y-6">
            <span className="text-ink font-sans text-[10px] md:text-[11px] uppercase tracking-[0.4em] font-bold">Legal</span>
            <div className="flex flex-col gap-3 md:gap-4 text-[9px] md:text-[11px] font-sans uppercase tracking-[0.3em] text-muted">
              <button className="hover:text-ink transition-colors text-left">Privacidad</button>
              <button className="hover:text-ink transition-colors text-left">Términos</button>
              <button className="hover:text-ink transition-colors text-left">Cookies</button>
            </div>
          </div>
          <div className="space-y-4 md:space-y-6">
            <span className="text-ink font-sans text-[10px] md:text-[11px] uppercase tracking-[0.4em] font-bold">Social</span>
            <div className="flex flex-col gap-3 md:gap-4 text-[9px] md:text-[11px] font-sans uppercase tracking-[0.3em] text-muted">
              <button className="hover:text-ink transition-colors text-left">Instagram</button>
              <button className="hover:text-ink transition-colors text-left">Twitter</button>
              <button className="hover:text-ink transition-colors text-left">LinkedIn</button>
            </div>
          </div>
        </div>
      </footer>
      
      <div className="mt-20 md:mt-32 pt-12 border-t border-border flex flex-col md:flex-row justify-between items-center gap-8">
        <p className="text-[8px] md:text-[10px] font-sans text-muted tracking-[0.5em] uppercase text-center md:text-left">
          © 2026 SAM C. EDITORIAL • TODOS LOS DERECHOS RESERVADOS
        </p>
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[8px] md:text-[10px] font-sans text-accent uppercase tracking-widest">En Línea</span>
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
  onBack,
  stories
}: { 
  storyId: string;
  onChapterClick: (c: Chapter) => void; 
  bookmarks: Record<number, number>;
  chapters: Chapter[];
  onAuthorClick: () => void;
  isAdmin: boolean;
  onAuthorMessageClick?: () => void;
  onBack: () => void;
  stories: StoryInfo[];
  key?: string | number;
}) {
  const storyInfo = stories.find(s => s.id === storyId);
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
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-accent/5 blur-[100px] rounded-full animate-pulse delay-700" />
        </div>

        <div className="space-y-12 relative z-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-48 h-48 bg-surface rounded-full flex items-center justify-center mx-auto text-accent border border-border relative group shadow-xl"
          >
            <div className="absolute inset-0 bg-accent/5 blur-3xl rounded-full group-hover:bg-accent/10 transition-colors duration-1000" />
            <Clock size={72} className="relative z-10 animate-pulse" />
          </motion.div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
              <div className="h-[1px] w-12 bg-accent/30" />
              <span className="text-accent font-sans text-[10px] tracking-[0.5em] uppercase font-bold">{storyInfo.status}</span>
              <div className="h-[1px] w-12 bg-accent/30" />
            </div>
            <h1 className="text-7xl md:text-[10rem] font-display font-bold tracking-tighter leading-none text-ink">{storyInfo.title}</h1>
            <p className="text-muted font-sans uppercase tracking-[0.5em] text-xs flex items-center justify-center gap-2">
              Una Obra de {storyInfo.author}
              {['sam c.', 'samc c.', 'carolina'].includes(storyInfo.author.toLowerCase().trim()) && (
                <BadgeCheck size={14} className="text-blue-500" fill="currentColor" stroke="white" />
              )}
            </p>
          </div>
        </div>

        <div className="max-w-2xl bg-surface p-16 rounded-[4rem] border border-border shadow-2xl space-y-10 relative overflow-hidden group hover:border-accent/30 transition-colors duration-700">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
          <div className="space-y-6">
            <h3 className="text-3xl font-display font-bold text-ink">En Construcción Editorial</h3>
            <p className="text-muted leading-relaxed text-xl font-serif">
              Estamos curando meticulosamente cada palabra de este nuevo universo. {storyInfo.releaseDate && <span className="text-accent font-bold">{storyInfo.releaseDate}</span>}
            </p>
          </div>
          <div className="pt-6">
            <button 
              onClick={onBack}
              className="px-16 py-5 bg-ink text-bg font-sans font-medium rounded-full hover:bg-accent hover:scale-105 transition-all duration-500 uppercase tracking-[0.2em] text-[10px]"
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
                className="w-full aspect-[3/4.5] object-cover rounded-2xl md:rounded-3xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] md:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.5)] relative z-10 border border-border group-hover:scale-[1.01] transition-transform duration-1000"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full aspect-[3/4.5] bg-surface rounded-2xl md:rounded-3xl flex items-center justify-center border border-border relative z-10">
                <BookOpen size={64} className="text-muted/20" />
              </div>
            )}
          </div>
          
          {/* Floating Stats */}
          <div className="absolute -bottom-6 -right-6 md:-bottom-12 md:-right-12 bg-surface p-4 md:p-8 rounded-2xl md:rounded-3xl border border-border shadow-xl z-20 hidden sm:block animate-float">
            <div className="space-y-2 md:space-y-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  <BookOpen size={16} md:size={18} />
                </div>
                <div>
                  <p className="text-[8px] md:text-[10px] font-sans text-muted uppercase tracking-widest">Volumen</p>
                  <p className="text-sm md:text-lg font-display font-bold text-ink">Completo</p>
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
              <span className="text-accent font-sans text-[9px] md:text-[10px] uppercase tracking-[0.5em] font-bold">Colección Original</span>
            </div>
            <h1 className="text-6xl sm:text-8xl md:text-[10rem] font-display font-bold tracking-tighter leading-[0.85] text-ink">
              {storyInfo.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 md:gap-6 text-muted font-sans text-[9px] md:text-[11px] uppercase tracking-[0.3em]">
              <span className="flex items-center gap-1">
                Escrito por {storyInfo.author}
                {['sam c.', 'samc c.', 'carolina'].includes(storyInfo.author.toLowerCase().trim()) && (
                  <BadgeCheck size={12} className="text-blue-500" fill="currentColor" stroke="white" />
                )}
              </span>
              <div className="w-1 h-1 rounded-full bg-accent hidden sm:block" />
              <span>{storyInfo.genres.join(' • ')}</span>
            </div>
            <p className="text-muted text-xl md:text-2xl leading-relaxed font-serif max-w-2xl">
              {storyInfo.description}
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-6 md:gap-12 border-y border-border py-8 md:py-10">
            <div className="space-y-1 md:space-y-2">
              <span className="text-muted font-sans text-[8px] md:text-[9px] uppercase tracking-[0.4em]">Capítulos</span>
              <p className="text-xl md:text-3xl font-display font-bold text-ink">{storyInfo.chapters || chapters.length}</p>
            </div>
            <div className="space-y-1 md:space-y-2">
              <span className="text-muted font-sans text-[8px] md:text-[9px] uppercase tracking-[0.4em]">Lectores</span>
              <p className="text-xl md:text-3xl font-display font-bold text-ink">1.2k+</p>
            </div>
            <div className="space-y-1 md:space-y-2">
              <span className="text-muted font-sans text-[8px] md:text-[9px] uppercase tracking-[0.4em]">Calificación</span>
              <p className="text-xl md:text-3xl font-display font-bold text-ink">4.9/5</p>
            </div>
          </div>

          <div className="pt-4 md:pt-8 flex flex-wrap gap-4 md:gap-6">
            <button 
              onClick={() => {
                const storyChapters = chapters.filter(c => c.storyId === storyId);
                if (storyChapters.length > 0) {
                  onChapterClick(storyChapters[0]);
                } else {
                  alert('Los capítulos de esta obra estarán disponibles próximamente.');
                }
              }}
              className="flex-1 sm:flex-none px-8 py-5 md:px-16 md:py-6 bg-ink text-bg font-sans font-medium rounded-full hover:bg-accent hover:scale-105 transition-all duration-500 flex items-center justify-center gap-4 group uppercase tracking-[0.2em] text-[9px] md:text-[10px]"
            >
              {lastChapter && chapters.filter(c => c.storyId === storyId).some(c => c.id === lastChapter.id) ? 'Reiniciar Lectura' : 'Comenzar Experiencia'}
              <ArrowRight size={16} md:size={18} className="group-hover:translate-x-2 transition-transform duration-500" />
            </button>
            
            {lastChapter && chapters.filter(c => c.storyId === storyId).some(c => c.id === lastChapter.id) && (
              <button 
                onClick={() => onChapterClick(lastChapter)}
                className="flex-1 sm:flex-none px-8 py-5 md:px-16 md:py-6 bg-surface border border-border text-ink font-sans font-medium rounded-full hover:bg-ink/5 hover:scale-105 transition-all duration-500 flex items-center justify-center gap-4 group uppercase tracking-[0.2em] text-[9px] md:text-[10px]"
              >
                Continuar Cap. {lastChapter.id}
                <Bookmark size={16} md:size={18} className="text-accent group-hover:scale-125 transition-transform duration-500" />
              </button>
            )}

            <button className="p-5 md:p-6 bg-surface border border-border rounded-full hover:bg-ink/5 hover:scale-110 transition-all duration-500 text-muted hover:text-ink">
              <Share2 size={20} md:size={22} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Chapter List - Table of Contents Style */}
      <div className="space-y-12 md:space-y-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8 border-b border-border pb-8 md:pb-12">
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-accent" />
              <span className="text-accent font-sans text-[9px] md:text-[10px] uppercase tracking-[0.5em] font-bold">Estructura</span>
            </div>
            <h2 className="text-4xl md:text-7xl font-display font-bold tracking-tight text-ink">Tabla de Contenidos</h2>
          </div>
          <p className="text-muted font-sans text-[9px] md:text-[11px] uppercase tracking-[0.4em] max-w-xs md:text-right">
            Selecciona un fragmento para sumergirte en la narrativa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-8">
          {chapters.filter(c => c.storyId === storyId).length > 0 ? (
            chapters.filter(c => c.storyId === storyId).map((chapter, index) => (
              <motion.div 
                key={(chapter as any).docId || `chapter-${chapter.id}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onChapterClick(chapter)}
                className={cn(
                  "group p-6 md:p-10 bg-surface rounded-2xl md:rounded-[2.5rem] border transition-all duration-700 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[200px] md:min-h-[280px] shadow-sm hover:shadow-xl",
                  chapter.isLocked ? "border-border opacity-60" : "border-border hover:border-accent/40 hover:bg-accent/[0.02]"
                )}
              >
                <div className="space-y-4 md:space-y-6 relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] md:text-[12px] font-sans text-accent font-bold tracking-[0.3em] uppercase">Capítulo {String(chapter.id).padStart(2, '0')}</span>
                    {chapter.isLocked ? (
                      <Lock size={14} md:size={16} className="text-muted/40 group-hover:text-accent transition-colors duration-700" />
                    ) : (
                      <Sparkles size={14} md:size={16} className="text-accent animate-pulse" />
                    )}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-display font-bold leading-tight text-ink group-hover:text-accent transition-colors duration-700">
                    {chapter.title}
                  </h3>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-border relative z-10">
                  <span className="text-[8px] md:text-[10px] font-sans text-muted uppercase tracking-widest group-hover:text-ink transition-colors duration-700">
                    {chapter.isLocked ? 'Acceso Restringido' : 'Lectura Disponible'}
                  </span>
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-bg flex items-center justify-center group-hover:bg-accent group-hover:text-bg transition-all duration-700 border border-border">
                    <ArrowRight size={14} md:size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* Hover Background Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center bg-surface rounded-[3rem] border-dashed border-border shadow-sm">
              <BookOpen size={48} className="mx-auto text-muted/20 mb-6" />
              <h3 className="text-2xl font-display font-bold text-muted">Próximamente</h3>
              <p className="text-xs font-sans text-muted uppercase tracking-[0.5em] mt-4">Estamos preparando los capítulos de esta obra.</p>
            </div>
          )}
        </div>
      </div>

      {/* Author Note Section */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-24 md:mt-48 bg-surface p-8 md:p-20 rounded-[2rem] md:rounded-[4rem] border border-border shadow-xl relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-64 h-64 md:w-96 md:h-96 bg-accent/5 blur-[80px] md:blur-[120px] rounded-full -mr-32 -mt-32 md:-mr-48 md:-mt-48 group-hover:bg-accent/10 transition-colors duration-1000" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 items-center relative z-10">
          <div className="space-y-6 md:space-y-8">
            <div className="flex items-center gap-4">
              <div className="h-[1px] w-12 bg-accent" />
              <span className="text-accent font-sans text-[9px] md:text-[10px] uppercase tracking-[0.5em] font-bold">Nota del Autor</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-display font-bold tracking-tight leading-tight text-ink flex items-center gap-3 flex-wrap">
              Un mensaje de {storyInfo.author}
              {['sam c.', 'samc c.', 'carolina'].includes(storyInfo.author.toLowerCase().trim()) && (
                <BadgeCheck size={32} className="text-blue-500" fill="currentColor" stroke="white" />
              )}
              para sus lectores.
            </h2>
            <p className="text-muted text-lg md:text-xl leading-relaxed font-serif">
              "Esta obra nació de la necesidad de cuestionar qué estamos dispuestos a sacrificar por nuestra pasión. Espero que encuentren en estas líneas un reflejo de sus propias búsquedas."
            </p>
            <button 
              onClick={() => onAuthorMessageClick?.()}
              className="w-full sm:w-auto px-10 py-5 border border-border rounded-full hover:bg-ink hover:text-bg transition-all duration-500 flex items-center justify-center gap-4 group uppercase tracking-[0.2em] text-[9px] md:text-[10px] font-sans font-medium text-ink"
            >
              Leer Mensaje Completo
              <MessageSquare size={16} md:size={18} className="text-accent" />
            </button>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-2xl md:rounded-3xl overflow-hidden border border-border grayscale hover:grayscale-0 transition-all duration-1000 shadow-xl">
              <img 
                src={`https://picsum.photos/seed/${storyInfo.author.replace(/\s+/g, '')}/800/800`} 
                alt={storyInfo.author}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -bottom-4 -left-4 md:-bottom-8 -left-8 bg-surface p-4 md:p-8 rounded-xl md:rounded-2xl border border-border shadow-xl">
              <p className="text-xl md:text-2xl font-display font-bold text-ink flex items-center gap-2">
                {storyInfo.author}
                {['sam c.', 'samc c.', 'carolina'].includes(storyInfo.author.toLowerCase().trim()) && (
                  <BadgeCheck size={20} className="text-blue-500" fill="currentColor" stroke="white" />
                )}
              </p>
              <p className="text-[8px] md:text-[10px] font-sans text-muted uppercase tracking-widest">Autor</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="mt-24 md:mt-48 pt-12 md:pt-16 border-t border-border flex flex-col md:flex-row justify-between items-center gap-10 md:gap-12">
        <div className="flex flex-wrap justify-center gap-8 md:gap-12 text-[8px] md:text-[10px] font-sans uppercase tracking-[0.4em] text-muted">
          <button className="hover:text-ink transition-colors duration-500">Compartir</button>
          <button className="hover:text-ink transition-colors duration-500">Favoritos</button>
          <button className="hover:text-ink transition-colors duration-500">Reportar</button>
        </div>
        <div className="flex items-center gap-6 md:gap-8">
          <div className="flex gap-4 md:gap-6">
            <button className="text-muted hover:text-ink transition-colors duration-500"><Share2 size={16} md:size={18} /></button>
            <button className="text-muted hover:text-ink transition-colors duration-500"><Heart size={16} md:size={18} /></button>
          </div>
          <p className="text-[8px] md:text-[10px] font-sans text-muted tracking-[0.5em] uppercase">
            © 2026 SAM C. EDITORIAL
          </p>
        </div>
      </footer>
    </motion.div>
  );
}

function AdminView({ 
  chapters, 
  onBack,
  stories,
  setStories,
  isAdmin,
  handleFirestoreError
}: { 
  chapters: Chapter[]; 
  onBack: () => void;
  stories: StoryInfo[];
  setStories: React.Dispatch<React.SetStateAction<StoryInfo[]>>;
  isAdmin: boolean;
  handleFirestoreError: (error: any, operation: string, path: string) => void;
  key?: string | number;
}) {
  const [activeTab, setActiveTab] = useState<'stories' | 'chapters'>('stories');
  const [chapterFilter, setChapterFilter] = useState<string>('all');
  
  // Chapters State
  const [editingChapter, setEditingChapter] = useState<(Chapter & { docId: string }) | null>(null);
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [chapterFormData, setChapterFormData] = useState({ id: 0, title: '', content: '', isLocked: true, storyId: 'el-acto' });
  const [isSavingChapter, setIsSavingChapter] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  // Stories State
  const [editingStory, setEditingStory] = useState<StoryInfo | null>(null);
  const [isAddingStory, setIsAddingStory] = useState(false);
  const [storyFormData, setStoryFormData] = useState<StoryInfo>({
    id: '', title: '', author: '', description: '', coverUrl: '', status: 'Próximamente', genres: [], chapters: 0
  });

  // --- Handlers for Chapters ---
  const handleEditChapter = (chapter: Chapter & { docId: string }) => {
    setEditingChapter(chapter);
    setChapterFormData({ id: chapter.id, title: chapter.title, content: chapter.content || '', isLocked: chapter.isLocked, storyId: chapter.storyId || 'el-acto' });
    setIsAddingChapter(false);
  };

  const handleAddNewChapter = () => {
    const defaultStoryId = chapterFilter !== 'all' ? chapterFilter : (stories.length > 0 ? stories[0].id : 'el-acto');
    const storyChapters = chapters.filter(c => c.storyId === defaultStoryId);
    const nextId = storyChapters.length > 0 ? Math.max(...storyChapters.map(c => c.id)) + 1 : 1;
    setChapterFormData({ id: nextId, title: '', content: '', isLocked: true, storyId: defaultStoryId });
    setIsAddingChapter(true);
    setEditingChapter(null);
  };

  const handleSaveChapter = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSavingChapter) return;
    
    setIsSavingChapter(true);
    try {
      if (editingChapter) {
        await updateDoc(doc(db, 'chapters', editingChapter.docId), {
          ...chapterFormData,
          updatedAt: serverTimestamp()
        });
      } else {
        // Use storyId in doc ID to prevent collisions
        const docId = `${chapterFormData.storyId}-chapter-${chapterFormData.id}`;
        await setDoc(doc(db, 'chapters', docId), {
          ...chapterFormData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      if (isAddingChapter) {
        setIsAddingChapter(false);
      }
      setEditingChapter(null);
    } catch (error: any) {
      console.error("Error saving chapter:", error);
      alert("Error al guardar el capítulo: " + error.message);
    } finally {
      setIsSavingChapter(false);
    }
  };

  const handleDeleteChapter = async (docId: string) => {
    if (confirm("¿Estás seguro de eliminar este capítulo?")) {
      await deleteDoc(doc(db, 'chapters', docId));
    }
  };

  const toggleLockChapter = async (chapter: Chapter & { docId: string }) => {
    await updateDoc(doc(db, 'chapters', chapter.docId), {
      isLocked: !chapter.isLocked,
      updatedAt: serverTimestamp()
    });
  };

  // --- Handlers for Stories ---
  const handleEditStory = (story: StoryInfo) => {
    setEditingStory(story);
    setStoryFormData(story);
    setIsAddingStory(false);
  };

  const handleAddNewStory = () => {
    setStoryFormData({ id: '', title: '', author: '', description: '', coverUrl: '', status: 'Próximamente', genres: [], chapters: 0 });
    setIsAddingStory(true);
    setEditingStory(null);
  };

  const handleSaveStory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!storyFormData.id || storyFormData.id.includes('/')) {
      alert("El ID de la historia no puede estar vacío ni contener barras (/).");
      return;
    }

    try {
      if (editingStory) {
        await updateDoc(doc(db, 'stories', editingStory.id), {
          ...storyFormData,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(doc(db, 'stories', storyFormData.id), {
          ...storyFormData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setEditingStory(null);
      setIsAddingStory(false);
    } catch (error: any) {
      console.error("Error saving story:", error);
      alert("Error al guardar la historia: " + error.message);
    }
  };

  const handleDeleteStory = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta historia?")) {
      try {
        await deleteDoc(doc(db, 'stories', id));
      } catch (error) {
        console.error("Error deleting story:", error);
      }
    }
  };

  const handleAddNewChapterForStory = (storyId: string) => {
    setActiveTab('chapters');
    setChapterFilter(storyId);
    const storyChapters = chapters.filter(c => c.storyId === storyId);
    const nextId = storyChapters.length > 0 ? Math.max(...storyChapters.map(c => c.id)) + 1 : 1;
    setChapterFormData({ id: nextId, title: '', content: '', isLocked: true, storyId: storyId });
    setIsAddingChapter(true);
    setEditingChapter(null);
  };

  const handleManualSync = async () => {
    if (!isAdmin) return;
    if (!confirm("¿Deseas sincronizar los datos iniciales (Historias y Capítulos) con la base de datos? Esto no borrará tus cambios actuales.")) return;

    // Sync Stories
    for (const s of CATALOG_DATA) {
      const exists = stories.some(story => story.id === s.id);
      if (!exists) {
        try {
          await setDoc(doc(db, 'stories', s.id), {
            ...s,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          handleFirestoreError(e, 'WRITE', `stories/${s.id}`);
        }
      }
    }

    // Sync Chapters
    for (const c of INITIAL_CHAPTERS) {
      const exists = chapters.some(chapter => chapter.id === c.id && chapter.storyId === (c.storyId || 'el-acto'));
      if (!exists) {
        try {
          const docId = `${c.storyId || 'el-acto'}-chapter-${c.id}`;
          await setDoc(doc(db, 'chapters', docId), {
            ...c,
            storyId: c.storyId || 'el-acto',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          handleFirestoreError(e, 'WRITE', `chapters/${c.id}`);
        }
      }
    }
    alert("Sincronización completada.");
  };

  const handleLogout = () => {
    signOut(auth).then(onBack);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-7xl mx-auto px-6 pt-32 pb-24"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12 border-b border-border pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-accent" size={20} />
            <span className="text-accent text-xs font-bold uppercase tracking-widest">Panel Editorial Profesional</span>
          </div>
          <h1 className="text-4xl font-display font-bold tracking-tight text-ink">Gestión de Contenido</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleManualSync}
            className="px-6 py-2 bg-surface border border-border rounded-full text-xs font-bold uppercase tracking-widest text-accent hover:bg-accent/10 transition-all flex items-center gap-2"
            title="Sincronizar datos iniciales"
          >
            <RotateCcw size={14} />
            Sincronizar
          </button>
          <button 
            onClick={onBack}
            className="px-6 py-2 bg-surface border border-border rounded-full text-xs font-bold uppercase tracking-widest hover:bg-ink/5 transition-all text-ink"
          >
            Volver al Inicio
          </button>
          <button 
            onClick={handleLogout}
            className="p-3 bg-surface border border-border rounded-full text-red-500 hover:bg-red-500/10 transition-all duration-300"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('stories')}
          className={cn("px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2", activeTab === 'stories' ? "bg-accent text-bg shadow-lg shadow-accent/30" : "bg-surface border border-border text-muted hover:text-ink")}
        >
          <BookOpen size={18} /> Historias
        </button>
        <button 
          onClick={() => setActiveTab('chapters')}
          className={cn("px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2", activeTab === 'chapters' ? "bg-accent text-bg shadow-lg shadow-accent/30" : "bg-surface border border-border text-muted hover:text-ink")}
        >
          <FileText size={18} /> Capítulos
        </button>
      </div>

      {activeTab === 'stories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Sidebar List */}
          <div className="lg:col-span-4 space-y-4 h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
            <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 pb-4 mb-4 border-b border-border flex justify-between items-center">
              <p className="text-xs text-muted font-bold uppercase tracking-wider">Catálogo de Obras ({stories.length})</p>
              <button onClick={handleAddNewStory} className="p-2 bg-accent text-bg rounded-lg hover:bg-accent/80 transition-colors shadow-md">
                <Plus size={18} />
              </button>
            </div>
            {stories.map(story => (
              <motion.div 
                key={story.id}
                className={cn(
                  "p-5 bg-surface rounded-2xl border transition-all duration-300 cursor-pointer group relative overflow-hidden",
                  editingStory?.id === story.id ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border hover:border-accent/30"
                )}
                onClick={() => handleEditStory(story)}
              >
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    {story.coverUrl ? (
                      <img src={story.coverUrl} alt={story.title} className="w-14 h-20 rounded-lg object-cover shadow-md" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-14 h-20 rounded-lg bg-ink/5 flex items-center justify-center border border-dashed border-border"><BookOpen size={24} className="text-muted/30" /></div>
                    )}
                    <div className="space-y-1">
                      <h4 className="font-display font-bold text-base leading-tight text-ink">{story.title}</h4>
                      <p className="text-xs text-muted font-medium flex items-center gap-1">
                        {story.author}
                        {['sam c.', 'samc c.', 'carolina'].includes(story.author.toLowerCase().trim()) && (
                          <BadgeCheck size={12} className="text-blue-500" fill="currentColor" stroke="white" />
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[9px] px-2 py-0.5 bg-accent/10 text-accent rounded-full font-bold uppercase tracking-tighter">{story.status}</span>
                        <span className="text-[9px] text-muted font-sans">{chapters.filter(c => c.storyId === story.id).length} caps</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteStory(story.id); }}
                      className="p-2 text-muted/40 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAddNewChapterForStory(story.id); }}
                      className="p-2 text-muted/40 hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
                      title="Añadir Capítulo"
                    >
                      <Plus size={16} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveTab('chapters'); setChapterFilter(story.id); }}
                      className="p-2 text-muted/40 hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
                      title="Ver Capítulos"
                    >
                      <FileText size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Editor Area */}
          <div className="lg:col-span-8">
            {(editingStory || isAddingStory) ? (
              <motion.form 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSaveStory}
                className="bg-surface border border-border p-8 rounded-2xl space-y-6 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <h2 className="text-2xl font-display font-bold text-ink">
                    {isAddingStory ? 'Nueva Historia' : `Editando: ${storyFormData.title}`}
                  </h2>
                  <button type="button" onClick={() => { setEditingStory(null); setIsAddingStory(false); }} className="p-2 text-muted hover:text-ink transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-sans font-bold text-muted uppercase tracking-widest">ID (URL slug)</label>
                    <input type="text" value={storyFormData.id} onChange={e => setStoryFormData({...storyFormData, id: e.target.value})} className="w-full bg-bg border border-border rounded-xl px-4 py-3 focus:border-accent outline-none text-sm transition-all text-ink" required disabled={!isAddingStory} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-sans font-bold text-muted uppercase tracking-widest">Título</label>
                    <input type="text" value={storyFormData.title} onChange={e => setStoryFormData({...storyFormData, title: e.target.value})} className="w-full bg-bg border border-border rounded-xl px-4 py-3 focus:border-accent outline-none text-sm transition-all text-ink" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-sans font-bold text-muted uppercase tracking-widest">Autor</label>
                    <input type="text" value={storyFormData.author} onChange={e => setStoryFormData({...storyFormData, author: e.target.value})} className="w-full bg-bg border border-border rounded-xl px-4 py-3 focus:border-accent outline-none text-sm transition-all text-ink" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-sans font-bold text-muted uppercase tracking-widest">Estado</label>
                    <select value={storyFormData.status} onChange={e => setStoryFormData({...storyFormData, status: e.target.value as any})} className="w-full bg-bg border border-border rounded-xl px-4 py-3 focus:border-accent outline-none text-sm transition-all text-ink">
                      <option value="Disponible">Disponible</option>
                      <option value="En Progreso">En Progreso</option>
                      <option value="Próximamente">Próximamente</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-sans font-bold text-muted uppercase tracking-widest">Portada</label>
                    <div className="flex gap-4 items-center">
                      <div className="w-20 h-28 bg-bg rounded-lg overflow-hidden border border-border flex-shrink-0">
                        {storyFormData.coverUrl ? (
                          <img src={storyFormData.coverUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><BookOpen size={20} className="text-muted/20" /></div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input 
                          type="url" 
                          value={storyFormData.coverUrl || ''} 
                          onChange={e => setStoryFormData({...storyFormData, coverUrl: e.target.value})} 
                          className="w-full bg-bg border border-border rounded-xl px-4 py-2 focus:border-accent outline-none text-xs transition-all text-ink" 
                          placeholder="URL de la imagen (https://...)" 
                        />
                        <div className="relative">
                          <input 
                            type="file" 
                            accept="image/*" 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const compressedDataUrl = await new Promise<string>((resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      const img = new Image();
                                      img.onload = () => {
                                        const canvas = document.createElement('canvas');
                                        const MAX_WIDTH = 800;
                                        const MAX_HEIGHT = 1200;
                                        let width = img.width;
                                        let height = img.height;

                                        if (width > height) {
                                          if (width > MAX_WIDTH) {
                                            height *= MAX_WIDTH / width;
                                            width = MAX_WIDTH;
                                          }
                                        } else {
                                          if (height > MAX_HEIGHT) {
                                            width *= MAX_HEIGHT / height;
                                            height = MAX_HEIGHT;
                                          }
                                        }
                                        canvas.width = width;
                                        canvas.height = height;
                                        const ctx = canvas.getContext('2d');
                                        ctx?.drawImage(img, 0, 0, width, height);
                                        resolve(canvas.toDataURL('image/jpeg', 0.7));
                                      };
                                      img.onerror = reject;
                                      img.src = event.target?.result as string;
                                    };
                                    reader.onerror = reject;
                                    reader.readAsDataURL(file);
                                  });
                                  setStoryFormData({...storyFormData, coverUrl: compressedDataUrl});
                                } catch (error) {
                                  console.error("Error compressing image:", error);
                                  alert("Error al procesar la imagen.");
                                }
                              }
                            }}
                            className="hidden" 
                            id="cover-upload"
                          />
                          <label 
                            htmlFor="cover-upload" 
                            className="inline-flex items-center gap-2 px-4 py-2 bg-surface rounded-lg text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-accent hover:text-bg transition-all border border-border text-ink"
                          >
                            Subir Archivo
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-sans font-bold text-muted uppercase tracking-widest">Descripción</label>
                    <textarea value={storyFormData.description} onChange={e => setStoryFormData({...storyFormData, description: e.target.value})} className="w-full bg-bg border border-border rounded-xl px-4 py-3 focus:border-accent outline-none text-sm transition-all h-24 resize-none text-ink" required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-sans font-bold text-muted uppercase tracking-widest">Géneros (separados por coma)</label>
                    <input type="text" value={storyFormData.genres.join(', ')} onChange={e => setStoryFormData({...storyFormData, genres: e.target.value.split(',').map(g => g.trim()).filter(Boolean)})} className="w-full bg-bg border border-border rounded-xl px-4 py-3 focus:border-accent outline-none text-sm transition-all text-ink" placeholder="Sci-Fi, Romance, Drama" />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button type="submit" className="px-8 py-3 bg-ink text-bg font-bold rounded-xl hover:bg-accent transition-all shadow-lg">
                    Guardar Historia
                  </button>
                </div>
              </motion.form>
            ) : (
              <div className="h-full flex items-center justify-center text-muted">
                <p className="font-serif italic">Selecciona una historia para editar o crea una nueva.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'chapters' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Sidebar List */}
          <div className="lg:col-span-4 space-y-4 h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
            <div className="sticky top-0 bg-bg/95 backdrop-blur-md z-10 pb-4 mb-4 border-b border-border space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted font-bold uppercase tracking-wider">Capítulos ({chapters.length})</p>
                <button onClick={handleAddNewChapter} className="p-2 bg-accent text-bg rounded-lg hover:bg-accent/80 transition-colors shadow-md">
                  <Plus size={18} />
                </button>
              </div>
              
              {/* Story Filter */}
              <select 
                value={chapterFilter} 
                onChange={(e) => setChapterFilter(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-accent transition-all text-ink"
              >
                <option value="all">Todas las historias</option>
                {stories.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>

            {chapters
              .filter(c => chapterFilter === 'all' || c.storyId === chapterFilter)
              .map(chapter => (
              <motion.div 
                key={(chapter as any).docId || `chapter-${chapter.storyId}-${chapter.id}`}
                className={cn(
                  "p-5 bg-surface rounded-2xl border transition-all duration-300 cursor-pointer group relative overflow-hidden",
                  editingChapter?.id === chapter.id ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border hover:border-accent/30"
                )}
                onClick={() => handleEditChapter(chapter as Chapter & { docId: string })}
              >
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted font-mono">{String(chapter.id).padStart(2, '0')}</span>
                    <div>
                      <h4 className="font-serif font-semibold text-sm truncate max-w-[150px]">{chapter.title}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] px-1.5 py-0.5 bg-black/5 dark:bg-white/5 rounded text-muted font-mono uppercase tracking-tighter">
                          {stories.find(s => s.id === chapter.storyId)?.title || 'Sin Historia'}
                        </span>
                        <span className="text-[8px] text-muted/40 font-mono">ID: {chapter.id}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleLockChapter(chapter as Chapter & { docId: string }); }}
                      className={cn("p-2 rounded-lg transition-colors", chapter.isLocked ? "text-muted hover:text-ink" : "text-accent bg-accent/10")}
                    >
                      {chapter.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteChapter((chapter as any).docId); }}
                      className="p-2 text-muted hover:text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Editor Area */}
          <div className="lg:col-span-8">
            {(editingChapter || isAddingChapter) ? (
              <motion.form 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSaveChapter}
                className="bg-surface border border-border p-8 rounded-2xl space-y-6 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <h2 className="text-2xl font-display font-bold text-ink">
                    {isAddingChapter ? 'Nuevo Capítulo' : `Editando Capítulo ${chapterFormData.id}`}
                  </h2>
                  <button type="button" onClick={() => { setEditingChapter(null); setIsAddingChapter(false); }} className="p-2 text-muted hover:text-ink transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-sans font-bold text-muted uppercase tracking-widest">ID</label>
                    <input type="number" value={chapterFormData.id} onChange={e => setChapterFormData({...chapterFormData, id: parseInt(e.target.value)})} className="w-full bg-bg border border-border rounded-xl px-4 py-3 focus:border-accent outline-none text-sm transition-all text-ink" required />
                  </div>
                  <div className="md:col-span-6 space-y-2">
                    <label className="text-[10px] font-sans font-bold text-muted uppercase tracking-widest">Título</label>
                    <input type="text" value={chapterFormData.title} onChange={e => setChapterFormData({...chapterFormData, title: e.target.value})} className="w-full bg-bg border border-border rounded-xl px-4 py-3 focus:border-accent outline-none text-sm transition-all text-ink" required />
                  </div>
                  <div className="md:col-span-4 space-y-2">
                    <label className="text-[10px] font-sans font-bold text-muted uppercase tracking-widest">Historia</label>
                    <select value={chapterFormData.storyId} onChange={e => setChapterFormData({...chapterFormData, storyId: e.target.value})} className="w-full bg-bg border border-border rounded-xl px-4 py-3 focus:border-accent outline-none text-sm transition-all text-ink">
                      {stories.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-sans font-bold text-muted uppercase tracking-widest">Contenido</label>
                    <div className="flex bg-bg border border-border rounded-lg p-1">
                      <button type="button" onClick={() => setIsPreview(false)} className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all", !isPreview ? "bg-surface shadow-sm text-ink" : "text-muted")}>Editar</button>
                      <button type="button" onClick={() => setIsPreview(true)} className={cn("px-4 py-1.5 rounded-md text-xs font-semibold transition-all", isPreview ? "bg-surface shadow-sm text-ink" : "text-muted")}>Vista Previa</button>
                    </div>
                  </div>
                  
                  {isPreview ? (
                    <div className="w-full h-[400px] bg-bg border border-border rounded-xl p-6 overflow-y-auto custom-scrollbar font-serif text-lg leading-relaxed whitespace-pre-wrap text-ink">
                      {chapterFormData.content || <span className="text-muted italic">Sin contenido...</span>}
                    </div>
                  ) : (
                    <textarea 
                      value={chapterFormData.content}
                      onChange={e => setChapterFormData({...chapterFormData, content: e.target.value})}
                      className="w-full h-[400px] bg-bg border border-border rounded-xl p-6 focus:border-accent outline-none font-serif text-lg leading-relaxed resize-none transition-all custom-scrollbar text-ink"
                      placeholder="Escribe el contenido aquí..."
                    />
                  )}
                </div>

                <div className="flex justify-end pt-4">
                  <button type="submit" disabled={isSavingChapter} className="px-8 py-3 bg-ink text-bg font-bold rounded-xl hover:bg-accent transition-all shadow-lg disabled:opacity-50 flex items-center gap-2">
                    {isSavingChapter ? <RotateCcw size={16} className="animate-spin" /> : <Save size={16} />}
                    Guardar Capítulo
                  </button>
                </div>
              </motion.form>
            ) : (
              <div className="h-full flex items-center justify-center text-muted">
                <p>Selecciona un capítulo para editar o crea uno nuevo.</p>
              </div>
            )}
          </div>
        </div>
      )}
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
      <div className="fixed top-0 left-0 w-full h-[2px] bg-border z-[100]">
        <motion.div 
          className="h-full bg-accent shadow-[0_0_10px_rgba(140,107,74,0.5)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Floating Navigation - Glassmorphism */}
      <nav className="fixed top-6 md:top-12 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 md:px-6 flex justify-between items-center z-[90] pointer-events-none">
        <motion.button 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          onClick={handleBack}
          className="p-3 md:p-4 bg-surface/80 backdrop-blur-md rounded-full hover:bg-ink/5 transition-all duration-500 pointer-events-auto group border border-border"
        >
          <ChevronLeft size={18} className="md:w-5 md:h-5 group-hover:-translate-x-1 transition-transform text-ink" />
        </motion.button>
        
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex gap-2 md:gap-4 pointer-events-auto"
        >
          <button 
            onClick={handleBookmark}
            className={cn(
              "p-3 md:p-4 bg-surface/80 backdrop-blur-md rounded-full transition-all duration-500 border border-border text-ink",
              currentBookmark !== undefined ? "text-accent border-accent/30" : "hover:bg-ink/5"
            )}
          >
            {currentBookmark !== undefined ? <BookmarkCheck size={18} className="md:w-5 md:h-5" /> : <Bookmark size={18} className="md:w-5 md:h-5" />}
          </button>
          <button className="p-3 md:p-4 bg-surface/80 backdrop-blur-md rounded-full hover:bg-ink/5 transition-all duration-500 border border-border text-ink">
            <Heart size={18} className="md:w-5 md:h-5" />
          </button>
          <button className="p-3 md:p-4 bg-surface/80 backdrop-blur-md rounded-full hover:bg-ink/5 transition-all duration-500 border border-border text-ink">
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
            className="fixed bottom-8 md:bottom-12 left-1/2 -translate-x-1/2 z-[110] px-6 md:px-10 py-3 md:py-4 bg-ink text-bg rounded-full font-sans text-[8px] md:text-[10px] uppercase tracking-[0.3em] font-bold shadow-2xl"
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
            <span className="text-accent font-sans text-[9px] md:text-[10px] tracking-[0.5em] uppercase font-bold">Capítulo {String(chapter.id).padStart(2, '0')}</span>
            <div className="h-[1px] w-8 md:w-12 bg-accent/30" />
          </div>
          
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-display font-bold tracking-tight leading-none text-ink">
            {chapter.title}
          </h1>
          
          <div className="flex items-center justify-center gap-4 md:gap-8 pt-4 md:pt-8">
            <div className="flex flex-col items-center gap-1 md:gap-2">
              <span className="text-[8px] md:text-[9px] font-sans text-muted uppercase tracking-widest">Tiempo Est.</span>
              <span className="text-xs md:text-sm font-serif text-ink">8 min</span>
            </div>
            <div className="w-[1px] h-6 md:h-8 bg-border" />
            <div className="flex flex-col items-center gap-1 md:gap-2">
              <span className="text-[8px] md:text-[9px] font-sans text-muted uppercase tracking-widest">Palabras</span>
              <span className="text-xs md:text-sm font-serif text-ink">{chapter.content?.split(/\s+/).length}</span>
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
              className="text-lg md:text-2xl leading-[1.8] text-ink font-serif"
            >
              {i === 0 ? (
                <>
                  <span className="text-5xl md:text-7xl font-bold text-accent float-left mr-3 md:mr-4 mt-1 md:mt-2 leading-[0.8] font-display">
                    {para.charAt(0)}
                  </span>
                  {para.slice(1)}
                </>
              ) : para}
            </motion.p>
          ))}
        </div>

        <footer className="mt-32 md:mt-48 pt-16 md:pt-24 border-t border-border text-center space-y-12 md:space-y-16">
          <div className="space-y-4">
            <p className="text-muted font-serif italic text-xl md:text-2xl">Fin del Capítulo {chapter.id}</p>
            <div className="w-12 md:w-16 h-[1px] bg-accent/30 mx-auto" />
          </div>
          
          <div className="flex flex-col items-center gap-6 md:gap-8">
            {isLastChapter ? (
              <button 
                onClick={onFinish}
                className="w-full md:w-auto px-12 md:px-20 py-5 md:py-6 bg-ink text-bg rounded-full hover:bg-accent hover:scale-105 transition-all duration-500 font-bold uppercase tracking-[0.2em] text-[9px] md:text-[10px] shadow-2xl"
              >
                Finalizar Obra
              </button>
            ) : (
              <button 
                onClick={handleBack}
                className="w-full md:w-auto px-12 md:px-20 py-5 md:py-6 bg-surface border border-border text-ink rounded-full hover:bg-ink/5 hover:scale-105 transition-all duration-500 font-bold uppercase tracking-[0.2em] text-[9px] md:text-[10px]"
              >
                Volver al Índice
              </button>
            )}
          </div>

          <div className="pt-16 md:pt-24 space-y-4">
            <p className="text-[8px] md:text-[9px] font-sans text-muted tracking-[0.5em] uppercase">
              © 2026 SAM C. EDITORIAL • TODOS LOS DERECHOS RESERVADOS
            </p>
            <div className="flex justify-center gap-6 md:gap-8 text-muted">
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
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-ink/[0.01] blur-[120px] rounded-full -ml-48 -mb-48" />
      </div>
    </motion.div>
  );
}

