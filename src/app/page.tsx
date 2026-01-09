'use client';

import AppHeader from '@/components/app-header';
import { ProductTable } from '@/components/product-table';
import { AuthForm } from '@/components/auth-form';
import { useFirebase, useUser, getAllProductsWithRatesAction } from '@/firebase';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { ProductWithRates } from '@/lib/types';

export default function Home() {
  const { isUserLoading } = useFirebase();
  const { user } = useUser();
  const [productsWithRates, setProductsWithRates] = useState<ProductWithRates[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDataRefresh = () => {
    setRefreshKey(prevKey => prevKey + 1);
  };

  useEffect(() => {
    const fetchAllData = async () => {
      if (!user) {
        setDataLoading(false);
        return;
      }

      setDataLoading(true);
      setError(null);
      try {
        const allData = await getAllProductsWithRatesAction();
        setProductsWithRates(allData);
      } catch (e: any) {
        console.error("Failed to fetch all data:", e);
        setError(e);
      } finally {
        setDataLoading(false);
      }
    };

    fetchAllData();
  }, [user, refreshKey]);

  const isLoading = isUserLoading || dataLoading;

  if (isUserLoading) {
    return (
        <div className="flex flex-col min-h-screen bg-background">
            <AppHeader />
            <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
                 <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            </main>
        </div>
    )
  }

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
        {isLoading && !error && (
            <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </div>
        )}
        {error && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    There was an error fetching products: {error.message}
                </AlertDescription>
            </Alert>
        )}
        { !isLoading && !error && <ProductTable allProductsWithRates={productsWithRates ?? []} onDataChange={handleDataRefresh} /> }
      </main>
    </div>
  );
}
