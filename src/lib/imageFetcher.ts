export interface ProductImageCandidate {
  url: string;
  thumbnail: string;
  title: string;
  domain?: string;
  score?: number;
}

export interface ResolveImageDetails {
  imageUrl: string;
  thumbnailUrl: string;
  title?: string;
  source: string;
  sourceDomain: string;
  candidates: ProductImageCandidate[];
  brand?: string;
  variant?: string;
  packType?: string;
  size?: string;
}

export interface VisualProductSearchResult {
  success: boolean;
  identification: {
    productName: string;
    brand: string;
    variant: string;
    size: string;
    category: string;
    barcode?: string;
    packagingType: string;
    searchKeywords: string[];
    confidence: number;
  };
  matchedProduct?: any;
  matchedCandidates?: any[];
}

export async function fetchProductImageUrl(
  productName: string,
  category?: string,
  brand?: string,
  size?: string,
  query?: string
): Promise<string> {
  try {
    const details = await fetchProductImageDetails(productName, { category, brand, size, query });
    return details.imageUrl || '';
  } catch (error) {
    console.error('Error fetching image URL:', error);
    return '';
  }
}

export async function fetchProductImageDetails(
  productName: string,
  options?: {
    category?: string;
    brand?: string;
    size?: string;
    query?: string;
  }
): Promise<ResolveImageDetails> {
  const response = await fetch('/api/ai/product-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: productName,
      category: options?.category,
      brand: options?.brand,
      size: options?.size,
      query: options?.query
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    imageUrl: data.imageUrl || '',
    thumbnailUrl: data.thumbnailUrl || data.imageUrl || '',
    title: data.title || productName,
    source: data.source || 'web_search',
    sourceDomain: data.sourceDomain || '',
    candidates: Array.isArray(data.candidates) ? data.candidates : [],
    brand: data.brand,
    variant: data.variant,
    packType: data.packType,
    size: data.size
  };
}

export async function searchProductImageWithCandidates(
  queryOrParams: string | { name?: string; manualQuery?: string; query?: string; brand?: string; size?: string; barcode?: string; category?: string },
  brand?: string,
  size?: string
): Promise<{
  imageUrl: string;
  thumbnailUrl: string;
  sourceDomain: string;
  candidates: ProductImageCandidate[];
}> {
  let q = '';
  let b = brand;
  let s = size;
  let c: string | undefined;

  if (typeof queryOrParams === 'string') {
    q = queryOrParams;
  } else if (queryOrParams && typeof queryOrParams === 'object') {
    q = queryOrParams.manualQuery || queryOrParams.query || queryOrParams.name || '';
    b = queryOrParams.brand || b;
    s = queryOrParams.size || s;
    c = queryOrParams.category;
  }

  const details = await fetchProductImageDetails(q, { brand: b, size: s, category: c });
  return {
    imageUrl: details.imageUrl,
    thumbnailUrl: details.thumbnailUrl,
    sourceDomain: details.sourceDomain,
    candidates: details.candidates
  };
}

/**
 * Returns a proxy URL if the image domain commonly blocks direct cross-origin hotlinking
 */
export function getProxiedImageUrl(url: string): string {
  if (!url || !url.startsWith('http')) return url;
  // If already proxied or from unsplash/wikimedia, return as-is
  if (url.startsWith('/api/proxy-image') || url.includes('unsplash.com') || url.includes('wikimedia.org')) {
    return url;
  }
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

/**
 * Visual search: Identifies product details and matching store inventory from a photo
 */
export async function visualSearchProduct(
  base64Image: string,
  storeId?: string,
  mimeType: string = 'image/jpeg'
): Promise<VisualProductSearchResult> {
  const res = await fetch('/api/ai/visual-product-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64Image,
      mimeType,
      storeId
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to identify product from image');
  }

  return await res.json();
}
