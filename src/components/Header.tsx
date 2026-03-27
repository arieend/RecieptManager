import React from 'react';
import { User, LogOut } from 'lucide-react';
import { Button } from './ui/Base';
import { IsraelFlag, USFlag } from './Flags';

interface HeaderProps {
  user: any;
  language: 'en' | 'he';
  setLanguage: (lang: 'en' | 'he') => void;
  onProfileClick: () => void;
  onLogout: () => void;
  translations: any;
}

export const Header: React.FC<HeaderProps> = ({ 
  user, language, setLanguage, onProfileClick, onLogout, translations 
}) => (
  <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
        <span className="text-white font-black text-xl italic">R</span>
      </div>
      <h1 className="text-xl font-black text-slate-900 tracking-tight italic">
        {translations[language].appTitle}
      </h1>
    </div>
    
    <div className="flex items-center gap-2">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setLanguage(language === 'en' ? 'he' : 'en')}
        className="text-slate-500 hover:bg-slate-100"
      >
        {language === 'en' ? <IsraelFlag /> : <USFlag />}
      </Button>
      
      {user && (
        <div className="flex items-center gap-2 ml-2 rtl:mr-2 rtl:ml-0">
          <button 
            onClick={onProfileClick}
            className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-emerald-100 hover:border-emerald-500 transition-all shadow-sm"
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                <User size={20} />
              </div>
            )}
          </button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onLogout}
            className="text-slate-400 hover:text-red-500"
          >
            <LogOut size={20} />
          </Button>
        </div>
      )}
    </div>
  </header>
);
