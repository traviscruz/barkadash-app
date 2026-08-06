export interface Expense {
  id: string;
  title: string;
  paidBy: string;
  payerAvatar: string;
  amount: number;
  splitDetails: string;
  category: string;
  categoryIconName: string;
  categoryBg: string;
  iconColor: string;
  date: string;
  receiptImagePath?: any;
  isPinaluwal?: boolean;
  notes?: string;
}

export interface SettleUpItem {
  id: string;
  fromUser: string;
  toUser: string;
  amount: number;
}
