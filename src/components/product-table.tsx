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
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Edit,
  PlusCircle,
  Trash2,
  Printer,
  ChevronDown,
  XCircle,
  Filter,
  ArrowUpDown,
  Save,
  ExternalLink,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { format, isValid } from 'date-fns';

import {
  addProductAction,
  deleteProductAction,
  updateProductAction,
  addRateAction,
  deleteRateAction,
  getProductRatesAction,
  syncToGoogleSheetAction,
  importFromGoogleSheetAction,
} from '@/lib/actions';
import type { Product, ProductSchema, Rate, UpdateProductSchema, ProductWithRates } from '@/lib/types';
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
import { useUser, useFirebase } from '@/firebase';
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
import { GoogleAuthProvider, signInWithPopup, UserCredential } from 'firebase/auth';

type SortDirection = 'newest' | 'oldest' | 'asc' | 'desc' | 'party-asc' | 'party-desc' | 'final-rate-asc' | 'final-rate-desc';

const multiSelectFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
    if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) {
        return true;
    }
    const value = row.getValue(columnId);
    return Array.isArray(filterValue) && filterValue.includes(value);
};

const usePersistentState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [state, setState] = React.useState<T>(() => {
        if (typeof window === 'undefined') {
            return defaultValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return defaultValue;
        }
    });

    React.useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, state]);

    return [state, setState];
};


