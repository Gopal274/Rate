import { z } from "zod";

export const units = ['kg', 'piece', 'liter', 'meter', 'dozen'] as const;
export const categories = ['Grocery', 'Electronics', 'Hardware', 'Textiles', 'Stationery', 'Other'] as const;

export const productSchema = z.object({
  name: z.string().min(3, { message: "Product name must be at least 3 characters." }),
  unit: z.enum(units),
  gst: z.coerce.number().min(0, { message: "GST must be a positive number." }),
  partyName: z.string().min(3, { message: "Party name must be at least 3 characters." }),
  pageNo: z.coerce.number().int().min(1, { message: "Page number must be at least 1." }),
  billDate: z.date({
    required_error: "A bill date is required.",
    invalid_type_error: "That's not a valid date!",
  }),
  category: z.enum(categories),
  rate: z.coerce.number().min(0, { message: "Rate must be a positive number." }),
});

export type ProductSchema = z.infer<typeof productSchema>;

export type Rate = {
  id?: string;
  rate: number;
  createdAt: Date; // Should be a Date object on the client
};

export type Product = {
  id: string;
  name: string;
  unit: typeof units[number];
  gst: number;
  partyName: string;
  pageNo: number;
  billDate: Date; // Should be a Date object on the client
  category: typeof categories[number];
  ownerId: string;
};
