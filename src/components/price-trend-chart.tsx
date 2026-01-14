
'use client';

import * as React from 'react';
import {
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Brush,
  Line,
} from 'recharts';
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
import { ChartContainer, ChartTooltipContent }from '@/components/ui/chart';
import type { ProductWithRates } from '@/lib/types';
import { safeToDate } from '@/lib/utils';
import { format } from 'date-fns';

interface PriceTrendChartProps {
  productsWithRates: ProductWithRates[];
}

interface CandlestickData {
  date: number; // monthly timestamp
  prices: [number, number, number, number]; // open, high, low, close
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
};

const CustomCandle = (props: any) => {
  const { x, y, width, height, low, high, open, close, fill } = props;
  const isRising = close > open;
  const color = isRising ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-1))';

  return (
    <g stroke={color} fill="none" strokeWidth="1">
      {/* High-Low line */}
      <path d={`M ${x + width / 2},${y} L ${x + width / 2},${height}`} />
      {/* Candle body */}
      <path
        d={`M ${x},${Math.min(open, close)} H ${x + width} V ${Math.max(open, close)} H ${x} Z`}
        fill={color}
      />
    </g>
  );
};


export function PriceTrendChart({ productsWithRates }: PriceTrendChartProps) {
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedProductId && productsWithRates.length > 0) {
      const firstProductWithTrend = productsWithRates.find(p => p.rates && p.rates.length > 1);
      if (firstProductWithTrend) {
        setSelectedProductId(firstProductWithTrend.id);
      } else {
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

  const chartData = React.useMemo((): CandlestickData[] => {
    if (!selectedProduct || !selectedProduct.rates || selectedProduct.rates.length === 0) return [];
    
    const sortedRates = selectedProduct.rates
      .map(rate => ({
        date: safeToDate(rate.billDate),
        finalRate: rate.rate * (1 + rate.gst / 100),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const groupedByMonth: { [key: string]: { rates: number[] } } = {};

    for (const rate of sortedRates) {
        const monthKey = format(rate.date, 'yyyy-MM');
        if (!groupedByMonth[monthKey]) {
            groupedByMonth[monthKey] = { rates: [] };
        }
        groupedByMonth[monthKey].rates.push(rate.finalRate);
    }
    
    return Object.entries(groupedByMonth).map(([monthKey, data]) => {
      const open = data.rates[0];
      const close = data.rates[data.rates.length - 1];
      const high = Math.max(...data.rates);
      const low = Math.min(...data.rates);
      return {
        date: new Date(monthKey).getTime(),
        prices: [open, high, low, close]
      }
    });

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
                <ChartContainer config={{}} className="min-h-[250px] w-full h-full">
                    <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(tick) => format(new Date(tick), 'MMM yy')}
                            scale="time"
                            type="number"
                            domain={['dataMin', 'dataMax']}
                        />
                         <YAxis 
                            orientation="right"
                            tickFormatter={(tick) => formatCurrency(tick)}
                            domain={['dataMin - (dataMax - dataMin) * 0.1', 'dataMax + (dataMax - dataMin) * 0.1']}
                            width={80}
                        />
                        <Tooltip
                            labelFormatter={(label) => format(new Date(label), 'MMMM yyyy')}
                            content={({ payload }) => {
                                if (!payload || payload.length === 0) return null;
                                const data = payload[0].payload.prices;
                                return (
                                    <div className="bg-background border shadow-sm rounded-lg p-2 text-sm">
                                        <p className="font-bold mb-1">{format(new Date(payload[0].payload.date), 'MMMM yyyy')}</p>
                                        <p>Open: {formatCurrency(data[0])}</p>
                                        <p>High: {formatCurrency(data[1])}</p>
                                        <p>Low: {formatCurrency(data[2])}</p>
                                        <p>Close: {formatCurrency(data[3])}</p>
                                    </div>
                                );
                            }}
                        />
                        
                        <Line
                            type="linear"
                            dataKey="prices"
                            stroke="none"
                            isAnimationActive={false}
                            shape={<CustomCandle />}
                         />
                         
                         <Brush 
                            dataKey="date" 
                            height={30} 
                            stroke="hsl(var(--primary))"
                            tickFormatter={(tick) => format(new Date(tick), 'MMM yy')}
                            travellerWidth={15}
                        />
                    </ComposedChart>
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
