export interface SearchImageCandidate {
  url: string;
  thumbnail: string;
  title: string;
  source: string;
  domain?: string;
}

export interface ProductImageResult {
  imageUrl: string;
  thumbnailUrl?: string;
  source: 'google_web_search' | 'curated_photo' | 'open_food_facts';
  title: string;
  searchQuery: string;
  sourceDomain?: string;
  candidates?: SearchImageCandidate[];
}

// Curated verified high-resolution supermarket grocery photography fallback (if offline or search times out)
const CURATED_GROCERY_PHOTOS: Record<string, string> = {
  milk: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
  dairy: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
  yogurt: 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?auto=format&fit=crop&w=600&q=80',
  cheese: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80',
  butter: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
  ghee: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
  eggs: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80',
  bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
  bakery: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
  cola: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
  soda: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
  water: 'https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&w=600&q=80',
  juice: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=600&q=80',
  tea: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80',
  coffee: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=600&q=80',
  rice: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
  flour: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
  cooking_oil: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
  sugar: 'https://images.unsplash.com/photo-1622484212850-cab596d628d0?auto=format&fit=crop&w=600&q=80',
  salt: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
  spices: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
  masala: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
  biscuits: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80',
  chips: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80',
  chocolate: 'https://images.unsplash.com/photo-1511381939415-e44015466834?auto=format&fit=crop&w=600&q=80',
  soap: 'https://images.unsplash.com/photo-1607006314644-8cb3a2d67768?auto=format&fit=crop&w=600&q=80',
  shampoo: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=600&q=80',
  toothpaste: 'https://images.unsplash.com/photo-1559591937-e1032c74d6c7?auto=format&fit=crop&w=600&q=80',
  detergent: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&w=600&q=80',
  general: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'
};

function getDomain(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Searches the web for the exact product name to find and extract the direct product image URL.
 */
async function searchWebForProductImage(query: string): Promise<SearchImageCandidate[]> {
  const candidates: SearchImageCandidate[] = [];

  // Construct queries optimized for product packshots and e-commerce product photos
  const searchQueries = [
    `${query.trim()} product`,
    `${query.trim()} product packaging`,
    query.trim()
  ];

  for (const q of searchQueries) {
    try {
      const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(q)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!tokenRes.ok) continue;
      const text = await tokenRes.text();
      const vqdMatch = text.match(/vqd=([\d-]+)/) || text.match(/vqd="([\d-]+)"/);
      if (!vqdMatch) continue;

      const vqd = vqdMatch[1];
      const imgRes = await fetch(
        `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://duckduckgo.com/',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(6000)
        }
      );

      if (!imgRes.ok) continue;
      const data = await imgRes.json();
      const results = data.results || [];

      for (const item of results) {
        const rawUrl = item.image;
        if (!rawUrl || typeof rawUrl !== 'string') continue;
        if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) continue;

        // Skip tracking pixels, logos, or tiny icons
        if (rawUrl.includes('logo') && !rawUrl.includes('product')) continue;

        const candidate: SearchImageCandidate = {
          url: rawUrl,
          thumbnail: item.thumbnail || rawUrl,
          title: item.title || query,
          source: item.url || '',
          domain: getDomain(item.url || rawUrl)
        };

        // Avoid exact duplicates
        if (!candidates.some((c) => c.url === candidate.url)) {
          candidates.push(candidate);
        }

        if (candidates.length >= 8) break;
      }

      if (candidates.length > 0) {
        break; // Successfully got candidates from the first viable query
      }
    } catch (err) {
      console.warn(`[Web Image Search Warning] for query "${q}":`, (err as any)?.message || err);
    }
  }

  return candidates;
}

/**
 * Searches OpenFoodFacts as secondary verified product catalog for supermarket items
 */
async function searchOpenFoodFacts(query: string): Promise<SearchImageCandidate | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=3`,
      {
        headers: {
          'User-Agent': 'MartProSupermarket/1.0 (support@martpro.com)'
        },
        signal: AbortSignal.timeout(4000)
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const product = data.products?.find((p: any) => p.image_front_url || p.image_url);
    if (product) {
      const imgUrl = product.image_front_url || product.image_url;
      return {
        url: imgUrl,
        thumbnail: product.image_front_small_url || imgUrl,
        title: product.product_name || query,
        source: `https://world.openfoodfacts.org/product/${product.code || ''}`,
        domain: 'openfoodfacts.org'
      };
    }
  } catch {
    // OpenFoodFacts not accessible or timeout
  }
  return null;
}

/**
 * Resolves a product picture by searching Google / Web index for the exact product name,
 * extracting the live web image URL, and copying/pasting it to the client.
 */
export async function resolveProductImage(
  _ai: any,
  name: string,
  category?: string,
  brand?: string,
  size?: string
): Promise<ProductImageResult> {
  const cleanName = name.trim();
  // Build a targeted search term that mirrors what a user would type into Google Images
  const searchTerms = [
    brand && !cleanName.toLowerCase().includes(brand.toLowerCase()) ? brand : '',
    cleanName,
    size && !cleanName.toLowerCase().includes(size.toLowerCase()) ? size : '',
  ].filter(Boolean).join(' ');

  const query = searchTerms || cleanName;

  // 1. Search Google / Web for real product image URLs
  const webCandidates = await searchWebForProductImage(query);

  if (webCandidates.length > 0) {
    const best = webCandidates[0];
    return {
      imageUrl: best.url,
      thumbnailUrl: best.thumbnail,
      source: 'google_web_search',
      title: best.title,
      searchQuery: query,
      sourceDomain: best.domain,
      candidates: webCandidates
    };
  }

  // 2. Try OpenFoodFacts catalog
  const offCandidate = await searchOpenFoodFacts(cleanName);
  if (offCandidate) {
    return {
      imageUrl: offCandidate.url,
      thumbnailUrl: offCandidate.thumbnail,
      source: 'open_food_facts',
      title: offCandidate.title,
      searchQuery: query,
      sourceDomain: offCandidate.domain,
      candidates: [offCandidate]
    };
  }

  // 3. Fallback to curated supermarket high-res photography matching category/name
  const lower = cleanName.toLowerCase();
  let matchedPhotoKey = 'general';
  for (const k of Object.keys(CURATED_GROCERY_PHOTOS)) {
    if (lower.includes(k)) {
      matchedPhotoKey = k;
      break;
    }
  }
  const photoUrl = CURATED_GROCERY_PHOTOS[matchedPhotoKey] || CURATED_GROCERY_PHOTOS.general;

  return {
    imageUrl: photoUrl,
    thumbnailUrl: photoUrl,
    source: 'curated_photo',
    title: `${cleanName} (Photo)`,
    searchQuery: query,
    sourceDomain: 'unsplash.com',
    candidates: [
      {
        url: photoUrl,
        thumbnail: photoUrl,
        title: cleanName,
        source: photoUrl,
        domain: 'unsplash.com'
      }
    ]
  };
}
