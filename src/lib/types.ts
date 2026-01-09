import { z } from "zod";

export const units = ['kg', 'piece', 'liter', 'meter', 'dozen'] as const;
export const categories = ['Grocery', 'Electronics', 'Hardware', 'Textiles', 'Stationery', 'Other'] as const;

const billDateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "A valid bill date is required.",
});

// This schema is used for the form and includes the initial rate
export const productSchema = z.object({
  name: z.string().min(3, { message: "Product name must be at least 3 characters." }),
  unit: z.enum(units),
  partyName: z.string().min(3, { message: "Party name must be at least 3 characters." }),
  category: z.enum(categories),
  // The initial rate details are required when creating a new product
  rate: z.coerce.number().min(0.01, { message: "Rate must be a positive number." }),
  gst: z.coerce.number().min(0, { message: "GST must be a positive number." }),
  pageNo: z.coerce.number().int().min(1, { message: "Page number must be at least 1." }),
  billDate: billDateSchema,
});

export type ProductSchema = z.infer<typeof productSchema>;


// This schema is used for updating a product's core details 
export const updateProductSchema = z.object({
  name: z.string().min(3, { message: "Product name must be at least 3 characters." }),
  unit: z.enum(units),
  partyName: z.string().min(3, { message: "Party name must be at least 3 characters." }),
  category: z.enum(categories),
});

export type UpdateProductSchema = z.infer<typeof updateProductSchema>;


// This is the shape of the data in the database
export type Product = {
  id: string;
  name: string;
  unit: typeof units[number];
  partyName: string;
  category: typeof categories[number];
};

export type Rate = {
  id: string;
  rate: number;
  gst: number;
  pageNo: number;
  billDate: Date;
  createdAt: Date; 
};

export type ProductWithRates = Product & { rates: Rate[] };
