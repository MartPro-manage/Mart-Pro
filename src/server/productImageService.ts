export interface ProductImageCandidate {
  url: string;
  thumbnail: string;
  title: string;
  domain: string;
}

export interface ResolveImageResult {
  imageUrl: string;
  thumbnailUrl: string;
  source: string;
  sourceDomain: string;
  candidates: ProductImageCandidate[];
}

// Clean and prepare product search terms for maximum accuracy
export function normalizeProductName(name: string): { cleanName: string; searchTerms: string[] } {
  let clean = (name || '')
    .trim()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\w\s\.\-\&]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract core keywords
  const words = clean.split(' ').filter(w => w.length > 1);
  return { cleanName: clean, searchTerms: words };
}

// Curated High-Definition Produce & Supermarket Essentials
// Used for fresh farm produce, meat, and unbranded goods
const CURATED_PRODUCE_CATALOG: Array<{
  match: RegExp;
  url: string;
  title: string;
  domain: string;
}> = [
  // Fresh Produce - Vegetables
  {
    match: /\b(potato|potatoes|alu|aloo)\b/i,
    url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Farm Potatoes',
    domain: 'freshproduce.com'
  },
  {
    match: /\b(tomato|tomatoes|tamatar)\b/i,
    url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Ripe Red Tomatoes',
    domain: 'freshproduce.com'
  },
  {
    match: /\b(onion|onions|piyaz|pyaz)\b/i,
    url: 'https://images.unsplash.com/photo-1508747703725-719777637510?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Red Onions',
    domain: 'freshproduce.com'
  },
  {
    match: /\b(ginger|adrak|adark)\b/i,
    url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Organic Ginger Root',
    domain: 'freshproduce.com'
  },
  {
    match: /\b(garlic|lehsan|lasan)\b/i,
    url: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Whole Garlic Bulbs',
    domain: 'freshproduce.com'
  },
  {
    match: /\b(chilli|chillies|green\s*chilli|hari\s*mirch)\b/i,
    url: 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Hot Green Chillies',
    domain: 'freshproduce.com'
  },
  {
    match: /\b(lemon|lemons|lime|limu|nimbu)\b/i,
    url: 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Yellow Juicy Lemons',
    domain: 'freshproduce.com'
  },
  {
    match: /\b(cucumber|kheera)\b/i,
    url: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?auto=format&fit=crop&w=600&q=80',
    title: 'Crisp Green Cucumbers',
    domain: 'freshproduce.com'
  },
  {
    match: /\b(carrot|carrots|gajar)\b/i,
    url: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5c317?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Crunchy Orange Carrots',
    domain: 'freshproduce.com'
  },

  // Fresh Fruits
  {
    match: /\b(apple|apples|saib)\b/i,
    url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Crisp Red Apples',
    domain: 'freshproduce.com'
  },
  {
    match: /\b(banana|bananas|kela)\b/i,
    url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Sweet Yellow Bananas',
    domain: 'freshproduce.com'
  },
  {
    match: /\b(orange|oranges|kinnow|keno|maltay)\b/i,
    url: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=600&q=80',
    title: 'Juicy Fresh Oranges',
    domain: 'freshproduce.com'
  },
  {
    match: /\b(mango|mangoes|aam)\b/i,
    url: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80',
    title: 'Sweet Golden Mangoes',
    domain: 'freshproduce.com'
  },
  {
    match: /\b(pomegranate|anar)\b/i,
    url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Red Pomegranates',
    domain: 'freshproduce.com'
  },

  // Fresh Meat & Poultry
  {
    match: /\b(chicken|chiken|murgi|whole\s*chicken|chicken\s*breast|boneless)\b/i,
    url: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Halal Chicken Cuts',
    domain: 'freshmeat.com'
  },
  {
    match: /\b(beef|mutton|gosht|lamb|mince|keema|chops)\b/i,
    url: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80',
    title: 'Fresh Halal Mutton & Beef Meat',
    domain: 'freshmeat.com'
  },
  {
    match: /\b(egg|eggs|anday|anda)\b/i,
    url: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=600&q=80',
    title: 'Farm Fresh White & Brown Eggs',
    domain: 'dairy.com'
  }
];

