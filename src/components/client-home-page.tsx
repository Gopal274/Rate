
'use client';

import { useMemo, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { AuthForm } from '@/components/auth-form';
import { ProductTable } from '@/components/product-table';
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

    useMemo(() => {
      if (!isLoading && rates) {
        onRatesLoaded(product.id, rates);
      }
    }, [product.id, rates, isLoading, onRatesLoaded]);
    
    // This component doesn't render anything itself, it just loads data.
    return null;
}


export default function ClientHomePage() {
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
  const isLoading = isLoadingProducts || !allRatesLoaded;

  if (!user) {
    return (
      <div className="flex items-center justify-center pt-16">
        <AuthForm />
      </div>
    );
  }

  if (isLoading && !productsWithRates.length) { // Show loading only on initial load
      return (
          <div className="flex items-center justify-center h-96">
              <p>Loading products...</p>
          </div>
      )
  }

  return (
    <>
      {products && products.map(product => (
          <ProductRatesLoader key={product.id} product={product} onRatesLoaded={handleRatesLoaded} />
      ))}
      <ProductTable allProductsWithRates={productsWithRates ?? []} />
    </>
  );
}
