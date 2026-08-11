import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  memoryLocalCache,
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
  runTransaction
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserAccount, Store, Product, Sale } from '../types';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Safely initialize Firestore with memoryLocalCache and auto long polling to prevent network stream drops in Cloud Run/iframe environments
function initDb() {
  const dbId = firebaseConfig.firestoreDatabaseId || undefined;
  const firestoreSettings = {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true
  };
  try {
    if (dbId) {
      return initializeFirestore(app, firestoreSettings, dbId);
    }
    return initializeFirestore(app, firestoreSettings);
  } catch (err) {
    console.warn('initializeFirestore warning, falling back to getFirestore:', err);
    return dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
}

export const db = initDb();

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
      await setDoc(superAdminDocRef, superAdminData);
      console.log('Super Admin account seeded successfully');
    }
  } catch (error) {
    console.error('Error seeding Super Admin account:', error);
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
  runTransaction
};
