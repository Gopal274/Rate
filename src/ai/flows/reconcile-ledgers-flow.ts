
'use server';
/**
 * @fileOverview An AI flow to reconcile two ledger PDFs and output structured JSON.
 *
 * - reconcileLedgers - A function that handles the ledger reconciliation process.
 * - ReconcileLedgersInput - The input type for the reconcileLedgers function.
 * - ReconciliationData - The final JSON data structure with matches, discrepancies, and a summary.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { ReconciliationData } from '@/lib/types';
import { reconciliationDataSchema } from '@/lib/types';

// Schema for the main flow input
const ReconcileLedgersInputSchema = z.object({
  partyALedgerPdf: z.string().describe("A ledger PDF from Party A, as a data URI."),
  partyBLedgerPdf: z.string().describe("A ledger PDF from Party B, as a data URI."),
});
export type ReconcileLedgersInput = z.infer<typeof ReconcileLedgersInputSchema>;

const reconcilePrompt = `You are an expert accountant. Your task is to reconcile two ledgers from Party A and Party B.

Your goal is to provide a final JSON object with the results.

Analyze everything and then you MUST provide a final JSON object. This object must contain:
1.  A "summary" (string): A brief, one-sentence summary of the findings (e.g., "Found 48 matches, 2 discrepancies in Party A's ledger, and 3 in Party B's ledger.").
2.  "matches": An array of transactions found in both ledgers.
3.  "partyADiscrepancies": An array of transactions present in Party A's ledger but missing from Party B's.
4.  "partyBDiscrepancies": An array of transactions present in Party B's ledger but missing from Party A's.

A transaction object should have "date" (YYYY-MM-DD), "description", and "amount".
Do not output any other text or explanation in the final JSON chunk. Your entire output must be a single JSON object.

Party A Ledger:
{{media url=partyALedgerPdf}}

Party B Ledger:
{{media url=partyBLedgerPdf}}
`;

const reconcileLedgersFlow = ai.defineFlow(
  {
    name: 'reconcileLedgersFlow',
    inputSchema: ReconcileLedgersInputSchema,
    outputSchema: reconciliationDataSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: reconcilePrompt,
      input,
      output: {
          schema: reconciliationDataSchema
      }
    });

    if (!output) {
      throw new Error("The AI failed to generate a valid reconciliation response.");
    }
    
    return output;
  }
);

// This wrapper is what the client calls.
export async function reconcileLedgers(input: ReconcileLedgersInput): Promise<ReconciliationData> {
  return reconcileLedgersFlow(input);
}
