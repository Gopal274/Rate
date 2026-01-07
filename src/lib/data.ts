'use server';

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
  writeBatch
} from 'firebase/firestore';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { Product, Rate } from './types';

// This function initializes Firebase for server-side use.
// It's safe to call this multiple times; it will only initialize once.
function getDb() {
    if (!getApps().length) {
        initializeApp(firebaseConfig);
    }
    return getFirestore();
}

const firestore = getDb();

export const getProducts = async (): Promise<Product[]> => {
  const productsCol = collection(firestore, 'products');
  const productSnapshot = await getDocs(productsCol);
  const productList = productSnapshot.docs.map(doc => {
    const data = doc.data();
    return { 
      id: doc.id, 
      ...data,
      billDate: (data.billDate as any).toDate()
    } as Product;
  });
  return productList;
};

export const getProductById = async (id: string): Promise<Product | undefined> => {
  const products = await getProducts();
  return products.find(p => p.id === id);
}

export const addProduct = async (productData: Omit<Product, 'id'>, initialRate: number) => {
    const batch = writeBatch(firestore);

    // This is the data that will be saved for the new product.
    // It correctly includes all fields from productData, including ownerId.
    const newProductData = {
        ...productData,
        billDate: new Date(productData.billDate as any),
    };

    const newProductRef = doc(collection(firestore, 'products'));
    // Use the complete newProductData object which contains ownerId.
    batch.set(newProductRef, newProductData);
    
    const ratesColRef = collection(newProductRef, 'rates');
    const newRateRef = doc(ratesColRef);
    batch.set(newRateRef, {
        rate: initialRate,
        createdAt: serverTimestamp(),
    });
    
    await batch.commit();

    // Return the newly created product data for optimistic UI updates.
    return { id: newProductRef.id, ...newProductData };
};

export const updateProduct = async (id: string, updateData: Partial<Omit<Product, 'id' | 'ownerId'>>) => {
  const productDoc = doc(firestore, 'products', id);
  await updateDoc(productDoc, {
      ...updateData,
      billDate: new Date(updateData.billDate as any),
  });
};

export const deleteProduct = async (id: string) => {
    const productDoc = doc(firestore, 'products', id);
    const ratesCol = collection(productDoc, 'rates');
    const ratesSnapshot = await getDocs(ratesCol);
    
    const batch = writeBatch(firestore);
    ratesSnapshot.forEach(rateDoc => {
        batch.delete(rateDoc.ref);
    });
    batch.delete(productDoc);
    
    await batch.commit();
};

export const getProductRates = async (productId: string): Promise<Rate[]> => {
  const ratesCol = collection(firestore, 'products', productId, 'rates');
  const q = query(ratesCol, orderBy('createdAt', 'desc'));
  const ratesSnapshot = await getDocs(q);
  return ratesSnapshot.docs.map(doc => {
      const data = doc.data();
      // Firestore timestamps need to be converted to Date objects
      const createdAt = (data.createdAt as any)?.toDate ? (data.createdAt as any).toDate() : new Date();
      return { 
          id: doc.id, 
          rate: data.rate,
          createdAt: createdAt
        } as Rate
    });
};

export const addRate = async (productId: string, rate: number): Promise<Rate> => {
  const ratesCol = collection(firestore, 'products', productId, 'rates');
  const newRateRef = await addDoc(ratesCol, {
    rate,
    createdAt: serverTimestamp()
  });
  // For optimistic update, we can't wait for server timestamp.
  // We'll return a client-side date, and the real-time listener will get the server one.
  return { id: newRateRef.id, rate, createdAt: new Date() }; 
};

export const deleteRate = async (productId: string, rateId: string) => {
  const rateDoc = doc(firestore, 'products', productId, 'rates', rateId);
  await deleteDoc(rateDoc);
};
