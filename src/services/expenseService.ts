import { supabase } from '../utils/supabase';
import { Expense, SettleUpItem } from '../types/expense';
import { uploadExpensePhotos, deleteExpensePhotos, receiptPublicUrl } from './storageService';

export interface ExpenseMember {
  id: string;
  name: string;
}

/**
 * Payer label shown on cards & details:
 *   · split     → "Barkada" (everyone shared it, uploader just recorded it)
 *   · pinaluwal / solo → the actual payer (the member who advanced / treated)
 */
export const payerDisplayName = (exp: Expense, members: ExpenseMember[]): string => {
  if (exp.splitMode === 'split') return 'Barkada';
  const m = members.find((mm) => mm.id === exp.payerId);
  return m?.name ?? exp.paidBy ?? 'You';
};

const CATEGORY_META: Record<string, { iconName: string; bg: string; color: string }> = {
  food: { iconName: 'utensils', bg: '#FDEBD3', color: '#F0A93E' },
  dining: { iconName: 'utensils', bg: '#FDEBD3', color: '#F0A93E' },
  stay: { iconName: 'home', bg: '#E4F0EA', color: '#3A8E71' },
  hotel: { iconName: 'home', bg: '#E4F0EA', color: '#3A8E71' },
  activities: { iconName: 'compass', bg: '#E4F0F4', color: '#3B7A9E' },
  tours: { iconName: 'compass', bg: '#E4F0F4', color: '#3B7A9E' },
  groceries: { iconName: 'shopping-bag', bg: '#FBE7E1', color: '#E2604A' },
  transport: { iconName: 'car', bg: '#FDEBD3', color: '#B8791E' },
  commute: { iconName: 'car', bg: '#FDEBD3', color: '#B8791E' },
  general: { iconName: 'receipt', bg: '#F0ECE3', color: '#6E738A' },
};

