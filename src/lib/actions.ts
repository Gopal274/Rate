'use server';

import { revalidatePath } from 'next/cache';
import {
  addProduct as addProductToDb,
  updateProduct as updateProductInDb,
  deleteProduct as deleteProductFromDb,
  addRate as addRateToDb,
  deleteRate as deleteRateFromDb,
  getProductRates as getProductRatesFromDb,
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
    return { success: true, message: 'Product added successfully.', product, rate };
  } catch (error) {
    console.error("addProductAction Error:", error);
    const message = error instanceof Error ? error.message : 'Failed to add product.';
    return { success: false, message };
  }
}

export async function addRateAction(productId: string, rate: number, billDate: Date, pageNo: number, gst: number) {
    try {
        const newRate = await addRateToDb(productId, rate, billDate, pageNo, gst);
        revalidatePath('/');
        return { success: true, message: 'Rate added successfully.', rate: newRate };
    } catch (error) {
        console.error("addRateAction Error:", error);
        const message = error instanceof Error ? error.message : 'Failed to add rate.';
        return { success: false, message };
    }
}


export async function updateProductAction(productId: string, productData: UpdateProductSchema) {
  try {
    await updateProductInDb(productId, productData);
    revalidatePath('/');
    return { success: true, message: 'Product updated successfully.' };
  } catch (error) {
    console.error("updateProductAction Error:", error);
    const message = error instanceof Error ? error.message : 'Failed to update product.';
    return { success: false, message };
  }
}

export async function deleteProductAction(productId: string) {
  try {
    await deleteProductFromDb(productId);
    revalidatePath('/');
    return { success: true, message: 'Product deleted successfully.' };
  } catch (error) {
    console.error("deleteProductAction Error:", error);
    const message = error instanceof Error ? error.message : 'Failed to delete product.';
    return { success: false, message };
  }
}

export async function deleteRateAction(productId: string, rateId: string) {
  try {
    await deleteRateFromDb(productId, rateId);
    revalidatePath('/');
    return { success: true, message: 'Rate deleted successfully.' };
  } catch (error) {
    console.error("deleteRateAction Error:", error);
    const message = error instanceof Error ? error.message : 'Failed to delete rate.';
    return { success: false, message };
  }
}

export async function getProductRatesAction(productId: string): Promise<Rate[]> {
    try {
        return await getProductRatesFromDb(productId);
    } catch(error) {
        console.error("getProductRatesAction Error:", error);
        return [];
    }
}


function convertDataForSheet(data: ProductWithRates[]): (string | number | null)[][] {
    const headers = [
        'Product Name', 
        'Rate', 
        'Unit', 
        'GST %', 
        'Final Rate', 
        'Party Name', 
        'Page No', 
        'Bill Date', 
        'Category'
    ];
    
    const rows = data.map(product => {
        const latestRate = product.rates[0];
        if (!latestRate) return null; // Skip products with no rates

        const finalRate = latestRate.rate * (1 + latestRate.gst / 100);
        // Format date as YYYY-MM-DD for Sheets to recognize it as a date
        const billDate = new Date(latestRate.billDate).toISOString().split('T')[0]; 

        return [
            product.name,
            latestRate.rate,
            product.unit,
            latestRate.gst,
            finalRate,
            product.partyName,
            latestRate.pageNo,
            billDate,
            product.category
        ];
    }).filter((row): row is (string | number)[] => row !== null);

    return [headers, ...rows];
}


async function findOrCreateSheet(drive: any, sheets: any): Promise<{ spreadsheetId: string, spreadsheetUrl: string }> {
    // 1. Search for the file by name
    const searchResponse = await drive.files.list({
        q: `name='${SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
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

export async function syncToGoogleSheetAction(accessToken: string, data: ProductWithRates[]) {
    if (!accessToken) {
        return { success: false, message: 'Authentication token is missing.' };
    }

    try {
        const oAuth2Client = new OAuth2Client();
        oAuth2Client.setCredentials({ access_token: accessToken });

        const drive = google.drive({ version: 'v3', auth: oAuth2Client });
        const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
        
        // Find or create the target spreadsheet
        const { spreadsheetId, spreadsheetUrl } = await findOrCreateSheet(drive, sheets);
        
        // Convert data to sheet format
        const values = convertDataForSheet(data);

        // Clear the existing data
        await sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: 'Sheet1', // Assumes data is on the default 'Sheet1'
        });

        // Write the new data
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'Sheet1',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: values,
            },
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
