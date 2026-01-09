
import AppHeader from '@/components/app-header';
import { ProductTable } from '@/components/product-table';
import { AuthForm } from '@/components/auth-form';
import { getAllProductsWithRatesAction } from '@/lib/actions';
import type { ProductWithRates } from '@/lib/types';
import { getFirebaseAdmin } from '@/firebase/admin';

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

export default async function Home() {
  // Fetch data on the server.
  const user = await getAuthenticatedUser();
  const productsWithRates: ProductWithRates[] = await getAllProductsWithRatesAction();
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {user ? (
          <ProductTable allProductsWithRates={productsWithRates ?? []} />
        ) : (
          <div className="flex items-center justify-center pt-16">
            <AuthForm />
          </div>
        )}
      </main>
    </div>
  );
}
