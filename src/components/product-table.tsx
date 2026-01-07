'use client';

import * as React from 'react';
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
  ExpandedState,
  getExpandedRowModel,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  CalendarIcon,
  Edit,
  PlusCircle,
  Trash2,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Printer,
} from 'lucide-react';
import { format } from 'date-fns';

import {
  addProductAction,
  deleteProductAction,
  updateProductAction,
  addRateAction,
  deleteRateAction,
  getProductRatesAction,
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
import { useUser } from '@/firebase';
import { Skeleton } from './ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';

type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc';

type ProductWithRates = Product & { rateHistory: Rate[] };

const RateHistory = ({ productId }: { productId: string }) => {
    const [rates, setRates] = React.useState<Rate[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchRates = async () => {
            setIsLoading(true);
            try {
                const fetchedRates = await getProductRatesAction(productId);
                setRates(fetchedRates);
            } catch (e) {
                toast({ variant: 'destructive', title: 'Error', description: "Could not fetch rate history." });
            } finally {
                setIsLoading(false);
            }
        };
        fetchRates();
    }, [productId, toast]);


    if (isLoading) {
        return (
            <div className='p-4 space-y-2'>
                <Skeleton className='h-4 w-1/2' />
                <Skeleton className='h-4 w-1/3' />
            </div>
        )
    }
    
    const previousRates = rates.slice(1);

    if (previousRates.length === 0) {
        return <div className="p-4 text-center text-sm text-muted-foreground">No previous rate history.</div>;
    }

    return (
        <div className="p-4 bg-muted/50">
            <h4 className="font-semibold mb-2 text-sm">Rate History</h4>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Rate</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {previousRates.map((rate) => (
                        <TableRow key={rate.id}>
                            <TableCell>{format(new Date(rate.createdAt), 'PPP')}</TableCell>
                            <TableCell>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rate.rate)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

const AddRateForm = ({ product, onRateAdded }: { product: ProductWithRates, onRateAdded: (newRate: Rate) => void }) => {
    const [newRate, setNewRate] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { toast } = useToast();

    const handleAddRate = async (e: React.FormEvent) => {
        e.preventDefault();
        const rateValue = parseFloat(newRate);
        if(isNaN(rateValue) || rateValue <= 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a valid positive rate.'});
            return;
        }

        setIsSubmitting(true);
        const result = await addRateAction(product.id, rateValue);
        if(result.success && result.rate) {
            onRateAdded(result.rate);
            setNewRate('');
            toast({ title: 'Success', description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
        setIsSubmitting(false);
    }

    return (
        <form onSubmit={handleAddRate} className="flex items-center gap-2 p-2">
            <Input 
                type="number"
                placeholder="New Rate"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                className="h-8"
            />
            <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Rate'}
            </Button>
        </form>
    )
}

export function ProductTable({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = React.useState<ProductWithRates[]>([]);
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'billDate', desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [expanded, setExpanded] = React.useState<ExpandedState>({});

  const [editingProduct, setEditingProduct] = React.useState<ProductWithRates | null>(null);
  const [deletingProduct, setDeletingProduct] = React.useState<ProductWithRates | null>(null);
  const [deletingRateInfo, setDeletingRateInfo] = React.useState<{product: ProductWithRates, rate: Rate} | null>(null);
  const [sortOption, setSortOption] = React.useState<SortOption>('newest');
  
  const { user } = useUser();
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchAllRates = async () => {
        const productsWithRates = await Promise.all(
            initialProducts.map(async (product) => {
                const fetchedRates = await getProductRatesAction(product.id);
                return { ...product, rateHistory: fetchedRates };
            })
        );
        setProducts(productsWithRates);
    }
    if(initialProducts.length > 0) {
        fetchAllRates();
    } else {
        setProducts([]);
    }
  }, [initialProducts]);
  

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
  
  const columns: ColumnDef<ProductWithRates>[] = [
    {
        id: 'expander',
        header: () => null,
        cell: ({ row }) => {
          return row.getCanExpand() ? (
            <button
              {...{
                onClick: row.getToggleExpandedHandler(),
                style: { cursor: 'pointer' },
              }}
            >
              {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : null
        },
    },
    {
        id: 'sNo',
        header: 'S.No',
        cell: ({ row, table }) => {
            const sortedRows = table.getSortedRowModel().rows;
            const rowIndex = sortedRows.findIndex(sortedRow => sortedRow.id === row.id);
            return rowIndex + 1;
        },
         enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: 'Product Name',
    },
    {
        id: 'rate',
        header: () => <div className="text-right">Rate</div>,
        cell: ({ row }) => {
            const latestRate = row.original.rateHistory[0]?.rate;
            return (
                <div className="text-right font-medium">
                    {latestRate != null ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(latestRate) : 'N/A'}
                </div>
            );
        },
    },
    { accessorKey: 'unit', header: 'Unit'},
    { accessorKey: 'gst', header: 'GST %', cell: ({row}) => `${row.original.gst}%` },
    {
        id: 'finalRate',
        header: () => <div className="text-right">Final Rate</div>,
        cell: ({ row }) => {
            const latestRate = row.original.rateHistory[0]?.rate ?? 0;
            const gst = row.original.gst;
            const finalRate = latestRate * (1 + gst / 100);
            return (
                <div className="text-right font-bold">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(finalRate)}
                </div>
            );
        },
    },
    { accessorKey: 'partyName', header: 'Party Name'},
    { accessorKey: 'pageNo', header: 'Page No'},
    {
      accessorKey: 'billDate',
      header: 'Bill Date',
      cell: ({ row }) => {
          const billDate = row.getValue('billDate');
          // Check if billDate is a valid date
          return billDate instanceof Date ? format(billDate, 'PPP') : 'Invalid Date';
      },
    },
    { accessorKey: 'category', header: 'Category'},
    {
      id: 'actions',
      cell: ({ row }) => {
        const product = row.original;
        const latestRate = product.rateHistory[0];

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
              <DropdownMenuItem onClick={() => setEditingProduct(product)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Product
              </DropdownMenuItem>
              {product.rateHistory.length > 0 && latestRate?.id && (
                <DropdownMenuItem 
                    className="text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                    onClick={() => setDeletingRateInfo({ product, rate: latestRate })}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Latest Rate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                onClick={() => setDeletingProduct(product)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Product
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
    state: {
      sorting,
      columnFilters,
      expanded,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  const onProductAdded = (newProduct: Product, initialRate: number) => {
    const newProductWithRate: ProductWithRates = {
        ...newProduct,
        rateHistory: [{ id: 'temp-id', rate: initialRate, createdAt: new Date() }] // Optimistic
    }
    // Manually trigger a re-sort by re-applying the sort state
    setProducts(prev => [newProductWithRate, ...prev]);
    handleSortChange(sortOption);
  };

  const onProductUpdated = (updatedProductData: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === editingProduct?.id ? { ...p, ...updatedProductData } : p));
  };
  
  const onProductDeleted = (deletedProductId: string) => {
    setProducts(prev => prev.filter(p => p.id !== deletedProductId));
  }

  const onRateAdded = (productId: string, newRate: Rate) => {
    const newRateWithDate = { ...newRate, createdAt: new Date(newRate.createdAt) };
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, rateHistory: [newRateWithDate, ...p.rateHistory]} : p));
  }

  const onRateDeleted = (productId: string, rateId: string) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, rateHistory: p.rateHistory.filter(r => r.id !== rateId)} : p));
  }

  const handlePrint = () => {
    window.print();
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
            <Button onClick={handlePrint} variant="outline" size="icon" className="no-print">
                <Printer className="h-4 w-4" />
                <span className="sr-only">Print</span>
            </Button>
            { user && <ProductFormDialog
              onProductAction={onProductAdded}
            >
              <Button className="no-print">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Product
              </Button>
            </ProductFormDialog> }
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
                      <TableHead key={header.id} className="no-print">
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
                  <React.Fragment key={row.id}>
                    <TableRow data-state={row.getIsSelected() && 'selected'}>
                        {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cell.column.id === 'actions' ? 'no-print' : ''}>
                            {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                            )}
                        </TableCell>
                        ))}
                    </TableRow>
                    {row.getIsExpanded() && (
                        <TableRow className="no-print">
                            <TableCell colSpan={columns.length}>
                                <AddRateForm product={row.original} onRateAdded={(newRate) => onRateAdded(row.original.id, newRate)} />
                                <RateHistory productId={row.original.id} />
                            </TableCell>
                        </TableRow>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No products found. Click "Add Product" to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 py-4 no-print">
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
      
      <DeleteRateDialog
        rateInfo={deletingRateInfo}
        isOpen={!!deletingRateInfo}
        setIsOpen={(isOpen) => !isOpen && setDeletingRateInfo(null)}
        onRateDeleted={onRateDeleted}
       />
    </Card>
  );
}

const getInitialFormValues = (product?: ProductWithRates) => {
    if (product) {
        return {
            name: product.name,
            unit: product.unit,
            gst: product.gst,
            partyName: product.partyName,
            pageNo: product.pageNo,
            billDate: new Date(product.billDate),
            category: product.category,
            rate: product.rateHistory[0]?.rate ?? 0,
        };
    }
    return {
        name: '',
        unit: 'piece' as const,
        gst: '' as any,
        partyName: '',
        pageNo: '' as any,
        billDate: new Date(),
        category: 'Other' as const,
        rate: '' as any,
    };
};

function ProductFormDialog({
  children,
  product,
  isOpen,
  setIsOpen,
  onProductAction,
}: {
  children?: React.ReactNode;
  product?: ProductWithRates;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
  onProductAction: (product: any, rate?: any) => void;
}) {
  const form = useForm<ProductSchema>({
    resolver: zodResolver(productSchema),
    defaultValues: getInitialFormValues(product),
  });
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(!!isOpen);

  React.useEffect(() => {
    setIsDialogOpen(!!isOpen);
  }, [isOpen]);
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
        form.reset(getInitialFormValues());
    }
    if (setIsOpen) {
      setIsOpen(open);
    } else {
      setIsDialogOpen(open);
    }
  };

  React.useEffect(() => {
    form.reset(getInitialFormValues(product));
  }, [product, form]);

  async function onSubmit(values: ProductSchema) {
    setIsSubmitting(true);

    if (product) {
      const { rate, ...productData } = values; // rate is not updatable here
      const result = await updateProductAction(product.id, productData);
      if (result.success) {
        onProductAction(productData);
        toast({ title: 'Success', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    } else {
      const result = await addProductAction(values);
       if (result.success && result.product) {
        onProductAction(result.product, values.rate);
        toast({ title: 'Success', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    }
    setIsSubmitting(false);
    handleOpenChange(false);
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
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
                <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input placeholder="e.g. Basmati Rice" {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rate"
              render={({ field }) => (
                <FormItem><FormLabel>{product ? 'Latest Rate (not editable)' : 'Initial Rate'}</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g. 120" {...field} disabled={!!product} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="partyName"
              render={({ field }) => (
                <FormItem><FormLabel>Party Name</FormLabel><FormControl><Input placeholder="e.g. Global Foods Inc." {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
               <FormField control={form.control} name="unit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a unit" /></SelectTrigger></FormControl>
                        <SelectContent>{units.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                        <SelectContent>{categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="gst" render={({ field }) => (
                    <FormItem><FormLabel>GST (%)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g. 5" {...field} /></FormControl><FormMessage /></FormItem>
                  )}
                />
                <FormField control={form.control} name="pageNo" render={({ field }) => (
                    <FormItem><FormLabel>Page No.</FormLabel><FormControl><Input type="number" placeholder="e.g. 42" {...field} /></FormControl><FormMessage /></FormItem>
                  )}
                />
            </div>
            <FormField
              control={form.control}
              name="billDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bill Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
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
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : (product ? 'Save Changes' : 'Add Product')}</Button>
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
  product: ProductWithRates | null;
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
      toast({ variant: 'destructive', title: 'Error', description: result.message });
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
            This action cannot be undone. This will permanently delete the product <span className="font-semibold text-foreground">{product?.name}</span> and all its rate history.
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

function DeleteRateDialog({
  rateInfo,
  isOpen,
  setIsOpen,
  onRateDeleted
}: {
  rateInfo: {product: ProductWithRates, rate: Rate} | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onRateDeleted: (productId: string, rateId: string) => void;
}) {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = React.useState(false);

    const handleDelete = async () => {
        if (!rateInfo || !rateInfo.rate.id) return;
        setIsDeleting(true);
        const result = await deleteRateAction(rateInfo.product.id, rateInfo.rate.id);
        if (result.success) {
            onRateDeleted(rateInfo.product.id, rateInfo.rate.id);
            toast({ title: 'Success', description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
        setIsDeleting(false);
        setIsOpen(false);
    };

    if (!rateInfo) return null;

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Delete Latest Rate?</AlertDialogTitle>
            <AlertDialogDescription>
                Are you sure you want to delete the latest rate of <span className="font-semibold text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rateInfo.rate.rate)}</span> for <span className="font-semibold text-foreground">{rateInfo.product.name}</span>? This action cannot be undone.
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
