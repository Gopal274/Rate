
'use server';

import { revalidatePath } from 'next/cache';
import {
  addProduct as addProductToDb,
  updateProduct as updateProductInDb,
  deleteProduct as deleteProductFromDb,
  addRate as addRateToDb,
  deleteRate as deleteRateFromDb,
  getProductRates as getProductRatesFromDb,
  getAllProductsWithRates,
  importProductsAndRates,
} from './data';
import type { Rate, UpdateProductSchema, ProductWithRates } from './types';
import { productSchema } from './types';
import { z } from 'zod';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const SHEET_NAME = 'Rate Record Live Data';

type ProductFormData = z.infer<typeof productSchema>;


/**
 * A reusable wrapper for server actions to handle try-catch, error formatting,
 * and path revalidation.
 * @param action The server action logic to execute.
 * @param revalidatePaths The paths to revalidate on success.
 * @returns A promise that resolves with the action's result or an error object.
 */
async function handleAction<T>(
  action: () => Promise<T>,
  revalidatePaths: string[] = []
): Promise<{ success: true; data: T } | { success: false; message: string }> {
  try {
    const data = await action();
    if (revalidatePaths.length > 0) {
      revalidatePaths.forEach(path => revalidatePath(path));
    }
    return { success: true, data };
  } catch (error) {
    console.error('Action Error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message };
  }
}

const mainPaths = ['/', '/dashboard'];

/* CRUD actions using the handleAction wrapper */

export async function addProductAction(formData: ProductFormData) {
  const result = await handleAction(async () => {
    const { product, rate } = await addProductToDb(formData);
    return { product, rate, message: 'Product added successfully.' };
  }, mainPaths);

  // Remap the result to match the original expected structure.
  if (result.success) {
      return { success: true, ...result.data };
  }
  return { success: false, message: result.message };
}

export async function addRateAction(productId: string, rate: number, billDate: Date, pageNo: number, gst: number) {
  const result = await handleAction(async () => {
      const newRate = await addRateToDb(productId, rate, billDate, pageNo, gst);
      return { rate: newRate, message: 'Rate added successfully.' };
  }, mainPaths);
  
  if (result.success) {
      return { success: true, ...result.data };
  }
  return { success: false, message: result.message };
}

export async function updateProductAction(productId: string, productData: UpdateProductSchema) {
  const result = await handleAction(() => updateProductInDb(productId, productData), mainPaths);
  return result.success 
    ? { success: true, message: 'Product updated successfully.' }
    : { success: false, message: result.message };
}

export async function deleteProductAction(productId: string) {
  const result = await handleAction(() => deleteProductFromDb(productId), mainPaths);
  return result.success
    ? { success: true, message: 'Product deleted successfully.' }
    : { success: false, message: result.message };
}

export async function deleteRateAction(productId: string, rateId: string) {
  const result = await handleAction(() => deleteRateFromDb(productId, rateId), mainPaths);
  return result.success
    ? { success: true, message: 'Rate deleted successfully.' }
    : { success: false, message: result.message };
}

export async function getProductRatesAction(productId: string): Promise<Rate[]> {
  try {
    return await getProductRatesFromDb(productId);
  } catch (error) {
    console.error('getProductRatesAction Error:', error);
    return [];
  }
}

export async function getAllProductsWithRatesAction(): Promise<ProductWithRates[]> {
  try {
    const products = await getAllProductsWithRates();
    return JSON.parse(JSON.stringify(products));
  } catch (error) {
    console.error('getAllProductsWithRatesAction Error:', error);
    return [];
  }
}

/**
 * Convert in-memory product+rates to rows usable by Google Sheets.
 */
function convertDataForSheet(allProductsWithRates: ProductWithRates[]): (string | number | null)[][] {
    const headers = [
      'Product Name', 'Rate', 'Unit', 'GST %', 'Final Rate', 'Party Name',
      'Page No', 'Bill Date', 'Category',
    ];

    const excelEpoch = new Date('1899-12-30').getTime();

    const rows = allProductsWithRates.flatMap(product => {
      if (!product.rates || product.rates.length === 0) return [];
      
      return product.rates.map((rate) => {
        const billDate = rate.billDate ? new Date(rate.billDate as string) : null;
        const serialNumber = billDate ? (billDate.getTime() - excelEpoch) / (24 * 60 * 60 * 1000) : null;
        
        const rateValue = parseFloat(String(rate.rate ?? 0));
        const gstValue = parseFloat(String(rate.gst ?? 0));
        
        return [
          product.name,
          rateValue,
          product.unit,
          gstValue / 100, // Store as decimal for percentage formatting
          null, // Placeholder for formula
          product.partyName,
          rate.pageNo,
          serialNumber,
          product.category,
        ];
      });
    });

    return [headers, ...rows];
}


/**
 * Find the spreadsheet by name or create it.
 * Returns spreadsheetId & webViewLink.
 */
async function findOrCreateSheet(drive: any, sheets: any): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const escapeForQuery = (s: string) => s.replace(/'/g, "\\'");

  const searchResponse = await drive.files.list({
    q: `name='${escapeForQuery(SHEET_NAME)}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id, webViewLink)',
  });

  if (searchResponse.data.files && searchResponse.data.files.length > 0) {
    const file = searchResponse.data.files[0];
    if (file.id && file.webViewLink) {
      return { spreadsheetId: file.id, spreadsheetUrl: file.webViewLink };
    }
  }

  const createResponse = await sheets.spreadsheets.create({
    requestBody: { properties: { title: SHEET_NAME } },
    fields: 'spreadsheetId,spreadsheetUrl',
  });
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  const { spreadsheetId, spreadsheetUrl } = createResponse.data;
  if (!spreadsheetId || !spreadsheetUrl) {
    throw new Error('Failed to create new Google Sheet.');
  }

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Sync local products/rates to Google Sheets.
 */
export async function syncToGoogleSheetAction(accessToken: string) {
  if (!accessToken) {
    return { success: false, message: 'Authentication token is missing.' };
  }

  try {
    const oAuth2Client = new OAuth2Client();
    oAuth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });

    const { spreadsheetId, spreadsheetUrl } = await findOrCreateSheet(drive, sheets);

    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties(sheetId,title)',
    });

    if (!meta.data.sheets || meta.data.sheets.length === 0) {
      throw new Error('Spreadsheet has no sheets.');
    }

    const sheetId = meta.data.sheets[0].properties!.sheetId!;
    const sheetTitle = meta.data.sheets[0].properties!.title || 'Sheet1';

    const allProductsWithRates = await getAllProductsWithRates();
    const values = convertDataForSheet(allProductsWithRates);
    
    // Add formulas for the Final Rate column
    for (let i = 1; i < values.length; i++) { // Start from 1 to skip header
        const rowNum = i + 1;
        values[i][4] = `=B${rowNum} * (1 + D${rowNum})`;
    }


    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetTitle}`,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetTitle}`,
      valueInputOption: 'USER_ENTERED', // Important for formulas
      requestBody: { values },
    });
    
    // --- Add Formatting ---
    const requests = [
        // 1. Bold Header
        {
            repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true } } },
                fields: 'userEnteredFormat.textFormat.bold',
            },
        },
        // 2. Freeze Header Row
        {
            updateSheetProperties: {
                properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
                fields: 'gridProperties.frozenRowCount',
            },
        },
        // 3. Auto-resize all columns
        {
            autoResizeDimensions: {
                dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 9 },
            },
        },
        // 4. Format columns B and E as INR currency
        {
            repeatCell: {
                range: { sheetId, startColumnIndex: 1, endColumnIndex: 2, startRowIndex: 1 },
                cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '[$₹] #,##0.00' } } },
                fields: 'userEnteredFormat.numberFormat',
            },
        },
        {
            repeatCell: {
                range: { sheetId, startColumnIndex: 4, endColumnIndex: 5, startRowIndex: 1 },
                cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '[$₹] #,##0.00' } } },
                fields: 'userEnteredFormat.numberFormat',
            },
        },
        // 5. Format column D as Percentage
        {
            repeatCell: {
                range: { sheetId, startColumnIndex: 3, endColumnIndex: 4, startRowIndex: 1 },
                cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0.00%' } } },
                fields: 'userEnteredFormat.numberFormat',
            },
        },
        // 6. Format column H as Date
        {
            repeatCell: {
                range: { sheetId, startColumnIndex: 7, endColumnIndex: 8, startRowIndex: 1 },
                cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } } },
                fields: 'userEnteredFormat.numberFormat',
            },
        },
        // 7. Add filter views
        {
            setBasicFilter: {
                filter: { range: { sheetId } },
            },
        },
    ];

    if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests },
        });
    }

    return { success: true, message: `Data synced with Google Sheet!`, link: spreadsheetUrl };
  } catch (error: any) {
    console.error('syncToGoogleSheetAction Error:', error);
    if (error.message && (error.message.includes('API has not been used') || error.message.includes('API is disabled'))) {
      return { success: false, message: `API Permission Error: The Google Sheets API is not enabled. Please enable it in your Google Cloud project and try again.` };
    }
    return { success: false, message: error.message || 'An error occurred while syncing to Google Sheets.' };
  }
}

/**
 * Convert Google Sheets serial number back to Date (ISO string).
 */
function serialNumberToIso(serial: number | string | undefined | null) {
  if (serial === undefined || serial === null || serial === '') return null;
  const n = Number(serial);
  if (Number.isNaN(n)) return null;
  const excelEpoch = new Date('1899-12-30').getTime();
  const date = new Date(Math.round(n * 24 * 60 * 60 * 1000) + excelEpoch);
  return date.toISOString();
}

/**
 * Import products & rates from the Google Sheet.
 */
export async function importFromGoogleSheetAction(accessToken: string) {
  if (!accessToken) {
    return { success: false, message: 'Authentication token is missing.' };
  }

  try {
    const oAuth2Client = new OAuth2Client();
    oAuth2Client.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: oAuth2Client });
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });

    const { spreadsheetId } = await findOrCreateSheet(drive, sheets);

    const sheetDataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:I',
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER',
    });

    const rows = sheetDataResponse.data.values;
    if (!rows || rows.length < 2) {
      return { success: true, message: 'Sheet is empty or only has a header. Nothing to import.' };
    }

    const dataRows = rows.slice(1);

    const mappedRows = dataRows.map(row => {
      const [name, rate, unit, gstRaw, _finalRate, partyName, pageNo, dateSerialNumber, category] = row;
      const billDateISO = serialNumberToIso(dateSerialNumber) || '';
      
      let gstPercent = 0;
      if (gstRaw !== '' && gstRaw !== undefined && gstRaw !== null) {
        const g = Number(gstRaw);
        if (!Number.isNaN(g)) {
           // If the value is a decimal like 0.05, convert to 5. Otherwise, use as is.
          gstPercent = g < 1 ? g * 100 : g;
        }
      }
      return [name ?? '', partyName ?? '', category ?? '', unit ?? '', billDateISO, pageNo ?? '', rate ?? '', gstPercent];
    });

    const result = await importProductsAndRates(mappedRows);

    mainPaths.forEach(path => revalidatePath(path));
    return { success: true, message: `Import complete. Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped}.` };
  } catch (error: any) {
    console.error('importFromGoogleSheetAction Error:', error);
    return { success: false, message: error.message || 'An error occurred while importing from Google Sheets.' };
  }
}
