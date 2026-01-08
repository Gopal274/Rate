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
  FilterFn,
} from '@tanstack/react-table';
import {
  Edit,
  PlusCircle,
  Trash2,
  Printer,
  ChevronDown,
  XCircle,
  Filter,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { z } from 'zod';
import { ScrollArea } from './ui/scroll-area';

type ProductWithRates = Product & { rates: Rate[] };
type SortDirection = 'newest' | 'oldest' | 'asc' | 'desc' | 'party-asc' | 'party-desc';


const multiSelectFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
    if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) {
        return true;
    }
    const value = row.getValue(columnId);
    return Array.isArray(filterValue) && filterValue.includes(value);
};


export function ProductTable({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = React.useState<Product[]>(initialProducts);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [openCollapsibles, setOpenCollapsibles] = React.useState<Set<string>>(new Set());
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [activeSort, setActiveSort] = React.useState<SortDirection>('newest');


  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = React.useState<Product | null>(null);
  const [addingRateToProduct, setAddingRateToProduct] = React.useState<Product | null>(null);
  const [deletingRateInfo, setDeletingRateInfo] = React.useState<{ product: Product; rate: Rate } | null>(null);
  const [rateHistories, setRateHistories] = React.useState<Record<string, Rate[]>>({});

  const { user } = useUser();
  const { toast } = useToast();
  
  const handlePrint = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

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
  
  const uniquePartyNames = React.useMemo(() => {
    const partyNames = new Set(products.map(p => p.partyName));
    return Array.from(partyNames).sort();
  }, [products]);

  const uniqueCategories = React.useMemo(() => {
    const categoryNames = new Set(products.map(p => p.category));
    return Array.from(categoryNames).sort();
  }, [products]);


  const sortedData = React.useMemo(() => {
    const dataToSort = products.map(p => ({
      ...p,
      rates: rateHistories[p.id] ?? [],
    }));

    switch (activeSort) {
      case 'oldest':
        return dataToSort.sort((a, b) => new Date(a.billDate).getTime() - new Date(b.billDate).getTime());
      case 'asc':
        return dataToSort.sort((a, b) => a.name.localeCompare(b.name));
      case 'desc':
        return dataToSort.sort((a, b) => b.name.localeCompare(a.name));
      case 'party-asc':
        return dataToSort.sort((a, b) => a.partyName.localeCompare(b.partyName));
      case 'party-desc':
        return dataToSort.sort((a, b) => b.partyName.localeCompare(a.partyName));
      case 'newest':
      default:
        return dataToSort.sort((a, b) => new Date(b.billDate).getTime() - new Date(a.billDate).getTime());
    }
  }, [products, rateHistories, activeSort]);


  const columns: ColumnDef<ProductWithRates>[] = [
     {
      id: 'expander',
      header: () => null,
      cell: ({ row }) => {
        const hasHistory = row.original.rates.length > 1;
        if (!hasHistory) return <div className="w-4" />;
        
        return (
             <ChevronDown className={cn("h-4 w-4 transition-transform", openCollapsibles.has(row.original.id) && "rotate-180" )} />
        )
      },
      enableSorting: false,
    },
    {
      id: 'sNo',
      header: 'S.No',
      cell: ({ row, table }) => {
        const sortedRowIndex = table.getSortedRowModel().rows.findIndex(sortedRow => sortedRow.id === row.id);
        return sortedRowIndex + 1;
      },
      enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: () => {
        return (
          <div className="flex items-center gap-2">
            Product Name
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setActiveSort('newest')}>Newest first</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveSort('oldest')}>Oldest first</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveSort('asc')}>A-Z</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveSort('desc')}>Z-A</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      cell: ({ row }) => row.original.name,
    },
    {
      id: 'rate',
      header: () => <div className="text-right">Rate</div>,
      cell: ({ row }) => {
        const latestRate = row.original.rates[0]?.rate ?? 0;
        return (
            <div className="text-right font-medium">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(latestRate)}
            </div>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: 'unit',
      header: 'Unit',
      cell: ({ row }) => row.original.unit,
      enableSorting: false,
    },
    {
      accessorKey: 'gst',
      header: 'GST %',
      cell: ({ row }) => `${row.original.gst}%`,
      enableSorting: false,
    },
    {
      id: 'finalRate',
      header: () => <div className="text-right">Final Rate</div>,
      cell: ({ row }) => {
        const latestRate = row.original.rates[0]?.rate ?? 0;
        const finalRate = latestRate * (1 + row.original.gst / 100);
        return (
          <div className="text-right font-bold">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(finalRate)}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'partyName',
      header: ({ column }) => {
        const selectedParties = (column?.getFilterValue() as string[] | undefined) ?? uniquePartyNames;

        const handleSelectAll = (checked: boolean) => {
            if (checked) {
                column?.setFilterValue(uniquePartyNames);
            } else {
                column?.setFilterValue([]);
            }
        };

        const handleSelectParty = (partyName: string, checked: boolean) => {
            const currentSelection = (column?.getFilterValue() as string[] | undefined) ?? uniquePartyNames;
            if (checked) {
                column?.setFilterValue([...currentSelection, partyName]);
            } else {
                column?.setFilterValue(currentSelection.filter(p => p !== partyName));
            }
        };

        const allSelected = selectedParties.length === uniquePartyNames.length;


        return (
          <div className="flex items-center gap-2">
            Party Name
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Filter by Party</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  onSelect={(e) => e.preventDefault()}
                >
                  Select All
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <ScrollArea className="h-48">
                {uniquePartyNames.map(party => (
                    <DropdownMenuCheckboxItem
                        key={party}
                        checked={selectedParties.includes(party)}
                        onCheckedChange={(checked) => handleSelectParty(party, Boolean(checked))}
                        onSelect={(e) => e.preventDefault()}
                    >
                        {party}
                    </DropdownMenuCheckboxItem>
                ))}
                </ScrollArea>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveSort('party-asc')}>Sort A-Z</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveSort('party-desc')}>Sort Z-A</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      cell: ({ row }) => row.original.partyName,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
    },
    {
      accessorKey: 'pageNo',
      header: 'Page No',
       cell: ({ row }) => row.original.pageNo,
       enableSorting: false,
    },
    {
      accessorKey: 'billDate',
      header: 'Bill Date',
      cell: ({ row }) => format(new Date(row.original.billDate), 'PPP'),
      enableSorting: false,
    },
    {
      accessorKey: 'category',
      header: ({ column }) => {
        const selectedCategories = (column?.getFilterValue() as string[] | undefined) ?? uniqueCategories;

        const handleSelectAll = (checked: boolean) => {
            if (checked) {
                column?.setFilterValue(uniqueCategories);
            } else {
                column?.setFilterValue([]);
            }
        };

        const handleSelectCategory = (category: string, checked: boolean) => {
            const currentSelection = (column?.getFilterValue() as string[] | undefined) ?? uniqueCategories;
            if (checked) {
                column?.setFilterValue([...currentSelection, category]);
            } else {
                column?.setFilterValue(currentSelection.filter(c => c !== category));
            }
        };
        
        const allSelected = selectedCategories.length === uniqueCategories.length;

        return (
          <div className="flex items-center gap-2">
            Category
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  onSelect={(e) => e.preventDefault()}
                >
                  Select All
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <ScrollArea className="h-48">
                {uniqueCategories.map(category => (
                    <DropdownMenuCheckboxItem
                        key={category}
                        checked={selectedCategories.includes(category)}
                        onCheckedChange={(checked) => handleSelectCategory(category, Boolean(checked))}
                        onSelect={(e) => e.preventDefault()}
                    >
                        {category}
                    </DropdownMenuCheckboxItem>
                ))}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      cell: ({ row }) => row.original.category,
      enableSorting: false,
      filterFn: multiSelectFilterFn,
    },
    {
      id: 'actions',
      header: () => <div className="text-center no-print">Actions</div>,
      cell: ({ row }) => {
        const product = row.original;
        const latestRate = product.rates[0];
        const canDeleteRate = product.rates.length > 1;

        return (
          <TooltipProvider>
            <div className="flex items-center justify-center gap-1 no-print">
                 <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setAddingRateToProduct(product); }}>
                        <PlusCircle className="h-4 w-4 text-green-600" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add New Rate</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setEditingProduct(product);}}>
                        <Edit className="h-4 w-4 text-blue-600" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit Product Details</TooltipContent>
                  </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canDeleteRate && latestRate) {
                            setDeletingRateInfo({ product, rate: latestRate });
                        } else {
                            setDeletingProduct(product);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-orange-600" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {canDeleteRate ? 'Delete Latest Rate' : 'Delete Product'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDeletingProduct(product);}}>
                      <XCircle className="h-4 w-4 text-red-600" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Delete Product &amp; All History
                  </TooltipContent>
                </Tooltip>
            </div>
          </TooltipProvider>
        );
      },
      enableSorting: false,
    },
  ];

  const table = useReactTable({
    data: sortedData,
    columns,
    state: { columnFilters, sorting },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
        columnFilters: [
            { id: 'partyName', value: uniquePartyNames },
            { id: 'category', value: uniqueCategories },
        ]
    }
  });
  
    // Set initial filter state for party names to all selected
    React.useEffect(() => {
        table.getColumn('partyName')?.setFilterValue(uniquePartyNames);
    }, [table, uniquePartyNames]);

    React.useEffect(() => {
        table.getColumn('category')?.setFilterValue(uniqueCategories);
    }, [table, uniqueCategories]);


  const toggleCollapsible = (productId: string) => {
    setOpenCollapsibles(prev => {
        const newSet = new Set(prev);
        if(newSet.has(productId)) {
            newSet.delete(productId);
        } else {
            newSet.add(productId);
        }
        return newSet;
    });
  }

  const onProductAdded = (newProduct: Product, initialRate: Rate) => {
    setProducts(prev => [newProduct, ...prev]);
    // Ensure the initial rate has a temporary unique ID for the key
    const rateWithId = { ...initialRate, id: `temp-${Date.now()}` };
    setRateHistories(prev => ({...prev, [newProduct.id]: [rateWithId]}));
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
      [productId]: [newRate, ...(prev[productId] ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
            { user && 
                <ProductFormDialog onProductAction={onProductAdded}>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                    </Button>
                </ProductFormDialog> 
            }
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
                table.getRowModel().rows.map((row) => {
                  const isOpen = openCollapsibles.has(row.original.id);
                  const hasHistory = row.original.rates.length > 1;
                  return (
                    <React.Fragment key={`product-${row.original.id}`}>
                      <TableRow
                        key={`main-${row.original.id}`}
                        data-state={row.getIsSelected() && 'selected'}
                        className={cn(hasHistory && "cursor-pointer")}
                        onClick={() => hasHistory && toggleCollapsible(row.original.id)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className={cn(cell.column.id === 'actions' ? 'no-print' : '')}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                      {isOpen && hasHistory && row.original.rates.slice(1).map((rate) => {
                        const finalRate = rate.rate * (1 + row.original.gst / 100);
                        return (
                          <TableRow key={`${row.original.id}-${rate.id}`} className="bg-muted/50 hover:bg-muted/70">
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell></TableCell>
                            <TableCell className="text-right font-medium">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rate.rate)}</TableCell>
                            <TableCell>{row.original.unit}</TableCell>
                            <TableCell>{row.original.gst}%</TableCell>
                            <TableCell className="text-right font-bold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(finalRate)}</TableCell>
                            <TableCell>{row.original.partyName}</TableCell>
                            <TableCell>{row.original.pageNo}</TableCell>
                            <TableCell>{format(new Date(rate.createdAt), 'PPP')}</TableCell>
                            <TableCell>{row.original.category}</TableCell>
                            <TableCell className="no-print">
                              <TooltipProvider>
                                <div className="flex items-center justify-center">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 no-print" onClick={(e) => { e.stopPropagation(); setDeletingRateInfo({ product: row.original, rate }); }}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete This Rate Entry</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TooltipProvider>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                })
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
        billDate: format(new Date(), 'yyyy-MM-dd'),
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
        billDate: format(new Date(product.billDate), 'yyyy-MM-dd'),
        gst: product.gst,
    };
};

function ProductFormDialog({
  onProductAction,
  product,
  isOpen,
  setIsOpen,
  children,
}: {
  onProductAction: (product: any, rate?: any) => void;
  product?: Product;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
  children?: React.ReactNode;
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
    
    // Convert string date to Date object before sending
    const valuesWithDate = { ...values, billDate: new Date(values.billDate) };

    if (isEditing) {
      const result = await updateProductAction(product.id, valuesWithDate as UpdateProductSchema);
      if (result.success) {
        onProductAction(valuesWithDate);
        toast({ title: 'Success', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    } else {
      const result = await addProductAction(valuesWithDate as ProductSchema);
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
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
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
                    <FormItem><FormLabel>GST (%)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g. 5" {...field} value={field.value ?? ''} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
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
                   <FormControl>
                        <Input type="date" {...field} />
                   </FormControl>
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
  billDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
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
      billDate: format(new Date(), 'yyyy-MM-dd'),
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
            billDate: format(new Date(), 'yyyy-MM-dd'),
            pageNo: product.pageNo,
            gst: product.gst,
        })
    }
  }, [product, form]);

  async function onSubmit(values: AddRateSchema) {
    if (!product) return;
    setIsSubmitting(true);
    const billDate = new Date(values.billDate);
    const result = await addRateAction(product.id, values.rate, billDate, values.pageNo, values.gst);
    if (result.success && result.rate) {
      onRateAdded(product.id, result.rate, billDate, values.pageNo, values.gst);
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
                    <FormControl>
                        <Input type="date" {...field} />
                    </FormControl>
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
