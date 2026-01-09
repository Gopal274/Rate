'use client';

import * as React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Product } from '@/lib/types';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { ChartConfig } from '@/components/ui/chart';

interface DashboardProps {
  allProducts: Product[];
}

const CHART_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#6b7280'];

const Dashboard: React.FC<DashboardProps> = ({ allProducts }) => {
  const totalProducts = allProducts.length;
  const uniqueParties = new Set(allProducts.map(p => p.partyName)).size;

  const categoryData = React.useMemo(() => {
    const counts: { [key: string]: number } = {};
    for (const product of allProducts) {
      counts[product.category] = (counts[product.category] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allProducts]);
  
  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {};
    categoryData.forEach((item, index) => {
        config[item.name] = {
            label: item.name,
            color: CHART_COLORS[index % CHART_COLORS.length],
        }
    });
    return config;
  }, [categoryData]);


  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Products</CardTitle>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-muted-foreground"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalProducts}</div>
          <p className="text-xs text-muted-foreground">
            Total number of unique products
          </p>
        </CardContent>
      </Card>
       <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unique Parties</CardTitle>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-muted-foreground"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{uniqueParties}</div>
          <p className="text-xs text-muted-foreground">
            Number of distinct party names
          </p>
        </CardContent>
      </Card>
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Product Categories</CardTitle>
          <CardDescription>Distribution of products across categories.</CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
            <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                <PieChart>
                    <Tooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                    />
                    <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={60}
                        strokeWidth={5}
                    >
                         {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={chartConfig[entry.name]?.color} />
                        ))}
                    </Pie>
                </PieChart>
            </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
