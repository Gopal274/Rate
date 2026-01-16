
'use server';

import { 
  serverTimestamp, 
  Timestamp,
  FieldValue,
  getFirestore,
  collection,
  doc,
  addDoc,
  runTransaction,
  updateDoc,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  writeBatch,
  where,
  limit,
} from 'firebase/firestore';

// IMPORTANT: Use the server-side initialization
import { getSdks } from '@/firebase/server';
import type { Product, Rate, ProductSchema, UpdateProductSchema, ProductWithRates, BatchProductSchema } from './types';


// Helper to initialize Firebase Admin
async function getDb() {
  // Use the server-side getSdks
  const { firestore } = getSdks();
  return firestore;
}

const PRODUCTS_COLLECTION = 'products';
const RATES_SUBCOLLECTION = 'rates';

// Type for product data used in creation, separating product and rate details
type ProductCreationData = Omit<ProductSchema, 'rate' | 'gst' | 'pageNo' | 'billDate'>;

export const addProduct = async (formData: ProductSchema): Promise<{product: Product, rate: Rate}> => {
  const db = await getDb();
  const { name, unit, partyName, rate, gst, pageNo, billDate } = formData;
  
  const productsRef = collection(db, PRODUCTS_COLLECTION);
  const q = query(productsRef, where('name', '==', name), where('partyName', '==', partyName), limit(1));
  const querySnapshot = await getDocs(q);

  let productId: string;
  let productData: Omit<Product, 'id'>;

  if (!querySnapshot.empty) {
    const existingDoc = querySnapshot.docs[0];
    productId = existingDoc.id;
    productData = existingDoc.data() as Omit<Product, 'id'>;

    // Product exists, check if the rate is a duplicate based on rate and GST
    const existingRates = await getProductRates(productId);
    const isDuplicateRate = existingRates.some(r => 
        r.rate === rate && 
        r.gst === gst
    );

    if (isDuplicateRate) {
        throw new Error(`This rate (${rate} + ${gst}% GST) for '${name}' from '${partyName}' has already been recorded.`);
    }

  } else {
    // Product doesn't exist, create it
    const newProductData: ProductCreationData = { name, unit, partyName };
    const newProductRef = await addDoc(collection(db, PRODUCTS_COLLECTION), newProductData);
    productId = newProductRef.id;
    productData = newProductData;
  }

  // Add the new rate
  const rateData = {
    rate,
    gst,
    pageNo,
    billDate: new Date(billDate),
    createdAt: new Date(),
  };
  
  const newRateRef = await addDoc(collection(db, PRODUCTS_COLLECTION, productId, RATES_SUBCOLLECTION), {
      ...rateData,
      createdAt: serverTimestamp()
  });

  return {
    product: { id: productId, ...productData },
    rate: { id: newRateRef.id, ...rateData }
  };
};

export const batchAddProducts = async (formData: BatchProductSchema): Promise<{ addedCount: number; skippedCount: number }> => {
    const db = await getDb();
    const { partyName, billDate, pageNo, products } = formData;
    
    let addedCount = 0;
    let skippedCount = 0;

    const existingProducts = await getAllProductsWithRates({ onlyLatestRate: false });
    const productMap = new Map(existingProducts.map(p => {
        const key = `${p.name.toLowerCase()}_${p.partyName.toLowerCase()}`;
        return [key, { id: p.id, rates: p.rates }];
    }));
    
    const batch = writeBatch(db);
    
    for (const product of products) {
        const productKey = `${product.name.toLowerCase()}_${partyName.toLowerCase()}`;
        const existingProductInfo = productMap.get(productKey);

        let targetProductId: string;

        if (existingProductInfo) {
            targetProductId = existingProductInfo.id;
            // Check for duplicate rate within existing product based on rate and GST
            const isDuplicateRate = existingProductInfo.rates.some(r => 
                r.rate === product.rate && 
                r.gst === product.gst
            );
            if (isDuplicateRate) {
                skippedCount++; // Increment skipped count
                continue; // Skip this product entry entirely
            }
        } else {
            // Product is new, create it in the batch
            const newProductRef = doc(collection(db, PRODUCTS_COLLECTION));
            batch.set(newProductRef, {
                name: product.name,
                unit: product.unit,
                partyName: partyName,
            });
            targetProductId = newProductRef.id;
            // Add to map for subsequent items in the same batch to avoid creating the same product multiple times
            productMap.set(productKey, { id: targetProductId, rates: [] }); 
        }

        // Add the rate to the product (new or existing)
        const newRateRef = doc(collection(db, PRODUCTS_COLLECTION, targetProductId, RATES_SUBCOLLECTION));
        batch.set(newRateRef, {
            rate: product.rate,
            gst: product.gst,
            pageNo: pageNo,
            billDate: new Date(billDate),
            createdAt: serverTimestamp(),
        });
        addedCount++;
    }

    await batch.commit();
    return { addedCount, skippedCount };
};


export const updateProduct = async (productId: string, latestRateId: string, updateData: UpdateProductSchema): Promise<void> => {
  const db = await getDb();
  const productDocRef = doc(db, PRODUCTS_COLLECTION, productId);
  const rateDocRef = doc(db, PRODUCTS_COLLECTION, productId, RATES_SUBCOLLECTION, latestRateId);
  
  const { name, unit, partyName, rate, gst, pageNo, billDate } = updateData;

  const productUpdates = { name, unit, partyName };
  const rateUpdates = { rate, gst, pageNo, billDate: new Date(billDate) };

  const batch = writeBatch(db);
  batch.update(productDocRef, productUpdates);
  batch.update(rateDocRef, rateUpdates);
  
  await batch.commit();
};

