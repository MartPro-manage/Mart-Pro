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
import { BatchProductRow, parseExcelProductFile, generateRandomBarcode } from '../lib/excelParser';
import { db, doc, setDoc, cleanFirestoreData } from '../lib/firebase';
import { AiProductEditorCard, ProductEditDraft } from './AiProductEditorCard';
import { processStoreAiQuery } from '../lib/storeAiEngine';
import { generateNextShortcutCode } from '../utils/productShortcuts';
import { playScanSuccessBeep } from '../lib/sound';

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

/**
 * Formatted Markdown Text renderer for AI Copilot responses
 */
const FormattedMarkdownText: React.FC<{ text: string; isUser?: boolean }> = ({ text, isUser = false }) => {
  if (!text) return null;

  if (isUser) {
    return <div className="whitespace-pre-wrap font-sans leading-relaxed">{text}</div>;
  }

  const lines = text.split('\n');

  const formatInline = (content: string) => {
    // split by code tags `...`
    const codeParts = content.split(/(`[^`]+`)/g);
    return codeParts.map((cPart, cIdx) => {
      if (cPart.startsWith('`') && cPart.endsWith('`') && cPart.length > 2) {
        const codeVal = cPart.slice(1, -1);
        return (
          <code key={cIdx} className="px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-[11px] sm:text-xs font-bold bg-amber-100/90 text-amber-950 border border-amber-300/80 shadow-2xs inline-block">
            {codeVal}
          </code>
        );
      }

      // split by **bold**
      const boldParts = cPart.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((bPart, bIdx) => {
        if (bPart.startsWith('**') && bPart.endsWith('**') && bPart.length > 4) {
          return (
            <strong key={bIdx} className="font-black text-slate-900">
              {bPart.slice(2, -2)}
            </strong>
          );
        }
        if (bPart.startsWith('*') && bPart.endsWith('*') && bPart.length > 2) {
          return (
            <em key={bIdx} className="italic text-slate-600">
              {bPart.slice(1, -1)}
            </em>
          );
        }
        return bPart;
      });
    });
  };

  return (
    <div className="space-y-1.5 font-sans leading-relaxed text-slate-800">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Header lines starting with emojis or main title
        const isHeading = (trimmed.startsWith('🛒') || trimmed.startsWith('🏢') || trimmed.startsWith('⚙️') || trimmed.startsWith('📖') || trimmed.startsWith('⌨️') || trimmed.startsWith('👋')) && trimmed.includes('**');
        
        if (isHeading) {
          return (
            <div key={idx} className="my-2 p-2.5 rounded-xl bg-orange-50/90 border border-orange-200/90 text-orange-950 font-black text-xs sm:text-sm shadow-2xs">
              {formatInline(trimmed)}
            </div>
          );
        }

        // List item bullet
        if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
          const bulletText = trimmed.substring(1).trim();
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5 text-xs sm:text-sm my-0.5">
              <span className="text-orange-600 font-extrabold leading-tight text-sm">•</span>
              <span className="flex-1">{formatInline(bulletText)}</span>
            </div>
          );
        }

        // Numbered item
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5 font-medium text-xs sm:text-sm my-1 text-slate-900">
              <span className="px-2 py-0.5 rounded-md bg-orange-600 text-white font-extrabold text-[10px] shrink-0 shadow-2xs mt-0.5">
                {numMatch[1]}
              </span>
              <span className="flex-1">{formatInline(numMatch[2])}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-xs sm:text-sm my-0.5">
            {formatInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
};

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

const DEFAULT_PRODUCTS: Product[] = [];
const DEFAULT_SALES: Sale[] = [];
const DEFAULT_RETURNS: ProductReturn[] = [];

export const StoreAiAssistantModal: React.FC<StoreAiAssistantModalProps> = ({
  isOpen,
  onClose,
  store,
  products = DEFAULT_PRODUCTS,
  sales = DEFAULT_SALES,
  returns = DEFAULT_RETURNS,
  currentUser,
  onOpenBatchRegister,
  initialProductToEdit,
  onProductUpdated,
  initialSpreadsheetProducts
}) => {
  const [activeChipCategory, setActiveChipCategory] = useState<'all' | 'guides' | 'actions' | 'analytics'>('all');

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `👋 **Hello Store Admin! I am your Mart Pro AI Supermarket Copilot & Software Expert.**\n\nI have two superpowers:\n1. 📊 **Complete Real-Time Visibility** into **"${store.name}"** — live inventory, stock values at cost vs retail, profit margins, active discounts, top/least-selling products, cashier performance, and return ledgers.\n2. 📖 **Complete Software Mastery & Guidance** — I know every single feature, workflow, keyboard shortcut, hardware setup, and setting in Mart Pro. I am here to guide you step-by-step on anything!\n\n💡 **You can ask me ANYTHING, for example:**\n• 📖 *"How do I hold a bill and resume it later?"*\n• 🏷️ *"How do I set discounts and promotions for customers?"*\n• ⌨️ *"What are all the cash counter keyboard shortcuts?"*\n• 📊 *"What is today's revenue, profit, and invoice count?"*\n• 📦 *"Which products are low on stock or out of stock?"*\n• ⚡ *"Change price of Milk to 250"*, *"Add 50 stock to Rice"*, or *"Add product Mango price 300 stock 50"*`,
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

  // Helper function to parse natural language instructions to ADD a new product with 4-digit shortcut code
  const parseAddNewProductInstruction = (queryText: string, allProducts: Product[]) => {
    const q = queryText.trim();
    const lower = q.toLowerCase();

    // Check if user is asking to add/create/register a new product
    const isAddQuery = /\b(add|create|register|insert|new)\s+(?:new\s+)?(?:product|item|good)\b/i.test(lower) ||
      /\b(?:add|insert)\s+([a-zA-Z0-9\s\-]+?)\s+(?:to\s+(?:store|inventory|catalog)|with\s+price|price|rate)/i.test(lower);

    if (!isAddQuery) {
      return { isAddIntent: false };
    }

    // Check if it's purely adding stock delta to an existing product (e.g. "add 20 stock to Milk")
    if (/\b(?:add|increase)\s+[0-9.]+\s*(?:units?|items?|stock|qty|kg|liters?)?\s*(?:to|for|in)\s+/i.test(lower)) {
      return { isAddIntent: false };
    }

    // Extract product name
    let name = '';
    // Pattern A: "add [new] product [name] price [N] ..."
    const nameMatch1 = queryText.match(/(?:add|create|register|insert|new)\s+(?:new\s+)?(?:product|item|item\s+called|product\s+called)?\s+["']?([^"'\n]+?)["']?\s+(?:with\s+)?(?:price|rate|cost|stock|quantity|qty|category|barcode|per|at|for)\s+/i);
    if (nameMatch1) {
      name = nameMatch1[1].replace(/^(product|item|called)\s+/i, '').trim();
    } else {
      // Pattern B: "add [name] price [N]"
      const nameMatch2 = queryText.match(/(?:add|create|register)\s+["']?([^"'\n]+?)["']?\s+(?:price|rate|at\s+rs|cost)\s+/i);
      if (nameMatch2) {
        name = nameMatch2[1].trim();
      }
    }

    // Fallback name if simple "add product Mango"
    if (!name) {
      const simpleMatch = queryText.match(/(?:add|create|register)\s+(?:new\s+)?(?:product|item)\s+["']?([^"'\n]+)["']?$/i);
      if (simpleMatch) {
        name = simpleMatch[1].trim();
      }
    }

    if (!name) {
      return { isAddIntent: false };
    }

    // Clean up name
    name = name.replace(/^(the|a|an)\s+/i, '').trim();

    // Extract Price
    let price = 0;
    const priceMatch = lower.match(/(?:price|rate|selling\s*price|at|for|is)\s*(?:of|is|:|=|to)?\s*(?:rs\.?|pkr)?\s*([0-9.]+)/i);
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
    }

    // Extract Cost Price
    let costPrice = 0;
    const costMatch = lower.match(/(?:cost|cost\s*price|buying\s*price|purchase\s*price)\s*(?:of|is|:|=|to)?\s*(?:rs\.?|pkr)?\s*([0-9.]+)/i);
    if (costMatch) {
      costPrice = parseFloat(costMatch[1]);
    } else if (price > 0) {
      costPrice = Math.round(price * 0.8 * 100) / 100;
    }

    // Extract Stock Quantity
    let stockQuantity = 50;
    const stockMatch = lower.match(/(?:stock|quantity|qty|units?)\s*(?:of|is|:|=|to)?\s*([0-9.]+)/i);
    if (stockMatch) {
      stockQuantity = parseFloat(stockMatch[1]);
    }

    // Extract Category
    let category = 'General';
    const catMatch = lower.match(/(?:category|dept|department)\s*(?:of|is|:|=|to)?\s*["']?([a-zA-Z0-9\s]+?)["']?(?:\s+(?:with|and|price|stock)|$)/i);
    if (catMatch) {
      category = catMatch[1].trim();
    }

    // Extract Sell By / Weight
    let sellBy: 'unit' | 'weight' = 'unit';
    let unitType: 'piece' | 'kg' | 'liter' = 'piece';
    if (/\b(per\s*kg|kg|kilogram|kilo|per\s*kilo)\b/i.test(lower)) {
      sellBy = 'weight';
      unitType = 'kg';
    } else if (/\b(per\s*liter|per\s*litre|liter|litre|ltr)\b/i.test(lower)) {
      sellBy = 'weight';
      unitType = 'liter';
    }

    // Extract or generate barcode
    let barcode = '';
    const barcodeMatch = lower.match(/barcode\s*(?:of|is|:|=|to)?\s*([0-9a-zA-Z]+)/i);
    if (barcodeMatch) {
      barcode = barcodeMatch[1].trim();
    } else {
      barcode = generateRandomBarcode();
    }

    // Generate unique 4-digit POS shortcut code
    const shortcutCode = generateNextShortcutCode(allProducts);

    return {
      isAddIntent: true,
      name,
      price: isNaN(price) ? 100 : price,
      costPrice: isNaN(costPrice) ? 80 : costPrice,
      stockQuantity: isNaN(stockQuantity) ? 50 : stockQuantity,
      category,
      sellBy,
      unitType,
      barcode,
      shortcutCode
    };
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

  const buildComprehensiveStoreContext = () => {
    const safeProducts = products || [];
    const safeSales = sales || [];
    const safeReturns = returns || [];

    // Summary statistics
    const totalProducts = safeProducts.length;
    const outOfStock = safeProducts.filter(p => (p.stockQuantity ?? 0) <= 0);
    const lowStock = safeProducts.filter(p => (p.stockQuantity ?? 0) > 0 && (p.stockQuantity ?? 0) <= (p.minStockLevel || 5));
    
    const totalStockUnits = safeProducts.reduce((sum, p) => sum + (Number(p.stockQuantity) || 0), 0);
    const totalInventoryCostValue = safeProducts.reduce((sum, p) => sum + ((Number(p.costPrice) || 0) * (Number(p.stockQuantity) || 0)), 0);
    const totalInventoryRetailValue = safeProducts.reduce((sum, p) => sum + ((Number(p.price) || 0) * (Number(p.stockQuantity) || 0)), 0);

    // Sales metrics by date
    const totalSalesRevenue = safeSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const totalSalesCount = safeSales.length;

    const todayDate = new Date();
    const todayStr = todayDate.toISOString().slice(0, 10);
    const yesterdayDate = new Date(todayDate.getTime() - 86400000);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    const todaySales = safeSales.filter(s => s.timestamp && s.timestamp.startsWith(todayStr));
    const todayRevenue = todaySales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const todayInvoices = todaySales.length;

    const yesterdaySales = safeSales.filter(s => s.timestamp && s.timestamp.startsWith(yesterdayStr));
    const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const yesterdayInvoices = yesterdaySales.length;

    // Discounts breakdown by date
    const calculateDiscountsForSales = (saleList: Sale[]) => {
      return saleList.reduce((sum, s) => {
        let saleDisc = Number(s.discountAmount) || 0;
        const itemDisc = (s.items || []).reduce((itemSum, it) => {
          if (it.originalPrice && it.originalPrice > it.price) {
            return itemSum + ((it.originalPrice - it.price) * (it.quantity || 1));
          }
          return itemSum;
        }, 0);
        return sum + Math.max(saleDisc, itemDisc);
      }, 0);
    };

    const todayDiscounts = calculateDiscountsForSales(todaySales);
    const yesterdayDiscounts = calculateDiscountsForSales(yesterdaySales);
    const totalDiscountsTillToday = calculateDiscountsForSales(safeSales);

    // Product sales breakdown (All-time, Today, Yesterday)
    const getTopSellersForList = (saleList: Sale[]) => {
      const map = new Map<string, { name: string; unitsSold: number; revenue: number }>();
      saleList.forEach(s => {
        (s.items || []).forEach(item => {
          const key = item.name.toLowerCase().trim();
          const existing = map.get(key) || { name: item.name, unitsSold: 0, revenue: 0 };
          existing.unitsSold += (item.quantity || 1);
          existing.revenue += (item.total || (item.price * (item.quantity || 1)));
          map.set(key, existing);
        });
      });
      return Array.from(map.values()).sort((a, b) => b.unitsSold - a.unitsSold);
    };

    const topSellersAllTime = getTopSellersForList(safeSales).slice(0, 10);
    const topSellersToday = getTopSellersForList(todaySales).slice(0, 5);
    const topSellersYesterday = getTopSellersForList(yesterdaySales).slice(0, 5);
    const slowMovers = safeProducts.filter(p => !topSellersAllTime.some(t => t.name.toLowerCase() === p.name.toLowerCase())).slice(0, 10).map(p => p.name);

    // Profitability per product
    const productProfitability = safeProducts.map(p => {
      const cost = Number(p.costPrice) || 0;
      const price = Number(p.price) || 0;
      const profitPerUnit = Math.round((price - cost) * 100) / 100;
      const profitMarginPercent = price > 0 ? Math.round(((price - cost) / price) * 10000) / 100 : 0;
      return {
        name: p.name,
        category: p.category || 'General',
        costPrice: cost,
        retailPrice: price,
        profitPerUnit,
        profitMarginPercent
      };
    });

    const highProfitProducts = [...productProfitability].sort((a, b) => b.profitMarginPercent - a.profitMarginPercent).slice(0, 5);
    const lowProfitProducts = [...productProfitability].sort((a, b) => a.profitMarginPercent - b.profitMarginPercent).slice(0, 5);

    // Active discounts
    const discountedProducts = safeProducts.filter(p => p.discountActive && (p.discountValue ?? 0) > 0);

    // Returns
    const totalRefundAmount = safeReturns.reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);

    return {
      storeName: store.name,
      currency: store.currencySymbol || 'Rs.',
      adminUsername: store.adminUsername,
      phone: store.phone,
      address: store.address,
      taxRegistrationNumber: store.taxRegistrationNumber,
      returnPolicyDays: store.returnPolicyDays || 7,
      inventorySummary: {
        totalProducts,
        totalStockUnits,
        totalInventoryCostValue: Math.round(totalInventoryCostValue * 100) / 100,
        totalInventoryRetailValue: Math.round(totalInventoryRetailValue * 100) / 100,
        potentialGrossMargin: Math.round((totalInventoryRetailValue - totalInventoryCostValue) * 100) / 100,
        outOfStockCount: outOfStock.length,
        outOfStockItems: outOfStock.slice(0, 15).map(p => ({ name: p.name, barcode: p.barcode, category: p.category })),
        lowStockCount: lowStock.length,
        lowStockItems: lowStock.slice(0, 15).map(p => ({ name: p.name, currentStock: p.stockQuantity, minThreshold: p.minStockLevel || 5, price: p.price }))
      },
      salesSummary: {
        totalSalesCount,
        totalSalesRevenue: Math.round(totalSalesRevenue * 100) / 100,
        todayDate: todayStr,
        todayRevenue: Math.round(todayRevenue * 100) / 100,
        todayInvoices,
        topSellingToday: topSellersToday,
        yesterdayDate: yesterdayStr,
        yesterdayRevenue: Math.round(yesterdayRevenue * 100) / 100,
        yesterdayInvoices,
        topSellingYesterday: topSellersYesterday,
        topSellingAllTime: topSellersAllTime,
        slowMovingProducts: slowMovers
      },
      profitabilitySummary: {
        highProfitProducts,
        lowProfitProducts
      },
      discountsSummary: {
        todayDiscountsGiven: Math.round(todayDiscounts * 100) / 100,
        yesterdayDiscountsGiven: Math.round(yesterdayDiscounts * 100) / 100,
        totalDiscountsTillToday: Math.round(totalDiscountsTillToday * 100) / 100,
        activePromotionalProductsCount: discountedProducts.length,
        discountedProductsList: discountedProducts.map(p => ({
          name: p.name,
          originalPrice: p.price,
          discountType: p.discountType,
          discountValue: p.discountValue
        }))
      },
      returnsSummary: {
        totalReturnsCount: safeReturns.length,
        totalRefundAmount: Math.round(totalRefundAmount * 100) / 100
      },
      sampleProductsCatalog: safeProducts.slice(0, 50).map(p => ({
        name: p.name,
        price: p.price,
        costPrice: p.costPrice || 0,
        stockQuantity: p.stockQuantity,
        category: p.category || 'General',
        barcode: p.barcode,
        shortcutCode: p.shortcutCode,
        sellBy: p.sellBy || 'unit'
      }))
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

    setTimeout(async () => {
      const safeProducts = products || [];

      // Check for ADD NEW PRODUCT intent first (e.g. "Add product Mango price 300 stock 50")
      const addResult = parseAddNewProductInstruction(questionText, safeProducts);
      if (addResult.isAddIntent && addResult.name) {
        const prodId = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newProductObj: Product = {
          id: prodId,
          storeId: store.id,
          name: addResult.name,
          price: addResult.price,
          pricePerKg: addResult.sellBy === 'weight' ? addResult.price : undefined,
          costPrice: addResult.costPrice,
          stockQuantity: addResult.stockQuantity,
          minStockLevel: 5,
          category: addResult.category,
          barcode: addResult.barcode,
          shortcutCode: addResult.shortcutCode,
          serialNumber: addResult.shortcutCode,
          sellBy: addResult.sellBy,
          unitType: addResult.unitType,
          weight: addResult.sellBy === 'weight' ? (addResult.unitType === 'kg' ? '1 kg' : '1 Liter') : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        try {
          // Write to Firestore
          await setDoc(doc(db, 'products', prodId), cleanFirestoreData(newProductObj), { merge: true });
          playScanSuccessBeep();
          if (onProductUpdated) onProductUpdated(newProductObj);

          const replyText = `🎉 **Successfully Added & Registered New Product to "${store.name}"!**\n\n` +
            `• **Product Name:** **${addResult.name}**\n` +
            `• **🔢 4-Digit POS Shortcut Code:** **#${addResult.shortcutCode}**\n` +
            `  *(Cashiers can type \`${addResult.shortcutCode}\` anywhere at the Cash Counter POS to instantly add to cart!)*\n` +
            `• **Retail Selling Price:** Rs. ${addResult.price.toFixed(2)}${addResult.sellBy === 'weight' ? ` per ${addResult.unitType}` : ''}\n` +
            `• **Wholesale Cost Price:** Rs. ${addResult.costPrice.toFixed(2)}\n` +
            `• **Stock Quantity:** ${addResult.stockQuantity} ${addResult.sellBy === 'weight' ? addResult.unitType : 'units'}\n` +
            `• **Barcode:** \`${addResult.barcode}\`\n` +
            `• **Category:** ${addResult.category}\n\n` +
            `*The product is live in your catalog and synchronized across all POS counters.*`;

          const aiMsg: Message = {
            id: `msg-${Date.now() + 1}`,
            sender: 'ai',
            text: replyText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            productEditDraft: {
              id: prodId,
              name: addResult.name,
              price: addResult.price,
              costPrice: addResult.costPrice,
              stockQuantity: addResult.stockQuantity,
              minStockLevel: 5,
              category: addResult.category,
              barcode: addResult.barcode,
              shortcutCode: addResult.shortcutCode,
              serialNumber: addResult.barcode,
              sellBy: addResult.sellBy,
              unitType: addResult.unitType,
              originalProduct: newProductObj,
              saved: true
            }
          };

          setMessages(prev => [...prev, aiMsg]);
        } catch (e: any) {
          setMessages(prev => [...prev, {
            id: `msg-${Date.now() + 1}`,
            sender: 'ai',
            text: `⚠️ Could not save product to database: ${e?.message || 'Error occurred'}. Please try again.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }]);
        }

        setIsProcessing(false);
        return;
      }

      // Check for product editing commands next
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
              shortcutCode: editResult.matchedProduct.shortcutCode,
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

      // Query server-side Gemini AI Copilot endpoint with full store knowledge
      try {
        const storeContext = buildComprehensiveStoreContext();
        const history = messages.slice(-6).map(m => ({
          role: m.sender === 'user' ? 'user' : 'model',
          text: m.text
        }));

        const response = await fetch('/api/ai/store-copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: questionText,
            storeContext,
            conversationHistory: history
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.reply) {
            const aiMsg: Message = {
              id: `msg-${Date.now() + 1}`,
              sender: 'ai',
              text: data.reply,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, aiMsg]);
            setIsProcessing(false);
            return;
          }
        }
      } catch (copilotErr) {
        console.warn('AI Copilot server route failed, using local engine fallback:', copilotErr);
      }

      // Offline / Local engine fallback
      const q = questionText.toLowerCase();
      let reply = '';
      let candidates: Product[] | undefined = undefined;

      // Smart Query Resolution for Software Help Guides & Category/Product Specific Queries
      const engineRes = processStoreAiQuery(questionText, safeProducts, sales);
      if (engineRes.intent === 'guide' || engineRes.intent !== 'general' || engineRes.matchedProducts.length > 0) {
        reply = engineRes.reply;
        if (engineRes.matchedProducts.length > 0) {
          candidates = engineRes.matchedProducts;
        }
      }
      // Check for 4-Digit Shortcut queries if not handled by guide
      else if (!reply && (q.includes('shortcut') || q.includes('short cut') || q.includes('4-digit') || q.includes('4 digit') || q.includes('short code') || q.includes('pos code'))) {
        let matchedProd = safeProducts.find(p => p.name && q.includes(p.name.toLowerCase()));
        if (matchedProd) {
          reply = `🔢 **4-Digit POS Shortcut Code for "${matchedProd.name}":**\n\n• **Shortcut Code:** **#${matchedProd.shortcutCode || 'N/A'}**\n• **Retail Price:** Rs. ${matchedProd.price.toFixed(2)}${matchedProd.sellBy === 'weight' ? `/${matchedProd.unitType || 'kg'}` : ''}\n• **Barcode:** \`${matchedProd.barcode || 'N/A'}\`\n• **Available Stock:** ${matchedProd.stockQuantity} ${matchedProd.sellBy === 'weight' ? matchedProd.unitType || 'kg' : 'units'}\n\n💡 **Tip:** Cashiers can type \`${matchedProd.shortcutCode}\` anywhere at the cash counter or press \`S+K\` to view all shortcuts!`;
          candidates = [matchedProd];
        } else {
          const sampleList = safeProducts.slice(0, 6).map(p => `• **${p.name}**: \`#${p.shortcutCode || '----'}\` (Rs. ${p.price.toFixed(2)})`).join('\n');
          reply = `🔢 **4-Digit POS Product Shortcuts:**\n\n${sampleList}\n\n💡 **How to use 4-digit shortcuts:**\n1. Press **S + K** anywhere at the Cash Counter to open the Shortcuts Directory.\n2. Or simply type any 4-digit code (e.g. \`1001\`) into the barcode scanner box at checkout to instantly add item to cart!`;
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
      // Default general AI response
      else {
        reply = `I understand you are asking about: "${questionText}".\n\nAs your Mart Pro Supermarket AI, I have full visibility into your inventory, sales, expenses, discounts, and cashier records. You can ask me:\n• Today's total sales, gross profit, and revenue\n• Inventory value at cost vs retail price\n• Which items to reorder from suppliers\n• How much discount was given this month\n• Cashier and counter performance\n• Or tell me to update prices or stock!`;
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
    }, 400);
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

  // Commit parsed products from AI directly into Firestore with automatic barcode stock updates
  const handleCommitParsedProducts = async (msgId: string, productsToSave: BatchProductRow[]) => {
    setIsProcessing(true);
    try {
      let saved = 0;
      let updatedCount = 0;
      let newCount = 0;
      const assignedPool = [...(products || [])];
      const savedShortcuts: Array<{ name: string; code: string; isUpdate?: boolean }> = [];

      for (const p of productsToSave) {
        const barcodeTrimmed = p.barcode ? p.barcode.trim() : '';
        
        // Match existing product in store database by full barcode
        const existing = barcodeTrimmed 
          ? (products || []).find(prod => prod.barcode && prod.barcode.trim().toLowerCase() === barcodeTrimmed.toLowerCase())
          : undefined;

        const prodId = existing ? existing.id : `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const shortcutCode = existing?.shortcutCode || p.shortcutCode || generateNextShortcutCode(assignedPool);

        if (!existing) {
          assignedPool.push({ shortcutCode } as Product);
        }
        savedShortcuts.push({ name: p.name || existing?.name || 'Product', code: shortcutCode, isUpdate: !!existing });

        // Update stock: add new quantity to existing stock quantity, and update cost price & selling price
        const updatedQty = existing ? (existing.stockQuantity || 0) + Number(p.quantity || 0) : Number(p.quantity || 0);
        const updatedSellingPrice = Number(p.price) > 0 ? Number(p.price) : (existing?.price || 0);
        const updatedCostPrice = Number(p.costPrice) > 0 ? Number(p.costPrice) : (existing?.costPrice || 0);

        await setDoc(doc(db, 'products', prodId), cleanFirestoreData({
          id: prodId,
          storeId: store.id,
          barcode: barcodeTrimmed || (existing?.barcode || ''),
          serialNumber: p.serialNumber || barcodeTrimmed || (existing?.serialNumber || shortcutCode),
          shortcutCode: shortcutCode,
          name: p.name?.trim() || existing?.name || 'Unnamed Product',
          category: p.category?.trim() || existing?.category || 'General',
          sellBy: p.sellBy || existing?.sellBy || 'unit',
          unitType: p.unitType || existing?.unitType || 'piece',
          price: updatedSellingPrice,
          costPrice: updatedCostPrice,
          stockQuantity: updatedQty,
          minStockLevel: existing?.minStockLevel || 5,
          weight: p.sellBy === 'weight' ? (p.unitType === 'kg' ? '1 kg' : '1 Liter') : existing?.weight,
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }), { merge: true });

        if (existing) {
          updatedCount++;
        } else {
          newCount++;
        }
        saved++;
      }

      const shortcutSummary = savedShortcuts.slice(0, 6)
        .map(s => `• **${s.name}** (\`#${s.code}\`): ${s.isUpdate ? '🔄 Stock & Price Updated' : '✨ New Product Saved'}`)
        .join('\n');
      const extraShortcuts = savedShortcuts.length > 6 ? `\n...and ${savedShortcuts.length - 6} more processed with assigned 4-digit codes.` : '';

      setMessages(prev => prev.map(m => {
        if (m.id === msgId) {
          return {
            ...m,
            actionTaken: true,
            text: m.text + `\n\n🎉 **Processed ${saved} products for "${store.name}"!**\n• **${newCount} New Products** registered into inventory.\n• **${updatedCount} Existing Products** updated with new stock quantity, cost price, and selling price.\n\n🔢 **Product POS Shortcut Status:**\n${shortcutSummary}${extraShortcuts}\n\nThey are live and updated in your store catalog!`
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6 bg-slate-900/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl h-[88vh] max-h-[750px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        
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

        {/* Category Navigation Tabs */}
        <div className="px-3 pt-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto custom-scrollbar text-xs">
          <button
            type="button"
            onClick={() => setActiveChipCategory('all')}
            className={`px-3 py-1 rounded-t-lg font-bold transition-colors cursor-pointer border-b-2 ${
              activeChipCategory === 'all'
                ? 'bg-white text-orange-600 border-orange-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            🌟 All Topics
          </button>
          <button
            type="button"
            onClick={() => setActiveChipCategory('guides')}
            className={`px-3 py-1 rounded-t-lg font-bold transition-colors cursor-pointer border-b-2 flex items-center gap-1 ${
              activeChipCategory === 'guides'
                ? 'bg-white text-orange-600 border-orange-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
            📖 Software Guides
          </button>
          <button
            type="button"
            onClick={() => setActiveChipCategory('actions')}
            className={`px-3 py-1 rounded-t-lg font-bold transition-colors cursor-pointer border-b-2 flex items-center gap-1 ${
              activeChipCategory === 'actions'
                ? 'bg-white text-orange-600 border-orange-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-orange-500" />
            ⚡ Quick Actions
          </button>
          <button
            type="button"
            onClick={() => setActiveChipCategory('analytics')}
            className={`px-3 py-1 rounded-t-lg font-bold transition-colors cursor-pointer border-b-2 flex items-center gap-1 ${
              activeChipCategory === 'analytics'
                ? 'bg-white text-orange-600 border-orange-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            📊 Sales & Stock
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-2.5 bg-slate-50/80 border-b border-slate-200 overflow-x-auto flex items-center gap-1.5 custom-scrollbar text-xs shrink-0">
          {(activeChipCategory === 'all' || activeChipCategory === 'actions') && (
            <>
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
            </>
          )}

          {(activeChipCategory === 'all' || activeChipCategory === 'guides') && (
            <>
              <button
                onClick={() => handleAskQuestion("How to use POS counter and cash register?")}
                className="px-2.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg whitespace-nowrap transition-colors font-bold flex items-center gap-1 cursor-pointer shadow-xs"
              >
                🛒 How to Use POS Counter
              </button>
              <button
                onClick={() => handleAskQuestion("How to use product register to add and manage products?")}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg whitespace-nowrap transition-colors font-bold flex items-center gap-1 cursor-pointer shadow-xs"
              >
                📦 Product Register Guide
              </button>
              <button
                onClick={() => handleAskQuestion("What features are available in admin dashboard and how to use it?")}
                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg whitespace-nowrap transition-colors font-bold flex items-center gap-1 cursor-pointer shadow-xs"
              >
                🏢 Admin Dashboard Features
              </button>
              <button
                onClick={() => handleAskQuestion("How to use store admin dashboard step by step?")}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg whitespace-nowrap transition-colors font-bold flex items-center gap-1 cursor-pointer shadow-xs"
              >
                ⚙️ How to Use Admin
              </button>
              <button
                onClick={() => handleAskQuestion("What are all the POS keyboard shortcuts?")}
                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg border border-blue-200 whitespace-nowrap transition-colors font-semibold flex items-center gap-1 cursor-pointer"
              >
                ⌨️ Shortcuts Guide
              </button>
              <button
                onClick={() => handleAskQuestion("How do I hold a bill and resume it later?")}
                className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-lg border border-slate-200 hover:border-orange-200 whitespace-nowrap transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                🛒 Hold & Resume Bills
              </button>
              <button
                onClick={() => handleAskQuestion("How do I set discounts and promotions for customers?")}
                className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-lg border border-slate-200 hover:border-orange-200 whitespace-nowrap transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                🏷️ Set Discounts
              </button>
              <button
                onClick={() => handleAskQuestion("How do I process product returns and refund vouchers?")}
                className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-lg border border-slate-200 hover:border-orange-200 whitespace-nowrap transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                🔄 Process Returns
              </button>
              <button
                onClick={() => handleAskQuestion("How do I register products by weight with price per kg or per liter?")}
                className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-lg border border-slate-200 hover:border-orange-200 whitespace-nowrap transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                ⚖️ Weight & Per-Kg
              </button>
              <button
                onClick={() => handleAskQuestion("How do I print thermal receipts and configure receipt format?")}
                className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-lg border border-slate-200 hover:border-orange-200 whitespace-nowrap transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                🖨️ Thermal Printing
              </button>
              <button
                onClick={() => handleAskQuestion("How do I bulk import products from Excel or CSV?")}
                className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-lg border border-slate-200 hover:border-orange-200 whitespace-nowrap transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                📊 Excel Import
              </button>
            </>
          )}

          {(activeChipCategory === 'all' || activeChipCategory === 'analytics') && (
            <>
              <button
                onClick={() => handleAskQuestion("What is today's sales revenue, profit, and order count?")}
                className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 rounded-lg border border-slate-200 hover:border-orange-200 whitespace-nowrap transition-colors font-medium flex items-center gap-1 cursor-pointer"
              >
                📊 Today's Revenue
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
            </>
          )}
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
                <FormattedMarkdownText text={msg.text} isUser={msg.sender === 'user'} />

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
