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

export interface ExpenseSettlementItem {
  id: string;
  settlementId: string;
  expenseId: string;
  amount: number;
  createdAt?: string;
  expenseTitle?: string;
}

export interface ExpenseSettlement {
  id: string;
  tripId: string;
  payerId: string;
  payeeId: string;
  payerName?: string;
  payeeName?: string;
  amount: number;
  proofUrl?: string;
  rawProofPath?: string;
  notes?: string;
  status: 'pending' | 'verified' | 'rejected';
  createdAt: string;
  updatedAt?: string;
  verifiedAt?: string;
  items?: ExpenseSettlementItem[];
}

export interface ItemizedDebt {
  id: string; // unique key e.g. `${expenseId}_${debtorId}`
  expenseId: string;
  expenseTitle: string;
  category: string;
  categoryIconName: string;
  categoryBg: string;
  iconColor: string;
  date: string;
  totalExpenseAmount: number;
  splitCount: number;
  debtorId: string;
  debtorName: string;
  creditorId: string;
  creditorName: string;
  amountOwed: number;
  status: 'unpaid' | 'pending' | 'verified';
  settlement?: ExpenseSettlement;
}

export interface SettleUpItem {
  id: string;
  fromUser: string;
  toUser: string;
  fromUserId?: string;
  toUserId?: string;
  amount: number;
  unpaidAmount: number;
  pendingAmount: number;
  verifiedAmount: number;
  items: ItemizedDebt[];
}
