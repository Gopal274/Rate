'use client';

import AppHeader from '@/components/app-header';
import { AuthForm } from '@/components/auth-form';
import { useCollection, useFirebase, useUser, useMemoFirebase, getProductRatesAction } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { Product, Rate, ProductWithRates } from '@/lib/types';
import GroupedProductView from '@/components/dashboard';
import { PartyDistributionChart } from '@/components/party-distribution-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function DashboardPage() {
  const { firestore, isUserLoading } = useFirebase();
  const { user } = useUser();
  const [productsWithRates, setProductsWithRates] = useState<ProductWithRates[]>([]);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [openPartyAccordion, setOpenPartyAccordion] = useState<string | null>(null);


  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'products'));
  }, [firestore]);

  const { data: productsFromHook, isLoading: productsLoading, error } = useCollection<Product>(productsQuery);

  useEffect(() => {
    const fetchAllRates = async () => {
      if (productsFromHook && productsFromHook.length > 0) {
        setRatesLoading(true);
        const allProductsWithRates: ProductWithRates[] = [];
        for (const product of productsFromHook) {
          try {
            const fetchedRates = await getProductRatesAction(product.id);
            const ratesWithDates = fetchedRates.map(r => ({
                ...r,
                billDate: new Date(r.billDate),
                createdAt: new Date(r.createdAt),
            })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            
            allProductsWithRates.push({ ...product, rates: ratesWithDates });
          } catch (error) {
            console.error(`Failed to fetch rates for product ${product.id}:`, error);
            allProductsWithRates.push({ ...product, rates: [] });
          }
        }
        setProductsWithRates(allProductsWithRates);
        setRatesLoading(false);
      } else if (productsFromHook) {
        setProductsWithRates([]);
        setRatesLoading(false);
      }
    };
    
    fetchAllRates();
  }, [productsFromHook]);
  
  const handlePartySelect = (partyName: string) => {
    // If the same party is clicked again, close it. Otherwise, open the new one.
    setOpenPartyAccordion(prev => prev === partyName ? null : partyName);
  };


  const isLoading = isUserLoading || productsLoading || ratesLoading;

  if (isUserLoading) {
    return (
        <div className="flex flex-col min-h-screen bg-background">
            <AppHeader />
            <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
                 <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
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
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        )}
        {error && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    There was an error fetching dashboard data: {error.message}
                </AlertDescription>
            </Alert>
        )}
        { !isLoading && !error && (
          <div className="space-y-6">
              <Card>
                <CardHeader>
                    <CardTitle>Party Distribution</CardTitle>
                    <CardDescription>Number of unique products supplied by each party.</CardDescription>
                </CardHeader>
                <CardContent>
                    <PartyDistributionChart allProducts={productsWithRates} onPartySelect={handlePartySelect} />
                </CardContent>
              </Card>
              <GroupedProductView allProducts={productsWithRates} openParty={openPartyAccordion} onOpenChange={setOpenPartyAccordion}/>
          </div>
        )}
      </main>
    </div>
  );
}
