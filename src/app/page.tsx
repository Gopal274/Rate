'use client';

import AppHeader from '@/components/app-header';
import { ProductTable } from '@/components/product-table';
import { AuthForm } from '@/components/auth-form';
import { useCollection, useFirebase, useUser, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Database } from 'lucide-react';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { seedDatabaseAction } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const { firestore, isUserLoading } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();

  const productsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Simple query to fetch all products. Sorting will be done on the client.
    return query(collection(firestore, 'products'));
  }, [firestore]);

  const { data: products, isLoading, error } = useCollection<Product>(productsQuery);
  
  // Memoize the client-side sorting and date conversion
  const enrichedProducts = useMemo(() => {
    if (!products) return [];
    
    const sorted = [...products].sort((a, b) => {
        // Handle both Firebase Timestamps and Date objects
        const dateA = (a.billDate as any)?.toDate ? (a.billDate as any).toDate() : new Date(a.billDate);
        const dateB = (b.billDate as any)?.toDate ? (b.billDate as any).toDate() : new Date(b.billDate);
        return dateB.getTime() - dateA.getTime();
    });

    return sorted.map(p => ({
        ...p,
        // Ensure billDate is always a JS Date object for the components
        billDate: (p.billDate as any)?.toDate ? (p.billDate as any).toDate() : new Date(p.billDate),
    }));
  }, [products]);


  const handleSeed = async () => {
    const result = await seedDatabaseAction();
    if (result.success) {
      toast({ title: 'Success', description: result.message });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message });
    }
  }


  if (isUserLoading) {
    return (
        <div className="flex flex-col min-h-screen bg-background">
            <AppHeader />
            <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
                 <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
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
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="absolute top-20 right-4 no-print">
            <Button onClick={handleSeed} variant="outline">
                <Database className="mr-2 h-4 w-4" />
                Seed Dummy Data
            </Button>
        </div>
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
        { !isLoading && !error && <ProductTable initialProducts={enrichedProducts ?? []} /> }
      </main>
    </div>
  );
}
