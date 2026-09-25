import React, { useState } from 'react';
import { RefreshCw, Edit3, Check, Calendar, Store, Tag, AlertCircle, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Session } from '../types';
import { Language, Translations } from '../translations';
import { Button, Input } from './ui/Base';
import { getCurrencySymbol } from '../services/configService';

interface ParsingReviewProps {
  session: Session;
  onRescan: () => void;
  onConfirm: (session: Session) => void;
  onCancel: () => void;
  language: Language;
  translations: Record<Language, Translations>;
  currencySymbol: string;
}

export const ParsingReview: React.FC<ParsingReviewProps> = ({
  session, onRescan, onConfirm, onCancel, language, translations, currencySymbol
}) => {
  const [editedSession, setEditedSession] = useState<Session>(session);
  const t = translations[language];

  const handleDateChange = (dateStr: string) => {
    if (!dateStr) return;
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(editedSession.createdAt);
      d.setFullYear(year, month - 1, day);
      setEditedSession({ ...editedSession, createdAt: d.toISOString() });
    } catch (e) {
      console.warn("Invalid date entered");
    }
  };

  const handleStoreNameChange = (name: string) => {
    setEditedSession({ ...editedSession, storeName: name, englishStoreName: name });
  };

  const handleTotalChange = (total: number) => {
    setEditedSession({ ...editedSession, total });
  };

  const d = new Date(editedSession.createdAt);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const displayDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 p-6 space-y-6 overflow-y-auto relative">
      <button 
        onClick={onCancel}
        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10"
        aria-label={t.cancel}
      >
        <X size={24} />
      </button>
      <header className="space-y-2 text-center">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Check size={32} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase italic">{t.reviewStep}</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">{t.isDataCorrect}</p>
      </header>

      <section className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-xl border border-slate-100 dark:border-slate-800 space-y-6">
        {/* Preview of Image */}
        <div className="flex justify-center">
          {session.imageUrl && !session.imageUrl.startsWith('data:application/pdf') && (
            <div className="relative group">
              <img 
                src={session.imageUrl} 
                className="h-32 w-32 object-cover rounded-2xl border-2 border-emerald-500/20 shadow-md" 
                alt="Receipt thumbnail" 
              />
              <div className="absolute inset-0 bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
          {session.imageUrl?.startsWith('data:application/pdf') && (
            <div className="h-32 w-32 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
              <AlertCircle size={32} />
              <span className="text-[10px] font-bold uppercase mt-2">PDF</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Store Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <Store size={12} />
              {t.editStoreName}
            </label>
            <Input 
              value={editedSession.storeName}
              onChange={(e) => handleStoreNameChange(e.target.value)}
              className="font-bold h-12"
            />
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <Calendar size={12} />
              {t.transactionDate}
            </label>
            <Input 
              type="date"
              value={displayDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="font-bold h-12"
            />
          </div>

          {/* Total */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/10">
            <div className="flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{t.total}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">{getCurrencySymbol(editedSession.currency)}</span>
                  <input 
                    type="number"
                    value={editedSession.total}
                    onChange={(e) => handleTotalChange(parseFloat(e.target.value) || 0)}
                    className="w-24 bg-transparent text-xl font-black text-emerald-700 dark:text-emerald-300 focus:outline-none"
                  />
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.itemsCount}</span>
                <p className="font-bold text-slate-700 dark:text-slate-300">{editedSession.items.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 mt-auto">
        <Button 
          variant="primary" 
          size="lg" 
          onClick={() => onConfirm(editedSession)}
          className="w-full h-16 rounded-[2rem] text-lg font-black"
          leftIcon={<Check size={24} />}
        >
          {t.ok}
        </Button>
        <Button 
          variant="outline" 
          size="lg" 
          onClick={() => onConfirm(editedSession)}
          className="w-full h-16 rounded-[2rem] text-lg font-black border-2 border-slate-200 dark:border-slate-800"
          leftIcon={<Edit3 size={24} />}
        >
          {t.manualEdit}
        </Button>
        <Button 
          variant="ghost" 
          size="lg" 
          onClick={onRescan}
          className="w-full h-16 rounded-[2rem] text-lg font-black"
          leftIcon={<RefreshCw size={24} />}
        >
          {t.rescan}
        </Button>
        <Button 
          variant="ghost" 
          size="lg" 
          onClick={onCancel}
          className="w-full h-16 rounded-[2rem] text-lg font-black text-slate-400"
          leftIcon={<X size={24} />}
        >
          {t.cancel}
        </Button>
      </div>
    </div>
  );
};
