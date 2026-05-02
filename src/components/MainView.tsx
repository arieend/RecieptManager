import React from 'react';
import { Camera, FileUp, History, AlertCircle, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { translations } from '../translations';
import { Session } from '../types';
import { StorageSettings } from '../services/configService';
import { Button } from './ui/Base';

interface MainViewProps {
  user: any;
  history: any[];
  onScan: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadFolder: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onHistoryClick: () => void;
  onSessionClick: (session: Session) => void;
  onSettingsClick: () => void;
  translations: any;
  language: 'en' | 'he';
  currencySymbol: string;
  driveToken: string | null;
  onReconnectDrive: () => void;
  settings: StorageSettings;
}

export const MainView: React.FC<MainViewProps> = ({
  user, history, onScan, onUpload, onUploadFolder, onHistoryClick, onSessionClick, onSettingsClick, language, currencySymbol, driveToken, onReconnectDrive, settings
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

      {/* Recent History */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-slate-900 dark:text-white italic uppercase tracking-tight">{translations[language].recentHistory}</h3>
          <button 
            onClick={onHistoryClick}
            className="text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:underline"
          >
            {translations[language].viewAll}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {history.length > 0 ? (
            history.slice(0, 3).map((session) => (
              <motion.button
                key={session.id}
                whileHover={{ x: 4 }}
                onClick={() => onSessionClick(session)}
                className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-emerald-500/50 transition-all text-left group shadow-sm"
              >
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-600 transition-colors">
                  <History size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate">
                    {language === 'he' ? session.storeName : (session.englishStoreName || session.storeName)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {new Date(session.createdAt).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900 dark:text-white">{currencySymbol}{session.total.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{session.items.length} {translations[language].items}</p>
                </div>
              </motion.button>
            ))
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                <History size={32} />
              </div>
              <p className="text-slate-400 font-medium">{translations[language].noHistory}</p>
            </div>
          )}
        </div>
      </section>

      {/* Quick Actions / Status */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {spreadsheetLink && (
          <a 
            href={spreadsheetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 bg-emerald-600 text-white rounded-[2.5rem] flex flex-col gap-4 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20 group"
          >
            <div className="flex justify-between items-start">
              <div className="p-3 bg-white/20 rounded-2xl">
                <ExternalLink size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">Active Sync</span>
            </div>
            <div>
              <p className="font-black text-lg leading-tight italic uppercase">Google Sheets</p>
              <p className="text-xs text-white/70 font-bold">View your receipts database</p>
            </div>
          </a>
        )}

        {!driveToken && (
          <button 
            onClick={onReconnectDrive}
            className="p-6 bg-slate-900 text-white rounded-[2.5rem] flex flex-col gap-4 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 dark:shadow-slate-900/20 group"
          >
            <div className="flex justify-between items-start">
              <div className="p-3 bg-white/10 rounded-2xl">
                <AlertCircle size={24} />
              </div>
            </div>
            <div>
              <p className="font-black text-lg leading-tight italic uppercase">{translations[language].reconnectDrive}</p>
              <p className="text-xs text-white/60 font-bold">Enable cloud backup & sync</p>
            </div>
          </button>
        )}
      </section>
    </main>
  );
};
