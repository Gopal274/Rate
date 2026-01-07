'use client';

import { getRateSummaryAction } from '@/lib/actions';
import React, { useEffect, useState, useTransition } from 'react';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { Lightbulb, AlertTriangle, TrendingUp, Sparkles } from 'lucide-react';
import { SummarizeRateTrendsOutput } from '@/ai/flows/summarize-rate-trends';
import type { Product, Rate } from '@/lib/types';
import { getProductRates } from '@/lib/data';

type RateSummaryProps = {
  product: Product;
};

export default function RateSummary({ product }: RateSummaryProps) {
  const [summary, setSummary] = useState<SummarizeRateTrendsOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [rates, setRates] = React.useState<Rate[]>([]);
  const [isLoadingRates, setIsLoadingRates] = React.useState(true);

  React.useEffect(() => {
    const fetchRates = async () => {
        setIsLoadingRates(true);
        const fetchedRates = await getProductRates(product.id);
        setRates(fetchedRates);
        setIsLoadingRates(false);
    };
    fetchRates();
  }, [product.id]);

  const handleGenerateSummary = () => {
    startTransition(async () => {
      setError(null);
      const result = await getRateSummaryAction(product, rates);
      if ('error' in result) {
        setError(result.error);
      } else {
        setSummary(result);
      }
    });
  };

  if (isLoadingRates) {
    return <Skeleton className="h-10 w-full" />
  }

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }
  
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (summary) {
    return (
      <div className="space-y-4 text-sm">
        <div>
          <h4 className="font-semibold flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4" />Trend Summary</h4>
          <p className="text-muted-foreground">{summary.summary}</p>
        </div>

        {summary.outliers && summary.outliers.length > 0 && (
          <div>
            <h4 className="font-semibold flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Identified Outliers</h4>
            <ul className="space-y-2">
                {summary.outliers.map((outlier, index) => (
                    <li key={index} className="p-2 bg-muted/50 rounded-md border border-dashed">
                        <p className="text-muted-foreground"><span className="font-semibold text-foreground">{new Date(outlier.date).toLocaleDateString()} at ₹{outlier.rate}</span>: {outlier.reason}</p>
                    </li>
                ))}
            </ul>
          </div>
        )}

        <div>
          <h4 className="font-semibold flex items-center gap-2 mb-2"><Lightbulb className="h-4 w-4 text-blue-500" />Prediction</h4>
          <p className="text-muted-foreground">{summary.prediction}</p>
        </div>
        
        <Button variant="ghost" size="sm" onClick={() => setSummary(null)}>
            Generate New Summary
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">Click to get an AI-powered analysis of the rate trends.</p>
        <Button onClick={handleGenerateSummary} disabled={isPending}>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Summary
        </Button>
    </div>
  );
}
