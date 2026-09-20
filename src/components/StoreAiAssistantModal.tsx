import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  Bot, 
  User, 
  FileSpreadsheet, 
  Upload, 
  TrendingUp, 
  Package, 
  ShoppingBag, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle, 
  Scale, 
  Download, 
  RefreshCw,
  Coins,
  DollarSign,
  Edit3,
  Search,
  Tag,
  Boxes,
  ArrowRight
} from 'lucide-react';
import { Product, Sale, ProductReturn, Store, UserAccount } from '../types';
import { BatchProductRow, parseExcelProductFile } from '../lib/excelParser';
import { db, doc, setDoc } from '../lib/firebase';
import { AiProductEditorCard, ProductEditDraft } from './AiProductEditorCard';
import { processStoreAiQuery } from '../lib/storeAiEngine';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  parsedProducts?: BatchProductRow[];
  productEditDraft?: ProductEditDraft;
  productCandidates?: Product[];
  actionTaken?: boolean;
}

interface StoreAiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store;
  products?: Product[];
  sales?: Sale[];
  returns?: ProductReturn[];
  currentUser?: UserAccount;
  onOpenBatchRegister?: () => void;
  initialProductToEdit?: Product | null;
  onProductUpdated?: (updated: Product) => void;
  initialSpreadsheetProducts?: BatchProductRow[] | null;
}

