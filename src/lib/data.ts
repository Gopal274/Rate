
'use server';

import { 
  serverTimestamp, 
  Timestamp,
  FieldValue,
} from 'firebase-admin/firestore';

import { getFirebaseAdmin } from '@/firebase/admin';
import type { Product, Rate, ProductSchema, UpdateProductSchema, ProductWithRates } from './types';
import { categories, units } from './types';


// Helper to initialize Firebase Admin
async function getDb() {
  const { firestore } = await getFirebaseAdmin();
  return firestore;
}

const PRODUCTS_COLLECTION = 'products';
const RATES_SUBCOLLECTION = 'rates';

// Type for product data used in creation, separating product and rate details
type ProductCreationData = Omit<ProductSchema, 'rate' | 'gst' | 'pageNo' | 'billDate'>;

export const addProduct = async (formData: ProductSchema): Promise<{product: Product, rate: Rate}> => {
  const db = await getDb();
  const { name, unit, partyName, category, rate, gst, pageNo, billDate } = formData;
  const newProductRef = db.collection(PRODUCTS_COLLECTION).doc();
  
  const productData: ProductCreationData = { name, unit, partyName, category };

  const rateData = {
    rate,
    gst,
    pageNo,
    billDate: new Date(billDate),
    createdAt: serverTimestamp(),
  };

  await db.runTransaction(async (transaction) => {
    // 1. Set the main product document
    transaction.set(newProductRef, productData);

    // 2. Set the initial rate in the subcollection
    const newRateRef = newProductRef.collection(RATES_SUBCOLLECTION).doc();
    transaction.set(newRateRef, rateData);
  });

  // Return the product and rate shapes expected by the client
  return {
    product: {
        id: newProductRef.id,
        ...productData,
    },
    rate: {
        id: '', // ID is not known on client immediately but this is fine
        ...rateData,
        createdAt: new Date(), // Use client date for immediate UI update
    }
  };
};


export const updateProduct = async (productId: string, updateData: Partial<UpdateProductSchema>): Promise<void> => {
  const db = await getDb();
  const productDoc = db.collection(PRODUCTS_COLLECTION).doc(productId);
  await productDoc.update(updateData);
};

export const deleteProduct = async (productId: string): Promise<void> => {
  const db = await getDb();
  const productDocRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
  
  await db.runTransaction(async (transaction) => {
    // Get all rates for the product
    const ratesQuery = productDocRef.collection(RATES_SUBCOLLECTION);
    const ratesSnapshot = await transaction.get(ratesQuery);
    
    // Delete each rate in the transaction
    ratesSnapshot.forEach((rateDoc) => {
      transaction.delete(rateDoc.ref);
    });
    
    // Delete the product itself
    transaction.delete(productDocRef);
  });
};


