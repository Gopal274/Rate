
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

    // This is a workaround for development to get a "user" on the server.
    // In a real app, you would manage user sessions properly.
    if (!auth.currentUser) {
        try {
            // Use a fixed UID for the "server user" in dev.
            const serverUID = 'server-user-uid';
            await auth.getUser(serverUID);
        } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
                await auth.createUser({ uid: serverUID, email: 'server@example.com' });
            }
        }
        // This doesn't "sign in" the user in a client sense, but it populates `auth.currentUser`
        // for subsequent server-side checks in this request's context.
        // NOTE: This is a simplified pattern and might not work across different serverless function invocations.
    }

    return { app, auth, firestore };
};
