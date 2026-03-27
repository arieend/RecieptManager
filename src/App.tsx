import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Sparkles } from 'lucide-react';

import { 
  auth, db, googleProvider, signInWithPopup, signOut, 
  collection, addDoc, query, where, onSnapshot, orderBy, 
  deleteDoc, doc, setDoc, handleFirestoreError, OperationType,
  GoogleAuthProvider
} from './firebase';

import { translations, Language } from './translations';
import { ReceiptItem, Person, Session } from './types';
import { Scanner } from './components/Scanner';
import { parseReceiptImage, interpretChatCommand } from './services/geminiService';
import { resizeImage } from './utils/imageUtils';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getOrCreateFolder, uploadFileToDrive } from './services/driveService';

// UI Components
import { Header } from './components/Header';
import { MainView } from './components/MainView';
import { SessionView } from './components/SessionView';
import { HistoryView } from './components/HistoryView';
import { ProfileView } from './components/ProfileView';
import { ConfirmModal } from './components/Modal';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [view, setView] = useState<'main' | 'history' | 'profile' | 'session'>('main');
  const [isScanning, setIsScanning] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [history, setHistory] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [driveToken, setDriveToken] = useState<string | null>(localStorage.getItem('drive_token'));

  // Modal States
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[language];

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        const q = query(
          collection(db, 'sessions'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
          setHistory(sessions);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'sessions');
        });
      } else {
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        setHistory([]);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Extract Google Drive token
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (token) {
        setDriveToken(token);
        localStorage.setItem('drive_token', token);
      }

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setDriveToken(null);
    localStorage.removeItem('drive_token');
    setView('main');
  };

  const processReceipt = async (file: File | string) => {
    setIsParsing(true);
    try {
      let base64: string;
      let mimeType = "image/jpeg";

      if (typeof file === 'string') {
        base64 = file;
      } else {
        mimeType = file.type;
        if (file.type === 'application/pdf') {
          // If PDF is too large (> 1MB), we might have issues saving it later
          // We can't easily compress PDF, but we can read it
          base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          
          // If PDF is very large, warn user or try to handle it
          if (base64.length > 1000000) {
            console.warn("PDF is very large, might be cleared on save.");
          }
        } else {
          base64 = await resizeImage(file);
        }
      }

      const result = await parseReceiptImage(base64, mimeType);
      
      let createdAt = new Date().toISOString();
      if (result.date) {
        try {
          const extractedDate = new Date(result.date + (result.time ? `T${result.time}` : ''));
          if (!isNaN(extractedDate.getTime())) {
            createdAt = extractedDate.toISOString();
          }
        } catch (e) {
          console.warn("Failed to parse extracted date:", result.date, result.time);
        }
      }
      
      const newSession: Session = {
        id: Date.now().toString(),
        userId: user?.uid || 'anonymous',
        storeName: result.storeName || 'Unknown Store',
        createdAt,
        items: (result.items || []).map((item: any, idx: number) => ({
          id: `item-${idx}`,
          name: item.name,
          price: item.price,
          assignedTo: []
        })),
        people: [],
        tax: result.tax || 0,
        tip: result.tip || 0,
        total: result.total || 0,
        imageUrl: base64
      };

      setCurrentSession(newSession);
      setView('session');
    } catch (error) {
      console.error("Parsing error:", error);
      setShowToast(t.parseErrorMessage);
    } finally {
      setIsParsing(false);
    }
  };

  const saveSession = async () => {
    if (!currentSession || !user) return;
    setIsSaving(true);
    try {
      let imageUrl = currentSession.imageUrl;
      let driveFileId = currentSession.driveFileId;
      let driveLink = currentSession.driveLink;

      // Upload to Google Drive if token is available and not already uploaded
      if (driveToken && imageUrl && !driveFileId) {
        try {
          const folderId = await getOrCreateFolder(driveToken, 'RECEIPTS');
          const mimeType = imageUrl.startsWith('data:application/pdf') ? 'application/pdf' : 'image/jpeg';
          const fileName = `${currentSession.storeName || 'Receipt'}_${new Date(currentSession.createdAt).getTime()}.${mimeType === 'application/pdf' ? 'pdf' : 'jpg'}`;
          
          const driveFile = await uploadFileToDrive(driveToken, folderId, fileName, imageUrl, mimeType);
          driveFileId = driveFile.id;
          driveLink = driveFile.webViewLink;
          console.log("Uploaded to Drive:", driveFile);
        } catch (driveError) {
          console.error("Drive upload error:", driveError);
          setShowToast(language === 'he' ? 'שגיאה בשמירה ב-Google Drive' : 'Error saving to Google Drive');
          // If token expired, clear it so user can reconnect
          if (driveError instanceof Error && (driveError.message.includes('invalid_grant') || driveError.message.includes('401'))) {
            setDriveToken(null);
            localStorage.removeItem('drive_token');
          }
        }
      }
      
      // Firestore document limit is 1MB. 
      // Base64 is ~33% larger than binary. 
      // 800,000 chars is roughly 600KB, which is safe.
      if (imageUrl && imageUrl.length > 800000) {
        if (imageUrl.startsWith('data:image/')) {
          try {
            // Try more aggressive compression
            const img = new Image();
            img.src = imageUrl;
            await new Promise(resolve => img.onload = resolve);
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // Scale down to max 800px if it's still too big
              const scale = Math.min(1, 800 / Math.max(img.width, img.height));
              canvas.width = img.width * scale;
              canvas.height = img.height * scale;
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              // Lower quality to 0.4
              imageUrl = canvas.toDataURL('image/jpeg', 0.4);
            }
          } catch (e) {
            console.error("Compression error:", e);
          }
        }
        
        // Final check after attempt to compress
        // Only clear if we have a Drive link as fallback, or if it's absolutely necessary to prevent Firestore failure
        if (imageUrl && imageUrl.length > 950000) {
          if (driveLink) {
            console.warn("Image still too large for Firestore, clearing as Drive link exists.");
            imageUrl = "";
          } else {
            console.warn("Image very large for Firestore, but no Drive link. Keeping it and hoping for the best.");
          }
        }
      }

      const sessionToSave: any = {
        ...currentSession,
        userId: user.uid,
        imageUrl: imageUrl || "",
        updatedAt: new Date().toISOString()
      };

      // Ensure we don't have undefined values
      if (driveFileId) sessionToSave.driveFileId = driveFileId;
      if (driveLink) sessionToSave.driveLink = driveLink;

      // If it's an existing session (has a Firestore ID), update it
      // Otherwise, create a new one
      const isExisting = history.some(s => s.id === currentSession.id);
      
      if (isExisting) {
        const docId = currentSession.id;
        const dataToUpdate = { ...sessionToSave };
        delete dataToUpdate.id;
        await setDoc(doc(db, 'sessions', docId), dataToUpdate, { merge: true });
      } else {
        const dataToSave = { ...sessionToSave };
        delete dataToSave.id;
        await addDoc(collection(db, 'sessions'), dataToSave);
      }

      setShowToast(t.sessionSaved);
      setTimeout(() => setShowToast(null), 3000);
      setView('history');
      setCurrentSession(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessions');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSession = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: t.deleteSession,
      message: t.deleteSessionConfirm,
      isDanger: true,
      onConfirm: async () => {
        try {
          // Only delete from Firestore if it's actually there (not a local-only session)
          const existsInFirestore = history.some(s => s.id === id);
          if (existsInFirestore) {
            await deleteDoc(doc(db, 'sessions', id));
          }
          
          if (currentSession?.id === id) {
            setCurrentSession(null);
            setView('history');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `sessions/${id}`);
        }
      }
    });
  };

  const handleChatCommand = async (command: string) => {
    if (!command.trim() || !currentSession || isProcessingChat) return;

    setIsProcessingChat(true);
    try {
      const result = await interpretChatCommand(command, currentSession.items, currentSession.people);
      
      if (result.action === 'assign' && result.itemId && result.personId) {
        const updatedItems = currentSession.items.map(item => 
          item.id === result.itemId 
            ? { 
                ...item, 
                assignedTo: item.assignedTo.includes(result.personId)
                  ? item.assignedTo
                  : [...item.assignedTo, result.personId]
              } 
            : item
        );
        setCurrentSession({ ...currentSession, items: updatedItems });
      } else if (result.action === 'add_person' && result.personName) {
        const newPerson: Person = {
          id: `person-${Date.now()}`,
          name: result.personName,
          color: `hsl(${Math.random() * 360}, 70%, 50%)`
        };
        setCurrentSession({
          ...currentSession,
          people: [...currentSession.people, newPerson]
        });
      } else if (result.action === 'add_item' && result.itemName && result.itemPrice) {
        const newItem: ReceiptItem = {
          id: `item-${Date.now()}`,
          name: result.itemName,
          price: result.itemPrice,
          assignedTo: []
        };
        setCurrentSession({
          ...currentSession,
          items: [...currentSession.items, newItem]
        });
      } else {
        setShowToast(t.commandErrorMessage);
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsProcessingChat(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-100"
        >
          <div className="w-24 h-24 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-200">
            <Camera size={48} strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-3 tracking-tight italic">RECEIPT</h1>
          <p className="text-slate-500 mb-10 font-medium leading-relaxed">{t.uploadDesc}</p>
          
          <button 
            onClick={handleLogin}
            className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl font-black text-lg flex items-center justify-center gap-4 transition-all shadow-xl shadow-emerald-200 active:scale-95"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/controller/google.svg" className="w-7 h-7 bg-white rounded-full p-1.5" alt="Google" />
            {t.loginWithGoogle}
          </button>

          <div className="mt-10 flex justify-center gap-4">
            <button onClick={() => setLanguage('en')} className={`px-4 py-2 rounded-xl font-bold transition-all ${language === 'en' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:bg-slate-100'}`}>English</button>
            <button onClick={() => setLanguage('he')} className={`px-4 py-2 rounded-xl font-bold transition-all ${language === 'he' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400 hover:bg-slate-100'}`}>עברית</button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen bg-slate-50 flex flex-col ${language === 'he' ? 'rtl font-hebrew' : 'ltr'}`} dir={language === 'he' ? 'rtl' : 'ltr'}>
        <Header 
          user={user} 
          language={language} 
          setLanguage={setLanguage} 
          onProfileClick={() => setView('profile')}
          onLogout={handleLogout}
          translations={translations}
        />

        <AnimatePresence mode="wait">
          {view === 'main' && (
            <motion.div key="main" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col">
              <MainView 
                user={user} 
                history={history} 
                onScan={() => setIsScanning(true)}
                onUpload={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processReceipt(file);
                }}
                onHistoryClick={() => setView('history')}
                onSessionClick={(s) => { setCurrentSession(s); setView('session'); }}
                translations={translations}
                language={language}
              />
            </motion.div>
          )}

          {view === 'session' && currentSession && (
            <motion.div key="session" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <SessionView 
                session={currentSession}
                setSession={setCurrentSession}
                onBack={() => setView('main')}
                onSave={saveSession}
                onDelete={() => deleteSession(currentSession.id)}
                onChat={handleChatCommand}
                translations={translations}
                language={language}
              />
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex-1 flex flex-col">
              <HistoryView 
                history={history}
                onBack={() => setView('main')}
                onSessionClick={(s) => { setCurrentSession(s); setView('session'); }}
                onDeleteSession={deleteSession}
                onClearAll={async () => {
                  for (const session of history) {
                    await deleteDoc(doc(db, 'sessions', session.id));
                  }
                }}
                translations={translations}
                language={language}
              />
            </motion.div>
          )}

          {view === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex-1 flex flex-col">
              <ProfileView 
                user={user}
                onBack={() => setView('main')}
                onLogout={handleLogout}
                onReconnectDrive={handleLogin}
                driveToken={driveToken}
                translations={translations}
                language={language}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scanner */}
        <AnimatePresence>
          {isScanning && (
            <Scanner 
              onCapture={(base64) => {
                setIsScanning(false);
                processReceipt(base64);
              }}
              onClose={() => setIsScanning(false)}
              onFallback={() => {
                setIsScanning(false);
                fileInputRef.current?.click();
              }}
              language={language}
            />
          )}
        </AnimatePresence>

        {/* Parsing Loader */}
        <AnimatePresence>
          {isParsing && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="relative w-32 h-32 mb-8">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-8 border-emerald-100 border-t-emerald-600 rounded-[2.5rem]"
                />
                <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                  <Sparkles size={48} className="animate-pulse" />
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight italic">{t.parsingReceipt}</h2>
              <p className="text-slate-500 max-w-xs font-medium">{t.uploadDesc}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modals */}
        <ConfirmModal 
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={t.confirm}
          cancelLabel={t.cancel}
          isDanger={confirmModal.isDanger}
        />

        {/* Toast */}
        <AnimatePresence>
          {showToast && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] px-8 py-4 bg-slate-900 text-white rounded-3xl font-bold shadow-2xl flex items-center gap-3"
            >
              <Sparkles size={20} className="text-emerald-400" />
              {showToast}
            </motion.div>
          )}
        </AnimatePresence>

        <input type="file" ref={fileInputRef} onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processReceipt(file);
        }} accept="image/*,application/pdf" className="hidden" />
      </div>
    </ErrorBoundary>
  );
}