export const deleteProduct = async (productId: string): Promise<void> => {
  const db = await getDb();
  const productDocRef = doc(db, PRODUCTS_COLLECTION, productId);
  
  await runTransaction(db, async (transaction) => {
    // Get all rates for the product
    const ratesQuery = collection(productDocRef, RATES_SUBCOLLECTION);
    const ratesSnapshot = await getDocs(ratesQuery);
    
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
  const ratesCol = collection(db, PRODUCTS_COLLECTION, productId, RATES_SUBCOLLECTION);
  const q = query(ratesCol, orderBy('createdAt', 'desc'));
  const ratesSnapshot = await getDocs(q);

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
    
    // Check for duplicate rate based on rate and GST before adding
    const existingRates = await getProductRates(productId);
    const isDuplicateRate = existingRates.some(r => 
        r.rate === rate && 
        r.gst === gst
    );

    if (isDuplicateRate) {
        throw new Error('This rate for this product has already been recorded.');
    }

    const productRef = doc(db, PRODUCTS_COLLECTION, productId);
    const newRateData = {
        rate,
        gst,
        pageNo,
        billDate,
        createdAt: serverTimestamp()
    };
    
    const newRateRef = await addDoc(collection(productRef, RATES_SUBCOLLECTION), newRateData);

    // We return a client-side representation. The serverTimestamp will be resolved by Firestore.
    return { id: newRateRef.id, ...newRateData, createdAt: new Date() };
};


export const deleteRate = async (productId: string, rateId: string): Promise<void> => {
  const db = await getDb();
  const rateDoc = doc(db, PRODUCTS_COLLECTION, productId, RATES_SUBCOLLECTION, rateId);
  await deleteDoc(rateDoc);
};


export const getAllProductsWithRates = async (options?: { onlyLatestRate: boolean }): Promise<ProductWithRates[]> => {
    const db = await getDb();
    const productsCollectionRef = collection(db, PRODUCTS_COLLECTION);
    const productsSnapshot = await getDocs(productsCollectionRef);
    
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
  [key: string]: { id: string; rates: Rate[] };
};

export async function importProductsAndRates(rows: any[][]) {
  const db = await getDb();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  // 1. Fetch all existing products and ALL their rates for efficient checking
  const existingProductsData = await getAllProductsWithRates({ onlyLatestRate: false });
  const productCheckMap: ProductCheckMap = existingProductsData.reduce((acc, p) => {
    const key = `${p.name.toLowerCase()}_${p.partyName.toLowerCase()}`;
    acc[key] = { id: p.id, rates: p.rates };
    return acc;
  }, {} as ProductCheckMap);

  const batch = writeBatch(db);

  for (const row of rows) {
    const [name, partyName, unit, billDateISO, pageNoStr, rateStr, gstStr] = row;
    
    // 2. Data Validation & Conversion
    const rate = parseFloat(rateStr);
    const pageNo = parseInt(pageNoStr, 10);
    const gst = parseFloat(gstStr);

    if (!name || !partyName || !unit || !billDateISO || !rateStr || !pageNoStr || !gstStr) {
        skipped++;
        continue;
    }

    let billDate: Date;
    try {
        billDate = new Date(billDateISO);
        if (isNaN(billDate.getTime())) {
            skipped++;
            continue;
        }
    } catch (e) {
        skipped++;
        continue;
    }

    if (isNaN(rate) || isNaN(pageNo) || isNaN(gst)) {
      skipped++;
      continue; 
    }
    
    const productKey = `${name.toLowerCase()}_${partyName.toLowerCase()}`;
    const existingProduct = productCheckMap[productKey];

    if (existingProduct) {
      // 3. Product exists: Check if this specific rate already exists in history.
      const rateAlreadyExists = existingProduct.rates.some(existingRate => {
        return existingRate.rate === rate &&
               existingRate.gst === gst;
      });

      if (rateAlreadyExists) {
        skipped++;
      } else {
        // Rate is new for this product, so add it.
        const newRateRef = doc(collection(db, PRODUCTS_COLLECTION, existingProduct.id, RATES_SUBCOLLECTION));
        batch.set(newRateRef, { rate, gst, pageNo, billDate, createdAt: serverTimestamp() });
        updated++;
        // also update in-memory map to prevent duplicates within the same batch run
        existingProduct.rates.push({ id: newRateRef.id, rate, gst, pageNo, billDate, createdAt: new Date() });
      }
    } else {
      // 4. New product: Add product and its first rate.
      const newProductRef = doc(collection(db, PRODUCTS_COLLECTION));
      batch.set(newProductRef, { name, partyName, unit });

      const newRateRef = doc(collection(newProductRef, RATES_SUBCOLLECTION));
      batch.set(newRateRef, { rate, gst, pageNo, billDate, createdAt: serverTimestamp() });
      
      productCheckMap[productKey] = { id: newProductRef.id, rates: [] };
      
      added++;
    }
  }
  
  await batch.commit();

  return { added, updated, skipped };
}
