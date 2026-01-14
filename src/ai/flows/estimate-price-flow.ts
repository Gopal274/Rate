'use server';
/**
 * @fileOverview An AI flow to estimate the future price of a product based on its history.
 *
 * - estimatePrice - A function that handles the price estimation process.
 * - EstimatePriceInput - The input type for the estimatePrice function.
 * - EstimatePriceOutput - The return type for the estimatePrice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const HistoricalRateSchema = z.object({
  rate: z.number().describe('The price of the product at a point in time.'),
  gst: z.number().describe('The GST percentage at that time.'),
  billDate: z.string().describe('The date of the price recording (ISO 8601 format).'),
});

export const EstimatePriceInputSchema = z.object({
  productName: z.string().describe('The name of the product being analyzed.'),
  historicalRates: z
    .array(HistoricalRateSchema)
    .describe('An array of historical price points for the product, sorted from most recent to oldest.'),
});
export type EstimatePriceInput = z.infer<typeof EstimatePriceInputSchema>;

export const EstimatePriceOutputSchema = z.object({
  estimatedPrice: z.number().describe('The estimated next final price for the product, including GST.'),
  reasoning: z
    .string()
    .describe('A brief, one or two-sentence explanation for the estimated price, noting any trends or patterns observed.'),
});
export type EstimatePriceOutput = z.infer<typeof EstimatePriceOutputSchema>;

export async function estimatePrice(input: EstimatePriceInput): Promise<EstimatePriceOutput> {
  return estimatePriceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'estimatePricePrompt',
  input: {schema: EstimatePriceInputSchema},
  output: {schema: EstimatePriceOutputSchema},
  prompt: `You are a financial analyst specializing in price forecasting for retail products.
Your task is to predict the next final price (including GST) for a given product based on its historical price data.

Analyze the provided historical rates for the product: '{{productName}}'.
The data is sorted from most recent to oldest.

{{#each historicalRates}}
- Date: {{billDate}}, Base Rate: {{rate}}, GST: {{gst}}%
{{/each}}

Identify any trends, seasonality, or patterns in the price history. Based on your analysis, provide a single numerical estimate for the next final price.
Also, provide a concise, one or two-sentence reasoning for your prediction. Do not provide a long analysis.
`,
});

const estimatePriceFlow = ai.defineFlow(
  {
    name: 'estimatePriceFlow',
    inputSchema: EstimatePriceInputSchema,
    outputSchema: EstimatePriceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
