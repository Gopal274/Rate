
'use client';

import { AuthForm } from '@/components/auth-form';
import { ProductTable } from '@/components/product-table';
import { useUser } from '@/firebase';
import type { ProductWithRates } from '@/lib/types';

export default function ClientHomePage({ productsWithRates }: { productsWithRates: ProductWithRates[] }) {
  const { user } = useUser();

  return (
    <>
      {user ? (
        <ProductTable allProductsWithRates={productsWithRates ?? []} />
      ) : (
        <div className="flex items-center justify-center pt-16">
          <AuthForm />
        </div>
      )}
    </>
  );
}
