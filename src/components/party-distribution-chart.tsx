'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { type ProductWithRates } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';

interface PartyDistributionChartProps {
  allProducts: ProductWithRates[];
  onPartySelect: (partyName: string) => void;
}

interface ChartData {
  partyName: string;
  productCount: number;
}

const chartConfig = {
  productCount: {
    label: 'Products',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

export function PartyDistributionChart({ allProducts, onPartySelect }: PartyDistributionChartProps) {
  const chartData = React.useMemo(() => {
    const counts: { [partyName: string]: number } = {};
    for (const product of allProducts) {
      if (!counts[product.partyName]) {
        counts[product.partyName] = 0;
      }
      counts[product.partyName]++;
    }
    return Object.entries(counts)
      .map(([partyName, productCount]) => ({ partyName, productCount }))
      .sort((a, b) => b.productCount - a.productCount);
  }, [allProducts]);

  if (chartData.length === 0) {
    return <div className="flex h-48 items-center justify-center text-muted-foreground">No data to display</div>;
  }

  return (
    <div className="w-full h-80">
      <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{
              top: 5,
              right: 20,
              left: 60, 
              bottom: 5,
            }}
            
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" />
            <YAxis 
                dataKey="partyName" 
                type="category" 
                width={150} 
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--accent))' }}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar 
              dataKey="productCount" 
              fill="var(--color-productCount)" 
              radius={4}
              onClick={(data) => onPartySelect(data.partyName)}
              style={{ cursor: 'pointer' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
