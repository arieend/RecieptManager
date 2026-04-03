import React from 'react';
import { Camera, FileUp, History, Clock, ArrowRight, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { Button, Card } from './ui/Base';

interface MainViewProps {
  user: any;
  history: any[];
  onScan: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onHistoryClick: () => void;
  onSessionClick: (session: any) => void;
  translations: any;
  language: 'en' | 'he';
  currencySymbol: string;
  driveToken: string | null;
  onReconnectDrive: () => void;
}

export const MainView: React.FC<MainViewProps> = ({ 
  user, history, onScan, onUpload, onHistoryClick, onSessionClick, translations, language, currencySymbol, driveToken, onReconnectDrive 
}) => (
  <main className="flex-1 p-6 space-y-8 max-w-2xl mx-auto w-full">
    {/* Welcome Section */}
    <section className="space-y-2">
      <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
        {translations[language].welcome}, {user?.displayName?.split(' ')[0] || translations[language].user}!
      </h2>
      <p className="text-slate-500 font-medium">{translations[language].readyToSplit}</p>
    </section>

    {/* Drive Warning */}
    {!driveToken && (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-4 bg-amber-50 border-2 border-amber-100 rounded-3xl flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">
              {language === 'he' ? 'Google Drive לא מחובר' : 'Google Drive Disconnected'}
            </p>
            <p className="text-[10px] text-amber-600 font-medium">
              {language === 'he' ? 'חשבוניות לא יישמרו בענן' : 'Receipts won\'t be saved to cloud'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onReconnectDrive} className="border-amber-200 text-amber-700 hover:bg-amber-100">
          {translations[language].reconnectDrive}
        </Button>
      </motion.div>
    )}

    {/* Action Buttons */}
    <section className="grid grid-cols-2 gap-4">
      <Button 
        variant="primary" 
        size="lg" 
        onClick={onScan}
        className="flex-col gap-3 h-48 rounded-[2.5rem] text-xl shadow-xl shadow-emerald-200/50"
        leftIcon={<Camera size={32} strokeWidth={2.5} />}
      >
        {translations[language].scanReceipt}
      </Button>
      
      <div className="relative h-48">
        <input 
          type="file" 
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
          className="w-full h-full flex-col gap-3 rounded-[2.5rem] text-xl border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50"
          leftIcon={<FileUp size={32} strokeWidth={2.5} className="text-emerald-600" />}
        >
          {translations[language].uploadFile}
        </Button>
      </div>
    </section>

    {/* Recent History Section */}
    <section className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Clock size={20} className="text-emerald-600" />
          {translations[language].recentHistory}
        </h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onHistoryClick}
          className="text-emerald-600 hover:text-emerald-700 font-bold"
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
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                  <History size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {session.storeName || translations[language].unknownStore}
                    {session.englishStoreName && session.englishStoreName !== session.storeName && (
                      <span className="text-slate-400 font-medium ml-1 text-[10px]">
                        ({session.englishStoreName})
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-400 font-medium">
                    {new Date(session.createdAt).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-slate-900">
                  {currencySymbol}{session.total?.toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {session.items?.length || 0} {translations[language].items}
                </p>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-12 bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-medium">{translations[language].noHistory}</p>
          </div>
        )}
      </div>
    </section>
  </main>
);
