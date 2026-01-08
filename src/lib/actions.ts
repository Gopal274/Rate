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
import type { Rate, UpdateProductSchema } from './types';
import { productSchema } from './types';
import { z } from 'zod';


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
