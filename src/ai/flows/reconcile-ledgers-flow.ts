
'use server';
/**
 * @fileOverview An AI flow to reconcile two ledger PDFs and output structured JSON.
 *
 * - reconcileLedgers - A function that handles the ledger reconciliation process.
 * - ReconcileLedgersInput - The input type for the reconcileLedgers function.
 * - ReconcileLedgersOutput - The return type for the reconcileLedgers function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { ReconciliationData } from '@/lib/types';
import { reconciliationDataSchema } from '@/lib/types';

// Schema for the main flow
const ReconcileLedgersInputSchema = z.object({
  partyALedgerPdf: z.string().describe("A ledger PDF from Party A, as a data URI."),
  partyBLedgerPdf: z.string().describe("A ledger PDF from Party B, as a data URI."),
});
export type ReconcileLedgersInput = z.infer<typeof ReconcileLedgersInputSchema>;

// The output is now the structured JSON data itself.
const ReconcileLedgersOutputSchema = reconciliationDataSchema;
export type ReconcileLedgersOutput = z.infer<typeof ReconcileLedgersOutputSchema>;

// This is the prompt that instructs the AI on how to analyze the PDFs and what format to return the data in.
// By defining a clear output schema, we are doing "structured prompting".
const reconcilePrompt = ai.definePrompt({
    name: 'reconcilePrompt',
    input: { schema: ReconcileLedgersInputSchema },
    output: { schema: ReconcileLedgersOutputSchema },
    prompt: `You are an expert accountant. Your task is to reconcile two ledgers from Party A and Party B.
      
Carefully analyze the transactions in both PDF documents provided. A transaction is defined by its date, description/bill number, and amount. A match requires all three fields to be identical.

Your output MUST be a JSON object that strictly follows this schema:
- "matches": An array of transactions found in both ledgers.
- "partyADiscrepancies": An array of transactions present in Party A's ledger but missing from Party B's.
- "partyBDiscrepancies": An array of transactions present in Party B's ledger but missing from Party A's.

A transaction object should have "date" (YYYY-MM-DD), "description", and "amount".
Do not output any other text or explanation. Only the JSON object.

Party A Ledger:
{{media url=partyALedgerPdf}}

Party B Ledger:
{{media url=partyBLedgerPdf}}
`,
});


// The main flow definition
const reconcileLedgersFlow = ai.defineFlow(
  {
    name: 'reconcileLedgersFlow',
    inputSchema: ReconcileLedgersInputSchema,
    outputSchema: ReconcileLedgersOutputSchema,
  },
  async (input) => {
    // The flow now directly calls the structured prompt.
    const { output } = await reconcilePrompt(input);
    if (!output) {
      throw new Error("The AI failed to generate the structured reconciliation data.");
    }
    // It returns the JSON data.
    return output;
  }
);

// This wrapper is what the client calls.
export async function reconcileLedgers(input: ReconcileLedgersInput): Promise<ReconcileLedgersOutput> {
  return reconcileLedgersFlow(input);
}
