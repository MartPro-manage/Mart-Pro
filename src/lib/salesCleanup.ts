import { db, collection, getDocs, doc, deleteDoc, query, where } from './firebase';
import { Sale } from '../types';

// Receipts are retained FOREVER until the store is deleted by super admin
export const RECEIPT_EXPIRY_DAYS = Infinity;

/**
 * Receipts NEVER expire after 7 days.
 * All customer receipts, transactions, line items, and accounting records are saved FOREVER
 * until the store is deleted by super admin.
 */
export function isSlipExpired(_saleOrTimestamp?: Sale | string | null | undefined): boolean {
  return false;
}

// Backwards-compatible alias for existing imports
export const isSaleExpired = isSlipExpired;

/**
 * Returns permanent status for customer slips
 */
export function getReceiptRemainingDays(_timestampStr?: string): number {
  return 999999;
}

/**
 * Receipt Retention Engine:
 * In accordance with policy, customer receipts and sales are NEVER deleted after 7 days.
 * They are preserved FOREVER until the store is deleted by super admin.
 */
export async function cleanupExpiredReceipts(_storeId?: string): Promise<number> {
  // Permanent retention: receipts are never pruned after 7 days.
  return 0;
}

/**
 * Deletes all receipts and sales belonging to a store when the store itself
 * is deleted by super admin.
 */
export async function deleteStoreReceiptsOnStoreDelete(storeId: string): Promise<number> {
  if (!storeId) return 0;
  try {
    const salesQuery = query(collection(db, 'sales'), where('storeId', '==', storeId));
    const snapshot = await getDocs(salesQuery);
    const deletePromises: Promise<void>[] = [];
    snapshot.forEach((saleDoc) => {
      deletePromises.push(deleteDoc(doc(db, 'sales', saleDoc.id)));
    });
    await Promise.allSettled(deletePromises);
    return snapshot.size;
  } catch (err) {
    console.error(`Failed to delete sales for deleted store ${storeId}:`, err);
    return 0;
  }
}

