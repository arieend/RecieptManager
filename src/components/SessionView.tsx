import React, { useMemo, useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, UserPlus, Save, Trash2, 
  MessageSquare, Send, X, ChevronRight, 
  Receipt, Users, Calculator, Sparkles, Eye, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Card, Badge } from './ui/Base';
import { PromptModal, Modal } from './Modal';

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
    session.people.forEach((p: any) => personTotals[p.id] = 0);
    
    session.items.forEach((item: any) => {
      if (item.assignedTo.length > 0) {
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

    return { personTotals: finalTotals, subtotal, total: totalWithTaxTip };
  }, [session]);

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
              setSession({
                ...session,
                items: [...session.items, { id: Date.now().toString(), name, price, assignedTo: [] }]
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
        <Card className="p-6 bg-emerald-600 text-white border-none shadow-xl shadow-emerald-200">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
              <Calculator size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">{translations[language].summary}</span>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black">{currencySymbol}{totals.total.toFixed(2)}</p>
              <p className="text-xs font-medium opacity-80">{translations[language].totalAmount}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {totals.personTotals.map((p) => (
              <div key={p.id} className="flex justify-between items-center bg-white/10 p-3 rounded-2xl">
                <span className="font-bold">{p.name}</span>
                <span className="font-black text-lg">{currencySymbol}{p.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* People Section */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Users size={20} className="text-emerald-600" />
              {translations[language].people}
            </h3>
            <Button variant="outline" size="sm" onClick={addPerson} leftIcon={<UserPlus size={16} />}>
              {translations[language].addPerson}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {session.people.map((person: any) => (
              <Badge key={person.id} color={person.color}>
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
                    <p className="text-sm font-black text-emerald-600">{currencySymbol}{item.price.toFixed(2)}</p>
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
                <iframe 
                  src={pdfBlobUrl || session.imageUrl} 
                  className="w-full h-[60vh]" 
                  title="PDF Viewer"
                />
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
