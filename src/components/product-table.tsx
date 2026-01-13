
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
  Table as ReactTable,
  Row,
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
  ExternalLink,
  RotateCcw,
  Download,
  Upload,
  MoreVertical,
  LayoutGrid,
  List,
  Check,
  ArrowUp,
  ArrowDown,
  Plus,
} from 'lucide-react';
import { format, isValid } from 'date-fns';

import {
  exportToGoogleSheetAction,
  importFromGoogleSheetAction,
} from '@/lib/actions';
import type { Product, Rate, ProductWithRates } from '@/lib/types';

import { cn, safeToDate } from '@/lib/utils';
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
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetClose,
} from '@/components/ui/sheet';
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
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import {
    ProductFormDialog,
    AddRateDialog,
    DeleteProductDialog,
    DeleteRateDialog,
    BatchAddProductDialog,
} from './product-forms';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';


type SortDirection = 'newest' | 'oldest' | 'asc' | 'desc';
type ViewMode = 'table' | 'card';

const multiSelectFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
    if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) {
        return true;
    }
    const value = row.getValue(columnId);
    return Array.isArray(filterValue) && filterValue.includes(value);
};

const nameFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
    const { globalFilter, alphabetFilter } = filterValue || {};

    const value = row.getValue(columnId) as string;

    // Global text search
    if (globalFilter) {
        if (!value.toLowerCase().includes(globalFilter.toLowerCase())) {
            return false;
        }
    }
    
    // Alphabetical filter
    if (alphabetFilter && alphabetFilter.length > 0) {
        const firstLetter = value.charAt(0).toUpperCase();
        if (!alphabetFilter.includes(firstLetter)) {
            return false;
        }
    }

    return true;
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

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
};


