
'use server';
/**
 * @fileOverview An AI flow to reconcile two ledger PDFs, stream progress, and output structured JSON.
 *
 * - reconcileLedgers - A function that handles the ledger reconciliation process.
 * - ReconcileLedgersInput - The input type for the reconcileLedgers function.
 * - ReconciliationData - The final JSON data structure with matches, discrepancies, and a summary.
 * - ReconciliationStreamChunk - The type for each chunk sent over the stream (progress or final result).
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

// Define the schema for the chunks we'll stream back to the client
const ReconciliationStreamChunkSchema = z.union([
    z.object({
        progress: z.string().describe("A real-time progress update message from the AI."),
    }),
    z.object({
        result: reconciliationDataSchema.describe("The final, structured JSON result of the reconciliation.")
    })
]);
export type ReconciliationStreamChunk = z.infer<typeof ReconciliationStreamChunkSchema>;


const reconcilePrompt = `You are an expert accountant. Your task is to reconcile two ledgers from Party A and Party B.

Your goal is to stream your progress as you work and then provide a final JSON object with the results.

First, think step-by-step and stream your progress. For each major step or finding, output a progress message. For example:
"Starting analysis of Party A's ledger..."
"Found 50 transactions in Party A's ledger."
"Now comparing with Party B's ledger."
"Match found for invoice #INV-102 for Rs. 5,000."
"Discrepancy found: Party B has an extra payment of Rs. 2,100 on Jan 15."

After analyzing everything, you MUST provide a final JSON object. This object must contain:
1.  A "summary" (string): A brief, one-sentence summary of the findings (e.g., "Found 48 matches, 2 discrepancies in Party A's ledger, and 3 in Party B's ledger.").
2.  "matches": An array of transactions found in both ledgers.
3.  "partyADiscrepancies": An array of transactions present in Party A's ledger but missing from Party B's.
4.  "partyBDiscrepancies": An array of transactions present in Party B's ledger but missing from Party A's.

A transaction object should have "date" (YYYY-MM-DD), "description", and "amount".
Do not output any other text or explanation in the final JSON chunk.

Party A Ledger:
{{media url=partyALedgerPdf}}

Party B Ledger:
{{media url=partyBLedgerPdf}}
`;

const reconcileLedgersFlow = ai.defineFlow(
  {
    name: 'reconcileLedgersFlow',
    inputSchema: ReconcileLedgersInputSchema,
    outputSchema: z.string(), // The raw output will be a stream of text
    streamSchema: ReconciliationStreamChunkSchema, // Define the schema for structured streaming
  },
  async (input, streamingCallback) => {
    
    // Use generateStream for real-time updates
    const { stream, response } = ai.generateStream({
        prompt: reconcilePrompt,
        input,
        // We use a custom parser to handle the mix of progress messages and final JSON
        parser: async (stream: AsyncIterable<string>) => {
            let finalJson = '';
            for await (const chunk of stream) {
                // Try to parse the chunk as JSON. If it's a progress update, it will fail.
                try {
                    // Check if we are potentially receiving the final JSON object
                    const trimmedChunk = chunk.trim();
                    if (trimmedChunk.startsWith('{') && trimmedChunk.endsWith('}')) {
                         const parsed = JSON.parse(trimmedChunk);
                         // Check if it matches the expected final structure
                         const validation = reconciliationDataSchema.safeParse(parsed);
                         if (validation.success) {
                            finalJson = chunk; // It's the final JSON, store it.
                         } else {
                            // It's a JSON-like object but not the final result, treat as progress
                            streamingCallback({ progress: chunk });
                         }
                    } else {
                         // Simple string, treat as progress update.
                         streamingCallback({ progress: chunk });
                    }
                } catch (e) {
                     // If parsing fails, it's a plain text progress update
                    streamingCallback({ progress: chunk });
                }
            }
             // After the stream ends, return the complete JSON object we captured
            return finalJson;
        }
    });

    // Wait for the response to complete, which includes parsing
    const result = await response;

    // Stream the final parsed result object
    if (result) {
        try {
            const finalData = JSON.parse(result);
            streamingCallback({ result: finalData });
        } catch (e) {
            console.error("Failed to parse final JSON result from stream.");
        }
    }
    
    // The flow itself doesn't need to return anything here as it's all handled by the callback
    return "Streaming complete.";
  }
);

// This wrapper is what the client calls. It now returns a stream.
export async function reconcileLedgers(input: ReconcileLedgersInput): Promise<AsyncIterable<ReconciliationStreamChunk>> {
  return reconcileLedgersFlow(input);
}

    