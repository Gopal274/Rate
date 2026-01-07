import { z } from "zod";

export const units = ['kg', 'piece', 'liter', 'meter', 'dozen'] as const;
export const categories = ['Grocery', 'Electronics', 'Hardware', 'Textiles', 'Stationery', 'Other'] as const;

// This schema is used for the form and includes the initial rate
export const productSchema = z.object({
  name: z.string().min(3, { message: "Product name must be at least 3 characters." }),
  unit: z.enum(units),
  gst: z.coerce.number().min(0, { message: "GST must be a positive number." }),
  partyName: z.string().min(3, { message: "Party name must be at least 3 characters." }),
  pageNo: z.coerce.number().int().min(1, { message: "Page number must be at least 1." }),
  billDate: z.date({
    required_error: "A bill date is required.",
  }),
  category: z.enum(categories),
  // The initial rate is only required when creating a new product
  rate: z.coerce.number().min(0.01, { message: "Rate must be a positive number." }),
});

export type ProductSchema = z.infer<typeof productSchema>;


// This schema is used for updating a product's core details (NOT rate/gst)
export const updateProductSchema = z.object({
  name: z.string().min(3, { message: "Product name must be at least 3 characters." }),
  unit: z.enum(units),
  partyName: z.string().min(3, { message: "Party name must be at least 3 characters." }),
  category: z.enum(categories),
  // pageNo and billDate are updated when a new rate is added
  pageNo: z.coerce.number().int().min(1, { message: "Page number must be at least 1." }),
   billDate: z.date({
    required_error: "A bill date is required.",
  }),
  // GST is updated via the add rate dialog
  gst: z.coerce.number().min(0, { message: "GST must be a positive number." }),
});

export type UpdateProductSchema = z.infer<typeof updateProductSchema>;


// This is the shape of the data in the database
export type Product = {
  id: string;
  name: string;
  unit: typeof units[number];
  gst: number;
  partyName: string;
  pageNo: number;
  billDate: Date; // Should be a Date object on the client
  category: typeof categories[number];
};

export type Rate = {
  id: string;
  rate: number;
  createdAt: Date; // Should be a Date object on the client
};