const formatExpenseDate = (ts?: string): string => {
  if (!ts) return 'Just now';
  const d = new Date(ts);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days === 0) {
    const h = d.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    const hh = ((h + 11) % 12) + 1;
    return `Today, ${hh}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
  }
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface ExpenseRow {
  id: string;
  trip_id: string;
  payer_id: string;
  created_by?: string | null;
  title: string;
  amount: number;
  category: string;
  split_mode: string;
  split_count: number;
  notes?: string | null;
  created_at?: string;
  expense_photos?: { storage_path: string }[];
  profiles?: { first_name?: string; last_name?: string }[];
}

const mapExpenseRow = (row: ExpenseRow): Expense => {
  const payer = row.profiles?.[0] || {};
  const payerName = [payer.first_name, payer.last_name].filter(Boolean).join(' ').trim() || 'Barkada';
  const splitMode = (row.split_mode as Expense['splitMode']) || 'split';
  const isPinaluwal = splitMode === 'pinaluwal';
  const splitCount = Number(row.split_count) || 1;
  const paths = (row.expense_photos || []).map((p) => p.storage_path);
  const meta = CATEGORY_META[(row.category || 'general').toLowerCase()] || CATEGORY_META.general;

  return {
    id: row.id,
    tripId: row.trip_id,
    title: row.title,
    paidBy: payerName,
    payerId: row.payer_id,
    createdBy: row.created_by || row.payer_id,
    payerAvatar: payerName.substring(0, 1).toUpperCase(),
    amount: Number(row.amount) || 0,
    splitDetails:
      splitMode === 'solo' ? `${payerName} · not split` : `${payerName} · split ${splitCount} ways`,
    category: row.category || 'General',
    categoryIconName: meta.iconName,
    categoryBg: meta.bg,
    iconColor: meta.color,
    date: formatExpenseDate(row.created_at),
    receiptPaths: paths,
    receiptPhotos: paths.map(receiptPublicUrl),
    isPinaluwal,
    splitMode,
    splitCount,
    notes: row.notes || undefined,
  };
};

/**
 * Computes the minimal settle-up transfers ("X pays Y ₱N") for a group.
 *
 * Only "pinaluwal" expenses create debts — the payer advanced the money, so
 * the other members owe the payer their share of the cost.
 *
 *   · split     → everyone already paid their share; the uploader is just
 *                 recording it, so no one owes anything.
 *   · pinaluwal → the payer is owed `share` by every other member.
 *   · solo      → it's a treat; no one owes anything.
 */
export const computeSettleUps = (expenses: Expense[], memberNames: string[]): SettleUpItem[] => {
  if (!memberNames.length) return [];

  const balances: Record<string, number> = {};
  memberNames.forEach((m) => (balances[m] = 0));

  for (const exp of expenses) {
    if (exp.splitMode !== 'pinaluwal') continue;
    const share = exp.amount / (exp.splitCount || memberNames.length);
    for (const m of memberNames) {
      if (m === exp.paidBy) balances[m] += exp.amount - share;
      else balances[m] -= share;
    }
  }

  const debtors = memberNames
    .filter((m) => balances[m] < -0.01)
    .map((m) => ({ name: m, debt: Math.abs(balances[m]) }));
  const creditors = memberNames
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

  return items;
};

export class ExpenseService {
  private static instance: ExpenseService;

  private expenses: Expense[] = [];
  private listeners: (() => void)[] = [];

  private constructor() {}

  public static getInstance(): ExpenseService {
    if (!ExpenseService.instance) {
      ExpenseService.instance = new ExpenseService();
    }
    return ExpenseService.instance;
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public getExpenses(): Expense[] {
    return [...this.expenses];
  }

  public async fetchExpensesDB(tripId: string): Promise<Expense[]> {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, expense_photos (storage_path), profiles!expenses_payer_id_fkey (first_name, last_name)')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });      if (error) throw error;

      this.expenses = (data || []).map((row: ExpenseRow) => mapExpenseRow(row));
      this.notify();
      return this.expenses;
    } catch (e) {
      console.warn('fetchExpensesDB error:', e);
      this.expenses = [];
      this.notify();
      return [];
    }
  }

  public async addExpenseDB(params: {
    tripId: string;
    title: string;
    amount: number;
    payerId: string;
    paidBy: string;
    createdBy?: string;
    category: string;
    splitMode?: 'split' | 'pinaluwal' | 'solo';
    splitCount?: number;
    notes?: string;
    photos?: string[];
  }): Promise<Expense | null> {
    const uploaded = await uploadExpensePhotos(params.photos || []);
    const splitMode = params.splitMode || 'split';
    const splitCount = params.splitCount || 1;

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          trip_id: params.tripId,
          payer_id: params.payerId,
          created_by: params.createdBy || params.payerId,
          title: params.title,
          amount: params.amount,
          category: params.category,
          split_mode: splitMode,
          split_count: splitCount,
          notes: params.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      if (uploaded.length) {
        const { error: photoError } = await supabase.from('expense_photos').insert(
          uploaded.map((u) => ({ expense_id: data.id, storage_path: u.path }))
        );
        if (photoError) throw photoError;
      }

      // Roll the amount up into the trip's spent_amount (best-effort).
      try {
        const { data: trip } = await supabase
          .from('trips')
          .select('spent_amount')
          .eq('id', params.tripId)
          .maybeSingle();
        const next = Number(trip?.spent_amount || 0) + params.amount;
        await supabase.from('trips').update({ spent_amount: next }).eq('id', params.tripId);
      } catch (e) {
        console.warn('update trip spent_amount error:', e);
      }

      const newExpense = mapExpenseRow({
        id: data.id,
        trip_id: data.trip_id,
        payer_id: data.payer_id,
        created_by: data.created_by || params.createdBy || params.payerId,
        title: data.title,
        amount: data.amount,
        category: data.category,
        split_mode: data.split_mode,
        split_count: data.split_count,
        notes: data.notes,
        created_at: data.created_at,
        expense_photos: uploaded.map((u) => ({ storage_path: u.path })),
        profiles: [{ first_name: params.paidBy, last_name: '' }],
      });

      this.expenses = [newExpense, ...this.expenses.filter((e) => e.id !== newExpense.id)];
      this.notify();
      return newExpense;
    } catch (e) {
      console.warn('addExpenseDB error:', e);
      await deleteExpensePhotos(uploaded.map((u) => u.path));
      return null;
    }
  }

  public async editExpenseDB(
    id: string,
    params: {
      title: string;
      amount: number;
      category: string;
      splitMode?: 'split' | 'pinaluwal' | 'solo';
      splitCount?: number;
      notes?: string;
      addPhotoUris?: string[];
      removePhotoPaths?: string[];
    }
  ): Promise<boolean> {
    const uploaded = await uploadExpensePhotos(params.addPhotoUris || []);
    const splitMode = params.splitMode || 'split';

    try {
      const { error } = await supabase
        .from('expenses')
        .update({
          title: params.title,
          amount: params.amount,
          category: params.category,
          split_mode: splitMode,
          split_count: params.splitCount || 1,
          notes: params.notes || null,
        })
        .eq('id', id);
      if (error) throw error;

      const removePaths = params.removePhotoPaths || [];
      if (removePaths.length) {
        await supabase.from('expense_photos').delete().in('storage_path', removePaths);
        await deleteExpensePhotos(removePaths);
      }

      if (uploaded.length) {
        const { error: photoError } = await supabase.from('expense_photos').insert(
          uploaded.map((u) => ({ expense_id: id, storage_path: u.path }))
        );
        if (photoError) throw photoError;
      }

      // Roll the amount difference up into the trip's spent_amount (best-effort).
      const old = this.expenses.find((e) => e.id === id);
      if (old?.tripId) {
        try {
          const { data: trip } = await supabase
            .from('trips')
            .select('spent_amount')
            .eq('id', old.tripId)
            .maybeSingle();
          const next = Number(trip?.spent_amount || 0) - old.amount + params.amount;
          await supabase.from('trips').update({ spent_amount: next }).eq('id', old.tripId);
        } catch (e) {
          console.warn('update trip spent_amount error:', e);
        }
      }

      // Refresh from DB so photo metadata stays consistent.
      if (old?.tripId) {
        await this.fetchExpensesDB(old.tripId);
      } else {
        this.expenses = this.expenses.map((e) =>
          e.id === id
            ? { ...e, title: params.title, amount: params.amount, category: params.category, splitMode, notes: params.notes }
            : e
        );
        this.notify();
      }
      return true;
    } catch (e) {
      console.warn('editExpenseDB error:', e);
      await deleteExpensePhotos(uploaded.map((u) => u.path));
      return false;
    }
  }

  public async deleteExpenseDB(id: string): Promise<boolean> {
    const target = this.expenses.find((e) => e.id === id);
    if (target?.receiptPaths?.length) {
      await deleteExpensePhotos(target.receiptPaths);
    }

    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;

      this.expenses = this.expenses.filter((e) => e.id !== id);
      this.notify();
      return true;
    } catch (e) {
      console.warn('deleteExpenseDB error:', e);
      return false;
    }
  }
}
