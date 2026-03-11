import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '../firebase';
import api from '../api';

const AuthContext = createContext(null);

async function firebaseSignIn(firebaseToken) {
  if (!firebaseToken) return;
  try {
    // Wait briefly for firebase app to be ready if needed
    let auth = getFirebaseAuth();
    if (!auth) {
      await new Promise(r => setTimeout(r, 500));
      auth = getFirebaseAuth();
    }
    if (!auth) { console.warn('Firebase Auth not ready'); return; }
    await signInWithCustomToken(auth, firebaseToken);
    console.log('Firebase signed in successfully');
  } catch (e) {
    console.warn('Firebase sign-in failed:', e.code, e.message);
  }
}

async function firebaseSignOut() {
  try {
    const auth = getFirebaseAuth();
    if (auth) await signOut(auth);
  } catch (_) {}
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token         = localStorage.getItem('token');
    const firebaseToken = localStorage.getItem('firebaseToken');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Re-sign in to Firebase on page reload (async, don't block)
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

    // Sign in to Firebase before resolving so Firestore listeners work immediately
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
