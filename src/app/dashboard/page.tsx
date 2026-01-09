
import AppHeader from '@/components/app-header';
import { AuthForm } from '@/components/auth-form';
import { getAllProductsWithRatesAction } from '@/lib/actions';
import type { ProductWithRates } from '@/lib/types';
import ClientDashboard from '@/components/client-dashboard';
import { useUser } from '@/firebase';

function DashboardContent({ productsWithRates }: { productsWithRates: ProductWithRates[] }) {
    'use client';
    const { user } = useUser();

    if (!user) {
        return (
            <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                 <AuthForm />
            </main>
        )
    }

    return (
        <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <ClientDashboard productsWithRates={productsWithRates} />
        </main>
    );
}


export default async function DashboardPage() {
    const productsWithRates: ProductWithRates[] = await getAllProductsWithRatesAction();

    return (
        <div className="flex flex-col min-h-screen bg-background">
          <AppHeader />
          <DashboardContent productsWithRates={productsWithRates} />
        </div>
      );
}
