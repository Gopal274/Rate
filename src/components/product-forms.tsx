
'use client';

import * as React from 'react';
import { z } from 'zod';
import { useForm, useFieldArray, useWatch, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';

import {
  addProductAction,
  batchAddProductsAction,
  deleteProductAction,
  updateProductAction,
  addRateAction,
  deleteRateAction,
} from '@/lib/actions';
import { Product, Rate, ProductSchema, UpdateProductSchema, ProductWithRates, productSchema, updateProductSchema, batchProductSchema, type BatchProductSchema } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
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
import { safeToDate, cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { PlusCircle, Trash2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Combobox, type ComboboxOption } from './ui/combobox';

const getInitialAddFormValues = () => {
    return {
        name: '',
        unit: 'piece',
        partyName: '',
        rate: '' as any,
        gst: '' as any,
        pageNo: '' as any,
        billDate: format(new Date(), 'yyyy-MM-dd'),
    };
};

const getInitialEditFormValues = (product: ProductWithRates) => {
    const latestRate = product.rates[0];
    return {
        name: product.name,
        unit: product.unit,
        partyName: product.partyName,
        rate: latestRate?.rate ?? ('' as any),
        gst: latestRate?.gst ?? ('' as any),
        pageNo: latestRate?.pageNo ?? ('' as any),
        billDate: latestRate ? format(safeToDate(latestRate.billDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    };
};

export function ProductFormDialog({
  product,
  isOpen,
  setIsOpen,
  partyNameOptions,
  unitOptions,
  children,
}: {
  product?: ProductWithRates; // Expect ProductWithRates for editing
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
  partyNameOptions: ComboboxOption[];
  unitOptions: ComboboxOption[];
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
      // The product should have a latest rate to be editable, so we can assert non-null
      const latestRateId = product!.rates[0]!.id;
      const result = await updateProductAction(product.id, latestRateId, values as UpdateProductSchema);
      if (result.success) {
        toast({ title: 'Success', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
    } else {
      const result = await addProductAction(values as ProductSchema);
       if (result.success) {
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
              ? "Update this product's core details and its latest rate."
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
                <FormItem className="flex flex-col">
                  <FormLabel>Party Name</FormLabel>
                  <Combobox
                    options={partyNameOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select or type party..."
                    searchPlaceholder="Search party..."
                    emptyPlaceholder="No party found. Type to create new."
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Unit</FormLabel>
                  <Combobox
                    options={unitOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select or type unit..."
                    searchPlaceholder="Search unit..."
                    emptyPlaceholder="No unit found. Type to create new."
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-2" />
            
            <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                    <FormItem><FormLabel>{isEditing ? 'Latest Rate' : 'Initial Rate'}</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g. 120.50" {...field} value={field.value ?? ''} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
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


export function AddRateDialog({
  product,
  isOpen,
  setIsOpen,
}: {
  product: ProductWithRates | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const getInitialValues = (p: ProductWithRates | null) => {
    const latestRate = p?.rates[0];
    return {
      rate: '' as any,
      billDate: format(new Date(), 'yyyy-MM-dd'),
      pageNo: latestRate?.pageNo,
      gst: latestRate?.gst,
    };
  };

  const form = useForm<AddRateSchema>({
    resolver: zodResolver(addRateSchema),
    defaultValues: getInitialValues(product),
  });

  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      form.reset(getInitialValues(product));
    }
  }, [isOpen, product, form]);

  async function onSubmit(values: AddRateSchema) {
    if (!product) return;
    setIsSubmitting(true);
    const billDate = new Date(values.billDate);
    const result = await addRateAction(product.id, values.rate, billDate, values.pageNo, values.gst);
    if (result.success && result.rate) {
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


export function DeleteProductDialog({
  product,
  isOpen,
  setIsOpen,
}: {
  product: Product | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!product) return;
    setIsDeleting(true);
    const result = await deleteProductAction(product.id);
    if (result.success) {
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

export function DeleteRateDialog({
  rateInfo,
  isOpen,
  setIsOpen,
}: {
  rateInfo: {product: Product, rate: Rate} | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = React.useState(false);

    const handleDelete = async () => {
        if (!rateInfo?.product.id || !rateInfo.rate.id) return;
        setIsDeleting(true);
        const result = await deleteRateAction(rateInfo.product.id, rateInfo.rate.id);
        if (result.success) {
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
                Are you sure you want to delete the rate of <span className="font-semibold text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rateInfo.rate.rate as number)}</span> from <span className="font-semibold text-foreground">{format(safeToDate(rateInfo.rate.createdAt), 'dd/MM/yy')}</span>? This action cannot be undone.
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

// --- Batch Add Product Form ---

const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
        const form = e.currentTarget;
        const formElements = Array.from(form.elements).filter(
            (el): el is HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement =>
                el instanceof HTMLInputElement ||
                el instanceof HTMLButtonElement ||
                el instanceof HTMLTextAreaElement
        ) as (HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement)[];

        const currentElement = document.activeElement as HTMLElement;
        const currentIndex = formElements.findIndex(el => el === currentElement);

        if (currentIndex > -1 && currentIndex < formElements.length - 1) {
            // Find the next non-disabled, visible input
            let nextIndex = currentIndex + 1;
            while(nextIndex < formElements.length) {
                const nextElement = formElements[nextIndex];
                if (nextElement && !nextElement.disabled && nextElement.offsetParent !== null) {
                    e.preventDefault();
                    nextElement.focus();
                    // If it's a text input, select its content
                    if (nextElement instanceof HTMLInputElement && nextElement.type === 'text' || nextElement.type === 'number') {
                        nextElement.select();
                    }
                    break;
                }
                nextIndex++;
            }
        }
    }
};

function ProductSubForm({ index, remove, unitOptions }: { index: number; remove: (index: number) => void; unitOptions: ComboboxOption[]; }) {
  const { control, setValue, getValues } = useFormContext<BatchProductSchema>();
  
  const rate = useWatch({ control, name: `products.${index}.rate` });
  const gst = useWatch({ control, name: `products.${index}.gst` });
  const finalRate = useWatch({ control, name: `products.${index}.finalRate` });

  const handleRateChange = (newRate: number, field: 'rate' | 'finalRate') => {
      const currentGst = getValues(`products.${index}.gst`) || 0;
      
      if (field === 'rate') {
          setValue(`products.${index}.rate`, newRate, { shouldValidate: true });
          if (currentGst >= 0) {
              const newFinalRate = newRate * (1 + currentGst / 100);
              setValue(`products.${index}.finalRate`, parseFloat(newFinalRate.toFixed(2)), { shouldValidate: true });
          }
      } else if (field === 'finalRate') {
          setValue(`products.${index}.finalRate`, newRate, { shouldValidate: true });
          if (currentGst >= 0) {
              const newBaseRate = newRate / (1 + currentGst / 100);
              setValue(`products.${index}.rate`, parseFloat(newBaseRate.toFixed(2)), { shouldValidate: true });
          }
      }
  };
  
  const handleGstChange = (newGst: number) => {
    setValue(`products.${index}.gst`, newGst, { shouldValidate: true });
    const currentRate = getValues(`products.${index}.rate`);
    if (currentRate && newGst >= 0) {
        const newFinalRate = currentRate * (1 + newGst / 100);
        setValue(`products.${index}.finalRate`, parseFloat(newFinalRate.toFixed(2)), { shouldValidate: true });
    }
  }

  return (
    <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded-md bg-muted/50">
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={() => remove(index)}
        >
            <Trash2 className="h-4 w-4" />
        </Button>

        <div className="md:col-span-3">
             <FormField
                control={control}
                name={`products.${index}.name`}
                render={({ field }) => (
                    <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input autoComplete="off" placeholder="e.g. Basmati Rice" {...field} /></FormControl><FormMessage /></FormItem>
                )}
            />
        </div>
        <FormField
            control={control}
            name={`products.${index}.rate`}
            render={({ field }) => (
                <FormItem><FormLabel>Base Rate</FormLabel><FormControl><Input autoComplete="off" type="number" step="0.01" {...field} value={field.value ?? ''} onChange={e => handleRateChange(Number(e.target.value), 'rate')} /></FormControl><FormMessage /></FormItem>
            )}
        />
        <FormField
            control={control}
            name={`products.${index}.gst`}
            render={({ field }) => (
                <FormItem><FormLabel>GST (%)</FormLabel><FormControl><Input autoComplete="off" type="number" step="0.01" {...field} value={field.value ?? ''} onChange={e => handleGstChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
            )}
        />
        <FormField
            control={control}
            name={`products.${index}.finalRate`}
            render={({ field }) => (
                <FormItem><FormLabel>Final Rate</FormLabel><FormControl><Input autoComplete="off" type="number" step="0.01" {...field} value={field.value ?? ''} onChange={e => handleRateChange(Number(e.target.value), 'finalRate')} /></FormControl><FormMessage /></FormItem>
            )}
        />
        <div className="md:col-span-3">
            <FormField
              control={control}
              name={`products.${index}.unit`}
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Unit</FormLabel>
                   <Combobox
                    options={unitOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select or type unit..."
                    searchPlaceholder="Search unit..."
                    emptyPlaceholder="No unit found. Type to create new."
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
        </div>
    </div>
  )
}

export function BatchAddProductDialog({ isOpen, setIsOpen, partyNameOptions, unitOptions }: { isOpen: boolean; setIsOpen: (open: boolean) => void; partyNameOptions: ComboboxOption[]; unitOptions: ComboboxOption[]; }) {
    const { toast } = useToast();
    const form = useForm<BatchProductSchema>({
        resolver: zodResolver(batchProductSchema),
        defaultValues: {
            partyName: '',
            pageNo: undefined,
            billDate: format(new Date(), 'yyyy-MM-dd'),
            products: [{ name: '', unit: 'piece', rate: undefined, gst: undefined, finalRate: undefined }]
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "products",
    });
    
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const onSubmit = async (data: BatchProductSchema) => {
        setIsSubmitting(true);
        const result = await batchAddProductsAction(data);
        
        if(result.success) {
            toast({ title: "Success!", description: `Successfully added ${result.count} products.` });
            setIsOpen(false);
            form.reset({
                partyName: '',
                pageNo: undefined,
                billDate: format(new Date(), 'yyyy-MM-dd'),
                products: [{ name: '', unit: 'piece', rate: undefined, gst: undefined, finalRate: undefined }]
            });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.message });
        }
        setIsSubmitting(false);
    }
    
    const handleOpenChange = (open: boolean) => {
      if(isSubmitting) return;
      setIsOpen(open);
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Add Products</DialogTitle>
                    <DialogDescription>
                        Add multiple products from a single bill quickly. Common details are shared across all products.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-6">
                        <div className="p-4 border rounded-lg space-y-4">
                           <h3 className="font-semibold text-lg text-foreground">Common Bill Details</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="partyName"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Party Name</FormLabel>
                                            <Combobox
                                                options={partyNameOptions}
                                                value={field.value}
                                                onChange={field.onChange}
                                                placeholder="Select or type party..."
                                                searchPlaceholder="Search party..."
                                                emptyPlaceholder="No party found. Type to create new."
                                            />
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="pageNo"
                                    render={({ field }) => (
                                        <FormItem><FormLabel>Page No.</FormLabel><FormControl><Input autoComplete="off" type="number" placeholder="e.g. 42" {...field} value={field.value ?? ''} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="billDate"
                                    render={({ field }) => (
                                        <FormItem><FormLabel>Bill Date</FormLabel><FormControl><Input autoComplete="off" type="date" {...field} /></FormControl><FormMessage /></FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg text-foreground">Products</h3>
                            <ScrollArea className="h-[40vh] pr-4">
                                <div className="space-y-4">
                                    {fields.map((field, index) => (
                                        <ProductSubForm key={field.id} index={index} remove={remove} unitOptions={unitOptions} />
                                    ))}
                                </div>
                            </ScrollArea>
                             <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => append({ name: '', unit: 'piece', rate: undefined, gst: undefined, finalRate: undefined })}
                            >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Product
                            </Button>
                        </div>
                        
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancel</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Products'}</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
