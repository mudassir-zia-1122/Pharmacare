import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';

// Firebase project configuration using Vite environment variables with project fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyB1nOmKp23E9PVha0GZ-clRAKy51XiXmKM',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pharmacare-4ea64.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pharmacare-4ea64',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'pharmacare-4ea64.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1085052601219',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1085052601219:web:5302dca761a65eb3fa6cb6',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-96KMBWT2EW',
};

// Check if Firebase has a valid API key configured
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== 'your_firebase_api_key_here' &&
  firebaseConfig.projectId
);

// Prevent duplicate initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export {
  app,
  auth,
  signInWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
};

export default app;
