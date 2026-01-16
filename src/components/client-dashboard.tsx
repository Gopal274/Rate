
'use client';

import React, { useState, useMemo } from 'react';
import type { ProductWithRates } from '@/lib/types';
import { SummaryCards } from './summary-cards';
import { PriceTrendChart } from './price-trend-chart';
import { PriceEstimator } from './price-estimator';
import { QuantityCalculator } from './quantity-calculator';
import { PartyDistributionChart } from './party-distribution-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export default function ClientDashboard({ productsWithRates }: { productsWithRates: ProductWithRates[] }) {
  const [selectedParty, setSelectedParty] = useState<string | null>(null);

  const filteredProductsByParty = useMemo(() => {
    if (!selectedParty) {
      return productsWithRates;
    }
    return productsWithRates.filter(p => p.partyName === selectedParty);
  }, [productsWithRates, selectedParty]);

  return (
    <div className="space-y-6">
      <SummaryCards productsWithRates={productsWithRates} />
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        
        {/* Main content area */}
        <div className="lg:col-span-3">
          <PriceTrendChart productsWithRates={filteredProductsByParty} />
        </div>

        {/* Sidebar area */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
              <CardHeader>
                  <div className="flex justify-between items-start">
                      <div>
                          <CardTitle>Products by Party</CardTitle>
                          <CardDescription>Click a bar to filter the dashboard.</CardDescription>
                      </div>
                      {selectedParty && (
                        <Button variant="ghost" size="sm" onClick={() => setSelectedParty(null)}>
                            <X className="mr-2 h-4 w-4" />
                            Clear
                        </Button>
                      )}
                  </div>
              </CardHeader>
              <CardContent>
                  <PartyDistributionChart allProducts={productsWithRates} onPartySelect={setSelectedParty} />
              </CardContent>
          </Card>
          <QuantityCalculator productsWithRates={filteredProductsByParty} />
          <PriceEstimator productsWithRates={filteredProductsByParty} />
        </div>
      </div>
    </div>
  );
}
