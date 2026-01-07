
'use client';

import * as React from 'react';
import {
  CaretSortIcon,
  DotsHorizontalIcon,
} from '@radix-ui/react-icons';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  CalendarIcon,
  Edit,
  FileText,
  PlusCircle,
  Trash2,
  MoreHorizontal,
  Bot,
  BarChart,
  History,
} from 'lucide-react';
import { format } from 'date-fns';

import {
  addProductAction,
  deleteProductAction,
  updateProductAction,
  addRateAction,
} from '@/lib/actions';
import type { Product, ProductSchema, Rate } from '@/lib/types';
import { categories, productSchema, units } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import RateSummary from './rate-summary';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc';

export function ProductTable({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = React.useState<Product[]>(initialProducts);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [isAddDialogOpen, setAddDialogOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = React.useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = React.useState<Product | null>(null);
  const [sortOption, setSortOption] = React.useState<SortOption>('newest');

  const { toast } = useToast();

  const handleSortChange = (value: string) => {
    const option = value as SortOption;
    setSortOption(option);
    let newSorting: SortingState = [];
    if (option === 'newest') newSorting = [{ id: 'billDate', desc: true }];
    else if (option === 'oldest') newSorting = [{ id: 'billDate', desc: false }];
    else if (option === 'name-asc') newSorting = [{ id: 'name', desc: false }];
    else if (option === 'name-desc') newSorting = [{ id: 'name', desc: true }];
    setSorting(newSorting);
  };
  
  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Product Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="font-medium text-foreground">{row.getValue('name')}</div>,
    },
    {
      accessorKey: 'category',
      header: 'Category',
    },
    {
      accessorKey: 'partyName',
      header: 'Party Name',
    },
    {
      accessorKey: 'billDate',
      header: ({ column }) => (
         <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Bill Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => format(row.getValue('billDate'), 'PPP'),
    },
    {
      accessorKey: 'rateHistory',
      header: () => <div className="text-right">Last Rate</div>,
      cell: ({ row }) => {
        const rateHistory = row.getValue('rateHistory') as Rate[];
        const lastRate = rateHistory[rateHistory.length - 1]?.rate;
        return (
          <div className="text-right font-medium">
            {lastRate ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(lastRate) : 'N/A'}
          </div>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const product = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setHistoryProduct(product)}>
                <History className="mr-2 h-4 w-4" />
                View History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditingProduct(product)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Product
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                onClick={() => setDeletingProduct(product)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: products,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    initialState: {
        sorting: [{ id: 'billDate', desc: true }]
    }
  });

  const onProductAdded = (newProduct: Product) => {
    setProducts(prev => [newProduct, ...prev]);
  };

  const onProductUpdated = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    if (historyProduct?.id === updatedProduct.id) {
      setHistoryProduct(updatedProduct);
    }
  };

  const onProductDeleted = (deletedProductId: string) => {
    setProducts(prev => prev.filter(p => p.id !== deletedProductId));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Products</CardTitle>
            <CardDescription>Manage your products and their rates.</CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              placeholder="Filter products..."
              value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
              onChange={(event) =>
                table.getColumn('name')?.setFilterValue(event.target.value)
              }
              className="max-w-sm"
            />
            <Select onValueChange={handleSortChange} defaultValue={sortOption}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              </SelectContent>
            </Select>
            <ProductFormDialog
              isOpen={isAddDialogOpen}
              setIsOpen={setAddDialogOpen}
              onProductAction={onProductAdded}
            >
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </ProductFormDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No products found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </CardContent>

      {editingProduct && (
        <ProductFormDialog
          product={editingProduct}
          isOpen={!!editingProduct}
          setIsOpen={(isOpen) => !isOpen && setEditingProduct(null)}
          onProductAction={onProductUpdated}
        />
      )}

      <DeleteProductDialog
        product={deletingProduct}
        isOpen={!!deletingProduct}
        setIsOpen={(isOpen) => !isOpen && setDeletingProduct(null)}
        onProductDeleted={onProductDeleted}
      />

      <RateHistorySheet
        product={historyProduct}
        isOpen={!!historyProduct}
        setIsOpen={(isOpen) => !isOpen && setHistoryProduct(null)}
        onProductUpdated={onProductUpdated}
      />
    </Card>
  );
}

function ProductFormDialog({
  children,
  product,
  isOpen,
  setIsOpen,
  onProductAction,
}: {
  children?: React.ReactNode;
  product?: Product;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onProductAction: (product: Product) => void;
}) {
  const form = useForm<ProductSchema>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      unit: product?.unit ?? 'piece',
      gst: product?.gst ?? 0,
      partyName: product?.partyName ?? '',
      pageNumber: product?.pageNumber ?? 1,
      billDate: product?.billDate ?? new Date(),
      category: product?.category ?? 'Other',
      initialRate: product?.rateHistory[0]?.rate ?? 0,
    },
  });
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        unit: product.unit,
        gst: product.gst,
        partyName: product.partyName,
        pageNumber: product.pageNumber,
        billDate: product.billDate,
        category: product.category,
        initialRate: product.rateHistory[0]?.rate ?? 0,
      });
    } else {
        form.reset({
            name: '',
            unit: 'piece',
            gst: 0,
            partyName: '',
            pageNumber: 1,
            billDate: new Date(),
            category: 'Other',
            initialRate: 0,
        });
    }
  }, [product, form]);

  async function onSubmit(values: ProductSchema) {
    setIsSubmitting(true);
    if (product) {
      const { initialRate, ...updateValues } = values;
      const result = await updateProductAction(product.id, updateValues);
      if (result.success) {
        onProductAction({ ...product, ...updateValues });
        toast({ title: 'Success', description: result.message });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.message,
        });
      }
    } else {
      const result = await addProductAction(values);
       if (result.success) {
        // This is a bit of a hack since actions can't return db values easily
        // In a real app, we'd probably get the new product from the DB
        const newProduct: Product = {
            id: Math.random().toString(), // temp id
            ...values,
            rateHistory: [{date: values.billDate, rate: values.initialRate}]
        };
        // We'll rely on revalidation to get the real data
        toast({ title: 'Success', description: result.message });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.message,
        });
      }
    }
    setIsSubmitting(false);
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
          <DialogDescription>
            {product
              ? 'Update the details of your product.'
              : 'Add a new product to your records.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Basmati Rice" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!product && <FormField
              control={form.control}
              name="initialRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial Rate</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g. 120" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />}
            <FormField
              control={form.control}
              name="partyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Party Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Global Foods Inc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
               <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {units.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                           {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gst"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GST (%)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pageNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Page No.</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <FormField
              control={form.control}
              name="billDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Bill Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date('1900-01-01')
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : (product ? 'Save Changes' : 'Add Product')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProductDialog({
  product,
  isOpen,
  setIsOpen,
  onProductDeleted
}: {
  product: Product | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onProductDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!product) return;
    setIsDeleting(true);
    const result = await deleteProductAction(product.id);
    if (result.success) {
      onProductDeleted(product.id);
      toast({ title: 'Success', description: result.message });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.message,
      });
    }
    setIsDeleting(false);
    setIsOpen(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            product <span className="font-semibold text-foreground">{product?.name}</span> and all its rate history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Continue'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RateHistorySheet({
  product,
  isOpen,
  setIsOpen,
  onProductUpdated,
}: {
  product: Product | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onProductUpdated: (product: Product) => void;
}) {
  if (!product) return null;

  const [newRate, setNewRate] = React.useState('');
  const [newDate, setNewDate] = React.useState<Date | undefined>(new Date());
  const { toast } = useToast();

  const handleAddRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRate || !newDate) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a rate and select a date.',
      });
      return;
    }
    const rateValue = parseFloat(newRate);
    if (isNaN(rateValue) || rateValue <= 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a valid positive rate.',
      });
      return;
    }

    const result = await addRateAction(product.id, { date: newDate, rate: rateValue });
    if(result.success) {
      const updatedProduct = {
        ...product,
        rateHistory: [...product.rateHistory, { date: newDate, rate: rateValue }]
      };
      onProductUpdated(updatedProduct);
      toast({ title: "Success", description: result.message });
      setNewRate('');
      setNewDate(new Date());
    } else {
      toast({ variant: 'destructive', title: "Error", description: result.message });
    }
  };

  const sortedRates = [...product.rateHistory].sort((a, b) => b.date.getTime() - a.date.getTime());

  const chartData = product.rateHistory.map(r => ({
    date: format(r.date, 'MMM dd'),
    rate: r.rate
  }));

  const chartConfig = {
    rate: {
      label: 'Rate',
      color: 'hsl(var(--primary))',
    },
  } satisfies ChartConfig;


  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{product.name}</SheetTitle>
          <SheetDescription>
            View and manage rate history. Last updated on {format(product.billDate, 'PPP')}.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 py-6">
          <Card>
            <CardHeader>
              <CardTitle>Add New Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddRate} className="flex flex-col sm:flex-row items-end gap-2">
                <div className="grid gap-1.5 flex-1 w-full">
                  <Label htmlFor="new-rate">Rate (INR)</Label>
                  <Input id="new-rate" type="number" placeholder="e.g. 150.50" value={newRate} onChange={e => setNewRate(e.target.value)} />
                </div>
                <div className="grid gap-1.5 flex-1 w-full">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !newDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newDate ? format(newDate, 'PPP') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newDate}
                        onSelect={setNewDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button type="submit">Add Rate</Button>
              </form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart className="h-5 w-5 text-primary" />Rate Trend</CardTitle>
            </CardHeader>
            <CardContent>
               <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <LineChart data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis width={80} tickFormatter={(value) => `₹${value}`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line dataKey="rate" type="monotone" stroke="var(--color-rate)" strokeWidth={2} dot={true} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
               <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />AI-Powered Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <RateSummary productId={product.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Rate History</CardTitle>
            </CardHeader>
            <CardContent>
               <div className="max-h-60 overflow-y-auto">
                 <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRates.map((r, index) => (
                      <TableRow key={index}>
                        <TableCell>{format(r.date, 'PPP')}</TableCell>
                        <TableCell className="text-right font-medium">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(r.rate)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
               </div>
            </CardContent>
          </Card>

        </div>
      </SheetContent>
    </Sheet>
  );
}
