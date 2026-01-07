import { z } from "zod";

export const units = ['kg', 'piece', 'liter', 'meter', 'dozen'] as const;
export const categories = ['Grocery', 'Electronics', 'Hardware', 'Textiles', 'Stationery', 'Other'] as const;

export const productSchema = z.object({
  name: z.string().min(3, { message: "Product name must be at least 3 characters." }),
  unit: z.enum(units),
  gst: z.coerce.number().min(0, { message: "GST must be a positive number." }),
  partyName: z.string().min(3, { message: "Party name must be at least 3 characters." }),
  pageNumber: z.coerce.number().int().min(1, { message: "Page number must be at least 1." }),
  billDate: z.date(),
  category: z.enum(categories),
  initialRate: z.coerce.number().min(0, { message: "Rate must be a positive number." }),
});

export type ProductSchema = z.infer<typeof productSchema>;

export type Rate = {
  date: Date;
  rate: number;
};

export type Product = {
  id: string;
  name: string;
  unit: typeof units[number];
  gst: number;
  partyName: string;
  pageNumber: number;
  billDate: Date;
  category: typeof categories[number];
  rateHistory: Rate[];
};
