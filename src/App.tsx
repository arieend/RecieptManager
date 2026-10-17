import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Sparkles } from 'lucide-react';

import { 
  auth, googleProvider, signInWithPopup, signOut, saveUserProfile,
  GoogleAuthProvider
} from './firebase';

import { translations, Language } from './translations';
import { ReceiptItem, Person, Session, BeforeInstallPromptEvent } from './types';
import { Scanner } from './components/Scanner';
import { parseReceiptImage, interpretChatCommand, getExchangeRate } from './services/geminiService';
import { compressImage, isPdfFile, prepareReceiptImage } from './utils/imageUtils';
import { createReceiptIntake, ReceiptIntakeError } from './services/receiptIntake';
import { createFrankfurterRateLookup } from './services/rateLookup';
import { createSessionStore } from './services/sessionStore';
import { createFirestoreSessionAdapter } from './services/firestoreSessionAdapter';
import { ErrorBoundary } from './components/ErrorBoundary';
import { syncToCloud } from './services/syncService';
import { createPurchasesSheet } from './services/purchasesSheet';
import { createGoogleSheetsAdapter } from './services/googleSheetsAdapter';
import { createReceiptFiling, SyncFailureKind } from './services/receiptFiling';
import { 
  getSettings, saveSettings, StorageSettings,
  getCurrencySymbol
} from './services/configService';
import { SettingsModal } from './components/SettingsModal';

// UI Components
import { Header } from './components/Header';
import { MainView } from './components/MainView';
import { SessionView } from './components/SessionView';
import { HistoryView } from './components/HistoryView';
import { ProfileView } from './components/ProfileView';
import { ConfirmModal } from './components/Modal';
import { ParsingReview } from './components/ParsingReview';
import { MonthlySummaryView } from './components/MonthlySummaryView';

const rateLookup = createFrankfurterRateLookup();

const receiptIntake = createReceiptIntake({
  parser: parseReceiptImage,
  prepare: prepareReceiptImage,
  rateLookup,
  now: Date.now,
  newId: () => crypto.randomUUID(),
});

const sessionStore = createSessionStore({
  adapter: createFirestoreSessionAdapter(),
  shrinkImage: compressImage,
  now: Date.now,
});

