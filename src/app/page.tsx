import AppHeader from '@/components/app-header';
import { ProductTable } from '@/components/product-table';
import { getProducts } from '@/lib/data';

export default async function Home() {
  const products = await getProducts();
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        <ProductTable initialProducts={products} />
      </main>
    </div>
  );
}
