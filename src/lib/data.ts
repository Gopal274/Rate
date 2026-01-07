import type { Product, Rate } from './types';
import { format } from 'date-fns';

let products: Product[] = [
  {
    id: '1',
    name: 'Premium Basmati Rice',
    unit: 'kg',
    gst: 5,
    partyName: 'Global Foods Inc.',
    pageNumber: 12,
    billDate: new Date('2023-10-15'),
    category: 'Grocery',
    rateHistory: [
      { date: new Date('2023-10-15'), rate: 120 },
      { date: new Date('2023-11-20'), rate: 125 },
      { date: new Date('2024-01-10'), rate: 122 },
      { date: new Date('2024-03-05'), rate: 130 },
      { date: new Date('2024-05-21'), rate: 135 },
    ],
  },
  {
    id: '2',
    name: 'Organic Whole Wheat Flour',
    unit: 'kg',
    gst: 5,
    partyName: 'Nature\'s Harvest',
    pageNumber: 18,
    billDate: new Date('2023-11-02'),
    category: 'Grocery',
    rateHistory: [
      { date: new Date('2023-11-02'), rate: 55 },
      { date: new Date('2024-02-14'), rate: 58 },
      { date: new Date('2024-04-30'), rate: 60 },
    ],
  },
  {
    id: '3',
    name: 'LED Monitor 24-inch',
    unit: 'piece',
    gst: 18,
    partyName: 'Tech Solutions Ltd.',
    pageNumber: 25,
    billDate: new Date('2024-01-20'),
    category: 'Electronics',
    rateHistory: [
      { date: new Date('2024-01-20'), rate: 15000 },
      { date: new Date('2024-03-10'), rate: 14500 },
      { date: new Date('2024-05-15'), rate: 14800 },
    ],
  },
  {
    id: '4',
    name: 'Cotton Fabric',
    unit: 'meter',
    gst: 12,
    partyName: 'Textile Emporium',
    pageNumber: 31,
    billDate: new Date('2024-02-11'),
    category: 'Textiles',
    rateHistory: [{ date: new Date('2024-02-11'), rate: 350 }],
  },
  {
    id: '5',
    name: 'Sunflower Oil',
    unit: 'liter',
    gst: 5,
    partyName: 'Global Foods Inc.',
    pageNumber: 45,
    billDate: new Date('2024-04-05'),
    category: 'Grocery',
    rateHistory: [
        { date: new Date('2024-04-05'), rate: 150 },
        { date: new Date('2024-06-01'), rate: 155 },
    ],
  },
];

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, 500));

export const getProducts = async (): Promise<Product[]> => {
  // await delay(10);
  return products;
};

export const getProductById = async (id: string): Promise<Product | undefined> => {
  // await delay(10);
  return products.find(p => p.id === id);
}

export const addProduct = (productData: Omit<Product, 'id' | 'rateHistory'> & { initialRate: number }) => {
  const newProduct: Product = {
    ...productData,
    id: (products.length + 1).toString(),
    rateHistory: [{ date: productData.billDate, rate: productData.initialRate }],
  };
  products.unshift(newProduct);
  return newProduct;
};

export const updateProduct = (id: string, updateData: Partial<Product>) => {
  products = products.map(p => (p.id === id ? { ...p, ...updateData } : p));
  return products.find(p => p.id === id);
};

export const updateProductRates = (id: string, rates: Rate[]) => {
  products = products.map(p => (p.id === id ? { ...p, rateHistory: rates } : p));
  return products.find(p => p.id === id);
}

export const deleteProduct = (id: string) => {
  products = products.filter(p => p.id !== id);
  return true;
};
