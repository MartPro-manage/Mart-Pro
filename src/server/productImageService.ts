export interface ProductImageCandidate {
  url: string;
  thumbnail: string;
  title: string;
  domain: string;
}

export interface ResolveImageResult {
  imageUrl: string;
  thumbnailUrl: string;
  title?: string;
  source: string;
  sourceDomain: string;
  candidates: ProductImageCandidate[];
}

// Cleans common supermarket spelling typos while keeping brand names,
// package sizes, volume/weight numbers, and unit types intact
export function normalizeProductName(name: string): { cleanName: string; keywords: string[] } {
  let clean = (name || '')
    .trim()
    .replace(/([0-9]+)([a-zA-Z]+)/g, '$1 $2') // e.g. 500ml -> 500 ml
    .replace(/([a-zA-Z]+)([0-9]+)/g, '$1 $2')
    // Fix common supermarket spelling typos
    .replace(/\b(coking)\b/gi, 'cooking')
    .replace(/\b(gee)\b/gi, 'ghee')
    .replace(/\b(sope)\b/gi, 'soap')
    .replace(/\b(refil)\b/gi, 'refill')
    .replace(/\b(s\.s)\b/gi, 'shampoo')
    .replace(/\b(arilel)\b/gi, 'ariel')
    .replace(/\b(bursh)\b/gi, 'toothbrush')
    .replace(/\b(detoll)\b/gi, 'dettol')
    .replace(/\b(roohafza)\b/gi, 'rooh afza')
    .replace(/\b(jam\s*e\s*shirin|jamshirin)\b/gi, 'jam e shirin')
    .replace(/\b(tezdum|tazdum)\b/gi, 'tez dum')
    .replace(/\b(tapalfamilymix|tapalfamily)\b/gi, 'tapal family mixture')
    .replace(/\b(sasooliveoil|saso)\b/gi, 'sasso olive oil')
    .replace(/\b(kachap)\b/gi, 'ketchup')
    .replace(/\b(omung)\b/gi, 'dairy omung')
    .replace(/\b(olper)\b/gi, 'olpers')
    .replace(/\b(patato|alu)\b/gi, 'potato')
    .replace(/\b(tamatar)\b/gi, 'tomato')
    .replace(/\b(piyaz)\b/gi, 'onion')
    .replace(/\b(adark|gingar)\b/gi, 'ginger')
    .replace(/\b(lehsan)\b/gi, 'garlic')
    .replace(/\b(kela)\b/gi, 'banana')
    .replace(/\b(saib)\b/gi, 'apple')
    .replace(/\b(cheeni)\b/gi, 'sugar')
    .replace(/\b(chawal)\b/gi, 'rice')
    .replace(/[^a-zA-Z0-9\s\.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const keywords = clean.split(' ').filter(w => w.length > 1);
  return { cleanName: clean, keywords };
}

// High-priority retail and e-commerce domains for supermarket FMCG products
const PRIORITY_DOMAINS = [
  'amazon', 'walmart', 'daraz', 'grocerapp', 'shopify', 'carrefour',
  'al-fatah', 'catchnpack', 'spinneys', 'tesco', 'iceland', 'bigbasket',
  'flipkart', 'lazada', 'shopee', 'target', 'kroger', 'woolworths',
  'sehatmund', 'dukaan', 'pnp.co.za', 'unilever', 'nestle', 'procter',
  'colgate', 'pepsico', 'coca-cola', 'nationalfoods', 'shanfoods'
];

function scoreCandidate(candidate: ProductImageCandidate, originalQuery: string): number {
  let score = 0;
  const domainLower = candidate.domain.toLowerCase();
  const titleLower = candidate.title.toLowerCase();
  const queryLower = originalQuery.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  // Bonus for trusted retail domains
  if (PRIORITY_DOMAINS.some(d => domainLower.includes(d))) {
    score += 50;
  }

  // Bonus for image extension in url
  if (/\.(jpg|jpeg|png|webp)($|\?)/i.test(candidate.url)) {
    score += 20;
  }

  // Bonus for word matches in title
  let matchedWords = 0;
  for (const word of queryWords) {
    if (titleLower.includes(word)) {
      matchedWords++;
    }
  }
  score += matchedWords * 15;

  // Penalize banners, tiny icons, logos
  if (/logo|icon|banner|avatar|placeholder|button|spacer/i.test(candidate.url) ||
      /logo|icon|symbol/i.test(candidate.title)) {
    score -= 80;
  }

  // Penalize SVGs
  if (candidate.url.endsWith('.svg')) {
    score -= 100;
  }

  return score;
}

// Search Bing Images for accurate retail packaging photos
async function searchBingImages(query: string): Promise<ProductImageCandidate[]> {
  const items: ProductImageCandidate[] = [];
  try {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&FORM=HDRSC2`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return items;
    const html = await res.text();

    const blockRegex = /class="iusc"[^>]*m="([^"]+)"/g;
    let match;
    while ((match = blockRegex.exec(html)) !== null) {
      try {
        const decoded = match[1].replace(/&quot;/g, '"');
        const json = JSON.parse(decoded);
        if (json.murl && typeof json.murl === 'string') {
          const imgUrl = json.murl;
          if (!imgUrl.endsWith('.svg') && !imgUrl.includes('placeholder')) {
            let domain = 'web';
            try {
              domain = new URL(imgUrl).hostname.replace(/^www\./, '');
            } catch {
              // ignore
            }
            items.push({
              url: imgUrl,
              thumbnail: json.turl || imgUrl,
              title: json.t || query,
              domain
            });
          }
        }
      } catch {
        // ignore single parse error
      }
    }
  } catch {
    // network or timeout
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const uniqueItems: ProductImageCandidate[] = [];
  for (const it of items) {
    if (!seen.has(it.url)) {
      seen.add(it.url);
      uniqueItems.push(it);
    }
  }

  // Sort by relevance score
  uniqueItems.sort((a, b) => scoreCandidate(b, query) - scoreCandidate(a, query));
  return uniqueItems.slice(0, 10);
}

// Search DuckDuckGo images as secondary high-accuracy fallback
async function searchDuckDuckGoImages(query: string): Promise<ProductImageCandidate[]> {
  const items: ProductImageCandidate[] = [];
  try {
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) return items;
    const html = await res.text();
    const vqdMatch = html.match(/vqd=([0-9-]+)/) || html.match(/vqd=["']([0-9-]+)["']/);
    if (!vqdMatch) return items;
    const vqd = vqdMatch[1];

    const apiUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,`;
    const imgRes = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://duckduckgo.com/'
      },
      signal: AbortSignal.timeout(3500)
    });
    if (!imgRes.ok) return items;
    const data: any = await imgRes.json();
    if (Array.isArray(data.results)) {
      for (const r of data.results) {
        if (r.image && typeof r.image === 'string' && !r.image.endsWith('.svg')) {
          let domain = 'duckduckgo';
          try {
            domain = new URL(r.url || r.image).hostname.replace(/^www\./, '');
          } catch {}
          items.push({
            url: r.image,
            thumbnail: r.thumbnail || r.image,
            title: r.title || query,
            domain
          });
        }
      }
    }
  } catch {
    // ignore
  }

  items.sort((a, b) => scoreCandidate(b, query) - scoreCandidate(a, query));
  return items.slice(0, 8);
}

