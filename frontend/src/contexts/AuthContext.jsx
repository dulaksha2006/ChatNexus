import { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import api from '../api';

const AuthContext = createContext(null);

async function firebaseSignIn(firebaseToken) {
  if (!firebaseToken) return;
  try {
    const auth = getAuth();
    await signInWithCustomToken(auth, firebaseToken);
  } catch (e) {
    console.warn('Firebase sign-in failed:', e.message);
  }
}

async function firebaseSignOut() {
  try { await signOut(getAuth()); } catch (_) {}
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token         = localStorage.getItem('token');
    const firebaseToken = localStorage.getItem('firebaseToken');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      if (firebaseToken) firebaseSignIn(firebaseToken);
      api.get('/auth/me')
        .then(r => setUser(r.data))
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('firebaseToken');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    const { token, firebaseToken, user, needsTelegramVerify } = res.data;

    localStorage.setItem('token', token);
    if (firebaseToken) localStorage.setItem('firebaseToken', firebaseToken);

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);

    if (firebaseToken) await firebaseSignIn(firebaseToken);

    return { user, needsTelegramVerify };
  }

  async function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('firebaseToken');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    await firebaseSignOut();
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
