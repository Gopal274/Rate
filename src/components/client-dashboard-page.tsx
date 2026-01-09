
'use client';

import { useMemo, useState, useEffect } from 'react';
import { AuthForm } from '@/components/auth-form';
import ClientDashboard from '@/components/client-dashboard';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { Product, Rate, ProductWithRates } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';

// A new component to fetch rates for a single product.
function ProductRatesLoader({ product, onRatesLoaded }: { product: Product, onRatesLoaded: (productId: string, rates: Rate[]) => void }) {
    const firestore = useFirestore();
    const ratesQuery = useMemoFirebase(
      () => firestore ? query(collection(firestore, 'products', product.id, 'rates'), orderBy('createdAt', 'desc')) : null,
      [firestore, product.id]
    );
    const { data: rates, isLoading } = useCollection<Rate>(ratesQuery);

    useEffect(() => {
      if (!isLoading && rates) {
        onRatesLoaded(product.id, rates);
      }
    }, [product.id, rates, isLoading, onRatesLoaded]);
    
    // This component doesn't render anything itself, it just loads data.
    return null;
}


export default function ClientDashboardPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [ratesByProductId, setRatesByProductId] = useState<Record<string, Rate[]>>({});
    const [loadedProductIds, setLoadedProductIds] = useState<Set<string>>(new Set());

    const productsRef = useMemoFirebase(() => firestore ? collection(firestore, 'products') : null, [firestore]);
    const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsRef);

    const handleRatesLoaded = useMemo(() => (productId: string, rates: Rate[]) => {
        setRatesByProductId(prev => ({ ...prev, [productId]: rates }));
        setLoadedProductIds(prev => new Set(prev).add(productId));
    }, []);

    const productsWithRates = useMemo((): ProductWithRates[] => {
        if (!products) return [];
        return products.map(p => ({
            ...p,
            rates: ratesByProductId[p.id] || []
        }));
    }, [products, ratesByProductId]);
    
    const allProductsCount = products?.length || 0;
    const allRatesLoaded = loadedProductIds.size === allProductsCount;
    const isLoading = isLoadingProducts || (allProductsCount > 0 && !allRatesLoaded);

    if (!user) {
        return (
            <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                 <AuthForm />
            </main>
        )
    }

    if (isLoading && !productsWithRates.length) { // Show loading only on initial load
        return (
            <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                <p>Loading dashboard...</p>
            </main>
        )
    }

    return (
        <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {products && products.map(product => (
                <ProductRatesLoader key={product.id} product={product} onRatesLoaded={handleRatesLoaded} />
            ))}
            <ClientDashboard productsWithRates={productsWithRates} />
        </main>
    );
}