// Curated high-resolution professional photography strictly mapped to unpacked fresh produce and staples
interface CuratedProduceItem {
  match: RegExp;
  url: string;
  thumb: string;
  title: string;
  domain: string;
}

const CURATED_PRODUCE_CATALOG: CuratedProduceItem[] = [
  // Fruits
  {
    match: /\b(apple|red\s*apple|saib)\b/i,
    url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Red Apples',
    domain: 'unsplash.com'
  },
  {
    match: /\b(green\s*apple)\b/i,
    url: 'https://images.unsplash.com/photo-1610397648930-477b8c7f0943?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1610397648930-477b8c7f0943?auto=format&fit=crop&w=160&q=80',
    title: 'Crisp Green Apples',
    domain: 'unsplash.com'
  },
  {
    match: /\b(banana|kela)\b/i,
    url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Yellow Bananas',
    domain: 'unsplash.com'
  },
  {
    match: /\b(orange|malta|kinnow|mosambi)\b/i,
    url: 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1547514701-42782101795e?auto=format&fit=crop&w=160&q=80',
    title: 'Juicy Fresh Oranges',
    domain: 'unsplash.com'
  },
  {
    match: /\b(mango|aam|chaunsa|anwar\s*ratol|sindhri)\b/i,
    url: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=160&q=80',
    title: 'Sweet Farm Fresh Mangoes',
    domain: 'unsplash.com'
  },
  {
    match: /\b(pineapple|ananas)\b/i,
    url: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?auto=format&fit=crop&w=160&q=80',
    title: 'Golden Sweet Pineapple',
    domain: 'unsplash.com'
  },
  {
    match: /\b(strawberry|strawberries)\b/i,
    url: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=160&q=80',
    title: 'Ripe Red Strawberries',
    domain: 'unsplash.com'
  },
  {
    match: /\b(watermelon|tarbooz)\b/i,
    url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Sweet Watermelon',
    domain: 'unsplash.com'
  },
  {
    match: /\b(lemon|limo|lime)\b/i,
    url: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Juicy Lemons',
    domain: 'unsplash.com'
  },
  {
    match: /\b(grapes|angoor)\b/i,
    url: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Sweet Grapes',
    domain: 'unsplash.com'
  },

  // Vegetables
  {
    match: /\b(potato|potatoes|alu)\b/i,
    url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Farm Potatoes',
    domain: 'unsplash.com'
  },
  {
    match: /\b(tomato|tomatoes|tamatar)\b/i,
    url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Ripe Red Tomatoes',
    domain: 'unsplash.com'
  },
  {
    match: /\b(onion|onions|piyaz)\b/i,
    url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Red Onions',
    domain: 'unsplash.com'
  },
  {
    match: /\b(garlic|lehsan)\b/i,
    url: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Garlic Bulbs',
    domain: 'unsplash.com'
  },
  {
    match: /\b(ginger|adrak|adark)\b/i,
    url: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Organic Ginger Root',
    domain: 'unsplash.com'
  },
  {
    match: /\b(cabbage|band\s*gobi)\b/i,
    url: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Green Cabbage',
    domain: 'unsplash.com'
  },
  {
    match: /\b(cauliflower|phool\s*gobi)\b/i,
    url: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Crisp Cauliflower',
    domain: 'unsplash.com'
  },
  {
    match: /\b(carrot|carrots|gajar)\b/i,
    url: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Orange Carrots',
    domain: 'unsplash.com'
  },
  {
    match: /\b(cucumber|kheera)\b/i,
    url: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Green Cucumbers',
    domain: 'unsplash.com'
  },
  {
    match: /\b(capsicum|bell\s*pepper|shimla\s*mirch)\b/i,
    url: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Bell Peppers / Capsicum',
    domain: 'unsplash.com'
  },
  {
    match: /\b(spinach|palak)\b/i,
    url: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Green Spinach Leaves',
    domain: 'unsplash.com'
  },
  {
    match: /\b(peas|matar)\b/i,
    url: 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1587486913049-53fc88980cfc?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Green Peas',
    domain: 'unsplash.com'
  },

  // Fresh Meat & Poultry
  {
    match: /\b(chicken\s*breast|boneless\s*chicken)\b/i,
    url: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Raw Chicken Breast Fillet',
    domain: 'unsplash.com'
  },
  {
    match: /\b(chicken|murghi)\b/i,
    url: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Halal Whole Chicken Cut',
    domain: 'unsplash.com'
  },
  {
    match: /\b(beef|mutton|gosht|lamb|steak|mince|keema)\b/i,
    url: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Prime Beef & Mutton Meat',
    domain: 'unsplash.com'
  },
  {
    match: /\b(fish|machli|salmon|prawns|shrimp)\b/i,
    url: 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Seafood & Fish Fillet',
    domain: 'unsplash.com'
  },

  // Dairy & Bakery Staples
  {
    match: /\b(egg|eggs|anday)\b/i,
    url: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Farm Eggs Tray',
    domain: 'unsplash.com'
  },
  {
    match: /\b(bread|sandwich\s*bread|roti|loaf)\b/i,
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=160&q=80',
    title: 'Fresh Sliced Bakery Bread Loaf',
    domain: 'unsplash.com'
  },
  {
    match: /\b(butter|makhan)\b/i,
    url: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=160&q=80',
    title: 'Creamy Pure Dairy Butter Block',
    domain: 'unsplash.com'
  },
  {
    match: /\b(cheese|paneer|cheddar|mozzarella)\b/i,
    url: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=160&q=80',
    title: 'Pure Dairy Cheese Block',
    domain: 'unsplash.com'
  },

  // Raw Commodities
  {
    match: /\b(basmati|rice|chawal|sella)\b/i,
    url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=160&q=80',
    title: 'Super Kernel Basmati Rice',
    domain: 'unsplash.com'
  },
  {
    match: /\b(white\s*sugar|sugar|cheeni)\b/i,
    url: 'https://images.unsplash.com/photo-1622484216854-c9f2868ffcb4?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1622484216854-c9f2868ffcb4?auto=format&fit=crop&w=160&q=80',
    title: 'Pure Refined White Sugar',
    domain: 'unsplash.com'
  },
  {
    match: /\b(atta|chakki\s*atta|wheat\s*flour|maida)\b/i,
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=160&q=80',
    title: 'Whole Wheat Flour Atta',
    domain: 'unsplash.com'
  },
  {
    match: /\b(daal|pulses|lentils|chana|moong|masoor)\b/i,
    url: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=600&q=80',
    thumb: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=160&q=80',
    title: 'Organic Pulses & Daal Grain',
    domain: 'unsplash.com'
  }
];

