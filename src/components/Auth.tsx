
import React, { useState } from 'react';
import { signUp, logIn } from '../services/firebaseService';
import { UserRole, Language } from '../types';
import { LogIn, UserPlus, Mail, Lock, User as UserIcon, Loader2 } from 'lucide-react';
import { t } from '../translations';

export const Auth: React.FC<{ language: Language }> = ({ language }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.CONSUMER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        await logIn(email, password);
      } else {
        await signUp(email, password, name, role);
      }
    } catch (err: any) {
      setError(err.message || t('auth_failed', language.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#fcfdfd]">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-[3rem] shadow-2xl border border-agri-sand/50 animate-slide-up">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-agri-forest rounded-3xl flex items-center justify-center text-4xl shadow-lg mx-auto mb-4">🌾</div>
          <h2 className="text-3xl font-black text-agri-forest">{isLogin ? t('welcome_back', language.code) : t('join_krishix', language.code)}</h2>
          <p className="text-agri-moss text-sm font-medium">{isLogin ? t('login_desc', language.code) : t('signup_desc', language.code)}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setRole(UserRole.CONSUMER)}
                  className={`py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all border-2 ${role === UserRole.CONSUMER ? 'bg-agri-forest text-white border-agri-forest shadow-lg' : 'bg-white text-agri-moss border-agri-sand'}`}>
                  🧺 {t('consumer', language.code)}
                </button>
                <button type="button" onClick={() => setRole(UserRole.FARMER)}
                  className={`py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all border-2 ${role === UserRole.FARMER ? 'bg-agri-forest text-white border-agri-forest shadow-lg' : 'bg-white text-agri-moss border-agri-sand'}`}>
                  🚜 {t('farmer', language.code)}
                </button>
              </div>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-agri-moss" />
                <input type="text" placeholder={t('full_name', language.code)} value={name} onChange={(e) => setName(e.target.value)} required
                  className="w-full bg-agri-ivory border-2 border-agri-sand rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-agri-forest font-bold text-agri-forest" />
              </div>
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-agri-moss" />
            <input type="email" placeholder={t('email_address', language.code)} value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full bg-agri-ivory border-2 border-agri-sand rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-agri-forest font-bold text-agri-forest" />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-agri-moss" />
            <input type="password" placeholder={t('password', language.code)} value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full bg-agri-ivory border-2 border-agri-sand rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-agri-forest font-bold text-agri-forest" />
          </div>

          {error && <p className="text-red-500 text-[10px] font-black uppercase text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-5 bg-agri-forest text-white rounded-2xl font-black text-lg shadow-xl hover:bg-agri-moss transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : isLogin ? <LogIn className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
            {isLogin ? t('sign_in', language.code) : t('create_account', language.code)}
          </button>
        </form>

        <div className="text-center pt-4">
          <button onClick={() => setIsLogin(!isLogin)} className="text-xs font-black text-agri-moss uppercase tracking-widest hover:text-agri-forest transition-colors">
            {isLogin ? t('no_account', language.code) : t('have_account', language.code)}
          </button>
        </div>
      </div>
    </div>
  );
};
