import { TrendingUp } from 'lucide-react';
import { Logo } from './icons';

export default function AppHeader() {
  return (
    <header className="border-b bg-card">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Logo className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Rate Record
          </h1>
        </div>
      </div>
    </header>
  );
}
