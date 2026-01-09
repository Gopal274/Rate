
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
import type { Product, Rate, UpdateProductSchema, ProductWithRates } from './types';
import { productSchema } from './types';
import { z } from 'zod';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const SHEET_NAME = 'Rate Record Live Data';

type ProductFormData = z.infer<typeof productSchema>;

export async function addProductAction(formData: ProductFormData) {
  try {
    // The new addProductToDb function handles both product and initial rate creation
    const { product, rate } = await addProductToDb(formData);

    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true, message: 'Product added successfully.', product, rate };
  } catch (error) {
    console.error('addProductAction Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to add product.';
    return { success: false, message };
  }
}

export async function addRateAction(productId: string, rate: number, billDate: Date, pageNo: number, gst: number) {
  try {
    const newRate = await addRateToDb(productId, rate, billDate, pageNo, gst);
    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true, message: 'Rate added successfully.', rate: newRate };
  } catch (error) {
    console.error('addRateAction Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to add rate.';
    return { success: false, message };
  }
}

export async function updateProductAction(productId: string, productData: UpdateProductSchema) {
  try {
    await updateProductInDb(productId, productData);
    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true, message: 'Product updated successfully.' };
  } catch (error) {
    console.error('updateProductAction Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update product.';
    return { success: false, message };
  }
}

export async function deleteProductAction(productId: string) {
  try {
    await deleteProductFromDb(productId);
    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true, message: 'Product deleted successfully.' };
  } catch (error) {
    console.error('deleteProductAction Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete product.';
    return { success: false, message };
  }
}

export async function deleteRateAction(productId: string, rateId: string) {
  try {
    await deleteRateFromDb(productId, rateId);
    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true, message: 'Rate deleted successfully.' };
  } catch (error) {
    console.error('deleteRateAction Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete rate.';
    return { success: false, message };
  }
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
        // Convert Date objects to strings before returning to the client
        return JSON.parse(JSON.stringify(products));
    } catch (error) {
        console.error('getAllProductsWithRatesAction Error:', error);
        return [];
    }
}


function convertDataForSheet(allProductsWithRates: ProductWithRates[]): (string | number)[][] {
  const headers = [
    'Product Name', // A
    'Rate',         // B
    'Unit',         // C
    'GST %',        // D
    'Final Rate',   // E 
    'Party Name',   // F
    'Page No',      // G
    'Bill Date',    // H
    'Category',     // I
  ];

  const rows = allProductsWithRates.flatMap(product => {
    if (product.rates.length === 0) {
      return [];
    }
    return product.rates.map(rate => {
      const billDate = new Date(rate.billDate);
      const serialNumber = (billDate.getTime() - new Date('1899-12-30').getTime()) / (24 * 60 * 60 * 1000);

      return [
        product.name,      // A
        rate.rate,         // B
        product.unit,      // C
        rate.gst,          // D
        '',                // E (Final Rate placeholder for manual entry)
        product.partyName, // F
        rate.pageNo,       // G
        serialNumber,      // H
        product.category,  // I
      ];
    });
  });

  return [headers, ...rows];
}


