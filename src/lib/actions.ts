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
import { Readable } from 'stream';

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


function convertToCsv(data: ProductWithRates[]): string {
    if (data.length === 0) {
        return "";
    }

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
    const csvRows = [headers.join(',')];

    for (const product of data) {
        const latestRate = product.rates[0];
        if (!latestRate) continue;

        const finalRate = latestRate.rate * (1 + latestRate.gst / 100);
        const billDate = new Date(latestRate.billDate).toLocaleDateString('en-IN');

        const values = [
            `"${product.name.replace(/"/g, '""')}"`,
            latestRate.rate,
            product.unit,
            latestRate.gst,
            finalRate.toFixed(2),
            `"${product.partyName.replace(/"/g, '""')}"`,
            latestRate.pageNo,
            billDate,
            product.category
        ];
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
}


export async function saveToDriveAction(accessToken: string, data: ProductWithRates[]) {
    if (!accessToken) {
        return { success: false, message: 'Authentication token is missing.' };
    }

    try {
        const oAuth2Client = new OAuth2Client();
        oAuth2Client.setCredentials({ access_token: accessToken });

        const drive = google.drive({ version: 'v3', auth: oAuth2Client });
        
        const csvContent = convertToCsv(data);
        if (!csvContent) {
            return { success: false, message: 'No data to save.' };
        }
        
        const fileName = `rate-record-${new Date().toISOString().split('T')[0]}.csv`;

        const fileMetadata = {
            name: fileName,
            mimeType: 'text/csv',
        };

        const media = {
            mimeType: 'text/csv',
            body: Readable.from(csvContent),
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id,webViewLink',
        });
        
        if (response.status === 200 && response.data.webViewLink) {
             return { success: true, message: `File saved to Google Drive!`, link: response.data.webViewLink };
        } else {
             throw new Error('Failed to create file in Google Drive.');
        }

    } catch (error: any) {
        console.error('saveToDriveAction Error:', error);
        return { success: false, message: error.message || 'An error occurred while saving to Google Drive.' };
    }
}
