import { supabase } from '../utils/supabase';
import { Expense, SettleUpItem, ExpenseSettlement, ItemizedDebt } from '../types/expense';
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
 * Computes the itemized settle-up transfers ("X pays Y ₱N") with itemized debt breakdowns.
 *
 * Only "pinaluwal" expenses create debts — the payer advanced the money, so
 * the other members owe the payer their share of the cost.
 */
export const computeSettleUps = (
  expenses: Expense[],
  members: ExpenseMember[],
  settlements: ExpenseSettlement[] = []
): SettleUpItem[] => {
  if (!members.length) return [];

  // Map of settlement by expense_id + debtor_id
  const settlementByExpenseAndDebtor = new Map<string, ExpenseSettlement>();
  for (const s of settlements) {
    if (s.status === 'rejected') continue;
    for (const item of s.items || []) {
      settlementByExpenseAndDebtor.set(`${item.expenseId}_${s.payerId}`, s);
    }
  }

  // Create itemized debts for every pinaluwal expense and non-paying member
  const allDebts: ItemizedDebt[] = [];

  for (const exp of expenses) {
    if (exp.splitMode !== 'pinaluwal') continue;
    const splitCount = exp.splitCount || members.length;
    const share = Math.round((exp.amount / splitCount) * 100) / 100;
    const creditor = members.find((m) => m.id === exp.payerId);
    const creditorName = creditor?.name || exp.paidBy || 'Payer';
    const creditorId = exp.payerId || '';

    for (const debtor of members) {
      if (debtor.id === creditorId) continue; // Skip payer themselves

      const key = `${exp.id}_${debtor.id}`;
      const activeSettlement = settlementByExpenseAndDebtor.get(key);

      let status: 'unpaid' | 'pending' | 'verified' = 'unpaid';
      if (activeSettlement) {
        if (activeSettlement.status === 'verified') {
          status = 'verified';
        } else if (activeSettlement.status === 'pending') {
          status = 'pending';
        }
      }

      allDebts.push({
        id: key,
        expenseId: exp.id,
        expenseTitle: exp.title,
        category: exp.category,
        categoryIconName: exp.categoryIconName,
        categoryBg: exp.categoryBg,
        iconColor: exp.iconColor,
        date: exp.date,
        totalExpenseAmount: exp.amount,
        splitCount,
        debtorId: debtor.id,
        debtorName: debtor.name,
        creditorId,
        creditorName,
        amountOwed: share,
        status,
        settlement: activeSettlement,
      });
    }
  }

  // Group debts by (debtorId -> creditorId)
  const groupMap = new Map<string, { fromUser: string; toUser: string; fromUserId: string; toUserId: string; items: ItemizedDebt[] }>();

  for (const debt of allDebts) {
    const groupKey = `${debt.debtorId}_${debt.creditorId}`;
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        fromUser: debt.debtorName,
        toUser: debt.creditorName,
        fromUserId: debt.debtorId,
        toUserId: debt.creditorId,
        items: [],
      });
    }
    groupMap.get(groupKey)!.items.push(debt);
  }

  const result: SettleUpItem[] = [];

  groupMap.forEach((group, groupKey) => {
    const unpaidAmount = group.items
      .filter((i) => i.status === 'unpaid')
      .reduce((sum, i) => sum + i.amountOwed, 0);
    const pendingAmount = group.items
      .filter((i) => i.status === 'pending')
      .reduce((sum, i) => sum + i.amountOwed, 0);
    const verifiedAmount = group.items
      .filter((i) => i.status === 'verified')
      .reduce((sum, i) => sum + i.amountOwed, 0);

    // Outstanding active balance (unpaid + pending)
    const amount = unpaidAmount + pendingAmount;

    result.push({
      id: groupKey,
      fromUser: group.fromUser,
      toUser: group.toUser,
      fromUserId: group.fromUserId,
      toUserId: group.toUserId,
      amount: Math.round(amount),
      unpaidAmount: Math.round(unpaidAmount),
      pendingAmount: Math.round(pendingAmount),
      verifiedAmount: Math.round(verifiedAmount),
      items: group.items,
    });
  });

  return result;
};

export class ExpenseService {
  private static instance: ExpenseService;

  private expenses: Expense[] = [];
  private settlements: ExpenseSettlement[] = [];
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

  public getSettlements(): ExpenseSettlement[] {
    return [...this.settlements];
  }