export const getProductRates = async (productId: string): Promise<Rate[]> => {
  const db = await getDb();
  const ratesCol = db.collection(PRODUCTS_COLLECTION).doc(productId).collection(RATES_SUBCOLLECTION);
  const q = ratesCol.orderBy('createdAt', 'desc');
  const ratesSnapshot = await q.get();

  return ratesSnapshot.docs.map(doc => {
      const data = doc.data();
      // Safely convert Firestore Timestamp to JS Date
      const createdAt = (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date();
      const billDate = (data.billDate as Timestamp)?.toDate ? (data.billDate as Timestamp).toDate() : new Date();
      return { 
          id: doc.id, 
          rate: data.rate,
          gst: data.gst,
          pageNo: data.pageNo,
          billDate: billDate,
          createdAt: createdAt
        } as Rate
    });
};

export const addRate = async (productId: string, rate: number, billDate: Date, pageNo: number, gst: number): Promise<Rate> => {
    const db = await getDb();
    const productRef = db.collection(PRODUCTS_COLLECTION).doc(productId);
    
    const newRateData = {
        rate,
        gst,
        pageNo,
        billDate,
        createdAt: serverTimestamp()
    };
    
    const newRateRef = await productRef.collection(RATES_SUBCOLLECTION).add(newRateData);

    // We return a client-side representation. The serverTimestamp will be resolved by Firestore.
    return { id: newRateRef.id, ...newRateData, createdAt: new Date() };
};


export const deleteRate = async (productId: string, rateId: string): Promise<void> => {
  const db = await getDb();
  const rateDoc = db.collection(PRODUCTS_COLLECTION).doc(productId).collection(RATES_SUBCOLLECTION).doc(rateId);
  await rateDoc.delete();
};


export const getAllProductsWithRates = async (options?: { onlyLatestRate: boolean }): Promise<ProductWithRates[]> => {
    const db = await getDb();
    const productsCollectionRef = db.collection(PRODUCTS_COLLECTION);
    const productsSnapshot = await productsCollectionRef.get();
    
    const productsWithRates: ProductWithRates[] = [];

    for (const productDoc of productsSnapshot.docs) {
        const productData = productDoc.data() as Omit<Product, 'id'>;
        const rates = await getProductRates(productDoc.id);

        productsWithRates.push({
            id: productDoc.id,
            ...productData,
            rates: options?.onlyLatestRate ? rates.slice(0, 1) : rates,
        });
    }

    return productsWithRates;
};

// --- Import Logic ---

// Type for the data structure we'll use to check for existing products
type ProductCheckMap = {
  [key: string]: { id: string; latestRate: Rate | undefined, category: string, unit: string };
};

export async function importProductsAndRates(rows: any[][]) {
  const db = await getDb();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  // 1. Fetch all existing products and their latest rate for efficient checking
  const existingProductsData = await getAllProductsWithRates({ onlyLatestRate: true });
  const productCheckMap: ProductCheckMap = existingProductsData.reduce((acc, p) => {
    const key = `${p.name.toLowerCase()}_${p.partyName.toLowerCase()}`;
    acc[key] = { id: p.id, latestRate: p.rates[0], category: p.category, unit: p.unit };
    return acc;
  }, {} as ProductCheckMap);

  const batch = db.batch();

  for (const row of rows) {
    const [name, partyName, category, unit, dateSerialNumber, pageNoStr, rateStr, gstStr] = row;
    
    // 2. Data Validation & Conversion
    const rate = parseFloat(rateStr);
    const pageNo = parseInt(pageNoStr, 10);
    // Google Sheets might pass GST as a string like "5.00%", so we parse it
    const gstValue = parseFloat(gstStr);
    const gst = isNaN(gstValue) ? 0 : gstValue;

    // Convert Google Sheet's date serial number to a JS Date
    const billDate = new Date(Date.UTC(1899, 11, 30 + parseInt(dateSerialNumber)));


    if (
      !name || !partyName || !category || !unit ||
      isNaN(rate) || isNaN(pageNo) || isNaN(billDate.getTime()) ||
      !categories.includes(category as any) || !units.includes(unit as any)
    ) {
      skipped++;
      continue; // Skip invalid row
    }
    
    const productKey = `${name.toLowerCase()}_${partyName.toLowerCase()}`;
    const existingProduct = productCheckMap[productKey];

    if (existingProduct) {
      // 3. Product exists: Check if it's a new rate or just a detail update
      const latestRate = existingProduct.latestRate;
      
      const isRateDifferent = !latestRate || 
          latestRate.rate !== rate || 
          Math.abs(new Date(latestRate.billDate).getTime() - billDate.getTime()) > (24 * 60 * 60 * 1000) ; // Compare dates, allowing for timezone differences
      
      const areDetailsDifferent = existingProduct.category !== category || existingProduct.unit !== unit;

      if (isRateDifferent) {
        const newRateRef = db.collection(PRODUCTS_COLLECTION).doc(existingProduct.id).collection(RATES_SUBCOLLECTION).doc();
        batch.set(newRateRef, { rate, gst, pageNo, billDate, createdAt: serverTimestamp() });
        updated++;
      }

      if (areDetailsDifferent) {
        const productRef = db.collection(PRODUCTS_COLLECTION).doc(existingProduct.id);
        batch.update(productRef, { category, unit });
        if (!isRateDifferent) updated++; // Only count as update once
      }

    } else {
      // 4. New product: Add product and its first rate
      const newProductRef = db.collection(PRODUCTS_COLLECTION).doc();
      batch.set(newProductRef, { name, partyName, category, unit });

      const newRateRef = newProductRef.collection(RATES_SUBCOLLECTION).doc();
      batch.set(newRateRef, { rate, gst, pageNo, billDate, createdAt: serverTimestamp() });
      added++;
    }
  }
  
  // 5. Commit all changes at once
  await batch.commit();

  return { added, updated, skipped };
}
