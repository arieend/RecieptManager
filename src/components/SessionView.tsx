import React, { useMemo, useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, UserPlus, Save, Trash2, 
  MessageSquare, Send, X, ChevronRight, 
  Receipt, Users, Calculator, Sparkles, Eye, Download, Tag, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Card, Badge } from './ui/Base';
import { PromptModal, Modal } from './Modal';
import { categorizeItems } from '../services/geminiService';

interface SessionViewProps {
  session: any;
  setSession: (session: any) => void;
  onBack: () => void;
  onSave: () => void;
  onDelete: () => void;
  onChat: (command: string) => void;
  translations: any;
  language: 'en' | 'he';
  currencySymbol: string;
}

export const SessionView: React.FC<SessionViewProps> = ({ 
  session, setSession, onBack, onSave, onDelete, onChat, translations, language, currencySymbol 
}) => {
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    label: string;
    placeholder?: string;
    onConfirm: (value: string) => void;
    type?: string;
  }>({
    isOpen: false,
    title: '',
    label: '',
    onConfirm: () => {},
  });

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (session.imageUrl && session.imageUrl.startsWith('data:application/pdf')) {
      try {
        const parts = session.imageUrl.split(',');
        const byteString = atob(parts[1]);
        const mimeString = parts[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: mimeString });
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Failed to create PDF blob URL:", e);
        setPdfBlobUrl(session.imageUrl);
      }
    } else {
      setPdfBlobUrl(null);
    }
  }, [session.imageUrl]);

  const totals = useMemo(() => {
    const personTotals: Record<string, number> = {};
    const categoryTotals: Record<string, number> = {};
    const tagTotals: Record<string, number> = {};
    session.people.forEach((p: any) => personTotals[p.id] = 0);
    
    let assignedSubtotal = 0;
    session.items.forEach((item: any) => {
      const cat = item.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + item.price;

      (item.labels || []).forEach((tag: string) => {
        tagTotals[tag] = (tagTotals[tag] || 0) + item.price;
      });

      if (item.assignedTo.length > 0) {
        assignedSubtotal += item.price;
        const share = item.price / item.assignedTo.length;
        item.assignedTo.forEach((personId: string) => {
          personTotals[personId] = (personTotals[personId] || 0) + share;
        });
      }
    });

    const subtotal = session.items.reduce((sum: number, item: any) => sum + item.price, 0);
    const totalWithTaxTip = session.total || (subtotal + session.tax + session.tip);
    const ratio = subtotal > 0 ? totalWithTaxTip / subtotal : 1;

    const finalTotals = Object.entries(personTotals).map(([id, amount]) => ({
      id,
      name: session.people.find((p: any) => p.id === id)?.name || 'Unknown',
      amount: amount * ratio
    }));

    const finalCategoryTotals = Object.entries(categoryTotals).map(([name, amount]) => ({
      name,
      amount
    })).sort((a, b) => b.amount - a.amount);

    const finalTagTotals = Object.entries(tagTotals).map(([name, amount]) => ({
      name,
      amount
    })).sort((a, b) => b.amount - a.amount);

    const unassignedAmount = (subtotal - assignedSubtotal) * ratio;
    const progress = subtotal > 0 ? (assignedSubtotal / subtotal) * 100 : 0;

    return { 
      personTotals: finalTotals, 
      categoryTotals: finalCategoryTotals,
      tagTotals: finalTagTotals,
      subtotal, 
      total: totalWithTaxTip,
      unassignedAmount,
      progress,
      tax: session.tax,
      tip: session.tip
    };
  }, [session]);

  const [summaryTab, setSummaryTab] = useState<'people' | 'categories' | 'tags'>('people');

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
                  id: Date.now().toString(), 
                  name, 
                  price, 
                  assignedTo: familyPerson ? [familyPerson.id] : [],
                  category: 'Other',
                  labels: []
                }]
              });
            } else {
              alert(translations[language].invalidPrice);
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
    // Don't allow removing the default 'Family' person if it's the only one
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

  const handleRegenerateAI = async () => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    try {
      const itemNames = session.items.map((i: any) => i.name);
      const results = await categorizeItems(itemNames);
      
      const updatedItems = session.items.map((item: any) => {
        const result = results.find((r: any) => r.name === item.name);
        if (result) {
          return {
            ...item,
            category: result.category,
            labels: result.labels
          };
        }
        return item;
      });

      setSession({ ...session, items: updatedItems });
    } catch (error) {
      console.error("Regeneration failed:", error);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-slate-50 relative">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h2 className="font-black text-slate-900 tracking-tight">
              {session.storeName || translations[language].unknownStore}
              {session.englishStoreName && session.englishStoreName !== session.storeName && (
                <span className="text-slate-400 font-medium ml-2 text-sm">
                  ({session.englishStoreName})
                </span>
              )}
            </h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {new Date(session.createdAt).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleRegenerateAI} 
            isLoading={isRegenerating}
            className="text-emerald-600"
            title={translations[language].regenerateAI}
          >
            <RefreshCw size={20} />
          </Button>
          {(session.imageUrl || session.driveLink) && (
            <Button variant="ghost" size="icon" onClick={() => setIsImageModalOpen(true)} className="text-emerald-600">
              <Eye size={20} />
            </Button>
          )}
          <Button variant="danger" size="icon" onClick={onDelete}>
            <Trash2 size={20} />
          </Button>
          <Button variant="primary" size="icon" onClick={onSave}>
            <Save size={20} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
        {/* Summary Card */}
        <Card className="p-6 bg-emerald-600 text-white border-none shadow-xl shadow-emerald-200 overflow-hidden relative">
          {/* Progress Bar Background */}
          <div className="absolute top-0 left-0 w-full h-1 bg-white/20">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${totals.progress}%` }}
              className="h-full bg-white"
            />
          </div>

          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full w-fit">
                <Calculator size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest">{translations[language].summary}</span>
              </div>
              <p className="text-[10px] font-bold opacity-70 px-1">
                {translations[language].assignedProgress}: {Math.round(totals.progress)}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black">{currencySymbol}{totals.total.toFixed(2)}</p>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{translations[language].totalAmount}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
            <button 
              onClick={() => setSummaryTab('people')}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${summaryTab === 'people' ? 'bg-white text-emerald-700' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              {translations[language].people}
            </button>
            <button 
              onClick={() => setSummaryTab('categories')}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${summaryTab === 'categories' ? 'bg-white text-emerald-700' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              {translations[language].categoryBreakdown}
            </button>
            <button 
              onClick={() => setSummaryTab('tags')}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${summaryTab === 'tags' ? 'bg-white text-emerald-700' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              {translations[language].tags}
            </button>
          </div>
          
          <div className="space-y-2">
            <AnimatePresence mode="wait">
              {summaryTab === 'people' ? (
                <motion.div 
                  key="people"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-2"
                >
                  {totals.personTotals.map((p) => (
                    <div key={p.id} className="flex justify-between items-center bg-white/10 p-3 rounded-2xl">
                      <span className="font-bold">{p.name}</span>
                      <span className="font-black text-lg">{currencySymbol}{p.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  {totals.unassignedAmount > 0.01 && (
                    <div className="flex justify-between items-center bg-red-400/20 p-3 rounded-2xl border border-red-400/30">
                      <span className="font-bold opacity-80 italic">{translations[language].unassignedAmount}</span>
                      <span className="font-black text-lg">{currencySymbol}{totals.unassignedAmount.toFixed(2)}</span>
                    </div>
                  )}
                </motion.div>
              ) : summaryTab === 'categories' ? (
                <motion.div 
                  key="categories"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-2"
                >
                  {totals.categoryTotals.map((c) => (
                    <div key={c.name} className="flex justify-between items-center bg-white/10 p-3 rounded-2xl">
                      <span className="font-bold">{c.name}</span>
                      <span className="font-black text-lg">{currencySymbol}{c.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </motion.div>
              ) : (
                <motion.div 
                  key="tags"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2"
                >
                  {totals.tagTotals.map((t) => (
                    <div key={t.name} className="flex justify-between items-center bg-white/10 p-3 rounded-2xl">
                      <span className="font-bold">#{t.name}</span>
                      <span className="font-black text-lg">{currencySymbol}{t.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tax/Tip Details */}
          {(totals.tax > 0 || totals.tip > 0) && (
            <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest opacity-70">
              <span>{translations[language].taxTipDetails}</span>
              <div className="flex gap-4">
                {totals.tax > 0 && <span>{translations[language].tax}: {currencySymbol}{totals.tax.toFixed(2)}</span>}
                {totals.tip > 0 && <span>{translations[language].tip}: {currencySymbol}{totals.tip.toFixed(2)}</span>}
              </div>
            </div>
          )}
        </Card>

        {/* People Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Tag size={20} className="text-emerald-600" />
              {translations[language].people}
            </h3>
            <Button variant="outline" size="sm" onClick={addPerson} leftIcon={<UserPlus size={16} />}>
              {translations[language].addPerson}
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 font-medium px-1 leading-relaxed">
            {translations[language].assignHint}
          </p>
          <div className="flex flex-wrap gap-2">
            {session.people.map((person: any) => (
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
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Receipt size={20} className="text-emerald-600" />
              {translations[language].items}
            </h3>
            <Button variant="outline" size="sm" onClick={addItem} leftIcon={<Plus size={16} />}>
              {translations[language].addItem}
            </Button>
          </div>
          
          <div className="space-y-3">
            {session.items.map((item: any) => (
              <Card key={item.id} className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900">{item.name}</h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.category && (
                        <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                          {item.category}
                        </span>
                      )}
                      {(item.labels || []).map((label: string, lIdx: number) => (
                        <span key={lIdx} className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          #{label}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm font-black text-emerald-600 mt-1">{currencySymbol}{item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex -space-x-2 rtl:space-x-reverse">
                    {item.assignedTo.map((pid: string) => {
                      const person = session.people.find((p: any) => p.id === pid);
                      return (
                        <div 
                          key={pid}
                          className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                          style={{ backgroundColor: person?.color || '#ccc' }}
                        >
                          {person?.name[0]}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  {session.people.map((person: any) => (
                    <button
                      key={person.id}
                      onClick={() => toggleAssignment(item.id, person.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        item.assignedTo.includes(person.id)
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {person.name}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>

      {/* Controls */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-4">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-80 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="p-4 bg-emerald-600 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} />
                  <span className="font-bold">{translations[language].aiAssistant}</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="hover:bg-white/20 rounded-full p-1">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <p className="text-xs text-slate-500 italic leading-relaxed">
                  {translations[language].aiHint}
                </p>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (onChat(chatInput), setChatInput(''))}
                    placeholder={translations[language].typeCommand}
                    className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <Button 
                    variant="primary" 
                    size="icon" 
                    onClick={() => { onChat(chatInput); setChatInput(''); }}
                    disabled={!chatInput.trim()}
                  >
                    <Send size={18} />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 ${
            isChatOpen ? 'bg-slate-800 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}
        </button>
      </div>

      <PromptModal 
        isOpen={promptModal.isOpen}
        onClose={() => setPromptModal({ ...promptModal, isOpen: false })}
        onConfirm={promptModal.onConfirm}
        title={promptModal.title}
        label={promptModal.label}
        type={promptModal.type}
        confirmLabel={translations[language].confirm}
        cancelLabel={translations[language].cancel}
      />

      <Modal 
        isOpen={isImageModalOpen} 
        onClose={() => setIsImageModalOpen(false)}
        title={translations[language].viewOriginal}
        maxWidth="max-w-4xl"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center">
            {session.imageUrl ? (
              session.imageUrl.startsWith('data:application/pdf') ? (
                <div className="p-10 text-center space-y-4">
                  <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto text-emerald-600">
                    <Download size={40} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-slate-900 font-black text-xl">{language === 'he' ? 'קובץ PDF' : 'PDF Document'}</p>
                    <p className="text-slate-500 font-medium text-sm max-w-xs mx-auto">
                      {language === 'he' 
                        ? 'לא ניתן להציג PDF בתוך התצוגה המקדימה. לחץ על הכפתור למטה כדי לפתוח בלשונית חדשה.' 
                        : 'PDFs cannot be displayed directly in the preview. Click below to open in a new tab.'}
                    </p>
                  </div>
                  <Button 
                    variant="primary" 
                    onClick={() => {
                      if (pdfBlobUrl) {
                        window.open(pdfBlobUrl, '_blank');
                      } else {
                        // Fallback if blob URL isn't ready
                        const win = window.open();
                        if (win) {
                          win.document.write(`<iframe src="${session.imageUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                        }
                      }
                    }}
                    className="px-8"
                  >
                    {language === 'he' ? 'פתח בלשונית חדשה' : 'Open in New Tab'}
                  </Button>
                </div>
              ) : (
                <img 
                  src={session.imageUrl} 
                  alt="Receipt" 
                  className="w-full h-auto"
                  referrerPolicy="no-referrer"
                />
              )
            ) : session.driveLink ? (
              <div className="p-10 text-center space-y-4">
                <Receipt size={48} className="mx-auto text-emerald-600 opacity-50" />
                <p className="text-slate-500 font-medium">{language === 'he' ? 'החשבונית נשמרה ב-Google Drive' : 'Receipt saved in Google Drive'}</p>
                <a 
                  href={session.driveLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
                >
                  {language === 'he' ? 'פתח ב-Google Drive' : 'Open in Google Drive'}
                </a>
              </div>
            ) : (
              <div className="p-10 text-center text-slate-400">
                {translations[language].noImage}
              </div>
            )}
          </div>
          <div className="flex gap-3 w-full">
            {session.imageUrl && (
              <Button 
                variant="outline" 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = pdfBlobUrl || session.imageUrl;
                  link.download = `receipt-${session.id}.${session.imageUrl.includes('pdf') ? 'pdf' : 'jpg'}`;
                  link.click();
                }} 
                className="flex-1"
                leftIcon={<Download size={18} />}
              >
                {language === 'he' ? 'הורד' : 'Download'}
              </Button>
            )}
            <Button variant="primary" onClick={() => setIsImageModalOpen(false)} className="flex-1">
              {translations[language].confirm}
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
};
