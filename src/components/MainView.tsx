import React from 'react';
import { Camera, FileUp, History, Clock, ArrowRight, AlertCircle, Table } from 'lucide-react';
import { motion } from 'motion/react';
import { Button, Card } from './ui/Base';
import { StorageSettings } from '../services/configService';

interface MainViewProps {
  user: any;
  history: any[];
  onScan: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadFolder: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onHistoryClick: () => void;
  onSessionClick: (session: any) => void;
  onSettingsClick: () => void;
  translations: any;
  language: 'en' | 'he';
  currencySymbol: string;
  driveToken: string | null;
  onReconnectDrive: () => void;
  settings: StorageSettings;
}

export const MainView: React.FC<MainViewProps> = ({ 
  user, history, onScan, onUpload, onUploadFolder, onHistoryClick, onSessionClick, onSettingsClick, translations, language, currencySymbol, driveToken, onReconnectDrive, settings 
}) => {
  const spreadsheetLink = settings.spreadsheetId 
    ? `https://docs.google.com/spreadsheets/d/${settings.spreadsheetId}/edit`
    : null;

  return (
    <main className="flex-1 p-6 space-y-8 max-w-2xl mx-auto w-full">
      {/* Welcome Section */}
      <section className="space-y-2">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          {translations[language].welcome}, {user?.displayName?.split(' ')[0] || translations[language].user}!
        </h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">{translations[language].readyToSplit}</p>
      </section>

    {/* Action Buttons */}
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Button 
        variant="primary" 
        size="lg" 
        onClick={onScan}
        className="flex-col gap-3 h-48 rounded-[2.5rem] text-xl shadow-xl shadow-emerald-200/50 dark:shadow-emerald-900/20"
        leftIcon={<Camera size={32} strokeWidth={2.5} />}
      >
        {translations[language].scanReceipt}
      </Button>
      
      <div className="grid grid-cols-1 gap-4 h-48">
        <div className="relative h-full">
          <input 
            type="file" 
            multiple
            accept="image/*,application/pdf" 
            onChange={(e) => {
              onUpload(e);
              e.target.value = '';
            }}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
          />
          <Button 
            variant="outline" 
            size="lg" 
            className="w-full h-full flex-col gap-2 rounded-[2.5rem] text-lg border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20"
            leftIcon={<FileUp size={28} strokeWidth={2.5} className="text-emerald-600" />}
          >
            {translations[language].selectFiles}
          </Button>
        </div>
        
        <div className="relative h-full hidden sm:block">
          <input 
            type="file" 
            // @ts-ignore
            webkitdirectory=""
            // @ts-ignore
            directory=""
            onChange={(e) => {
              onUploadFolder(e);
              e.target.value = '';
            }}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
          />
          <Button 
            variant="ghost" 
            size="lg" 
            className="w-full h-full flex-col gap-2 rounded-[2.5rem] text-lg border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20"
            leftIcon={<History size={28} strokeWidth={2.5} className="text-emerald-600" />}
          >
            {translations[language].processFolder}
          </Button>
        </div>
      </div>
    </section>

    {/* Recent History Section */}
    <section className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Clock size={20} className="text-emerald-600" />
          {translations[language].recentHistory}
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onHistoryClick}
          className="text-emerald-600 hover:text-emerald-700 dark:hover:text-emerald-400 font-bold"
          rightIcon={<ArrowRight size={16} />}
        >
          {translations[language].viewAll}
        </Button>
      </div>

      <div className="space-y-3">
        {history.length > 0 ? (
          history.slice(0, 3).map((session) => (
            <Card 
              key={session.id} 
              onClick={() => onSessionClick(session)}
              className="p-4 flex justify-between items-center group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 group-hover:text-emerald-600 transition-colors">
                  <History size={24} />
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
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    {new Date(session.createdAt).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-slate-900 dark:text-white">
                  {session.currency === 'ILS' ? '₪' : session.currency === 'USD' ? '$' : session.currency === 'EUR' ? '€' : currencySymbol}
                  {session.total?.toFixed(2)}
                </p>
                {session.currency && session.currency !== 'ILS' && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                    ≈ ₪{(session.total * (session.exchangeRate || 1)).toFixed(2)}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                  {session.items?.length || 0} {translations[language].items}
                </p>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-slate-400 dark:text-slate-500 font-medium">{translations[language].noHistory}</p>
          </div>
        )}
      </div>
    </section>
  </main>
);
};
