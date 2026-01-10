
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Users, Clock, TrendingUp } from 'lucide-react';
import type { ProductWithRates } from '@/lib/types';
import { safeToDate } from '@/lib/utils';
import { format } from 'date-fns';

interface SummaryCardsProps {
  productsWithRates: ProductWithRates[];
}

const StatCard = ({ title, value, subtext, icon: Icon }: { title: string; value: string; subtext?: string; icon: React.ElementType }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
    </CardContent>
  </Card>
);

export function SummaryCards({ productsWithRates }: SummaryCardsProps) {
  const summary = React.useMemo(() => {
    const totalProducts = productsWithRates.length;
    const totalParties = new Set(productsWithRates.map(p => p.partyName)).size;
    
    let mostRecentUpdate = { name: '-', date: null as Date | null };
    let highestRateProduct = { name: '-', rate: 0 };

    if (productsWithRates.length > 0) {
      // Most recent update
      const productWithRecentUpdate = productsWithRates.reduce((latest, product) => {
        if (!product.rates?.[0]) return latest;
        const latestRateDate = safeToDate(product.rates[0].createdAt);
        if (!latest.rates?.[0] || latestRateDate > safeToDate(latest.rates[0].createdAt)) {
          return product;
        }
        return latest;
      });

      if (productWithRecentUpdate.rates?.[0]) {
        mostRecentUpdate = {
          name: productWithRecentUpdate.name,
          date: safeToDate(productWithRecentUpdate.rates[0].createdAt),
        };
      }
      
      // Highest rate product
      const productWithHighestRate = productsWithRates.reduce((highest, product) => {
        if (!product.rates?.[0]) return highest;
        const currentFinalRate = product.rates[0].rate * (1 + product.rates[0].gst / 100);
        
        if (!highest.rates?.[0]) return product;
        const highestFinalRate = highest.rates[0].rate * (1 + highest.rates[0].gst / 100);

        return currentFinalRate > highestFinalRate ? product : highest;
      });

      if (productWithHighestRate.rates?.[0]) {
        highestRateProduct = {
          name: productWithHighestRate.name,
          rate: productWithHighestRate.rates[0].rate * (1 + productWithHighestRate.rates[0].gst / 100),
        };
      }
    }

    return {
      totalProducts,
      totalParties,
      mostRecentUpdate,
      highestRateProduct,
    };
  }, [productsWithRates]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard 
        title="Total Products" 
        value={summary.totalProducts.toString()} 
        icon={Package} 
      />
      <StatCard 
        title="Total Parties" 
        value={summary.totalParties.toString()} 
        icon={Users} 
      />
      <StatCard 
        title="Most Recent Update" 
        value={summary.mostRecentUpdate.name}
        subtext={summary.mostRecentUpdate.date ? `on ${format(summary.mostRecentUpdate.date, 'dd MMM yyyy')}` : 'No updates yet'}
        icon={Clock} 
      />
      <StatCard 
        title="Highest Rate Product" 
        value={summary.highestRateProduct.name}
        subtext={summary.highestRateProduct.rate > 0 ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(summary.highestRateProduct.rate) : 'No rates available'}
        icon={TrendingUp} 
      />
    </div>
  );
}
