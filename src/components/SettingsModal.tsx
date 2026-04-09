
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings as SettingsIcon, Folder, Calendar, Save, Coins, Table, Info, RefreshCw } from 'lucide-react';
import { StorageSettings } from '../services/configService';
import { Translations } from '../translations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StorageSettings;
  onSave: (settings: StorageSettings) => void;
  t: any;
  language: string;
  onCreateSpreadsheet?: () => void;
  isCreatingSpreadsheet?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings: initialSettings,
  onSave,
  t,
  language,
  onCreateSpreadsheet,
  isCreatingSpreadsheet
}) => {
  const [settings, setSettings] = useState<StorageSettings>(initialSettings);
  const [showInfo, setShowInfo] = useState(false);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  const currencies = [
    { id: 'ILS', label: t.ils },
    { id: 'USD', label: t.usd },
    { id: 'EUR', label: t.eur },
  ] as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <SettingsIcon size={24} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight italic">{t.settings}</h2>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-8">
              {/* Currency */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  <Coins size={16} className="text-emerald-500" />
                  {t.currency}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {currencies.map((curr) => (
                    <button
                      key={curr.id}
                      onClick={() => setSettings({ ...settings, currency: curr.id })}
                      className={`px-4 py-3 rounded-2xl border-2 transition-all font-bold text-sm ${
                        settings.currency === curr.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
                      }`}
                    >
                      {curr.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Storage Path */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  <Folder size={16} className="text-emerald-500" />
                  {t.storagePath}
                </label>
                <input
                  type="text"
                  value={settings.storagePath || ''}
                  onChange={(e) => setSettings({ ...settings, storagePath: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-emerald-500 focus:ring-0 transition-all font-medium text-slate-700 dark:text-slate-200"
                  placeholder="e.g. Google Drive:\Receipts"
                />
              </div>

              {/* Google Sheets Sync */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    <Table size={16} className="text-emerald-500" />
                    {t.syncToSheets}
                  </label>
                  <button
                    onClick={() => setSettings({ ...settings, syncToSheets: !settings.syncToSheets })}
                    className={`w-12 h-6 rounded-full transition-all relative ${settings.syncToSheets ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                  >
                    <motion.div
                      animate={{ x: settings.syncToSheets ? 24 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {settings.syncToSheets && (
                  <div className="space-y-5">
                    {/* Spreadsheet Name */}
                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                        {t.spreadsheetName}
                      </label>
                      <input
                        type="text"
                        value={settings.spreadsheetName || ''}
                        onChange={(e) => setSettings({ ...settings, spreadsheetName: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-emerald-500 focus:ring-0 transition-all font-medium text-slate-700 dark:text-slate-200"
                        placeholder="e.g. Receipts Database"
                      />
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium px-1 italic">
                        {t.spreadsheetNameHelp}
                      </p>
                    </div>

                    {/* Spreadsheet ID */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                          {t.spreadsheetId}
                          <button 
                            onClick={() => setShowInfo(!showInfo)}
                            className="text-slate-300 dark:text-slate-600 hover:text-emerald-500 transition-colors"
                          >
                            <Info size={14} />
                          </button>
                        </label>
                      </div>
                      
                      <AnimatePresence>
                        {showInfo && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl text-xs text-emerald-700 dark:text-emerald-400 font-medium leading-relaxed mb-3 border border-emerald-100 dark:border-emerald-900/30 space-y-2">
                              <p>{t.spreadsheetIdHelp}</p>
                              <p className="font-black text-emerald-800 dark:text-emerald-200">
                                {language === 'he' ? 'חשוב: וודא ש-Google Sheets API מופעל בחשבון הגוגל שלך.' : 'Important: Ensure Google Sheets API is enabled in your Google Cloud Console.'}
                              </p>
                              <a 
                                href="https://console.developers.google.com/apis/api/sheets.googleapis.com/overview" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors"
                              >
                                {language === 'he' ? 'לחץ כאן להפעלה' : 'Click here to enable'}
                              </a>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={settings.spreadsheetId || ''}
                          onChange={(e) => setSettings({ ...settings, spreadsheetId: e.target.value })}
                          className="flex-1 px-5 py-4 bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-emerald-500 focus:ring-0 transition-all font-medium text-slate-700 dark:text-slate-200"
                          placeholder={t.spreadsheetIdPlaceholder}
                        />
                        {settings.spreadsheetId ? (
                          <button
                            onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${settings.spreadsheetId}/edit`, '_blank')}
                            className="px-4 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl border-2 border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex items-center justify-center"
                            title={t.viewInSheets}
                          >
                            <Table size={20} />
                          </button>
                        ) : (
                          onCreateSpreadsheet && (
                            <button
                              onClick={onCreateSpreadsheet}
                              disabled={isCreatingSpreadsheet}
                              className="px-6 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20"
                            >
                              {isCreatingSpreadsheet ? (
                                <RefreshCw size={18} className="animate-spin" />
                              ) : (
                                <Table size={18} />
                              )}
                              <span className="hidden sm:inline">{language === 'he' ? 'צור חדש' : 'Create New'}</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Directory Structure */}
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  <Calendar size={16} className="text-emerald-500" />
                  {t.directoryStructure}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['year', 'month', 'day'] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => setSettings({
                        ...settings,
                        directories: { ...settings.directories, [key]: !settings.directories[key] }
                      })}
                      className={`px-4 py-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                        settings.directories[key]
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
                      }`}
                    >
                      <span className="text-xs font-black uppercase tracking-widest">{t[key]}</span>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        settings.directories[key] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 dark:border-slate-700'
                      }`}>
                        {settings.directories[key] && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto Save */}
              <div className="pt-4">
                <button
                  onClick={() => setSettings({ ...settings, autoSave: !settings.autoSave })}
                  className="w-full flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 transition-all group"
                >
                  <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{t.autoSave}</span>
                  <div className={`w-12 h-6 rounded-full transition-all relative ${settings.autoSave ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                    <motion.div
                      animate={{ x: settings.autoSave ? 24 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 sm:p-8 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleSave}
                className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-200 dark:shadow-emerald-900/20 active:scale-95"
              >
                <Save size={24} />
                {t.saveSettings}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
