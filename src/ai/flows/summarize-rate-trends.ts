'use server';

/**
 * @fileOverview Summarizes rate trends, identifies outliers, and predicts future rates.
 *
 * - summarizeRateTrends - A function that generates a summary of rate trends, identifies outliers, and provides predictions.
 * - SummarizeRateTrendsInput - The input type for the summarizeRateTrends function.
 * - SummarizeRateTrendsOutput - The return type for the summarizeRateTrends function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeRateTrendsInputSchema = z.object({
  productName: z.string().describe('The name of the product to summarize.'),
  rateHistory: z.array(z.object({
    date: z.string().describe('The date the rate was recorded.'),
    rate: z.number().describe('The rate of the product on the given date.'),
  })).describe('The history of rates for the product.'),
});

export type SummarizeRateTrendsInput = z.infer<typeof SummarizeRateTrendsInputSchema>;

const SummarizeRateTrendsOutputSchema = z.object({
  summary: z.string().describe('A summary of the rate trends for the product.'),
  outliers: z.array(z.object({
    date: z.string().describe('The date of the outlier.'),
    rate: z.number().describe('The rate of the outlier.'),
    reason: z.string().describe('The reason why the rate is considered an outlier.'),
  })).describe('Identified outliers in the rate history.'),
  prediction: z.string().describe('A prediction of future rates for the product.'),
});

export type SummarizeRateTrendsOutput = z.infer<typeof SummarizeRateTrendsOutputSchema>;

export async function summarizeRateTrends(input: SummarizeRateTrendsInput): Promise<SummarizeRateTrendsOutput> {
  return summarizeRateTrendsFlow(input);
}

const summarizeRateTrendsPrompt = ai.definePrompt({
  name: 'summarizeRateTrendsPrompt',
  input: {schema: SummarizeRateTrendsInputSchema},
  output: {schema: SummarizeRateTrendsOutputSchema},
  prompt: `You are an expert analyst summarizing product rate trends.

  Analyze the provided rate history for the product: {{{productName}}}.

  Rate History:
  {{#each rateHistory}}
  - Date: {{{date}}}, Rate: {{{rate}}}
  {{/each}}

  Provide a summary of the rate trends, identify any outliers, and provide a prediction for future rates.

  Ensure the output is structured according to the schema descriptions. Focus on identifying key trends, significant outliers, and potential future rate movements based on the historical data.
  `,
});

const summarizeRateTrendsFlow = ai.defineFlow(
  {
    name: 'summarizeRateTrendsFlow',
    inputSchema: SummarizeRateTrendsInputSchema,
    outputSchema: SummarizeRateTrendsOutputSchema,
  },
  async input => {
    const {output} = await summarizeRateTrendsPrompt(input);
    return output!;
  }
);
