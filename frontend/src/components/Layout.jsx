import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Users, Globe, Settings, LogOut, Terminal, Zap, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getDb } from '../firebase';
import NotificationPanel from './NotificationPanel';

const ADMIN_NAV = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/sessions',      icon: MessageSquare,   label: 'Sessions'     },
  { to: '/workers',       icon: Users,           label: 'Workers'      },
  { to: '/commands',      icon: Terminal,        label: 'Bot Commands' },
  { to: '/quick-replies', icon: Zap,             label: 'Quick Replies'},
  { to: '/languages',     icon: Globe,           label: 'Languages'    },
  { to: '/settings',      icon: Settings,        label: 'Settings'     },
];
const WORKER_NAV = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chats',    icon: MessageCircle,   label: 'Chats'     },
  { to: '/sessions', icon: MessageSquare,   label: 'Sessions'  },
];

function Sidebar({ user, nav, unread, onClose, onLogout }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', width:'220px', height:'100%', background:'#0a0a0a', borderRight:'1px solid #1a1a1a', position:'relative', zIndex:1 }}>
      {/* Brand */}
      <div style={{ padding:'0 20px', height:'56px', display:'flex', alignItems:'center', borderBottom:'1px solid #1a1a1a', flexShrink:0 }}>
        <span style={{ fontFamily:"'Space Mono', monospace", fontSize:'12px', fontWeight:'700', letterSpacing:'0.08em', textTransform:'uppercase', color:'#fff' }}>
          // ChatNexus
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'12px 8px', overflowY:'auto' }}>
        <div style={{ fontFamily:"'Space Mono', monospace", fontSize:'8px', letterSpacing:'0.14em', textTransform:'uppercase', color:'#333', padding:'4px 12px 8px' }}>
          Navigation
        </div>
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            onClick={onClose}
            style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:'10px',
              padding:'7px 12px', borderRadius:'1px', fontSize:'12px',
              textDecoration:'none', marginBottom:'1px',
              fontFamily:"'DM Sans', sans-serif",
              color: isActive ? '#fff' : '#888',
              background: isActive ? '#111' : 'transparent',
              borderLeft: isActive ? '2px solid #fff' : '2px solid transparent',
              transition: 'all 0.1s',
            })}>
            <Icon size={14} />
            <span style={{ flex:1 }}>{label}</span>
            {label === 'Chats' && unread > 0 && (
              <span style={{ background:'#fff', color:'#000', fontFamily:"'Space Mono', monospace", fontSize:'9px', fontWeight:'700', borderRadius:'1px', minWidth:'16px', height:'16px', display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px' }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop:'1px solid #1a1a1a', padding:'8px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', marginBottom:'2px' }}>
          <div style={{ width:'22px', height:'22px', border:'1px solid #333', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Space Mono', monospace", fontSize:'10px', fontWeight:'700', color:'#fff', flexShrink:0 }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:'12px', fontWeight:'600', color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
            <div style={{ fontFamily:"'Space Mono', monospace", fontSize:'9px', letterSpacing:'0.08em', textTransform:'uppercase', color:'#555' }}>{user?.role}</div>
          </div>
        </div>
        <button onClick={onLogout}
          style={{ display:'flex', alignItems:'center', gap:'8px', width:'100%', padding:'7px 12px', fontFamily:"'Space Mono', monospace", fontSize:'10px', letterSpacing:'0.06em', textTransform:'uppercase', color:'#555', background:'none', border:'none', cursor:'pointer', borderRadius:'1px', transition:'color 0.1s' }}
          onMouseEnter={e => e.currentTarget.style.color='#fff'}
          onMouseLeave={e => e.currentTarget.style.color='#555'}>
          <LogOut size={13} /> Sign Out
        </button>
      </div>
    </div>
  );
}

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const nav = user?.role === 'admin' ? ADMIN_NAV : WORKER_NAV;

  useEffect(() => {
    if (user?.role !== 'worker') return;
    const db = getDb(); if (!db) return;
    const q = query(collection(db,'notifications'), where('workerId','==',user.id), where('read','==',false));
    return onSnapshot(q, snap => setUnread(snap.size), () => {});
  }, [user]);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display:'flex', height:'100vh', background:'#000', overflow:'hidden' }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:block" style={{ width:'220px', flexShrink:0 }}>
        <Sidebar user={user} nav={nav} unread={unread} onClose={() => {}} onLogout={handleLogout} />
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden" style={{ position:'fixed', inset:0, zIndex:50 }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.85)' }} onClick={() => setMobileOpen(false)} />
          <div style={{ position:'absolute', left:0, top:0, bottom:0 }}>
            <Sidebar user={user} nav={nav} unread={unread} onClose={() => setMobileOpen(false)} onLogout={handleLogout} />
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
        {/* Header */}
        <header style={{ height:'56px', display:'flex', alignItems:'center', gap:'16px', padding:'0 24px', borderBottom:'1px solid #1a1a1a', background:'rgba(0,0,0,0.9)', backdropFilter:'blur(12px)', flexShrink:0, position:'relative', zIndex:2 }}>
          <button className="lg:hidden" onClick={() => setMobileOpen(true)}
            style={{ background:'none', border:'1px solid #1a1a1a', cursor:'pointer', color:'#888', display:'flex', padding:'6px', borderRadius:'1px' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect y="0" width="14" height="1.5"/><rect y="6" width="14" height="1.5"/><rect y="12" width="14" height="1.5"/></svg>
          </button>
          <span style={{ fontFamily:"'Space Mono', monospace", fontSize:'11px', fontWeight:'700', letterSpacing:'0.08em', textTransform:'uppercase', color:'#fff' }}>
            // {title}
          </span>
          <div style={{ marginLeft:'auto' }}>
            <NotificationPanel />
          </div>
        </header>
        {/* Content */}
        <main style={{ flex:1, overflowY:'auto', padding:'32px 24px', background:'transparent', position:'relative', zIndex:1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
