import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Users, Globe,
  Settings, LogOut, Bot, Terminal, Menu, X, Zap,
  Bell, MessageCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getDb } from '../firebase';
import clsx from 'clsx';
import NotificationPanel from './NotificationPanel';

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
  const [open, setOpen]   = useState(false);
  const [unread, setUnread] = useState(0);
  const nav = user?.role === 'admin' ? ADMIN_NAV : WORKER_NAV;

  // Real-time unread notifications for workers
  useEffect(() => {
    if (user?.role !== 'worker') return;
    const db = getDb();
    if (!db) return;
    const q = query(
      collection(db, 'notifications'),
      where('workerId', '==', user.id),
      where('read', '==', false)
    );
    return onSnapshot(q, snap => setUnread(snap.size), () => {});
  }, [user]);

  function handleLogout() { logout(); navigate('/login'); }

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-[#161b22] border-r border-[#21262d]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-[#21262d] shrink-0">
        <div className="w-6 h-6 rounded-md bg-[#1f6feb] flex items-center justify-center">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-semibold text-[#e6edf3] text-sm tracking-tight">ChatNexus</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => clsx(
              'flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-all duration-100',
              isActive
                ? 'bg-[#1f6feb]/15 text-[#58a6ff] font-medium'
                : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]'
            )}
            onClick={() => setOpen(false)}>
            <Icon className="w-4 h-4 shrink-0" />
            {label}
            {/* Notification badge on Chats */}
            {label === 'Chats' && unread > 0 && (
              <span className="ml-auto bg-[#da3633] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-2 pb-3 border-t border-[#21262d] pt-2 shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-md mb-0.5">
          <div className="w-6 h-6 rounded-full bg-[#1f6feb]/20 border border-[#1f6feb]/30 flex items-center justify-center text-xs font-semibold text-[#58a6ff] shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#e6edf3] truncate">{user?.name}</p>
            <p className="text-xs text-[#6e7681] truncate capitalize">{user?.role}</p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-1.5 rounded-md text-sm text-[#8b949e] hover:text-[#f85149] hover:bg-[#da3633]/10 transition-all">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-[#0d1117] overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-56 shrink-0 flex-col">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-56 flex flex-col animate-slide-in">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="h-14 flex items-center gap-3 px-5 border-b border-[#21262d] bg-[#161b22] shrink-0">
          <button onClick={() => setOpen(true)} className="lg:hidden text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-[#e6edf3] text-sm">{title}</h1>
          <div className="ml-auto">
            <NotificationPanel />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 bg-[#0d1117]">
          {children}
        </main>
      </div>
    </div>
  );
}