const receiptFiling = createReceiptFiling({ sync: syncToCloud, store: sessionStore });

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  const [view, setView] = useState<'main' | 'history' | 'profile' | 'session' | 'review' | 'monthlySummary'>('main');
  const [isScanning, setIsScanning] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [history, setHistory] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [reviewSession, setReviewSession] = useState<Session | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [processingQueue, setProcessingQueue] = useState<File[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [driveToken, setDriveToken] = useState<string | null>(() => {
    const token = localStorage.getItem('drive_token');
    const timestamp = localStorage.getItem('drive_token_timestamp');
    if (token && timestamp) {
      const now = Date.now();
      const tokenTime = parseInt(timestamp, 10);
      // Google tokens expire in 1 hour (3600 seconds). 
      // We consider it expired after 55 minutes to be safe.
      if (now - tokenTime > 55 * 60 * 1000) {
        localStorage.removeItem('drive_token');
        localStorage.removeItem('drive_token_timestamp');
        return null;
      }
      return token;
    }
    return null;
  });
  const [settings, setSettings] = useState<StorageSettings>(getSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

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
  const currencySymbol = getCurrencySymbol(settings.currency);

  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthLoading(false);
      if (user) {
        unsubscribeSnapshot = sessionStore.subscribe(user.uid, (sessions) => {
          setHistory(sessions);
          setIsQuotaExceeded(false);
        }, (error) => {
          if (error.kind === 'quota-exceeded') {
            setIsQuotaExceeded(true);
            console.warn("Firestore quota exceeded. Real-time updates paused.");
          } else {
            console.error("History subscription error:", error);
          }
        });
      } else {
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        setHistory([]);
      }
    });

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
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
        localStorage.setItem('drive_token_timestamp', Date.now().toString());
      } else {
        console.warn("No access token returned from Google login.");
      }

      await saveUserProfile(user);
    } catch (error) {
      console.error("Login error:", error);
      setShowToast(language === 'he' ? 'שגיאה בהתחברות. נסה שוב.' : 'Login failed. Please try again.');
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setDriveToken(null);
    localStorage.removeItem('drive_token');
    localStorage.removeItem('drive_token_timestamp');
    setView('main');
  };

  const handleScan = async () => {
    setCameraError(null);
    setIsScanning(true);
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser does not support camera access");
      }

      // Step 1: Request basic video to trigger the permission prompt.
      // This is the most compatible way to get the browser to ask the user.
      let stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      
      // Step 2: Once permission is granted, we can see device labels.
      // We try to find the actual back camera.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        // Look for a device that is likely the back camera
        const backCamera = videoDevices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment') ||
          d.label.toLowerCase().includes('0') // Often the main back camera on Android
        );

        if (backCamera && stream.getVideoTracks()[0].label !== backCamera.label) {
          // If we found a better camera, stop the current one and switch
          stream.getTracks().forEach(t => t.stop());
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              deviceId: { exact: backCamera.deviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false
          });
        } else {
          // Otherwise, just try to apply environment constraints to the current track
          const track = stream.getVideoTracks()[0];
          if (track && track.applyConstraints) {
            await track.applyConstraints({
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            });
          }
        }
      } catch (e) {
        console.warn("Refining camera constraints failed, using initial stream", e);
      }
      
      setCameraStream(stream);
    } catch (err: unknown) {
      console.error("Camera request failed:", err);
      const { name, message } = typeof err === 'object' && err !== null ? (err as { name?: unknown; message?: unknown }) : {};
      const lowerMessage = typeof message === 'string' ? message.toLowerCase() : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || lowerMessage.includes('denied')) {
        setCameraError(translations[language].cameraPermissionDenied);
      } else {
        setCameraError(translations[language].cameraGenericError);
      }
    }
  };

  const closeScanner = () => {
    setIsScanning(false);
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraError(null);
  };

  const toggleTheme = () => {
    const newTheme: 'light' | 'dark' = settings.theme === 'light' ? 'dark' : 'light';
    const newSettings = { ...settings, theme: newTheme };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleConnectSpreadsheet = async () => {
    if (!driveToken) {
      handleLogin();
      return;
    }
    
    try {
      setIsSaving(true);
      const spreadsheetName = settings.spreadsheetName || 'Receipts Database';
      const { spreadsheetId, created } = await createPurchasesSheet(createGoogleSheetsAdapter(driveToken)).connect(spreadsheetName);
      setShowToast(created
        ? (language === 'he' ? 'גיליון נוצר בהצלחה!' : 'Spreadsheet created successfully!')
        : (language === 'he' ? 'נמצא גיליון קיים!' : 'Found existing spreadsheet!'));
      
      const newSettings = { ...settings, spreadsheetId, syncToSheets: true };
      setSettings(newSettings);
      saveSettings(newSettings);
    } catch (error) {
      console.error("Error connecting spreadsheet:", error);
      setShowToast(language === 'he' ? 'שגיאה בחיבור הגיליון.' : 'Failed to connect spreadsheet.');
    } finally {
      setIsSaving(false);
    }
  };

  const showIntakeError = (error: unknown) => {
    if (error instanceof ReceiptIntakeError && error.kind === 'unreadable-file') {
      setShowToast(language === 'he' ? 'שגיאה בקריאת הקובץ. אנא ודא שהקובץ תקין.' : 'Failed to read file. Please ensure it is a valid receipt image or PDF.');
    } else if (error instanceof ReceiptIntakeError) {
      setShowToast(t.parseErrorMessage);
    } else {
      setShowToast(language === 'he' ? 'שגיאה בעיבוד הקבלה' : 'Error processing receipt');
    }
  };

  const processReceipt = async (file: File | string) => {
    setIsParsing(true);
    try {
      const draft = await receiptIntake.intake(file, user?.uid || 'anonymous');
      setReviewSession(draft);
      setView('review');
    } catch (error) {
      console.error("Receipt processing error:", error);
      showIntakeError(error);
    } finally {
      setIsParsing(false);
    }
  };

  const processBatch = async (files: File[]) => {
    if (files.length === 0 || !user) return;
    
    setProcessingQueue(files);
    setCurrentBatchIndex(0);
    setIsParsing(true);

    const results: Session[] = [];
    for (let i = 0; i < files.length; i++) {
      setCurrentBatchIndex(i);
      const file = files[i];
      
      try {
        const draft = await receiptIntake.intake(file, user.uid);

        // A batch has no review step, so it always saves; auto-save only governs the review screen.
        if (await saveSession(draft)) results.push(draft);
      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
      }
    }

    setProcessingQueue([]);
    setIsParsing(false);
    
    if (results.length === 1) {
      setCurrentSession(results[0]);
      setView('session');
    } else if (results.length > 1) {
      setView('history');
      setShowToast(language === 'he' ? `עובדו ${results.length} קבלות בהצלחה` : `Successfully processed ${results.length} receipts`);
    }
  };

  /** Shows a toast and resolves once it has cleared. */
  const flashToast = (message: string, ms = 3000) => new Promise<void>((resolve) => {
    setShowToast(message);
    setTimeout(() => { setShowToast(null); resolve(); }, ms);
  });

  const showSyncFailure = (kind: SyncFailureKind) => {
    if (kind === 'drive-auth-expired') {
      setDriveToken(null);
      localStorage.removeItem('drive_token');
      return flashToast(language === 'he' ? 'פג תוקף החיבור ל-Google Drive. אנא התחבר מחדש.' : 'Google Drive session expired. Please reconnect.', 5000);
    }
    if (kind === 'sheets-disabled') return flashToast(t.sheetsApiDisabled, 5000);
    return flashToast(language === 'he' ? 'שגיאה בסנכרון לענן' : 'Error syncing to cloud', 5000);
  };

  /** Resolves to whether the Session was persisted; failures are reported to the user here. */
  const saveSession = async (sessionToUse?: Session): Promise<boolean> => {
    const session = (sessionToUse && typeof sessionToUse === 'object' && 'id' in sessionToUse) ? sessionToUse : currentSession;
    if (!session || !user) return false;
    
    setIsSaving(true);
    try {
      const { sync, spreadsheetId } = await receiptFiling.file(user.uid, session, { settings, driveToken });

      if (spreadsheetId) {
        const newSettings = { ...settings, spreadsheetId };
        setSettings(newSettings);
        saveSettings(newSettings);
      }

      // The Session is saved either way; after a sync failure the user sees that first, then "saved".
      if (typeof sync === 'object') {
        void showSyncFailure(sync.failed).then(() => flashToast(t.sessionSaved));
      } else {
        void flashToast(t.sessionSaved);
      }
      if (!sessionToUse) {
        setView('history');
        setCurrentSession(null);
      }
      return true;
    } catch (error: unknown) {
      console.error("Session save error:", error);
      setShowToast(language === 'he' ? 'שגיאה בשמירה בבסיס הנתונים' : 'Error saving to database');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSession = async (id: string) => {
    // Safeguard against React event objects being passed as first argument
    if (typeof id !== 'string') return;
    
    setConfirmModal({
      isOpen: true,
      title: t.deleteSession,
      message: t.deleteSessionConfirm,
      isDanger: true,
      onConfirm: async () => {
        try {
          await sessionStore.remove(id);
          
          if (currentSession?.id === id) {
            setCurrentSession(null);
            setView('history');
          }
        } catch (error) {
          console.error("Session delete error:", error);
          setShowToast(language === 'he' ? 'שגיאה במחיקה' : 'Error deleting receipt');
        }
      }
    });
  };

  const handleConfirmReview = (session: Session) => {
    setCurrentSession(session);
    setView('session');
    setReviewSession(null);
    
    // Auto-save if enabled
    if (settings.autoSave && user) {
      saveSession(session).catch(err => {
        console.error("Auto-save failed:", err);
        setShowToast(language === 'he' ? 'שגיאה בשמירה אוטומטית' : 'Auto-save failed');
      });
    }
  };

  const handleRescanReview = () => {
    setReviewSession(null);
    setView('main');
    handleScan();
  };

  const handleCancelReview = () => {
    setReviewSession(null);
    setView('main');
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
          price: Number(result.itemPrice || 0) || 0,
          quantity: Number(result.itemQuantity || 1) || 1,
          assignedTo: []
        };
        setCurrentSession({
          ...currentSession,
          items: [...currentSession.items, newItem]
        });
      } else if (result.action === 'change_currency' && result.currency) {
        let rate = 1;
        if (result.currency !== 'ILS') {
          try {
            rate = await getExchangeRate(result.currency, 'ILS');
          } catch (e) {
            console.error("Rate fetch error:", e);
          }
        }
        setCurrentSession({ ...currentSession, currency: result.currency, exchangeRate: rate });
      } else if (result.action === 'update_rate' && result.rate) {
        setCurrentSession({ ...currentSession, exchangeRate: result.rate });
      } else {
        setShowToast(t.commandErrorMessage);
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsProcessingChat(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative w-32 h-32 mb-8">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-8 border-emerald-100 dark:border-emerald-900/30 border-t-emerald-600 rounded-[2.5rem]"
          />
          <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
            <Sparkles size={48} className="animate-pulse" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight italic">LOADING...</h2>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl p-10 border border-slate-100 dark:border-slate-800"
        >
          <div className="w-24 h-24 bg-emerald-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-200 dark:shadow-emerald-900/30">
            <Camera size={48} strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-3 tracking-tight italic">RECEIPT</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-10 font-medium leading-relaxed">{t.uploadDesc}</p>
          
          <button 
            onClick={handleLogin}
            className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl font-black text-lg flex items-center justify-center gap-4 transition-all shadow-xl shadow-emerald-200 dark:shadow-emerald-900/20 active:scale-95"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/controller/google.svg" className="w-7 h-7 bg-white rounded-full p-1.5" alt="Google" />
            {t.loginWithGoogle}
          </button>

          <div className="mt-10 flex justify-center gap-4">
            <button onClick={() => setLanguage('en')} className={`px-4 py-2 rounded-xl font-bold transition-all ${language === 'en' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>English</button>
            <button onClick={() => setLanguage('he')} className={`px-4 py-2 rounded-xl font-bold transition-all ${language === 'he' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>עברית</button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col ${language === 'he' ? 'rtl font-hebrew' : 'ltr'}`} dir={language === 'he' ? 'rtl' : 'ltr'}>
        <Header 
          user={user} 
          language={language} 
          setLanguage={setLanguage} 
          onProfileClick={() => setView('profile')}
          onSettingsClick={() => setIsSettingsOpen(true)}
          onMonthlySummaryClick={() => setView('monthlySummary')}
          onLogout={handleLogout}
          translations={translations}
          spreadsheetId={settings.spreadsheetId}
          spreadsheetName={settings.spreadsheetName}
          driveToken={driveToken}
          onReconnectDrive={handleLogin}
          onCreateSpreadsheet={handleConnectSpreadsheet}
          isCreatingSpreadsheet={isSaving}
          theme={settings.theme}
          onToggleTheme={toggleTheme}
        />

        {isQuotaExceeded && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/30 p-4 flex items-center gap-3 text-amber-800 dark:text-amber-200">
            <Sparkles size={20} className="text-amber-500 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-bold">{t.quotaExceeded}: </span>
              {t.quotaExceededDesc}
            </div>
          </div>
        )}

        {isOffline && (
          <div className="bg-slate-900 text-white p-4 flex items-center gap-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <div className="text-sm">
              <span className="font-bold">{t.offlineMode}: </span>
              {t.offlineDesc}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === 'main' && (
            <motion.div key="main" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col">
              <MainView 
                user={user} 
                history={history} 
                onScan={handleScan}
                onUpload={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 1) {
                    processBatch(files);
                  } else if (files.length === 1) {
                    processReceipt(files[0]);
                  }
                }}
                onUploadFolder={(e) => {
                  const files = Array.from(e.target.files || []).filter(f => 
                    isPdfFile(f) || 
                    f.type.includes('image/') || 
                    /\.(jpg|jpeg|png|webp|heic|heif|pdf|bmp|tiff)$/i.test(f.name)
                  );
                  if (files.length > 0) {
                    processBatch(files);
                  } else {
                    setShowToast(language === 'he' ? 'לא נמצאו קבצי תמונות או PDF בתיקייה' : 'No image or PDF receipt files found in folder');
                  }
                }}
                onHistoryClick={() => setView('history')}
                onMonthlySummaryClick={() => setView('monthlySummary')}
                onSessionClick={(s) => { setCurrentSession(s); setView('session'); }}
                onSettingsClick={() => setIsSettingsOpen(true)}
                translations={translations}
                language={language}
                currencySymbol={currencySymbol}
                driveToken={driveToken}
                onReconnectDrive={handleLogin}
                settings={settings}
              />
            </motion.div>
          )}

          {view === 'session' && currentSession && (
            <motion.div key="session" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <SessionView 
                session={currentSession}
                setSession={setCurrentSession}
                onBack={() => setView('main')}
                onSave={() => saveSession()}
                onDelete={() => deleteSession(currentSession.id)}
                onChat={handleChatCommand}
                translations={translations}
                language={language}
                currencySymbol={currencySymbol}
                settings={settings}
              />
            </motion.div>
          )}

          {view === 'review' && reviewSession && (
            <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <ParsingReview 
                session={reviewSession}
                rateLookup={rateLookup}
                onConfirm={handleConfirmReview}
                onRescan={handleRescanReview}
                onCancel={handleCancelReview}
                language={language}
                translations={translations}
                currencySymbol={currencySymbol}
              />
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex-1 flex flex-col">
              <HistoryView 
                history={history}
                onBack={() => setView('main')}
                onMonthlySummaryClick={() => setView('monthlySummary')}
                onSessionClick={(s) => { setCurrentSession(s); setView('session'); }}
                onDeleteSession={(id) => deleteSession(id)}
                onClearAll={async () => {
                  if (!user) return;
                  try {
                    await sessionStore.removeAll(user.uid);
                  } catch (error) {
                    console.error("Clear history error:", error);
                    setShowToast(language === 'he' ? 'שגיאה במחיקה' : 'Error deleting receipts');
                  }
                }}
                translations={translations}
                language={language}
                currencySymbol={currencySymbol}
                settings={settings}
              />
            </motion.div>
          )}

          {view === 'monthlySummary' && (
            <motion.div key="monthlySummary" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
              <MonthlySummaryView
                history={history}
                onBack={() => setView('main')}
                onSessionClick={(s) => { setCurrentSession(s); setView('session'); }}
                onScanClick={() => { setView('main'); setIsScanning(true); }}
                translations={translations}
                language={language}
                currencySymbol={currencySymbol}
                settings={settings}
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
                deferredPrompt={deferredPrompt}
                onInstall={() => {
                  if (deferredPrompt) {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                      if (choiceResult.outcome === 'accepted') {
                        setDeferredPrompt(null);
                      }
                    });
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scanner */}
        <AnimatePresence>
          {isScanning && (
            <Scanner 
              onCapture={(base64) => {
                closeScanner();
                processReceipt(base64);
              }}
              onClose={closeScanner}
              onFallback={() => {
                closeScanner();
                // Small delay to ensure the Scanner unmounts and the UI is stable
                // before triggering the file picker, which helps on some mobile browsers.
                setTimeout(() => {
                  fileInputRef.current?.click();
                }, 100);
              }}
              language={language}
              initialStream={cameraStream}
              initialError={cameraError}
            />
          )}
        </AnimatePresence>

        {/* Parsing Loader */}
        <AnimatePresence>
          {isParsing && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-white/90 dark:bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="relative w-32 h-32 mb-8">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-8 border-emerald-100 dark:border-emerald-900/30 border-t-emerald-600 rounded-[2.5rem]"
                />
                <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                  <Sparkles size={48} className="animate-pulse" />
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight italic">
                {processingQueue.length > 0 ? t.batchProcessing : t.parsingReceipt}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-xs font-medium">
                {processingQueue.length > 0 
                  ? `${t.processingFile} ${currentBatchIndex + 1} ${t.of} ${processingQueue.length}`
                  : t.uploadDesc}
              </p>
              {processingQueue.length > 0 && (
                <div className="w-64 h-2 bg-slate-100 dark:bg-slate-800 rounded-full mt-6 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentBatchIndex + 1) / processingQueue.length) * 100}%` }}
                    className="h-full bg-emerald-600"
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modals */}
        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSave={(newSettings) => {
            setSettings(newSettings);
            saveSettings(newSettings);
            setShowToast(t.settingsSaved);
            setTimeout(() => setShowToast(null), 3000);
          }}
          t={t}
          language={language}
          onCreateSpreadsheet={handleConnectSpreadsheet}
          isCreatingSpreadsheet={isSaving}
        />

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
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] px-8 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-3xl font-bold shadow-2xl flex items-center gap-3"
            >
              <Sparkles size={20} className="text-emerald-400" />
              {showToast}
            </motion.div>
          )}
        </AnimatePresence>

        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              processReceipt(file);
              e.target.value = '';
            }
          }} 
          accept="image/*,application/pdf,.pdf,.heic,.heif" 
          className="sr-only" 
          aria-hidden="true"
        />
      </div>
    </ErrorBoundary>
  );
}
