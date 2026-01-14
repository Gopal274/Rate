
'use client';

import * as React from 'react';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import type { ProductWithRates, Rate } from '@/lib/types';
import { safeToDate } from '@/lib/utils';
import { format } from 'date-fns';

interface PriceTrendChartProps {
  productsWithRates: ProductWithRates[];
}

const chartConfig = {
  finalRate: {
    label: 'Final Rate',
    color: 'hsl(var(--chart-1))',
  },
};

export function PriceTrendChart({ productsWithRates }: PriceTrendChartProps) {
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Select a product with a trend by default
    if (!selectedProductId && productsWithRates.length > 0) {
      const firstProductWithTrend = productsWithRates.find(p => p.rates && p.rates.length > 1);
      if (firstProductWithTrend) {
        setSelectedProductId(firstProductWithTrend.id);
      } else {
        // Fallback to the first product with any rates
        const firstProductWithAnyRate = productsWithRates.find(p => p.rates && p.rates.length > 0);
        if (firstProductWithAnyRate) {
            setSelectedProductId(firstProductWithAnyRate.id);
        }
      }
    }
  }, [productsWithRates, selectedProductId]);

  const selectedProduct = React.useMemo(() => {
    return productsWithRates.find(p => p.id === selectedProductId);
  }, [selectedProductId, productsWithRates]);

  const chartData = React.useMemo(() => {
    if (!selectedProduct || !selectedProduct.rates) return [];
    
    return selectedProduct.rates
      .map(rate => ({
        billDate: safeToDate(rate.billDate),
        finalRate: rate.rate * (1 + rate.gst / 100),
      }))
      .sort((a, b) => a.billDate.getTime() - b.billDate.getTime()); // Sort by date ascending
  }, [selectedProduct]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Product Price Trend</CardTitle>
        <CardDescription>View the price history of a selected product.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <div className="space-y-4 flex-grow flex flex-col">
            <Select onValueChange={setSelectedProductId} value={selectedProductId ?? undefined}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                    {productsWithRates
                        .filter(p => p.rates && p.rates.length > 0)
                        .sort((a,b) => a.name.localeCompare(b.name))
                        .map(product => (
                            <SelectItem key={product.id} value={product.id}>
                                {product.name}
                            </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <div className="flex-grow w-full">
            {chartData.length > 1 ? (
                <ChartContainer config={chartConfig} className="min-h-[150px] w-full h-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="billDate"
                            tickFormatter={(tick) => format(tick, 'dd MMM')}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            interval="preserveStartEnd"
                        />
                         <YAxis 
                            tickFormatter={(tick) => `₹${tick.toFixed(0)}`}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            width={50}
                        />
                        <Tooltip
                            content={<ChartTooltipContent
                                indicator='dot'
                                labelFormatter={(label, payload) => {
                                    if(payload && payload.length > 0 && payload[0].payload) {
                                        return format(payload[0].payload.billDate, 'PPP');
                                    }
                                    return '';
                                }}
                                formatter={(value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value as number)}
                            />}
                        />
                        <Line
                            dataKey="finalRate"
                            type="monotone"
                            stroke="var(--color-finalRate)"
                            strokeWidth={2}
                            dot={true}
                        />
                    </LineChart>
                    </ResponsiveContainer>
                </ChartContainer>
            ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    {selectedProductId ? 'Not enough data to display a trend.' : 'Select a product to see its trend.'}
                </div>
            )}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
