export interface ProductImageCandidate {
  url: string;
  thumbnail: string;
  title: string;
  domain?: string;
}

export interface ResolveImageDetails {
  imageUrl: string;
  thumbnailUrl: string;
  title?: string;
  source: string;
  sourceDomain: string;
  candidates: ProductImageCandidate[];
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
    candidates: Array.isArray(data.candidates) ? data.candidates : []
  };
}
