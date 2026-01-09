
import { getApps, initializeApp, getApp, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';
import { credential } from 'firebase-admin';

// This is a temporary solution to get the admin SDK working.
// In a real-world scenario, you would use service account credentials.
const getFirebaseAdminApp = (): App => {
  if (getApps().length) {
    return getApp();
  }
  // IMPORTANT: For App Hosting, the GOOGLE_APPLICATION_CREDENTIALS environment variable
  // is automatically set. `credential.applicationDefault()` will use this to authenticate.
  // For local development, you would need to set this environment variable manually
  // to point to your service account key file.
  return initializeApp({
      credential: credential.applicationDefault(),
      projectId: firebaseConfig.projectId
  });
};

export const getFirebaseAdmin = async () => {
    const app = getFirebaseAdminApp();
    const auth = getAuth(app);
    const firestore = getFirestore(app);

    return { app, auth, firestore };
};
