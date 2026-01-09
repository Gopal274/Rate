
'use client';

import { useMemo } from 'react';
import { AuthForm } from '@/components/auth-form';
import ClientDashboard from '@/components/client-dashboard';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { Product, Rate } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';

export default function ClientDashboardPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const productsRef = useMemoFirebase(() => firestore ? collection(firestore, 'products') : null, [firestore]);
    const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);

    const ratesCollections = useMemoFirebase(() => {
        if (!products || !firestore) return {};
        const rateRefs: { [productId: string]: any } = {};
        products.forEach(p => {
            rateRefs[p.id] = query(collection(firestore, 'products', p.id, 'rates'), orderBy('createdAt', 'desc'));
        });
        return rateRefs;
    }, [products, firestore]);

    const productIds = products?.map(p => p.id).join(',') || '';
    
    const rateQueries = useMemoFirebase(() => {
        const queries: any[] = [];
        if (!productIds || !Object.keys(ratesCollections).length) return queries;
        
        const ids = productIds.split(',');
        ids.forEach(id => {
            if (ratesCollections[id]) {
                queries.push(ratesCollections[id]);
            }
        });
        return queries;
    }, [productIds, ratesCollections]);

    const useRateCollections = (queries: any[]) => {
        const results = queries.map(q => useCollection<Rate>(q));
        const isLoading = results.some(r => r.isLoading);
        
        const ratesByProductId = useMemoFirebase(() => {
            const map: { [productId: string]: Rate[] } = {};
            if (isLoading || !products) return map;

            products.forEach((p, index) => {
                const rateResult = results[index];
                if (rateResult && rateResult.data) {
                    map[p.id] = rateResult.data;
                }
            });
            return map;
        }, [isLoading, products, ...results.map(r => r.data)]);

        return { ratesByProductId, isLoading: isLoading };
    };
    
    const { ratesByProductId, isLoading: isLoadingRates } = useRateCollections(rateQueries);

    const productsWithRates = useMemoFirebase(() => {
        if (!products) return [];
        return products.map(p => ({
        ...p,
        rates: ratesByProductId[p.id] || []
        }));
    }, [products, ratesByProductId]);

    const isLoading = isLoadingProducts || isLoadingRates;

    if (!user) {
        return (
            <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                 <AuthForm />
            </main>
        )
    }

    if (isLoading) {
        return (
            <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                <p>Loading dashboard...</p>
            </main>
        )
    }

    return (
        <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <ClientDashboard productsWithRates={productsWithRates} />
        </main>
    );
}
