
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProductWithRates } from '@/lib/types';

interface QuantityCalculatorProps {
  productsWithRates: ProductWithRates[];
}

export function QuantityCalculator({ productsWithRates }: QuantityCalculatorProps) {
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);
  const [quantity, setQuantity] = React.useState<number>(1);

  React.useEffect(() => {
    if (!selectedProductId && productsWithRates.length > 0) {
      const firstProductWithRate = productsWithRates.find(p => p.rates && p.rates.length > 0);
      if (firstProductWithRate) {
        setSelectedProductId(firstProductWithRate.id);
      }
    }
  }, [productsWithRates, selectedProductId]);

  const selectedProduct = React.useMemo(() => {
    return productsWithRates.find(p => p.id === selectedProductId);
  }, [selectedProductId, productsWithRates]);

  const finalRate = React.useMemo(() => {
    if (!selectedProduct || !selectedProduct.rates[0]) return 0;
    const latestRate = selectedProduct.rates[0];
    return latestRate.rate * (1 + latestRate.gst / 100);
  }, [selectedProduct]);

  const totalAmount = quantity * finalRate;

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuantity(value === '' ? 0 : Number(value));
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quantity Calculator</CardTitle>
        <CardDescription>Calculate total cost for a product quantity.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
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
          
          <div>
            <Label htmlFor="quantity-input">Quantity ({selectedProduct?.unit ?? 'units'})</Label>
            <Input
              id="quantity-input"
              type="number"
              value={quantity}
              onChange={handleQuantityChange}
              min="0"
              placeholder="Enter quantity"
            />
          </div>

          {selectedProduct && (
            <div className="pt-2">
              <p className="text-sm text-muted-foreground">Calculated Total Amount:</p>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalAmount)}
              </p>
               <p className="text-xs text-muted-foreground mt-1">
                Based on a final rate of {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(finalRate)} per {selectedProduct.unit}.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