export function ProductTable({ allProductsWithRates }: { allProductsWithRates: ProductWithRates[] }) {
  const [products, setProducts] = React.useState<ProductWithRates[]>(allProductsWithRates);
  const [columnFilters, setColumnFilters] = usePersistentState<ColumnFiltersState>('product-table-filters', []);
  const [openCollapsibles, setOpenCollapsibles] = React.useState<Set<string>>(new Set());
  const [activeSort, setActiveSort] = usePersistentState<SortDirection>('product-table-sort', 'newest');

  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = React.useState<Product | null>(null);
  const [addingRateToProduct, setAddingRateToProduct] = React.useState<Product | null>(null);
  const [deletingRateInfo, setDeletingRateInfo] = React.useState<{ product: Product; rate: Rate } | null>(null);
  

  const { user } = useUser();
  const { auth } = useFirebase();
  const { toast } = useToast();
  
  const handlePrint = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  const handleGoogleApiAction = async (action: 'sync' | 'import') => {
    if (!auth.currentUser) {
        toast({ title: 'Error', description: 'You must be signed in to perform this action.', variant: 'destructive'});
        return;
    }
    
    toast({ title: 'Connecting to Google...', description: 'Please follow prompts to grant permission.'});
    
    try {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/drive.file');
        provider.addScope('https://www.googleapis.com/auth/spreadsheets');

        const result: UserCredential = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;

        if (!accessToken) {
            throw new Error("Could not retrieve access token from Google.");
        }
        
        let actionResult;
        if (action === 'sync') {
            toast({ title: 'Syncing Data...', description: 'Pushing all local data to your Google Sheet.' });
            actionResult = await syncToGoogleSheetAction(accessToken);
        } else {
            toast({ title: 'Importing Data...', description: 'Reading your Google Sheet and updating local data.' });
            actionResult = await importFromGoogleSheetAction(accessToken);
        }
        
        if (actionResult.success) {
            toast({ 
                title: 'Success!', 
                description: actionResult.message,
                action: (actionResult as any).link ? (
                    <a href={(actionResult as any).link} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Sheet
                        </Button>
                    </a>
                ) : undefined,
            });
        } else {
            toast({ title: 'Action Failed', description: actionResult.message, variant: 'destructive'});
        }

    } catch (error: any) {
        if (error.code === 'auth/popup-closed-by-user') {
            toast({
                variant: 'destructive',
                title: 'Process Canceled',
                description: 'The sign-in process was canceled. Please try again.',
            });
        } else {
            console.error("Google API Action Error:", error);
            toast({ title: 'Authentication Failed', description: error.message || "Could not connect to Google.", variant: 'destructive' });
        }
    }
  };


  React.useEffect(() => {
    setProducts(allProductsWithRates);
  }, [allProductsWithRates]);
  
  const uniquePartyNames = React.useMemo(() => {
    const partyNames = new Set((products || []).map(p => p.partyName));
    return Array.from(partyNames).sort();
  }, [products]);

  const uniqueCategories = React.useMemo(() => {
    const categoryNames = new Set((products || []).map(p => p.category));
    return Array.from(categoryNames).sort();
  }, [products]);


  const sortedData = React.useMemo(() => {
    let dataToSort = [...products].filter(p => p.rates.length > 0); 
    
    const getFinalRate = (p: ProductWithRates) => {
        const latestRateInfo = p.rates[0];
        if (!latestRateInfo) return 0;
        return latestRateInfo.rate * (1 + latestRateInfo.gst / 100);
    };

    switch (activeSort) {
      case 'oldest':
        return dataToSort.sort((a, b) => new Date(a.rates[0].billDate).getTime() - new Date(b.rates[0].billDate).getTime());
      case 'asc':
        return dataToSort.sort((a, b) => a.name.localeCompare(b.name));
      case 'desc':
        return dataToSort.sort((a, b) => b.name.localeCompare(a.name));
      case 'party-asc':
        return dataToSort.sort((a, b) => a.partyName.localeCompare(b.partyName));
      case 'party-desc':
        return dataToSort.sort((a, b) => b.partyName.localeCompare(a.partyName));
       case 'final-rate-asc':
        return dataToSort.sort((a, b) => getFinalRate(a) - getFinalRate(b));
      case 'final-rate-desc':
        return dataToSort.sort((a, b) => getFinalRate(b) - getFinalRate(a));
      case 'newest':
      default:
        return dataToSort.sort((a, b) => new Date(b.rates[0].createdAt).getTime() - new Date(a.rates[0].createdAt).getTime());
    }
  }, [products, activeSort]);


  const columns: ColumnDef<ProductWithRates>[] = React.useMemo(() => [
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
      id: 'gst',
      header: () => <div className="text-center">GST %</div>,
      cell: ({ row }) => <div className="text-center">{`${row.original.rates[0]?.gst ?? 0}%`}</div>,
      enableSorting: false,
    },
    {
      id: 'finalRate',
      header: () => {
        return (
            <div className="flex items-center justify-end gap-2">
                Final Rate
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveSort(prev => prev === 'final-rate-desc' ? 'final-rate-asc' : 'final-rate-desc')}>
                    <ArrowUpDown className="h-4 w-4" />
                </Button>
            </div>
        );
      },
      cell: ({ row }) => {
        const latestRateInfo = row.original.rates[0];
        if (!latestRateInfo) return null;
        const finalRate = latestRateInfo.rate * (1 + latestRateInfo.gst / 100);
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
        const selectedParties = (column?.getFilterValue() as string[] | undefined) ?? [];

        const handleSelectAll = (checked: boolean) => {
            if (checked) {
                column?.setFilterValue(uniquePartyNames);
            } else {
                column?.setFilterValue([]);
            }
        };

        const handleSelectParty = (partyName: string, checked: boolean) => {
            const currentSelection = (column?.getFilterValue() as string[] | undefined) ?? [];
            if (checked) {
                column?.setFilterValue([...currentSelection, partyName]);
            } else {
                column?.setFilterValue(currentSelection.filter(p => p !== partyName));
            }
        };

        const allSelected = selectedParties.length === uniquePartyNames.length && uniquePartyNames.length > 0;

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
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => column?.setFilterValue([])}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Clear Filter
                </DropdownMenuItem>
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
      id: 'pageNo',
      header: 'Page No',
       cell: ({ row }) => row.original.rates[0]?.pageNo ?? '',
       enableSorting: false,
    },
    {
      id: 'billDate',
      header: 'Bill Date',
      cell: ({ row }) => format(new Date(row.original.rates[0]?.billDate ?? new Date()), 'dd/MM/yy'),
      enableSorting: false,
    },
    {
      accessorKey: 'category',
      header: ({ column }) => {
        const selectedCategories = (column?.getFilterValue() as string[] | undefined) ?? [];

        const handleSelectAll = (checked: boolean) => {
            if (checked) {
                column?.setFilterValue(uniqueCategories);
            } else {
                column?.setFilterValue([]);
            }
        };

        const handleSelectCategory = (category: string, checked: boolean) => {
            const currentSelection = (column?.getFilterValue() as string[] | undefined) ?? [];
            if (checked) {
                column?.setFilterValue([...currentSelection, category]);
            } else {
                column?.setFilterValue(currentSelection.filter(c => c !== category));
            }
        };
        
        const allSelected = selectedCategories.length === uniqueCategories.length && uniqueCategories.length > 0;

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
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => column?.setFilterValue([])}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Clear Filter
                </DropdownMenuItem>
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
  ], [openCollapsibles, uniquePartyNames, uniqueCategories, setActiveSort]);

  const table = useReactTable({
    data: sortedData,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {},
    meta: {
        toggleCollapsible: (productId: string) => {
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
    }
  });

  const tableContainerRef = React.useRef<HTMLDivElement>(null);
  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 57, // Approximate height of a row
    overscan: 5,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0) : 0;
  
    React.useEffect(() => {
        const partyFilter = columnFilters.find(f => f.id === 'partyName');
        if(!partyFilter && uniquePartyNames.length > 0 && table.getColumn('partyName')) {
            table.getColumn('partyName')?.setFilterValue(uniquePartyNames);
        }
    }, [table, uniquePartyNames, columnFilters]);

    React.useEffect(() => {
        const categoryFilter = columnFilters.find(f => f.id === 'category');
        if(!categoryFilter && uniqueCategories.length > 0 && table.getColumn('category')) {
            table.getColumn('category')?.setFilterValue(uniqueCategories);
        }
    }, [table, uniqueCategories, columnFilters]);

  const onProductAdded = (newProduct: Product, initialRate: Rate) => {
    const newProductWithRates: ProductWithRates = {
        ...newProduct,
        rates: [{
            ...initialRate,
            id: `temp-${Date.now()}`,
            billDate: new Date(initialRate.billDate),
            createdAt: new Date(initialRate.createdAt)
        }]
    };
    setProducts(prev => [newProductWithRates, ...prev]);
  };

  const onProductUpdated = (updatedProductData: Partial<Product>) => {
    const productId = editingProduct?.id;
    if(!productId) return;

    setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, ...updatedProductData } : p
    ));
  };
  
  const onRateAdded = (productId: string, newRate: Rate) => {
     const rateWithDateObjects = { 
        ...newRate, 
        billDate: new Date(newRate.billDate),
        createdAt: new Date(newRate.createdAt)
    };
     setProducts(prevProducts => {
        return prevProducts.map(p => {
            if (p.id === productId) {
                const newRates = [rateWithDateObjects, ...p.rates].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                return {...p, rates: newRates};
            }
            return p;
        });
     });
  }

  const onProductDeleted = (deletedProductId: string) => {
    setProducts(prev => prev.filter(p => p.id !== deletedProductId));
  }

  const onRateDeleted = (productId: string, rateId: string) => {
    setProducts(prevProducts => {
        return prevProducts.map(p => {
            if (p.id === productId) {
                return {...p, rates: p.rates.filter(r => r.id !== rateId)};
            }
            return p;
        });
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Products</CardTitle>
              <CardDescription>Manage your products and their rates.</CardDescription>
            </div>
             <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap no-print">
               <Input
                placeholder="Filter products..."
                value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
                onChange={(event) =>
                  table.getColumn('name')?.setFilterValue(event.target.value)
                }
                className="max-w-xs"
              />
              <Button onClick={handlePrint} variant="outline" size="icon">
                  <Printer className="h-4 w-4" />
                  <span className="sr-only">Print</span>
              </Button>
               <Button onClick={() => handleGoogleApiAction('import')} variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import from Sheet
              </Button>
              <Button onClick={() => handleGoogleApiAction('sync')} variant="outline">
                  <Save className="mr-2 h-4 w-4" />
                  Sync with Google Sheets
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
          <div ref={tableContainerRef} className="rounded-md border relative overflow-auto" style={{ height: '60vh' }}>
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} className={cn('whitespace-nowrap', header.id === 'actions' ? 'no-print' : '')} style={{ width: header.getSize() }}>
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
                {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px` }} />
                    </tr>
                )}
                {virtualRows.length > 0 ? (
                  virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    const isOpen = openCollapsibles.has(row.original.id);
                    const hasHistory = row.original.rates.length > 1;
                    return (
                      <React.Fragment key={`product-${row.original.id}`}>
                        <TableRow
                          key={`main-${row.original.id}`}
                          data-state={row.getIsSelected() && 'selected'}
                          className={cn(hasHistory && "cursor-pointer")}
                          onClick={() => hasHistory && table.options.meta?.toggleCollapsible(row.original.id)}
                          data-index={virtualRow.index}
                          ref={node => rowVirtualizer.measureElement(node)}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className={cn('whitespace-nowrap', cell.column.id === 'actions' ? 'no-print' : '')}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                        {isOpen && hasHistory && row.original.rates.slice(1).map((rate) => {
                          const finalRate = rate.rate * (1 + rate.gst / 100);
                          return (
                            <TableRow key={`${row.original.id}-${rate.id}`} className="bg-muted/50 hover:bg-muted/70">
                              <TableCell className='whitespace-nowrap'></TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {format(new Date(rate.createdAt), 'dd/MM/yy, h:mm a')}
                              </TableCell>
                              <TableCell className="text-right font-medium whitespace-nowrap">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rate.rate)}</TableCell>
                              <TableCell className='whitespace-nowrap'>{row.original.unit}</TableCell>
                              <TableCell className='text-center whitespace-nowrap'>{rate.gst}%</TableCell>
                              <TableCell className="text-right font-bold whitespace-nowrap">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(finalRate)}</TableCell>
                              <TableCell className='whitespace-nowrap'>{row.original.partyName}</TableCell>
                              <TableCell className='whitespace-nowrap'>{rate.pageNo}</TableCell>
                              <TableCell className='whitespace-nowrap'>{format(new Date(rate.billDate), 'dd/MM/yy')}</TableCell>
                              <TableCell className='whitespace-nowrap'>{row.original.category}</TableCell>
                              <TableCell className="no-print whitespace-nowrap">
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
                      No products found. Adjust your filters or add a product to get started.
                    </TableCell>
                  </TableRow>
                )}
                 {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${paddingBottom}px` }} />
                    </tr>
                )}
              </TableBody>
            </Table>
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
              product={addingRateToProduct as ProductWithRates}
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
    </>
  );
}

