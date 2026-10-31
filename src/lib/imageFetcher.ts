export interface ProductImageCandidate {
  url: string;
  thumbnail: string;
  title: string;
  domain?: string;
}

export interface ProductImageSearchResult {
  imageUrl: string;
  thumbnailUrl: string;
  source: string;
  sourceDomain: string;
  candidates: ProductImageCandidate[];
}

/**
 * Searches for accurate real product packaging and FMCG photos
 */
export async function searchProductImageWithCandidates(params: {
  name: string;
  brand?: string;
  category?: string;
  size?: string;
  barcode?: string;
  manualQuery?: string;
}): Promise<ProductImageSearchResult | null> {
  try {
    const targetQuery = (params.manualQuery || params.name || '').trim();
    if (!targetQuery) return null;

    const response = await fetch('/api/ai/product-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.name ? params.name.trim() : targetQuery,
        brand: params.brand,
        category: params.category,
        size: params.size,
        barcode: params.barcode,
        manualQuery: params.manualQuery
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data: ProductImageSearchResult = await response.json();
    return data;
  } catch (error) {
    console.warn('[Image Search Client Warning]:', error);
    return null;
  }
}

/**
 * Quick helper to get single best product image URL
 */
export async function fetchProductImageUrl(
  productName: string,
  brand?: string,
  size?: string,
  barcode?: string
): Promise<string> {
  try {
    const res = await searchProductImageWithCandidates({
      name: productName,
      brand,
      size,
      barcode
    });
    return res?.imageUrl || '';
  } catch {
    return '';
  }
}

/**
 * Helper to get safe proxied image URL if direct hotlinking fails
 */
export function getProxiedImageUrl(originalUrl: string): string {
  if (!originalUrl || !originalUrl.startsWith('http')) return originalUrl;
  if (originalUrl.includes('/api/image-proxy')) return originalUrl;
  return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
}
