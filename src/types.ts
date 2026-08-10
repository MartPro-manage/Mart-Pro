export type UserRole = 'super_admin' | 'admin' | 'cash_counter' | 'product_register';

export interface Store {
  id: string;
  name: string;
  adminUsername: string;
  adminPassword?: string;
  status?: 'active' | 'disabled';
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
  totalAmount: number;
  paymentMethod: 'cash' | 'online';
  cashReceived?: number;
  changeReturned?: number;
  receiptNumber: string;
  timestamp: string;
}

export interface AuthState {
  user: UserAccount | null;
  store: Store | null;
}
