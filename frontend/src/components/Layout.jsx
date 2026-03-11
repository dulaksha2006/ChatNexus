import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Users, Globe,
  Settings, LogOut, Bot, Terminal, Menu, Zap, MessageCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getDb } from '../firebase';
import NotificationPanel from './NotificationPanel';
import clsx from 'clsx';

const ADMIN_NAV = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard'     },
  { to: '/sessions',      icon: MessageSquare,   label: 'Sessions'      },
  { to: '/workers',       icon: Users,           label: 'Workers'       },
  { to: '/commands',      icon: Terminal,        label: 'Bot Commands'  },
  { to: '/quick-replies', icon: Zap,             label: 'Quick Replies' },
  { to: '/languages',     icon: Globe,           label: 'Languages'     },
  { to: '/settings',      icon: Settings,        label: 'Settings'      },
];

const WORKER_NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chats',    icon: MessageCircle,   label: 'Chats'     },
  { to: '/sessions', icon: MessageSquare,   label: 'Sessions'  },
];

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen]     = useState(false);
  const [unread, setUnread] = useState(0);
  const nav = user?.role === 'admin' ? ADMIN_NAV : WORKER_NAV;

  useEffect(() => {
    if (user?.role !== 'worker') return;
    const db = getDb();
    if (!db) return;
    const q = query(collection(db, 'notifications'), where('workerId', '==', user.id), where('read', '==', false));
    return onSnapshot(q, snap => setUnread(snap.size), () => {});
  }, [user]);

  function handleLogout() { logout(); navigate('/login'); }

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-[#2d3333] border-r border-[#3a4040]">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-[#3a4040] shrink-0">
        <div className="w-7 h-7 rounded-md bg-[#1474d4] flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-[#ffffff]" />
        </div>
        <span className="font-semibold text-[#ffffff] text-sm tracking-tight">ChatNexus</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-100',
              isActive
                ? 'bg-[#1474d4]/15 text-[#4d9fe0] border border-[#1474d4]/25'
                : 'text-[#a8b4b4] hover:text-[#ffffff] hover:bg-[#3a4040] border border-transparent'
            )}
            onClick={() => setOpen(false)}>
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {label === 'Chats' && unread > 0 && (
              <span className="bg-[#e05050] text-[#ffffff] text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-2 pb-3 border-t border-[#3a4040] pt-2 shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2 mb-0.5">
          <div className="w-6 h-6 rounded-full bg-[#1474d4]/20 border border-[#1474d4]/40
                          flex items-center justify-center text-[11px] font-bold text-[#4d9fe0] shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#ffffff] truncate">{user?.name}</p>
            <p className="text-[10px] text-[#6b7878] capitalize">{user?.role}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-1.5 rounded-md text-sm
                     text-[#a8b4b4] hover:text-[#e05050] hover:bg-[#e05050]/10 transition-all">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-[#252b2b] overflow-hidden">

      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-56 shrink-0 flex-col">
        <Sidebar />
      </div>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-56 flex flex-col animate-slide-in">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center gap-3 px-5 border-b border-[#3a4040] bg-[#2d3333] shrink-0">
          <button onClick={() => setOpen(true)} className="lg:hidden text-[#a8b4b4] hover:text-[#ffffff] transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-[#ffffff] text-sm">{title}</h1>
          <div className="ml-auto">
            <NotificationPanel />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5 bg-[#252b2b]">
          {children}
        </main>
      </div>
    </div>
  );
}
