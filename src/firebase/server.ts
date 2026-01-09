// This file is for server-side Firebase initialization.
// It is NOT marked with 'use server' at the top because it's a utility module
// that will be imported by other server-side files (like Server Actions).

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// This function is safe to call on the server.
export function initializeServerApp() {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

export function getSdks() {
  const app = initializeServerApp();
  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app),
  };
}
