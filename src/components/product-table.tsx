
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
  ExternalLink,
  RotateCcw,
  Download,
  Upload,
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
    DeleteRateDialog
} from './product-forms';

type SortDirection = 'newest' | 'oldest' | 'asc' | 'desc';

const multiSelectFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
    if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) {
        return true;
    }
    const value = row.getValue(columnId);
    return Array.isArray(filterValue) && filterValue.includes(value);
};

const startsWithFilterFn: FilterFn<any> = (row, columnId, filterValue) => {
    if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) {
        return true;
    }
    const value = row.getValue(columnId) as string;
    const firstLetter = value.charAt(0).toUpperCase();
    return Array.isArray(filterValue) && filterValue.includes(firstLetter);
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
  const [columnFilters, setColumnFilters] = usePersistentState<ColumnFiltersState>('product-table-filters-v8', []);
  const [openCollapsibles, setOpenCollapsibles] = React.useState<Set<string>>(new Set());
  const [activeSort, setActiveSort] = usePersistentState<SortDirection>('product-table-sort-v2', 'newest');

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
    const partyNames = new Set(allProductsWithRates.map(p => p.partyName));
    return Array.from(partyNames).sort((a, b) => a.localeCompare(b));
  }, [allProductsWithRates]);

    const uniqueFirstLetters = React.useMemo(() => {
        const firstLetters = new Set(allProductsWithRates.map(p => p.name.charAt(0).toUpperCase()));
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
      header: ({ column }) => {
        const alphabetFilterValue = (column.getFilterValue() as string[] | undefined) ?? [];

        return (
          <div className="flex items-center gap-2">
            <span>Product Name</span>
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <ArrowUpDown className="h-4 w-4" />
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
                    onCheckedChange={(checked) => column?.setFilterValue(checked ? uniqueFirstLetters : [])}
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
                              const currentSelection = (column?.getFilterValue() as string[] | undefined) ?? [];
                              if (checked) {
                                  column?.setFilterValue([...currentSelection, letter]);
                              } else {
                                  column?.setFilterValue(currentSelection.filter(l => l !== letter));
                              }
                          }}
                          onSelect={(e) => e.preventDefault()}
                      >
                          {letter}
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
          </div>
        )
      },
      cell: ({ row }) => row.original.name,
      filterFn: startsWithFilterFn,
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

        return (
          <div className="flex items-center gap-2">
            <span>Party Name</span>
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Filter by Party</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={selectedParties.length === uniquePartyNames.length}
                  onCheckedChange={(checked) => column?.setFilterValue(checked ? uniquePartyNames : [])}
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
                      disabled={!canDeleteRate}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canDeleteRate && latestRate) {
                            setDeletingRateInfo({ product, rate: latestRate as Rate });
                        }
                      }}
                    >
                      <Trash2 className={cn("h-4 w-4", canDeleteRate ? "text-orange-600" : "text-muted-foreground/50")} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {canDeleteRate ? 'Delete Latest Rate' : 'Cannot delete the only rate'}
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
  ], [openCollapsibles, uniquePartyNames, uniqueFirstLetters, setActiveSort]);

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
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              <Input
                placeholder="Filter products..."
                value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
                onChange={(event) =>
                  table.getColumn('name')?.setFilterValue(event.target.value)
                }
                className="max-w-xs"
              />
               <Button variant="outline" size="sm" onClick={() => handleGoogleApiAction('import')}>
                  <Download className="mr-2 h-4 w-4" />
                  Import
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleGoogleApiAction('export')}>
                  <Upload className="mr-2 h-4 w-4" />
                  Export
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="no-print">
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              { user && 
                  <ProductFormDialog isOpen={isAddProductOpen} setIsOpen={setIsAddProductOpen}>
                      <Button onClick={() => setIsAddProductOpen(true)} className="w-full sm:w-auto">
                          <PlusCircle className="mr-2 h-4 w-4" /> Add Product
                      </Button>
                  </ProductFormDialog> 
              }
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div ref={tableContainerRef} className="rounded-md border relative overflow-auto print-table-view" style={{ height: '60vh' }}>
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

    