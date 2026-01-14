'use client';

import * as React from 'react';
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
import { Button } from '@/components/ui/button';
import { Wand2 } from 'lucide-react';
import type { ProductWithRates } from '@/lib/types';
import { estimatePrice, type EstimatePriceOutput } from '@/ai/flows/estimate-price-flow';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';

interface PriceEstimatorProps {
  productsWithRates: ProductWithRates[];
}

export function PriceEstimator({ productsWithRates }: PriceEstimatorProps) {
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [isEstimating, setIsEstimating] = React.useState(false);
  const [estimationResult, setEstimationResult] = React.useState<EstimatePriceOutput | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    // Select a product with a trend by default to make it easy to start
    if (!selectedProductId && productsWithRates.length > 0) {
      const firstProductWithTrend = productsWithRates.find(p => p.rates && p.rates.length > 1);
      if (firstProductWithTrend) {
        setSelectedProductId(firstProductWithTrend.id);
      }
    }
  }, [productsWithRates, selectedProductId]);

  const selectedProduct = React.useMemo(() => {
    return productsWithRates.find(p => p.id === selectedProductId);
  }, [selectedProductId, productsWithRates]);
  
  const handleEstimate = async () => {
    if (!selectedProduct) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a product first.' });
      return;
    }
    
    // The flow needs rates sorted from most recent to oldest, which our hook already provides.
    const historicalRatesForFlow = selectedProduct.rates.map(r => ({
        rate: r.rate,
        gst: r.gst,
        billDate: r.billDate instanceof Date ? r.billDate.toISOString() : r.billDate
    }));

    setIsEstimating(true);
    setEstimationResult(null);

    try {
      const result = await estimatePrice({
        productName: selectedProduct.name,
        historicalRates: historicalRatesForFlow,
      });
      setEstimationResult(result);
    } catch (error) {
      console.error("Estimation Error:", error);
      toast({ variant: 'destructive', title: 'Estimation Failed', description: 'Could not generate a price estimate.' });
    } finally {
      setIsEstimating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Price Estimator</CardTitle>
        <CardDescription>Predict the next price for a product using AI.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Select onValueChange={setSelectedProductId} value={selectedProductId ?? undefined}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a product to estimate" />
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
          
          <Button onClick={handleEstimate} disabled={isEstimating || !selectedProductId} className="w-full">
            <Wand2 className="mr-2 h-4 w-4" />
            {isEstimating ? 'Estimating...' : 'Estimate Next Price'}
          </Button>

          {isEstimating && (
            <div className="space-y-2 pt-2">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {estimationResult && (
            <div className="pt-2">
              <p className="text-sm text-muted-foreground">Estimated Next Price:</p>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(estimationResult.estimatedPrice)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">{estimationResult.reasoning}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
