import React, { useState, useRef, useEffect } from 'react';
import { IsraelFlag, USFlag } from './components/Flags';
import { 
  Upload, 
  Send, 
  Receipt, 
  Tag, 
  MessageSquare, 
  CheckCircle2, 
  Loader2,
  Trash2,
  Plus,
  X,
  LogIn,
  LogOut,
  History,
  User,
  Save,
  Edit2,
  Calendar,
  Camera,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReceiptData, ReceiptItem, PersonTotal, ChatMessage, UserProfile, BillSession } from './types';
import { parseReceiptImage, interpretChatCommand, transcribeStoreName } from './services/geminiService';
import { resizeImage } from './utils/imageUtils';
import { Language, translations } from './translations';
import { auth, db, googleProvider, signInWithPopup, signOut, collection, doc, setDoc, getDoc, addDoc, query, where, onSnapshot, orderBy, deleteDoc, getDocs, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User as FirebaseUser, GoogleAuthProvider } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import { getOrCreateFolder, uploadPdfToDrive, checkFileExists } from './services/driveService';
import Markdown from 'react-markdown';

import { Scanner } from './components/Scanner';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<BillSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; type: 'new' | 'reset' | 'deleteItem' | 'cleanHistory' | 'deleteSession' | null; itemId?: string }>({ isOpen: false, type: null });
  
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [showReceiptUrl, setShowReceiptUrl] = useState<string | null>(null);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showAddItem, setShowAddItem] = useState<{ name: string; price: string; category?: string; id?: string } | null>(null);
  const [fullscreenPane, setFullscreenPane] = useState<'left' | 'right' | null>(null);
  const [assigningItem, setAssigningItem] = useState<string | null>(null);
  const [pendingAssignItemId, setPendingAssignItemId] = useState<string | null>(null);
  const [newPersonName, setNewPersonName] = useState('');
  const [people, setPeople] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currency, setCurrency] = useState('₪');
  const [language, setLanguage] = useState<Language>('he');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const t = translations[language];

  // Auth & Profile Sync
  useEffect(() => {
    let unsubUser: (() => void) | undefined;
    let unsubHistory: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Fetch or create profile
        const userRef = doc(db, 'users', u.uid);
        unsubUser = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile = { uid: u.uid, displayName: u.displayName || 'User', email: u.email || '' };
            setDoc(userRef, newProfile).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${u.uid}`));
            setUserProfile(newProfile);
          }
        }, (err) => handleFirestoreError(err, OperationType.GET, `users/${u.uid}`));

        // Fetch history
        const historyQuery = query(
          collection(db, 'sessions'),
          where('ownerUid', '==', u.uid),
          orderBy('date', 'desc')
        );
        unsubHistory = onSnapshot(historyQuery, (snap) => {
          const sessions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BillSession));
          setHistory(sessions);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'sessions'));
      } else {
        setUserProfile(null);
        setHistory([]);
        if (unsubUser) unsubUser();
        if (unsubHistory) unsubHistory();
      }
    });

    return () => {
      unsubscribe();
      if (unsubUser) unsubUser();
      if (unsubHistory) unsubHistory();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogin = async () => {
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        console.log("[Auth] Google Drive token obtained during login");
        sessionStorage.setItem('driveAccessToken', credential.accessToken);
      }
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem('driveAccessToken');
      setReceiptData(null);
      setPeople([]);
      setMessages([]);
      setCurrentSessionId(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleCleanHistory = async () => {
    if (!user) return;
    try {
      const historyQuery = query(collection(db, 'sessions'), where('ownerUid', '==', user.uid));
      const snapshot = await getDocs(historyQuery).catch(err => handleFirestoreError(err, OperationType.LIST, 'sessions'));
      if (snapshot) {
        const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, 'sessions', docSnap.id)).catch(err => handleFirestoreError(err, OperationType.DELETE, `sessions/${docSnap.id}`)));
        await Promise.all(deletePromises);
      }
      setHistory([]);
      if (currentSessionId) {
        setCurrentSessionId(null);
      }
    } catch (error) {
      console.error("Error cleaning history:", error);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'sessions', sessionId)).catch(err => handleFirestoreError(err, OperationType.DELETE, `sessions/${sessionId}`));
      setHistory(prev => prev.filter(session => session.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const compressImage = (base64: string, maxWidth: number = 800): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64);

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = (err) => reject(err);
    });
  };

  const handleSaveSession = async () => {
    if (!user || !receiptData) return;
    setSaving(true);
    try {
      let compressedImage = null;
      let driveFileUrl = null;

      const isDriveLink = receiptImage?.startsWith('https://drive.google.com/');

      if (receiptImage && !isDriveLink) {
        const isPdf = receiptImage.startsWith('data:application/pdf');
        compressedImage = isPdf ? receiptImage : await compressImage(receiptImage);

        let token = sessionStorage.getItem('driveAccessToken');
        if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
          token = null;
          sessionStorage.removeItem('driveAccessToken');
        }

        let uploadSuccess = false;
        let retryCount = 0;

        while (!uploadSuccess && retryCount < 2) {
          if (!token) {
            try {
              console.log(`[Drive] Requesting access token (attempt ${retryCount + 1})...`);
              // Use 'consent' to ensure we get a fresh token with all scopes
              googleProvider.setCustomParameters({ prompt: 'consent' });
              const result = await signInWithPopup(auth, googleProvider);
              const credential = GoogleAuthProvider.credentialFromResult(result);
              token = credential?.accessToken || null;
              
              if (token) {
                console.log("[Drive] New access token obtained");
                sessionStorage.setItem('driveAccessToken', token);
              } else {
                console.warn("[Drive] No access token returned from popup");
                break;
              }
            } catch (e) {
              console.error("[Drive] Failed to get Drive token via popup", e);
              break;
            }
          }

          if (token) {
            try {
              const now = new Date();
              const year = now.getFullYear().toString();
              const month = (now.getMonth() + 1).toString().padStart(2, '0');
              const day = now.getDate().toString().padStart(2, '0');
              const hours = now.getHours().toString().padStart(2, '0');
              const minutes = now.getMinutes().toString().padStart(2, '0');
              const seconds = now.getSeconds().toString().padStart(2, '0');
              const datetime = `${year}${month}${day}_${hours}${minutes}${seconds}`;
              const transcribedName = await transcribeStoreName(receiptData.storeName || 'Receipt');
              const brand = transcribedName.replace(/[^a-zA-Z0-9]/g, '_');
              const totalsum = receiptData.total.toFixed(2);
              const fileName = `${brand}_${datetime}_${totalsum}.pdf`;

              console.log(`[Drive] Uploading ${fileName} to Drive...`);
              const rootFolderId = await getOrCreateFolder(token, 'Receipts');
              const yearFolderId = await getOrCreateFolder(token, year, rootFolderId);
              const monthFolderId = await getOrCreateFolder(token, month, yearFolderId);

              const existingFileUrl = await checkFileExists(token, fileName, monthFolderId);
              
              if (existingFileUrl) {
                console.log("[Drive] File already exists, using existing URL");
                driveFileUrl = existingFileUrl;
              } else {
                let pdfBlob: Blob;
                if (isPdf) {
                  const base64Data = receiptImage.split(',')[1];
                  const byteCharacters = atob(base64Data);
                  const byteNumbers = new Array(byteCharacters.length);
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  pdfBlob = new Blob([byteArray], { type: 'application/pdf' });
                } else {
                  const pdf = new jsPDF();
                  const imgProps = pdf.getImageProperties(compressedImage);
                  const pdfWidth = pdf.internal.pageSize.getWidth();
                  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                  pdf.addImage(compressedImage, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                  pdfBlob = pdf.output('blob');
                }

                driveFileUrl = await uploadPdfToDrive(token, pdfBlob, fileName, monthFolderId);
                console.log("[Drive] Upload successful");
              }
              uploadSuccess = true;
            } catch (e: any) {
              const errorMsg = e?.message || '';
              console.warn(`[Drive] Upload attempt ${retryCount + 1} failed:`, errorMsg);
              
              if (errorMsg.includes('401') || errorMsg.includes('UNAUTHENTICATED') || errorMsg.includes('Invalid Credentials')) {
                console.log("[Drive] Token expired or invalid, clearing and retrying...");
                sessionStorage.removeItem('driveAccessToken');
                token = null;
                retryCount++;
                continue;
              }

              if (errorMsg.includes('Google Drive API has not been used in project') || errorMsg.includes('SERVICE_DISABLED')) {
                const urlMatch = errorMsg.match(/https:\/\/console\.(developers|cloud)\.google\.com\/apis\/api\/drive\.googleapis\.com\/overview\?project=\d+/);
                const enableUrl = urlMatch ? urlMatch[0] : 'https://console.cloud.google.com/apis/library/drive.googleapis.com';
                setMessages(prev => [...prev, {
                  id: Date.now().toString() + '-err',
                  role: 'assistant',
                  content: `⚠️ **Google Drive API is disabled.**\n\nPlease enable the Google Drive API in your Google Cloud Console to save receipts to Drive. You can enable it here: [Google Cloud Console](${enableUrl})\n\nThe session was saved, but the receipt image was not uploaded to Drive.`
                }]);
              } else {
                console.error("[Drive] Non-auth error during upload:", e);
                setMessages(prev => [...prev, {
                  id: Date.now().toString() + '-err',
                  role: 'assistant',
                  content: "⚠️ Failed to upload receipt to Google Drive. The session was saved without the Drive link."
                }]);
              }
              break;
            }
          } else {
            break;
          }
        }
      } else if (isDriveLink) {
        driveFileUrl = receiptImage;
      }

      const sessionData = {
        ownerUid: user.uid,
        date: Timestamp.now(),
        receiptData,
        people,
        totals: calculateTotals(),
        currency,
        ...(driveFileUrl ? { receiptImageUrl: driveFileUrl } : (compressedImage && { receiptImageUrl: compressedImage }))
      };

      if (currentSessionId) {
        await setDoc(doc(db, 'sessions', currentSessionId), sessionData, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `sessions/${currentSessionId}`));
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: "Session updated in your history!"
        }]);
      } else {
        const docRef = await addDoc(collection(db, 'sessions'), sessionData).catch(err => handleFirestoreError(err, OperationType.CREATE, 'sessions'));
        if (docRef) {
          setCurrentSessionId(docRef.id);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: "Session saved to your history!"
          }]);
        }
      }
    } catch (error: any) {
      console.error("Save error:", error);
      const errorMessage = error?.message || (error?.isTrusted ? "Image processing failed. Try a different image." : "Failed to save session.");
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Error: ${errorMessage}`
      }]);
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = () => {
    if (!showAddItem) return;
    const { name, price: priceStr, category, id } = showAddItem;
    if (name && priceStr) {
      const price = parseFloat(priceStr);
      if (isNaN(price)) return;
      
      setReceiptData(prev => {
        if (!prev) return { items: [{ id: `item-${Date.now()}`, name, price, category: category || 'Uncategorized', assignedTo: [] }], tax: 0, tip: 0, total: price };
        
        if (id) {
          // Edit
          const item = prev.items.find(i => i.id === id);
          if (!item) return prev;
          const diff = price - item.price;
          return {
            ...prev,
            items: prev.items.map(i => i.id === id ? { ...i, name, price, category: category || 'Uncategorized' } : i),
            total: prev.total + diff
          };
        } else {
          // Add
          const newItem = { id: `item-${Date.now()}`, name, price, category: category || 'Uncategorized', assignedTo: [] };
          const newItems = [...prev.items, newItem];
          return {
            ...prev,
            items: newItems,
            total: prev.total + price
          };
        }
      });
      setShowAddItem(null);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    setConfirmModal({ isOpen: true, type: 'deleteItem', itemId });
  };

  const handleAddPerson = () => {
    const name = newPersonName.trim();
    if (name) {
      setPeople(prev => [...new Set([...prev, name])]);
      
      if (pendingAssignItemId) {
        setReceiptData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            items: prev.items.map(i => 
              i.id === pendingAssignItemId 
                ? { ...i, assignedTo: [...new Set([...i.assignedTo, name])] }
                : i
            )
          };
        });
        setPendingAssignItemId(null);
      }
      
      setNewPersonName('');
      setShowAddPerson(false);
    }
  };

  const handleRemovePerson = (name: string) => {
    setPeople(prev => prev.filter(p => p !== name));
    setReceiptData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map(item => ({
          ...item,
          assignedTo: item.assignedTo.filter(p => p !== name)
        }))
      };
    });
  };

  const handleUpdateProfile = async (newName: string) => {
    if (!user) return;
    try {
      const updatedProfile = { 
        uid: user.uid,
        displayName: newName, 
        email: userProfile?.email || user.email || '' 
      };
      await setDoc(doc(db, 'users', user.uid), updatedProfile, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
      setUserProfile(prev => prev ? { ...prev, displayName: newName } : updatedProfile);
    } catch (error) {
      console.error("Profile update error:", error);
    }
  };

  const loadSession = (session: BillSession) => {
    setReceiptData(session.receiptData);
    setPeople(session.people);
    if (session.currency) setCurrency(session.currency);
    if (session.receiptImageUrl) {
      setReceiptImage(session.receiptImageUrl);
    } else {
      setReceiptImage(null);
    }
    if (session.id) setCurrentSessionId(session.id);
    setMessages([{
      id: 'loaded',
      role: 'assistant',
      content: `Loaded session from ${new Date(session.date.seconds * 1000).toLocaleDateString()}.`
    }]);
    setShowHistory(false);
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset input value to allow re-selecting the same file
    e.target.value = '';
    
    processFile(file);
  };

  const processFile = async (fileOrBase64: File | string) => {
    const isBase64 = typeof fileOrBase64 === 'string';
    const fileName = isBase64 ? 'captured_photo.jpg' : (fileOrBase64 as File).name;
    const fileType = isBase64 ? 'image/jpeg' : (fileOrBase64 as File).type;

    console.log(`[File Upload] Starting processing for: ${fileName} (${fileType})`);

    setParsing(true);
    setCurrentSessionId(null);
    setReceiptData(null);
    setReceiptImage(null);

    try {
      let processedBase64: string;
      const mimeType = fileType || 'image/jpeg';

      if (isBase64) {
        processedBase64 = fileOrBase64 as string;
      } else if (fileType.startsWith('image/')) {
        try {
          console.log("[File Upload] Resizing image...");
          processedBase64 = await resizeImage(fileOrBase64 as File);
          console.log("[File Upload] Image resized successfully");
        } catch (resizeErr) {
          console.warn("[File Upload] Failed to resize image, falling back to FileReader:", resizeErr);
          processedBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(fileOrBase64 as File);
          });
        }
      } else {
        console.log("[File Upload] Reading non-image file...");
        processedBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(fileOrBase64 as File);
        });
      }

      setReceiptImage(processedBase64);
      
      console.log("[File Upload] Sending to Gemini for parsing...");
      const base64 = processedBase64.includes(',') ? processedBase64.split(',')[1] : processedBase64;
      const data = await parseReceiptImage(base64, mimeType);
      console.log("[File Upload] Gemini parsing complete:", data.storeName);
      
      setReceiptData(data);
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: t.welcomeMessage
      }]);
    } catch (error: any) {
      console.error("[File Upload] Error processing file:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: `${t.parseErrorMessage}\n\nError: ${error?.message || 'Unknown error'}`
      }]);
    } finally {
      console.log("[File Upload] Done processing, setting parsing to false");
      setParsing(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !receiptData || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const result = await interpretChatCommand(input, receiptData.items, people, language);
      
      // Update people from newPeople and assignments
      const assignedPeople = result.assignments.flatMap(a => a.personNames);
      const allNewPeople = [...new Set([...result.newPeople, ...assignedPeople])];
      
      if (allNewPeople.length > 0) {
        setPeople(prev => [...new Set([...prev, ...allNewPeople])]);
      }

      // Update assignments
      setReceiptData(prev => {
        if (!prev) return null;
        const newItems = prev.items.map(item => {
          const assignment = result.assignments.find(a => a.itemId === item.id);
          if (assignment) {
            return { ...item, assignedTo: [...new Set([...item.assignedTo, ...assignment.personNames])] };
          }
          return item;
        });
        return { ...prev, items: newItems };
      });

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.feedback
      }]);
    } catch (error) {
      console.error("Error interpreting command:", error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: t.commandErrorMessage
      }]);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (): PersonTotal[] => {
    if (!receiptData) return [];

    const itemSubtotals: Record<string, number> = receiptData.items.reduce((acc, item) => {
      if (item.assignedTo.length === 0) return acc;
      const share = item.price / item.assignedTo.length;
      item.assignedTo.forEach(person => {
        acc[person] = (acc[person] || 0) + share;
      });
      return acc;
    }, {} as Record<string, number>);

    const subtotalsArray = Object.values(itemSubtotals);
    const totalSubtotal = subtotalsArray.reduce((sum, val) => sum + val, 0);
    
    return people.map(person => {
      const subtotal = itemSubtotals[person] || 0;
      const ratio = totalSubtotal > 0 ? subtotal / totalSubtotal : 0;
      const tax = receiptData.tax * ratio;
      const tip = receiptData.tip * ratio;
      return {
        name: person,
        subtotal,
        tax,
        tip,
        total: subtotal + tax + tip
      };
    });
  };

  const personTotals = calculateTotals();
  const unassignedItems = receiptData?.items.filter(i => i.assignedTo.length === 0) || [];

  return (
    <div className="h-[100dvh] bg-zinc-50 text-zinc-900 font-sans flex flex-col" dir={language === 'he' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="h-16 border-b border-zinc-200 bg-white flex items-center px-6 justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
              <Receipt size={18} />
            </div>
            <h1 className="font-bold text-xl tracking-tight">{t.appTitle}</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.language}</span>
              <div className="flex bg-zinc-100 rounded-lg p-1">
                <button 
                  onClick={() => setLanguage('he')}
                  className={`px-2 py-1 rounded-md text-xs transition-all ${language === 'he' ? 'bg-white shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                  title="עברית"
                >
                  <IsraelFlag />
                </button>
                <button 
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-1 rounded-md text-xs transition-all ${language === 'en' ? 'bg-white shadow-sm' : 'opacity-50 hover:opacity-100'}`}
                  title="English"
                >
                  <USFlag />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.currency}</span>
              <select 
                value={currency} 
                onChange={(e) => setCurrency(e.target.value)}
                className="bg-zinc-100 border-none rounded-lg py-1 px-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer"
                dir="ltr"
              >
                <option value="₪">₪ (NIS)</option>
                <option value="$">$ (USD)</option>
                <option value="€">€ (EUR)</option>
                <option value="£">£ (GBP)</option>
              </select>
            </div>
            {receiptData && (
              <button 
                onClick={() => setConfirmModal({ isOpen: true, type: 'new' })}
                className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">{t.newReceipt}</span>
              </button>
            )}
            {user ? (
              <div className="flex items-center gap-2 md:gap-3">
                <button 
                  onClick={() => setShowHistory(true)}
                  className="p-2 text-zinc-500 hover:text-emerald-600 hover:bg-zinc-100 rounded-full transition-all"
                  title={t.history}
                >
                  <History size={20} />
                </button>
                <button 
                  onClick={() => setShowProfile(true)}
                  className="flex items-center gap-2 p-1 pr-3 bg-zinc-100 hover:bg-zinc-200 rounded-full transition-all"
                >
                  <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs">
                    {userProfile?.displayName?.[0] || 'U'}
                  </div>
                  <span className="hidden md:inline text-xs font-medium text-zinc-700">{userProfile?.displayName}</span>
                </button>
                <button 
                  onClick={() => setConfirmModal({ isOpen: true, type: 'reset' })}
                  className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                  title={t.reset}
                >
                  <Trash2 size={18} />
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-zinc-400 hover:text-red-600 transition-colors"
                  title={t.logout}
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 bg-zinc-900 text-white px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-medium hover:bg-zinc-800 transition-all"
              >
                <LogIn size={16} />
                <span className="hidden sm:inline">{t.loginWithGoogle}</span>
              </button>
            )}
          </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Hidden inputs always mounted to avoid ref/event issues on remount */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept="image/*,application/pdf" 
          className="hidden" 
        />
        <input 
          type="file" 
          ref={cameraInputRef} 
          onChange={handleFileUpload} 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
        />

        {/* Left Pane: Receipt & Summary */}
        <div className={`
          ${fullscreenPane === 'left' ? 'flex-1 w-full' : fullscreenPane === 'right' ? 'hidden' : 'flex-1 md:flex-none md:w-1/2'} 
          border-zinc-200 overflow-y-auto bg-white p-4 md:p-8 relative
          ${language === 'he' ? 'border-b md:border-b-0 md:border-l' : 'border-b md:border-b-0 md:border-r'}
        `}>
          <button 
            onClick={() => setFullscreenPane(fullscreenPane === 'left' ? null : 'left')}
            className={`flex absolute top-4 ${language === 'he' ? 'left-4' : 'right-4'} z-10 p-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-500 rounded-lg transition-all shadow-sm`}
            title={fullscreenPane === 'left' ? (language === 'he' ? 'צמצם' : 'Shrink') : (language === 'he' ? 'הגדל' : 'Expand')}
          >
            {fullscreenPane === 'left' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          {!receiptData ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              {parsing && receiptImage ? (
                <div className="w-full max-w-xs space-y-4">
                  <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-lg border border-zinc-200 group">
                    {!receiptImage.startsWith('https://drive.google.com/') && (
                      <img src={receiptImage} alt="Parsing..." className="w-full h-full object-cover opacity-80" />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-[1px]">
                      <Loader2 className="animate-spin text-white mb-2" size={32} />
                      <p className="text-white font-bold text-sm">{t.parsingReceipt}</p>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setParsing(false);
                          setReceiptImage(null);
                        }}
                        className="mt-4 text-[10px] font-bold uppercase tracking-widest text-white bg-red-600/80 px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
                      >
                        {language === 'he' ? 'ביטול' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                    <Upload size={32} />
                  </div>
                  <div className="max-w-xs">
                    <h2 className="text-2xl font-bold mb-2">{t.uploadTitle}</h2>
                    <p className="text-zinc-500 text-sm">
                      {t.uploadDesc}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={parsing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 min-w-[160px]"
                >
                  {parsing ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      <Upload size={20} />
                      {t.chooseReceipt}
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setShowScanner(true)}
                  disabled={parsing}
                  className="bg-zinc-800 hover:bg-zinc-900 text-white px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 min-w-[160px]"
                >
                  {parsing ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      <Camera size={20} />
                      {t.takePhoto}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-10">
              <section>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Receipt size={20} className="text-emerald-600" />
                      {t.receiptItems}
                    </h2>
                    {receiptImage && (
                      <button 
                        onClick={() => setShowReceiptUrl(receiptImage)}
                        className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        <Receipt size={14} />
                        {t.viewOriginal}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setShowAddPerson(true)}
                      className="text-xs font-bold uppercase tracking-wider text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Tag size={14} />
                      {t.addPerson}
                    </button>
                    <button 
                      onClick={() => setShowAddItem({ name: '', price: '', category: '' })}
                      className="text-xs font-bold uppercase tracking-wider text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Plus size={14} />
                      {t.addItem}
                    </button>
                    <span className="text-xs font-mono bg-zinc-100 px-2 py-1 rounded text-zinc-500 uppercase tracking-wider">
                      {receiptData.items.length} {t.itemsCount}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {receiptData.items.map((item) => (
                    <motion.div 
                      layout
                      key={item.id}
                      className={`p-4 rounded-xl border group transition-all ${
                        item.assignedTo.length > 0 
                          ? 'bg-emerald-50/30 border-emerald-100' 
                          : 'bg-white border-zinc-100 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-800">{item.name}</span>
                          {item.category && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
                              {item.category}
                            </span>
                          )}
                          <button 
                            onClick={() => setShowAddItem({ name: item.name, price: item.price.toString(), category: item.category || '', id: item.id })}
                            className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-emerald-600 transition-all"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-semibold text-emerald-700">
                              {currency}{item.price.toFixed(2)}
                            </span>
                            {receiptData.total > 0 && (
                              <span className="text-[10px] font-medium text-emerald-600/70">
                                {((item.price / receiptData.total) * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                          <button 
                            onClick={() => handleDeleteItem(item.id)}
                            className="opacity-0 group-hover:opacity-100 text-zinc-300 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {item.assignedTo.map(person => (
                          <span 
                            key={person} 
                            className="text-[10px] font-bold uppercase tracking-wider bg-white border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1"
                          >
                            {person}
                            <button 
                              onClick={() => {
                                setReceiptData(prev => {
                                  if (!prev) return null;
                                  return {
                                    ...prev,
                                    items: prev.items.map(i => 
                                      i.id === item.id 
                                        ? { ...i, assignedTo: i.assignedTo.filter(p => p !== person) }
                                        : i
                                    )
                                  };
                                });
                              }}
                              className="hover:text-red-500"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                        {item.assignedTo.length === 0 && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 italic">
                            {t.unassigned}
                          </span>
                        )}
                        
                        {assigningItem === item.id ? (
                          <select 
                            autoFocus
                            className="text-[10px] font-bold uppercase tracking-wider bg-zinc-50 border border-zinc-200 text-zinc-700 px-2 py-0.5 rounded-full outline-none"
                            onChange={(e) => {
                              if (e.target.value === 'ADD_NEW_LABEL') {
                                setPendingAssignItemId(item.id);
                                setShowAddPerson(true);
                              } else if (e.target.value) {
                                setReceiptData(prev => {
                                  if (!prev) return null;
                                  return {
                                    ...prev,
                                    items: prev.items.map(i => 
                                      i.id === item.id 
                                        ? { ...i, assignedTo: [...new Set([...i.assignedTo, e.target.value])] }
                                        : i
                                    )
                                  };
                                });
                              }
                              setAssigningItem(null);
                            }}
                            onBlur={() => setAssigningItem(null)}
                          >
                            <option value="">{language === 'he' ? 'בחר...' : 'Select...'}</option>
                            {people.filter(p => !item.assignedTo.includes(p)).map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                            <option value="ADD_NEW_LABEL" className="font-bold text-emerald-600">
                              + {language === 'he' ? 'הוסף תווית חדשה' : 'Add new label'}
                            </option>
                          </select>
                        ) : (
                          (people.length > item.assignedTo.length || people.length === 0) && (
                            <button 
                              onClick={() => {
                                if (people.length === 0) {
                                  setPendingAssignItemId(item.id);
                                  setShowAddPerson(true);
                                } else {
                                  setAssigningItem(item.id);
                                }
                              }}
                              className="text-[10px] font-bold uppercase tracking-wider bg-zinc-100 hover:bg-zinc-200 text-zinc-500 px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors"
                            >
                              <Plus size={10} />
                              {language === 'he' ? 'הוסף תווית' : 'Add label'}
                            </button>
                          )
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-zinc-100 space-y-2">
                  {receiptData.tax > 0 && (
                    <div className="flex justify-between text-sm text-zinc-500">
                      <span>{t.tax}</span>
                      <span>{currency}{receiptData.tax.toFixed(2)}</span>
                    </div>
                  )}
                  {receiptData.tip > 0 && (
                    <div className="flex justify-between text-sm text-zinc-500">
                      <span>{t.tip}</span>
                      <span>{currency}{receiptData.tip.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-zinc-900 pt-2">
                    <span>{t.total}</span>
                    <span>{currency}{receiptData.total.toFixed(2)}</span>
                  </div>
                  
                  {user ? (
                    <button 
                      onClick={handleSaveSession}
                      disabled={saving}
                      className="w-full mt-6 bg-zinc-900 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      {saving ? t.saving : t.saveSession}
                    </button>
                  ) : (
                    <button 
                      onClick={handleLogin}
                      className="w-full mt-6 bg-emerald-600 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                    >
                      <LogIn size={18} />
                      {language === 'he' ? 'התחבר עם גוגל כדי לשמור' : 'Login with Google to Save'}
                    </button>
                  )}
                </div>
              </section>

              {/* People Section */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Tag size={20} className="text-emerald-600" />
                    {language === 'he' ? 'תוויות' : 'Labels'}
                  </h2>
                  <span className="text-xs font-mono bg-zinc-100 px-2 py-1 rounded text-zinc-500 uppercase tracking-wider">
                    {people.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {people.map(person => (
                    <motion.div 
                      layout
                      key={person}
                      className="bg-white border border-zinc-200 px-3 py-2 rounded-xl flex items-center gap-2 shadow-sm group"
                    >
                      <div className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-[10px] font-bold">
                        {person[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-zinc-700">{person}</span>
                      <button 
                        onClick={() => handleRemovePerson(person)}
                        className="text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  ))}
                  {people.length === 0 && (
                    <p className="text-sm text-zinc-400 italic">
                      {language === 'he' ? 'טרם נוספו אנשים' : 'No people added yet'}
                    </p>
                  )}
                </div>
              </section>

              {personTotals.length > 0 && (
                <section className="bg-zinc-900 text-white rounded-2xl p-6 shadow-xl">
                  <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Tag size={20} className="text-emerald-400" />
                    {t.personTotals}
                  </h2>
                  <div className="space-y-6">
                    {personTotals.map(person => (
                      <div key={person.name} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <span className="text-emerald-400 font-bold uppercase tracking-widest text-xs">
                            {person.name}
                          </span>
                          <span className="text-2xl font-mono font-light">
                            {currency}{person.total.toFixed(2)}
                          </span>
                        </div>
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(person.total / receiptData.total) * 100}%` }}
                            className="h-full bg-emerald-500"
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-500 font-mono uppercase">
                          <span>{t.subtotal}: {currency}{person.subtotal.toFixed(2)}</span>
                          <span>{t.taxTip}: {currency}{(person.tax + person.tip).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Right Pane: Chat Interface */}
        <div className={`
          ${fullscreenPane === 'right' ? 'flex-1 w-full' : fullscreenPane === 'left' ? 'hidden' : 'flex-1 md:flex-none md:w-1/2'} 
          flex flex-col bg-zinc-50 overflow-hidden relative
        `}>
          <button 
            onClick={() => setFullscreenPane(fullscreenPane === 'right' ? null : 'right')}
            className={`flex absolute top-4 ${language === 'he' ? 'left-4' : 'right-4'} z-10 p-2 bg-white/80 hover:bg-white text-zinc-500 rounded-lg transition-all shadow-sm border border-zinc-200`}
            title={fullscreenPane === 'right' ? (language === 'he' ? 'צמצם' : 'Shrink') : (language === 'he' ? 'הגדל' : 'Expand')}
          >
            {fullscreenPane === 'right' ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {!receiptData ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400">
                <MessageSquare size={48} className="mb-4 opacity-20" />
                <p className="text-sm">{language === 'he' ? 'העלו קבלה כדי להתחיל בצ\'אט' : 'Upload a receipt to start chatting'}</p>
              </div>
            ) : (
              <>
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                          msg.role === 'user' 
                            ? 'bg-emerald-600 text-white rounded-tr-none' 
                            : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-none shadow-sm'
                        }`}
                        dir="auto"
                      >
                        <div className="markdown-body">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-zinc-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                      <Loader2 className="animate-spin text-emerald-600" size={16} />
                      <span className="text-xs text-zinc-500">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          <div className="p-6 bg-white border-t border-zinc-200">
            <form onSubmit={handleSendMessage} className="relative">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={receiptData ? "Type a command..." : "Upload receipt first..."}
                disabled={!receiptData || loading}
                className="w-full bg-zinc-100 border-none rounded-2xl py-4 pl-6 pr-14 text-sm focus:ring-2 focus:ring-emerald-500 transition-all disabled:opacity-50"
              />
              <button 
                type="submit"
                disabled={!input.trim() || !receiptData || loading}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:bg-zinc-400"
              >
                <Send size={18} />
              </button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {['"John had the pizza"', '"Sarah shared the nachos"', '"Add Dhruv"'].map(hint => (
                <button 
                  key={hint}
                  onClick={() => setInput(hint.replace(/"/g, ''))}
                  disabled={!receiptData || loading}
                  className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-emerald-600 transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <History className="text-emerald-600" />
                  {t.historyTitle}
                </h2>
                <div className="flex items-center gap-2">
                  {history.length > 0 && (
                    <button 
                      onClick={() => setConfirmModal({ isOpen: true, type: 'cleanHistory' })} 
                      className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      title={t.cleanHistory}
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {history.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400">
                    <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                    <p>{t.noHistory}</p>
                  </div>
                ) : (
                  Object.entries(
                    history.reduce((acc, session) => {
                      const date = new Date(session.date.seconds * 1000);
                      const year = date.getFullYear();
                      const month = date.getMonth();
                      if (!acc[year]) acc[year] = {};
                      if (!acc[year][month]) acc[year][month] = [];
                      acc[year][month].push(session);
                      return acc;
                    }, {} as Record<number, Record<number, BillSession[]>>)
                  )
                  .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
                  .map(([year, months]) => (
                    <div key={year} className="space-y-6">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-black text-zinc-200">{year}</span>
                        <div className="h-px flex-1 bg-zinc-100" />
                      </div>
                      {Object.entries(months)
                        .sort(([monthA], [monthB]) => Number(monthB) - Number(monthA))
                        .map(([month, sessions]) => (
                          <div key={month} className="space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 px-2">
                              {new Date(2000, Number(month)).toLocaleString(language, { month: 'long' })}
                            </h3>
                            <div className="grid gap-3">
                              {sessions.map(session => (
                                <div 
                                  key={session.id} 
                                  className="p-4 rounded-2xl border border-zinc-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all cursor-pointer group relative"
                                  onClick={() => loadSession(session)}
                                >
                                  <div className="flex justify-between items-start mb-3">
                                    <div>
                                      <div className="font-bold text-zinc-900">
                                        {new Date(session.date.seconds * 1000).toLocaleDateString(language, { day: 'numeric', weekday: 'short' })}
                                      </div>
                                      <div className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                                        <Tag size={12} />
                                        {session.people.join(', ')}
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                      <div className="flex items-center gap-3">
                                        <div className="text-lg font-mono font-bold text-emerald-700">
                                          {session.currency || '₪'}{session.receiptData.total.toFixed(2)}
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmModal({ isOpen: true, type: 'deleteSession', itemId: session.id });
                                          }}
                                          className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                          title={t.deleteSession}
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                      {session.receiptImageUrl && (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowReceiptUrl(session.receiptImageUrl!);
                                          }}
                                          className="text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-1"
                                        >
                                          <Receipt size={10} />
                                          {language === 'he' ? 'צפה בקבלה' : 'View Receipt'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {session.totals.map(t => (
                                      <span key={t.name} className="text-[10px] font-bold uppercase tracking-wider bg-white border border-zinc-200 px-2 py-1 rounded-lg">
                                        {t.name}: {session.currency || '₪'}{t.total.toFixed(2)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Person Modal */}
      <AnimatePresence>
        {showAddPerson && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-4">{t.addPerson}</h2>
              <input 
                autoFocus
                type="text"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder={t.enterPersonName}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 px-4 mb-4 focus:ring-2 focus:ring-emerald-500 outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setShowAddPerson(false);
                    setPendingAssignItemId(null);
                  }}
                  className="flex-1 py-3 rounded-xl font-medium text-zinc-500 hover:bg-zinc-100 transition-all"
                >
                  {language === 'he' ? 'ביטול' : 'Cancel'}
                </button>
                <button 
                  onClick={handleAddPerson}
                  className="flex-1 py-3 rounded-xl font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                >
                  {language === 'he' ? 'הוסף' : 'Add'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Item Modal */}
      <AnimatePresence>
        {showAddItem && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-4">{showAddItem.id ? t.editItem : t.addItem}</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">{t.itemName}</label>
                  <input 
                    autoFocus
                    type="text"
                    value={showAddItem.name}
                    onChange={(e) => setShowAddItem({ ...showAddItem, name: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">{t.itemPrice}</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={showAddItem.price}
                    onChange={(e) => setShowAddItem({ ...showAddItem, price: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1 block">{language === 'he' ? 'קטגוריה' : 'Category'}</label>
                  <input 
                    type="text"
                    list="categories-list"
                    value={showAddItem.category || ''}
                    onChange={(e) => setShowAddItem({ ...showAddItem, category: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500 outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                  />
                  <datalist id="categories-list">
                    {Array.from(new Set(receiptData?.items.map(item => item.category).filter(Boolean))).map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button 
                  onClick={() => setShowAddItem(null)}
                  className="flex-1 py-3 rounded-xl font-medium text-zinc-500 hover:bg-zinc-100 transition-all"
                >
                  {language === 'he' ? 'ביטול' : 'Cancel'}
                </button>
                <button 
                  onClick={handleAddItem}
                  className="flex-1 py-3 rounded-xl font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                >
                  {showAddItem.id ? (language === 'he' ? 'עדכן' : 'Update') : (language === 'he' ? 'הוסף' : 'Add')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt Preview Modal */}
      <AnimatePresence>
        {showReceiptUrl && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl max-h-[90vh] w-full overflow-hidden rounded-3xl"
            >
              <button 
                onClick={() => setShowReceiptUrl(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <X size={24} />
              </button>
              {showReceiptUrl.startsWith('https://drive.google.com/') ? (
                <iframe 
                  src={showReceiptUrl.replace('/view', '/preview')} 
                  className="w-full h-[80vh] bg-white rounded-3xl"
                  title="Receipt Preview"
                />
              ) : (
                <img 
                  src={showReceiptUrl} 
                  alt="Receipt" 
                  className="w-full h-full object-contain bg-black/20"
                  referrerPolicy="no-referrer"
                />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfile && (
          <motion.div 
            key="profile-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowProfile(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <User className="text-emerald-600" />
                  {t.profileTitle}
                </h2>
                <button onClick={() => setShowProfile(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="flex flex-col items-center mb-8">
                  <div className="w-24 h-24 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-4xl font-bold mb-4">
                    {userProfile?.displayName?.[0] || 'U'}
                  </div>
                  <p className="text-sm text-zinc-500">{userProfile?.email || user?.email}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">{t.displayName}</label>
                  <input 
                    type="text" 
                    defaultValue={userProfile?.displayName || user?.displayName || ''}
                    onBlur={(e) => handleUpdateProfile(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                <button 
                  onClick={() => {
                    setShowProfile(false);
                    handleLogout();
                  }}
                  className="w-full mt-8 flex items-center justify-center gap-2 text-red-600 font-bold py-4 rounded-2xl hover:bg-red-50 transition-all"
                >
                  <LogOut size={18} />
                  {t.logout}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <motion.div 
            key="confirm-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmModal({ isOpen: false, type: null })}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-2 text-zinc-900">
                {confirmModal.type === 'new' ? t.newReceipt : confirmModal.type === 'deleteItem' ? t.deleteItemConfirm : confirmModal.type === 'cleanHistory' ? t.cleanHistory : confirmModal.type === 'deleteSession' ? t.deleteSession : t.reset}
              </h3>
              <p className="text-zinc-600 mb-6">
                {confirmModal.type === 'deleteItem' ? t.deleteItemConfirm : confirmModal.type === 'cleanHistory' ? t.cleanHistoryConfirm : confirmModal.type === 'deleteSession' ? t.deleteSessionConfirm : t.resetConfirm}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal({ isOpen: false, type: null })}
                  className="flex-1 py-3 rounded-xl font-bold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 transition-colors"
                >
                  {language === 'he' ? 'ביטול' : 'Cancel'}
                </button>
                <button 
                  onClick={() => {
                    if (confirmModal.type === 'new') {
                      setReceiptData(null);
                      setReceiptImage(null);
                      setPeople([]);
                      setMessages([]);
                      setCurrentSessionId(null);
                    } else if (confirmModal.type === 'reset') {
                      setReceiptData(null);
                      setPeople([]);
                      setMessages([]);
                      setCurrentSessionId(null);
                    } else if (confirmModal.type === 'cleanHistory') {
                      handleCleanHistory();
                    } else if (confirmModal.type === 'deleteSession' && confirmModal.itemId) {
                      handleDeleteSession(confirmModal.itemId);
                    } else if (confirmModal.type === 'deleteItem' && confirmModal.itemId) {
                      setReceiptData(prev => {
                        if (!prev) return null;
                        const item = prev.items.find(i => i.id === confirmModal.itemId);
                        if (!item) return prev;
                        return {
                          ...prev,
                          items: prev.items.filter(i => i.id !== confirmModal.itemId),
                          total: prev.total - item.price
                        };
                      });
                    }
                    setConfirmModal({ isOpen: false, type: null });
                  }}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                >
                  {language === 'he' ? 'אישור' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showScanner && (
          <Scanner 
            language={language}
            onClose={() => setShowScanner(false)}
            onFallback={() => {
              setShowScanner(false);
              cameraInputRef.current?.click();
            }}
            onCapture={(base64) => {
              setShowScanner(false);
              processFile(base64);
            }}
          />
        )}
      </AnimatePresence>

      {/* Mobile Floating Action Button for New Receipt */}
      {receiptData && !showScanner && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="md:hidden fixed bottom-6 right-6 z-40"
        >
          <button 
            onClick={() => setConfirmModal({ isOpen: true, type: 'new' })}
            className="w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-emerald-700 transition-all active:scale-95"
            title={t.newReceipt}
          >
            <Plus size={24} />
          </button>
        </motion.div>
      )}
    </div>
  );
}
