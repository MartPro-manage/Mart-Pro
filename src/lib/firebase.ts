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

// Safely initialize Firestore with memoryLocalCache to prevent Chrome IndexedDB LevelDB FILE_ERROR_NO_SPACE crashes
function initDb() {
  const dbId = firebaseConfig.firestoreDatabaseId || undefined;
  try {
    if (dbId) {
      return initializeFirestore(app, { localCache: memoryLocalCache() }, dbId);
    }
    return initializeFirestore(app, { localCache: memoryLocalCache() });
  } catch (err) {
    console.warn('initializeFirestore warning, falling back to getFirestore:', err);
    return dbId ? getFirestore(app, dbId) : getFirestore(app);
  }
}

export const db = initDb();

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
