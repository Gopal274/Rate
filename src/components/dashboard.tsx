'use client';

import * as React from 'react';
import type { Product, ProductWithRates } from '@/lib/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';

interface GroupedProductViewProps {
  allProducts: ProductWithRates[];
}

interface GroupedProducts {
  [partyName: string]: ProductWithRates[];
}

const GroupedProductView: React.FC<GroupedProductViewProps> = ({ allProducts }) => {
  const groupedProducts = React.useMemo(() => {
    return allProducts.reduce((acc, product) => {
      const { partyName } = product;
      if (!acc[partyName]) {
        acc[partyName] = [];
      }
      acc[partyName].push(product);
      return acc;
    }, {} as GroupedProducts);
  }, [allProducts]);

  const sortedPartyNames = React.useMemo(() => {
    return Object.keys(groupedProducts).sort((a, b) => a.localeCompare(b));
  }, [groupedProducts]);

  if (allProducts.length === 0) {
      return (
          <div className="flex items-center justify-center h-48">
              <p className="text-muted-foreground">No products to display.</p>
          </div>
      )
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Products by Party</CardTitle>
            <CardDescription>A view of all your products, grouped by party name.</CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="multiple" className="w-full">
            {sortedPartyNames.map((partyName) => {
                const productsInGroup = groupedProducts[partyName];
                const productCount = productsInGroup.length;

                return (
                <AccordionItem value={partyName} key={partyName}>
                    <AccordionTrigger>
                        <div className="flex items-center gap-4">
                            <span className="font-semibold text-lg">{partyName}</span>
                            <Badge variant="secondary">{productCount} product{productCount > 1 ? 's' : ''}</Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Product Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Latest Rate</TableHead>
                            <TableHead className="text-right">GST %</TableHead>
                            <TableHead className="text-right">Final Rate</TableHead>
                            <TableHead className="text-center">Last Bill Date</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {productsInGroup.map((product) => {
                            const latestRate = product.rates[0];
                            const finalRate = latestRate ? latestRate.rate * (1 + latestRate.gst / 100) : 0;
                            return (
                            <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>{product.category}</TableCell>
                                <TableCell className="text-right">
                                    {latestRate ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(latestRate.rate) : '-'}
                                </TableCell>
                                <TableCell className="text-right">{latestRate ? `${latestRate.gst}%` : '-'}</TableCell>
                                <TableCell className="text-right font-bold">
                                    {finalRate ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(finalRate) : '-'}
                                </TableCell>
                                <TableCell className="text-center">
                                    {latestRate ? format(new Date(latestRate.billDate), 'dd MMM yyyy') : '-'}
                                </TableCell>
                            </TableRow>
                            );
                        })}
                        </TableBody>
                    </Table>
                    </AccordionContent>
                </AccordionItem>
                );
            })}
            </Accordion>
        </CardContent>
    </Card>
  );
};

export default GroupedProductView;
