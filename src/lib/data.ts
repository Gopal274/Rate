'use server';

import { collection, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/firebase/admin';
import type { Product, Rate } from './types';

const getDb = () => {
    return getAdminFirestore(getFirebaseAdminApp());
}

export const getProducts = async (): Promise<Product[]> => {
  const productsCol = collection(getDb(), 'products');
  const productSnapshot = await getDocs(productsCol);
  const productList = productSnapshot.docs.map(doc => {
    const data = doc.data();
    return { 
      id: doc.id, 
      ...data,
      billDate: (data.billDate as any).toDate() // Convert Timestamp to Date
    } as Product;
  });
  return productList;
};

export const getProductById = async (id: string): Promise<Product | undefined> => {
  const products = await getProducts();
  return products.find(p => p.id === id);
}

export const addProduct = async (productData: Omit<Product, 'id'>, initialRate: number) => {
  const productsCol = collection(getDb(), 'products');
  const newProductRef = await addDoc(productsCol, {
    ...productData,
    billDate: productData.billDate, 
  });

  const ratesCol = collection(newProductRef, 'rates');
  await addDoc(ratesCol, {
    rate: initialRate,
    createdAt: serverTimestamp(),
  });
  
  return { id: newProductRef.id, ...productData };
};

export const updateProduct = async (id: string, updateData: Partial<Omit<Product, 'id' | 'ownerId'>>) => {
  const productDoc = doc(getDb(), 'products', id);
  await updateDoc(productDoc, updateData);
};

export const deleteProduct = async (id: string) => {
    const productDoc = doc(getDb(), 'products', id);
    const ratesCol = collection(productDoc, 'rates');
    const ratesSnapshot = await getDocs(ratesCol);
    for (const rateDoc of ratesSnapshot.docs) {
        await deleteDoc(rateDoc.ref);
    }
    await deleteDoc(productDoc);
};

export const getProductRates = async (productId: string): Promise<Rate[]> => {
  const ratesCol = collection(getDb(), 'products', productId, 'rates');
  const q = query(ratesCol, orderBy('createdAt', 'desc'));
  const ratesSnapshot = await getDocs(q);
  return ratesSnapshot.docs.map(doc => {
      const data = doc.data();
      return { 
          id: doc.id, 
          rate: data.rate,
          createdAt: (data.createdAt as any).toDate() // Convert Timestamp to Date
        } as Rate
    });
};

export const addRate = async (productId: string, rate: number): Promise<Rate> => {
  const ratesCol = collection(getDb(), 'products', productId, 'rates');
  const newRateRef = await addDoc(ratesCol, {
    rate,
    createdAt: serverTimestamp()
  });
  // Firestore serverTimestamp is resolved on the server, so we return a placeholder.
  // The client will refetch or optimistically update with a client-side date.
  return { id: newRateRef.id, rate, createdAt: new Date() }; 
};

export const deleteRate = async (productId: string, rateId: string) => {
  const rateDoc = doc(getDb(), 'products', productId, 'rates', rateId);
  await deleteDoc(rateDoc);
};