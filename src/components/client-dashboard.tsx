
'use client';

import React, { useState } from 'react';
import type { ProductWithRates } from '@/lib/types';
import { SummaryCards } from './summary-cards';
import { PriceTrendChart } from './price-trend-chart';
import { PriceEstimator } from './price-estimator';
import { QuantityCalculator } from './quantity-calculator';

export default function ClientDashboard({ productsWithRates }: { productsWithRates: ProductWithRates[] }) {

  return (
    <div className="space-y-6">
      <SummaryCards productsWithRates={productsWithRates} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <QuantityCalculator productsWithRates={productsWithRates} />
        <PriceTrendChart productsWithRates={productsWithRates} />
        <PriceEstimator productsWithRates={productsWithRates} />
      </div>
    </div>
  );
}
