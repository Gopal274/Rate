
import AppHeader from '@/components/app-header';
import ClientDashboardPage from '@/components/client-dashboard-page';


export default function DashboardPage() {
    return (
        <div className="flex flex-col min-h-screen bg-background">
          <AppHeader />
          <ClientDashboardPage />
        </div>
      );
}
