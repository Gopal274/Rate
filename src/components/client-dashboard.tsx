
'use client';

import React, { useState } from 'react';
import type { ProductWithRates } from '@/lib/types';
import GroupedProductView from '@/components/dashboard';
import { PartyDistributionChart } from '@/components/party-distribution-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SummaryCards } from './summary-cards';
import { PriceTrendChart } from './price-trend-chart';
import { PriceEstimator } from './price-estimator';
import { QuantityCalculator } from './quantity-calculator';

export default function ClientDashboard({ productsWithRates }: { productsWithRates: ProductWithRates[] }) {
  const [openPartyAccordion, setOpenPartyAccordion] = useState<string | null>(null);

  const handlePartySelect = (partyName: string) => {
    setOpenPartyAccordion(prev => prev === partyName ? null : partyName);
  };

  return (
    <div className="space-y-6">
      <SummaryCards productsWithRates={productsWithRates} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
              <CardTitle>Party Distribution</CardTitle>
              <CardDescription>Number of unique products supplied by each party.</CardDescription>
          </CardHeader>
          <CardContent>
              <PartyDistributionChart allProducts={productsWithRates} onPartySelect={handlePartySelect} />
          </CardContent>
        </Card>
        <div className="lg:col-span-3 grid grid-rows-3 gap-6">
          <QuantityCalculator productsWithRates={productsWithRates} />
          <PriceTrendChart productsWithRates={productsWithRates} />
          <PriceEstimator productsWithRates={productsWithRates} />
        </div>
      </div>
      <GroupedProductView allProducts={productsWithRates} openParty={openPartyAccordion} onOpenChange={setOpenPartyAccordion}/>
    </div>
  );
}
