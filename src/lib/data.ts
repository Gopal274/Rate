'use server';

import { 
  getFirestore, 
  collection, 
  doc, 
  serverTimestamp, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  runTransaction,
  getDocs,
  Timestamp,
  collectionGroup,
} from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import type { Product, Rate, ProductSchema, UpdateProductSchema, ProductWithRates } from './types';

// Helper to initialize Firebase
function getDb() {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
  return getFirestore(getApp());
}

const db = getDb();
const PRODUCTS_COLLECTION = 'products';
const RATES_SUBCOLLECTION = 'rates';

// Type for product data used in creation, separating product and rate details
type ProductCreationData = Omit<ProductSchema, 'rate' | 'gst' | 'pageNo' | 'billDate'>;

export const addProduct = async (formData: ProductSchema): Promise<{product: Product, rate: Rate}> => {
  const { name, unit, partyName, category, rate, gst, pageNo, billDate } = formData;
  const newProductRef = doc(collection(db, PRODUCTS_COLLECTION));
  
  const productData: ProductCreationData = { name, unit, partyName, category };

  const rateData = {
    rate,
    gst,
    pageNo,
    billDate: new Date(billDate),
    createdAt: serverTimestamp(),
  };

  await runTransaction(db, async (transaction) => {
    // 1. Set the main product document
    transaction.set(newProductRef, productData);

    // 2. Set the initial rate in the subcollection
    const newRateRef = doc(collection(newProductRef, RATES_SUBCOLLECTION));
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
  const productDoc = doc(db, PRODUCTS_COLLECTION, productId);
  await updateDoc(productDoc, updateData);
};

export const deleteProduct = async (productId: string): Promise<void> => {
  const productDocRef = doc(db, PRODUCTS_COLLECTION, productId);
  
  await runTransaction(db, async (transaction) => {
    // Get all rates for the product
    const ratesQuery = query(collection(productDocRef, RATES_SUBCOLLECTION));
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
    const productRef = doc(db, PRODUCTS_COLLECTION, productId);
    const newRateRef = doc(collection(productRef, RATES_SUBCOLLECTION));
    
    const newRateData = {
        rate,
        gst,
        pageNo,
        billDate,
        createdAt: serverTimestamp()
    };

    await runTransaction(db, async (transaction) => {
        // Just add the new rate document. No need to touch the parent product.
        transaction.set(newRateRef, newRateData);
    });

    // We return a client-side representation. The serverTimestamp will be resolved by Firestore.
    return { id: newRateRef.id, ...newRateData, createdAt: new Date() };
};


export const deleteRate = async (productId: string, rateId: string): Promise<void> => {
  const rateDoc = doc(db, PRODUCTS_COLLECTION, productId, RATES_SUBCOLLECTION, rateId);
  await deleteDoc(rateDoc);
};


export const getAllProductsWithRates = async (): Promise<ProductWithRates[]> => {
    const productsCollectionRef = collection(db, PRODUCTS_COLLECTION);
    const productsSnapshot = await getDocs(productsCollectionRef);
    
    const productsWithRates: ProductWithRates[] = [];

    for (const productDoc of productsSnapshot.docs) {
        const productData = productDoc.data() as Omit<Product, 'id'>;
        const rates = await getProductRates(productDoc.id);

        productsWithRates.push({
            id: productDoc.id,
            ...productData,
            rates: rates,
        });
    }

    return productsWithRates;
};
