export type UserRole = 'super_admin' | 'admin' | 'cash_counter' | 'product_register';

export interface Store {
  id: string;
  name: string;
  adminUsername: string;
  adminPassword?: string;
  status?: 'active' | 'disabled';
  cameraScannerEnabled?: boolean; // Super admin can enable/disable inbuilt barcode camera for each store
  voiceAnnouncementEnabled?: boolean; // Super admin can allow/disallow audio voice generation for each store
  createdAt: string;
}

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
  serialNumber?: string;
  name: string;
  category: string;
  price: number;
  stockQuantity: number;
  minStockLevel?: number;
  weight?: string; // e.g. 1 kg, 500 g, 250 ml
  updatedAt: string;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  totalPrice: number;
}

export interface SaleItem {
  productId: string;
  barcode: string;
  serialNumber?: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
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
