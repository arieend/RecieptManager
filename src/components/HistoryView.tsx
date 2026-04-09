import React, { useState } from 'react';
import { ArrowLeft, History, Trash2, ChevronRight, Calendar, Receipt, Table } from 'lucide-react';
import { Button, Card } from './ui/Base';
import { ConfirmModal } from './Modal';
import { StorageSettings } from '../services/configService';

interface HistoryViewProps {
  history: any[];
  onBack: () => void;
  onSessionClick: (session: any) => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
  translations: any;
  language: 'en' | 'he';
  currencySymbol: string;
  settings: StorageSettings;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ 
  history, onBack, onSessionClick, onDeleteSession, onClearAll, translations, language, currencySymbol, settings 
}) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const spreadsheetLink = settings.spreadsheetId 
    ? `https://docs.google.com/spreadsheets/d/${settings.spreadsheetId}/edit`
    : null;

  return (
    <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <History size={24} className="text-emerald-600" />
            {translations[language].history}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {spreadsheetLink && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => window.open(spreadsheetLink, '_blank')}
              className="text-emerald-600 border-emerald-100 bg-emerald-50 hover:bg-emerald-100 transition-all shadow-sm"
              title={translations[language].viewInSheets}
            >
              <Table size={20} />
            </Button>
          )}
          {history.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsConfirmOpen(true)}
              className="text-red-500 hover:text-red-600 font-bold"
              leftIcon={<Trash2 size={16} />}
            >
              {translations[language].clearAll}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {history.length > 0 ? (
          history.map((session) => (
            <Card 
              key={session.id} 
              onClick={() => onSessionClick(session)}
              className="p-5 flex justify-between items-center group relative overflow-hidden"
            >
              {/* Background Accent */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 group-hover:text-emerald-600 transition-colors">
                  <Calendar size={18} />
                  <span className="text-[10px] font-bold mt-1">
                    {new Date(session.createdAt).getDate()}
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                    {session.storeName || translations[language].unknownStore}
                    {session.englishStoreName && session.englishStoreName !== session.storeName && (
                      <span className="text-slate-400 dark:text-slate-500 font-medium ml-1 text-[10px]">
                        ({session.englishStoreName})
                      </span>
                    )}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 font-medium">
                    <Receipt size={12} />
                    <span>{session.items?.length || 0} {translations[language].items}</span>
                    <span>•</span>
                    <span>{new Date(session.createdAt).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {session.currency === 'ILS' ? '₪' : session.currency === 'USD' ? '$' : session.currency === 'EUR' ? '€' : currencySymbol}
                    {session.total?.toFixed(2)}
                  </p>
                  {session.currency && session.currency !== 'ILS' && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                      ≈ ₪{(session.total * (session.exchangeRate || 1)).toFixed(2)}
                    </p>
                  )}
                  <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                    {translations[language].completed}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                    className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={18} />
                  </Button>
                  <ChevronRight size={20} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <History size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-4" />
            <p className="text-slate-400 dark:text-slate-500 font-medium">{translations[language].noHistory}</p>
            <Button variant="primary" onClick={onBack} className="mt-6">
              {translations[language].startScanning}
            </Button>
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={onClearAll}
        title={translations[language].cleanHistory}
        message={translations[language].cleanHistoryConfirm}
        confirmLabel={translations[language].confirm}
        cancelLabel={translations[language].cancel}
        isDanger
      />
    </main>
  );
};
