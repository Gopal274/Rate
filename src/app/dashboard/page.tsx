'use client';

import AppHeader from '@/components/app-header';
import { AuthForm } from '@/components/auth-form';
import { useCollection, useFirebase, useUser, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { Product } from '@/lib/types';
import Dashboard from '@/components/dashboard';

export default function DashboardPage() {
  const { firestore, isUserLoading } = useFirebase();
  const { user } = useUser();

  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'products'));
  }, [firestore]);

  const { data: productsFromHook, isLoading, error } = useCollection<Product>(productsQuery);

  const products = useMemo(() => {
    if (!productsFromHook) return [];
    return productsFromHook.map(p => ({
        ...p,
        billDate: (p.billDate as any)?.toDate ? (p.billDate as any).toDate() : new Date(p.billDate || new Date()),
    }));
  }, [productsFromHook]);


  if (isUserLoading) {
    return (
        <div className="flex flex-col min-h-screen bg-background">
            <AppHeader />
            <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
                 <div className="space-y-4">
                    <Skeleton className="h-48 w-full" />
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-28 w-full col-span-1 lg:col-span-2" />
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
        { !isLoading && !error && <Dashboard allProducts={products ?? []} /> }
      </main>
    </div>
  );
}
