import React from 'react';
import { ArrowLeft, User, Mail, Shield, Settings, LogOut, ChevronRight } from 'lucide-react';
import { Button, Card } from './ui/Base';

interface ProfileViewProps {
  user: any;
  onBack: () => void;
  onLogout: () => void;
  onReconnectDrive: () => void;
  driveToken: string | null;
  translations: any;
  language: 'en' | 'he';
}

export const ProfileView: React.FC<ProfileViewProps> = ({ 
  user, onBack, onLogout, onReconnectDrive, driveToken, translations, language 
}) => (
  <main className="flex-1 flex flex-col bg-slate-50">
    {/* Header */}
    <div className="bg-white border-b border-slate-200 p-4 flex items-center gap-3 sticky top-0 z-30">
      <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
        <ArrowLeft size={20} />
      </Button>
      <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
        <User size={24} className="text-emerald-600" />
        {translations[language].profile}
      </h2>
    </div>

    <div className="flex-1 overflow-y-auto p-6 space-y-8">
      {/* Profile Card */}
      <Card className="p-8 flex flex-col items-center text-center bg-emerald-600 text-white border-none shadow-xl shadow-emerald-200">
        <div className="w-24 h-24 rounded-[2rem] overflow-hidden border-4 border-white/30 shadow-2xl mb-4">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-white/20 flex items-center justify-center text-white">
              <User size={48} />
            </div>
          )}
        </div>
        <h3 className="text-2xl font-black tracking-tight">{user?.displayName || translations[language].user}</h3>
        <p className="text-white/70 font-medium">{user?.email}</p>
      </Card>

      {/* Drive Status Section */}
      <section className="space-y-4">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">
          {translations[language].driveStatus}
        </h4>
        <Card className="p-4 flex justify-between items-center bg-white border border-slate-200">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${driveToken ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
              <Settings size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                {driveToken ? translations[language].driveConnected : translations[language].driveDisconnected}
              </p>
              <p className="text-[10px] text-slate-400 font-medium italic">
                {language === 'he' ? 'שומר חשבוניות בתיקיית RECEIPTS' : 'Saving receipts to RECEIPTS folder'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onReconnectDrive}>
            {translations[language].reconnectDrive}
          </Button>
        </Card>
      </section>

      {/* Settings Section */}
      <section className="space-y-4">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">
          {translations[language].accountSettings}
        </h4>
        <div className="space-y-2">
          <Card className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                <Mail size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{translations[language].emailNotifications}</p>
                <p className="text-[10px] text-slate-400 font-medium">{translations[language].enabled}</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </Card>
          
          <Card className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                <Shield size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{translations[language].privacySecurity}</p>
                <p className="text-[10px] text-slate-400 font-medium">{translations[language].managedByGoogle}</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300" />
          </Card>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="space-y-4">
        <h4 className="text-xs font-black text-red-400 uppercase tracking-widest px-1">
          {translations[language].dangerZone}
        </h4>
        <Button 
          variant="danger" 
          onClick={onLogout}
          className="w-full justify-between px-6 py-4 rounded-3xl"
          rightIcon={<LogOut size={20} />}
        >
          {translations[language].logout}
        </Button>
      </section>
    </div>
  </main>
);