const getInitialAddFormValues = () => {
    return {
        name: '',
        unit: 'piece' as const,
        partyName: '',
        category: 'Other' as const,
        rate: '' as any,
        gst: '' as any,
        pageNo: '' as any,
        billDate: format(new Date(), 'yyyy-MM-dd'),
    };
};

const getInitialEditFormValues = (product: Product) => {
    return {
        name: product.name,
        unit: product.unit,
        partyName: product.partyName,
        category: product.category,
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
    defaultValues: isEditing ? getInitialEditFormValues(product!) : getInitialAddFormValues(),
  });
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(!!isOpen);

  React.useEffect(() => {
    setIsDialogOpen(!!isOpen);
  }, [isOpen]);
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
        form.reset(isEditing ? getInitialEditFormValues(product!) : getInitialAddFormValues());
    }
    if (setIsOpen) {
      setIsOpen(open);
    } else {
      setIsDialogOpen(open);
    }
  };

  React.useEffect(() => {
    form.reset(isEditing ? getInitialEditFormValues(product!) : getInitialAddFormValues());
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
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
          <DialogDescription>
            {product
              ? "Update this product's core details."
              : 'Add a new product and its initial rate to your records.'}
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
            {!isEditing && (
                <>
                    <FormField
                        control={form.control}
                        name="rate"
                        render={({ field }) => (
                            <FormItem><FormLabel>Initial Rate</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g. 120.50" {...field} value={field.value ?? ''} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                        )}
                    />
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
                </>
            )}
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
  product: ProductWithRates | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onRateAdded: (productId: string, newRate: Rate) => void;
}) {
    const latestRate = product?.rates[0];
    const form = useForm<AddRateSchema>({
        resolver: zodResolver(addRateSchema),
        defaultValues: {
        rate: '' as any,
        billDate: format(new Date(), 'yyyy-MM-dd'),
        pageNo: latestRate?.pageNo ?? 1,
        gst: latestRate?.gst ?? 0,
        },
    });
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if(product) {
        const latestRateInfo = product.rates[0];
        form.reset({
            rate: '' as any,
            billDate: format(new Date(), 'yyyy-MM-dd'),
            pageNo: latestRateInfo?.pageNo,
            gst: latestRateInfo?.gst,
        })
    }
  }, [product, form]);

  async function onSubmit(values: AddRateSchema) {
    if (!product) return;
    setIsSubmitting(true);
    const billDate = new Date(values.billDate);
    const result = await addRateAction(product.id, values.rate, billDate, values.pageNo, values.gst);
    if (result.success && result.rate) {
      onRateAdded(product.id, result.rate);
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
                    <FormItem><FormLabel>New GST (%)</FormLabel><FormControl><Input type="number" placeholder="e.g. 5" {...field} value={field.value ?? ''} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="pageNo"
                render={({ field }) => (
                    <FormItem><FormLabel>New Page No.</FormLabel><FormControl><Input type="number" placeholder="e.g. 42" {...field} value={field.value ?? ''} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
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
                Are you sure you want to delete the rate of <span className="font-semibold text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rateInfo.rate.rate)}</span> from <span className="font-semibold text-foreground">{format(new Date(rateInfo.rate.createdAt), 'dd/MM/yy')}</span>? This action cannot be undone.
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