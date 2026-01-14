
'use client';

import React, { useState } from 'react';
import AppHeader from '@/components/app-header';
import ClientReconciliationPage from '@/components/client-reconciliation-page';
import { AuthForm } from '@/components/auth-form';
import { useUser } from '@/firebase';

export default function ReconciliationPage() {
  const { user } = useUser();

  if (!user) {
    return (
        <div className="flex flex-col min-h-screen bg-background">
            <AppHeader />
            <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
                <AuthForm />
            </main>
        </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <AppHeader />
      <main className="flex-1 container mx-auto p-4 sm:p-6 lg:p-8">
        <ClientReconciliationPage />
      </main>
    </div>
  );
}

