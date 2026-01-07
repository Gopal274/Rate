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
  writeBatch,
  Timestamp,
  runTransaction,
  getDocs,
  addDoc
} from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import type { Product, Rate, ProductSchema, UpdateProductSchema } from './types';

// Helper to initialize Firebase
function getDb() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getFirestore();
}

const db = getDb();
const PRODUCTS_COLLECTION = 'products';
const RATES_SUBCOLLECTION = 'rates';

// Type for product data used in creation, without the 'rate'
type ProductCreationData = Omit<ProductSchema, 'rate'>;

export const addProduct = async (productData: ProductCreationData, initialRate: number): Promise<Product> => {
  const newProductRef = doc(collection(db, PRODUCTS_COLLECTION));
  
  // Prepare product data for Firestore
  const newProductForDb = {
    ...productData,
    billDate: new Date(productData.billDate), // Ensure billDate is a Date object
  };

  await runTransaction(db, async (transaction) => {
    // 1. Set the main product document
    transaction.set(newProductRef, newProductForDb);

    // 2. Set the initial rate in the subcollection
    const newRateRef = doc(collection(newProductRef, RATES_SUBCOLLECTION));
    transaction.set(newRateRef, {
      rate: initialRate,
      createdAt: serverTimestamp(),
    });
  });

  // Return the product shape expected by the client
  return {
    id: newProductRef.id,
    ...newProductForDb,
  };
};


export const updateProduct = async (productId: string, updateData: Partial<Omit<UpdateProductSchema, 'newRate'>>): Promise<void> => {
  const productDoc = doc(db, PRODUCTS_COLLECTION, productId);
  const dataToUpdate = { ...updateData };
  if (updateData.billDate) {
    dataToUpdate.billDate = new Date(updateData.billDate as any);
  }
  await updateDoc(productDoc, dataToUpdate);
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
      return { 
          id: doc.id, 
          rate: data.rate,
          createdAt: createdAt
        } as Rate
    });
};

export const addRate = async (productId: string, rate: number): Promise<Rate> => {
    const ratesCol = collection(db, PRODUCTS_COLLECTION, productId, RATES_SUBCOLLECTION);
    
    const newRateData = {
        rate,
        createdAt: serverTimestamp()
    };

    const newRateRef = await addDoc(ratesCol, newRateData);

    // We return a client-side representation. The serverTimestamp will be resolved by Firestore.
    return { id: newRateRef.id, rate, createdAt: new Date() };
};


export const deleteRate = async (productId: string, rateId: string): Promise<void> => {
  const rateDoc = doc(db, PRODUCTS_COLLECTION, productId, RATES_SUBCOLLECTION, rateId);
  await deleteDoc(rateDoc);
};
