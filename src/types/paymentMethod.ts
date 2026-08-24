export type PaymentMethodType = 'ewallet' | 'bank' | 'other';

export interface PaymentMethod {
  id: string;
  userId: string;
  type: PaymentMethodType;
  provider: string; // e.g. GCash, Maya, BDO, BPI, UnionBank, GoTyme, SeaBank, Other
  accountName: string;
  accountNumber: string;
  qrCodeUrl?: string;
  rawQrPath?: string;
  isPrimary?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddPaymentMethodParams {
  userId: string;
  type?: PaymentMethodType;
  provider: string;
  accountName: string;
  accountNumber: string;
  qrUri?: string;
  isPrimary?: boolean;
  notes?: string;
}

export interface EditPaymentMethodParams {
  type?: PaymentMethodType;
  provider?: string;
  accountName?: string;
  accountNumber?: string;
  qrUri?: string;
  removeQr?: boolean;
  isPrimary?: boolean;
  notes?: string;
}

export const POPULAR_PROVIDERS = [
  { id: 'gcash', name: 'GCash', type: 'ewallet' as PaymentMethodType, color: '#005CE6', bgColor: '#E6F0FF' },
  { id: 'maya', name: 'Maya', type: 'ewallet' as PaymentMethodType, color: '#22C55E', bgColor: '#DCFCE7' },
  { id: 'gotyme', name: 'GoTyme', type: 'bank' as PaymentMethodType, color: '#00B4D8', bgColor: '#E0F7FA' },
  { id: 'seabank', name: 'SeaBank', type: 'bank' as PaymentMethodType, color: '#F97316', bgColor: '#FFEDD5' },
  { id: 'bdo', name: 'BDO', type: 'bank' as PaymentMethodType, color: '#1E40AF', bgColor: '#DBEAFE' },
  { id: 'bpi', name: 'BPI', type: 'bank' as PaymentMethodType, color: '#DC2626', bgColor: '#FEE2E2' },
  { id: 'unionbank', name: 'UnionBank', type: 'bank' as PaymentMethodType, color: '#EA580C', bgColor: '#FFEDD5' },
  { id: 'rcbc', name: 'RCBC', type: 'bank' as PaymentMethodType, color: '#0284C7', bgColor: '#E0F2FE' },
  { id: 'other', name: 'Other Bank / E-Wallet', type: 'other' as PaymentMethodType, color: '#6B7280', bgColor: '#F3F4F6' },
];
