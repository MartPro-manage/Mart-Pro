import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  db, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  handleFirestoreError,
  OperationType,
  cleanFirestoreData
} from '../lib/firebase';
import { Product, Store, UserAccount, ManagedCategory, CompanyBrand } from '../types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { BarcodeGeneratorModal } from './BarcodeGeneratorModal';
import { HardwarePermissionsBar } from './HardwarePermissionsBar';
import { MultiProductBatchModal } from './MultiProductBatchModal';
import { ExcelManagerModal } from './ExcelManagerModal';
import { StoreAiAssistantModal } from './StoreAiAssistantModal';
import { UniversalBackButton } from './UniversalBackButton';
import { DiscountManagerModal } from './DiscountManagerModal';
import { ItemDiscountModal } from './ItemDiscountModal';
import { ManageCategoriesView } from './ManageCategoriesView';
import { ProductShortcutsModal } from './ProductShortcutsModal';
import { downloadBarcodeForProduct } from '../lib/barcodeDownload';
import { fetchProductImageUrl } from '../lib/imageFetcher';
import { BatchProductRow } from '../lib/excelParser';
import { 
  getAllCategories, 
  addCustomCategoryToStore, 
  saveNewCategoryToStore, 
  fetchStoreManagedCategories,
  getCompaniesForCategory,
  getDefaultSizesForCategory,
  normalizeSizeLabel
} from '../lib/categories';
import { generateNextShortcutCode, generateNext4DigitSerialNumber, generate5DigitBarcode } from '../utils/productShortcuts';
import { getProductDiscountInfo, formatShortDate } from '../utils/discountUtils';
import { 
  Package,
  PackagePlus, 
  Barcode as BarcodeIcon, 
  Camera, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Tag, 
  Layers, 
  PlusCircle, 
  Edit3,
  Trash2,
  Printer,
  Scale,
  Sparkles,
  Info,
  Download,
  TrendingUp,
  Percent,
  Coins,
  DollarSign,
  ArrowUpRight,
  Image as ImageIcon,
  Link as LinkIcon,
  Upload,
  Plus,
  ArrowLeft,
  X,
  Building2,
  FolderTree,
  FileImage,
  ListPlus,
  FileSpreadsheet,
  Boxes,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Calendar,
  Clock,
  LayoutGrid,
  List,
  ShoppingBag,
  Hash,
  CheckCircle2,
  Globe,
  Copy,
  ExternalLink
} from 'lucide-react';

interface ProductRegisterViewProps {
  store: Store;
  currentUser: UserAccount;
  onBack?: () => void;
}

