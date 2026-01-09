
import { getApps, initializeApp, getApp, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

// This is a temporary solution to get the admin SDK working.
// In a real-world scenario, you would use service account credentials.
const getFirebaseAdminApp = (): App => {
  if (getApps().length) {
    return getApp();
  }
  return initializeApp({
      projectId: firebaseConfig.projectId
  });
};

export const getFirebaseAdmin = async () => {
    const app = getFirebaseAdminApp();
    const auth = getAuth(app);
    const firestore = getFirestore(app);

    return { app, auth, firestore };
};
