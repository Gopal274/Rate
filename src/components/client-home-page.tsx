
'use client';

import { useMemoFirebase, useUser, useFirestore, useCollection } from '@/firebase';
import { AuthForm } from '@/components/auth-form';
import { ProductTable } from '@/components/product-table';
import type { Product, Rate } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';

export default function ClientHomePage() {
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


  // We can't use useCollection in a loop, so we fetch each rate subcollection individually
  // This is not ideal, but it's a limitation we have to work with for now.
  // A better approach would be to denormalize the latest rate onto the product document.
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
      <div className="flex items-center justify-center pt-16">
        <AuthForm />
      </div>
    );
  }

  if (isLoading) {
      return (
          <div className="flex items-center justify-center h-96">
              <p>Loading products...</p>
          </div>
      )
  }

  return (
    <>
      <ProductTable allProductsWithRates={productsWithRates ?? []} />
    </>
  );
}
