'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  CalendarIcon,
  Edit,
  PlusCircle,
  Trash2,
  Printer,
  Sparkles,
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
import type { Product, ProductSchema, Rate, UpdateProductSchema } from '@/lib/types';
import { categories, productSchema, units, updateProductSchema } from '@/lib/types';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { z } from 'zod';
import RateSummary from './rate-summary';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';

// Combined type for flattened data structure
type TableRowData = {
  isProductRow: boolean; // True for the main product row
  product: Product;
  rate: Rate;
  sNo: number; // Keep track of the product serial number
};

export function ProductTable({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = React.useState<Product[]>(initialProducts);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = React.useState<Product | null>(null);
  const [addingRateToProduct, setAddingRateToProduct] = React.useState<Product | null>(null);
  const [deletingRateInfo, setDeletingRateInfo] = React.useState<{ product: Product; rate: Rate } | null>(null);
  const [rateHistories, setRateHistories] = React.useState<Record<string, Rate[]>>({});

  const { user } = useUser();
  const { toast } = useToast();

  React.useEffect(() => {
    setProducts(initialProducts);

    const fetchAllRates = async () => {
      const allHistories: Record<string, Rate[]> = {};
      for (const product of initialProducts) {
        try {
          const fetchedRates = await getProductRatesAction(product.id);
          allHistories[product.id] = fetchedRates;
        } catch (error) {
          console.error(`Failed to fetch rates for product ${product.id}:`, error);
          toast({ variant: 'destructive', title: 'Fetch Error', description: `Could not load rates for ${product.name}.` });
          allHistories[product.id] = [];
        }
      }
      setRateHistories(allHistories);
    };

    if (initialProducts.length > 0) {
      fetchAllRates();
    } else {
      setRateHistories({});
    }
  }, [initialProducts, toast]);

  const flattenedData = React.useMemo(() => {
    let sNoCounter = 0;
    return products.flatMap((product) => {
      const history = rateHistories[product.id] ?? [];
      sNoCounter++;
      if (history.length === 0) {
        // Create a dummy rate if none exist, so the product still shows up
        const dummyRate: Rate = { id: 'dummy', rate: 0, createdAt: product.billDate };
        return [{ isProductRow: true, product, rate: dummyRate, sNo: sNoCounter }];
      }
      return history.map((rate, index) => ({
        isProductRow: index === 0, // First rate is the main product row
        product,
        rate,
        sNo: sNoCounter,
      }));
    });
  }, [products, rateHistories]);

  const columns: ColumnDef<TableRowData>[] = [
    {
      id: 'sNo',
      header: 'S.No',
      cell: ({ row }) => (row.original.isProductRow ? row.original.sNo : ''),
    },
    {
      accessorKey: 'name',
      header: 'Product Name',
      cell: ({ row }) => {
        if (!row.original.isProductRow) return null;
        return (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-b-0">
                <AccordionTrigger className="p-0 hover:no-underline">{row.original.product.name}</AccordionTrigger>
                <AccordionContent>
                    <RateSummary product={row.original.product} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
        );
      },
    },
    {
      id: 'rate',
      header: () => <div className="text-right">Rate</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium">
          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(row.original.rate.rate)}
        </div>
      ),
    },
    {
      accessorKey: 'unit',
      header: 'Unit',
      cell: ({ row }) => (row.original.isProductRow ? row.original.product.unit : ''),
    },
    {
      accessorKey: 'gst',
      header: 'GST %',
      cell: ({ row }) => (row.original.isProductRow ? `${row.original.product.gst}%` : ''),
    },
    {
      id: 'finalRate',
      header: () => <div className="text-right">Final Rate</div>,
      cell: ({ row }) => {
        const finalRate = row.original.rate.rate * (1 + row.original.product.gst / 100);
        return (
          <div className="text-right font-bold">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(finalRate)}
          </div>
        );
      },
    },
    {
      accessorKey: 'partyName',
      header: 'Party Name',
      cell: ({ row }) => (row.original.isProductRow ? row.original.product.partyName : ''),
    },
    {
      accessorKey: 'pageNo',
      header: 'Page No',
       cell: ({ row }) => (row.original.isProductRow ? row.original.product.pageNo : ''),
    },
    {
      accessorKey: 'billDate',
      header: 'Bill Date',
      cell: ({ row }) => format(new Date(row.original.rate.createdAt), 'PPP'),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (row.original.isProductRow ? row.original.product.category : ''),
    },
    {
      id: 'actions',
      header: () => <div className="text-center no-print">Actions</div>,
      cell: ({ row }) => {
        const { product, rate, isProductRow } = row.original;
        return (
          <TooltipProvider>
            <div className="flex items-center justify-center gap-1 no-print">
              {isProductRow && (
                 <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAddingRateToProduct(product)}>
                        <PlusCircle className="h-4 w-4 text-green-600" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add New Rate</TooltipContent>
                  </Tooltip>
              )}
               {isProductRow && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingProduct(product)}>
                        <Edit className="h-4 w-4 text-blue-600" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit Product Details</TooltipContent>
                  </Tooltip>
               )}
              {isProductRow ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingProduct(product)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Product & All History</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                   <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeletingRateInfo({ product, rate })}>
                      <Trash2 className="h-4 w-4 text-destructive hover:text-destructive" />
                    </Button>
                   </TooltipTrigger>
                   <TooltipContent>Delete This Rate Entry</TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        );
      },
    },
  ];

  const table = useReactTable({
    data: flattenedData,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const onProductAdded = (newProduct: Product, initialRate: Rate) => {
    setProducts(prev => [newProduct, ...prev]);
    setRateHistories(prev => ({...prev, [newProduct.id]: [initialRate]}));
  };

  const onProductUpdated = (updatedProductData: Partial<Product>) => {
    const productId = editingProduct?.id;
    if(!productId) return;

    setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, ...updatedProductData, billDate: new Date(updatedProductData.billDate ?? p.billDate) } : p
    ));
  };
  
  const onRateAdded = (productId: string, newRate: Rate, newBillDate: Date, newPageNo: number, newGst: number) => {
     setRateHistories(prev => ({
      ...prev,
      [productId]: [newRate, ...(prev[productId] ?? [])]
     }));
     setProducts(prev => prev.map(p => {
        if(p.id === productId) {
            return { ...p, billDate: newBillDate, pageNo: newPageNo, gst: newGst };
        }
        return p;
     }));
  }

  const onProductDeleted = (deletedProductId: string) => {
    setProducts(prev => prev.filter(p => p.id !== deletedProductId));
     setRateHistories(prev => {
        const newHistories = {...prev};
        delete newHistories[deletedProductId];
        return newHistories;
    });
  }

  const onRateDeleted = (productId: string, rateId: string) => {
    setRateHistories(prev => ({
        ...prev,
        [productId]: prev[productId]?.filter(r => r.id !== rateId) ?? []
    }));
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
          <div className="flex items-center gap-2 w-full sm:w-auto no-print">
            <Input
              placeholder="Filter products..."
              value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
              onChange={(event) =>
                table.getColumn('name')?.setFilterValue(event.target.value)
              }
              className="max-w-sm"
            />
            <Button onClick={handlePrint} variant="outline" size="icon">
                <Printer className="h-4 w-4" />
                <span className="sr-only">Print</span>
            </Button>
            { user && <ProductFormDialog
              onProductAction={onProductAdded}
            >
              <Button>
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
                      <TableHead key={header.id} className={header.id === 'actions' ? 'no-print' : ''}>
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
                    <TableRow data-state={row.getIsSelected() && 'selected'} className={!row.original.isProductRow ? 'bg-muted/50' : ''}>
                        {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className={cn(cell.column.id === 'actions' ? 'no-print' : '', !row.original.isProductRow && 'py-2', !row.original.isProductRow && ['sNo', 'name', 'unit', 'partyName', 'pageNo', 'category', 'gst'].includes(cell.column.id) ? 'border-r' : '')}>
                            {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                            )}
                        </TableCell>
                        ))}
                    </TableRow>
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

      {addingRateToProduct && (
        <AddRateDialog
            product={addingRateToProduct}
            isOpen={!!addingRateToProduct}
            setIsOpen={(isOpen) => !isOpen && setAddingRateToProduct(null)}
            onRateAdded={onRateAdded}
        />
      )}
       <DeleteRateDialog
        rateInfo={deletingRateInfo}
        isOpen={!!deletingRateInfo}
        setIsOpen={(isOpen) => !isOpen && setDeletingRateInfo(null)}
        onRateDeleted={onRateDeleted}
      />
      <DeleteProductDialog
        product={deletingProduct}
        isOpen={!!deletingProduct}
        setIsOpen={(isOpen) => !isOpen && setDeletingProduct(null)}
        onProductDeleted={onProductDeleted}
      />
    </Card>
  );
}

