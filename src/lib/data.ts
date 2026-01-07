import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  writeBatch,
  Timestamp,
  runTransaction
} from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import type { Product, Rate, ProductSchema } from './types';

// This function initializes Firebase for server-side actions.
function getDb() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getFirestore();
}

const db = getDb();
const PRODUCTS_COLLECTION = 'products';
const RATES_SUBCOLLECTION = 'rates';

export const addProduct = async (productData: Omit<ProductSchema, 'rate'>, initialRate: number): Promise<Product> => {
  const newProductRef = doc(collection(db, PRODUCTS_COLLECTION));
  
  const newProduct = {
    ...productData,
    billDate: new Date(productData.billDate), // Ensure it's a date object
  };

  const newRate = {
    rate: initialRate,
    createdAt: serverTimestamp(),
  };

  await runTransaction(db, async (transaction) => {
    const rateRef = doc(collection(newProductRef, RATES_SUBCOLLECTION));
    transaction.set(newProductRef, newProduct);
    transaction.set(rateRef, newRate);
  });

  return {
    id: newProductRef.id,
    ...productData,
    billDate: new Date(productData.billDate), // Return a client-compatible object
  };
};

export const updateProduct = async (productId: string, updateData: Partial<Product>): Promise<void> => {
  const productDoc = doc(db, PRODUCTS_COLLECTION, productId);
  const dataToUpdate = { ...updateData };
  if (updateData.billDate) {
    dataToUpdate.billDate = new Date(updateData.billDate as any);
  }
  await updateDoc(productDoc, dataToUpdate);
};

export const deleteProduct = async (productId: string): Promise<void> => {
  const productDocRef = doc(db, PRODUCTS_COLLECTION, productId);
  const ratesQuery = query(collection(productDocRef, RATES_SUBCOLLECTION));
  
  const batch = writeBatch(db);
  
  const ratesSnapshot = await getDocs(ratesQuery);
  ratesSnapshot.forEach((rateDoc) => {
    batch.delete(rateDoc.ref);
  });
  
  batch.delete(productDocRef);
  
  await batch.commit();
};


export const getProductRates = async (productId: string): Promise<Rate[]> => {
  const ratesCol = collection(db, PRODUCTS_COLLECTION, productId, RATES_SUBCOLLECTION);
  const q = query(ratesCol, orderBy('createdAt', 'desc'));
  const ratesSnapshot = await getDocs(q);

  return ratesSnapshot.docs.map(doc => {
      const data = doc.data();
      // Firestore timestamps need to be converted to Date objects for the client
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

  return { id: newRateRef.id, rate, createdAt: new Date() }; // Return optimistic date for UI
};

export const deleteRate = async (productId: string, rateId: string): Promise<void> => {
  const rateDoc = doc(db, PRODUCTS_COLLECTION, productId, RATES_SUBCOLLECTION, rateId);
  await deleteDoc(rateDoc);
};
