export async function fetchProductImageUrl(productName: string): Promise<string> {
  try {
    const response = await fetch('/api/ai/product-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: productName })
    });
    
    if (!response.ok) throw new Error('Failed to fetch image');
    
    const data = await response.json();
    return data.imageUrl || '';
  } catch (error) {
    console.error('Error fetching image URL:', error);
    return '';
  }
}
