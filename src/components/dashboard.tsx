
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
import { safeToDate } from '@/lib/utils';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from './ui/tooltip';

interface GroupedProductViewProps {
  allProducts: ProductWithRates[];
  openParty: string | null;
  onOpenChange: (partyName: string | null) => void;
}

interface GroupedProducts {
  [partyName: string]: ProductWithRates[];
}

const GroupedProductView: React.FC<GroupedProductViewProps> = ({ allProducts, openParty, onOpenChange }) => {
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
          <TooltipProvider>
            <Accordion 
              type="single" 
              collapsible
              className="w-full"
              value={openParty ?? undefined}
              onValueChange={onOpenChange}
            >
            {sortedPartyNames.map((partyName) => {
                const productsInGroup = groupedProducts[partyName];
                const productCount = productsInGroup.length;

                return (
                <AccordionItem value={partyName} key={partyName}>
                    <AccordionTrigger>
                      <Tooltip>
                          <TooltipTrigger asChild>
                              <div className="flex items-center gap-4 w-full overflow-hidden">
                                  <span className="font-semibold text-lg truncate">{partyName}</span>
                                  <Badge variant="secondary" className="flex-shrink-0">{productCount} product{productCount > 1 ? 's' : ''}</Badge>
                              </div>
                          </TooltipTrigger>
                          <TooltipContent>
                              <p>{partyName}</p>
                          </TooltipContent>
                      </Tooltip>
                    </AccordionTrigger>
                    <AccordionContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Product Name</TableHead>
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
                                <TableCell className="text-right">
                                    {latestRate ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(latestRate.rate) : '-'}
                                </TableCell>
                                <TableCell className="text-right">{latestRate ? `${latestRate.gst}%` : '-'}</TableCell>
                                <TableCell className="text-right font-bold">
                                    {finalRate ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(finalRate) : '-'}
                                </TableCell>
                                <TableCell className="text-center">
                                    {latestRate ? format(safeToDate(latestRate.billDate), 'dd MMM yyyy') : '-'}
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
          </TooltipProvider>
        </CardContent>
    </Card>
  );
};

export default GroupedProductView;
