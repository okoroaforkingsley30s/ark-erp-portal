import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Search } from 'lucide-react';

export default function MobileHeader({ title, showBack = false, notifCount = 0, onSearch }) {
  const navigate = useNavigate();

  return (
    <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3"
      style={{ background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)', borderBottom: '1px solid rgba(251,191,36,0.15)' }}>
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 active:bg-white/20">
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-black text-xs tracking-widest uppercase">ARK ONE</span>
          </div>
          <h1 className="text-white font-bold text-base leading-tight">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onSearch && (
          <button onClick={onSearch}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 active:bg-white/20">
            <Search className="w-4 h-4 text-white/70" />
          </button>
        )}
        <button
          onClick={() => navigate('/notifications')}
          className="relative w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 active:bg-white/20">
          <Bell className="w-4 h-4 text-white/70" />
          {notifCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
      </div>
    </div>
  );
}