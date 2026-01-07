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
import type { Product, Rate, UpdateProductSchema } from './types';
import { productSchema } from './types';
import { z } from 'zod';
import { summarizeRateTrends } from '@/ai/flows/summarize-rate-trends';

type ProductFormData = z.infer<typeof productSchema>;

export async function addProductAction(formData: ProductFormData) {
  try {
    const { rate, ...productData } = formData;
    const newProduct = await addProductToDb(productData, rate);
    
    // The rate is created within the transaction, so we need a representation of it for the client
    const newRate: Rate = {
      id: '', // The ID is not immediately available on the client this way, but the data is consistent
      rate: rate,
      createdAt: new Date(),
    };

    revalidatePath('/');
    return { success: true, message: 'Product added successfully.', product: newProduct, rate: newRate };
  } catch (error) {
    console.error("addProductAction Error:", error);
    const message = error instanceof Error ? error.message : 'Failed to add product.';
    return { success: false, message };
  }
}

export async function updateProductAction(productId: string, productData: UpdateProductSchema) {
  try {
    const { newRate, ...dataToUpdate } = productData;
    let createdRate: Rate | undefined = undefined;

    if (newRate && newRate > 0) {
        // If there's a new rate, we add it. The data.ts function will handle the transaction.
        createdRate = await addRateToDb(productId, newRate);
    }
    
    // We always update the main product document with potentially new details.
    await updateProductInDb(productId, dataToUpdate);

    revalidatePath('/');
    return { success: true, message: 'Product updated successfully.', rate: createdRate };
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

export async function getRateSummaryAction(product: Product, rates: Rate[]) {
  if (rates.length < 2) {
    return { error: 'Not enough data to generate a summary. At least two rates are required.' };
  }
  try {
    const rateHistory = rates.map(r => ({
      date: r.createdAt.toISOString(),
      rate: r.rate,
    }));
    const summary = await summarizeRateTrends({
      productName: product.name,
      rateHistory,
    });
    return summary;
  } catch (e: any) {
    console.error('Error generating summary:', e);
    return { error: e.message || 'An unknown error occurred while generating the summary.' };
  }
}