export function ProductTable({ allProductsWithRates }: { allProductsWithRates: ProductWithRates[] }) {
  const [columnFilters, setColumnFilters] = usePersistentState<ColumnFiltersState>('product-table-filters-v10', []);
  const [openCollapsibles, setOpenCollapsibles] = React.useState<Set<string>>(new Set());
  const [activeSort, setActiveSort] = usePersistentState<SortDirection>('product-table-sort-v2', 'newest');
  const [viewMode, setViewMode] = usePersistentState<ViewMode>('product-table-view-mode', 'table');

  const [isBatchAddOpen, setIsBatchAddOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<ProductWithRates | null>(null);
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

  const handleGoogleApiAction = async (action: 'export' | 'import') => {
    if (!auth.currentUser) {
        toast({ title: 'Error', description: 'You must be signed in to perform this action.', variant: 'destructive'});
        return;
    }

    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
    
    try {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;

        if (!accessToken) {
            throw new Error("Could not retrieve access token from Google.");
        }
        
        let actionResult;
        if (action === 'export') {
            toast({ title: 'Exporting Data...', description: 'Pushing all local data to your Google Sheet.' });
            actionResult = await exportToGoogleSheetAction(accessToken);
        } else if (action === 'import') {
            toast({ title: 'Importing Data...', description: 'Reading data from your Google Sheet to add here.' });
            actionResult = await importFromGoogleSheetAction(accessToken);
        }
        
        if (actionResult?.success) {
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
            toast({ title: 'Action Failed', description: actionResult?.message, variant: 'destructive'});
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
    const partyNames = new Set(allProductsWithRates.filter(p => p.rates.length > 0).map(p => p.partyName));
    return Array.from(partyNames).sort((a, b) => a.localeCompare(b));
  }, [allProductsWithRates]);

    const uniqueFirstLetters = React.useMemo(() => {
        const firstLetters = new Set(allProductsWithRates.filter(p => p.rates.length > 0).map(p => p.name.charAt(0).toUpperCase()));
        return Array.from(firstLetters).sort();
    }, [allProductsWithRates]);

  const sortedData = React.useMemo(() => {
    let dataToSort = [...allProductsWithRates].filter(p => p.rates.length > 0); 
    switch (activeSort) {
      case 'oldest':
        return dataToSort.sort((a, b) => new Date(a.rates[0].billDate as string).getTime() - new Date(b.rates[0].billDate as string).getTime());
      case 'asc':
        return dataToSort.sort((a, b) => a.name.localeCompare(b.name));
      case 'desc':
        return dataToSort.sort((a, b) => b.name.localeCompare(a.name));
      case 'newest':
      default:
        return dataToSort.sort((a, b) => safeToDate(b.rates[0].createdAt).getTime() - safeToDate(a.rates[0].createdAt).getTime());
    }
  }, [allProductsWithRates, activeSort]);

  const columns: ColumnDef<ProductWithRates>[] = React.useMemo(() => [
     {
      id: 'sno',
      header: () => <div className="text-center">S.No</div>,
      cell: ({ row, table }) => {
        const sortedRows = table.getFilteredRowModel().rows;
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
      header: ({ column }) => {
        const filterValue = column.getFilterValue() as {globalFilter: string, alphabetFilter: string[]} | undefined;
        const alphabetFilterValue = filterValue?.alphabetFilter ?? [];

        const setAlphabetFilter = (updater: React.SetStateAction<string[]>) => {
            const newAlphabetFilter = typeof updater === 'function' ? updater(alphabetFilterValue) : updater;
            column.setFilterValue((old: any) => ({ ...(old || {}), alphabetFilter: newAlphabetFilter }));
        }

        const SortIcon = activeSort === 'asc' ? ArrowUp : activeSort === 'desc' ? ArrowDown : ArrowUpDown;


        return (
          <div className="flex items-center gap-2">
            <span>Product Name</span>
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <SortIcon className="h-4 w-4" />
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
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Filter by First Letter</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={alphabetFilterValue.length === 0 || alphabetFilterValue.length === uniqueFirstLetters.length}
                    onCheckedChange={(checked) => setAlphabetFilter(checked ? uniqueFirstLetters : [])}
                    onSelect={(e) => e.preventDefault()}
                  >
                    Select All
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <ScrollArea className="h-48">
                  {uniqueFirstLetters.map(letter => (
                      <DropdownMenuCheckboxItem
                          key={letter}
                          checked={alphabetFilterValue.includes(letter)}
                          onCheckedChange={(checked) => {
                              setAlphabetFilter(current => 
                                  checked ? [...current, letter] : current.filter(l => l !== letter)
                              );
                          }}
                          onSelect={(e) => e.preventDefault()}
                      >
                          {letter}
                      </DropdownMenuCheckboxItem>
                  ))}
                  </ScrollArea>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setAlphabetFilter([])}>
                      <RotateCcw className="mr-2 h-4 w-4" /> Clear Filter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )
      },
      cell: ({ row }) => row.original.name,
      filterFn: nameFilterFn,
    },
    {
      id: 'rate',
      header: () => <div className="text-right">Rate</div>,
      cell: ({ row }) => {
        const latestRate = row.original.rates[0]?.rate ?? 0;
        return (
            <div className="text-right font-medium">
            {formatCurrency(latestRate as number)}
            </div>
        )
      },
      enableSorting: false,
    },
    {
      accessorKey: 'unit',
      header: 'Unit',
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
      header: () => <div className="text-right">Final Rate</div>,
      cell: ({ row }) => {
        const latestRateInfo = row.original.rates[0];
        if (!latestRateInfo) return null;
        const rate = latestRateInfo.rate as number;
        const gst = latestRateInfo.gst as number;
        const finalRate = rate * (1 + gst / 100);
        return (
          <div className="text-right font-bold">
            {formatCurrency(finalRate)}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'partyName',
      header: ({ column }) => {
        const selectedParties = (column?.getFilterValue() as string[] | undefined) ?? [];
        const [partySearch, setPartySearch] = React.useState('');

        const filteredPartyNames = uniquePartyNames.filter(party => 
            party.toLowerCase().includes(partySearch.toLowerCase())
        );

        return (
          <div className="flex items-center gap-2">
            <span>Party Name</span>
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <div className="p-2">
                    <Input
                        placeholder="Search parties..."
                        value={partySearch}
                        onChange={(e) => setPartySearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-8"
                    />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={selectedParties.length === uniquePartyNames.length && partySearch === ''}
                  onCheckedChange={(checked) => column?.setFilterValue(checked ? uniquePartyNames : [])}
                  onSelect={(e) => e.preventDefault()}
                >
                  Select All
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <ScrollArea className="h-48">
                {filteredPartyNames.map(party => (
                    <DropdownMenuCheckboxItem
                        key={party}
                        checked={selectedParties.includes(party)}
                        onCheckedChange={(checked) => {
                            const currentSelection = (column?.getFilterValue() as string[] | undefined) ?? [];
                            if (checked) {
                                column?.setFilterValue([...currentSelection, party]);
                            } else {
                                column?.setFilterValue(currentSelection.filter(p => p !== party));
                            }
                        }}
                        onSelect={(e) => e.preventDefault()}
                    >
                        {party}
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
        const date = safeToDate(billDate);
        return isValid(date) ? format(date, 'dd/MM/yy') : '';
      },
      enableSorting: false,
    },
    {
      id: 'actions',
      header: () => <div className="text-center no-print">Actions</div>,
      cell: ({ row }) => {
        const product = row.original;
        
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
                    <TooltipContent>Edit Product & Latest Rate</TooltipContent>
                  </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (product.rates.length > 1) {
                          setDeletingRateInfo({ product, rate: product.rates[0] as Rate });
                        } else {
                          setDeletingProduct(product);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-orange-600" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {product.rates.length > 1 ? 'Delete Latest Rate' : 'Delete Product'}
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
  ], [openCollapsibles, uniquePartyNames, uniqueFirstLetters, activeSort]);

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
  

  const globalFilterValue = (table.getColumn('name')?.getFilterValue() as any)?.globalFilter ?? '';
  const alphabetFilterValue = (table.getColumn('name')?.getFilterValue() as any)?.alphabetFilter ?? [];
  const partyFilterValue = (table.getColumn('partyName')?.getFilterValue() as string[] | undefined) ?? [];

  const setGlobalFilter = (value: string) => {
    table.getColumn('name')?.setFilterValue((old: any) => ({ ...(old || {}), globalFilter: value }))
  }
  const setAlphabetFilter = (updater: React.SetStateAction<string[]>) => {
    const filter = table.getColumn('name');
    const old = filter?.getFilterValue() as any;
    const newAlphabetFilter = typeof updater === 'function' ? updater(old?.alphabetFilter ?? []) : updater;
    filter?.setFilterValue({ ...old, alphabetFilter: newAlphabetFilter });
  };
  const setPartyFilter = (updater: React.SetStateAction<string[]>) => {
      const filter = table.getColumn('partyName');
      const old = (filter?.getFilterValue() as string[] | undefined) ?? [];
      const newPartyFilter = typeof updater === 'function' ? updater(old) : updater;
      filter?.setFilterValue(newPartyFilter);
  };
  
  const filteredData = table.getFilteredRowModel().rows.map(row => row.original).filter(p => p.rates && p.rates.length > 0);

  const resetFilters = () => {
    table.resetColumnFilters();
  };

  const SheetCheckboxItem = ({
    checked,
    onCheckedChange,
    children
  }: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    children: React.ReactNode;
  }) => (
      <div
          className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          onClick={() => onCheckedChange(!checked)}
      >
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
              {checked && <Check className="h-4 w-4" />}
          </span>
          {children}
      </div>
  );

  const MobileFilterSheet = () => (
    <Sheet>
        <SheetTrigger asChild>
            <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filter
            </Button>
        </SheetTrigger>
        <SheetContent>
            <SheetHeader>
                <SheetTitle>Filter Products</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-6">
                <div>
                    <h4 className="font-semibold mb-2">By Party</h4>
                    <ScrollArea className="h-48 border rounded-md">
                        <div className="p-2">
                        <SheetCheckboxItem
                          checked={partyFilterValue.length === uniquePartyNames.length}
                          onCheckedChange={(checked) => setPartyFilter(checked ? uniquePartyNames : [])}
                        >
                          Select All
                        </SheetCheckboxItem>
                        <Separator className="my-1" />
                        {uniquePartyNames.map(party => (
                            <SheetCheckboxItem
                                key={party}
                                checked={partyFilterValue.includes(party)}
                                onCheckedChange={(checked) => {
                                    setPartyFilter(current => 
                                        checked ? [...current, party] : current.filter(p => p !== party)
                                    );
                                }}
                            >
                                {party}
                            </SheetCheckboxItem>
                        ))}
                        </div>
                    </ScrollArea>
                </div>
                <div>
                    <h4 className="font-semibold mb-2">By First Letter</h4>
                     <ScrollArea className="h-48 border rounded-md">
                        <div className="p-2">
                        <SheetCheckboxItem
                            checked={alphabetFilterValue.length === uniqueFirstLetters.length}
                            onCheckedChange={(checked) => setAlphabetFilter(checked ? uniqueFirstLetters : [])}
                        >
                            Select All
                        </SheetCheckboxItem>
                        <Separator className="my-1"/>
                        {uniqueFirstLetters.map(letter => (
                            <SheetCheckboxItem
                                key={letter}
                                checked={alphabetFilterValue.includes(letter)}
                                onCheckedChange={(checked) => {
                                    setAlphabetFilter(current => 
                                        checked ? [...current, letter] : current.filter(l => l !== letter)
                                    );
                                }}
                            >
                                {letter}
                            </SheetCheckboxItem>
                        ))}
                        </div>
                    </ScrollArea>
                </div>
                 <Button variant="ghost" onClick={resetFilters} className="w-full">
                    <RotateCcw className="mr-2 h-4 w-4" /> Clear All Filters
                </Button>
            </div>
             <SheetClose asChild>
                <Button className="w-full">Done</Button>
            </SheetClose>
        </SheetContent>
    </Sheet>
  );

  return (
    <>
      <div className="printable-area">
        <Card>
            <CardHeader className='no-print'>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                <CardTitle>Products</CardTitle>
                <CardDescription>Manage your products and their rates.</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap no-print">
                <Input
                    placeholder="Filter products..."
                    value={globalFilterValue}
                    onChange={(event) => setGlobalFilter(event.target.value)}
                    className="max-w-xs"
                />
                
                {viewMode === 'card' && (
                   <MobileFilterSheet />
                )}


                 <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                             <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}>
                                {viewMode === 'table' ? <LayoutGrid className="h-5 w-5" /> : <List className="h-5 w-5" />}
                             </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Switch to {viewMode === 'table' ? 'Card' : 'Table'} View</p>
                        </TooltipContent>
                    </Tooltip>
                 </TooltipProvider>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleGoogleApiAction('import')}>
                            <Download className="mr-2 h-4 w-4" /> Import from Sheet
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => handleGoogleApiAction('export')}>
                            <Upload className="mr-2 h-4 w-4" /> Export to Sheet
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                
                { user && 
                    <Button onClick={() => setIsBatchAddOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Products
                    </Button>
                }
                </div>
            </div>
            </CardHeader>
            <CardContent>

             {viewMode === 'card' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredData.length > 0 ? filteredData.map(product => {
                    const isOpen = openCollapsibles.has(product.id);
                    const latestRate = product.rates[0];
                    const finalRate = latestRate ? latestRate.rate * (1 + latestRate.gst / 100) : 0;

                    return (
                      <Card key={product.id} className="flex flex-col">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <CardDescription>{product.partyName}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-4">
                            <div className="flex justify-between items-baseline">
                                <span className="text-sm text-muted-foreground">Final Rate</span>
                                <span className="text-2xl font-bold">{formatCurrency(finalRate)}</span>
                            </div>
                             <div className="text-sm text-muted-foreground space-y-1">
                                <div className="flex justify-between">
                                    <span>Base Rate: {formatCurrency(latestRate.rate)}</span>
                                    <span>GST: {latestRate.gst}%</span>
                                </div>
                                 <div className="flex justify-between">
                                    <span>Unit: {product.unit}</span>
                                    <span>Bill: {format(safeToDate(latestRate.billDate), 'dd/MM/yy')}</span>
                                </div>
                             </div>
                             
                            {product.rates.length > 1 && (
                                <>
                                <Separator />
                                <div className='space-y-2'>
                                    <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => table.options.meta?.toggleCollapsible(product.id)}>
                                        <ChevronDown className={cn("mr-2 h-4 w-4 transition-transform", isOpen && "rotate-180" )}/>
                                        View Rate History ({product.rates.length -1})
                                    </Button>
                                    {isOpen && (
                                        <div className='space-y-2 text-xs'>
                                            {product.rates.slice(1).map(rate => (
                                                <div key={rate.id} className="flex justify-between items-start p-2 rounded-md bg-muted/50">
                                                    <div className="flex-grow">
                                                        <p className="font-semibold">{formatCurrency(rate.rate * (1 + rate.gst/100))}</p>
                                                        <div className="text-muted-foreground">
                                                            <p>Base: {formatCurrency(rate.rate)} | GST: {rate.gst}%</p>
                                                            <p>{format(safeToDate(rate.billDate), 'dd MMM yyyy')}</p>
                                                        </div>
                                                    </div>
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setDeletingRateInfo({product, rate})}>
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Delete this rate</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                </>
                            )}
                        </CardContent>
                        <div className="p-4 pt-0 mt-auto no-print">
                            <Separator className="mb-4" />
                            <div className="flex justify-center gap-1">
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => setAddingRateToProduct(product)}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Rate
                                </Button>
                                <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingProduct(product)}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="destructive" size="sm" className="flex-1"><Trash2 className="mr-2 h-4 w-4" /> Delete</Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                         <DropdownMenuItem className="text-orange-600 focus:text-orange-600" onClick={() => {
                                            if (product.rates.length > 1) {
                                                setDeletingRateInfo({ product, rate: product.rates[0] as Rate });
                                            } else {
                                                setDeletingProduct(product);
                                            }
                                         }}>
                                            <Trash2 className="mr-2 h-4 w-4" /> {product.rates.length > 1 ? 'Delete Latest Rate' : 'Delete Product'}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeletingProduct(product)}>
                                            <XCircle className="mr-2 h-4 w-4" /> Delete Product & History
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                      </Card>
                    )
                  }) : (
                     <div className="col-span-full h-24 text-center flex items-center justify-center">
                        No products found. Adjust your filters or add a product to get started.
                    </div>
                  )}
                </div>
            ) : (
                <div ref={tableContainerRef} className="rounded-md border relative overflow-auto" style={{ height: '60vh' }}>
                    <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                            return (
                                <TableHead key={header.id} style={{ width: header.getSize() }}>
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
                                className={cn(
                                    "transition-colors duration-200",
                                    hasHistory && "cursor-pointer hover:bg-muted/50"
                                )}
                                onClick={() => hasHistory && table.options.meta?.toggleCollapsible(row.original.id)}
                                data-index={virtualRow.index}
                                ref={node => rowVirtualizer.measureElement(node)}
                                >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id} className='whitespace-nowrap'>
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
                                    <TableRow key={`${row.original.id}-${rate.id}`} className="bg-muted/30 hover:bg-muted/60">
                                    <TableCell className='whitespace-nowrap'></TableCell>
                                    <TableCell className='whitespace-nowrap'></TableCell>
                                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                        {format(safeToDate(rate.createdAt), 'dd/MM/yy, h:mm a')}
                                    </TableCell>
                                    <TableCell className="text-right font-medium whitespace-nowrap">{formatCurrency(rate.rate as number)}</TableCell>
                                    <TableCell className='whitespace-nowrap'>{row.original.unit}</TableCell>
                                    <TableCell className='text-center whitespace-nowrap'>{rate.gst}%</TableCell>
                                    <TableCell className="text-right font-bold whitespace-nowrap">{formatCurrency(finalRate)}</TableCell>
                                    <TableCell className='whitespace-nowrap'>{row.original.partyName}</TableCell>
                                    <TableCell className='whitespace-nowrap'>{rate.pageNo}</TableCell>
                                    <TableCell className='whitespace-nowrap'>{format(safeToDate(rate.billDate), 'dd/MM/yy')}</TableCell>
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
            )}

            </CardContent>
      </Card>
    </div>
    
        {editingProduct && (
          <ProductFormDialog
            product={editingProduct}
            isOpen={!!editingProduct}
            setIsOpen={(isOpen) => !isOpen && setEditingProduct(null)}
          />
        )}
        <BatchAddProductDialog 
            isOpen={isBatchAddOpen}
            setIsOpen={setIsBatchAddOpen}
        />

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
      
    </>
  );
}

    