import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Sparkles, 
  Check, 
  ExternalLink, 
  Upload, 
  Link as LinkIcon, 
  RefreshCw, 
  ImageIcon, 
  Globe,
  AlertCircle
} from 'lucide-react';
import { ProductImageCandidate, searchProductImageWithCandidates, getProxiedImageUrl } from '../lib/imageFetcher';

interface ProductImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery: string;
  brand?: string;
  size?: string;
  barcode?: string;
  currentImageUrl?: string;
  initialCandidates?: ProductImageCandidate[];
  onSelectImage: (imageUrl: string, sourceDomain?: string, thumbnail?: string) => void;
  onUploadImage?: (file: File) => void;
}

export const ProductImageSearchModal: React.FC<ProductImageSearchModalProps> = ({
  isOpen,
  onClose,
  initialQuery,
  brand,
  size,
  barcode,
  currentImageUrl,
  initialCandidates = [],
  onSelectImage,
  onUploadImage
}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery || '');
  const [candidates, setCandidates] = useState<ProductImageCandidate[]>(initialCandidates);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'url' | 'upload'>('search');
  const [customUrl, setCustomUrl] = useState('');
  const [selectedUrl, setSelectedUrl] = useState(currentImageUrl || '');

  // Reset or run initial search when modal opens
  useEffect(() => {
    if (isOpen) {
      const q = [initialQuery, brand, size].filter(Boolean).join(' ');
      setSearchQuery(q);
      setSelectedUrl(currentImageUrl || '');
      setError(null);

      if (initialCandidates && initialCandidates.length > 0) {
        setCandidates(initialCandidates);
      } else if (q.trim()) {
        handleExecuteSearch(q);
      }
    }
  }, [isOpen, initialQuery, brand, size, currentImageUrl]);

  if (!isOpen) return null;

  const handleExecuteSearch = async (termToSearch?: string) => {
    const term = (termToSearch !== undefined ? termToSearch : searchQuery).trim();
    if (!term) {
      setError('Please enter a product name or search keywords');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const result = await searchProductImageWithCandidates({
        name: term,
        manualQuery: term,
        brand,
        size,
        barcode
      });

      if (result && Array.isArray(result.candidates) && result.candidates.length > 0) {
        setCandidates(result.candidates);
      } else {
        setError('No exact image matches found. Try searching with brand name, flavor, or packaging size.');
      }
    } catch (err: any) {
      setError('Failed to search images. Please verify your connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCandidate = (candidate: ProductImageCandidate) => {
    setSelectedUrl(candidate.url);
    onSelectImage(candidate.url, candidate.domain, candidate.thumbnail);
    onClose();
  };

  const handleApplyCustomUrl = () => {
    if (!customUrl.trim() || !customUrl.startsWith('http')) {
      setError('Please enter a valid image URL starting with http:// or https://');
      return;
    }
    setSelectedUrl(customUrl.trim());
    onSelectImage(customUrl.trim(), 'custom_link', customUrl.trim());
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (onUploadImage) {
      onUploadImage(file);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                <span>Accurate Product Photo Search</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  Live Web & Retail
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Authentic packaging photos from verified supermarkets, FMCG databases & retailers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap bg-slate-50">
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'search' ? 'bg-white text-indigo-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Real Product Search</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'url' ? 'bg-white text-indigo-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Paste Direct URL</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'upload' ? 'bg-white text-indigo-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Custom Photo</span>
            </button>
          </div>

          {currentImageUrl && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-semibold">Active:</span>
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 shrink-0">
                <img src={currentImageUrl} alt="Current" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </div>

        {/* Search Bar (When in Search tab) */}
        {activeTab === 'search' && (
          <div className="p-4 border-b border-slate-100 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExecuteSearch();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Tapal Danedar Tea 450g, Shan Bombay Biryani, Olpers Milk..."
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-2xs"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Find Real Photos</span>
                  </>
                )}
              </button>
            </form>

            {/* Quick Keyword Suggestions if available */}
            {initialQuery && searchQuery !== initialQuery && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                <span>Reset query:</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery(initialQuery);
                    handleExecuteSearch(initialQuery);
                  }}
                  className="text-indigo-600 hover:underline font-bold"
                >
                  "{initialQuery}"
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'search' && (
            <div>
              {isSearching ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-sm font-bold text-slate-800">
                    Scanning live supermarket and FMCG databases for "{searchQuery}"...
                  </p>
                  <p className="text-xs text-slate-500">
                    Finding high-resolution direct packaging pictures from verified stores
                  </p>
                </div>
              ) : candidates.length === 0 ? (
                <div className="py-16 text-center space-y-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                  <ImageIcon className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">No product images found</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Try searching with specific brand names, weights, or item variants above.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                    <span>{candidates.length} Real Product Packaging Photos Found</span>
                    <span>Click any image to select</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {candidates.map((candidate, idx) => {
                      const isSelected = selectedUrl === candidate.url;

                      return (
                        <div
                          key={idx}
                          onClick={() => handleSelectCandidate(candidate)}
                          className={`group relative bg-white rounded-2xl border transition-all overflow-hidden flex flex-col justify-between cursor-pointer hover:shadow-lg ${
                            isSelected
                              ? 'border-indigo-600 ring-2 ring-indigo-500 bg-indigo-50/20'
                              : 'border-slate-200 hover:border-indigo-400'
                          }`}
                        >
                          {/* Image Box */}
                          <div className="aspect-square w-full bg-slate-50 relative flex items-center justify-center p-2 overflow-hidden">
                            <img
                              src={candidate.thumbnail || candidate.url}
                              alt={candidate.title}
                              className="w-full h-full object-contain transition-transform group-hover:scale-105"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const el = e.target as HTMLImageElement;
                                if (!el.src.includes('/api/image-proxy')) {
                                  el.src = getProxiedImageUrl(candidate.url);
                                }
                              }}
                            />

                            {/* Selected Badge */}
                            {isSelected && (
                              <div className="absolute top-2 right-2 bg-indigo-600 text-white rounded-full p-1 shadow-md">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            )}

                            {/* Retailer Domain Badge */}
                            {candidate.domain && (
                              <div className="absolute bottom-1.5 left-1.5 bg-slate-900/80 backdrop-blur-xs text-[9px] font-bold text-slate-200 px-1.5 py-0.5 rounded-md flex items-center gap-1 max-w-[85%] truncate">
                                <Globe className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{candidate.domain}</span>
                              </div>
                            )}
                          </div>

                          {/* Title & Action */}
                          <div className="p-2.5 bg-white border-t border-slate-100 flex flex-col justify-between flex-1 gap-1.5">
                            <p
                              className="text-xs font-bold text-slate-900 line-clamp-2 leading-tight"
                              title={candidate.title}
                            >
                              {candidate.title}
                            </p>
                            
                            <button
                              type="button"
                              className={`w-full py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white text-slate-700'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="w-3 h-3" /> Selected
                                </>
                              ) : (
                                'Choose This'
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'url' && (
            <div className="max-w-md mx-auto py-8 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Direct Product Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/product-image.jpg"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:border-indigo-600 focus:bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Paste any direct URL to a product photo (PNG, JPG, WebP)
                </p>
              </div>

              {customUrl && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2">
                  <span className="text-xs font-bold text-slate-600 block">Preview:</span>
                  <div className="w-28 h-28 mx-auto rounded-xl overflow-hidden border border-slate-300 bg-white p-1">
                    <img
                      src={customUrl}
                      alt="Custom Preview"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        if (!el.src.includes('/api/image-proxy')) {
                          el.src = getProxiedImageUrl(customUrl);
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleApplyCustomUrl}
                disabled={!customUrl.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Apply Image URL
              </button>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="max-w-md mx-auto py-8 text-center space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 hover:border-indigo-500 transition-colors bg-slate-50">
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800">Upload Product Photo</p>
                <p className="text-xs text-slate-500 mt-1">
                  Take a photo with your device camera or upload an existing image file
                </p>
                <label className="mt-4 inline-block px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs transition-all">
                  <span>Browse Device Files</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="text-slate-500 font-medium">
            <span>Powered by live FMCG packaging and retailer search</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
