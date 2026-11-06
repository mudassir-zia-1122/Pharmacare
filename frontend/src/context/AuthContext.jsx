import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/auth.js';
import {
  auth as firebaseAuth,
  signInWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
  isFirebaseConfigured,
} from '../config/firebase.js';

const AuthContext = createContext(null);

// Fallback demo user for offline or demo evaluation
const DEMO_USER = {
  id: 1,
  name: 'Admin User (Demo)',
  username: 'admin',
  role: 'admin',
  email: 'admin@pharmacare.pk',
};

// Helper: map common Firebase Auth error codes to user-friendly messages
function getFirebaseErrorMessage(error) {
  const code = error.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'The email address is improperly formatted.';
    case 'auth/user-disabled':
      return 'This Firebase account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email in Firebase. Please register or use staff credentials.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password for Firebase account.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Console. Please enable it in Authentication -> Sign-in method.';
    case 'auth/too-many-requests':
      return 'Access temporarily blocked due to many failed attempts. Try again later or reset password.';
    case 'auth/network-request-failed':
      return 'Network connection to Firebase servers failed. Check internet access.';
    default:
      return error.message || 'Firebase authentication failed.';
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authProvider, setAuthProvider] = useState(null); // 'mysql' | 'firebase' | 'demo'
  const [isDemo, setIsDemo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Restore and verify session from localStorage
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const savedToken = localStorage.getItem('pharma_token');
      const savedUser = localStorage.getItem('pharma_user');
      const savedMode = localStorage.getItem('pharma_mode');
      const savedProvider = localStorage.getItem('pharma_provider') || 'mysql';

      if (savedToken && savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          if (savedMode === 'demo') {
            if (isMounted) {
              setToken(savedToken);
              setUser(parsedUser);
              setIsDemo(true);
              setAuthProvider('demo');
            }
          } else {
            // Verify token with backend
            try {
              const res = await authApi.getMe();
              const profile = res?.data || res;
              if (isMounted && profile && profile.id) {
                const refreshed = {
                  id: profile.id,
                  name: profile.full_name || profile.fullName || profile.username,
                  username: profile.username,
                  role: profile.role || profile.roleName || parsedUser.role,
                  email: profile.email,
                };
                setToken(savedToken);
                setUser(refreshed);
                setIsDemo(false);
                setAuthProvider(savedProvider);
              }
            } catch (err) {
              // If token expired/invalid, clear
              if (err.status === 401) {
                localStorage.removeItem('pharma_token');
                localStorage.removeItem('pharma_user');
                localStorage.removeItem('pharma_mode');
                localStorage.removeItem('pharma_provider');
              } else {
                // If offline, keep cached session
                if (isMounted) {
                  setToken(savedToken);
                  setUser(parsedUser);
                  setIsDemo(false);
                  setAuthProvider(savedProvider);
                }
              }
            }
          }
        } catch (e) {
          localStorage.removeItem('pharma_token');
          localStorage.removeItem('pharma_user');
          localStorage.removeItem('pharma_mode');
          localStorage.removeItem('pharma_provider');
        }
      }

      if (isMounted) {
        setIsLoading(false);
      }
    }

    restoreSession();

    // Firebase Auth State Listener
    let unsubscribe = () => {};
    if (isFirebaseConfigured && firebaseAuth) {
      try {
        unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
          // Keep listener active for reactive sign-out / session sync
          if (!firebaseUser && localStorage.getItem('pharma_provider') === 'firebase') {
            // Firebase signed out externally
          }
        });
      } catch (err) {
        console.warn('Firebase onAuthStateChanged listener initialization notice:', err.message);
      }
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  /**
   * Standard Staff Login (MySQL + Express):
   * Accepts username OR email + password.
   */
  const login = useCallback(async (identifier, password) => {
    if (!identifier || !password) {
      throw new Error('Please enter both username/email and password.');
    }

    try {
      const res = await authApi.login(identifier.trim(), password);
      const payload = res?.data?.token ? res.data : (res?.data || res);
      const apiToken = payload?.token;
      const apiUser = payload?.user;

      if (apiToken && apiUser) {
        const normalizedUser = {
          id: apiUser.id,
          name: apiUser.fullName || apiUser.username,
          username: apiUser.username,
          role: apiUser.role,
          email: apiUser.email,
        };

        localStorage.setItem('pharma_token', apiToken);
        localStorage.setItem('pharma_user', JSON.stringify(normalizedUser));
        localStorage.setItem('pharma_mode', 'live');
        localStorage.setItem('pharma_provider', 'mysql');

        setToken(apiToken);
        setUser(normalizedUser);
        setIsDemo(false);
        setAuthProvider('mysql');
        return { success: true, mode: 'live', user: normalizedUser };
      }
      throw new Error(res?.message || 'Login failed to return session token');
    } catch (err) {
      if (err.status === 401 || err.status === 400 || err.status === 403 || err.status === 422 || err.status === 429) {
        throw err;
      }

      // If backend is unreachable, gracefully fall back to demo mode
      console.warn('Backend API unavailable, activating demo session fallback:', err.message);
      const demoToken = 'demo-jwt-token-offline';
      const demoLoggedInUser = {
        ...DEMO_USER,
        username: identifier,
        name: identifier === 'admin' ? 'Administrator (Demo)' : identifier,
      };

      localStorage.setItem('pharma_token', demoToken);
      localStorage.setItem('pharma_user', JSON.stringify(demoLoggedInUser));
      localStorage.setItem('pharma_mode', 'demo');
      localStorage.setItem('pharma_provider', 'demo');

      setToken(demoToken);
      setUser(demoLoggedInUser);
      setIsDemo(true);
      setAuthProvider('demo');
      return { success: true, mode: 'demo', fallbackReason: err.message };
    }
  }, []);

  /**
   * Firebase Authentication Sign-In:
   * Authenticates with Firebase, obtains ID token, then maps to backend database user & role.
   */
  const loginWithFirebase = useCallback(async (email, password) => {
    if (!email || !password) {
      throw new Error('Please enter both Firebase email and password.');
    }

    if (!isFirebaseConfigured || !firebaseAuth) {
      throw new Error('Firebase Authentication is not configured in the application environment.');
    }

    try {
      // 1. Authenticate with Firebase Client SDK
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      const firebaseUser = credential.user;
      const idToken = await firebaseUser.getIdToken();

      // 2. Exchange Firebase authentication for authorized backend JWT & verified role
      const res = await authApi.firebaseLogin(idToken, firebaseUser.email);
      const payload = res?.data?.token ? res.data : (res?.data || res);
      const apiToken = payload?.token;
      const apiUser = payload?.user;

      if (apiToken && apiUser) {
        const normalizedUser = {
          id: apiUser.id,
          name: apiUser.fullName || apiUser.username,
          username: apiUser.username,
          role: apiUser.role,
          email: apiUser.email,
        };

        localStorage.setItem('pharma_token', apiToken);
        localStorage.setItem('pharma_user', JSON.stringify(normalizedUser));
        localStorage.setItem('pharma_mode', 'live');
        localStorage.setItem('pharma_provider', 'firebase');

        setToken(apiToken);
        setUser(normalizedUser);
        setIsDemo(false);
        setAuthProvider('firebase');
        return { success: true, mode: 'live', user: normalizedUser, provider: 'firebase' };
      }
      throw new Error(res?.message || 'Firebase login failed to return session token');
    } catch (err) {
      // Check if error is from Firebase
      if (err.code && err.code.startsWith('auth/')) {
        const friendlyMsg = getFirebaseErrorMessage(err);
        throw new Error(friendlyMsg);
      }
      // If error is from backend mapping (e.g. 403 user not authorized in staff directory)
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (firebaseAuth && firebaseAuth.currentUser) {
        await firebaseSignOut(firebaseAuth);
      }
    } catch (e) {
      // Non-blocking Firebase cleanup
    }

    try {
      if (token && !isDemo) {
        await authApi.logout();
      }
    } catch (e) {
      // Non-blocking backend cleanup
    } finally {
      localStorage.removeItem('pharma_token');
      localStorage.removeItem('pharma_user');
      localStorage.removeItem('pharma_mode');
      localStorage.removeItem('pharma_provider');
      setToken(null);
      setUser(null);
      setAuthProvider(null);
      setIsDemo(false);
    }
  }, [token, isDemo]);

  /** Check if current user has a given role */
  const hasRole = useCallback((roles) => {
    if (!user) return false;
    const allowed = Array.isArray(roles) ? roles : [roles];
    return allowed.includes(user.role);
  }, [user]);

  const isAuthenticated = Boolean(user && token);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authProvider,
        isDemo,
        isAuthenticated,
        isLoading,
        login,
        loginWithFirebase,
        logout,
        hasRole,
        isFirebaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
