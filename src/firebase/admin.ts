
'use server';

import { getApps, initializeApp, getApp, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { credential } from 'firebase-admin';

const ADMIN_APP_NAME = 'firebase-admin';

// Helper function to initialize and get the Firebase Admin app.
// It ensures that we don't initialize the app more than once.
const getFirebaseAdminApp = (): App => {
  const existingApp = getApps().find(app => app.name === ADMIN_APP_NAME);
  if (existingApp) {
    return existingApp;
  }

  // In a Google Cloud environment (like App Hosting), the credentials
  // are automatically available. For local development, you'd need to
  // set up the GOOGLE_APPLICATION_CREDENTIALS environment variable.
  return initializeApp({
    credential: credential.applicationDefault(),
  }, ADMIN_APP_NAME);
};

export async function getFirebaseAdmin() {
    const app = getFirebaseAdminApp();
    const auth = getAuth(app);
    const firestore = getFirestore(app);

    return { app, auth, firestore };
};
