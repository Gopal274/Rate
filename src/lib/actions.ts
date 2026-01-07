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
import type { Product, Rate, ProductSchema } from './types';
import { summarizeRateTrends } from '@/ai/flows/summarize-rate-trends';

// Define a type for the product data coming from the form, excluding the rate
type ProductFormData = Omit<ProductSchema, 'rate'>;

export async function addProductAction(productData: ProductFormData, initialRate: number) {
  try {
    const newProduct = await addProductToDb({ ...productData }, initialRate);
    revalidatePath('/');
    return { success: true, message: 'Product added successfully.', product: newProduct };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add product.';
    return { success: false, message };
  }
}

export async function updateProductAction(productId: string, productData: Partial<Omit<Product, 'id'>>) {
  try {
    await updateProductInDb(productId, productData);
    revalidatePath('/');
    return { success: true, message: 'Product updated successfully.' };
  } catch (error) {
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
    const message = error instanceof Error ? error.message : 'Failed to delete product.';
    return { success: false, message };
  }
}

export async function addRateAction(productId: string, rate: number) {
  try {
    const newRate = await addRateToDb(productId, rate);
    revalidatePath('/');
    return { success: true, message: 'Rate added successfully.', rate: newRate };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add rate.';
    return { success: false, message };
  }
}

export async function deleteRateAction(productId: string, rateId: string) {
  try {
    await deleteRateFromDb(productId, rateId);
    revalidatePath('/');
    return { success: true, message: 'Rate deleted successfully.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete rate.';
    return { success: false, message };
  }
}

export async function getProductRatesAction(productId: string): Promise<Rate[]> {
    return await getProductRatesFromDb(productId);
}


export async function getRateSummaryAction(product: Product, rates: Rate[]) {
  try {
    if (rates.length < 2) {
      return { summary: "Not enough data to generate a summary.", outliers: [], prediction: "At least two rates are needed for a prediction." };
    }

    const summary = await summarizeRateTrends({
      productName: product.name,
      rateHistory: rates.map(r => ({ date: new Date(r.createdAt).toISOString(), rate: r.rate })),
    });
    return summary;
  } catch (error) {
    console.error('AI summary failed:', error);
    return { error: 'Failed to generate summary.' };
  }
}
