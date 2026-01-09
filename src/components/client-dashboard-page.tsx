
'use client';

import { AuthForm } from '@/components/auth-form';
import ClientDashboard from '@/components/client-dashboard';
import { useUser } from '@/firebase';
import type { ProductWithRates } from '@/lib/types';


export default function ClientDashboardPage({ productsWithRates }: { productsWithRates: ProductWithRates[] }) {
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
