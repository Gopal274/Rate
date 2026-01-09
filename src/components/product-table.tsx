
'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
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
  syncToGoogleSheetAction,
  importFromGoogleSheetAction,
} from '@/lib/actions';
import type { Product, Rate, ProductWithRates } from '@/lib/types';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Input } from '@/components/ui/input';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

import { useUser, useFirebase } from '@/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { ScrollArea } from './ui/scroll-area';
import { GoogleAuthProvider, signInWithPopup, UserCredential } from 'firebase/auth';
import {
    ProductFormDialog,
    AddRateDialog,
    DeleteProductDialog,
    DeleteRateDialog
} from './product-forms';

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
  const [columnFilters, setColumnFilters] = usePersistentState<ColumnFiltersState>('product-table-filters', []);
  const [openCollapsibles, setOpenCollapsibles] = React.useState<Set<string>>(new Set());
  const [activeSort, setActiveSort] = usePersistentState<SortDirection>('product-table-sort', 'newest');

  const [isAddProductOpen, setIsAddProductOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = React.useState<Product | null>(null);
  const [addingRateToProduct, setAddingRateToProduct] = React.useState<ProductWithRates | null>(null);
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


  const uniquePartyNames = React.useMemo(() => {
    if (!allProductsWithRates) return [];
    const partyNames = new Set(allProductsWithRates.map(p => p.partyName));
    return Array.from(partyNames).sort();
  }, [allProductsWithRates]);

  const uniqueCategories = React.useMemo(() => {
    if (!allProductsWithRates) return [];
    const categoryNames = new Set(allProductsWithRates.map(p => p.category));
    return Array.from(categoryNames).sort();
  }, [allProductsWithRates]);


  const sortedData = React.useMemo(() => {
    let dataToSort = [...allProductsWithRates].filter(p => p.rates.length > 0); 
    
    const getFinalRate = (p: ProductWithRates) => {
        const latestRateInfo = p.rates[0];
        if (!latestRateInfo) return 0;
        const rate = latestRateInfo.rate;
        const gst = latestRateInfo.gst;
        if (typeof rate !== 'number' || typeof gst !== 'number') return 0;
        return rate * (1 + gst / 100);
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
  }, [allProductsWithRates, activeSort]);


  const columns: ColumnDef<ProductWithRates>[] = React.useMemo(() => [
     {
      id: 'sno',
      header: 'S.No',
      cell: ({ row, table }) => {
        const sortedRows = table.getCoreRowModel().rows;
        const rowIndex = sortedRows.findIndex(sortedRow => sortedRow.id === row.id);
        return <div className="text-center">{rowIndex + 1}</div>;
      },
      enableSorting: false,
    },
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
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(latestRate as number)}
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
        const rate = latestRateInfo.rate as number;
        const gst = latestRateInfo.gst as number;
        const finalRate = rate * (1 + gst / 100);
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
      cell: ({ row }) => {
        const billDate = row.original.rates[0]?.billDate;
        if (!billDate) return '';
        const date = new Date(billDate as string);
        return isValid(date) ? format(date, 'dd/MM/yy') : '';
      },
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
                            setDeletingRateInfo({ product, rate: latestRate as Rate });
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
                  <ProductFormDialog isOpen={isAddProductOpen} setIsOpen={setIsAddProductOpen}>
                      <Button onClick={() => setIsAddProductOpen(true)}>
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
                          const finalRate = (rate.rate as number) * (1 + (rate.gst as number) / 100);
                          return (
                            <TableRow key={`${row.original.id}-${rate.id}`} className="bg-muted/50 hover:bg-muted/70">
                              <TableCell className='whitespace-nowrap'></TableCell>
                              <TableCell className='whitespace-nowrap'></TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {format(new Date(rate.createdAt as string), 'dd/MM/yy, h:mm a')}
                              </TableCell>
                              <TableCell className="text-right font-medium whitespace-nowrap">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rate.rate as number)}</TableCell>
                              <TableCell className='whitespace-nowrap'>{row.original.unit}</TableCell>
                              <TableCell className='text-center whitespace-nowrap'>{rate.gst}%</TableCell>
                              <TableCell className="text-right font-bold whitespace-nowrap">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(finalRate)}</TableCell>
                              <TableCell className='whitespace-nowrap'>{row.original.partyName}</TableCell>
                              <TableCell className='whitespace-nowrap'>{rate.pageNo}</TableCell>
                              <TableCell className='whitespace-nowrap'>{format(new Date(rate.billDate as string), 'dd/MM/yy')}</TableCell>
                              <TableCell className='whitespace-nowrap'>{row.original.category}</TableCell>
                              <TableCell className="no-print whitespace-nowrap">
                                <TooltipProvider>
                                  <div className="flex items-center justify-center">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 no-print" onClick={(e) => { e.stopPropagation(); setDeletingRateInfo({ product: row.original, rate: rate as Rate }); }}>
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
          />
        )}

        {addingRateToProduct && (
          <AddRateDialog
              product={addingRateToProduct as ProductWithRates}
              isOpen={!!addingRateToProduct}
              setIsOpen={(isOpen) => !isOpen && setAddingRateToProduct(null)}
          />
        )}
        <DeleteRateDialog
          rateInfo={deletingRateInfo}
          isOpen={!!deletingRateInfo}
          setIsOpen={(isOpen) => !isOpen && setDeletingRateInfo(null)}
        />
        <DeleteProductDialog
          product={deletingProduct}
          isOpen={!!deletingProduct}
          setIsOpen={(isOpen) => !isOpen && setDeletingProduct(null)}
        />
      </Card>
    </>
  );
}
