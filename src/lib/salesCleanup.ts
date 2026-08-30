import { db, collection, getDocs, doc, deleteDoc, query, where } from './firebase';
import { Sale } from '../types';

export const RECEIPT_EXPIRY_DAYS = 7;
export const RECEIPT_EXPIRY_MS = RECEIPT_EXPIRY_DAYS * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Checks if a receipt/sale timestamp has passed the 7-day retention limit
 */
export function isSaleExpired(saleOrTimestamp: Sale | string | null | undefined): boolean {
  if (!saleOrTimestamp) return false;
  const timestampStr = typeof saleOrTimestamp === 'string' ? saleOrTimestamp : saleOrTimestamp.timestamp;
  if (!timestampStr) return false;
  
  const saleTime = new Date(timestampStr).getTime();
  if (isNaN(saleTime)) return false;

  return (Date.now() - saleTime) > RECEIPT_EXPIRY_MS;
}

/**
 * Gets remaining active days for a receipt before automatic deletion
 */
export function getReceiptRemainingDays(timestampStr: string): number {
  const saleTime = new Date(timestampStr).getTime();
  if (isNaN(saleTime)) return 0;
  
  const elapsedMs = Date.now() - saleTime;
  const remainingMs = RECEIPT_EXPIRY_MS - elapsedMs;
  if (remainingMs <= 0) return 0;
  
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

/**
 * Auto-cleans expired receipts older than 7 days from Firestore.
 * Runs in background safely without blocking UI.
 */
export async function cleanupExpiredReceipts(storeId?: string): Promise<number> {
  try {
    const cutoffTime = new Date(Date.now() - RECEIPT_EXPIRY_MS).toISOString();
    
    let salesQuery = storeId 
      ? query(collection(db, 'sales'), where('storeId', '==', storeId))
      : query(collection(db, 'sales'));

    const snapshot = await getDocs(salesQuery);
    let deletedCount = 0;

    const deletePromises: Promise<void>[] = [];
    snapshot.forEach((saleDoc) => {
      const data = saleDoc.data();
      const saleTimestamp = data.timestamp || data.createdAt;
      
      // If older than 7 days or marked expired
      if (saleTimestamp && saleTimestamp < cutoffTime) {
        deletePromises.push(
          deleteDoc(doc(db, 'sales', saleDoc.id))
            .then(() => {
              deletedCount++;
            })
            .catch((e) => console.warn(`Failed to delete expired receipt ${saleDoc.id}:`, e))
        );
      }
    });

    if (deletePromises.length > 0) {
      await Promise.allSettled(deletePromises);
      console.log(`[Receipt Retention] Purged ${deletedCount} receipts older than ${RECEIPT_EXPIRY_DAYS} days.`);
    }

    return deletedCount;
  } catch (err) {
    console.warn('[Receipt Retention] Cleanup error:', err);
    return 0;
  }
}
