
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Settings as SettingsIcon, Folder, Calendar, Save, Coins } from 'lucide-react';
import { StorageSettings } from '../services/configService';
import { Translations } from '../translations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StorageSettings;
  onSave: (settings: StorageSettings) => void;
  t: Translations;
  language: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings: initialSettings,
  onSave,
  t,
  language
}) => {
  const [settings, setSettings] = useState<StorageSettings>(initialSettings);

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
            className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <SettingsIcon size={24} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight italic">{t.settings}</h2>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8 overflow-y-auto space-y-8">
              {/* Currency */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-wider">
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
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      {curr.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Storage Path */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-wider">
                  <Folder size={16} className="text-emerald-500" />
                  {t.storagePath}
                </label>
                <input
                  type="text"
                  value={settings.storagePath}
                  onChange={(e) => setSettings({ ...settings, storagePath: e.target.value })}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-emerald-500 focus:ring-0 transition-all font-medium text-slate-700"
                  placeholder="e.g. Google Drive:\Receipts"
                />
              </div>

              {/* Directory Structure */}
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-wider">
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
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      <span className="text-xs font-black uppercase tracking-widest">{t[key]}</span>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        settings.directories[key] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200'
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
                  className="w-full flex items-center justify-between p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-slate-200 transition-all group"
                >
                  <span className="font-bold text-slate-700 group-hover:text-slate-900 transition-colors">{t.autoSave}</span>
                  <div className={`w-12 h-6 rounded-full transition-all relative ${settings.autoSave ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <motion.div
                      animate={{ x: settings.autoSave ? 24 : 4 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 sm:p-8 bg-slate-50/50 border-t border-slate-100">
              <button
                onClick={handleSave}
                className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl font-black text-lg flex items-center justify-center gap-3 transition-all shadow-xl shadow-emerald-200 active:scale-95"
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
