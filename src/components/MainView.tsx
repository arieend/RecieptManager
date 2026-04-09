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

      {/* Google Sheets Status */}
      {settings.spreadsheetId ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0"
        >
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
              <Table size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                {language === 'he' ? 'מסד נתונים מחובר' : 'Database Connected'}
              </p>
              <p className="text-xs text-emerald-600 font-medium truncate max-w-[150px] sm:max-w-[200px]">
                {settings.spreadsheetName}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => spreadsheetLink && window.open(spreadsheetLink, '_blank')}
            className="text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 font-bold w-full sm:w-auto"
          >
            {translations[language].viewInSheets}
          </Button>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0"
        >
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 shrink-0">
              <Table size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                {language === 'he' ? 'Google Sheets לא מחובר' : 'Google Sheets Not Connected'}
              </p>
              <p className="text-xs text-slate-400 font-medium">
                {language === 'he' ? 'חבר בגיליון בהגדרות לסנכרון אוטומטי' : 'Connect a sheet in settings for auto-sync'}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onSettingsClick}
            className="text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 font-bold w-full sm:w-auto"
          >
            {translations[language].settings}
          </Button>
        </motion.div>
      )}

    {/* Drive Warning */}
    {!driveToken && (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-4 bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-100 dark:border-amber-900/30 rounded-3xl flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-2xl flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
              {language === 'he' ? 'Google Drive לא מחובר' : 'Google Drive Disconnected'}
            </p>
            <p className="text-[10px] text-amber-600 font-medium">
              {language === 'he' ? 'חשבוניות לא יישמרו בענן' : 'Receipts won\'t be saved to cloud'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onReconnectDrive} className="border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30">
          {translations[language].reconnectDrive}
        </Button>
      </motion.div>
    )}

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
