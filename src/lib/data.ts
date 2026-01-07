import { collection, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc, query, orderBy, limit, getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getFirebaseAdminApp } from '@/firebase/admin';
import type { Product, Rate } from './types';
import { getFirestore } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

const getDb = () => {
    try {
        return getAdminFirestore(getFirebaseAdminApp());
    } catch (e) {
        // This will fail on the client-side, which is expected.
        return getFirestore(initializeFirebase().firebaseApp);
    }
}


export const getProducts = async (): Promise<Product[]> => {
  const productsCol = collection(getDb(), 'products');
  const productSnapshot = await getDocs(productsCol);
  const productList = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
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
    billDate: productData.billDate, // Already a Date object
  });

  const ratesCol = collection(newProductRef, 'rates');
  await addDoc(ratesCol, {
    rate: initialRate,
    createdAt: serverTimestamp(),
  });
  
  return { id: newProductRef.id, ...productData };
};

export const updateProduct = async (id: string, updateData: Partial<Product>) => {
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
  return ratesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Rate));
};

export const addRate = async (productId: string, rate: number): Promise<Rate> => {
  const ratesCol = collection(getDb(), 'products', productId, 'rates');
  const newRateRef = await addDoc(ratesCol, {
    rate,
    createdAt: serverTimestamp()
  });
  return { id: newRateRef.id, rate, createdAt: new Date() }; // return optimistic response
};

export const deleteRate = async (productId: string, rateId: string) => {
  const rateDoc = doc(getDb(), 'products', productId, 'rates', rateId);
  await deleteDoc(rateDoc);
};
