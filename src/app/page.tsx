
import AppHeader from '@/components/app-header';
import ClientHomePage from '@/components/client-home-page';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <ClientHomePage />
      </main>
    </div>
  );
}