export async function resolveProductImage(
  _aiClient: any,
  name: string,
  category?: string,
  brand?: string,
  size?: string,
  customQuery?: string
): Promise<ResolveImageResult> {
  const cleanOriginal = (name || '').trim();
  const { cleanName } = normalizeProductName(cleanOriginal);

  // If the user specified a custom search query in the search box, prioritize it directly
  const searchQueries: string[] = [];

  if (customQuery && customQuery.trim()) {
    searchQueries.push(customQuery.trim());
  }

  // 1. Precise retail packaging queries
  const brandPart = brand && !cleanName.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ` : '';
  const sizePart = size && !cleanName.toLowerCase().includes(size.toLowerCase()) ? ` ${size}` : '';

  // Query 1: Exact brand + name + size + pack
  const q1 = `${brandPart}${cleanName}${sizePart}`.trim();
  searchQueries.push(q1);

  // Query 2: Product name with "product pack" for retail packaging
  if (!/\b(pack|bottle|box|can|pouch|jar|kg|liter|ml|g)\b/i.test(q1)) {
    searchQueries.push(`${q1} product packaging`);
  }

  // Query 3: Add category if available
  if (category && category !== 'General' && !cleanName.toLowerCase().includes(category.toLowerCase())) {
    searchQueries.push(`${brandPart}${cleanName} ${category}`.trim());
  }

  let candidates: ProductImageCandidate[] = [];

  // Step 1: Real-time Bing Image Search
  for (const q of searchQueries) {
    if (candidates.length >= 6) break;
    try {
      const results = await searchBingImages(q);
      if (results.length > 0) {
        candidates.push(...results);
        break; // First good query matched
      }
    } catch {
      // continue to next query
    }
  }

  // Step 2: DuckDuckGo images fallback if Bing didn't find enough
  if (candidates.length < 2) {
    try {
      const ddgResults = await searchDuckDuckGoImages(searchQueries[0]);
      if (ddgResults.length > 0) {
        candidates.push(...ddgResults);
      }
    } catch {
      // ignore
    }
  }

  // Step 3: Check Curated Fresh Produce & Commodities if this is fresh unpacked food
  const freshItem = CURATED_PRODUCE_CATALOG.find(entry => 
    entry.match.test(cleanOriginal) || entry.match.test(cleanName)
  );

  const isPackagedOrProcessed = /\b(ketchup|sauce|paste|puree|can|canned|juice|soup|chips|crisps|flavor|powder|jam|syrup|oil|soap|cream|biscuit|bar|cleaner|detergent|shampoo|masala|mix|tea|coffee|noodles|pasta|pack|pouch|bottle|jar|box|tin|pet|sachet)\b/i.test(cleanOriginal);

  if (freshItem) {
    const curatedCandidate: ProductImageCandidate = {
      url: freshItem.url,
      thumbnail: freshItem.thumb,
      title: `${cleanOriginal} - ${freshItem.title}`,
      domain: freshItem.domain
    };

    // Only prioritize produce photo if this is genuine raw unpacked produce (not ketchup, sauce, chips, etc.)
    const isPureFreshProduce = !isPackagedOrProcessed && (
      candidates.length === 0 ||
      /^(fresh\s+)?(potato|potatoes|alu|tomato|tomatoes|tamatar|onion|onions|piyaz|garlic|lehsan|ginger|adrak|banana|kela|apple|saib|orange|mango|lemon|grapes|cabbage|cauliflower|carrot|cucumber|spinach|peas|chicken|beef|mutton|fish|egg|eggs)\b/i.test(cleanName)
    );

    if (isPureFreshProduce) {
      candidates.unshift(curatedCandidate);
    } else {
      candidates.push(curatedCandidate);
    }
  }

  // Deduplicate candidates by URL
  const seenUrls = new Set<string>();
  const finalCandidates: ProductImageCandidate[] = [];
  for (const c of candidates) {
    if (!seenUrls.has(c.url)) {
      seenUrls.add(c.url);
      finalCandidates.push(c);
    }
  }

  // Step 4: Ultimate clean grocery fallback if absolutely nothing was found
  if (finalCandidates.length === 0) {
    finalCandidates.push({
      url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=160&q=80',
      title: `${cleanOriginal} - Supermarket Product`,
      domain: 'unsplash.com'
    });
  }

  const selected = finalCandidates[0];
  return {
    imageUrl: selected.url,
    thumbnailUrl: selected.thumbnail || selected.url,
    title: selected.title,
    source: selected.domain === 'unsplash.com' ? 'curated_catalog' : 'live_web_search',
    sourceDomain: selected.domain,
    candidates: finalCandidates.slice(0, 10)
  };
}
