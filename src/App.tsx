import { useState, useEffect, useCallback } from 'react';
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
  X
} from 'lucide-react';
import { CHAPTERS, type Chapter } from './constants';
import { cn } from './lib/utils';
import ShinyText from './components/ShinyText';

export default function App() {
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [view, setView] = useState<'home' | 'reading'>('home');
  const [bookmarks, setBookmarks] = useState<Record<number, number>>({});
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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

    return () => clearTimeout(timer);
  }, []);

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

  return (
    <div className="min-h-screen bg-bg text-ink selection:bg-accent selection:text-bg">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <LoadingScreen key="loading" />
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <AnimatePresence mode="wait">
              {view === 'home' ? (
                <HomeView 
                  key="home" 
                  onChapterClick={handleChapterClick} 
                  bookmarks={bookmarks}
                />
              ) : (
                <ReadingView 
                  key="reading" 
                  chapter={selectedChapter!} 
                  onBack={goBack} 
                  onSaveBookmark={saveBookmark}
                  currentBookmark={bookmarks[selectedChapter!.id]}
                />
              )}
            </AnimatePresence>
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
              className="relative w-full max-w-md glass p-8 rounded-3xl border-accent/30 shadow-2xl text-center space-y-6"
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

function LoadingScreen() {
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
          className="flex"
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
  bookmarks 
}: { 
  onChapterClick: (c: Chapter) => void; 
  bookmarks: Record<number, number>;
  key?: string 
}) {
  const lastBookmarkedId = Object.keys(bookmarks).map(Number).sort((a, b) => b - a)[0];
  const lastChapter = CHAPTERS.find(c => c.id === lastBookmarkedId);

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
              <span>27 Capítulos</span>
            </div>
            <div className="flex items-center gap-2">
              <Heart size={16} className="text-accent" />
              <span>1.2k Lecturas</span>
            </div>
          </div>

          <div className="pt-6 flex flex-wrap gap-4">
            <button 
              onClick={() => onChapterClick(CHAPTERS[0])}
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
          <List size={20} className="text-muted" />
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {CHAPTERS.map((chapter, index) => (
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
  key?: string 
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
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 px-6 py-3 glass rounded-full border-accent/50 text-accent font-mono text-xs uppercase tracking-widest"
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
        </footer>
      </article>
    </motion.div>
  );
}
