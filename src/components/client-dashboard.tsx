
'use client';

import React, { useState } from 'react';
import type { ProductWithRates } from '@/lib/types';
import GroupedProductView from '@/components/dashboard';
import { PartyDistributionChart } from '@/components/party-distribution-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ClientDashboard({ productsWithRates }: { productsWithRates: ProductWithRates[] }) {
  const [openPartyAccordion, setOpenPartyAccordion] = useState<string | null>(null);

  const handlePartySelect = (partyName: string) => {
    setOpenPartyAccordion(prev => prev === partyName ? null : partyName);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <CardTitle>Party Distribution</CardTitle>
            <CardDescription>Number of unique products supplied by each party.</CardDescription>
        </CardHeader>
        <CardContent>
            <PartyDistributionChart allProducts={productsWithRates} onPartySelect={handlePartySelect} />
        </CardContent>
      </Card>
      <GroupedProductView allProducts={productsWithRates} openParty={openPartyAccordion} onOpenChange={setOpenPartyAccordion}/>
    </div>
  );
}
