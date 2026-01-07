'use client';

import AppHeader from '@/components/app-header';
import { ProductTable } from '@/components/product-table';
import { useCollection, useFirebase, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, LogIn } from 'lucide-react';
import type { Product } from '@/lib/types';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { firestore, auth, isUserLoading } = useFirebase();
  const { user } = useUser();

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'products'),
      where('ownerId', '==', user.uid),
      orderBy('billDate', 'desc')
    );
  }, [firestore, user]);

  const { data: products, isLoading, error } = useCollection<Product>(productsQuery);
  
  const handleSignIn = () => {
      import('firebase/auth').then(({ signInAnonymously }) => {
          signInAnonymously(auth);
      });
  }

  const enrichedProducts = useMemo(() => {
    if (!products) return [];
    // The useCollection hook now returns dates correctly if they are Timestamps
    return products.map(p => ({
        ...p,
        billDate: (p.billDate as any).toDate ? (p.billDate as any).toDate() : p.billDate,
    }));
  }, [products]);


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
                 <div className="text-center">
                    <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h2 className="mt-4 text-xl font-semibold">Please Sign In</h2>
                    <p className="mt-2 text-muted-foreground">You need to be signed in to manage your products.</p>
                    <Button onClick={handleSignIn} className="mt-4">
                        <LogIn className="mr-2 h-4 w-4" />
                        Sign In Anonymously
                    </Button>
                </div>
            </main>
        </div>
    )
  }


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        {isLoading && (
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
                    There was an error fetching products. Please check your security rules and network connection.
                </AlertDescription>
            </Alert>
        )}
        { !isLoading && !error && <ProductTable initialProducts={enrichedProducts ?? []} /> }
      </main>
    </div>
  );
}
