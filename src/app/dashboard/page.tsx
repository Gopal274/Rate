
import AppHeader from '@/components/app-header';
import { getAllProductsWithRatesAction } from '@/lib/actions';
import type { ProductWithRates } from '@/lib/types';
import ClientDashboardPage from '@/components/client-dashboard-page';


export default async function DashboardPage() {
    const productsWithRates: ProductWithRates[] = await getAllProductsWithRatesAction();

    return (
        <div className="flex flex-col min-h-screen bg-background">
          <AppHeader />
          <ClientDashboardPage productsWithRates={productsWithRates} />
        </div>
      );
}