  public async fetchExpensesDB(tripId: string): Promise<Expense[]> {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, expense_photos (storage_path), profiles!expenses_payer_id_fkey (first_name, last_name)')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (error) throw error;

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

  public async fetchSettlementsDB(tripId: string): Promise<ExpenseSettlement[]> {
    try {
      const { data, error } = await supabase
        .from('expense_settlements')
        .select(`
          *,
          payer:profiles!expense_settlements_payer_id_fkey (first_name, last_name),
          payee:profiles!expense_settlements_payee_id_fkey (first_name, last_name),
          expense_settlement_items (
            id,
            settlement_id,
            expense_id,
            amount,
            created_at,
            expenses (title)
          )
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.settlements = (data || []).map((row: any) => {
        const payerObj = row.payer || {};
        const payeeObj = row.payee || {};
        const payerName = [payerObj.first_name, payerObj.last_name].filter(Boolean).join(' ').trim() || 'Debtor';
        const payeeName = [payeeObj.first_name, payeeObj.last_name].filter(Boolean).join(' ').trim() || 'Creditor';

        const items = (row.expense_settlement_items || []).map((it: any) => ({
          id: it.id,
          settlementId: it.settlement_id,
          expenseId: it.expense_id,
          amount: Number(it.amount) || 0,
          createdAt: it.created_at,
          expenseTitle: it.expenses?.title || 'Expense',
        }));

        return {
          id: row.id,
          tripId: row.trip_id,
          payerId: row.payer_id,
          payeeId: row.payee_id,
          payerName,
          payeeName,
          amount: Number(row.amount) || 0,
          proofUrl: row.proof_url ? (row.proof_url.startsWith('http') ? row.proof_url : receiptPublicUrl(row.proof_url)) : undefined,
          rawProofPath: row.proof_url || undefined,
          notes: row.notes || undefined,
          status: row.status || 'pending',
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          verifiedAt: row.verified_at,
          items,
        };
      });

      this.notify();
      return this.settlements;
    } catch (e) {
      console.warn('fetchSettlementsDB error:', e);
      this.settlements = [];
      this.notify();
      return [];
    }
  }

  public async addSettlementDB(params: {
    tripId: string;
    payerId: string;
    payeeId: string;
    amount: number;
    proofUri?: string;
    notes?: string;
    items: { expenseId: string; amount: number }[];
  }): Promise<ExpenseSettlement | null> {
    let uploadedPath: string | undefined;
    if (params.proofUri) {
      const uploaded = await uploadExpensePhotos([params.proofUri]);
      uploadedPath = uploaded[0]?.path;
    }

    try {
      const { data, error } = await supabase
        .from('expense_settlements')
        .insert({
          trip_id: params.tripId,
          payer_id: params.payerId,
          payee_id: params.payeeId,
          amount: params.amount,
          proof_url: uploadedPath || null,
          notes: params.notes || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      if (params.items.length) {
        const itemRows = params.items.map((it) => ({
          settlement_id: data.id,
          expense_id: it.expenseId,
          amount: it.amount,
        }));
        const { error: itemsError } = await supabase.from('expense_settlement_items').insert(itemRows);
        if (itemsError) throw itemsError;
      }

      await this.fetchSettlementsDB(params.tripId);
      return this.settlements.find((s) => s.id === data.id) || null;
    } catch (e) {
      console.warn('addSettlementDB error:', e);
      if (uploadedPath) {
        await deleteExpensePhotos([uploadedPath]);
      }
      return null;
    }
  }

  public async editSettlementDB(
    settlementId: string,
    tripId: string,
    params: {
      proofUri?: string;
      notes?: string;
      removePhoto?: boolean;
    }
  ): Promise<boolean> {
    let newPath: string | undefined;
    if (params.proofUri) {
      const uploaded = await uploadExpensePhotos([params.proofUri]);
      newPath = uploaded[0]?.path;
    }

    try {
      const existing = this.settlements.find((s) => s.id === settlementId);
      const updates: any = {
        updated_at: new Date().toISOString(),
      };
      if (params.notes !== undefined) {
        updates.notes = params.notes || null;
      }
      if (newPath) {
        updates.proof_url = newPath;
      } else if (params.removePhoto) {
        updates.proof_url = null;
      }

      const { error } = await supabase
        .from('expense_settlements')
        .update(updates)
        .eq('id', settlementId);

      if (error) throw error;

      const oldPhoto = existing?.rawProofPath || existing?.proofUrl;
      if ((newPath || params.removePhoto) && oldPhoto) {
        await deleteExpensePhotos([oldPhoto]);
      }

      await this.fetchSettlementsDB(tripId);
      return true;
    } catch (e) {
      console.warn('editSettlementDB error:', e);
      if (newPath) {
        await deleteExpensePhotos([newPath]);
      }
      return false;
    }
  }

  public async deleteSettlementDB(settlementId: string, tripId: string): Promise<boolean> {
    const existing = this.settlements.find((s) => s.id === settlementId);
    const rawPhotoPath = existing?.rawProofPath;
    console.log('[deleteSettlementDB] id:', settlementId, 'rawPhotoPath:', rawPhotoPath);

    try {
      // 1. Delete the parent settlement row — CASCADE will delete settlement_items too
      const { error } = await supabase
        .from('expense_settlements')
        .delete()
        .eq('id', settlementId);

      if (error) {
        console.warn('[deleteSettlementDB] DB delete error:', JSON.stringify(error));
        throw error;
      }

      console.log('[deleteSettlementDB] DB delete OK');

      // 2. Remove proof photo from storage AFTER successful DB delete
      if (rawPhotoPath) {
        await deleteExpensePhotos([rawPhotoPath]);
        console.log('[deleteSettlementDB] storage delete sent for path:', rawPhotoPath);
      }

      // 3. Update local cache immediately
      this.settlements = this.settlements.filter((s) => s.id !== settlementId);
      this.notify();

      // 4. Re-sync with DB
      await this.fetchSettlementsDB(tripId);
      return true;
    } catch (e) {
      console.warn('[deleteSettlementDB] error:', e);
      return false;
    }
  }

  public async verifySettlementDB(settlementId: string, tripId: string, status: 'verified' | 'rejected' = 'verified'): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('expense_settlements')
        .update({
          status,
          verified_at: status === 'verified' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settlementId);

      if (error) throw error;

      await this.fetchSettlementsDB(tripId);
      return true;
    } catch (e) {
      console.warn('verifySettlementDB error:', e);
      return false;
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