export const StoreAiAssistantModal: React.FC<StoreAiAssistantModalProps> = ({
  isOpen,
  onClose,
  store,
  products = [],
  sales = [],
  returns = [],
  currentUser,
  onOpenBatchRegister,
  initialProductToEdit,
  onProductUpdated,
  initialSpreadsheetProducts
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello! I am your Mart Pro AI Assistant. I have full knowledge of your supermarket management system and real-time inventory for "${store.name}".\n\n✨ **AI Product Editing & Control:**\n• "Change price of Milk to 250"\n• "Update stock of Coca Cola to 50"\n• "Add 20 stock to Rice"\n• "Set cost price of Cooking Oil to 450"\n• "Rename Bread to Whole Wheat Bread"\n• Or click "✏️ Edit a Product" to choose any item!\n\n📊 **Store Analytics:**\n• "Which is the cheapest item in store?"\n• "What is the most selling item?"\n• "Show low stock or out of stock items"`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-activate Edit Mode when opened with initialProductToEdit
  useEffect(() => {
    if (isOpen && initialProductToEdit) {
      const editMsgId = `edit-init-${initialProductToEdit.id}-${Date.now()}`;
      setMessages(prev => {
        // Prevent duplicate draft for the exact same product if already present
        if (prev.some(m => m.productEditDraft?.id === initialProductToEdit.id && !m.productEditDraft?.saved)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: editMsgId,
            sender: 'ai',
            text: `✏️ **Edit Product Mode: "${initialProductToEdit.name}"**\n\nI loaded this item from your catalog (Barcode: \`${initialProductToEdit.barcode || 'N/A'}\`). You can adjust its selling price, wholesale cost, stock, or details below, or type your instructions (e.g. *"Set price to 250"* or *"Add 20 to stock"*):`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            productEditDraft: {
              id: initialProductToEdit.id,
              name: initialProductToEdit.name,
              price: initialProductToEdit.price,
              costPrice: initialProductToEdit.costPrice ?? 0,
              stockQuantity: initialProductToEdit.stockQuantity,
              minStockLevel: initialProductToEdit.minStockLevel || 5,
              category: initialProductToEdit.category || 'General',
              barcode: initialProductToEdit.barcode || '',
              serialNumber: initialProductToEdit.serialNumber || '',
              sellBy: initialProductToEdit.sellBy || (initialProductToEdit.unitType === 'kg' ? 'weight' : 'unit'),
              unitType: initialProductToEdit.unitType || (initialProductToEdit.sellBy === 'weight' ? 'kg' : 'piece'),
              weight: initialProductToEdit.weight || '',
              originalProduct: initialProductToEdit
            }
          }
        ];
      });
    }
  }, [isOpen, initialProductToEdit]);

  // Handle in-app spreadsheet products sent to AI
  useEffect(() => {
    if (isOpen && initialSpreadsheetProducts && initialSpreadsheetProducts.length > 0) {
      const sheetMsgId = `sheet-import-${Date.now()}`;
      setMessages(prev => {
        if (prev.some(m => m.id === sheetMsgId)) return prev;
        return [
          ...prev,
          {
            id: sheetMsgId,
            sender: 'ai',
            text: `📋 **In-App Spreadsheet Received (${initialSpreadsheetProducts.length} Products):**\n\nI have parsed all your products with prices, categories, and barcodes. You can save them directly into "${store.name}" inventory by clicking the button below:`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            parsedProducts: initialSpreadsheetProducts
          }
        ];
      });
    }
  }, [isOpen, initialSpreadsheetProducts, store.name]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [isOpen, messages]);

  // Compute live analytics
  const storeAnalytics = useMemo(() => {
    const safeProducts = products || [];
    const safeSales = sales || [];

    // 1. Cheapest item
    const validProducts = safeProducts.filter(p => (p.price || 0) > 0);
    let cheapest = validProducts[0];
    let mostExpensive = validProducts[0];

    validProducts.forEach(p => {
      if ((p.price || 0) < (cheapest?.price || Infinity)) cheapest = p;
      if ((p.price || 0) > (mostExpensive?.price || 0)) mostExpensive = p;
    });

    // 2. Sales volume per product (Most and Least Selling)
    const productSalesMap = new Map<string, { name: string; barcode: string; unitsSold: number; totalRevenue: number }>();
    
    // Initialize map with all products (so we catch 0-sale items)
    safeProducts.forEach(p => {
      productSalesMap.set(p.name.toLowerCase().trim(), {
        name: p.name,
        barcode: p.barcode,
        unitsSold: 0,
        totalRevenue: 0
      });
    });

    safeSales.forEach(s => {
      (s.items || []).forEach(item => {
        const key = item.name.toLowerCase().trim();
        const existing = productSalesMap.get(key) || {
          name: item.name,
          barcode: item.barcode || '',
          unitsSold: 0,
          totalRevenue: 0
        };
        existing.unitsSold += (item.quantity || 0);
        existing.totalRevenue += ((item.price || 0) * (item.quantity || 0));
        productSalesMap.set(key, existing);
      });
    });

    const salesList = Array.from(productSalesMap.values());
    salesList.sort((a, b) => b.unitsSold - a.unitsSold);

    const mostSelling = salesList[0] || null;
    const leastSelling = [...salesList].reverse().filter(p => p.unitsSold === 0 || p.unitsSold <= 2).slice(0, 5);

    // 3. Low stock and out of stock
    const outOfStock = safeProducts.filter(p => (p.stockQuantity ?? 0) <= 0);
    const lowStock = safeProducts.filter(p => (p.stockQuantity ?? 0) > 0 && (p.stockQuantity ?? 0) <= (p.minStockLevel || 5));

    // 4. Today's sales
    const todayStr = new Date().toISOString().slice(0, 10);
    const todaySales = safeSales.filter(s => s.timestamp && s.timestamp.startsWith(todayStr));
    const todayTotal = todaySales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    const todayUnits = todaySales.reduce((acc, s) => acc + (s.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0), 0);

    return {
      cheapest,
      mostExpensive,
      mostSelling,
      leastSelling,
      outOfStock,
      lowStock,
      todayTotal,
      todayUnits,
      todayReceipts: todaySales.length,
      totalProducts: safeProducts.length
    };
  }, [products, sales]);

  // Click handler when user selects a candidate product pill in chat
  const handleSelectCandidateToEdit = (product: Product) => {
    const editMsgId = `edit-cand-${product.id}-${Date.now()}`;
    const editMsg: Message = {
      id: editMsgId,
      sender: 'ai',
      text: `✏️ **Selected: "${product.name}"** (Barcode: \`${product.barcode || 'N/A'}\`)\n\nYou can tweak its selling price, wholesale cost, stock, or details in the interactive card below:`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      productEditDraft: {
        id: product.id,
        name: product.name,
        price: product.price,
        costPrice: product.costPrice ?? 0,
        stockQuantity: product.stockQuantity,
        minStockLevel: product.minStockLevel || 5,
        category: product.category || 'General',
        barcode: product.barcode || '',
        serialNumber: product.serialNumber || '',
        sellBy: product.sellBy || (product.unitType === 'kg' ? 'weight' : 'unit'),
        unitType: product.unitType || (product.sellBy === 'weight' ? 'kg' : 'piece'),
        weight: product.weight || '',
        originalProduct: product
      }
    };
    setMessages(prev => [...prev, editMsg]);
  };

  // Helper function to parse natural language product editing instructions
  const parseProductEditInstruction = (queryText: string, allProducts: Product[]) => {
    const q = queryText.trim();
    const lower = q.toLowerCase();

    // Check if query is just a generic edit command without target
    if (/^(edit\s+product|edit\s+products|edit\s+item|edit\s+items|how\s+to\s+edit|update\s+product|change\s+price|adjust\s+stock)$/i.test(lower)) {
      return {
        isEditIntent: true,
        candidates: allProducts.slice(0, 10),
        explanation: `I can edit any product in your inventory! Select one of the items below, or tell me which product and what to change (e.g. **"Change price of Milk to 250"** or **"Add 20 stock to Rice"**):`
      };
    }

    const hasEditVerb = /\b(edit|update|change|modify|set|adjust|make|rename|add|increase|reduce|decrease|cut)\b/i.test(lower);
    const hasPriceNoun = /\b(price|rate|cost|margin|selling price|cost price)\b/i.test(lower);
    const hasStockNoun = /\b(stock|quantity|qty|units?|inventory)\b/i.test(lower);

    if (!hasEditVerb && !hasPriceNoun && !hasStockNoun) {
      return { isEditIntent: false, candidates: [] };
    }

    // Extraction variables
    let extractedTarget = '';
    let newPrice: number | undefined;
    let priceDelta: number | undefined;
    let newCost: number | undefined;
    let newStock: number | undefined;
    let stockDelta: number | undefined;
    let newName: string | undefined;
    let newCategory: string | undefined;

    // Pattern 1: Rename "rename [product] to [newName]"
    const renameMatch = lower.match(/\brename\s+(?:the\s+)?(?:product\s+)?(.+?)\s+to\s+["']?([^"']+)["']?/i);
    if (renameMatch) {
      extractedTarget = renameMatch[1];
      newName = renameMatch[2].trim();
    }

    // Pattern 2: Category "change category of [product] to [category]"
    const catMatch = lower.match(/\b(?:change|update|set)\s+(?:the\s+)?category\s+(?:of\s+)?(.+?)\s+to\s+["']?([^"']+)["']?/i);
    if (catMatch && !extractedTarget) {
      extractedTarget = catMatch[1];
      newCategory = catMatch[2].trim();
    }

    // Pattern 3: Price "change price of [product] to [price]"
    const priceMatch1 = lower.match(/\b(?:change|update|set|make)\s+(?:the\s+)?(?:price|rate)\s+(?:of\s+)?(.+?)\s+(?:to|=|is|:)\s*(?:rs\.?|pkr)?\s*([0-9.]+)/i);
    if (priceMatch1 && !extractedTarget) {
      extractedTarget = priceMatch1[1];
      newPrice = parseFloat(priceMatch1[2]);
    }

    // Pattern 4: Price "change [product] price to [price]"
    const priceMatch2 = lower.match(/\b(?:change|update|set|make)\s+(.+?)\s+(?:price|rate)\s+(?:to|=|is|:)\s*(?:rs\.?|pkr)?\s*([0-9.]+)/i);
    if (priceMatch2 && !extractedTarget) {
      extractedTarget = priceMatch2[1];
      newPrice = parseFloat(priceMatch2[2]);
    }

    // Pattern 5: Price Delta "increase/decrease price of [product] by [delta]"
    const priceDeltaMatch = lower.match(/\b(increase|raise|decrease|reduce|cut)\s+(?:the\s+)?(?:price|rate)\s+(?:of\s+)?(.+?)\s+by\s*(?:rs\.?|pkr)?\s*([0-9.]+)/i);
    if (priceDeltaMatch && !extractedTarget) {
      const isIncrease = priceDeltaMatch[1] === 'increase' || priceDeltaMatch[1] === 'raise';
      extractedTarget = priceDeltaMatch[2];
      priceDelta = (isIncrease ? 1 : -1) * parseFloat(priceDeltaMatch[3]);
    }

    // Pattern 6: Cost Price "cost of [product] to [cost]"
    const costMatch = lower.match(/\b(?:change|update|set|make)\s+(?:the\s+)?(?:cost|cost\s*price|buying\s*price|purchase\s*price)\s+(?:of\s+)?(.+?)\s+(?:to|=|is|:)\s*(?:rs\.?|pkr)?\s*([0-9.]+)/i);
    if (costMatch && !extractedTarget) {
      extractedTarget = costMatch[1];
      newCost = parseFloat(costMatch[2]);
    }

    // Pattern 7: Stock "change stock of [product] to [stock]"
    const stockMatch1 = lower.match(/\b(?:change|update|set|make)\s+(?:the\s+)?(?:stock|quantity|qty)\s+(?:of\s+)?(.+?)\s+(?:to|=|is|:)\s*([0-9.]+)/i);
    if (stockMatch1 && !extractedTarget) {
      extractedTarget = stockMatch1[1];
      newStock = parseFloat(stockMatch1[2]);
    }

    // Pattern 8: Stock Delta "add [N] stock to [product]"
    const addStockMatch = lower.match(/\b(add|increase)\s+([0-9.]+)\s*(?:units?|items?|stock|qty|kg|liters?)?\s*(?:to|for|in)\s*(?:stock of\s*)?(.+)/i);
    if (addStockMatch && !extractedTarget) {
      stockDelta = parseFloat(addStockMatch[2]);
      extractedTarget = addStockMatch[3];
    }

    // Pattern 9: General "edit product [product]" or "edit [product]"
    const generalEditMatch = lower.match(/\b(?:edit|update|modify)\s+(?:product\s+|item\s+)?(.+)/i);
    if (generalEditMatch && !extractedTarget) {
      extractedTarget = generalEditMatch[1];
    }

    // Pattern 10: Loose "[product] price [number]"
    if (!extractedTarget) {
      const looseMatch = lower.match(/(.+?)\s+(?:price|rate)\s+(?:to|=|is|:)?\s*(?:rs\.?|pkr)?\s*([0-9.]+)/i);
      if (looseMatch) {
        extractedTarget = looseMatch[1];
        newPrice = parseFloat(looseMatch[2]);
      }
    }

    // Secondary clauses: "and stock to [N]"
    const secondaryStock = lower.match(/(?:and|\&)\s+(?:stock|qty)\s+(?:to|=|is|:)\s*([0-9.]+)/i);
    if (secondaryStock && newStock === undefined) {
      newStock = parseFloat(secondaryStock[1]);
    }

    // Secondary clauses: "and price to [N]"
    const secondaryPrice = lower.match(/(?:and|\&)\s+(?:price|rate)\s+(?:to|=|is|:)\s*(?:rs\.?|pkr)?\s*([0-9.]+)/i);
    if (secondaryPrice && newPrice === undefined) {
      newPrice = parseFloat(secondaryPrice[1]);
    }

    // If still no target, test if any product in catalog is mentioned directly in the sentence
    if (!extractedTarget) {
      for (const p of allProducts) {
        if (lower.includes(p.name.toLowerCase())) {
          extractedTarget = p.name;
          break;
        }
      }
    }

    if (!extractedTarget) {
      return { isEditIntent: false, candidates: [] };
    }

    // Clean target search term
    const cleanTerm = extractedTarget.trim().toLowerCase()
      .replace(/^(the|a|an|product|item)\s+/i, '')
      .replace(/\s+(price|stock|qty|cost|rate)$/i, '')
      .trim();

    if (!cleanTerm) {
      return { isEditIntent: false, candidates: [] };
    }

    // Search catalog
    let matched: Product | undefined = undefined;
    let candidateList: Product[] = [];

    // 1. Barcode match
    matched = allProducts.find(p => p.barcode && p.barcode.toLowerCase() === cleanTerm);

    // 2. S/N match
    if (!matched) {
      matched = allProducts.find(p => p.serialNumber && p.serialNumber.toLowerCase() === cleanTerm);
    }

    // 3. Exact name match
    if (!matched) {
      matched = allProducts.find(p => p.name.toLowerCase() === cleanTerm);
    }

    // 4. Substring matches
    if (!matched) {
      const subMatches = allProducts.filter(p => 
        p.name.toLowerCase().includes(cleanTerm) || cleanTerm.includes(p.name.toLowerCase())
      );
      if (subMatches.length === 1) {
        matched = subMatches[0];
      } else if (subMatches.length > 1) {
        candidateList = subMatches;
      }
    }

    // 5. Token matches
    if (!matched && candidateList.length === 0) {
      const tokens = cleanTerm.split(/\s+/).filter(t => t.length > 2);
      if (tokens.length > 0) {
        const tokenMatches = allProducts.filter(p => {
          const pLower = p.name.toLowerCase();
          return tokens.some(tok => pLower.includes(tok));
        });
        if (tokenMatches.length === 1) {
          matched = tokenMatches[0];
        } else if (tokenMatches.length > 1) {
          candidateList = tokenMatches;
        }
      }
    }

    if (matched) {
      const p = matched;
      const changesSummary: { field: string; label: string; from: string | number; to: string | number }[] = [];
      const draft: Partial<Product> = { ...p };

      if (newPrice !== undefined && !isNaN(newPrice)) {
        changesSummary.push({
          field: 'price',
          label: 'Selling Price',
          from: `Rs. ${p.price}`,
          to: `Rs. ${newPrice}`
        });
        draft.price = newPrice;
      } else if (priceDelta !== undefined && !isNaN(priceDelta)) {
        const calcPrice = Math.max(0, p.price + priceDelta);
        changesSummary.push({
          field: 'price',
          label: 'Selling Price',
          from: `Rs. ${p.price}`,
          to: `Rs. ${calcPrice}`
        });
        draft.price = calcPrice;
      }

      if (newCost !== undefined && !isNaN(newCost)) {
        changesSummary.push({
          field: 'costPrice',
          label: 'Wholesale Cost',
          from: `Rs. ${p.costPrice || 0}`,
          to: `Rs. ${newCost}`
        });
        draft.costPrice = newCost;
      }

      if (newStock !== undefined && !isNaN(newStock)) {
        changesSummary.push({
          field: 'stockQuantity',
          label: 'Stock Quantity',
          from: `${p.stockQuantity}`,
          to: `${newStock}`
        });
        draft.stockQuantity = newStock;
      } else if (stockDelta !== undefined && !isNaN(stockDelta)) {
        const calcStock = Math.max(0, p.stockQuantity + stockDelta);
        changesSummary.push({
          field: 'stockQuantity',
          label: 'Stock Quantity',
          from: `${p.stockQuantity}`,
          to: `${calcStock} (${stockDelta >= 0 ? `+${stockDelta}` : stockDelta})`
        });
        draft.stockQuantity = calcStock;
      }

      if (newName) {
        changesSummary.push({
          field: 'name',
          label: 'Product Name',
          from: p.name,
          to: newName
        });
        draft.name = newName;
      }

      if (newCategory) {
        changesSummary.push({
          field: 'category',
          label: 'Category',
          from: p.category || 'General',
          to: newCategory
        });
        draft.category = newCategory;
      }

      let explanation = '';
      if (changesSummary.length > 0) {
        explanation = `⚡ **AI Updates Prepared for "${p.name}"**\n\nI parsed your request and applied the updates to the draft card below. Review the changes and click **"Apply & Save Changes to Store"** to update your live inventory:`;
      } else {
        explanation = `✏️ **Found Product: "${p.name}"** (Barcode: \`${p.barcode || 'N/A'}\`)\n\nCurrent Price: **Rs. ${p.price.toFixed(2)}** • Stock: **${p.stockQuantity} ${p.sellBy === 'weight' ? 'kg' : 'units'}** • Cost: **Rs. ${(p.costPrice || 0).toFixed(2)}**.\n\nYou can adjust any values in the editor card below and click Save:`;
      }

      return {
        isEditIntent: true,
        matchedProduct: p,
        candidates: [p],
        changesSummary,
        draft,
        explanation
      };
    }

    if (candidateList.length > 0) {
      return {
        isEditIntent: true,
        candidates: candidateList.slice(0, 8),
        explanation: `I found ${candidateList.length} products matching **"${cleanTerm}"** in your inventory. Click the product you want to edit:`
      };
    }

    // Target specified but not found
    return {
      isEditIntent: true,
      candidates: allProducts.slice(0, 8),
      explanation: `I couldn't find a product matching **"${cleanTerm}"** in the catalog. You can select one from your store below or check the spelling:`
    };
  };

  // Intelligent query engine
  const handleAskQuestion = (questionText: string) => {
    if (!questionText.trim()) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: questionText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    setTimeout(() => {
      const safeProducts = products || [];

      // Check for product editing commands first
      const editResult = parseProductEditInstruction(questionText, safeProducts);
      if (editResult.isEditIntent) {
        if (editResult.matchedProduct) {
          const aiMsg: Message = {
            id: `msg-${Date.now() + 1}`,
            sender: 'ai',
            text: editResult.explanation || `I found **${editResult.matchedProduct.name}**. You can update its price, cost, stock, or details below:`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            productEditDraft: {
              id: editResult.matchedProduct.id,
              name: editResult.draft?.name || editResult.matchedProduct.name,
              price: editResult.draft?.price !== undefined ? editResult.draft.price : editResult.matchedProduct.price,
              costPrice: editResult.draft?.costPrice !== undefined ? editResult.draft.costPrice : (editResult.matchedProduct.costPrice || 0),
              stockQuantity: editResult.draft?.stockQuantity !== undefined ? editResult.draft.stockQuantity : editResult.matchedProduct.stockQuantity,
              minStockLevel: editResult.draft?.minStockLevel || editResult.matchedProduct.minStockLevel || 5,
              category: editResult.draft?.category || editResult.matchedProduct.category || 'General',
              barcode: editResult.draft?.barcode || editResult.matchedProduct.barcode || '',
              serialNumber: editResult.draft?.serialNumber || editResult.matchedProduct.serialNumber || '',
              sellBy: editResult.draft?.sellBy || editResult.matchedProduct.sellBy || (editResult.matchedProduct.unitType === 'kg' ? 'weight' : 'unit'),
              unitType: editResult.draft?.unitType || editResult.matchedProduct.unitType || (editResult.matchedProduct.sellBy === 'weight' ? 'kg' : 'piece'),
              weight: editResult.draft?.weight || editResult.matchedProduct.weight || '',
              changesSummary: editResult.changesSummary,
              originalProduct: editResult.matchedProduct
            }
          };
          setMessages(prev => [...prev, aiMsg]);
          setIsProcessing(false);
          return;
        }

        if (editResult.candidates && editResult.candidates.length > 0) {
          const aiMsg: Message = {
            id: `msg-${Date.now() + 1}`,
            sender: 'ai',
            text: editResult.explanation || `I found multiple matching products in your inventory. Which one would you like to edit?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            productCandidates: editResult.candidates
          };
          setMessages(prev => [...prev, aiMsg]);
          setIsProcessing(false);
          return;
        }
      }

      const q = questionText.toLowerCase();
      let reply = '';
      let candidates: Product[] | undefined = undefined;

      // Smart Query Resolution for Category/Product Specific Queries (e.g. "top selling oil", "cheapest ghee", "price of zeera biscuit")
      const engineRes = processStoreAiQuery(questionText, products, sales);
      if (engineRes.intent !== 'general' || engineRes.matchedProducts.length > 0) {
        reply = engineRes.reply;
        if (engineRes.matchedProducts.length > 0) {
          candidates = engineRes.matchedProducts;
        }
      }
      // 1. Cheapest item (storewide)
      else if (q.includes('cheap') || q.includes('lowest price') || q.includes('least price') || q.includes('minimum price')) {
        if (storeAnalytics.cheapest) {
          reply = `💰 **Cheapest Item in Store:**\n• **Product:** ${storeAnalytics.cheapest.name}\n• **Selling Price:** Rs. ${storeAnalytics.cheapest.price.toFixed(2)} (${storeAnalytics.cheapest.sellBy === 'weight' ? `per ${storeAnalytics.cheapest.unitType || 'kg'}` : 'per piece'})\n• **Barcode:** \`${storeAnalytics.cheapest.barcode}\`\n• **Current Stock:** ${storeAnalytics.cheapest.stockQuantity} remaining\n• **Category:** ${storeAnalytics.cheapest.category || 'General'}`;
          candidates = [storeAnalytics.cheapest];
        } else {
          reply = "There are currently no products with active pricing registered in the catalog.";
        }
      }
      // 2. Most expensive item
      else if (q.includes('expensive') || q.includes('highest price') || q.includes('costliest') || q.includes('maximum price')) {
        if (storeAnalytics.mostExpensive) {
          reply = `💎 **Most Expensive Item in Store:**\n• **Product:** ${storeAnalytics.mostExpensive.name}\n• **Selling Price:** Rs. ${storeAnalytics.mostExpensive.price.toFixed(2)} (${storeAnalytics.mostExpensive.sellBy === 'weight' ? `per ${storeAnalytics.mostExpensive.unitType || 'kg'}` : 'per piece'})\n• **Barcode:** \`${storeAnalytics.mostExpensive.barcode}\`\n• **Current Stock:** ${storeAnalytics.mostExpensive.stockQuantity} remaining\n• **Category:** ${storeAnalytics.mostExpensive.category || 'General'}`;
        } else {
          reply = "No product pricing found in inventory.";
        }
      }
      // 3. Most selling item
      else if (q.includes('most selling') || q.includes('best seller') || q.includes('top selling') || q.includes('highest selling') || q.includes('popular item')) {
        if (storeAnalytics.mostSelling && storeAnalytics.mostSelling.unitsSold > 0) {
          reply = `🔥 **Top / Most Selling Item:**\n• **Product:** ${storeAnalytics.mostSelling.name}\n• **Total Units Sold:** ${storeAnalytics.mostSelling.unitsSold.toLocaleString()} units\n• **Total Revenue Generated:** Rs. ${storeAnalytics.mostSelling.totalRevenue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n• **Barcode:** \`${storeAnalytics.mostSelling.barcode || 'N/A'}\``;
        } else {
          reply = "No sales have been recorded yet to determine the top-selling product. Start ringing up orders at the Cash Counter POS!";
        }
      }
      // 4. Least selling item
      else if (q.includes('least selling') || q.includes('lowest selling') || q.includes('slow moving') || q.includes('dead stock') || q.includes('worst selling') || q.includes('unsold')) {
        if (storeAnalytics.leastSelling.length > 0) {
          const listStr = storeAnalytics.leastSelling
            .map(item => `• **${item.name}**: ${item.unitsSold} units sold (Revenue: Rs. ${item.totalRevenue.toFixed(2)})`)
            .join('\n');
          reply = `📉 **Least Selling / Slow-Moving Items:**\n${listStr}\n\n*Tip:* Consider creating promotional discounts or bundle offers for these slow-moving products.`;
        } else {
          reply = "All products currently in the catalog are selling actively!";
        }
      }
      // 5. Low stock or out of stock
      else if (q.includes('low stock') || q.includes('out of stock') || q.includes('stock alert') || q.includes('reorder')) {
        let stockMsg = `📦 **Inventory Stock Status:**\n• **Total Products:** ${storeAnalytics.totalProducts}\n• **Out of Stock:** ${storeAnalytics.outOfStock.length} items\n• **Low Stock (<5):** ${storeAnalytics.lowStock.length} items\n\n`;
        if (storeAnalytics.outOfStock.length > 0) {
          stockMsg += `🚨 **Out of Stock Items:**\n${storeAnalytics.outOfStock.slice(0, 5).map(p => `• ${p.name} (0 stock)`).join('\n')}\n\n`;
        }
        if (storeAnalytics.lowStock.length > 0) {
          stockMsg += `⚠️ **Low Stock Items:**\n${storeAnalytics.lowStock.slice(0, 5).map(p => `• ${p.name} (${p.stockQuantity} remaining)`).join('\n')}`;
        }
        reply = stockMsg;
      }
      // 6. Today's sales
      else if (q.includes('today') || q.includes('todays sales') || q.includes('daily sale') || q.includes('current revenue')) {
        reply = `📊 **Today's Store Performance (${new Date().toLocaleDateString()}):**\n• **Net Sales Revenue:** Rs. ${storeAnalytics.todayTotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n• **Units Sold:** ${storeAnalytics.todayUnits.toLocaleString()} units\n• **Completed Invoices:** ${storeAnalytics.todayReceipts} receipts\n\nCheck the **Store Admin Dashboard** for full day-by-day charts and breakdown tables!`;
      }
      // 7. How to add products by weight (per kg / per liter)
      else if (q.includes('weight') || q.includes('kg') || q.includes('liter') || q.includes('litre') || q.includes('loose item')) {
        reply = `⚖️ **How to Register & Sell Products by Weight or Liquid:**\n\n1. **In Product Register:**\n   • Choose **"Sell By Weight / Volume"** or set Unit Type to **Kilogram (kg)** or **Liter (L)**.\n   • Enter the **Price per Kg** or **Price per Liter** in the retail price field.\n   • Save the product.\n\n2. **At Cash Counter POS:**\n   • When you scan the barcode or click the product, the POS will open the **Weight / Quantity Modal**.\n   • The cashier enters the exact weight (e.g. 1.25 kg) or connects a digital scale.\n   • The POS automatically multiplies the weight by your price per kg!\n\n3. **Batch Multi-Product Register:**\n   • Click **"Batch Register Products"** to list multiple weight products with their per kg/liter rates simultaneously.`;
      }
      // 8. How to use POS / Software overview
      else if (q.includes('how to use') || q.includes('software') || q.includes('help') || q.includes('features') || q.includes('guide')) {
        reply = `🏪 **Mart Pro Software Complete Guide:**\n\n1. **Cash Counter POS:**\n   • Fast barcode scanning, live cart, customer change calculation, cash/card checkout, receipt printing, and return slips.\n\n2. **Product Register:**\n   • Register individual items or open **Batch Register** to add multiple items at once.\n   • Supports piece, kg, and liter pricing, auto-barcode generation, and spreadsheet upload.\n\n3. **Store Admin Dashboard:**\n   • 7-Day Sales Volume Line Chart and Revenue Trends.\n   • Full Sales by Date breakdown table.\n   • Real-time gross revenue, profit calculations, and units sold.\n   • Customer return slip tracking & real-time inventory restock.\n   • Cashier & staff permissions.\n\n4. **Customer Price Checker:**\n   • Self-service barcode scanner for customers to scan items and view live prices and discounts.`;
      }
      // 9. Return slips
      else if (q.includes('return') || q.includes('refund') || q.includes('slip')) {
        reply = `🔄 **Return Slip & Refund Workflow:**\n\n1. Go to **Cash Counter POS**.\n2. Click the **"Return / Refund Product"** button in the header.\n3. Scan or enter the customer's receipt number (or select the item directly).\n4. Enter the units being returned and the refund reason.\n5. Click **"Process Return & Print Voucher"**.\n6. The system automatically:\n   • Restocks the items into store inventory.\n   • Deducts the refunded amount from the store's sales and profits.\n   • Generates a printed Return Voucher Slip with barcode for audit.`;
      }
      // Default general AI response
      else {
        reply = `I understand you are asking about: "${questionText}".\n\nAs your Mart Pro Supermarket AI, I can help you with:\n• Finding the **cheapest item** or **most selling item** in the store.\n• Checking **low stock** or **inventory counts**.\n• Registering **multiple products** with price per kg/liter.\n• Parsing **Excel or CSV spreadsheets** into store inventory.\n• Guides on **cash counter POS billing** and **return slips**.\n\nWould you like me to analyze your sales or help you add products from an Excel file?`;
      }

      const aiMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: 'ai',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        productCandidates: candidates
      };

      setMessages(prev => [...prev, aiMsg]);
      setIsProcessing(false);
    }, 450);
  };

  // Handle Excel upload inside the AI Chat
  const handleChatExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: `📁 Uploaded product file: **${file.name}**. Please list these products and help me add them to the store.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const parsed = await parseExcelProductFile(file);
      if (parsed.length === 0) {
        throw new Error('No valid product rows were detected in the spreadsheet.');
      }

      const sampleList = parsed.slice(0, 6).map(p => 
        `• **${p.name}** | Barcode: \`${p.barcode}\` | Rate: Rs. ${p.price.toFixed(2)}${p.sellBy === 'weight' ? `/${p.unitType}` : ''} | Qty: ${p.quantity}`
      ).join('\n');

      const extraCount = parsed.length > 6 ? `\n...and ${parsed.length - 6} more products.` : '';

      const aiReply: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: 'ai',
        text: `✅ I analyzed **${file.name}** and extracted **${parsed.length} products** with their barcodes, quantities, and prices per unit/kg/liter!\n\n**Preview of extracted products:**\n${sampleList}${extraCount}\n\nYou can click the button below to automatically list and save all **${parsed.length} products** directly into your **${store.name}** inventory!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        parsedProducts: parsed
      };

      setMessages(prev => [...prev, aiReply]);
    } catch (err: any) {
      const errorReply: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: 'ai',
        text: `⚠️ Error reading spreadsheet: ${err.message || 'Could not parse file'}. Please ensure the file has columns for Product Name, Price, and Quantity.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorReply]);
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Commit parsed products from AI directly into Firestore
  const handleCommitParsedProducts = async (msgId: string, productsToSave: BatchProductRow[]) => {
    setIsProcessing(true);
    try {
      let saved = 0;
      for (const p of productsToSave) {
        const prodId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await setDoc(doc(db, 'products', prodId), {
          id: prodId,
          storeId: store.id,
          barcode: p.barcode,
          serialNumber: p.serialNumber || p.barcode,
          name: p.name,
          category: p.category || 'General',
          sellBy: p.sellBy,
          unitType: p.unitType,
          price: Number(p.price),
          costPrice: Number(p.costPrice) || 0,
          stockQuantity: Number(p.quantity),
          minStockLevel: 5,
          weight: p.sellBy === 'weight' ? (p.unitType === 'kg' ? '1 kg' : '1 Liter') : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
        saved++;
      }

      setMessages(prev => prev.map(m => {
        if (m.id === msgId) {
          return {
            ...m,
            actionTaken: true,
            text: m.text + `\n\n🎉 **Successfully registered ${saved} products into ${store.name} inventory!** They are now live and ready for barcode scanning at the Cash Counter POS.`
          };
        }
        return m;
      }));
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          text: `⚠️ **Error saving products:** ${err?.message || 'Could not write to database'}. Please check your connection and try again.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl h-[85vh] max-h-[700px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-600 text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-wide">Mart Pro Store AI Copilot</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live Intelligence
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {store.name} • {products.length} Products • {sales.length} Invoices
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 overflow-x-auto flex items-center gap-1.5 custom-scrollbar text-xs shrink-0">
          <button
            onClick={() => handleAskQuestion("Edit product")}
            className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg whitespace-nowrap transition-colors font-bold flex items-center gap-1 cursor-pointer shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-200" />
            ✏️ Edit a Product
          </button>
          <button
            onClick={() => handleAskQuestion("Change price of an item")}
            className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-lg border border-slate-200 hover:border-orange-200 whitespace-nowrap transition-colors font-medium flex items-center gap-1 cursor-pointer"
          >
            💰 Change Price
          </button>
          <button
            onClick={() => handleAskQuestion("Update stock of an item")}
            className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-lg border border-slate-200 hover:border-orange-200 whitespace-nowrap transition-colors font-medium flex items-center gap-1 cursor-pointer"
          >
            📦 Update Stock
          </button>
          <button
            onClick={() => handleAskQuestion("Which is the cheapest item in store?")}
            className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-lg border border-slate-200 hover:border-orange-200 whitespace-nowrap transition-colors font-medium flex items-center gap-1 cursor-pointer"
          >
            Cheapest item
          </button>
          <button
            onClick={() => handleAskQuestion("What is the most selling item?")}
            className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-lg border border-slate-200 hover:border-orange-200 whitespace-nowrap transition-colors font-medium flex items-center gap-1 cursor-pointer"
          >
            🔥 Most selling item
          </button>
          <button
            onClick={() => handleAskQuestion("Show low stock and out of stock items")}
            className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-lg border border-slate-200 hover:border-orange-200 whitespace-nowrap transition-colors font-medium flex items-center gap-1 cursor-pointer"
          >
            ⚠️ Low stock alert
          </button>
          <button
            onClick={() => handleAskQuestion("How do I register products by weight with price per kg or per liter?")}
            className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-lg border border-slate-200 hover:border-orange-200 whitespace-nowrap transition-colors font-medium flex items-center gap-1 cursor-pointer"
          >
            ⚖️ Price per kg / liter guide
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 custom-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'ai' && (
                <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[88%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-orange-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{msg.text}</div>

                {/* Interactive AI Product Editor Card */}
                {msg.productEditDraft && (
                  <AiProductEditorCard
                    draft={msg.productEditDraft}
                    onSavedSuccess={(updatedProduct) => {
                      if (onProductUpdated) {
                        onProductUpdated(updatedProduct);
                      }
                    }}
                  />
                )}

                {/* Candidate Products to pick for editing */}
                {msg.productCandidates && msg.productCandidates.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Boxes className="w-3.5 h-3.5 text-orange-600" /> Click a product to open AI editor:
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                      {msg.productCandidates.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectCandidateToEdit(p)}
                          className="px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-600 text-orange-900 hover:text-white border border-orange-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs group"
                        >
                          <Edit3 className="w-3 h-3 text-orange-600 group-hover:text-white" />
                          <span>{p.name}</span>
                          <span className="font-mono text-[11px] opacity-85">Rs. {p.price}</span>
                          <span className="text-[10px] text-slate-500 group-hover:text-orange-100 font-normal">
                            ({p.stockQuantity} in stock)
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parsed Products Action Button */}
                {msg.parsedProducts && msg.parsedProducts.length > 0 && !msg.actionTaken && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCommitParsedProducts(msg.id, msg.parsedProducts!)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Save All {msg.parsedProducts.length} Products to Inventory
                    </button>
                    {onOpenBatchRegister && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenBatchRegister();
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors text-center cursor-pointer"
                      >
                        Edit in Batch Table First
                      </button>
                    )}
                  </div>
                )}

                <div className={`text-[10px] mt-1.5 ${msg.sender === 'user' ? 'text-orange-200 text-right' : 'text-slate-400'}`}>
                  {msg.timestamp}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div className="flex items-center gap-2 text-slate-500 text-xs italic pl-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-600" />
              <span>Analyzing store database & computing answer...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input & Excel Attachment Area */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskQuestion(input);
            }}
            className="flex items-center gap-2"
          >
            {/* Hidden File Input for Excel */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleChatExcelUpload}
              accept=".xlsx, .xls, .csv"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingFile}
              title="Upload Excel or CSV file for AI to automatically list products"
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 text-slate-600 hover:text-emerald-700 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold hidden sm:inline">Excel</span>
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AI: 'Change price of Milk to 250', 'Add 20 stock to Rice', 'Edit product'..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-xs sm:text-sm bg-slate-50/50"
            />

            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="p-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition-colors cursor-pointer disabled:opacity-40 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between px-1">
            <span>Ask AI to edit product prices, stock, names, or analyze store trends</span>
            <span className="font-mono">Mart Pro AI v2.5</span>
          </div>
        </div>

      </div>
    </div>
  );
};
