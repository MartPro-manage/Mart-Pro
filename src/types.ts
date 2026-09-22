export type UserRole = 'super_admin' | 'admin' | 'cash_counter' | 'product_register' | 'customer_price_checker';

export interface Store {
  id: string;
  name: string;
  adminUsername: string;
  adminPassword?: string;
  status?: 'active' | 'disabled';
  cameraScannerEnabled?: boolean; // Super admin can enable/disable inbuilt barcode camera for each store
  voiceAnnouncementEnabled?: boolean; // Super admin can allow/disallow audio voice generation for each store
  phone?: string;
  address?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  logoUrl?: string; // Black & white store logo (data URL or image URL)
  receiptFormat?: 'standard' | 'classic_detailed' | 'compact_eco'; // 3 distinct receipt templates
  taxRegistrationNumber?: string;
  lowStockAlertThreshold?: number;
  currencySymbol?: string;
  returnPolicyDays?: number;
  soundEffectsEnabled?: boolean;
  customCategories?: string[];
  createdAt: string;
}

export interface Expense {
  id: string;
  storeId: string;
  name: string;
  amount: number;
  category?: string;
  notes?: string;
  date: string; // YYYY-MM-DD
  paymentMethod?: 'cash' | 'online';
  timestamp: string; // ISO string
  recordedBy?: string;
}

export interface StaffSessionLog {
  id: string;
  storeId: string;
  userId: string;
  userName: string;
  username: string;
  role: UserRole;
  counterNumber?: string;
  loginTime: string; // ISO string
  logoutTime?: string | null; // ISO string
  status: 'online' | 'offline';
  lastActive?: string;
}

export type StaffSession = StaffSessionLog;

export interface UserAccount {
  id: string;
  storeId: string; // 'all' for super_admin
  storeName?: string;
  role: UserRole;
  username: string;
  password?: string;
  name: string;
  counterNumber?: string; // for cash counter
  createdAt: string;
}

export interface Product {
  id: string;
  storeId: string;
  barcode: string;
  shortcutCode?: string; // 4-digit unique shortcut code e.g. "1001"
  serialNumber?: string;
  name: string;
  imageUrl?: string; // Product picture URL or base64 data URI
  category: string;
  costPrice?: number; // Purchase/Cost price per unit or per kg
  price: number; // Selling price per piece or price per kg
  stockQuantity: number; // Total stock pieces or total weight in kg
  minStockLevel?: number;
  weight?: string; // Text description e.g. "1 kg", "500 g", "Loose"
  sellBy?: 'unit' | 'weight'; // 'unit' (per piece/pack) or 'weight' (per kg/grams)
  unitType?: 'piece' | 'kg' | 'g' | 'liter' | 'dozen';
  pricePerKg?: number; // Rate per kg
  weightPerUnit?: number; // Weight in kg per single pack/piece (e.g. 0.5 for 500g pack)
  updatedAt: string;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number; // Quantity in units or total weight in kg (can be decimal)
  totalPrice: number;
  enteredWeight?: number;
  weightMultiplier?: number;
}

export interface SaleItem {
  productId: string;
  barcode: string;
  shortcutCode?: string;
  serialNumber?: string;
  name: string;
  costPrice?: number; // Purchase/Cost price at time of sale
  price: number; // Unit price or per kg rate
  quantity: number; // Quantity or weight (decimal supported)
  total: number;
  sellBy?: 'unit' | 'weight';
  unitType?: string;
  weightInfo?: string;
}

export interface HeldBill {
  id: string;
  storeId: string;
  counterId?: string;
  counterName?: string;
  cashierUsername?: string;
  customerName?: string;
  notes?: string;
  items: CartItem[];
  subtotal: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  total: number;
  heldAt: string; // ISO string
}

export interface SupplierOrderItem {
  id: string;
  productId?: string;
  name: string;
  category?: string;
  barcode?: string;
  shortcutCode?: string;
  currentStock?: number;
  orderQuantity: number;
  unitType?: string;
  costPrice?: number;
  estimatedTotal?: number;
  checked?: boolean;
}

export interface SupplierOrder {
  id: string;
  storeId: string;
  supplierName: string;
  contactNumber: string;
  items: SupplierOrderItem[];
  status: 'pending' | 'ordered' | 'delivered';
  notes?: string;
  totalEstimatedAmount?: number;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
}

export interface Sale {
  id: string;
  storeId: string;
  storeName?: string;
  counterId: string;
  counterName: string;
  cashierUsername: string;
  items: SaleItem[];
  subtotalAmount?: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  discountAmount?: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'online';
  cashReceived?: number;
  changeReturned?: number;
  receiptNumber: string;
  timestamp: string;
  expiresAt?: string;
  isSlipDeleted?: boolean;
  slipExpired?: boolean;
  slipDeletedAt?: string;
}

export interface ProductReturn {
  id: string;
  storeId: string;
  storeName?: string;
  counterId: string;
  counterName: string;
  cashierUsername: string;
  productId: string;
  productName: string;
  barcode: string;
  serialNumber?: string;
  price: number;
  quantity: number;
  sellBy?: 'unit' | 'weight';
  unitType?: string;
  refundAmount: number;
  refundMethod: 'cash' | 'online';
  reason?: string;
  originalReceiptNumber?: string;
  returnSlipNumber: string;
  timestamp: string;
}

export interface AuthState {
  user: UserAccount | null;
  store: Store | null;
}