export const ProductRegisterView: React.FC<ProductRegisterViewProps> = ({ store, currentUser, onBack }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [productForGenerator, setProductForGenerator] = useState<Partial<Product> | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [spreadsheetProductsForAi, setSpreadsheetProductsForAi] = useState<BatchProductRow[] | null>(null);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [aiEditTargetProduct, setAiEditTargetProduct] = useState<Product | null>(null);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [quickDiscountProduct, setQuickDiscountProduct] = useState<Product | null>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Category addition states
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [managedCategories, setManagedCategories] = useState<ManagedCategory[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [isAddingCustomCompany, setIsAddingCustomCompany] = useState(false);
  const [customCompanyName, setCustomCompanyName] = useState('');
  const [isAddingCustomSize, setIsAddingCustomSize] = useState(false);
  const [customSizeName, setCustomSizeName] = useState('');
  const [customCompanyList, setCustomCompanyList] = useState<CompanyBrand[]>([]);
  const [customSizeList, setCustomSizeList] = useState<string[]>([]);
  const [isManageCategoriesModalOpen, setIsManageCategoriesModalOpen] = useState(false);

  // Form states
  const [sellBy, setSellBy] = useState<'unit' | 'weight'>('unit');
  const [unitType, setUnitType] = useState<'piece' | 'kg' | 'g' | 'liter' | 'dozen'>('piece');
  const [barcode, setBarcode] = useState('');
  const [noBarcode, setNoBarcode] = useState(false);
  const [serialNumber, setSerialNumber] = useState('');
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  
  // Google Image Search & Auto-Paste states
  const [isGeneratingAiImage, setIsGeneratingAiImage] = useState(false);
  const [autoAiImageEnabled, setAutoAiImageEnabled] = useState(true);
  const [aiImageSource, setAiImageSource] = useState<string | null>(null);
  const [imageSourceDomain, setImageSourceDomain] = useState<string | null>(null);
  const [fallbackThumbnailUrl, setFallbackThumbnailUrl] = useState<string | null>(null);
  const [searchCandidates, setSearchCandidates] = useState<Array<{ url: string; thumbnail: string; title: string; domain?: string }>>([]);
  const aiImageFetchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchedNameRef = useRef<string>('');
  const [weight, setWeight] = useState('');
  const [weightPerUnit, setWeightPerUnit] = useState<number | ''>('');
  const [category, setCategory] = useState('General');
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [marginPercent, setMarginPercent] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [discountActive, setDiscountActive] = useState<boolean>(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  
  const getTodayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [discountStartDate, setDiscountStartDate] = useState<string>(getTodayISO());
  const [discountEndDate, setDiscountEndDate] = useState<string>('');
  const [hasDateLimit, setHasDateLimit] = useState<boolean>(false);

  const applyDiscountDatePreset = (days: number | 'today' | 'end_month' | 'none') => {
    const todayStr = getTodayISO();
    setDiscountStartDate(todayStr);

    if (days === 'none') {
      setHasDateLimit(false);
      setDiscountEndDate('');
      return;
    }

    setHasDateLimit(true);

    if (days === 'today') {
      setDiscountEndDate(todayStr);
      return;
    }

    if (days === 'end_month') {
      const today = new Date();
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const endStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
      setDiscountEndDate(endStr);
      return;
    }

    const future = new Date();
    future.setDate(future.getDate() + (days - 1));
    const endStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    setDiscountEndDate(endStr);
  };

  const [stockQuantityToAdd, setStockQuantityToAdd] = useState<number | ''>('');
  const [stockAdjustmentMode, setStockAdjustmentMode] = useState<'keep' | 'add' | 'set'>('keep');
  const [minStockLevel, setMinStockLevel] = useState<number>(5);

  const [existingProduct, setExistingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'weight' | 'unit'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [activeTab, setActiveTab] = useState<'catalog' | 'form'>('form');
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);
  const showNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setMsg({ type: type === 'info' ? 'success' : type, text });
    setTimeout(() => {
      setMsg(prev => (prev?.text === text ? null : prev));
    }, 4000);
  };
  const [loading, setLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showHardwareBar, setShowHardwareBar] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const serialNumberInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const priceInputRef = useRef<HTMLInputElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Compute all available categories including presets, custom store categories, and managed taxonomy
  const availableCategories = useMemo(() => {
    return getAllCategories(store, products, managedCategories);
  }, [store, products, managedCategories]);

  // Find active managed category matching current category selection
  const activeManagedCategory = useMemo(() => {
    if (!category) return null;
    return managedCategories.find(c => c.name.toLowerCase() === category.toLowerCase()) || null;
  }, [managedCategories, category]);

  // Companies strictly according to the category chosen by the user
  const activeCategoryCompanies = useMemo(() => {
    const base = getCompaniesForCategory(category, managedCategories);
    const extra = customCompanyList.filter(c => !base.some(b => b.id === c.id));
    return [...base, ...extra];
  }, [category, managedCategories, customCompanyList]);

  const activeSelectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return activeCategoryCompanies.find(c => c.id === selectedCompanyId) || null;
  }, [activeCategoryCompanies, selectedCompanyId]);

  // Sizes available according to selected company or category defaults
  const activeAvailableSizes = useMemo(() => {
    let sizes: string[] = [];
    if (activeSelectedCompany && activeSelectedCompany.sizes && activeSelectedCompany.sizes.length > 0) {
      sizes = activeSelectedCompany.sizes.map(s => normalizeSizeLabel(s)).filter(Boolean);
    } else {
      sizes = getDefaultSizesForCategory(category);
    }
    const combined = Array.from(new Set([...sizes, ...customSizeList]));
    return combined;
  }, [activeSelectedCompany, category, customSizeList]);

  // Preview system assigned 4-digit serial number
  const previewNextSerialNumber = useMemo(() => {
    if (existingProduct?.serialNumber && /^\d{4}$/.test(existingProduct.serialNumber)) {
      return existingProduct.serialNumber;
    }
    if (existingProduct?.shortcutCode && /^\d{4}$/.test(existingProduct.shortcutCode)) {
      return existingProduct.shortcutCode;
    }
    return generateNext4DigitSerialNumber(products);
  }, [existingProduct, products]);

  // Handler to add a new category dynamically
  const handleAddNewCategory = async () => {
    const trimmed = (newCategoryName || '').trim();
    if (!trimmed) {
      showNotification('error', 'Please enter a category name.');
      return;
    }
    setIsSavingCategory(true);
    try {
      const res = await addCustomCategoryToStore(store.id, trimmed, store.customCategories);
      if (res.success) {
        setCategory(trimmed);
        setNewCategoryName('');
        setIsAddCategoryModalOpen(false);
        showNotification('success', `Category "${trimmed}" added and selected!`);
      } else {
        showNotification('error', res.error || 'Failed to add category.');
      }
    } catch {
      showNotification('error', 'Failed to save category.');
    } finally {
      setIsSavingCategory(false);
    }
  };

  // Auto compress and convert uploaded image to compact base64
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('error', 'Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          setImageUrl(compressed);
          showNotification('success', 'Product photo attached and optimized!');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Auto focus barcode input for fast hardware USB barcode scanner support
  useEffect(() => {
    if (!isScannerOpen && !isGeneratorOpen && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [isScannerOpen, isGeneratorOpen]);

  // Catch physical barcode scanner typing if focus was accidentally blurred
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
      if (!isInputActive && !isScannerOpen && !isGeneratorOpen && barcodeInputRef.current) {
        if (e.key.length === 1 || e.key === 'Enter') {
          barcodeInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isScannerOpen, isGeneratorOpen]);

  // Subscribe to Products for this store
  useEffect(() => {
    if (!store?.id) return;

    const q = query(
      collection(db, 'products'),
      where('storeId', '==', store.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: Product[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });
      setProducts(list.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'products');
    });

    return () => unsub();
  }, [store?.id]);

  // Subscribe to Managed Categories for this store
  useEffect(() => {
    if (!store?.id) return;

    const qCat = query(
      collection(db, 'categories'),
      where('storeId', '==', store.id)
    );

    const unsubCat = onSnapshot(qCat, (snapshot) => {
      const list: ManagedCategory[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ManagedCategory);
      });

      if (list.length === 0) {
        fetchStoreManagedCategories(store.id).then((seeded) => {
          setManagedCategories(seeded);
        });
      } else {
        setManagedCategories(list.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      }
    }, (err) => {
      console.warn('Categories subscription notice:', err);
    });

    return () => unsubCat();
  }, [store?.id]);

  const handleSelectProductToEdit = (p: Product) => {
    setBarcode(p.barcode || '');
    setSerialNumber(p.serialNumber || '');
    setExistingProduct(p);
    setName(p.name);
    setImageUrl(p.imageUrl || '');
    setWeight(p.weight || '');
    setCategory(p.category || 'General');
    const cPrice = p.costPrice !== undefined ? p.costPrice : '';
    setCostPrice(cPrice);
    setPrice(p.price);
    if (typeof cPrice === 'number' && cPrice > 0 && typeof p.price === 'number' && p.price > 0) {
      setMarginPercent(Math.round(((p.price - cPrice) / cPrice) * 100 * 10) / 10);
    } else {
      setMarginPercent('');
    }
    setDiscountActive(p.discountActive || false);
    setDiscountType(p.discountType || 'percentage');
    setDiscountValue(p.discountValue !== undefined ? p.discountValue : '');
    setDiscountStartDate(p.discountStartDate || getTodayISO());
    setDiscountEndDate(p.discountEndDate || '');
    setHasDateLimit(!!p.discountEndDate);
    setMinStockLevel(p.minStockLevel !== undefined ? p.minStockLevel : 5);
    setSellBy(p.sellBy || (p.unitType === 'kg' ? 'weight' : 'unit'));
    setUnitType((p.unitType as any) || (p.sellBy === 'weight' ? 'kg' : 'piece'));
    setWeightPerUnit(p.weightPerUnit !== undefined ? p.weightPerUnit : '');
    setStockAdjustmentMode('keep');
    setStockQuantityToAdd('');
    setShowMoreOptions(Boolean(
      p.discountActive || 
      p.weightPerUnit || 
      (p.minStockLevel !== undefined && p.minStockLevel !== 5) || 
      (p.weight && p.sellBy === 'weight')
    ));
  };

  // Helper to find a registered product by Barcode, Serial Number, Short Code (1001-9999), or ID
  const findRegisteredProduct = (queryCode: string): Product | undefined => {
    const clean = (queryCode || '').trim();
    if (!clean) return undefined;
    const cleanLower = clean.toLowerCase();

    // 1. Match by 4-digit Short Code (e.g. "1001", "1002")
    const byShortcut = products.find(p => p.shortcutCode && p.shortcutCode.trim().toLowerCase() === cleanLower);
    if (byShortcut) return byShortcut;

    // 2. Match by exact Barcode
    const byBarcode = products.find(p => p.barcode && p.barcode.trim().toLowerCase() === cleanLower);
    if (byBarcode) return byBarcode;

    // 3. Match by exact Serial Number
    const bySerial = products.find(p => p.serialNumber && p.serialNumber.trim().toLowerCase() === cleanLower);
    if (bySerial) return bySerial;

    // 4. Match by Product ID
    const byId = products.find(p => p.id === clean || p.id.toLowerCase() === cleanLower);
    if (byId) return byId;

    return undefined;
  };

  // Dedicated handler when user inputs a Barcode, Serial Number, or Short Code and hits Enter
  const handleCodeEnterLookup = (code: string, sourceField: 'barcode' | 'serial' | 'search') => {
    const trimmed = (code || '').trim();
    if (!trimmed) return;

    const matched = findRegisteredProduct(trimmed);
    if (matched) {
      handleSelectProductToEdit(matched);
      const codeType = matched.shortcutCode?.toLowerCase() === trimmed.toLowerCase()
        ? `Short Code: ${matched.shortcutCode}`
        : matched.serialNumber?.toLowerCase() === trimmed.toLowerCase()
        ? `S/N: ${matched.serialNumber}`
        : `Barcode: ${matched.barcode || trimmed}`;
      showNotification('success', `✓ Found "${matched.name}" (${codeType}) - Opened for editing!`);
      
      // Auto-focus the Selling Price or Quantity field for rapid stock/price modification
      setTimeout(() => {
        if (priceInputRef.current) {
          priceInputRef.current.focus();
          priceInputRef.current.select();
        }
      }, 120);
    } else {
      if (sourceField === 'barcode') {
        showNotification('error', `No registered product found with barcode / short code "${trimmed}". Enter details to register as a new product.`);
        if (nameInputRef.current) {
          nameInputRef.current.focus();
        }
      } else if (sourceField === 'serial') {
        showNotification('error', `No registered product found with serial number / short code "${trimmed}".`);
        if (nameInputRef.current) {
          nameInputRef.current.focus();
        }
      } else {
        showNotification('error', `No registered product found matching "${trimmed}".`);
      }
    }
  };

  // Whenever barcode or serial number changes, check if existing product
  useEffect(() => {
    const trimmedBarcode = barcode.trim().toLowerCase();
    const trimmedSerial = serialNumber.trim().toLowerCase();

    if (!trimmedBarcode && !trimmedSerial) {
      setExistingProduct(prev => prev !== null ? null : prev);
      return;
    }

    const found = products.find(p => 
      (trimmedBarcode && p.barcode && p.barcode.trim().toLowerCase() === trimmedBarcode) ||
      (trimmedBarcode && p.shortcutCode && p.shortcutCode.trim().toLowerCase() === trimmedBarcode) ||
      (trimmedSerial && p.shortcutCode && p.shortcutCode.trim().toLowerCase() === trimmedSerial) ||
      (trimmedSerial && p.serialNumber && p.serialNumber.trim().toLowerCase() === trimmedSerial)
    );

    if (found) {
      setExistingProduct(prev => {
        if (prev?.id === found.id) return prev;
        return found;
      });
      // Only set form values if switching to a new found product
      setExistingProduct(prev => {
        if (prev?.id !== found.id) {
          if (!barcode && found.barcode) setBarcode(found.barcode);
          if (!serialNumber && found.serialNumber) setSerialNumber(found.serialNumber || '');
          setName(found.name);
          setImageUrl(found.imageUrl || '');
          setWeight(found.weight || '');
          setCategory(found.category || 'General');
          setCostPrice(found.costPrice !== undefined ? found.costPrice : '');
          setPrice(found.price);
          setMinStockLevel(found.minStockLevel !== undefined ? found.minStockLevel : 5);
          setSellBy(found.sellBy || (found.unitType === 'kg' ? 'weight' : 'unit'));
          setUnitType((found.unitType as any) || (found.sellBy === 'weight' ? 'kg' : 'piece'));
          setWeightPerUnit(found.weightPerUnit !== undefined ? found.weightPerUnit : '');
          setStockAdjustmentMode('keep');
          setStockQuantityToAdd('');
          return found;
        }
        return prev;
      });
    } else {
      setExistingProduct(prev => prev !== null ? null : prev);
    }
  }, [barcode, serialNumber, products]);

  // Handler to search Google and copy/paste real product image URL
  const handleSearchProductImageOnline = async (productTitle?: string, force = false) => {
    const targetTitle = (productTitle !== undefined ? productTitle : name).trim();
    if (!targetTitle) {
      if (force) {
        showNotification('error', 'Please enter a product name first to search Google for an image.');
      }
      return;
    }

    if (!force && lastFetchedNameRef.current.toLowerCase() === targetTitle.toLowerCase() && imageUrl) {
      return;
    }

    setIsGeneratingAiImage(true);
    try {
      const brandName = activeSelectedCompany?.name || undefined;
      const res = await fetch('/api/ai/product-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${targetTitle} ${brandName || ''} ${selectedSize || ''} ${category !== 'General' ? category : ''}`.trim(),
          category: category !== 'General' ? category : undefined,
          brand: brandName,
          size: selectedSize || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Image search request failed');
      }

      const data = await res.json();
      if (data && data.imageUrl) {
        setImageUrl(data.imageUrl);
        setFallbackThumbnailUrl(data.thumbnailUrl || null);
        setAiImageSource(data.source || 'google_web_search');
        setImageSourceDomain(data.sourceDomain || null);
        if (Array.isArray(data.candidates) && data.candidates.length > 0) {
          setSearchCandidates(data.candidates);
        }
        lastFetchedNameRef.current = targetTitle;
        showNotification('success', `✓ Automatically searched image, copied link & pasted for "${targetTitle}"!`);
      }
    } catch (err: any) {
      console.warn('[Online Image Search Error]:', err);
      if (force) {
        showNotification('error', 'Could not retrieve image from Google. You can paste any image URL or upload manually.');
      }
    } finally {
      setIsGeneratingAiImage(false);
    }
  };
  const handleAutoGenerateProductPicture = handleSearchProductImageOnline;

  // Automatically trigger AI Product Picture when user enters or edits product name/category/brand
  useEffect(() => {
    if (!autoAiImageEnabled) return;
    const trimmed = name.trim();
    if (trimmed.length < 3) return;
    if (existingProduct && imageUrl && !aiImageSource) return;

    if (aiImageFetchDebounceRef.current) {
      clearTimeout(aiImageFetchDebounceRef.current);
    }

    aiImageFetchDebounceRef.current = setTimeout(() => {
      if (!imageUrl || aiImageSource) {
        handleAutoGenerateProductPicture(trimmed, false);
      }
    }, 400);

    return () => {
      if (aiImageFetchDebounceRef.current) {
        clearTimeout(aiImageFetchDebounceRef.current);
      }
    };
  }, [name, category, selectedCompanyId, selectedSize, autoAiImageEnabled]);

  const handleSelectCompany = (comp: CompanyBrand | null) => {
    if (!comp) {
      setSelectedCompanyId(null);
      setSelectedSize(null);
      return;
    }
    setSelectedCompanyId(comp.id);
    setSelectedSize(null);
    // User adds product name manually; do not automatically add company name or category
  };

  const handleSelectSize = (szStr: string | null) => {
    if (!szStr) {
      setSelectedSize(null);
      return;
    }
    setSelectedSize(szStr);
    if (szStr.includes('kg') || szStr.includes('g') || szStr.includes('Liter') || szStr.includes('ml')) {
      setWeight(szStr);
    }
    // User adds product name manually; do not automatically add company name or category
  };

  const handleAddCustomCompanySubmit = () => {
    const trimmed = customCompanyName.trim();
    if (!trimmed) return;
    const newComp: CompanyBrand = {
      id: `comp-custom-${Date.now()}`,
      name: trimmed,
      sizes: getDefaultSizesForCategory(category),
      createdAt: new Date().toISOString()
    };
    setCustomCompanyList(prev => [...prev, newComp]);
    setSelectedCompanyId(newComp.id);
    setSelectedSize(null);
    setCustomCompanyName('');
    setIsAddingCustomCompany(false);
    // User adds product name manually; do not automatically add company name or category
    showNotification('success', `Added company "${trimmed}" for ${category}!`);
  };

  const handleAddCustomSizeSubmit = () => {
    const trimmed = customSizeName.trim();
    if (!trimmed) return;
    setCustomSizeList(prev => [...prev, trimmed]);
    handleSelectSize(trimmed);
    setCustomSizeName('');
    setIsAddingCustomSize(false);
    showNotification('success', `Selected size "${trimmed}"!`);
  };


  const handleResetForm = () => {
    setBarcode('');
    setSerialNumber('');
    setName('');
    setImageUrl('');
    setAiImageSource(null);
    lastFetchedNameRef.current = '';
    setWeight('');
    setWeightPerUnit('');
    setCategory('General');
    setSelectedCompanyId(null);
    setSelectedSize(null);
    setIsAddingCustomCompany(false);
    setIsAddingCustomSize(false);
    setCustomCompanyList([]);
    setCustomSizeList([]);
    setCostPrice('');
    setMarginPercent('');
    setPrice('');
    setSellBy('unit');
    setUnitType('piece');
    setDiscountActive(false);
    setDiscountType('percentage');
    setDiscountValue('');
    setDiscountStartDate(getTodayISO());
    setDiscountEndDate('');
    setHasDateLimit(false);
    setStockQuantityToAdd('');
    setStockAdjustmentMode('keep');
    setExistingProduct(null);
    setShowMoreOptions(false);
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  const handleOpenGeneratorForProduct = (p?: Product) => {
    if (p) {
      setProductForGenerator(p);
    } else {
      setProductForGenerator({
        name: name || '',
        imageUrl: imageUrl || undefined,
        barcode: barcode || '',
        serialNumber: serialNumber || '',
        weight: weight || (sellBy === 'weight' ? '1 kg' : '500g'),
        costPrice: typeof costPrice === 'number' ? costPrice : (costPrice !== '' ? parseFloat(costPrice as any) : undefined),
        price: typeof price === 'number' ? price : 0,
        category: category || 'General',
        stockQuantity: typeof stockQuantityToAdd === 'number' ? stockQuantityToAdd : 50,
        sellBy: sellBy,
        unitType: unitType,
        pricePerKg: sellBy === 'weight' && typeof price === 'number' ? price : undefined,
        weightPerUnit: typeof weightPerUnit === 'number' ? weightPerUnit : undefined
      });
    }
    setIsGeneratorOpen(true);
  };

  const handleDirectDownloadBarcode = async (p: Product) => {
    try {
      showNotification('success', `Preparing barcode download for "${p.name}"...`);
      await downloadBarcodeForProduct(p, store?.name || 'SUPERMARKET');
      showNotification('success', `Downloaded Barcode Sticker for "${p.name}"!`);
    } catch (err: any) {
      showNotification('error', `Failed to download barcode: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleAutoGenerateBarcodeNumber = () => {
    const newCode = generate5DigitBarcode();
    setBarcode(newCode);
    showNotification('success', `Generated new Full Barcode: ${newCode}`);
  };

  const handleSubmitProductStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    let trimmedBarcode = barcode.trim();
    let trimmedName = name.trim();
    if (!trimmedName) {
      showNotification('error', 'Please enter a product name.');
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
      return;
    }
    const trimmedWeight = weight.trim();
    const numericPrice = typeof price === 'number' ? price : parseFloat(price as any);
    const numericCostPrice = typeof costPrice === 'number' ? costPrice : (costPrice !== '' ? parseFloat(costPrice as any) : undefined);
    const numericWeightPerUnit = typeof weightPerUnit === 'number' ? weightPerUnit : (weightPerUnit ? parseFloat(weightPerUnit as string) : undefined);

    if (!trimmedName) {
      showNotification('error', 'Product Name is required.');
      return;
    }

    if (isNaN(numericPrice) || numericPrice < 0) {
      showNotification('error', sellBy === 'weight' ? 'Please enter a valid price per kg in Pakistani Rupees (Rs.).' : 'Please enter a valid price in Pakistani Rupees (Rs.).');
      return;
    }

    // MANDATORY REQUIREMENT: Product register cannot register product without adding cost price
    if (numericCostPrice === undefined || isNaN(numericCostPrice) || numericCostPrice < 0) {
      showNotification('error', 'Cost Price is mandatory! A product cannot be registered without adding its cost price.');
      return;
    }

    // Auto-generate full barcode if not entered and barcode is required
    if (!trimmedBarcode && !noBarcode) {
      trimmedBarcode = generate5DigitBarcode();
      setBarcode(trimmedBarcode);
    } else if (noBarcode) {
      trimmedBarcode = '';
      setBarcode('');
    }

    // Find if barcode already belongs to an existing product in catalog
    const existingBarcodeMatch = trimmedBarcode 
      ? products.find(p => p.barcode && p.barcode.trim().toLowerCase() === trimmedBarcode.toLowerCase())
      : undefined;

    const targetProduct = existingProduct || existingBarcodeMatch;
    const unitLabel = sellBy === 'weight' ? 'kg' : 'units';

    let finalTotalStock = 0;
    let stockSummaryText = '';

    if (targetProduct) {
      if (stockAdjustmentMode === 'keep') {
        finalTotalStock = targetProduct.stockQuantity;
        stockSummaryText = `Stock kept at ${finalTotalStock} ${unitLabel}`;
      } else if (stockAdjustmentMode === 'set') {
        const parsedVal = typeof stockQuantityToAdd === 'number' ? stockQuantityToAdd : (stockQuantityToAdd === '' ? 0 : parseFloat(stockQuantityToAdd as string));
        if (isNaN(parsedVal) || parsedVal < 0) {
          showNotification('error', 'Please enter a valid stock quantity (0 or greater).');
          return;
        }
        finalTotalStock = Math.round(parsedVal * 1000) / 1000;
        stockSummaryText = `Stock set to ${finalTotalStock} ${unitLabel}`;
      } else {
        // 'add'
        const parsedVal = typeof stockQuantityToAdd === 'number' ? stockQuantityToAdd : (stockQuantityToAdd === '' ? 0 : parseFloat(stockQuantityToAdd as string));
        if (isNaN(parsedVal) || parsedVal <= 0) {
          showNotification('error', `Please enter a quantity greater than 0 to add to stock.`);
          return;
        }
        const roundedAdded = Math.round(parsedVal * 1000) / 1000;
        finalTotalStock = Math.round((targetProduct.stockQuantity + roundedAdded) * 1000) / 1000;
        stockSummaryText = `Added +${roundedAdded} ${unitLabel} (Total Stock: ${finalTotalStock} ${unitLabel})`;
      }
    } else {
      // New product
      const parsedVal = typeof stockQuantityToAdd === 'number' ? stockQuantityToAdd : (stockQuantityToAdd === '' ? 0 : parseFloat(stockQuantityToAdd as string));
      if (isNaN(parsedVal) || parsedVal < 0) {
        showNotification('error', 'Please enter a valid initial stock quantity (0 or greater).');
        return;
      }
      finalTotalStock = Math.round(parsedVal * 1000) / 1000;
      stockSummaryText = `Initial stock: ${finalTotalStock} ${unitLabel}`;
    }

    setLoading(true);

    // Auto-save new custom category to store in Firestore if not already present
    const finalCat = category.trim() || 'General';
    if (finalCat && !availableCategories.some(c => c.toLowerCase() === finalCat.toLowerCase())) {
      saveNewCategoryToStore(store.id, store.customCategories || [], finalCat).catch(e => console.warn('Category sync:', e));
    }

    try {
      // System assigns a 4-digit serial number (1001-9999)
      const assigned4DigitSerial = targetProduct?.serialNumber && /^\d{4}$/.test(targetProduct.serialNumber)
        ? targetProduct.serialNumber
        : targetProduct?.shortcutCode && /^\d{4}$/.test(targetProduct.shortcutCode)
        ? targetProduct.shortcutCode
        : generateNext4DigitSerialNumber(products);

      const assignedShortcutCode = targetProduct?.shortcutCode && /^\d{4}$/.test(targetProduct.shortcutCode)
        ? targetProduct.shortcutCode
        : assigned4DigitSerial;

      const codeInfo = [
        `S/N: ${assigned4DigitSerial}`,
        trimmedBarcode ? `BC: ${trimmedBarcode}` : null,
        trimmedWeight ? `Wt: ${trimmedWeight}` : null,
        sellBy === 'weight' ? 'Sell By Weight (kg)' : null
      ].filter(Boolean).join(', ');

      let finalImageUrl = imageUrl.trim();
      // When user enters any new product, automatically search and add the pic address from Google by name
      if (!finalImageUrl && trimmedName) {
        try {
          setIsGeneratingAiImage(true);
          finalImageUrl = await fetchProductImageUrl(trimmedName);
          if (finalImageUrl) {
            setImageUrl(finalImageUrl);
          }
        } catch (e) {
          console.warn('Auto image fetch on save error:', e);
        } finally {
          setIsGeneratingAiImage(false);
        }
      }

      if (targetProduct) {
        // UPDATE EXISTING PRODUCT
        const productDocRef = doc(db, 'products', targetProduct.id);

        const numDiscountValue = discountActive && discountValue !== '' ? Number(discountValue) : undefined;
        const finalStartDate = discountActive && hasDateLimit && discountStartDate ? discountStartDate : undefined;
        const finalEndDate = discountActive && hasDateLimit && discountEndDate ? discountEndDate : undefined;

        await updateDoc(productDocRef, cleanFirestoreData({
          barcode: trimmedBarcode || '',
          shortcutCode: assignedShortcutCode,
          serialNumber: assigned4DigitSerial,
          name: trimmedName,
          imageUrl: finalImageUrl || undefined,
          weight: trimmedWeight || (sellBy === 'weight' ? `${finalTotalStock} kg` : ''),
          category: category.trim() || 'General',
          costPrice: numericCostPrice !== undefined && !isNaN(numericCostPrice) ? numericCostPrice : 0,
          price: numericPrice,
          pricePerKg: sellBy === 'weight' ? numericPrice : undefined,
          sellBy: sellBy,
          unitType: sellBy === 'weight' ? (unitType || 'kg') : (unitType || 'piece'),
          weightPerUnit: numericWeightPerUnit || undefined,
          discountActive: discountActive && !!numDiscountValue,
          discountType: discountType || 'percentage',
          discountValue: numDiscountValue || undefined,
          discountStartDate: finalStartDate || null,
          discountEndDate: finalEndDate || null,
          stockQuantity: finalTotalStock,
          minStockLevel: minStockLevel !== undefined ? minStockLevel : 5,
          updatedAt: new Date().toISOString()
        }));

        showNotification(
          'success',
          `Updated "${trimmedName}" (${codeInfo})! Price: Rs. ${numericPrice.toFixed(2)}${sellBy === 'weight' ? '/kg' : ''} • ${stockSummaryText}`
        );
      } else {
        // REGISTER NEW PRODUCT with system-assigned 4-digit serial number
        const productDocRef = doc(collection(db, 'products'));
        const numDiscountValue = discountActive && discountValue !== '' ? Number(discountValue) : undefined;
        const finalStartDate = discountActive && hasDateLimit && discountStartDate ? discountStartDate : undefined;
        const finalEndDate = discountActive && hasDateLimit && discountEndDate ? discountEndDate : undefined;

        const newProduct: Product = {
          id: productDocRef.id,
          storeId: store.id,
          barcode: trimmedBarcode || '',
          shortcutCode: assignedShortcutCode,
          serialNumber: assigned4DigitSerial,
          name: trimmedName,
          imageUrl: finalImageUrl || undefined,
          weight: trimmedWeight || (sellBy === 'weight' ? `${finalTotalStock} kg` : ''),
          category: category.trim() || 'General',
          costPrice: numericCostPrice !== undefined && !isNaN(numericCostPrice) ? numericCostPrice : 0,
          price: numericPrice,
          pricePerKg: sellBy === 'weight' ? numericPrice : undefined,
          sellBy: sellBy,
          unitType: sellBy === 'weight' ? (unitType || 'kg') : (unitType || 'piece'),
          weightPerUnit: numericWeightPerUnit || undefined,
          discountActive: discountActive && !!numDiscountValue,
          discountType: discountType || 'percentage',
          discountValue: numDiscountValue || undefined,
          discountStartDate: finalStartDate,
          discountEndDate: finalEndDate,
          stockQuantity: finalTotalStock,
          minStockLevel: minStockLevel !== undefined ? minStockLevel : 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await setDoc(productDocRef, cleanFirestoreData(newProduct));

        showNotification(
          'success',
          `Registered new product "${trimmedName}" [4-Digit S/N: ${assigned4DigitSerial}]${codeInfo ? ` (${codeInfo})` : ''} at Rs. ${numericPrice.toFixed(2)}${sellBy === 'weight' ? '/kg' : ''} • ${stockSummaryText}`
        );
      }

      handleResetForm();
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Failed to save product: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler for saving from BarcodeGeneratorModal
  const handleSaveFromGenerator = async (productData: {
    name: string;
    uniqueNumber: string;
    weight: string;
    costPrice?: number;
    price: number;
    category?: string;
    stockQuantity?: number;
  }) => {
    const existing = products.find(
      p => (p.barcode && p.barcode.toLowerCase() === productData.uniqueNumber.toLowerCase()) ||
           (p.name && p.name.toLowerCase() === productData.name.toLowerCase())
    );

    if (existing) {
      const newStock = existing.stockQuantity + (productData.stockQuantity || 50);
      await updateDoc(doc(db, 'products', existing.id), cleanFirestoreData({
        barcode: productData.uniqueNumber || '',
        name: productData.name,
        weight: productData.weight || '',
        costPrice: productData.costPrice !== undefined ? productData.costPrice : (existing.costPrice || 0),
        price: productData.price,
        category: productData.category || 'General',
        stockQuantity: newStock,
        updatedAt: new Date().toISOString()
      }));
      showNotification('success', `Updated stock for "${productData.name}" (Total Stock: ${newStock}) at Rs. ${productData.price.toFixed(2)}`);
    } else {
      const newDocRef = doc(collection(db, 'products'));
      const shortcutCode = generateNextShortcutCode(products);
      let genImg = '';
      try {
        genImg = await fetchProductImageUrl(productData.name);
      } catch (e) {
        console.warn('Auto image fetch error for generator product:', e);
      }
      const newProd: Product = {
        id: newDocRef.id,
        storeId: store.id,
        barcode: productData.uniqueNumber || '',
        shortcutCode,
        name: productData.name,
        imageUrl: genImg || undefined,
        weight: productData.weight || '',
        category: productData.category || 'General',
        costPrice: productData.costPrice || 0,
        price: productData.price,
        stockQuantity: productData.stockQuantity || 50,
        minStockLevel: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(newDocRef, cleanFirestoreData(newProd));
      showNotification('success', `Created & registered product "${productData.name}" [Code: ${shortcutCode}] with ${productData.stockQuantity || 50} units at Rs. ${productData.price.toFixed(2)}`);
    }
  };

  // Calculate store inventory and financial valuation
  const inventoryStats = useMemo(() => {
    let totalCostValue = 0;
    let totalRetailValue = 0;
    let totalUnitsCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    (products || []).forEach((p) => {
      const qty = p.stockQuantity || 0;
      const effectiveSellPrice = p.price || p.pricePerKg || 0;
      const effectiveCostPrice = p.costPrice || 0;
      const minLevel = p.minStockLevel ?? 5;

      totalUnitsCount += qty;
      totalCostValue += effectiveCostPrice * qty;
      totalRetailValue += effectiveSellPrice * qty;

      if (qty <= 0) {
        outOfStockCount++;
      } else if (qty <= minLevel) {
        lowStockCount++;
      }
    });

    const projectedProfit = totalRetailValue - totalCostValue;
    const overallMargin = totalRetailValue > 0 ? (projectedProfit / totalRetailValue) * 100 : 0;

    return {
      totalItemsCount: totalUnitsCount,
      totalUnitsCount,
      totalProductsCount: (products || []).length,
      totalCostValue,
      totalRetailValue,
      projectedProfit,
      overallMargin,
      lowStockCount,
      outOfStockCount
    };
  }, [products]);

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const confirmSingleDelete = async () => {
    if (!productToDelete) return;
    const p = productToDelete;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'products', p.id));
      showNotification('success', `Deleted "${p.name}" from stock inventory.`);

      setSelectedProductIds(prev => prev.filter(id => id !== p.id));

      if (existingProduct?.id === p.id) {
        setBarcode('');
        setSerialNumber('');
        setName('');
        setWeight('');
        setCategory('General');
        setPrice('');
        setStockQuantityToAdd('');
        setExistingProduct(null);
      }
      setProductToDelete(null);
    } catch (err: any) {
      console.error('Delete product error:', err);
      showNotification('error', 'Failed to delete product stock: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = (p: Product) => {
    setProductToDelete(p);
  };

  const handleToggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === filteredCatalog.length && filteredCatalog.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredCatalog.map(p => p.id));
    }
  };

  const handleBulkDelete = () => {
    if (selectedProductIds.length === 0) return;
    setIsBulkDeleteModalOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;

    setLoading(true);
    let deletedCount = 0;
    try {
      for (const id of selectedProductIds) {
        await deleteDoc(doc(db, 'products', id));
        deletedCount++;
      }

      showNotification('success', `Successfully deleted ${deletedCount} selected product(s) from inventory.`);
      setSelectedProductIds([]);
      setIsBulkDeleteModalOpen(false);

      if (existingProduct && selectedProductIds.includes(existingProduct.id)) {
        setBarcode('');
        setSerialNumber('');
        setName('');
        setWeight('');
        setCategory('General');
        setPrice('');
        setStockQuantityToAdd('');
        setExistingProduct(null);
      }
    } catch (err: any) {
      console.error('Bulk delete error:', err);
      showNotification('error', 'Failed during bulk deletion: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCatalog = products.filter(p => {
    if (catalogFilter === 'weight' && !(p.sellBy === 'weight' || p.unitType === 'kg' || p.pricePerKg)) return false;
    if (catalogFilter === 'unit' && (p.sellBy === 'weight' || p.unitType === 'kg' || p.pricePerKg)) return false;

    if (selectedCategoryFilter !== 'all') {
      if (selectedCategoryFilter === 'weight' && !(p.sellBy === 'weight' || p.unitType === 'kg' || p.pricePerKg)) return false;
      else if (selectedCategoryFilter === 'unit' && (p.sellBy === 'weight' || p.unitType === 'kg' || p.pricePerKg)) return false;
      else if (selectedCategoryFilter !== 'weight' && selectedCategoryFilter !== 'unit') {
        if ((p.category || 'General').toLowerCase() !== selectedCategoryFilter.toLowerCase()) return false;
      }
    }

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(term) ||
      (p.barcode || '').toLowerCase().includes(term) ||
      (p.serialNumber && p.serialNumber.toLowerCase().includes(term)) ||
      (p.shortcutCode && p.shortcutCode.toLowerCase().includes(term)) ||
      (p.weight && p.weight.toLowerCase().includes(term)) ||
      (p.category || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-3.5 sm:p-5 md:p-6 lg:p-8 xl:p-10">
      <div className="max-w-7xl 2xl:max-w-[1600px] w-full mx-auto space-y-5 sm:space-y-6">

        {/* Sleek Single-Layer Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:px-5 sm:py-3.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {onBack && (
              <UniversalBackButton onBack={onBack} label="Back" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-blue-600" />
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Product Register
                </h1>
                <span className="text-slate-300">·</span>
                <span className="text-xs text-slate-600 font-semibold">{store.name}</span>
              </div>
              <p className="text-xs text-slate-500">
                Register stock inventory, set selling prices, and print barcode labels (PKR)
              </p>
            </div>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl w-full sm:w-auto border border-slate-200/60 shrink-0">
            <button
              type="button"
              id="tab-btn-product-register"
              onClick={() => {
                if (activeTab !== 'form') {
                  handleResetForm();
                  setActiveTab('form');
                }
              }}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PackagePlus className="w-4 h-4" />
              <span>{existingProduct ? 'Edit Product' : 'Add Product'}</span>
              {existingProduct && (
                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black uppercase">
                  Editing
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab-btn-stock-catalog"
              onClick={() => setActiveTab('catalog')}
              className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Stock Catalog</span>
              <span className="text-xs font-semibold text-slate-500 tabular-nums">
                ({products.length})
              </span>
            </button>
          </div>
        </div>

        {/* Animated View Container with Changing Transition Animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.995 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full space-y-6"
          >
            
            {/* Catalog Section (Visible in 'catalog' mode) */}
            {activeTab === 'catalog' && (
              <div className="w-full bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 lg:p-8 shadow-sm space-y-5">
                
                {/* Top Bar: "Products" Title on Left, "+ Add Product" & Controls on Right (Matches Screenshot) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                      Products
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                      {products.length}
                    </span>
                  </div>

                  {/* Actions Group: View Switcher, Bulk Delete & + Add Product */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* View Switcher: Table vs Grid */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                          viewMode === 'table'
                            ? 'bg-white text-blue-700 shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Detailed Table View"
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>Table</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                          viewMode === 'grid'
                            ? 'bg-white text-blue-700 shadow-xs font-black'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="POS Card Grid View"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Grid</span>
                      </button>
                    </div>

                    {/* Bulk Delete */}
                    {selectedProductIds.length > 0 && (
                      <button
                        onClick={handleBulkDelete}
                        className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> 
                        <span>Delete ({selectedProductIds.length})</span>
                      </button>
                    )}

                    {/* Primary "+ Add Product" Button (Matches Screenshot) */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => {
                        handleResetForm();
                        setActiveTab('form');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Product</span>
                    </motion.button>
                  </div>
                </div>

                {/* Search Bar & Category Dropdown matching user request */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCodeEnterLookup(searchTerm, 'search');
                        }
                      }}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:bg-white font-medium transition-all shadow-2xs placeholder:text-slate-400"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-full cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Category Dropdown Filter for Product Catalog */}
                  <div className="relative min-w-[210px] sm:w-64 shrink-0">
                    <div className="relative flex items-center">
                      <FolderTree className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none" />
                      <select
                        value={selectedCategoryFilter}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedCategoryFilter(val);
                          if (val === 'weight') setCatalogFilter('weight');
                          else if (val === 'unit') setCatalogFilter('unit');
                          else setCatalogFilter('all');
                        }}
                        className="w-full pl-9 pr-9 py-2.5 bg-white hover:bg-slate-50/80 border border-slate-300 focus:border-blue-500 rounded-xl text-xs sm:text-sm font-extrabold text-slate-800 shadow-2xs cursor-pointer appearance-none transition-all"
                        title="Filter product catalog by category"
                      >
                        <option value="all">📁 All Categories ({products.length})</option>
                        <option value="weight">⚖️ By Weight ({products.filter(p => p.sellBy === 'weight' || p.unitType === 'kg' || p.pricePerKg).length})</option>
                        <option value="unit">📦 By Unit ({products.filter(p => p.sellBy !== 'weight' && p.unitType !== 'kg' && !p.pricePerKg).length})</option>
                        <optgroup label="Categories">
                          {availableCategories.map((cat) => {
                            const count = products.filter(p => (p.category || 'General').toLowerCase() === cat.toLowerCase()).length;
                            return (
                              <option key={cat} value={cat}>
                                {cat} ({count})
                              </option>
                            );
                          })}
                        </optgroup>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Button to open Manage Categories view */}
                  <button
                    type="button"
                    onClick={() => setIsManageCategoriesModalOpen(true)}
                    className="px-3.5 py-2.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
                    title="Manage Categories, Brands & Sizes"
                  >
                    <FolderTree className="w-4 h-4 text-orange-600" />
                    <span className="hidden md:inline">Manage Categories</span>
                  </button>
                </div>

                {/* Category Filter Horizontal Scroll Tabs (POS Counter Style) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 custom-scrollbar">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryFilter('all');
                      setCatalogFilter('all');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border ${
                      selectedCategoryFilter === 'all' && catalogFilter === 'all'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs font-black'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    All Items ({products.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryFilter('weight');
                      setCatalogFilter('weight');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 border ${
                      catalogFilter === 'weight'
                        ? 'bg-orange-600 text-white border-orange-600 shadow-xs font-black'
                        : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                    }`}
                  >
                    <Scale className="w-3 h-3" /> By Weight ({products.filter(p => p.sellBy === 'weight' || p.unitType === 'kg' || p.pricePerKg).length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryFilter('unit');
                      setCatalogFilter('unit');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1 border ${
                      catalogFilter === 'unit'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-black'
                        : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                    }`}
                  >
                    <Package className="w-3 h-3" /> By Unit ({products.filter(p => p.sellBy !== 'weight' && p.unitType !== 'kg' && !p.pricePerKg).length})
                  </button>

                  {availableCategories.map((cat) => {
                    const count = products.filter(p => (p.category || 'General').toLowerCase() === cat.toLowerCase()).length;
                    const isSelected = selectedCategoryFilter.toLowerCase() === cat.toLowerCase();
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedCategoryFilter(cat);
                          setCatalogFilter('all');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border flex items-center gap-1 ${
                          isSelected
                            ? 'bg-blue-700 text-white border-blue-700 shadow-xs font-black'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{cat}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                          isSelected ? 'bg-blue-900 text-blue-100' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Catalog Content: Grid View or Table View */}
                {filteredCatalog.length === 0 ? (
                  <div className="text-sm text-slate-500 p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 space-y-3">
                    <PackagePlus className="w-12 h-12 text-blue-500 mx-auto" />
                    <p className="font-bold text-slate-800 text-base">No products found in catalog</p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Search filter didn't match any items, or no products have been registered yet. Click below to register your product!
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        handleResetForm();
                        setActiveTab('form');
                      }}
                      className="mt-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs sm:text-sm inline-flex items-center gap-2 shadow-sm cursor-pointer transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Register New Product & Stock In</span>
                    </button>
                  </div>
                ) : viewMode === 'grid' ? (
                  /* POS Counter Card Grid */
                  <div className={`grid grid-cols-1 sm:grid-cols-2 ${activeTab === 'catalog' ? 'lg:grid-cols-3 xl:grid-cols-4' : 'xl:grid-cols-3'} gap-3.5 max-h-[750px] overflow-y-auto overscroll-contain custom-scrollbar p-1`}>
                    {filteredCatalog.map((p) => {
                      const isWeighted = p.sellBy === 'weight' || p.unitType === 'kg' || !!p.pricePerKg;
                      const isEditingThis = existingProduct?.id === p.id;
                      const discInfo = getProductDiscountInfo(p);
                      const isLowStock = (p.stockQuantity || 0) <= (store.lowStockAlertThreshold ?? 5);
                      const isOutOfStock = (p.stockQuantity || 0) <= 0;

                      return (
                        <motion.div
                          key={p.id}
                          whileHover={{ y: -3, scale: 1.01 }}
                          transition={{ duration: 0.18 }}
                          className={`relative bg-gradient-to-b from-white via-white to-slate-50/80 rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-xl ${
                            isEditingThis
                              ? 'border-amber-500 ring-2 ring-amber-400/50 bg-amber-50/30'
                              : isOutOfStock
                              ? 'border-red-300 hover:border-red-400'
                              : 'border-slate-200 hover:border-indigo-400'
                          }`}
                        >
                          {/* Top Header Strip: S/N Badge & Stock Status (Vibrant Gradient Theme) */}
                          <div className="p-3 pb-2 flex items-start justify-between gap-2 border-b border-indigo-100/70 bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 text-white">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-black text-xs bg-amber-400 text-slate-950 border border-amber-300 px-2 py-0.5 rounded-lg shadow-2xs">
                                #{p.serialNumber || p.shortcutCode || '1001'}
                              </span>
                              {isWeighted ? (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-orange-500 text-white border border-orange-400 flex items-center gap-0.5">
                                  <Scale className="w-2.5 h-2.5" /> Weight
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-blue-600 text-white border border-blue-500">
                                  Unit
                                </span>
                              )}
                            </div>

                            {/* Stock Status Badge */}
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-black border flex items-center gap-1 shadow-2xs ${
                              isOutOfStock
                                ? 'bg-red-500 text-white border-red-600'
                                : isLowStock
                                ? 'bg-amber-400 text-slate-950 border-amber-500'
                                : 'bg-emerald-500 text-white border-emerald-600'
                            }`}>
                              <Boxes className="w-3 h-3" />
                              <span>{(p.stockQuantity || 0) % 1 === 0 ? (p.stockQuantity || 0) : (p.stockQuantity || 0).toFixed(2)} {isWeighted ? 'kg' : 'pcs'}</span>
                            </span>
                          </div>

                          {/* Main Card Body */}
                          <div className="p-3.5 space-y-3 flex-1">
                            <div className="flex items-start gap-3">
                              {/* Product Image / Icon with Glowing Border */}
                              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 border-2 border-indigo-100 shrink-0 flex items-center justify-center relative shadow-xs">
                                {p.imageUrl ? (
                                  <img
                                    src={p.imageUrl}
                                    alt={p.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as any).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <ImageIcon className="w-6 h-6 text-indigo-400" />
                                )}
                                {p.category && (
                                  <div className="absolute bottom-0 inset-x-0 bg-indigo-950/85 backdrop-blur-2xs text-[9px] font-black text-amber-300 text-center py-0.5 truncate px-1">
                                    {p.category}
                                  </div>
                                )}
                              </div>

                              {/* Product Info */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-black text-slate-900 text-sm leading-snug truncate" title={p.name}>
                                  {p.name}
                                </h3>
                                <p className="text-[11px] font-mono text-slate-500 font-medium truncate mt-0.5">
                                  BC: <strong className="text-indigo-900 font-bold">{p.barcode || 'N/A'}</strong>
                                </p>
                                {p.weight && (
                                  <p className="text-[11px] text-slate-600 font-bold mt-0.5">
                                    Net: <span className="text-blue-700">{p.weight}</span> {p.weightPerUnit ? `(${p.weightPerUnit} kg/pack)` : ''}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Price & Discount Display (Attractive Financial Tag Style) */}
                            <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-blue-50/80 p-2.5 rounded-xl border border-emerald-200/90 flex items-center justify-between shadow-2xs">
                              <div>
                                <span className="text-[10px] font-black text-emerald-900 uppercase tracking-tight block">
                                  Selling Price
                                </span>
                                {discInfo.hasDiscount ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-black text-rose-600 text-sm sm:text-base font-mono">
                                      Rs. {discInfo.discountedPrice.toFixed(2)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 line-through font-mono">
                                      Rs. {(p.price ?? 0).toFixed(2)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-black text-emerald-950 text-sm sm:text-base font-mono">
                                    Rs. {(p.price ?? 0).toFixed(2)}
                                  </span>
                                )}
                              </div>

                              {discInfo.hasDiscount && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white uppercase shadow-xs">
                                  {discInfo.discountLabel}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Bottom Quick Actions Strip */}
                          <div className="p-2.5 pt-0 bg-white grid grid-cols-4 gap-1 border-t border-slate-100">
                            {/* Edit Action */}
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectProductToEdit(p);
                                if (activeTab === 'catalog') setActiveTab('form');
                              }}
                              className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                                isEditingThis
                                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                  : 'bg-orange-50 hover:bg-orange-600 text-orange-700 hover:text-white border-orange-200'
                              }`}
                              title="Load product to editor terminal"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>

                            {/* Quick Discount Action */}
                            <button
                              type="button"
                              onClick={() => setQuickDiscountProduct(p)}
                              className={`py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                                p.discountActive && (p.discountValue || 0) > 0
                                  ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-600 hover:text-white'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700'
                              }`}
                              title="Set Discount for this product"
                            >
                              <Percent className="w-3 h-3 text-rose-600" />
                              <span className="hidden sm:inline">Sale</span>
                            </button>

                            {/* Print Barcode Action */}
                            <button
                              type="button"
                              onClick={() => handleOpenGeneratorForProduct(p)}
                              className="py-1.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                              title="Print Barcode sticker"
                            >
                              <Printer className="w-3 h-3 text-amber-300" />
                              <span className="hidden sm:inline">Print</span>
                            </button>

                            {/* Direct PNG Download */}
                            <button
                              type="button"
                              onClick={() => handleDirectDownloadBarcode(p)}
                              className="py-1.5 px-2 rounded-xl bg-sky-50 hover:bg-sky-600 text-sky-700 hover:text-white border border-sky-200 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                              title="Download Barcode PNG"
                            >
                              <Download className="w-3 h-3" />
                              <span className="hidden sm:inline">PNG</span>
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  /* Clean Products Table View (Matches User Screenshot) */
                  <div className="overflow-x-auto overflow-y-auto max-h-[750px] custom-scrollbar border border-slate-200 rounded-2xl bg-white shadow-2xs">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-slate-50/90 text-xs text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200 sticky top-0 z-10 backdrop-blur-xs">
                        <tr>
                          <th className="py-3.5 px-4 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={selectedProductIds.length === filteredCatalog.length && filteredCatalog.length > 0}
                              onChange={handleToggleSelectAll}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                              title="Select / Deselect all"
                            />
                          </th>
                          <th className="py-3.5 px-4 w-20 text-center">Image</th>
                          <th className="py-3.5 px-4 min-w-[200px]">Name</th>
                          <th className="py-3.5 px-4 w-36">Category</th>
                          <th className="py-3.5 px-4 w-32">Price</th>
                          <th className="py-3.5 px-4 w-28 text-center">Stock</th>
                          <th className="py-3.5 px-4 w-32 text-center">Status</th>
                          <th className="py-3.5 px-4 w-36 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredCatalog.map((p) => {
                          const isSelected = selectedProductIds.includes(p.id);
                          const isWeighted = p.sellBy === 'weight' || p.unitType === 'kg' || !!p.pricePerKg;
                          const discInfo = getProductDiscountInfo(p);
                          const qty = p.stockQuantity || 0;
                          const minStock = p.minStockLevel ?? 5;
                          const isOutOfStock = qty <= 0;
                          const isLowStock = !isOutOfStock && qty <= minStock;

                          return (
                            <tr 
                              key={p.id} 
                              className={`transition-colors hover:bg-slate-50/80 ${isSelected ? 'bg-blue-50/40' : ''}`}
                            >
                              <td className="py-3 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectProduct(p.id)}
                                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                                />
                              </td>

                              {/* 1. Image */}
                              <td className="py-3 px-4 text-center">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 mx-auto flex items-center justify-center p-1 shadow-2xs">
                                  {p.imageUrl ? (
                                    <img
                                      src={p.imageUrl}
                                      alt={p.name}
                                      className="w-full h-full object-contain"
                                      onError={(e) => {
                                        (e.target as any).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <ImageIcon className="w-5 h-5 text-slate-300" />
                                  )}
                                </div>
                              </td>

                              {/* 2. Name */}
                              <td className="py-3 px-4">
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-900 text-sm leading-tight flex items-center gap-1.5">
                                    <span>{p.name}</span>
                                    {isWeighted && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-orange-100 text-orange-800">
                                        kg
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                                    {p.barcode && <span>BC: {p.barcode}</span>}
                                    {p.serialNumber && <span>• S/N: #{p.serialNumber}</span>}
                                    {p.weight && <span>• {p.weight}</span>}
                                  </div>
                                </div>
                              </td>

                              {/* 3. Category */}
                              <td className="py-3 px-4">
                                <span className="text-slate-600 font-medium text-sm">
                                  {p.category || 'General'}
                                </span>
                              </td>

                              {/* 4. Price */}
                              <td className="py-3 px-4 font-mono">
                                {discInfo.hasDiscount ? (
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-rose-600 text-sm">
                                      Rs. {discInfo.discountedPrice.toFixed(0)}
                                    </div>
                                    <div className="text-[11px] text-slate-400 line-through">
                                      Was Rs. {(p.price ?? 0).toFixed(0)}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="font-bold text-slate-900 text-sm">
                                    Rs. {(p.price ?? 0).toFixed(0)}
                                  </span>
                                )}
                              </td>

                              {/* 5. Stock */}
                              <td className="py-3 px-4 text-center font-mono">
                                <span className="font-bold text-slate-800 text-sm">
                                  {qty % 1 === 0 ? qty : qty.toFixed(2)}
                                  {isWeighted ? ' kg' : ''}
                                </span>
                              </td>

                              {/* 6. Status (Pill badges matching screenshot) */}
                              <td className="py-3 px-4 text-center">
                                {isOutOfStock ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                                    Out of Stock
                                  </span>
                                ) : isLowStock ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    Low Stock
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    In Stock
                                  </span>
                                )}
                              </td>

                              {/* 7. Actions (Edit & Delete matching screenshot) */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Edit (Blue icon button) */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleSelectProductToEdit(p);
                                      setActiveTab('form');
                                    }}
                                    className="p-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 transition-all cursor-pointer shadow-2xs"
                                    title="Edit product"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>

                                  {/* Delete (Red icon button) */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProduct(p)}
                                    className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 transition-all cursor-pointer shadow-2xs"
                                    title="Delete product"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>

                                  {/* Print Barcode Sticker */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenGeneratorForProduct(p)}
                                    className="p-2 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-900 hover:text-white border border-slate-200 transition-all cursor-pointer shadow-2xs"
                                    title="Print Barcode Label"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Product Registration Form (Simple, Clean, Fast) */}
            {activeTab === 'form' && (
              <div className="max-w-4xl mx-auto w-full bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-7 md:p-8 space-y-6">
                
                {/* Active Editing Notice */}
                {existingProduct && (
                  <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">Editing Product:</span>
                      <span className="font-semibold">{existingProduct.name}</span>
                      <span className="text-amber-700">· S/N #{previewNextSerialNumber}</span>
                      {existingProduct.barcode && (
                        <span className="text-amber-700">· Barcode: {existingProduct.barcode}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="text-xs font-bold text-amber-900 hover:text-amber-950 underline cursor-pointer shrink-0"
                    >
                      ✕ New Product
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmitProductStock} className="space-y-6">
                  {/* Field 1: Product Name & Media */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Product Name *
                      </label>
                      <div className="flex items-center gap-2 text-xs">
                        {name.trim().length >= 3 && !imageUrl && autoAiImageEnabled && (
                          <span className="text-[11px] text-sky-600 font-semibold flex items-center gap-1 animate-pulse">
                            <Search className="w-3 h-3 text-sky-500" /> Searching Google...
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSearchProductImageOnline(name, true)}
                          disabled={isGeneratingAiImage || !name.trim()}
                          className="text-[11px] bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold px-2.5 py-1 rounded-lg border border-sky-200 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                          title="Search Google for image, copy link and paste it"
                        >
                          <Sparkles className="w-3 h-3 text-sky-600" />
                          <span>{isGeneratingAiImage ? 'Searching...' : '✨ Auto-Find Image'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      {/* Image Thumbnail Box */}
                      <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-300 shrink-0 flex items-center justify-center overflow-hidden relative shadow-2xs group">
                        {isGeneratingAiImage ? (
                          <RefreshCw className="w-4 h-4 text-sky-600 animate-spin" />
                        ) : imageUrl ? (
                          <>
                            <img
                              src={imageUrl}
                              alt="Product"
                              className="w-full h-full object-contain p-0.5"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                if (fallbackThumbnailUrl && (e.target as any).src !== fallbackThumbnailUrl) {
                                  (e.target as any).src = fallbackThumbnailUrl;
                                } else {
                                  (e.target as any).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setImageUrl('');
                                setAiImageSource(null);
                                setImageSourceDomain(null);
                                setFallbackThumbnailUrl(null);
                                setSearchCandidates([]);
                              }}
                              className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                              title="Remove image"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </>
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                        )}
                      </div>

                      {/* Name input */}
                      <div className="flex-1 space-y-1">
                        <input
                          ref={nameInputRef}
                          type="text"
                          required
                          placeholder="e.g. Olpers Full Cream Milk 1L, Tapal Tea 450g..."
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onBlur={() => {
                            if (autoAiImageEnabled && !imageUrl && name.trim().length >= 3) {
                              handleAutoGenerateProductPicture(name.trim(), false);
                            }
                          }}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:bg-white font-bold transition-all shadow-2xs"
                        />
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>{imageSourceDomain ? `Image source: ${imageSourceDomain}` : 'Shows on POS and printed receipts'}</span>
                          <div className="flex items-center gap-2">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleImageFileUpload}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer underline"
                            >
                              Upload custom photo
                            </button>
                            <span>·</span>
                            <button
                              type="button"
                              onClick={async () => {
                                const manualUrl = prompt('Enter image URL:', imageUrl || '');
                                if (manualUrl && manualUrl.trim()) {
                                  setImageUrl(manualUrl.trim());
                                  setAiImageSource('manual');
                                }
                              }}
                              className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer underline"
                            >
                              Paste URL
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Search Candidates if available */}
                    {searchCandidates && searchCandidates.length > 1 && (
                      <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1">
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">Candidates:</span>
                        {searchCandidates.slice(0, 6).map((c, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setImageUrl(c.url);
                              setFallbackThumbnailUrl(c.thumbnail);
                              setImageSourceDomain(c.domain || null);
                              showNotification('success', `Selected image from ${c.domain || 'candidate'}`);
                            }}
                            className={`w-8 h-8 rounded border p-0.5 shrink-0 overflow-hidden cursor-pointer ${
                              imageUrl === c.url || imageUrl === c.thumbnail ? 'border-sky-500 ring-1 ring-sky-300' : 'border-slate-200'
                            }`}
                          >
                            <img src={c.thumbnail || c.url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Field 2: Barcode & Category */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Barcode */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                          <BarcodeIcon className="w-3.5 h-3.5 text-blue-600" />
                          <span>Barcode / Code</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleAutoGenerateBarcodeNumber}
                          className="text-[11px] text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          Auto-generate
                        </button>
                      </div>
                      <div className="relative flex gap-2">
                        <div className="relative flex-1">
                          <BarcodeIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            ref={barcodeInputRef}
                            type="text"
                            maxLength={50}
                            autoComplete="off"
                            placeholder="Scan barcode or enter code..."
                            value={barcode}
                            onChange={(e) => setBarcode(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCodeEnterLookup(barcode, 'barcode');
                              }
                            }}
                            className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:bg-white font-mono font-bold transition-all shadow-2xs"
                          />
                        </div>
                        {store.cameraScannerEnabled !== false && (
                          <button
                            type="button"
                            onClick={() => setIsScannerOpen(true)}
                            className="px-3 rounded-xl bg-slate-100 border border-slate-300 hover:border-blue-500 text-blue-600 transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                            title="Camera Scanner"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1 px-0.5 text-[11px] text-slate-500">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={noBarcode}
                            onChange={(e) => setNoBarcode(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300"
                          />
                          <span>Do not use barcode</span>
                        </label>
                        <span className="font-mono text-slate-400">S/N #{previewNextSerialNumber}</span>
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                          Category *
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsAddCategoryModalOpen(true)}
                          className="text-[11px] text-blue-600 font-bold hover:underline cursor-pointer"
                        >
                          + New Category
                        </button>
                      </div>
                      <select
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value);
                          setSelectedCompanyId(null);
                          setSelectedSize(null);
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-bold focus:outline-none focus:border-blue-500 focus:bg-white transition-all cursor-pointer shadow-2xs"
                      >
                        {availableCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center justify-between mt-1 px-0.5 text-[11px] text-slate-400">
                        <span>Select department category</span>
                        <button
                          type="button"
                          onClick={() => setIsManageCategoriesModalOpen(true)}
                          className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
                        >
                          Manage Categories
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Field 3: Pricing & Stock (Clean 3-col grid) */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Cost Price */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Cost Price (Rs.) *
                        </label>
                        <div className="relative">
                          <span className="text-xs font-bold text-slate-400 absolute left-3 top-1/2 -translate-y-1/2">
                            Rs.
                          </span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            required
                            placeholder="100.00"
                            value={costPrice}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                              setCostPrice(val);
                              if (typeof val === 'number' && val > 0 && typeof marginPercent === 'number') {
                                const calcSell = Math.round(val * (1 + marginPercent / 100) * 100) / 100;
                                setPrice(calcSell);
                              } else if (typeof val === 'number' && val > 0 && typeof price === 'number' && price > 0) {
                                setMarginPercent(Math.round(((price - val) / val) * 100 * 10) / 10);
                              }
                            }}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:bg-white font-mono font-bold transition-all shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Selling Price */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Selling Price (Rs.) *
                        </label>
                        <div className="relative">
                          <span className="text-xs font-bold text-emerald-600 absolute left-3 top-1/2 -translate-y-1/2">
                            Rs.
                          </span>
                          <input
                            ref={priceInputRef}
                            type="number"
                            step="any"
                            min="0"
                            required
                            placeholder="125.00"
                            value={price}
                            onChange={(e) => {
                              const pVal = e.target.value === '' ? '' : parseFloat(e.target.value);
                              setPrice(pVal);
                              if (typeof pVal === 'number' && pVal > 0 && typeof costPrice === 'number' && costPrice > 0) {
                                setMarginPercent(Math.round(((pVal - costPrice) / costPrice) * 100 * 10) / 10);
                              }
                            }}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-emerald-600 focus:bg-white font-mono font-extrabold text-emerald-700 transition-all shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Stock Quantity */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          {existingProduct 
                            ? `Stock (${existingProduct.stockQuantity} ${sellBy === 'weight' ? 'kg' : 'units'})`
                            : `Initial Stock (${sellBy === 'weight' ? 'kg' : 'units'})`}
                        </label>
                        {existingProduct ? (
                          <div className="space-y-1.5">
                            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                              <button
                                type="button"
                                onClick={() => { setStockAdjustmentMode('keep'); setStockQuantityToAdd(''); }}
                                className={`py-1 rounded text-center cursor-pointer ${stockAdjustmentMode === 'keep' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                              >
                                Keep
                              </button>
                              <button
                                type="button"
                                onClick={() => setStockAdjustmentMode('add')}
                                className={`py-1 rounded text-center cursor-pointer ${stockAdjustmentMode === 'add' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600'}`}
                              >
                                + Add
                              </button>
                              <button
                                type="button"
                                onClick={() => setStockAdjustmentMode('set')}
                                className={`py-1 rounded text-center cursor-pointer ${stockAdjustmentMode === 'set' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600'}`}
                              >
                                Set
                              </button>
                            </div>
                            {stockAdjustmentMode !== 'keep' && (
                              <input
                                ref={quantityInputRef}
                                type="number"
                                step="any"
                                min="0"
                                required
                                placeholder={stockAdjustmentMode === 'add' ? '+ Qty to add' : 'New total qty'}
                                value={stockQuantityToAdd}
                                onChange={(e) => setStockQuantityToAdd(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                              />
                            )}
                          </div>
                        ) : (
                          <input
                            ref={quantityInputRef}
                            type="number"
                            step="any"
                            min="0"
                            placeholder="e.g. 50 (default 0)"
                            value={stockQuantityToAdd}
                            onChange={(e) => setStockQuantityToAdd(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:bg-white font-mono font-bold transition-all shadow-2xs"
                          />
                        )}
                      </div>
                    </div>

                    {/* Quiet unboxed profit calculation metadata */}
                    {(() => {
                      const numSellingPrice = typeof price === 'number' ? price : (price !== '' ? parseFloat(price as any) : 0);
                      const numCostPrice = typeof costPrice === 'number' ? costPrice : (costPrice !== '' ? parseFloat(costPrice as any) : 0);
                      if (numSellingPrice <= 0 || numCostPrice <= 0) return null;
                      const unitProfit = numSellingPrice - numCostPrice;
                      const marginPct = (unitProfit / numSellingPrice) * 100;
                      const markupPct = (unitProfit / numCostPrice) * 100;
                      const isProfit = unitProfit >= 0;
                      return (
                        <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-600 pt-1">
                          <span className={isProfit ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>
                            {isProfit ? '✓ Profit:' : '⚠ Loss:'} Rs. {unitProfit.toFixed(2)}
                          </span>
                          <span>·</span>
                          <span>Margin: {marginPct.toFixed(1)}%</span>
                          <span>·</span>
                          <span>Markup: {markupPct.toFixed(1)}%</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Field 4: Selling Method */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">Selling Method:</span>
                      <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            setSellBy('unit');
                            if (unitType === 'kg' || unitType === 'g') setUnitType('piece');
                          }}
                          className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                            sellBy === 'unit' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                          }`}
                        >
                          Per Unit (Piece)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSellBy('weight');
                            setUnitType('kg');
                          }}
                          className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                            sellBy === 'weight' ? 'bg-white text-orange-700 font-bold shadow-2xs' : 'text-slate-600'
                          }`}
                        >
                          By Weight (kg)
                        </button>
                      </div>
                    </div>

                    {sellBy === 'weight' && (
                      <span className="text-[11px] text-orange-700 font-medium">
                        Sold in kilograms or fractions at checkout
                      </span>
                    )}
                  </div>

                  {/* Field 5: Collapsible Accordion "More Options" */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowMoreOptions(prev => !prev)}
                      className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/70 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                        <span>Additional Options (Brand, Packaging Size, Discount, Stock Alert)</span>
                        {(selectedCompanyId || selectedSize || discountActive || (minStockLevel && minStockLevel !== 5)) && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-md">
                            Configured
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showMoreOptions ? 'rotate-180' : ''}`} />
                    </button>

                    {showMoreOptions && (
                      <div className="p-4 bg-white border-t border-slate-200 space-y-4 text-xs">
                        {/* Brand & Size */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="font-bold text-slate-700">Company / Brand</label>
                              <button
                                type="button"
                                onClick={() => setIsAddingCustomCompany(!isAddingCustomCompany)}
                                className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer"
                              >
                                {isAddingCustomCompany ? 'Cancel' : '+ Add Brand'}
                              </button>
                            </div>
                            {isAddingCustomCompany && (
                              <div className="flex items-center gap-1 mb-1.5">
                                <input
                                  type="text"
                                  placeholder="Brand name..."
                                  value={customCompanyName}
                                  onChange={(e) => setCustomCompanyName(e.target.value)}
                                  className="flex-1 px-2.5 py-1 text-xs border rounded-lg focus:outline-none focus:border-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddCustomCompanySubmit}
                                  className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[11px] font-bold"
                                >
                                  Save
                                </button>
                              </div>
                            )}
                            <select
                              value={selectedCompanyId || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__add__') setIsAddingCustomCompany(true);
                                else if (!val) handleSelectCompany(null);
                                else {
                                  const found = activeCategoryCompanies.find(c => c.id === val);
                                  if (found) handleSelectCompany(found);
                                }
                              }}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:border-blue-500"
                            >
                              <option value="">-- Choose Brand (Optional) --</option>
                              {activeCategoryCompanies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                              <option value="__add__">+ Add Brand...</option>
                            </select>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="font-bold text-slate-700">Packaging Size / Unit</label>
                              <button
                                type="button"
                                onClick={() => setIsAddingCustomSize(!isAddingCustomSize)}
                                className="text-[11px] text-blue-600 font-semibold hover:underline cursor-pointer"
                              >
                                {isAddingCustomSize ? 'Cancel' : '+ Custom Size'}
                              </button>
                            </div>
                            {isAddingCustomSize && (
                              <div className="flex items-center gap-1 mb-1.5">
                                <input
                                  type="text"
                                  placeholder="e.g. 500ml, 1kg..."
                                  value={customSizeName}
                                  onChange={(e) => setCustomSizeName(e.target.value)}
                                  className="flex-1 px-2.5 py-1 text-xs border rounded-lg focus:outline-none focus:border-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddCustomSizeSubmit}
                                  className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[11px] font-bold"
                                >
                                  Apply
                                </button>
                              </div>
                            )}
                            <select
                              value={selectedSize || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__add__') setIsAddingCustomSize(true);
                                else if (!val) handleSelectSize(null);
                                else handleSelectSize(val);
                              }}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs font-semibold focus:outline-none focus:border-blue-500"
                            >
                              <option value="">-- Choose Size (Optional) --</option>
                              {activeAvailableSizes.map(sz => (
                                <option key={sz} value={sz}>{sz}</option>
                              ))}
                              <option value="__add__">+ Custom Size...</option>
                            </select>
                          </div>
                        </div>

                        {/* Weight details if sellBy === 'weight' */}
                        {sellBy === 'weight' && (
                          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                Weight Description (Optional)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. 1 kg pack, 500g, or Loose in basket"
                                value={weight}
                                onChange={(e) => setWeight(e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-50 border rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                Pre-packed Weight per Bag (kg)
                              </label>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                placeholder="e.g. 0.5 for half kg pack"
                                value={weightPerUnit}
                                onChange={(e) => setWeightPerUnit(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                className="w-full px-3 py-1.5 bg-slate-50 border rounded-lg text-xs font-mono"
                              />
                            </div>
                          </div>
                        )}

                        {/* Promotional Discount */}
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={discountActive}
                              onChange={(e) => setDiscountActive(e.target.checked)}
                              className="w-4 h-4 text-rose-600 rounded border-slate-300"
                            />
                            <Tag className="w-3.5 h-3.5 text-rose-600" />
                            <span>Enable Promotional Discount</span>
                          </label>

                          {discountActive && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-6">
                              <div>
                                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Discount Type</label>
                                <select
                                  value={discountType}
                                  onChange={(e) => setDiscountType(e.target.value as any)}
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg text-xs font-semibold"
                                >
                                  <option value="percentage">Percentage (%)</option>
                                  <option value="fixed">Fixed Rupees (Rs.)</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">
                                  {discountType === 'percentage' ? 'Percentage Off (%)' : 'Amount Off (Rs.)'}
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  max={discountType === 'percentage' ? 100 : undefined}
                                  placeholder={discountType === 'percentage' ? '10' : '50'}
                                  value={discountValue}
                                  onChange={(e) => setDiscountValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg text-xs font-mono font-bold"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-slate-500 mb-0.5">Valid Until (Optional)</label>
                                <input
                                  type="date"
                                  value={discountEndDate}
                                  onChange={(e) => {
                                    setDiscountEndDate(e.target.value);
                                    setHasDateLimit(Boolean(e.target.value));
                                  }}
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg text-xs font-semibold"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Low Stock Alert Threshold */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-700 block">Low Stock Alert Threshold</span>
                            <span className="text-[11px] text-slate-400">Alerts when inventory reaches or falls below this count</span>
                          </div>
                          <div className="w-24">
                            <input
                              type="number"
                              min="0"
                              value={minStockLevel}
                              onChange={(e) => setMinStockLevel(parseInt(e.target.value || '5', 10))}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-center text-xs font-mono font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Form Actions Footer */}
                  <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleResetForm}
                        className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                      {existingProduct && (
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(existingProduct)}
                          disabled={loading}
                          className="px-3.5 py-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => handleOpenGeneratorForProduct()}
                        className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" />
                        <span>Barcode Label</span>
                      </button>

                      <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>{loading ? 'Saving...' : existingProduct ? 'Update Product' : 'Save Product'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

      </motion.div>
    </AnimatePresence>

        {/* Dedicated Barcode Generator & Print Station Modal */}
        <BarcodeGeneratorModal
          isOpen={isGeneratorOpen}
          onClose={() => setIsGeneratorOpen(false)}
          store={store}
          initialProduct={productForGenerator}
          onSaveToInventory={handleSaveFromGenerator}
        />

        {/* Camera Scanner Modal */}
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScanSuccess={(scannedCode) => {
            const matched = findRegisteredProduct(scannedCode);
            if (matched) {
              handleSelectProductToEdit(matched);
              showNotification('success', `✓ Found "${matched.name}" - Opened for editing!`);
            } else {
              setBarcode(scannedCode);
              showNotification('success', `Scanned Barcode: ${scannedCode}`);
              if (barcodeInputRef.current) {
                barcodeInputRef.current.focus();
              }
            }
          }}
          title="Product Barcode Scanner"
          subtitle="Scan product barcode number to fill barcode field"
        />

        {/* Single Product Delete Confirmation Modal */}
        {productToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-red-100 text-red-600 rounded-2xl shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Delete Product from Inventory?</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Are you sure you want to permanently delete <span className="font-bold text-slate-900">"{productToDelete.name}"</span>?
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-mono space-y-1 text-slate-700">
                <div><span className="font-bold">Barcode:</span> {productToDelete.barcode || 'N/A'}</div>
                {productToDelete.serialNumber && <div><span className="font-bold">S/N:</span> {productToDelete.serialNumber}</div>}
                {productToDelete.weight && <div><span className="font-bold">Weight:</span> {productToDelete.weight}</div>}
                <div><span className="font-bold">Price:</span> Rs. {(productToDelete.price ?? 0).toFixed(2)}</div>
                <div><span className="font-bold">Current Stock:</span> {productToDelete.stockQuantity} units</div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmSingleDelete}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer transition-all shadow-md flex items-center gap-1.5"
                >
                  {loading ? 'Deleting...' : 'Yes, Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {isBulkDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-red-100 text-red-600 rounded-2xl shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Delete {selectedProductIds.length} Selected Products?</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Are you sure you want to permanently delete all <span className="font-bold text-slate-900">{selectedProductIds.length} selected items</span> from your stock database? This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(false)}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmBulkDelete}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer transition-all shadow-md flex items-center gap-1.5"
                >
                  {loading ? 'Deleting All...' : `Delete ${selectedProductIds.length} Items`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EXCEL MANAGER MODAL (TWO OPTIONS: UPLOAD FROM DEVICE OR CREATE NOW) */}
        <ExcelManagerModal
          isOpen={isExcelModalOpen}
          onClose={() => setIsExcelModalOpen(false)}
          store={store}
          existingProducts={products}
          onSendToAi={(parsedRows) => {
            setSpreadsheetProductsForAi(parsedRows);
            setIsExcelModalOpen(false);
            setIsAiAssistantOpen(true);
          }}
          onProductsSaved={(count) => {
            showNotification('success', `Successfully saved ${count} products to store catalog!`);
          }}
          onOpenBatchModal={() => {
            setIsExcelModalOpen(false);
            setIsBatchModalOpen(true);
          }}
        />

        {/* MULTI-PRODUCT BATCH REGISTER & EXCEL MODAL */}
        <MultiProductBatchModal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          store={store}
          onSuccess={(count) => {
            showNotification('success', `Successfully registered ${count} products into catalog!`);
          }}
        />

        {/* SOFTWARE AI ASSISTANT MODAL */}
        <StoreAiAssistantModal
          isOpen={isAiAssistantOpen}
          onClose={() => {
            setIsAiAssistantOpen(false);
            setAiEditTargetProduct(null);
            setSpreadsheetProductsForAi(null);
          }}
          store={store}
          products={products}
          currentUser={currentUser}
          initialProductToEdit={aiEditTargetProduct}
          initialSpreadsheetProducts={spreadsheetProductsForAi}
          onProductUpdated={(updated) => {
            showNotification('success', `AI successfully updated "${updated.name}"!`);
          }}
          onOpenBatchRegister={() => {
            setIsAiAssistantOpen(false);
            setIsBatchModalOpen(true);
          }}
        />

        {/* DISCOUNT MANAGER MODAL */}
        <DiscountManagerModal
          isOpen={isDiscountModalOpen}
          onClose={() => setIsDiscountModalOpen(false)}
          products={products}
          store={store}
          onRefresh={() => {
            showNotification('success', 'Product discounts successfully updated!');
          }}
        />

        {/* SINGLE ITEM QUICK DISCOUNT MODAL */}
        <ItemDiscountModal
          isOpen={Boolean(quickDiscountProduct)}
          onClose={() => setQuickDiscountProduct(null)}
          product={quickDiscountProduct}
          store={store}
          onSuccess={(updated) => {
            showNotification('success', `Updated discount on "${updated.name}"!`);
          }}
        />

        {/* 4-DIGIT PRODUCT SHORT CODES DIRECTORY MODAL */}
        <ProductShortcutsModal
          isOpen={isShortcutsModalOpen}
          onClose={() => setIsShortcutsModalOpen(false)}
          products={products}
          store={store}
        />

        {/* MANAGE CATEGORIES, BRANDS & SIZES MODAL */}
        {isManageCategoriesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
            <div className="bg-slate-100 rounded-3xl max-w-6xl w-full p-4 sm:p-6 shadow-2xl border border-slate-700 max-h-[92vh] overflow-y-auto custom-scrollbar relative">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4 sticky top-0 bg-slate-100/95 backdrop-blur-xs z-20">
                <div className="flex items-center gap-2 text-slate-900 font-black text-base sm:text-lg">
                  <FolderTree className="w-5 h-5 text-orange-600" />
                  <span>Category, Company & Size Hierarchy Manager</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManageCategoriesModalOpen(false)}
                  className="p-2 rounded-xl bg-white hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-300 shadow-2xs"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ManageCategoriesView
                store={store}
                onNavigateToRegister={() => setIsManageCategoriesModalOpen(false)}
              />
            </div>
          </div>
        )}

        {/* ADD NEW CATEGORY MODAL */}
        {isAddCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-orange-600 font-black text-base">
                  <Tag className="w-5 h-5" />
                  <span>Add New Category</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Category Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewCategory();
                    }
                  }}
                  placeholder="e.g. Grain, Biscuit, Oil, Ghee, Toys..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:border-orange-500 focus:bg-white font-medium transition-all"
                />
                <p className="text-[11px] text-slate-500">
                  This category will be permanently saved for store "{store.name}" and available in all product forms & AI queries.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddNewCategory}
                  disabled={isSavingCategory || !newCategoryName.trim()}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingCategory ? 'Saving...' : 'Save & Select'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