// 1. High-Precision Real Web Product Image Engine (Bing Ecommerce/Retail Index)
async function searchWebProductImages(
  query: string,
  brand?: string,
  size?: string
): Promise<ProductImageCandidate[]> {
  const candidates: ProductImageCandidate[] = [];
  const seenUrls = new Set<string>();

  // Construct search query targeting real product packaging
  const searchPhrase = [query, brand, size, 'product packaging'].filter(Boolean).join(' ');
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(searchPhrase)}&form=HDRSC2&first=1`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return candidates;
    const html = await res.text();

    const murlMatches = [...html.matchAll(/&quot;murl&quot;:&quot;([^&]+)&quot;/g)];
    const titleMatches = [...html.matchAll(/&quot;t&quot;:&quot;([^&]+)&quot;/g)];
    const purlMatches = [...html.matchAll(/&quot;purl&quot;:&quot;([^&]+)&quot;/g)];

    for (let i = 0; i < murlMatches.length && candidates.length < 10; i++) {
      const imgUrl = murlMatches[i][1];
      if (!imgUrl || seenUrls.has(imgUrl)) continue;

      // Filter out low quality, tracker, or non-image links
      if (
        imgUrl.includes('.svg') ||
        imgUrl.includes('data:image') ||
        imgUrl.includes('pixel') ||
        imgUrl.includes('favicon') ||
        imgUrl.includes('placeholder') ||
        imgUrl.includes('1x1')
      ) {
        continue;
      }

      seenUrls.add(imgUrl);

      let domain = 'retailer';
      try {
        if (purlMatches[i]?.[1]) {
          domain = new URL(purlMatches[i][1]).hostname.replace(/^www\./, '');
        }
      } catch {
        // ignore
      }

      const rawTitle = titleMatches[i]?.[1] || query;
      const cleanTitle = rawTitle
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '\"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();

      candidates.push({
        url: imgUrl,
        thumbnail: imgUrl,
        title: cleanTitle,
        domain
      });
    }
  } catch (err) {
    // Network or timeout error
  }

  return candidates;
}

// 2. Open Food Facts Database Search (Official Global FMCG Barcode/Pack Photo Registry)
async function searchOpenFoodFacts(term: string, barcode?: string): Promise<ProductImageCandidate[]> {
  const candidates: ProductImageCandidate[] = [];

  // If a barcode is provided, lookup the exact product first
  if (barcode && /^\d{6,14}$/.test(barcode.trim())) {
    try {
      const url = `https://world.openfoodfacts.org/api/v0/product/${barcode.trim()}.json`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'MartPro-POS/2.0 (supermarketmanage@gmail.com)' },
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        const p = data.product;
        const img = p?.image_front_url || p?.image_url;
        if (img) {
          candidates.push({
            url: img,
            thumbnail: p.image_front_small_url || p.image_small_url || img,
            title: p.product_name || term,
            domain: 'openfoodfacts.org'
          });
          return candidates;
        }
      }
    } catch {
      // ignore
    }
  }

  // Search by text terms
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(term)}&search_simple=1&action=process&json=1&page_size=4`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MartPro-POS/2.0 (supermarketmanage@gmail.com)' },
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) return candidates;

    const data = await res.json();
    const products = data.products || [];

    for (const p of products) {
      const img = p.image_front_url || p.image_url;
      if (img && typeof img === 'string') {
        candidates.push({
          url: img,
          thumbnail: p.image_front_small_url || p.image_small_url || img,
          title: [p.brands, p.product_name].filter(Boolean).join(' ') || term,
          domain: 'openfoodfacts.org'
        });
      }
    }
  } catch {
    // ignore
  }

  return candidates;
}

// 3. Wikimedia Commons Fallback
async function searchWikimediaCommons(term: string): Promise<ProductImageCandidate[]> {
  const candidates: ProductImageCandidate[] = [];
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term + ' product')}&gsrlimit=3&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MartPro-POS/2.0 (supermarketmanage@gmail.com)' },
      signal: AbortSignal.timeout(2500)
    });
    if (!res.ok) return candidates;
    const data: any = await res.json();
    const pages = data.query ? Object.values(data.query.pages) : [];
    for (const p of pages as any[]) {
      const info = p.imageinfo?.[0];
      const imgUrl = info?.thumburl || info?.url;
      if (imgUrl && typeof imgUrl === 'string' && !imgUrl.endsWith('.svg') && !imgUrl.includes('Question_book')) {
        candidates.push({
          url: imgUrl,
          thumbnail: info.thumburl || imgUrl,
          title: (p.title || term).replace('File:', '').replace(/\.[^/.]+$/, ''),
          domain: 'wikimedia.org'
        });
        if (candidates.length >= 2) break;
      }
    }
  } catch {
    // ignore
  }
  return candidates;
}

// Main High-Accuracy Image Resolver
export async function resolveProductImage(
  _aiClient: any,
  name: string,
  category?: string,
  brand?: string,
  size?: string,
  barcode?: string,
  manualQuery?: string
): Promise<ResolveImageResult> {
  const cleanName = (manualQuery || name || '').trim();
  const { cleanName: normalized, searchTerms } = normalizeProductName(cleanName);
  const candidates: ProductImageCandidate[] = [];
  const seenUrls = new Set<string>();

  const addCandidate = (c: ProductImageCandidate) => {
    if (!c.url || seenUrls.has(c.url)) return;
    seenUrls.add(c.url);
    candidates.push(c);
  };

  // STEP 1: Direct Real Web Image Search for Packaging & Ecommerce listings
  // This produces accurate, genuine brand packaging (e.g., Daraz, Alfatah, Walmart, Carrefour, catchnpack, etc.)
  const webCandidates = await searchWebProductImages(cleanName, brand, size);
  webCandidates.forEach(addCandidate);

  // STEP 2: Open Food Facts Lookup (Especially for barcode or packaged FMCG)
  if (candidates.length < 4) {
    const offCandidates = await searchOpenFoodFacts(cleanName, barcode);
    offCandidates.forEach(addCandidate);
  }

  // STEP 3: Check Curated Produce Catalog (for fresh vegetables, fruits, eggs, meat)
  if (candidates.length === 0 || category?.toLowerCase().includes('produce') || category?.toLowerCase().includes('fruit') || category?.toLowerCase().includes('vegetable')) {
    for (const entry of CURATED_PRODUCE_CATALOG) {
      if (entry.match.test(cleanName) || entry.match.test(normalized)) {
        addCandidate({
          url: entry.url,
          thumbnail: entry.url,
          title: entry.title,
          domain: entry.domain
        });
        break;
      }
    }
  }

  // STEP 4: Secondary fallback to Wikimedia Commons
  if (candidates.length < 2) {
    const wikiCandidates = await searchWikimediaCommons(cleanName);
    wikiCandidates.forEach(addCandidate);
  }

  // STEP 5: Final Graceful Fallback if entirely offline or obscure keyword
  if (candidates.length === 0) {
    addCandidate({
      url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=150&q=80',
      title: `${cleanName} - Supermarket Product`,
      domain: 'unsplash.com'
    });
  }

  // Sort candidates so the most relevant one is first
  // Boost candidates that mention brand or core product keywords in their title
  const sortedCandidates = [...candidates].sort((a, b) => {
    const aTitle = (a.title || '').toLowerCase();
    const bTitle = (b.title || '').toLowerCase();
    let aScore = 0;
    let bScore = 0;

    for (const term of searchTerms) {
      const lower = term.toLowerCase();
      if (aTitle.includes(lower)) aScore += 2;
      if (bTitle.includes(lower)) bScore += 2;
    }

    if (brand) {
      const brandLower = brand.toLowerCase();
      if (aTitle.includes(brandLower)) aScore += 4;
      if (bTitle.includes(brandLower)) bScore += 4;
    }

    // Boost verified e-commerce/retail domains
    const retailDomains = ['daraz', 'alfatah', 'carrefour', 'walmart', 'amazon', 'openfoodfacts', 'luluhypermarket', 'easydoor', 'grocerapp', 'catchnpack'];
    if (retailDomains.some(d => a.domain.includes(d))) aScore += 3;
    if (retailDomains.some(d => b.domain.includes(d))) bScore += 3;

    return bScore - aScore;
  });

  const best = sortedCandidates[0];

  return {
    imageUrl: best.url,
    thumbnailUrl: best.thumbnail || best.url,
    source: best.domain && best.domain !== 'unsplash.com' ? 'web_product_search' : 'catalog',
    sourceDomain: best.domain || 'web',
    candidates: sortedCandidates.slice(0, 8)
  };
}
