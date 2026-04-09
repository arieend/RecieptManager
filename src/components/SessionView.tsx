import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, Plus, UserPlus, Save, Trash2, 
  MessageSquare, Send, X, ChevronRight, 
  Receipt, Tag, RefreshCw, Eye, Download, Sparkles,
  Coins, TrendingUp, Table
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Badge, Modal, Input } from './ui/Base';
import { Session } from '../types';
import { Language, Translations } from '../translations';
import { StorageSettings } from '../services/configService';
import { categorizeItems, getExchangeRate } from '../services/geminiService';
import { SummaryCard } from './SummaryCard';
import { ItemCard } from './ItemCard';
import { calculateTotals } from '../utils/calculations';

interface SessionViewProps {
  session: Session;
  setSession: (session: Session) => void;
  onBack: () => void;
  onSave: () => void;
  onDelete: () => void;
  onChat: (command: string) => void;
  translations: Record<Language, Translations>;
  language: Language;
  currencySymbol: string;
  settings: StorageSettings;
}

export const SessionView: React.FC<SessionViewProps> = ({ 
  session, setSession, onBack, onSave, onDelete, onChat, 
  translations, language, currencySymbol, settings 
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    label: string;
    type?: 'text' | 'number';
    onConfirm: (val: string) => void;
  }>({ isOpen: false, title: '', label: '', onConfirm: () => {} });

  const totals = useMemo(() => calculateTotals(session), [session]);

  const addItem = () => {
    setPromptModal({
      isOpen: true,
      title: translations[language].addItem,
      label: translations[language].itemName,
      onConfirm: (name) => {
        setPromptModal(prev => ({
          ...prev,
          isOpen: true,
          title: translations[language].addItem,
          label: translations[language].itemPrice,
          type: 'number',
          onConfirm: (priceStr) => {
            const price = parseFloat(priceStr || '0');
            if (name && !isNaN(price) && price > 0) {
              const familyPerson = session.people.find((p: any) => p.id === 'person-family');
              setSession({
                ...session,
                items: [...session.items, { 
                  id: `item-${Date.now()}`, 
                  name, 
                  price, 
                  quantity: 1,
                  assignedTo: familyPerson ? [familyPerson.id] : [] 
                }]
              });
            }
          }
        }));
      }
    });
  };

  const addPerson = () => {
    setPromptModal({
      isOpen: true,
      title: translations[language].addPerson,
      label: translations[language].personName,
      onConfirm: (name) => {
        if (name) {
          setSession({
            ...session,
            people: [...session.people, { id: Date.now().toString(), name, color: `hsl(${Math.random() * 360}, 70%, 50%)` }]
          });
        }
      }
    });
  };

  const removePerson = (personId: string) => {
    if (personId === 'person-family' && session.people.length === 1) return;

    setSession({
      ...session,
      people: session.people.filter((p: any) => p.id !== personId),
      items: session.items.map((item: any) => ({
        ...item,
        assignedTo: item.assignedTo.filter((id: string) => id !== personId)
      }))
    });
  };

  const toggleAssignment = (itemId: string, personId: string) => {
    setSession({
      ...session,
      items: session.items.map((item: any) => 
        item.id === itemId 
          ? { 
              ...item, 
              assignedTo: item.assignedTo.includes(personId)
                ? item.assignedTo.filter((id: string) => id !== personId)
                : [...item.assignedTo, personId]
            } 
          : item
      )
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    setSession({
      ...session,
      items: session.items.map((item: any) => 
        item.id === itemId ? { ...item, quantity } : item
      )
    });
  };

  const handleRegenerateAI = async () => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    try {
      const itemNames = session.items.map(i => i.name);
      const aiData = await categorizeItems(itemNames);
      
      const updatedItems = session.items.map(item => {
        const aiInfo = aiData.find(d => d.name === item.name);
        return aiInfo ? { ...item, category: aiInfo.category, labels: aiInfo.labels } : item;
      });

      setSession({ ...session, items: updatedItems });
    } catch (error) {
      console.error("Regeneration error:", error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const updateCurrency = async (newCurrency: 'ILS' | 'USD' | 'EUR') => {
    if (newCurrency === session.currency) return;
    
    let newRate = 1;
    if (newCurrency !== 'ILS') {
      setIsRegenerating(true);
      try {
        newRate = await getExchangeRate(newCurrency, 'ILS');
      } catch (e) {
        console.error("Failed to fetch exchange rate:", e);
      } finally {
        setIsRegenerating(false);
      }
    }
    
    setSession({
      ...session,
      currency: newCurrency,
      exchangeRate: newRate
    });
  };

  const updateExchangeRate = (rate: number) => {
    setSession({ ...session, exchangeRate: rate });
  };

  const pdfBlobUrl = useMemo(() => {
    if (session.imageUrl?.startsWith('data:application/pdf')) {
      try {
        const base64 = session.imageUrl.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
      } catch (e) {
        console.error("PDF Blob creation error:", e);
      }
    }
    return null;
  }, [session.imageUrl]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 relative">
      {/* Header */}
      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
            <ArrowLeft size={24} />
          </Button>
          <div>
            <h2 className="font-black text-slate-900 dark:text-white tracking-tight">
              {session.storeName || translations[language].unknownStore}
              {session.englishStoreName && session.englishStoreName !== session.storeName && (
                <span className="text-slate-400 dark:text-slate-500 font-medium ml-2 text-sm">
                  ({session.englishStoreName})
                </span>
              )}
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
              {new Date(session.createdAt).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {/* Currency Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mr-2">
            {(['ILS', 'USD', 'EUR'] as const).map((curr) => (
              <button
                key={curr}
                onClick={() => updateCurrency(curr)}
                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                  session.currency === curr 
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' 
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {curr === 'ILS' ? '₪' : curr === 'USD' ? '$' : '€'}
              </button>
            ))}
          </div>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleRegenerateAI} 
            isLoading={isRegenerating}
            className="text-emerald-600"
            title={translations[language].regenerateAI}
            aria-label="Regenerate"
          >
            <RefreshCw size={20} />
          </Button>
          {(session.imageUrl || session.driveLink) && (
            <Button variant="ghost" size="icon" onClick={() => setIsImageModalOpen(true)} className="text-emerald-600" aria-label="View Image">
              <Eye size={20} />
            </Button>
          )}
          {(session.spreadsheetLink || settings.spreadsheetId) && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => window.open(session.spreadsheetLink || `https://docs.google.com/spreadsheets/d/${settings.spreadsheetId}/edit`, '_blank')} 
              className="text-emerald-600 border-emerald-100 bg-emerald-50 hover:bg-emerald-100 transition-all shadow-sm"
              aria-label="View Spreadsheet"
              title={translations[language].viewInSheets}
            >
              <Table size={20} />
            </Button>
          )}
          <Button variant="danger" size="icon" onClick={onDelete} aria-label="Delete">
            <Trash2 size={20} />
          </Button>
          <Button variant="primary" size="icon" onClick={onSave} aria-label="Save">
            <Save size={20} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
        {session.currency !== 'ILS' && (
          <section className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                <TrendingUp size={14} className="text-emerald-500" />
                <span>{translations[language].exchangeRate}</span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  step="0.01"
                  value={session.exchangeRate ?? 1}
                  onChange={(e) => updateExchangeRate(parseFloat(e.target.value) || 1)}
                  className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-black text-emerald-600 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase">1 {session.currency} = {session.exchangeRate} ₪</span>
              </div>
            </div>
          </section>
        )}

        <SummaryCard 
          totals={totals} 
          language={language} 
          translations={translations} 
          currencySymbol={session.currency === 'ILS' ? '₪' : session.currency === 'USD' ? '$' : '€'}
          currency={session.currency}
          exchangeRate={session.exchangeRate}
        />

        {/* People Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Tag size={20} className="text-emerald-600" />
              {translations[language].people}
            </h3>
            <Button variant="outline" size="sm" onClick={addPerson} leftIcon={<Tag size={16} />}>
              {translations[language].addPerson}
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium px-1 leading-relaxed">
            {translations[language].assignHint}
          </p>
          <div className="flex flex-wrap gap-2">
            {session.people.map((person) => (
              <Badge 
                key={person.id} 
                color={person.color}
                onRemove={person.id !== 'person-family' || session.people.length > 1 ? () => removePerson(person.id) : undefined}
              >
                {person.name}
              </Badge>
            ))}
          </div>
        </section>

        {/* Items Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Receipt size={20} className="text-emerald-600" />
              {translations[language].items}
            </h3>
            <Button variant="outline" size="sm" onClick={addItem} leftIcon={<Plus size={16} />}>
              {translations[language].addItem}
            </Button>
          </div>
          
          <div className="space-y-3">
            {session.items.map((item) => (
              <ItemCard 
                key={item.id} 
                item={item} 
                people={session.people} 
                currencySymbol={session.currency === 'ILS' ? '₪' : session.currency === 'USD' ? '$' : '€'}
                currency={session.currency}
                exchangeRate={session.exchangeRate}
                onToggleAssignment={toggleAssignment} 
                onUpdateQuantity={updateQuantity}
                translations={translations[language]}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Chat Floating Button */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-4 z-20">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="w-80 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
            >
              <div className="p-4 bg-emerald-600 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} />
                  <span className="font-black text-sm uppercase tracking-widest">{translations[language].aiAssistant}</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20">
                <p className="text-xs text-emerald-800 dark:text-emerald-200 font-medium leading-relaxed">
                  {translations[language].aiHint}
                </p>
              </div>
              <div className="p-4 flex gap-2 border-t border-slate-100 dark:border-slate-800">
                <Input 
                  placeholder={translations[language].typeCommand}
                  value={chatInput || ''}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (onChat(chatInput), setChatInput(''))}
                  className="flex-1"
                />
                <Button 
                  variant="primary" 
                  size="icon" 
                  onClick={() => { onChat(chatInput); setChatInput(''); }}
                  disabled={!chatInput.trim()}
                  aria-label="Send"
                >
                  <Send size={18} />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 ${isChatOpen ? 'bg-slate-800 text-white' : 'bg-emerald-600 text-white shadow-emerald-200'}`}
          aria-label="Chat"
        >
          {isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}
        </button>
      </div>

      {/* Image Modal */}
      <Modal 
        isOpen={isImageModalOpen} 
        onClose={() => setIsImageModalOpen(false)} 
        title={translations[language].viewOriginal}
      >
        <div className="space-y-4">
          <div className="w-full max-h-[70vh] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
            {session.imageUrl ? (
              session.imageUrl.startsWith('data:application/pdf') ? (
                <div className="p-10 text-center space-y-4">
                  <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Receipt size={40} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">PDF Receipt</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    {session.driveLink 
                      ? translations[language].viewOnDrive 
                      : "PDF files cannot be displayed directly in this preview. Please sync to Google Drive to view."}
                  </p>
                  {session.driveLink ? (
                    <Button 
                      variant="primary" 
                      onClick={() => window.open(session.driveLink, '_blank')}
                      leftIcon={<Eye size={18} />}
                    >
                      {translations[language].viewOnDrive}
                    </Button>
                  ) : (
                    <Button 
                      variant="primary" 
                      onClick={() => {
                        if (pdfBlobUrl) {
                          window.open(pdfBlobUrl, '_blank');
                        } else {
                          window.open(session.imageUrl, '_blank');
                        }
                      }}
                      leftIcon={<Download size={18} />}
                    >
                      Open in New Tab
                    </Button>
                  )}
                </div>
              ) : (
                <img src={session.imageUrl} alt="Receipt" className="max-w-full h-auto" referrerPolicy="no-referrer" />
              )
            ) : session.driveLink ? (
              <div className="p-10 text-center space-y-4">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Receipt size={40} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Google Drive File</h3>
                <Button 
                  variant="primary" 
                  onClick={() => window.open(session.driveLink, '_blank')}
                  leftIcon={<Eye size={18} />}
                >
                  {translations[language].viewOnDrive}
                </Button>
              </div>
            ) : (
              <div className="p-10 text-slate-400 italic">{translations[language].noImage}</div>
            )}
          </div>
          {session.driveLink && (
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => window.open(session.driveLink, '_blank')}
              leftIcon={<ChevronRight size={18} />}
            >
              {translations[language].openInDrive}
            </Button>
          )}
        </div>
      </Modal>

      {/* Prompt Modal */}
      <Modal 
        isOpen={promptModal.isOpen} 
        onClose={() => setPromptModal(prev => ({ ...prev, isOpen: false }))} 
        title={promptModal.title}
      >
        <div className="space-y-4">
          <Input 
            label={promptModal.label}
            type={promptModal.type || 'text'}
            autoFocus
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                promptModal.onConfirm((e.target as HTMLInputElement).value);
                setPromptModal(prev => ({ ...prev, isOpen: false }));
              }
            }}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setPromptModal(prev => ({ ...prev, isOpen: false }))}>
              {translations[language].cancel}
            </Button>
            <Button variant="primary" onClick={() => {
              const input = document.querySelector('input[type="' + (promptModal.type || 'text') + '"]') as HTMLInputElement;
              promptModal.onConfirm(input.value);
              setPromptModal(prev => ({ ...prev, isOpen: false }));
            }}>
              {translations[language].confirm}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
