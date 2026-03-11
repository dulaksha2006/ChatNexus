import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import api from './api';

import SetupWizard     from './pages/SetupWizard';
import Login           from './pages/Login';
import TelegramVerify  from './pages/TelegramVerify';
import AdminDashboard  from './pages/AdminDashboard';
import WorkerDashboard from './pages/WorkerDashboard';
import WorkerChats    from './pages/WorkerChats';
import Workers         from './pages/Workers';
import Languages       from './pages/Languages';
import Settings        from './pages/Settings';
import Sessions        from './pages/Sessions';
import Commands        from './pages/Commands';
import QuickReplies    from './pages/QuickReplies';

function Spinner() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const [setupDone, setSetupDone] = useState(null);
  const [checking, setChecking]   = useState(true);

  useEffect(() => {
    api.get('/setup/status')
      .then(r => setSetupDone(r.data.setupComplete))
      .catch(() => setSetupDone(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking || loading) return <Spinner />;

  if (!setupDone) return (
    <Routes>
      <Route path="/setup" element={<SetupWizard onComplete={() => setSetupDone(true)} />} />
      <Route path="*"      element={<Navigate to="/setup" replace />} />
    </Routes>
  );

  if (!user) return (
    <Routes>
      <Route path="/login"          element={<Login />} />
      <Route path="/reset-password" element={<Login mode="reset" />} />
      <Route path="*"               element={<Navigate to="/login" replace />} />
    </Routes>
  );

  if (user.role === 'worker' && !user.telegramVerified) return (
    <Routes>
      <Route path="/telegram-verify" element={<TelegramVerify />} />
      <Route path="*"                element={<Navigate to="/telegram-verify" replace />} />
    </Routes>
  );

  if (user.role === 'admin') return (
    <Routes>
      <Route path="/"               element={<AdminDashboard />} />
      <Route path="/sessions"       element={<Sessions />} />
      <Route path="/workers"        element={<Workers />} />
      <Route path="/languages"      element={<Languages />} />
      <Route path="/commands"       element={<Commands />} />
      <Route path="/quick-replies"  element={<QuickReplies />} />
      <Route path="/settings"       element={<Settings />} />
      <Route path="*"               element={<Navigate to="/" replace />} />
    </Routes>
  );

  // Worker routes
  return (
    <Routes>
      <Route path="/"         element={<WorkerDashboard />} />
      <Route path="/chats"    element={<WorkerChats />} />
      <Route path="/sessions" element={<Sessions />} />
      <Route path="*"         element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
