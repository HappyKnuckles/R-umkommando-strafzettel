import { getApps, initializeApp } from 'firebase/app';
import { Firestore, initializeFirestore } from 'firebase/firestore';

// Values come from .env.local (see .env.example). EXPO_PUBLIC_* vars must be referenced literally.
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = !!config.apiKey && !!config.projectId;

function createDb(): Firestore | null {
  if (!firebaseConfigured) return null;
  const app = getApps()[0] ?? initializeApp(config);
  return initializeFirestore(app, { ignoreUndefinedProperties: true });
}

const instance = createDb();

export function db(): Firestore {
  if (!instance) throw new Error('Firebase ist nicht konfiguriert (.env.local fehlt)');
  return instance;
}
