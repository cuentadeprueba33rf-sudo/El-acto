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
  Loader2,
  Settings,
  Plus,
  Trash2,
  Edit3,
  Save,
  Unlock,
  LogOut,
  ShieldCheck,
  RotateCcw
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

export default function App() {
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [view, setView] = useState<'home' | 'reading' | 'admin'>('home');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookmarks, setBookmarks] = useState<Record<number, number>>({});
  const [showLockedModal, setShowLockedModal] = useState(false);
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

  const goBack = () => {
    setView('home');
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
      "min-h-screen bg-bg text-ink selection:bg-accent selection:text-bg transition-all duration-500",
      isBlurred && "blur-xl grayscale"
    )}>
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
              {view === 'home' ? (
                <HomeView 
                  key="home" 
                  onChapterClick={handleChapterClick} 
                  bookmarks={bookmarks}
                  chapters={chapters}
                  onAuthorClick={handleAdminClick}
                  isAdmin={isAdmin}
                />
              ) : view === 'reading' ? (
                <ReadingView 
                  key="reading" 
                  chapter={selectedChapter!} 
                  onBack={goBack} 
                  onSaveBookmark={saveBookmark}
                  currentBookmark={bookmarks[selectedChapter!.id]}
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
                <h2 className="text-2xl font-serif font-bold">Capítulo Bloqueado</h2>
                <p className="text-muted leading-relaxed">
                  Este capítulo aún no está disponible. Recuerda que los nuevos capítulos se publicarán a las <span className="text-accent font-bold">9:30 AM (Hora Colombiana)</span>.
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

function HomeView({ 
  onChapterClick, 
  bookmarks,
  chapters,
  onAuthorClick,
  isAdmin
}: { 
  onChapterClick: (c: Chapter) => void; 
  bookmarks: Record<number, number>;
  chapters: Chapter[];
  onAuthorClick: () => void;
  isAdmin: boolean;
  key?: string | number;
}) {
  const lastBookmarkedId = Object.keys(bookmarks).map(Number).sort((a, b) => b - a)[0];
  const lastChapter = chapters.find(c => c.id === lastBookmarkedId);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-4xl mx-auto px-6 py-12 md:py-24"
    >
      {/* Hero Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-24">
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative group"
        >
          <div className="absolute -inset-4 bg-accent/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <img 
            src="https://i.postimg.cc/cCqGfwZb/1774848486059-edit-237685009748444.png" 
            alt="El Acto Portada" 
            className="w-full aspect-[2/3] object-cover rounded-lg shadow-2xl relative z-10 border border-white/10"
            referrerPolicy="no-referrer"
          />
        </motion.div>

        <motion.div 
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <span className="text-accent font-mono text-xs tracking-widest uppercase">Novela Original</span>
            <h1 className="text-6xl md:text-8xl font-serif font-bold tracking-tighter leading-none">
              <ShinyText 
                text="El Acto" 
                speed={1.6} 
                color="#ffffff" 
                shineColor="#f27d26" 
                spread={120}
              />
            </h1>
          </div>
          
          <p className="text-muted text-lg leading-relaxed font-light">
            Una historia que desafía la percepción, donde cada cuerda vibrante cuenta un secreto y cada ensayo es un paso hacia el abismo de la perfección.
          </p>

          <div className="flex items-center gap-6 text-sm font-mono text-muted">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-accent" />
              <span>{chapters.length} Capítulos</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart size={16} className="text-accent" />
              <span>1.2k Lecturas</span>
            </div>
          </div>

          <div className="pt-6 flex flex-wrap gap-4">
            <button 
              onClick={() => onChapterClick(chapters[0])}
              className="px-8 py-4 bg-ink text-bg font-bold rounded-full hover:bg-accent transition-colors duration-300 flex items-center gap-2 group"
            >
              {lastChapter ? 'Reiniciar Lectura' : 'Empezar a Leer'}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            
            {lastChapter && (
              <button 
                onClick={() => onChapterClick(lastChapter)}
                className="px-8 py-4 glass text-ink font-bold rounded-full hover:bg-white/10 transition-colors duration-300 flex items-center gap-2 group"
              >
                Continuar: Cap {lastChapter.id}
                <Bookmark size={18} className="text-accent" />
              </button>
            )}

            <button className="p-4 glass rounded-full hover:bg-white/10 transition-colors">
              <Share2 size={20} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Release Note */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mb-16 p-6 glass rounded-2xl border-accent/30 flex items-start gap-4"
      >
        <div className="p-3 bg-accent/10 rounded-xl text-accent">
          <Clock size={24} />
        </div>
        <div>
          <h3 className="font-bold text-lg mb-1">Próximos lanzamientos</h3>
          <p className="text-muted leading-snug">
            El capítulo 1 ya está disponible. Los demás capítulos se publicarán a las <span className="text-accent font-bold">9:30 AM (Hora Colombiana)</span>. ¡No te lo pierdas!
          </p>
        </div>
      </motion.div>

      {/* Chapter List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-serif italic">Índice de Capítulos</h2>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <button 
                onClick={onAuthorClick}
                className="p-2 glass rounded-lg text-accent hover:bg-accent/10 transition-colors"
                title="Panel de Control"
              >
                <Settings size={20} />
              </button>
            )}
            <List size={20} className="text-muted" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {chapters.map((chapter, index) => (
            <motion.div
              key={chapter.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * (index % 10) }}
              onClick={() => onChapterClick(chapter)}
              className={cn(
                "p-5 rounded-xl border transition-all duration-300 flex items-center justify-between group",
                chapter.isLocked 
                  ? "border-white/5 opacity-50 cursor-not-allowed" 
                  : "border-white/10 hover:border-accent/50 hover:bg-white/5 cursor-pointer"
              )}
            >
              <div className="flex items-center gap-6">
                <span className="font-mono text-xs text-muted group-hover:text-accent transition-colors">
                  {String(chapter.id).padStart(2, '0')}
                </span>
                <span className="font-medium tracking-tight">{chapter.title}</span>
              </div>
              
              {chapter.isLocked ? (
                <Lock size={16} className="text-muted" />
              ) : (
                <div className="flex items-center gap-2 text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-mono uppercase tracking-widest">Leer</span>
                  <ArrowRight size={14} />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-24 pt-12 border-t border-white/5 text-center space-y-4">
        <div className="flex justify-center gap-6 text-muted">
          <button className="hover:text-accent transition-colors"><Share2 size={18} /></button>
          <button className="hover:text-accent transition-colors"><Heart size={18} /></button>
        </div>
        <p 
          className="text-xs font-mono text-muted/50 tracking-widest uppercase cursor-pointer"
          onClick={onAuthorClick}
        >
          © 2026 SAM C. Todos los derechos reservados.
        </p>
        <p className="text-[10px] text-muted/30 italic">
          Esta es una obra de ficción. Cualquier parecido con la realidad es pura coincidencia.
        </p>
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
      // Keep editing the same chapter but update the reference
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
        // Delete all existing
        for (const c of chapters) {
          await deleteDoc(doc(db, 'chapters', (c as any).docId));
        }
        // Re-upload from constants
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
      className="max-w-6xl mx-auto px-6 py-12"
    >
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 glass rounded-full hover:bg-white/10">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-3xl font-serif font-bold flex items-center gap-3">
            <ShieldCheck className="text-accent" />
            Panel de Control
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleReset}
            disabled={isSaving}
            className="px-6 py-2 glass text-muted font-medium rounded-full flex items-center gap-2 hover:bg-white/10 transition-colors disabled:opacity-50"
            title="Reiniciar a los 27 capítulos originales"
          >
            <RotateCcw size={18} className={isSaving ? "animate-spin" : ""} /> Reiniciar
          </button>
          <button 
            onClick={handleAddNew}
            className="px-6 py-2 bg-accent text-bg font-bold rounded-full flex items-center gap-2 hover:bg-accent/80 transition-colors"
          >
            <Plus size={18} /> Nuevo Capítulo
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 glass rounded-full text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* List */}
        <div className="lg:col-span-1 space-y-4 h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          {chapters.map(chapter => (
            <div 
              key={chapter.id}
              className={cn(
                "p-4 glass rounded-xl border transition-all cursor-pointer group",
                editingChapter?.id === chapter.id ? "border-accent bg-accent/5" : "border-white/5 hover:border-white/20"
              )}
              onClick={() => handleEdit(chapter as Chapter & { docId: string })}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted">#{chapter.id}</span>
                  <span className="font-medium text-sm truncate max-w-[150px]">{chapter.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleLock(chapter as Chapter & { docId: string }); }}
                    className={cn("p-1.5 rounded-md transition-colors", chapter.isLocked ? "text-muted" : "text-accent bg-accent/10")}
                  >
                    {chapter.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete((chapter as any).docId); }}
                    className="p-1.5 text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div className="lg:col-span-2">
          {(editingChapter || isAdding) ? (
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSave}
              className="glass p-8 rounded-3xl border-white/10 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {isAdding ? <Plus size={20} /> : <Edit3 size={20} />}
                  {isAdding ? 'Crear Nuevo Capítulo' : `Editando Capítulo ${formData.id}`}
                </h2>
                <button 
                  type="button" 
                  onClick={() => { setEditingChapter(null); setIsAdding(false); }}
                  className="text-muted hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 space-y-2">
                  <label className="text-xs font-mono text-muted uppercase">ID</label>
                  <input 
                    type="number" 
                    value={formData.id}
                    onChange={e => setFormData({...formData, id: parseInt(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-accent outline-none"
                    required
                  />
                </div>
                <div className="col-span-3 space-y-2">
                  <label className="text-xs font-mono text-muted uppercase">Título</label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-accent outline-none"
                    placeholder="Título del capítulo..."
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <label className="text-xs font-mono text-muted uppercase">Contenido de la Historia</label>
                    <button 
                      type="button"
                      onClick={() => setIsPreview(!isPreview)}
                      className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest transition-colors",
                        isPreview ? "bg-accent text-bg" : "bg-white/5 text-muted hover:bg-white/10"
                      )}
                    >
                      {isPreview ? 'Editar' : 'Vista Previa'}
                    </button>
                    <button 
                      type="button"
                      onClick={handleCopy}
                      className="px-3 py-1 bg-white/5 text-muted hover:bg-white/10 rounded-full text-[10px] font-mono uppercase tracking-widest transition-colors"
                    >
                      Copiar
                    </button>
                  </div>
                  <span className="text-xs font-mono text-muted/50">{wordCount} palabras</span>
                </div>
                
                {isPreview ? (
                  <div className="w-full min-h-[500px] bg-white/5 border border-white/10 rounded-2xl px-8 py-8 overflow-y-auto font-serif text-lg leading-relaxed text-white/80">
                    {formData.content.split(/\n\s*\n/).map((para, i) => (
                      <p key={i} className="mb-6 first-letter:text-3xl first-letter:text-accent first-letter:mr-1">
                        {para}
                      </p>
                    ))}
                    {formData.content === '' && <p className="text-muted italic">Sin contenido para mostrar...</p>}
                  </div>
                ) : (
                  <textarea 
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                    onKeyDown={handleKeyDown}
                    className="w-full min-h-[500px] bg-white/5 border border-white/10 rounded-2xl px-6 py-5 focus:border-accent outline-none resize-y font-serif text-lg leading-relaxed custom-scrollbar"
                    placeholder="Escribe el alma de este capítulo aquí... (Usa Ctrl+S para guardar rápido)"
                    required
                  />
                )}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div 
                    onClick={() => setFormData({...formData, isLocked: !formData.isLocked})}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      formData.isLocked ? "bg-white/10" : "bg-accent"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      formData.isLocked ? "left-1" : "left-7"
                    )} />
                  </div>
                  <span className="text-sm font-medium">
                    {formData.isLocked ? 'Capítulo Bloqueado' : 'Capítulo Público'}
                  </span>
                </label>

                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-8 py-3 bg-accent text-bg font-bold rounded-xl flex items-center gap-2 hover:bg-accent/80 transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                  {isAdding ? 'Publicar Capítulo' : 'Guardar Cambios'}
                </button>
              </div>
            </motion.form>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 glass rounded-3xl border-dashed border-white/10">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-muted mb-4">
                <Edit3 size={32} />
              </div>
              <h3 className="text-xl font-medium text-muted">Selecciona un capítulo para editar</h3>
              <p className="text-sm text-muted/50 mt-2">O crea uno nuevo usando el botón superior</p>
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
  currentBookmark
}: { 
  chapter: Chapter; 
  onBack: () => void; 
  onSaveBookmark: (id: number, pos: number) => void;
  currentBookmark?: number;
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
    
    // Auto-bookmark on unmount (when leaving the chapter)
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto px-6 py-12 md:py-24"
    >
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-white/5 z-50">
        <motion.div 
          className="h-full bg-accent"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full p-6 flex justify-between items-center z-40 pointer-events-none">
        <button 
          onClick={handleBack}
          className="p-3 glass rounded-full hover:bg-white/10 transition-colors pointer-events-auto group"
        >
          <ChevronLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
        </button>
        <div className="flex gap-3 pointer-events-auto">
          <button 
            onClick={handleBookmark}
            className={cn(
              "p-3 glass rounded-full transition-all duration-300",
              currentBookmark !== undefined ? "text-accent border-accent/50" : "hover:bg-white/10"
            )}
            title="Guardar marcador"
          >
            {currentBookmark !== undefined ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
          </button>
          <button className="p-3 glass rounded-full hover:bg-white/10 transition-colors">
            <MessageSquare size={20} />
          </button>
          <button className="p-3 glass rounded-full hover:bg-white/10 transition-colors">
            <Heart size={20} />
          </button>
        </div>
      </nav>

      {/* Bookmark Toast */}
      <AnimatePresence>
        {showBookmarkToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-black/95 backdrop-blur-xl rounded-full border border-accent/50 text-accent font-mono text-xs uppercase tracking-widest"
          >
            Marcador guardado
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <article className="space-y-12">
        <header className="space-y-4 text-center mb-24">
          <span className="text-accent font-mono text-xs tracking-widest uppercase">Capítulo {chapter.id}</span>
          <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tight">
            <ShinyText 
              text={chapter.title} 
              speed={2} 
              color="#ffffff" 
              shineColor="#f27d26" 
              spread={120}
            />
          </h1>
          <div className="w-12 h-1 bg-accent mx-auto mt-8" />
        </header>

        <div className="prose prose-invert prose-lg max-w-none">
          {chapter.content?.split('\n\n').map((para, i) => (
            <p key={i} className="text-xl leading-relaxed font-light text-white/80 mb-8 first-letter:text-4xl first-letter:font-serif first-letter:text-accent first-letter:mr-1">
              {para}
            </p>
          ))}
        </div>

        <footer className="pt-24 border-t border-white/10 text-center space-y-8">
          <p className="text-muted font-serif italic text-lg">Fin del capítulo {chapter.id}</p>
          
          <div className="flex flex-col items-center gap-4">
            <button 
              onClick={handleBack}
              className="px-12 py-4 glass rounded-full hover:bg-white/10 transition-colors font-bold"
            >
              Volver al Índice
            </button>
          </div>

          <div className="pt-12 space-y-2">
            <p className="text-xs font-mono text-muted/50 tracking-widest uppercase">
              © 2026 SAM C. Todos los derechos reservados.
            </p>
          </div>
        </footer>
      </article>
    </motion.div>
  );
}
