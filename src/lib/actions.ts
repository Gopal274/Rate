
'use server';

import { revalidatePath } from 'next/cache';
import {
  addProduct,
  updateProduct,
  deleteProduct as removeProduct,
  updateProductRates,
  getProductById,
} from './data';
import type { Product, Rate } from './types';
import { summarizeRateTrends } from '@/ai/flows/summarize-rate-trends';

export async function addProductAction(productData: Omit<Product, 'id' | 'rateHistory'> & { initialRate: number }) {
  try {
    addProduct(productData);
    revalidatePath('/');
    return { success: true, message: 'Product added successfully.' };
  } catch (error) {
    return { success: false, message: 'Failed to add product.' };
  }
}

export async function updateProductAction(productId: string, productData: Partial<Omit<Product, 'id' | 'rateHistory'>>) {
  try {
    updateProduct(productId, productData);
    revalidatePath('/');
    return { success: true, message: 'Product updated successfully.' };
  } catch (error) {
    return { success: false, message: 'Failed to update product.' };
  }
}

export async function deleteProductAction(productId: string) {
  try {
    removeProduct(productId);
    revalidatePath('/');
    return { success: true, message: 'Product deleted successfully.' };
  } catch (error) {
    return { success: false, message: 'Failed to delete product.' };
  }
}

export async function addRateAction(productId: string, newRate: Rate) {
  try {
    const product = await getProductById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    const updatedRates = [...product.rateHistory, newRate];
    updateProductRates(productId, updatedRates);
    revalidatePath('/');
    return { success: true, message: 'Rate added successfully.' };
  } catch (error) {
    return { success: false, message: 'Failed to add rate.' };
  }
}

export async function getRateSummaryAction(productId: string) {
  try {
    const product = await getProductById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    if (product.rateHistory.length < 2) {
      return { summary: "Not enough data to generate a summary.", outliers: [], prediction: "At least two rates are needed for a prediction." };
    }

    const summary = await summarizeRateTrends({
      productName: product.name,
      rateHistory: product.rateHistory.map(r => ({ ...r, date: r.date.toISOString() })),
    });
    return summary;
  } catch (error) {
    console.error('AI summary failed:', error);
    return { error: 'Failed to generate summary.' };
  }
}
