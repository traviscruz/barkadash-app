import { Expense, SettleUpItem } from '../types/expense';

export class ExpenseService {
  private static instance: ExpenseService;

  private expenses: Expense[] = [
    {
      id: 'e1',
      title: 'Habal-habal rental',
      paidBy: 'Steven',
      payerAvatar: 'S',
      amount: 1500,
      splitDetails: 'Steven · split 5 ways',
      category: 'Transport',
      categoryIconName: 'bike',
      categoryBg: '#FDEBD3',
      iconColor: '#B8791E',
      date: 'Today, 10:15 AM',
      notes: 'Roundtrip transfer to Nacpan Twin Beach',
    },
    {
      id: 'e2',
      title: 'Airbnb Beachfront, 3 nights',
      paidBy: 'Harry',
      payerAvatar: 'H',
      amount: 9600,
      splitDetails: 'Harry · split 5 ways',
      category: 'Stay',
      categoryIconName: 'home',
      categoryBg: '#E4F0EA',
      iconColor: '#3A8E71',
      date: 'Yesterday, 4:00 PM',
      notes: 'Full accommodation payment including wifi',
    },
    {
      id: 'e3',
      title: 'Island Hopping Tour A Boat',
      paidBy: 'Ahiah',
      payerAvatar: 'A',
      amount: 4800,
      splitDetails: 'Ahiah · split 4 ways',
      category: 'Activities',
      categoryIconName: 'sail',
      categoryBg: '#E4F0F4',
      iconColor: '#3B7A9E',
      date: 'Yesterday, 11:30 AM',
      notes: 'Includes environmental fee & kayaks',
    },
    {
      id: 'e4',
      title: 'Grocery & Drinks Run',
      paidBy: 'Travis',
      payerAvatar: 'T',
      amount: 2500,
      splitDetails: 'Travis · split 5 ways (Advance)',
      category: 'Groceries',
      categoryIconName: 'shopping-bag',
      categoryBg: '#FBE7E1',
      iconColor: '#E2604A',
      date: '2 days ago',
      isPinaluwal: true,
      notes: 'Snacks, water, ice, and grilling supplies',
    },
  ];

  private settleUps: SettleUpItem[] = [];
  private listeners: (() => void)[] = [];

  private constructor() {
    this.recalculateSettleUps();
  }

  public static getInstance(): ExpenseService {
    if (!ExpenseService.instance) {
      ExpenseService.instance = new ExpenseService();
    }
    return ExpenseService.instance;
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  public getExpenses(): Expense[] {
    return [...this.expenses];
  }

  public getSettleUps(): SettleUpItem[] {
    return [...this.settleUps];
  }

  public addExpense(params: {
    title: string;
    amount: number;
    paidBy: string;
    category: string;
    isPinaluwal: boolean;
    notes?: string;
  }) {
    let categoryIconName = 'receipt';
    let categoryBg = '#F0ECE3';
    let iconColor = '#6E738A';

    switch (params.category.toLowerCase()) {
      case 'food':
      case 'dining':
        categoryIconName = 'utensils';
        categoryBg = '#FDEBD3';
        iconColor = '#F0A93E';
        break;
      case 'stay':
      case 'hotel':
        categoryIconName = 'home';
        categoryBg = '#E4F0EA';
        iconColor = '#3A8E71';
        break;
      case 'activities':
      case 'tours':
        categoryIconName = 'compass';
        categoryBg = '#E4F0F4';
        iconColor = '#3B7A9E';
        break;
      case 'groceries':
        categoryIconName = 'shopping-bag';
        categoryBg = '#FBE7E1';
        iconColor = '#E2604A';
        break;
      case 'transport':
      case 'commute':
        categoryIconName = 'car';
        categoryBg = '#FDEBD3';
        iconColor = '#B8791E';
        break;
    }

    const newExpense: Expense = {
      id: `e_${Date.now()}`,
      title: params.title,
      paidBy: params.paidBy,
      payerAvatar: params.paidBy.substring(0, 1).toUpperCase(),
      amount: params.amount,
      splitDetails: `${params.paidBy} · split 5 ways${params.isPinaluwal ? ' (Pinaluwal)' : ''}`,
      category: params.category,
      categoryIconName,
      categoryBg,
      iconColor,
      date: 'Just now',
      isPinaluwal: params.isPinaluwal,
      notes: params.notes,
    };

    this.expenses = [newExpense, ...this.expenses];
    this.recalculateSettleUps();
    this.notify();
  }

  public editExpense(id: string, params: { title: string; amount: number; notes?: string }) {
    this.expenses = this.expenses.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          title: params.title,
          amount: params.amount,
          notes: params.notes ?? item.notes,
        };
      }
      return item;
    });
    this.recalculateSettleUps();
    this.notify();
  }

  private recalculateSettleUps() {
    const balances: Record<string, number> = {
      Steven: 0,
      Harry: 0,
      Ahiah: 0,
      Travis: 0,
      Me: 0,
    };

    const members = Object.keys(balances);
    const count = members.length;

    for (const exp of this.expenses) {
      const share = exp.amount / count;
      for (const m of members) {
        if (m === exp.paidBy) {
          balances[m] += exp.amount - share;
        } else {
          balances[m] -= share;
        }
      }
    }

    const debtors = members
      .filter((m) => balances[m] < -0.01)
      .map((m) => ({ name: m, debt: Math.abs(balances[m]) }));
    const creditors = members
      .filter((m) => balances[m] > 0.01)
      .map((m) => ({ name: m, credit: balances[m] }));

    const items: SettleUpItem[] = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const settled = Math.min(d.debt, c.credit);

      if (settled > 1) {
        items.push({
          id: `s_${i}_${j}`,
          fromUser: d.name,
          toUser: c.name,
          amount: Math.round(settled),
        });
      }

      d.debt -= settled;
      c.credit -= settled;

      if (d.debt <= 1) i++;
      if (c.credit <= 1) j++;
    }

    this.settleUps = items;
  }
}
