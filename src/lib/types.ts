
import { z } from "zod";

const billDateSchema = z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "A valid bill date is required.",
});

// This schema is used for the form and includes the initial rate
export const productSchema = z.object({
  name: z.string().min(3, { message: "Product name must be at least 3 characters." }),
  unit: z.string().min(1, { message: "Unit is required." }),
  partyName: z.string().min(3, { message: "Party name must be at least 3 characters." }),
  // The initial rate details are required when creating a new product
  rate: z.coerce.number().min(0.01, { message: "Rate must be a positive number." }),
  gst: z.coerce.number().min(0, { message: "GST must be a positive number." }),
  pageNo: z.coerce.number().int().min(1, { message: "Page number must be at least 1." }),
  billDate: billDateSchema,
});

export type ProductSchema = z.infer<typeof productSchema>;


// This schema is used for updating a product's core details AND its latest rate
export const updateProductSchema = z.object({
  name: z.string().min(3, { message: "Product name must be at least 3 characters." }),
  unit: z.string().min(1, { message: "Unit is required." }),
  partyName: z.string().min(3, { message: "Party name must be at least 3 characters." }),
  // The latest rate details are also updatable
  rate: z.coerce.number().min(0.01, { message: "Rate must be a positive number." }),
  gst: z.coerce.number().min(0, { message: "GST must be a positive number." }),
  pageNo: z.coerce.number().int().min(1, { message: "Page number must be at least 1." }),
  billDate: billDateSchema,
});

export type UpdateProductSchema = z.infer<typeof updateProductSchema>;

// Schema for a single product within the batch form
const batchProductEntrySchema = z.object({
    name: z.string().min(3, "Name must be at least 3 characters."),
    unit: z.string().min(1, "Unit is required."),
    rate: z.coerce.number().min(0.01, "Base rate is required."),
    gst: z.coerce.number().min(0, "GST is required."),
    finalRate: z.coerce.number().min(0.01, "Final rate is required."),
});

// Schema for the entire batch product form
export const batchProductSchema = z.object({
    partyName: z.string().min(3, "Party name is required."),
    billDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: "A valid bill date is required." }),
    pageNo: z.coerce.number().int().min(1, "Page number is required."),
    products: z.array(batchProductEntrySchema).min(1, "At least one product must be added."),
});

export type BatchProductSchema = z.infer<typeof batchProductSchema>;


// --- Reconciliation Schemas ---
const transactionSchema = z.object({
  date: z.string().describe('Transaction date (YYYY-MM-DD)'),
  description: z.string().describe('Description or bill number'),
  amount: z.number().describe('Transaction amount'),
});

export const reconciliationDataSchema = z.object({
  matches: z.array(transactionSchema).describe('Transactions found in both ledgers.'),
  partyADiscrepancies: z.array(transactionSchema).describe("Transactions present in Party A's ledger but missing from Party B's."),
  partyBDiscrepancies: z.array(transactionSchema).describe("Transactions present in Party B's ledger but missing from Party A's."),
});

export type ReconciliationData = z.infer<typeof reconciliationDataSchema>;


// This is the shape of the data in the database
export type Product = {
  id: string;
  name: string;
  unit: string;
  partyName: string;
};

export type Rate = {
  id: string;
  rate: number;
  gst: number;
  pageNo: number;
  billDate: Date | string;
  createdAt: Date | string; 
};

export type ProductWithRates = Product & { rates: Rate[] };