const getInitialAddFormValues = () => {
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

const getInitialEditFormValues = (product: Product) => {
    return {
        name: product.name,
        unit: product.unit,
        partyName: product.partyName,
        category: product.category,
        pageNo: product.pageNo,
        billDate: new Date(product.billDate),
        gst: product.gst,
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
  product?: Product;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
  onProductAction: (product: any, rate?: any) => void;
}) {
  const isEditing = !!product;
  const formSchema = isEditing ? updateProductSchema : productSchema;
  
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: isEditing ? getInitialEditFormValues(product) : getInitialAddFormValues(),
  });
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(!!isOpen);

  React.useEffect(() => {
    setIsDialogOpen(!!isOpen);
  }, [isOpen]);
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
        form.reset(isEditing ? getInitialEditFormValues(product) : getInitialAddFormValues());
    }
    if (setIsOpen) {
      setIsOpen(open);
    } else {
      setIsDialogOpen(open);
    }
  };

  React.useEffect(() => {
    form.reset(isEditing ? getInitialEditFormValues(product) : getInitialAddFormValues());
  }, [product, form, isEditing]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);

    if (isEditing) {
      const result = await updateProductAction(product.id, values as UpdateProductSchema);
      if (result.success) {
        onProductAction(values);
        toast({ title: 'Success', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    } else {
      const result = await addProductAction(values as ProductSchema);
       if (result.success && result.product && result.rate) {
        onProductAction(result.product, result.rate);
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
              ? "Update this product's details. To add a new rate, use the '+' icon in the table."
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
            {isEditing ? null : (
                <FormField
                    control={form.control}
                    name="rate"
                    render={({ field }) => (
                        <FormItem><FormLabel>Initial Rate</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g. 120.50" {...field} value={field.value ?? ''} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )}
                />
            )}
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
                    <FormItem><FormLabel>GST (%)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g. 5" {...field} value={field.value ?? ''} onChange={e => field.onChange(Number(e.target.value))}/></FormControl><FormMessage /></FormItem>
                  )}
                />
                <FormField control={form.control} name="pageNo" render={({ field }) => (
                    <FormItem><FormLabel>Page No.</FormLabel><FormControl><Input type="number" placeholder="e.g. 42" {...field} value={field.value ?? ''} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
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


const addRateSchema = z.object({
  rate: z.coerce.number().min(0.01, { message: "Rate must be a positive number." }),
  billDate: z.date({ required_error: "A bill date is required." }),
  pageNo: z.coerce.number().int().min(1, { message: "Page number must be at least 1." }),
  gst: z.coerce.number().min(0, { message: "GST must be a positive number." }),
});

type AddRateSchema = z.infer<typeof addRateSchema>;


function AddRateDialog({
  product,
  isOpen,
  setIsOpen,
  onRateAdded,
}: {
  product: Product | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onRateAdded: (productId: string, newRate: Rate, billDate: Date, pageNo: number, gst: number) => void;
}) {
  const form = useForm<AddRateSchema>({
    resolver: zodResolver(addRateSchema),
    defaultValues: {
      rate: '' as any,
      billDate: new Date(),
      pageNo: product?.pageNo,
      gst: product?.gst,
    },
  });
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if(product) {
        form.reset({
            rate: '' as any,
            billDate: new Date(),
            pageNo: product.pageNo,
            gst: product.gst,
        })
    }
  }, [product, form]);

  async function onSubmit(values: AddRateSchema) {
    if (!product) return;
    setIsSubmitting(true);
    const result = await addRateAction(product.id, values.rate, values.billDate, values.pageNo, values.gst);
    if (result.success && result.rate) {
      onRateAdded(product.id, result.rate, values.billDate, values.pageNo, values.gst);
      toast({ title: 'Success', description: 'New rate added.' });
      setIsOpen(false);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.message || 'Failed to add rate.' });
    }
    setIsSubmitting(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Rate for {product?.name}</DialogTitle>
          <DialogDescription>
            Enter the new rate and other details for this product.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Rate</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="e.g. 125.00" {...field} value={field.value ?? ''} onChange={e => field.onChange(Number(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="gst"
                render={({ field }) => (
                    <FormItem><FormLabel>New GST (%)</FormLabel><FormControl><Input type="number" placeholder={`e.g. ${product?.gst ?? 5}`} {...field} value={field.value ?? ''} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="pageNo"
                render={({ field }) => (
                    <FormItem><FormLabel>New Page No.</FormLabel><FormControl><Input type="number" placeholder={`e.g. ${product?.pageNo ?? 42}`} {...field} value={field.value ?? ''} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                )}
            />
            <FormField
              control={form.control}
              name="billDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>New Bill Date</FormLabel>
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
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Add Rate'}</Button>
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
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className='bg-destructive hover:bg-destructive/90'>
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
  rateInfo: {product: Product, rate: Rate} | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onRateDeleted: (productId: string, rateId: string) => void;
}) {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = React.useState(false);

    const handleDelete = async () => {
        if (!rateInfo?.product.id || !rateInfo.rate.id) return;
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
            <AlertDialogTitle>Delete This Rate?</AlertDialogTitle>
            <AlertDialogDescription>
                Are you sure you want to delete the rate of <span className="font-semibold text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rateInfo.rate.rate)}</span> from <span className="font-semibold text-foreground">{format(new Date(rateInfo.rate.createdAt), 'PPP')}</span>? This action cannot be undone.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className='bg-destructive hover:bg-destructive/90'>
                {isDeleting ? 'Deleting...' : 'Continue'}
            </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
    );
}
