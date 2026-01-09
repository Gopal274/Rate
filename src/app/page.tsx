
import AppHeader from '@/components/app-header';
import { getAllProductsWithRatesAction } from '@/lib/actions';
import type { ProductWithRates } from '@/lib/types';
import ClientHomePage from '@/components/client-home-page';


export default async function Home() {
  // Fetch data on the server.
  const productsWithRates: ProductWithRates[] = await getAllProductsWithRatesAction();
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <ClientHomePage productsWithRates={productsWithRates} />
      </main>
    </div>
  );
}
