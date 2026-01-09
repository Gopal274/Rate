
import AppHeader from '@/components/app-header';
import { AuthForm } from '@/components/auth-form';
import { getAllProductsWithRatesAction } from '@/lib/actions';
import type { ProductWithRates } from '@/lib/types';
import { getFirebaseAdmin } from '@/firebase/admin';
import ClientDashboard from '@/components/client-dashboard';

// This is a pattern to get the user on the server.
async function getAuthenticatedUser() {
    try {
        const admin = await getFirebaseAdmin();
        const user = admin.auth.currentUser;
        if (user) {
            return {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
            };
        }
    } catch (e) {
        // This can happen if the admin SDK isn't initialized or during build.
        // It's safe to ignore and proceed as a logged-out user.
        return null;
    }
    return null;
}


export default async function DashboardPage() {
    const user = await getAuthenticatedUser();
    const productsWithRates: ProductWithRates[] = await getAllProductsWithRatesAction();

    if (!user) {
        return (
            <div className="flex flex-col min-h-screen bg-background">
                <AppHeader />
                <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                     <AuthForm />
                </main>
            </div>
        )
    }

    return (
        <div className="flex flex-col min-h-screen bg-background">
          <AppHeader />
          <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
              <ClientDashboard productsWithRates={productsWithRates} />
          </main>
        </div>
      );
}
