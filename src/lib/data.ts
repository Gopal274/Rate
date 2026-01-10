
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
} from 'firebase/firestore';

// IMPORTANT: Use the server-side initialization
import { getSdks } from '@/firebase/server';
import type { Product, Rate, ProductSchema, UpdateProductSchema, ProductWithRates } from './types';
import { categories, units } from './types';


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
  const { name, unit, partyName, category, rate, gst, pageNo, billDate } = formData;
  
  const productData: ProductCreationData = { name, unit, partyName, category };

  const rateData = {
    rate,
    gst,
    pageNo,
    billDate: new Date(billDate),
    createdAt: new Date(),
  };

  const newProductRef = await addDoc(collection(db, PRODUCTS_COLLECTION), productData);

  const newRateRef = await addDoc(collection(newProductRef, RATES_SUBCOLLECTION), {
      ...rateData,
      createdAt: serverTimestamp()
  });

  // Return the product and rate shapes expected by the client
  return {
    product: {
        id: newProductRef.id,
        ...productData,
    },
    rate: {
        id: newRateRef.id,
        ...rateData,
    }
  };
};


export const updateProduct = async (productId: string, updateData: Partial<UpdateProductSchema>): Promise<void> => {
  const db = await getDb();
  const productDoc = doc(db, PRODUCTS_COLLECTION, productId);
  await updateDoc(productDoc, updateData);
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
  [key: string]: { id: string; rates: Rate[], category: string, unit: string };
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
    acc[key] = { id: p.id, rates: p.rates, category: p.category, unit: p.unit };
    return acc;
  }, {} as ProductCheckMap);

  const batch = writeBatch(db);

  for (const row of rows) {
    const [name, partyName, category, unit, billDateISO, pageNoStr, rateStr, gstStr] = row;
    
    // 2. Data Validation & Conversion
    const rate = parseFloat(rateStr);
    const pageNo = parseInt(pageNoStr, 10);
    const gst = parseFloat(gstStr); // GST is already a percentage number here

    let billDate: Date;
    if (billDateISO && typeof billDateISO === 'string' && !isNaN(Date.parse(billDateISO))) {
        billDate = new Date(billDateISO);
    } else {
        skipped++;
        continue; // Skip if date is invalid
    }

    if (
      !name || !partyName || !category || !unit ||
      isNaN(rate) || isNaN(pageNo) || isNaN(gst) || isNaN(billDate.getTime()) ||
      !categories.includes(category as any) || !units.includes(unit as any)
    ) {
      skipped++;
      continue; // Skip invalid row
    }
    
    const productKey = `${name.toLowerCase()}_${partyName.toLowerCase()}`;
    const existingProduct = productCheckMap[productKey];

    if (existingProduct) {
      // 3. Product exists: Check if rate already exists in history
      const allRates = existingProduct.rates;
      
      const rateAlreadyExists = allRates.some(existingRate => {
        const existingBillDate = new Date(existingRate.billDate);
        // Compare rate, and date (ignoring time)
        return existingRate.rate === rate &&
               existingBillDate.getFullYear() === billDate.getFullYear() &&
               existingBillDate.getMonth() === billDate.getMonth() &&
               existingBillDate.getDate() === billDate.getDate();
      });

      const areDetailsDifferent = existingProduct.category !== category || existingProduct.unit !== unit;

      if (!rateAlreadyExists) {
        const newRateRef = doc(collection(db, PRODUCTS_COLLECTION, existingProduct.id, RATES_SUBCOLLECTION));
        batch.set(newRateRef, { rate, gst, pageNo, billDate, createdAt: serverTimestamp() });
        updated++;
      }
      
      if (areDetailsDifferent) {
        const productRef = doc(db, PRODUCTS_COLLECTION, existingProduct.id);
        batch.update(productRef, { category, unit });
        if (rateAlreadyExists) updated++; // Count as update if only details changed
      }

      if(!areDetailsDifferent && rateAlreadyExists) {
        skipped++;
      }

    } else {
      // 4. New product: Add product and its first rate
      const newProductRef = doc(collection(db, PRODUCTS_COLLECTION));
      batch.set(newProductRef, { name, partyName, category, unit });

      const newRateRef = doc(collection(newProductRef, RATES_SUBCOLLECTION));
      batch.set(newRateRef, { rate, gst, pageNo, billDate, createdAt: serverTimestamp() });
      
      // Add to our map so we don't re-add it if it appears again in the same sheet
      productCheckMap[productKey] = { id: newProductRef.id, rates: [{ rate, billDate } as Rate], category, unit };
      
      added++;
    }
  }
  
  // 5. Commit all changes at once
  await batch.commit();

  return { added, updated, skipped };
}
