import React from 'react';
import { User, LogOut, Settings, Table, Sun, Moon, Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from './ui/Base';
import { IsraelFlag, USFlag } from './Flags';

interface HeaderProps {
  user: any;
  language: 'en' | 'he';
  setLanguage: (lang: 'en' | 'he') => void;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onLogout: () => void;
  translations: any;
  spreadsheetId?: string;
  spreadsheetName?: string;
  driveToken: string | null;
  onReconnectDrive: () => void;
  onCreateSpreadsheet?: () => void;
  isCreatingSpreadsheet?: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  user, language, setLanguage, onProfileClick, onSettingsClick, onLogout, translations, spreadsheetId, spreadsheetName, driveToken, onReconnectDrive, onCreateSpreadsheet, isCreatingSpreadsheet, theme, onToggleTheme 
}) => {
  const spreadsheetLink = spreadsheetId 
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    : null;

  const isDriveConnected = !!driveToken;
  const isSheetsConnected = !!spreadsheetId;

  return (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
          <span className="text-white font-black text-xl italic">R</span>
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight italic hidden sm:block">
          {translations[language].appTitle}
        </h1>
      </div>
      
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Connection Status Icons */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mr-2 rtl:ml-2 rtl:mr-0">
          {/* Google Drive Status */}
          <div className="relative group">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onReconnectDrive}
              className={`w-9 h-9 rounded-xl ${isDriveConnected ? 'text-emerald-600' : 'text-slate-400'}`}
              title={isDriveConnected ? 'Google Drive Connected' : 'Connect Google Drive'}
            >
              {isDriveConnected ? <Cloud size={18} /> : <CloudOff size={18} />}
            </Button>
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${isDriveConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </div>

          {/* Google Sheets Status */}
          <div className="relative group">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                if (isSheetsConnected) {
                  window.open(spreadsheetLink!, '_blank');
                } else if (onCreateSpreadsheet) {
                  onCreateSpreadsheet();
                } else {
                  onSettingsClick();
                }
              }}
              disabled={isCreatingSpreadsheet}
              className={`w-9 h-9 rounded-xl ${isSheetsConnected ? 'text-emerald-600' : 'text-slate-400'}`}
              title={isSheetsConnected ? `${language === 'he' ? 'פתח את' : 'Open'} ${spreadsheetName || 'Receipts Database'}` : (language === 'he' ? 'חבר את Google Sheets' : 'Connect Google Sheets')}
            >
              {isCreatingSpreadsheet ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Table size={18} />
              )}
            </Button>
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${isSheetsConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </div>

          {/* Refresh Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onReconnectDrive}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-emerald-600"
            title="Refresh Connections"
          >
            <RefreshCw size={16} />
          </Button>
        </div>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggleTheme}
          className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </Button>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setLanguage(language === 'en' ? 'he' : 'en')}
          className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {language === 'en' ? <IsraelFlag /> : <USFlag />}
        </Button>
        
        {user && (
          <div className="flex items-center gap-2 ml-2 rtl:mr-2 rtl:ml-0">
            <button 
              onClick={onProfileClick}
              className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-emerald-100 dark:border-emerald-900 hover:border-emerald-500 transition-all shadow-sm"
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                  <User size={20} />
                </div>
              )}
            </button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onSettingsClick}
              className="text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400"
            >
              <Settings size={20} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onLogout}
              className="text-slate-400 hover:text-red-500 dark:hover:text-red-400"
            >
              <LogOut size={20} />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
