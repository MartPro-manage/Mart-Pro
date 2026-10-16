import { db, collection, getDocs, doc, updateDoc } from '../src/lib/firebase';
import { resolveProductImage } from '../src/server/productImageService';

async function main() {
  console.log('🔄 Starting automated product image sync for all existing products...');

  const snapshot = await getDocs(collection(db, 'products'));
  const allDocs = snapshot.docs;
  console.log(`📦 Found ${allDocs.length} total products in database.`);

  const toUpdate = allDocs.filter((d) => {
    const data = d.data();
    return !data.imageUrl || typeof data.imageUrl !== 'string' || data.imageUrl.trim() === '';
  });

  console.log(`🎯 Products needing images: ${toUpdate.length}`);
  if (toUpdate.length === 0) {
    console.log('✅ All products already have images attached!');
    process.exit(0);
  }

  const nameToImageCache = new Map<string, string>();
  let completed = 0;
  let successCount = 0;
  let errorCount = 0;

  // Process in small parallel chunks to maximize throughput while avoiding rate limits
  const CONCURRENCY = 6;
  const queue = [...toUpdate];

  async function worker(workerId: number) {
    while (queue.length > 0) {
      const docSnap = queue.shift();
      if (!docSnap) break;

      const data = docSnap.data();
      const productName = (data.name || '').trim();
      const productCategory = data.category || '';
      completed++;

      if (!productName) {
        console.log(`[${completed}/${toUpdate.length}] (Worker ${workerId}) Skipping product ${docSnap.id} (no name)`);
        continue;
      }

      const cacheKey = `${productName.toLowerCase()}__${productCategory.toLowerCase()}`;
      let resolvedUrl: string | undefined = nameToImageCache.get(cacheKey);

      if (!resolvedUrl) {
        try {
          const res = await resolveProductImage(null, productName, productCategory);
          if (res && res.imageUrl) {
            resolvedUrl = res.imageUrl;
            nameToImageCache.set(cacheKey, resolvedUrl);
          }
        } catch (e: any) {
          console.warn(`[${completed}/${toUpdate.length}] Error resolving "${productName}":`, e?.message);
        }
      }

      if (resolvedUrl) {
        try {
          await updateDoc(doc(db, 'products', docSnap.id), {
            imageUrl: resolvedUrl,
            updatedAt: new Date().toISOString()
          });
          successCount++;
          console.log(`[${completed}/${toUpdate.length}] ✓ Added image to "${productName}" (${docSnap.id}) -> ${resolvedUrl.slice(0, 50)}...`);
        } catch (updateErr: any) {
          errorCount++;
          console.error(`Failed to update doc ${docSnap.id}:`, updateErr?.message);
        }
      } else {
        errorCount++;
        console.warn(`[${completed}/${toUpdate.length}] ✗ No image resolved for "${productName}"`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  console.log(`\n🎉 Image sync finished!`);
  console.log(`   Total processed: ${completed}`);
  console.log(`   Successfully updated: ${successCount}`);
  console.log(`   Errors / Skipped: ${errorCount}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
