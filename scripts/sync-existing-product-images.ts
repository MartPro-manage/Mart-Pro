import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { resolveProductImage } from '../src/server/productImageService.ts';

async function main() {
  console.log('[Product Image Sync] Starting full catalog image sync...');
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    console.error('Firebase config not found');
    process.exit(1);
  }

  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const dbId = firebaseConfig?.firestoreDatabaseId;
  const db = dbId ? getFirestore(firebaseApp, dbId) : getFirestore(firebaseApp);

  const snap = await getDocs(collection(db, 'products'));
  console.log(`[Product Image Sync] Found ${snap.size} total products in database.`);

  const productsToUpdate: any[] = [];
  snap.forEach(d => {
    const data = d.data();
    const img = (data.imageUrl || '').trim();
    const isGeneric = img.includes('photo-1542838132-92c53300491e');
    if (!img || isGeneric) {
      productsToUpdate.push({ id: d.id, ...data });
    }
  });

  console.log(`[Product Image Sync] ${productsToUpdate.length} products need images.`);

  let updatedCount = 0;
  const chunkSize = 20;

  for (let i = 0; i < productsToUpdate.length; i += chunkSize) {
    const chunk = productsToUpdate.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (item) => {
      if (!item.name) return;
      try {
        const result = await resolveProductImage(null, item.name, item.category, item.brand, item.size);
        if (result && result.imageUrl) {
          await updateDoc(doc(db, 'products', item.id), {
            imageUrl: result.imageUrl,
            updatedAt: new Date().toISOString()
          });
          updatedCount++;
          console.log(`[${updatedCount}/${productsToUpdate.length}] ✓ "${item.name}" -> ${result.imageUrl.slice(0, 60)}...`);
        }
      } catch (err: any) {
        console.warn(`Failed for "${item.name}":`, err.message);
      }
    }));
  }

  console.log(`[Product Image Sync] Completed! Successfully assigned authentic images to ${updatedCount} products.`);
  process.exit(0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
