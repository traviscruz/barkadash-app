export interface Expense {
  id: string;
  tripId?: string;
  title: string;
  paidBy: string;
  payerId?: string;
  createdBy?: string;
  payerAvatar: string;
  amount: number;
  splitDetails: string;
  category: string;
  categoryIconName: string;
  categoryBg: string;
  iconColor: string;
  date: string;
  receiptImagePath?: any;
  receiptPhotos?: string[];
  receiptPaths?: string[];
  isPinaluwal?: boolean;
  splitMode?: 'split' | 'pinaluwal' | 'solo';
  splitCount?: number;
  notes?: string;
}

export interface SettleUpItem {
  id: string;
  fromUser: string;
  toUser: string;
  amount: number;
}
