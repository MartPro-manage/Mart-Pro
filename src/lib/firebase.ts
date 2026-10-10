import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  memoryLocalCache,
  setLogLevel,
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  onSnapshot,
  orderBy,
  runTransaction,
  writeBatch,
  increment
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserAccount, Store, Product, Sale } from '../types';

// Suppress transient internal connection retry warnings in console
try {
  setLogLevel('silent');
} catch {
  // ignore
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function initDb() {
  try {
    const dbId = (firebaseConfig as any)?.firestoreDatabaseId;
    return dbId ? getFirestore(app, dbId) : getFirestore(app);
  } catch (err) {
    console.warn('getFirestore error fallback:', err);
    return getFirestore(app);
  }
}

export const db = initDb();

/**
 * Removes any undefined values recursively from objects and arrays before writing to Firestore
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanFirestoreData(item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: message,
    operationType,
    path
  };
  console.warn(`Firestore [${operationType}] at ${path}:`, message);
  return errInfo;
}

// Default Super Admin credentials constant
export const SUPER_ADMIN_USERNAME = 'supermarketmanage@gmail.com';
export const SUPER_ADMIN_PASSWORD = 'Hashir@56';
export const SUPER_ADMIN_SAFETY_PIN = '10092010'; // 8-digit master 2FA safety security passkey

// Seed initial super admin if not present
export async function ensureSuperAdminExists(): Promise<void> {
  try {
    const superAdminQuery = query(
      collection(db, 'users'), 
      where('username', '==', SUPER_ADMIN_USERNAME)
    );
    const snapshot = await getDocs(superAdminQuery);
    
    if (snapshot.empty) {
      const superAdminDocRef = doc(collection(db, 'users'));
      const superAdminData: UserAccount = {
        id: superAdminDocRef.id,
        storeId: 'all',
        storeName: 'Main Network',
        role: 'super_admin',
        username: SUPER_ADMIN_USERNAME,
        password: SUPER_ADMIN_PASSWORD,
        name: 'Super Admin',
        createdAt: new Date().toISOString()
      };
      await setDoc(superAdminDocRef, cleanFirestoreData(superAdminData));
      console.log('Super Admin account seeded successfully');
    }

    // Seed H A Mart Store with Online Store ID and Products if needed
    await ensureHAMartExists();
  } catch (error) {
    console.warn('Super Admin account check deferred (offline / connecting):', error);
  }
}

export async function ensureHAMartExists(): Promise<void> {
  try {
    const storeQuery = query(collection(db, 'stores'), where('onlineStoreId', '==', 'ha-mart'));
    const storeSnap = await getDocs(storeQuery);

    let haMartId = 'ha-mart-store';
    if (storeSnap.empty) {
      // Check if named "H A Mart"
      const nameQuery = query(collection(db, 'stores'), where('name', '==', 'H A Mart'));
      const nameSnap = await getDocs(nameQuery);

      if (!nameSnap.empty) {
        haMartId = nameSnap.docs[0].id;
        await updateDoc(doc(db, 'stores', haMartId), {
          onlineStoreId: 'ha-mart',
          onlineStoreEnabled: true,
          onlineStoreDeliveryFee: 150,
          onlineStoreMinOrder: 500,
          onlineApiKey: 'mart_live_ha_mart_sec_8849',
          onlineStorePhone: '0300-8899770',
          onlineStoreNotice: 'Special 10% to 25% Off on Selected Grocery & Essentials!'
        });
      } else {
        const storeDocRef = doc(db, 'stores', haMartId);
        const haMartData: Store = {
          id: haMartId,
          name: 'H A Mart',
          adminUsername: 'hamartadmin',
          adminPassword: 'hamart123',
          phone: '0300-8899770',
          address: 'Main Commercial Market, Block 4, Lahore',
          status: 'active',
          onlineStoreEnabled: true,
          onlineStoreId: 'ha-mart',
          onlineApiKey: 'mart_live_ha_mart_sec_8849',
          onlineStorePhone: '0300-8899770',
          onlineStoreDeliveryFee: 150,
          onlineStoreMinOrder: 500,
          onlineStoreNotice: 'Special 10% to 25% Off on Selected Grocery, Snacks & Beverages!',
          onlineStoreEstimatedTime: '30-45 mins',
          cameraScannerEnabled: true,
          voiceAnnouncementEnabled: true,
          currencySymbol: 'Rs.',
          createdAt: new Date().toISOString()
        };
        await setDoc(storeDocRef, cleanFirestoreData(haMartData));

        // Create H A Mart store admin user
        const userDocRef = doc(db, 'users', 'user_hamartadmin');
        const userData: UserAccount = {
          id: 'user_hamartadmin',
          storeId: haMartId,
          storeName: 'H A Mart',
          role: 'store_admin',
          username: 'hamartadmin',
          password: 'hamart123',
          name: 'H A Mart Admin',
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, cleanFirestoreData(userData));

        // Seed initial products with stock, price, wholesale cost & active discount offers
        const sampleProducts: Partial<Product>[] = [
          {
            id: 'prod_ha_01',
            barcode: '89640001001',
            shortcutCode: '1001',
            name: 'Super Basmati Rice 5kg',
            category: 'Grocery & Staples',
            price: 1650,
            costPrice: 1380,
            stockQuantity: 50,
            unitType: 'piece',
            sellBy: 'unit',
            discountActive: true,
            discountType: 'fixed',
            discountValue: 150,
            imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80'
          },
          {
            id: 'prod_ha_02',
            barcode: '89640001002',
            shortcutCode: '1002',
            name: 'Habib Cooking Oil 5 Liter',
            category: 'Cooking & Oil',
            price: 2850,
            costPrice: 2450,
            stockQuantity: 35,
            unitType: 'liter',
            sellBy: 'unit',
            discountActive: true,
            discountType: 'percentage',
            discountValue: 10,
            imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80'
          },
          {
            id: 'prod_ha_03',
            barcode: '89640001003',
            shortcutCode: '1003',
            name: "Olper's Full Cream Milk 1L",
            category: 'Dairy & Eggs',
            price: 280,
            costPrice: 245,
            stockQuantity: 120,
            unitType: 'liter',
            sellBy: 'unit',
            discountActive: false,
            imageUrl: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=500&auto=format&fit=crop&q=80'
          },
          {
            id: 'prod_ha_04',
            barcode: '89640001004',
            shortcutCode: '1004',
            name: 'Tapal Danedar Tea 430g',
            category: 'Beverages',
            price: 720,
            costPrice: 610,
            stockQuantity: 60,
            unitType: 'piece',
            sellBy: 'unit',
            discountActive: true,
            discountType: 'percentage',
            discountValue: 15,
            imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=80'
          },
          {
            id: 'prod_ha_05',
            barcode: '89640001005',
            shortcutCode: '1005',
            name: 'Farm Fresh Organic Eggs (Dozen)',
            category: 'Dairy & Eggs',
            price: 320,
            costPrice: 270,
            stockQuantity: 45,
            unitType: 'dozen',
            sellBy: 'unit',
            discountActive: false,
            imageUrl: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=500&auto=format&fit=crop&q=80'
          },
          {
            id: 'prod_ha_06',
            barcode: '89640001006',
            shortcutCode: '1006',
            name: 'Fresh Red Kashmiri Apples (1kg)',
            category: 'Fresh Fruits & Veg',
            price: 360,
            costPrice: 260,
            stockQuantity: 75,
            unitType: 'kg',
            sellBy: 'weight',
            discountActive: true,
            discountType: 'fixed',
            discountValue: 40,
            imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&auto=format&fit=crop&q=80'
          },
          {
            id: 'prod_ha_07',
            barcode: '89640001007',
            shortcutCode: '1007',
            name: 'Surf Excel Detergent Powder 1kg',
            category: 'Household & Cleaning',
            price: 690,
            costPrice: 580,
            stockQuantity: 40,
            unitType: 'kg',
            sellBy: 'unit',
            discountActive: true,
            discountType: 'percentage',
            discountValue: 12,
            imageUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=500&auto=format&fit=crop&q=80'
          },
          {
            id: 'prod_ha_08',
            barcode: '89640001008',
            shortcutCode: '1008',
            name: 'Coca-Cola 1.5 Liter Bottle',
            category: 'Beverages',
            price: 190,
            costPrice: 155,
            stockQuantity: 90,
            unitType: 'liter',
            sellBy: 'unit',
            discountActive: false,
            imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80'
          },
          {
            id: 'prod_ha_09',
            barcode: '89640001009',
            shortcutCode: '1009',
            name: 'Chakki Whole Wheat Atta 10kg',
            category: 'Grocery & Staples',
            price: 1450,
            costPrice: 1240,
            stockQuantity: 55,
            unitType: 'kg',
            sellBy: 'unit',
            discountActive: true,
            discountType: 'fixed',
            discountValue: 100,
            imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80'
          }
        ];

        for (const p of sampleProducts) {
          const pRef = doc(db, 'products', p.id!);
          await setDoc(pRef, cleanFirestoreData({
            ...p,
            storeId: haMartId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));
        }
        console.log('H A Mart seeded with online store ID and catalog.');
      }
    }
  } catch (err) {
    console.warn('ensureHAMartExists check deferred:', err);
  }
}

export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  runTransaction,
  writeBatch,
  increment
};
