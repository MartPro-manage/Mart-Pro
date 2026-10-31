import { 
  db, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  cleanFirestoreData 
} from './firebase';
import { Product, Supplier, Sale, Expense, LedgerEntry, ActivityLog, SupplierOrder } from '../types';

export const MART_PRO_INITIAL_PRODUCTS: Omit<Product, 'id' | 'storeId'>[] = [
  {
    name: 'Milk 1L',
    barcode: '89640001001',
    shortcutCode: '1001',
    category: 'Dairy',
    price: 220,
    costPrice: 175,
    stockQuantity: 48,
    reorderLevel: 10,
    unitType: 'liter',
    brand: 'Dairy Pure',
    description: 'Fresh pasteurized full cream milk 1 liter pouch',
    isActive: true,
    trackStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Bread Loaf',
    barcode: '89640001002',
    shortcutCode: '1002',
    category: 'Bakery',
    price: 120,
    costPrice: 90,
    stockQuantity: 3, // Low stock trigger
    reorderLevel: 5,
    unitType: 'piece',
    brand: 'Dawn Bakery',
    description: 'Soft sliced premium sandwich white bread',
    isActive: true,
    trackStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Egg Tray (30 Pcs)',
    barcode: '89640001003',
    shortcutCode: '1003',
    category: 'Grocery',
    price: 180,
    costPrice: 145,
    stockQuantity: 1, // Low stock trigger
    reorderLevel: 5,
    unitType: 'dozen',
    brand: 'Farm Fresh',
    description: 'Farm fresh washed farm grade A eggs tray',
    isActive: true,
    trackStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?w=400&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Cooking Oil 5L',
    barcode: '89640001004',
    shortcutCode: '1004',
    category: 'Grocery',
    price: 1800,
    costPrice: 1520,
    stockQuantity: 2, // Low stock trigger
    reorderLevel: 6,
    unitType: 'liter',
    brand: 'Habib',
    description: 'Pure cooking canola and sunflower blend oil 5 liter can',
    isActive: true,
    trackStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Rice 5kg',
    barcode: '89640001005',
    shortcutCode: '1005',
    category: 'Grocery',
    price: 1600,
    costPrice: 1320,
    stockQuantity: 60,
    reorderLevel: 15,
    unitType: 'kg',
    brand: 'Super Basmati',
    description: 'Long grain aromatic aged basmati rice 5kg pack',
    isActive: true,
    trackStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Sugar 1kg',
    barcode: '89640001006',
    shortcutCode: '1006',
    category: 'Grocery',
    price: 160,
    costPrice: 135,
    stockQuantity: 40,
    reorderLevel: 10,
    unitType: 'kg',
    brand: 'Al-Khair',
    description: 'Refined crystal sparkling white sugar 1kg bag',
    isActive: true,
    trackStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=400&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Tea 250g',
    barcode: '89640001007',
    shortcutCode: '1007',
    category: 'Beverages',
    price: 400,
    costPrice: 320,
    stockQuantity: 48,
    reorderLevel: 8,
    unitType: 'piece',
    brand: 'Tapal Danedar',
    description: 'Strong distinct blend premium black tea 250g pouch',
    isActive: true,
    trackStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Biscuits',
    barcode: '89640001008',
    shortcutCode: '1008',
    category: 'Snacks',
    price: 200,
    costPrice: 155,
    stockQuantity: 15,
    reorderLevel: 10,
    unitType: 'piece',
    brand: 'Lu Prince',
    description: 'Chocolate cream filled rich sandwich biscuits pack',
    isActive: true,
    trackStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Soft Drink 1.5L',
    barcode: '89640001009',
    shortcutCode: '1009',
    category: 'Beverages',
    price: 120,
    costPrice: 92,
    stockQuantity: 75,
    reorderLevel: 20,
    unitType: 'piece',
    brand: 'Coca Cola',
    description: 'Refreshing sparkling carbonated beverage 1.5L bottle',
    isActive: true,
    trackStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Noodles Pack',
    barcode: '89640001010',
    shortcutCode: '1010',
    category: 'Snacks',
    price: 140,
    costPrice: 105,
    stockQuantity: 55,
    reorderLevel: 12,
    unitType: 'piece',
    brand: 'Knorr Chatpatta',
    description: 'Quick cooking spicy chatpatta instant noodles',
    isActive: true,
    trackStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?w=400&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Detergent Powder 1kg',
    barcode: '89640001011',
    shortcutCode: '1011',
    category: 'Household',
    price: 265,
    costPrice: 215,
    stockQuantity: 30,
    reorderLevel: 8,
    unitType: 'piece',
    brand: 'Surf Excel',
    description: 'Stain removal washing detergent with freshness formula',
    isActive: true,
    trackStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Shampoo 400ml',
    barcode: '89640001012',
    shortcutCode: '1012',
    category: 'Personal Care',
    price: 300,
    costPrice: 235,
    stockQuantity: 24,
    reorderLevel: 6,
    unitType: 'piece',
    brand: 'Sunsilk Black',
    description: 'Hair nourishing shine activating shampoo 400ml bottle',
    isActive: true,
    trackStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=400&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Tomato Ketchup 800g',
    barcode: '871234567890',
    shortcutCode: '1013',
    category: 'Sauces & Spreads',
    price: 260,
    costPrice: 180,
    stockQuantity: 50,
    reorderLevel: 10,
    unitType: 'piece',
    brand: 'National',
    description: 'Rich & Tasty farm fresh red tomato ketchup dispenser',
    isActive: true,
    trackStock: true,
    imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&auto=format&fit=crop&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const MART_PRO_INITIAL_SUPPLIERS: Omit<Supplier, 'id' | 'storeId'>[] = [
  {
    name: 'ABC Trading Co.',
    phone: '0300-1112222',
    email: 'abc@trading.com',
    address: 'Wholesale Market, Sector B, Lahore',
    totalDue: 12450,
    advanceBalance: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Fresh Foods Ltd.',
    phone: '0321-3334444',
    email: 'fresh@foods.com',
    address: 'Grain & Dairy Hub, Multan Road',
    totalDue: 8250,
    advanceBalance: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Global Suppliers',
    phone: '0333-5556666',
    email: 'global@suppliers.com',
    address: 'Industrial Estate, Karachi',
    totalDue: 4100,
    advanceBalance: 1500,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Sunrise Traders',
    phone: '0346-7778888',
    email: 'sunrise@traders.com',
    address: 'Central Distribution Center, Rawalpindi',
    totalDue: 0,
    advanceBalance: 2000,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    name: 'Mega Mart Wholesale',
    phone: '0312-9990000',
    email: 'mega@wholesale.com',
    address: 'Faisalabad Textile & FMCG Center',
    totalDue: 0,
    advanceBalance: 5000,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const MART_PRO_INITIAL_EXPENSES: Omit<Expense, 'id' | 'storeId'>[] = [
  {
    name: 'Electricity Bill',
    category: 'Utilities',
    notes: 'Commercial monthly electricity unit consumption',
    amount: 2500,
    date: '2026-11-01',
    paymentMethod: 'online',
    timestamp: new Date().toISOString(),
    recordedBy: 'Admin'
  },
  {
    name: 'Store Rent',
    category: 'Rent',
    notes: 'Monthly advance supermarket premises rent',
    amount: 12000,
    date: '2026-10-31',
    paymentMethod: 'online',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    recordedBy: 'Admin'
  },
  {
    name: 'Cleaning Material',
    category: 'Supplies',
    notes: 'Disinfectants, mop sets, trash liners & hygiene supplies',
    amount: 8500,
    date: '2026-10-30',
    paymentMethod: 'cash',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    recordedBy: 'Admin'
  },
  {
    name: 'Delivery Charges',
    category: 'Transport',
    notes: 'Warehouse dispatch fuel & logistics reimbursement',
    amount: 2200,
    date: '2026-10-28',
    paymentMethod: 'online',
    timestamp: new Date(Date.now() - 345600000).toISOString(),
    recordedBy: 'Admin'
  },
  {
    name: 'Staff Salary',
    category: 'Staff Salary',
    notes: 'Cashier & floor manager monthly stipend disbursement',
    amount: 10000,
    date: '2026-10-25',
    paymentMethod: 'online',
    timestamp: new Date(Date.now() - 604800000).toISOString(),
    recordedBy: 'Admin'
  }
];

export async function seedMartProStoreData(storeId: string): Promise<void> {
  try {
    // 1. Seed Products if empty
    const prodsSnap = await getDocs(collection(db, 'products'));
    const storeProds = prodsSnap.docs.filter(d => d.data().storeId === storeId);
    if (storeProds.length === 0) {
      for (let i = 0; i < MART_PRO_INITIAL_PRODUCTS.length; i++) {
        const p = MART_PRO_INITIAL_PRODUCTS[i];
        const docId = `prod_mp_${String(i + 1).padStart(2, '0')}`;
        await setDoc(doc(db, 'products', docId), cleanFirestoreData({
          ...p,
          id: docId,
          storeId
        }));
      }
      console.log('Seeded initial Mart Pro products');
    }

    // 2. Seed Suppliers if empty
    const suppsSnap = await getDocs(collection(db, 'suppliers'));
    const storeSupps = suppsSnap.docs.filter(d => d.data().storeId === storeId);
    if (storeSupps.length === 0) {
      for (let i = 0; i < MART_PRO_INITIAL_SUPPLIERS.length; i++) {
        const s = MART_PRO_INITIAL_SUPPLIERS[i];
        const docId = `supp_mp_${String(i + 1).padStart(2, '0')}`;
        await setDoc(doc(db, 'suppliers', docId), cleanFirestoreData({
          ...s,
          id: docId,
          storeId
        }));
      }
      console.log('Seeded initial Mart Pro suppliers');
    }

    // 3. Seed Expenses if empty
    const expSnap = await getDocs(collection(db, 'expenses'));
    const storeExps = expSnap.docs.filter(d => d.data().storeId === storeId);
    if (storeExps.length === 0) {
      for (let i = 0; i < MART_PRO_INITIAL_EXPENSES.length; i++) {
        const e = MART_PRO_INITIAL_EXPENSES[i];
        const docId = `exp_mp_${String(i + 1).padStart(2, '0')}`;
        await setDoc(doc(db, 'expenses', docId), cleanFirestoreData({
          ...e,
          id: docId,
          storeId
        }));
      }
      console.log('Seeded initial Mart Pro expenses');
    }

    // 4. Seed initial Sales if empty
    const salesSnap = await getDocs(collection(db, 'sales'));
    const storeSales = salesSnap.docs.filter(d => d.data().storeId === storeId);
    if (storeSales.length === 0) {
      const mockSales = [
        {
          id: 'sale_s1025',
          receiptNumber: 'S-1025',
          billNumber: '#S-1025',
          storeId,
          counterId: '1',
          counterName: 'Counter #1',
          cashierUsername: 'admin',
          cashierName: 'Admin',
          totalAmount: 1240,
          subtotalAmount: 1240,
          discountAmount: 0,
          paymentMethod: 'cash' as const,
          paymentMode: 'cash',
          status: 'completed' as const,
          timestamp: new Date().toISOString(),
          items: [
            { productId: 'prod_mp_01', name: 'Milk 1L', price: 220, quantity: 2, total: 440, barcode: '89640001001' },
            { productId: 'prod_mp_02', name: 'Bread Loaf', price: 120, quantity: 1, total: 120, barcode: '89640001002' },
            { productId: 'prod_mp_07', name: 'Tea 250g', price: 400, quantity: 1, total: 400, barcode: '89640001007' },
            { productId: 'prod_mp_12', name: 'Tomato Ketchup 800g', price: 260, quantity: 1, total: 260, barcode: '871234567890' }
          ]
        },
        {
          id: 'sale_s1024',
          receiptNumber: 'S-1024',
          billNumber: '#S-1024',
          storeId,
          counterId: '1',
          counterName: 'Counter #1',
          cashierUsername: 'admin',
          cashierName: 'Admin',
          totalAmount: 1080,
          subtotalAmount: 1080,
          discountAmount: 0,
          paymentMethod: 'online' as const,
          paymentMode: 'card',
          status: 'completed' as const,
          timestamp: new Date(Date.now() - 1400000).toISOString(),
          items: [
            { productId: 'prod_mp_09', name: 'Soft Drink 1.5L', price: 120, quantity: 4, total: 480, barcode: '89640001009' },
            { productId: 'prod_mp_08', name: 'Biscuits', price: 200, quantity: 3, total: 600, barcode: '89640001008' }
          ]
        },
        {
          id: 'sale_s1023',
          receiptNumber: 'S-1023',
          billNumber: '#S-1023',
          storeId,
          counterId: '1',
          counterName: 'Counter #1',
          cashierUsername: 'admin',
          cashierName: 'Admin',
          totalAmount: 560,
          subtotalAmount: 560,
          discountAmount: 0,
          paymentMethod: 'online' as const,
          paymentMode: 'jazzcash',
          status: 'completed' as const,
          timestamp: new Date(Date.now() - 1600000).toISOString(),
          items: [
            { productId: 'prod_mp_10', name: 'Noodles Pack', price: 140, quantity: 4, total: 560, barcode: '89640001010' }
          ]
        },
        {
          id: 'sale_s1022',
          receiptNumber: 'S-1022',
          billNumber: '#S-1022',
          storeId,
          counterId: '1',
          counterName: 'Counter #1',
          cashierUsername: 'admin',
          cashierName: 'Admin',
          totalAmount: 3740,
          subtotalAmount: 3740,
          discountAmount: 0,
          paymentMethod: 'cash' as const,
          paymentMode: 'cash',
          status: 'completed' as const,
          timestamp: new Date(Date.now() - 2600000).toISOString(),
          items: [
            { productId: 'prod_mp_04', name: 'Cooking Oil 5L', price: 1800, quantity: 1, total: 1800, barcode: '89640001004' },
            { productId: 'prod_mp_05', name: 'Rice 5kg', price: 1600, quantity: 1, total: 1600, barcode: '89640001005' },
            { productId: 'prod_mp_06', name: 'Sugar 1kg', price: 160, quantity: 2, total: 320, barcode: '89640001006' }
          ]
        },
        {
          id: 'sale_s1021',
          receiptNumber: 'S-1021',
          billNumber: '#S-1021',
          storeId,
          counterId: '1',
          counterName: 'Counter #1',
          cashierUsername: 'admin',
          cashierName: 'Admin',
          totalAmount: 840,
          subtotalAmount: 840,
          discountAmount: 0,
          paymentMethod: 'online' as const,
          paymentMode: 'easypaisa',
          status: 'completed' as const,
          timestamp: new Date(Date.now() - 3900000).toISOString(),
          items: [
            { productId: 'prod_mp_11', name: 'Detergent Powder 1kg', price: 265, quantity: 2, total: 530, barcode: '89640001011' },
            { productId: 'prod_mp_12', name: 'Shampoo 400ml', price: 300, quantity: 1, total: 300, barcode: '89640001012' }
          ]
        }
      ];

      for (const s of mockSales) {
        await setDoc(doc(db, 'sales', s.id), cleanFirestoreData(s));
      }
      console.log('Seeded initial Mart Pro sales');
    }

    // 5. Seed Activity Logs if empty
    const actSnap = await getDocs(collection(db, 'activity_logs'));
    const storeActs = actSnap.docs.filter(d => d.data().storeId === storeId);
    if (storeActs.length === 0) {
      const mockActivities: ActivityLog[] = [
        {
          id: 'act_1',
          storeId,
          title: 'Sale completed',
          description: 'Rs. 1,240 (Bill #S-1025)',
          type: 'sale',
          amount: 1240,
          timestamp: new Date().toISOString()
        },
        {
          id: 'act_2',
          storeId,
          title: 'Stock updated',
          description: 'Milk 1L (+24 Units)',
          type: 'stock',
          timestamp: new Date(Date.now() - 540000).toISOString()
        },
        {
          id: 'act_3',
          storeId,
          title: 'New order',
          description: '#PO-104 (Fresh Foods Ltd.)',
          type: 'order',
          timestamp: new Date(Date.now() - 540000).toISOString()
        }
      ];
      for (const a of mockActivities) {
        await setDoc(doc(db, 'activity_logs', a.id), cleanFirestoreData(a));
      }
    }
  } catch (err) {
    console.warn('Error seeding Mart Pro data:', err);
  }
}
