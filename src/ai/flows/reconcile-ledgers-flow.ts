
'use server';
/**
 * @fileOverview An AI flow to reconcile two ledger PDFs and output the results to a Google Sheet.
 *
 * - reconcileLedgers - A function that handles the ledger reconciliation process.
 * - ReconcileLedgersInput - The input type for the reconcileLedgers function.
 * - ReconcileLedgersOutput - The return type for the reconcileLedgers function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const SHEET_NAME = 'Ledger Reconciliation Report';

// Schemas for the tool input
const TransactionSchema = z.object({
  date: z.string().describe('Transaction date (YYYY-MM-DD)'),
  description: z.string().describe('Description or bill number'),
  amount: z.number().describe('Transaction amount'),
});

const ReconciliationDataSchema = z.object({
  matches: z.array(TransactionSchema).describe('Transactions found in both ledgers.'),
  partyADiscrepancies: z.array(TransactionSchema).describe("Transactions present in Party A's ledger but missing from Party B's."),
  partyBDiscrepancies: z.array(TransactionSchema).describe("Transactions present in Party B's ledger but missing from Party A's."),
});

// Tool definition for writing to Google Sheets
const writeReconciliationToSheet = ai.defineTool(
  {
    name: 'writeReconciliationToSheet',
    description: 'Creates a Google Sheet with the reconciliation results.',
    inputSchema: ReconciliationDataSchema,
    outputSchema: z.object({
      sheetUrl: z.string().describe('The URL of the created Google Sheet.'),
    }),
  },
  async (data, context) => {
    const { accessToken } = (context?.auth as { accessToken: string }) || {};
    if (!accessToken) {
      throw new Error('Google authentication is required. Access token was not provided to the tool.');
    }
    
    const oAuth2Client = new OAuth2Client();
    oAuth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });

    // 1. Create the spreadsheet
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: `${SHEET_NAME} - ${new Date().toLocaleString()}` },
        sheets: [
          { properties: { title: 'Matches' } },
          { properties: { title: 'Discrepancies (Party A)' } },
          { properties: { title: 'Discrepancies (Party B)' } },
        ],
      },
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId!;
    const sheetUrl = spreadsheet.data.spreadsheetUrl!;
    const sheetIds = {
        'Matches': spreadsheet.data.sheets![0].properties!.sheetId!,
        'Discrepancies (Party A)': spreadsheet.data.sheets![1].properties!.sheetId!,
        'Discrepancies (Party B)': spreadsheet.data.sheets![2].properties!.sheetId!,
    };

    const headers = ['Date', 'Description', 'Amount'];
    
    const formatSheetData = (transactions: z.infer<typeof TransactionSchema>[]) => [
      headers,
      ...transactions.map(t => [t.date, t.description, t.amount])
    ];

    // 2. Prepare data for each sheet
    const requests = [
      {
        range: 'Matches!A1',
        values: formatSheetData(data.matches),
      },
      {
        range: 'Discrepancies (Party A)!A1',
        values: formatSheetData(data.partyADiscrepancies),
      },
      {
        range: 'Discrepancies (Party B)!A1',
        values: formatSheetData(data.partyBDiscrepancies),
      },
    ];

    // 3. Write data to sheets
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: requests,
      },
    });
    
    // 4. Format sheets (bold header, freeze row, auto-resize)
    const formattingRequests = Object.values(sheetIds).flatMap(sheetId => ([
        { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
        { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
        { autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 3 } } },
        { repeatCell: { range: { sheetId, startColumnIndex: 2, endColumnIndex: 3, startRowIndex: 1 }, cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '[$₹] #,##0.00' } } }, fields: 'userEnteredFormat.numberFormat' } }
    ]));
    
     await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: formattingRequests },
    });


    return { sheetUrl };
  }
);


// Schema for the main flow
// The accessToken is removed from here as it will be passed in the context.
const ReconcileLedgersInputSchema = z.object({
  partyALedgerPdf: z.string().describe("A ledger PDF from Party A, as a data URI."),
  partyBLedgerPdf: z.string().describe("A ledger PDF from Party B, as a data URI."),
});
export type ReconcileLedgersInput = z.infer<typeof ReconcileLedgersInputSchema>;

const ReconcileLedgersOutputSchema = z.object({
  sheetUrl: z.string().optional(),
  error: z.string().optional(),
});
export type ReconcileLedgersOutput = z.infer<typeof ReconcileLedgersOutputSchema>;

// The main flow definition
const reconcileLedgersFlow = ai.defineFlow(
  {
    name: 'reconcileLedgersFlow',
    inputSchema: ReconcileLedgersInputSchema,
    outputSchema: ReconcileLedgersOutputSchema,
  },
  async (input) => {
    const response = await ai.generate({
      prompt: [
          {text: `You are an expert accountant. Your task is to reconcile two ledgers from Party A and Party B.
      
Carefully analyze the transactions in both PDF documents provided. A transaction is defined by its date, description/bill number, and amount. A match requires all three fields to be identical.

Once you have completed your analysis, you MUST use the "writeReconciliationToSheet" tool to output the results into a Google Sheet.

Do not summarize the results in text. The only output should be the result of calling the tool.
`},
        {media: {url: input.partyALedgerPdf}},
        {media: {url: input.partyBLedgerPdf}},
      ],
      tools: [writeReconciliationToSheet],
    });

    const toolResponse = response.toolRequests[0];
    if (toolResponse?.name === 'writeReconciliationToSheet') {
        // The auth context is automatically passed to execute() by the Genkit framework
        // when the flow is called with the context.
        const toolOutput = await toolResponse.execute();
        return { sheetUrl: toolOutput.sheetUrl };
    }
    
    return { error: 'The AI was unable to generate the Google Sheet.' };
  }
);

// This wrapper is what the client calls. It now accepts an extra 'accessToken' parameter.
export async function reconcileLedgers(input: ReconcileLedgersInput, accessToken: string): Promise<ReconcileLedgersOutput> {
  // Pass the accessToken in the `auth` property of the context object.
  // This is the correct way to provide auth context to flows and their tools.
  return reconcileLedgersFlow(input, { auth: { accessToken } });
}
