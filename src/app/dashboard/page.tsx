
'use client';

import AppHeader from '@/components/app-header';
import { AuthForm } from '@/components/auth-form';
import { useFirebase, useUser, getAllProductsWithRatesAction } from '@/firebase';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { ProductWithRates } from '@/lib/types';
import GroupedProductView from '@/components/dashboard';
import { PartyDistributionChart } from '@/components/party-distribution-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function DashboardPage() {
  const { isUserLoading } = useFirebase();
  const { user } = useUser();
  const [productsWithRates, setProductsWithRates] = useState<ProductWithRates[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [openPartyAccordion, setOpenPartyAccordion] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
        if (!user) {
            setDataLoading(false);
            return;
        };

        setDataLoading(true);
        setError(null);
        try {
            const allProducts = await getAllProductsWithRatesAction();
            setProductsWithRates(allProducts);
        } catch (e: any) {
            console.error("Failed to fetch dashboard data:", e);
            setError(e);
        } finally {
            setDataLoading(false);
        }
    }
    
    fetchDashboardData();
  }, [user]);
  
  const handlePartySelect = (partyName: string) => {
    setOpenPartyAccordion(prev => prev === partyName ? null : partyName);
  };


  const isLoading = isUserLoading || dataLoading;

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
