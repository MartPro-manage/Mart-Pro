import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Sale, Store } from '../types';

// Connect to Z-Sender SwiftSend Mail database instance
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const zSenderDb = getFirestore(app, "ai-studio-swiftsendmail-d8a0838e-1f0f-4a11-a1f8-e5569821a2ad");

export const DEFAULT_Z_SENDER_USER_ID = "supermarketmanage@gmail.com";

export interface QueueEmailParams {
  userId?: string;
  toEmail: string;
  sale: Sale;
  store: Store;
}

/**
 * Queue E-Receipt email directly for INSTANT dispatch in Z-Sender database
 */
export async function queueEReceiptEmail({
  userId,
  toEmail,
  sale,
  store
}: QueueEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const targetUserId = userId || store.zSenderUserId || DEFAULT_Z_SENDER_USER_ID;
    
    const receiptNo = sale.receiptNumber || `#${sale.id.slice(-6).toUpperCase()}`;
    const storeName = store.name || 'Mart Pro Supermarket';
    const totalAmount = (sale.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const currency = store.currencySymbol || 'Rs.';

    const totalSavings = (sale.items || []).reduce((sum, item) => {
      if (item.originalPrice && item.originalPrice > item.price) {
        return sum + ((item.originalPrice - item.price) * (item.quantity || 1));
      }
      if (item.discountAmount && item.discountAmount > 0) {
        return sum + item.discountAmount;
      }
      return sum;
    }, 0) + (sale.discountAmount || 0);

    const itemsHtml = (sale.items || []).map(item => {
      const unitLabel = item.unitType || (item.sellBy === 'weight' ? 'kg' : 'pcs');
      const itemPrice = item.price || 0;
      const itemTotal = item.total || (itemPrice * (item.quantity || 1));

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 6px; color: #1e293b; font-weight: 600;">${item.name}</td>
          <td style="padding: 10px 6px; text-align: center; color: #475569;">${item.quantity} ${unitLabel}</td>
          <td style="padding: 10px 6px; text-align: right; color: #475569;">${currency} ${itemPrice.toFixed(2)}</td>
          <td style="padding: 10px 6px; text-align: right; color: #0f172a; font-weight: 700;">${currency} ${itemTotal.toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const publicReceiptUrl = `${origin}/?receiptId=${sale.id}&no=${encodeURIComponent(receiptNo)}`;

    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background-color: #ea580c; color: #ffffff; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">${storeName}</h1>
          <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Official Digital E-Receipt</p>
        </div>

        <div style="padding: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 13px; color: #64748b; border-bottom: 2px dashed #cbd5e1; padding-bottom: 12px;">
            <div>
              <strong>Receipt No:</strong> <span style="color: #0f172a; font-weight: 700;">${receiptNo}</span><br/>
              <strong>Date:</strong> ${new Date(sale.timestamp || Date.now()).toLocaleString()}
            </div>
            <div style="text-align: right;">
              <strong>Payment:</strong> ${(sale.paymentMethod || 'cash').toUpperCase()}<br/>
              <strong>Cashier:</strong> ${sale.cashierName || sale.cashierUsername || 'Cash Counter'}
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f8fafc; color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                <th style="padding: 8px 6px; text-align: left;">Item</th>
                <th style="padding: 8px 6px; text-align: center;">Qty</th>
                <th style="padding: 8px 6px; text-align: right;">Price</th>
                <th style="padding: 8px 6px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="background-color: #fff7ed; border: 1px solid #ffedd5; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; color: #ea580c;">
              <span>TOTAL PAID:</span>
              <span>${currency} ${totalAmount}</span>
            </div>
            ${totalSavings > 0 ? `
              <div style="font-size: 12px; color: #16a34a; margin-top: 6px; font-weight: 600;">
                🎉 You Saved ${currency} ${totalSavings.toFixed(2)} on this purchase!
              </div>
            ` : ''}
          </div>

          <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
            <a href="${publicReceiptUrl}" target="_blank" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 8px;">
              View & Download Full E-Receipt Pass
            </a>
            <p style="font-size: 11px; color: #94a3b8; margin-top: 12px;">
              ${store.receiptFooter || 'Thank you for shopping with us! Please come again.'}
            </p>
          </div>
        </div>
      </div>
    `;

    const now = new Date();
    const scheduledTime = new Date(now.getTime() + 2 * 60 * 1000);
    const nowIso = now.toISOString();
    const scheduledAtIso = scheduledTime.toISOString();

    const emailPayload = {
      userId: targetUserId,
      toEmail: toEmail.trim(),
      subject: `E-Receipt ${receiptNo} - ${storeName}`,
      body: emailBody,
      scheduledAt: scheduledAtIso, // Scheduled for 2 minutes from now
      sendNow: true,
      sendImmediately: true,
      status: "pending",
      attachmentCount: 0,
      createdAt: nowIso
    };

    // Ensure we are signed in as the registered merchant so that we are authenticated with Firebase when writing to zSenderDb
    let authUid = targetUserId;
    try {
      const { getAuth, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
      const auth = getAuth(app);
      if (!auth.currentUser) {
        try {
          await signInWithEmailAndPassword(auth, "supermarketmanage@gmail.com", "Hashir@56");
          console.log('[Z-Sender] Authenticated successfully as merchant');
        } catch (pAuthErr: any) {
          const errCode = pAuthErr?.code || '';
          if (errCode === 'auth/user-not-found' || errCode === 'auth/invalid-credential' || pAuthErr?.message?.includes('not-found') || pAuthErr?.message?.includes('credential')) {
            try {
              await createUserWithEmailAndPassword(auth, "supermarketmanage@gmail.com", "Hashir@56");
              console.log('[Z-Sender] Created and authenticated merchant Auth user successfully!');
            } catch (createErr) {
              console.warn('[Z-Sender] Could not create merchant Auth user, trying anonymous fallback:', createErr);
              await signInAnonymously(auth);
            }
          } else {
            console.warn('[Z-Sender] Merchant sign-in failed, trying anonymous fallback:', pAuthErr);
            await signInAnonymously(auth);
          }
        }
      }
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        authUid = auth.currentUser.uid;
      } else {
        authUid = targetUserId; // Keep email-based path for merchant login
      }
    } catch (authErr) {
      console.warn('[Z-Sender] Failed to authenticate:', authErr);
    }

    const docRef = await addDoc(collection(zSenderDb, "users", authUid, "scheduledEmails"), emailPayload);

    console.log(`[Z-Sender] Instant E-Receipt queued for ${toEmail} with ID: ${docRef.id}`);
    return { success: true, id: docRef.id };
  } catch (err: any) {
    console.error('[Z-Sender] Failed to dispatch instant E-Receipt email:', err);
    return { success: false, error: err?.message || 'Failed to connect to email service' };
  }
}