async function findOrCreateSheet(drive: any, sheets: any): Promise<{ spreadsheetId: string, spreadsheetUrl: string }> {
  // 1. Search for the file by name
  const searchResponse = await drive.files.list({
    q: `name='${SHEET_NAME}' and mimeType='application/vnd.google-apps-spreadsheet' and trashed=false`,
    fields: 'files(id, webViewLink)',
  });

  if (searchResponse.data.files && searchResponse.data.files.length > 0) {
    const file = searchResponse.data.files[0];
    if (file.id && file.webViewLink) {
      return { spreadsheetId: file.id, spreadsheetUrl: file.webViewLink };
    }
  }

  // 2. If not found, create it
  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: SHEET_NAME,
      },
    },
    fields: 'spreadsheetId,spreadsheetUrl',
  });

  const spreadsheetId = createResponse.data.spreadsheetId;
  const spreadsheetUrl = createResponse.data.spreadsheetUrl;

  if (!spreadsheetId || !spreadsheetUrl) {
    throw new Error('Failed to create new Google Sheet.');
  }

  return { spreadsheetId, spreadsheetUrl };
}

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

    const allProductsWithRates = await getAllProductsWithRates();

    const values = convertDataForSheet(allProductsWithRates);

    // --- Clear and Write Data ---
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Sheet1',
    });

    const updateRequest = {
        spreadsheetId,
        range: 'Sheet1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: values,
        },
    };
    await sheets.spreadsheets.values.update(updateRequest);

    // --- Start of Formatting and Feature Requests ---
    const numRows = values.length;
    const numCols = values.length > 0 ? values[0].length : 0;

    const requests = [
      // 1. Bold Header Row
      {
        repeatCell: {
          range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: 'userEnteredFormat.textFormat.bold',
        }
      },
      // 2. Format Rate Column (B) as Currency
      {
        repeatCell: {
          range: { sheetId: 0, startColumnIndex: 1, endColumnIndex: 2, startRowIndex: 1 },
          cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '[$₹][#,##0.00]' } } },
          fields: 'userEnteredFormat.numberFormat'
        }
      },
       // 3. Format GST Column (D) as Percentage
      {
        repeatCell: {
            range: { sheetId: 0, startColumnIndex: 3, endColumnIndex: 4, startRowIndex: 1 },
            cell: { userEnteredFormat: { numberFormat: { type: 'PERCENT', pattern: '0.00"%"' } } },
            fields: 'userEnteredFormat.numberFormat'
        }
      },
      // 4. Format Final Rate Column (E) as Currency
      {
        repeatCell: {
          range: { sheetId: 0, startColumnIndex: 4, endColumnIndex: 5, startRowIndex: 1 },
          cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '[$₹][#,##0.00]' } } },
          fields: 'userEnteredFormat.numberFormat'
        }
      },
      // 5. Format Date Column (H)
      {
        repeatCell: {
          range: { sheetId: 0, startColumnIndex: 7, endColumnIndex: 8, startRowIndex: 1 },
          cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } } },
          fields: 'userEnteredFormat.numberFormat'
        }
      },
      // 6. Set Basic Filter
      {
        setBasicFilter: {
          filter: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: numRows, startColumnIndex: 0, endColumnIndex: numCols }
          }
        }
      },
      // 7. Auto-resize all columns
      {
        autoResizeDimensions: {
          dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: numCols }
        }
      },
    ];

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });

    // Add ARRAYFORMULA for Final Rate
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!E2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [
            ['=ARRAYFORMULA(IF(B2:B="","", B2:B + (B2:B * D2:D)))']
            ]
        }
    });


    return { success: true, message: `Data synced with Google Sheet!`, link: spreadsheetUrl };

  } catch (error: any) {
    console.error('syncToGoogleSheetAction Error:', error);
    if (error.message && (error.message.includes('API has not been used') || error.message.includes('API is disabled'))) {
      return { success: false, message: `API Permission Error: The Google Sheets API is not enabled. Please enable it in your Google Cloud project and try again.` };
    }
    return { success: false, message: error.message || 'An error occurred while syncing to Google Sheets.' };
  }
}

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
      const [name, rate, unit, gst, _finalRate, partyName, pageNo, dateSerialNumber, category] = row;
      // Important: The order here must match what importProductsAndRates expects
      return [name, partyName, category, unit, dateSerialNumber, pageNo, rate, gst];
    });

    const result = await importProductsAndRates(mappedRows);

    revalidatePath('/');
    revalidatePath('/dashboard');
    return { success: true, message: `Import complete. Added: ${result.added}, Updated: ${result.updated}, Skipped: ${result.skipped}.` };

  } catch (error: any) {
    console.error('importFromGoogleSheetAction Error:', error);
    return { success: false, message: error.message || 'An error occurred while importing from Google Sheets.' };
  }
}
