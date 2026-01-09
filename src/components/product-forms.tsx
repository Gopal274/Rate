
'use client';

import * as React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';

import {
  addProductAction,
  deleteProductAction,
  updateProductAction,
  addRateAction,
  deleteRateAction,
} from '@/lib/actions';
import { Product, Rate, ProductSchema, UpdateProductSchema, ProductWithRates, categories, productSchema, units, updateProductSchema } from '@/lib/types';
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

export function ProductFormDialog({
  product,
  isOpen,
  setIsOpen,
  children,
}: {
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


export function AddRateDialog({
  product,
  isOpen,
  setIsOpen,
}: {
  product: ProductWithRates | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}) {
    const latestRate = product?.rates[0];
    const form = useForm<AddRateSchema>({
        resolver: zodResolver(addRateSchema),
        defaultValues: {
        rate: '' as any,
        billDate: format(new Date(), 'yyyy-MM-dd'),
        pageNo: latestRate?.pageNo as number ?? 1,
        gst: latestRate?.gst as number ?? 0,
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
            pageNo: latestRateInfo?.pageNo as number | undefined,
            gst: latestRateInfo?.gst as number | undefined,
        })
    }
  }, [product, form]);

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
                Are you sure you want to delete the rate of <span className="font-semibold text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rateInfo.rate.rate as number)}</span> from <span className="font-semibold text-foreground">{format(new Date(rateInfo.rate.createdAt as string), 'dd/MM/yy')}</span>? This action cannot be undone.
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
