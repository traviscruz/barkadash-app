import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { uploadExpensePhotos, deleteExpensePhotos, receiptPublicUrl } from './storageService';
import { PaymentMethod, AddPaymentMethodParams, EditPaymentMethodParams } from '../types/paymentMethod';

const CACHE_KEY_PREFIX = 'barkadash_user_payment_methods_';

export class PaymentMethodService {
  private static instance: PaymentMethodService;
  private cache: Map<string, PaymentMethod[]> = new Map();

  private constructor() {}

  public static getInstance(): PaymentMethodService {
    if (!PaymentMethodService.instance) {
      PaymentMethodService.instance = new PaymentMethodService();
    }
    return PaymentMethodService.instance;
  }

  private getCacheKey(userId: string): string {
    return `${CACHE_KEY_PREFIX}${userId}`;
  }

  private async loadFromLocalStorage(userId: string): Promise<PaymentMethod[]> {
    try {
      const raw = await AsyncStorage.getItem(this.getCacheKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.warn('loadFromLocalStorage paymentMethods error:', e);
    }
    return [];
  }

  private async saveToLocalStorage(userId: string, methods: PaymentMethod[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.getCacheKey(userId), JSON.stringify(methods));
    } catch (e) {
      console.warn('saveToLocalStorage paymentMethods error:', e);
    }
  }

  public async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    if (!userId) return [];

    // Check in-memory cache first
    if (this.cache.has(userId) && (this.cache.get(userId)?.length || 0) > 0) {
      // Background re-fetch to keep up to date
      this.fetchFromSupabase(userId).catch(() => {});
      return this.cache.get(userId)!;
    }

    // Try fetching from Supabase
    try {
      const remote = await this.fetchFromSupabase(userId);
      if (remote && remote.length > 0) {
        return remote;
      }
    } catch (e) {
      console.warn('getPaymentMethods remote fetch failed, falling back to local storage:', e);
    }

    // Fallback to local storage
    const local = await this.loadFromLocalStorage(userId);
    this.cache.set(userId, local);
    return local;
  }

  public async fetchFromSupabase(userId: string): Promise<PaymentMethod[]> {
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('user_payment_methods')
        .select('*')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        // If table doesn't exist yet, return local cache
        console.warn('user_payment_methods table query notice:', error.message);
        const local = await this.loadFromLocalStorage(userId);
        this.cache.set(userId, local);
        return local;
      }

      const methods: PaymentMethod[] = (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        type: row.type || 'ewallet',
        provider: row.provider,
        accountName: row.account_name,
        accountNumber: row.account_number,
        qrCodeUrl: row.qr_code_url ? receiptPublicUrl(row.qr_code_url) : undefined,
        rawQrPath: row.qr_code_url || undefined,
        isPrimary: !!row.is_primary,
        notes: row.notes || undefined,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
      }));

      this.cache.set(userId, methods);
      await this.saveToLocalStorage(userId, methods);
      return methods;
    } catch (err) {
      console.warn('fetchFromSupabase catch error:', err);
      const local = await this.loadFromLocalStorage(userId);
      this.cache.set(userId, local);
      return local;
    }
  }

  public async addPaymentMethod(params: AddPaymentMethodParams): Promise<PaymentMethod | null> {
    const { userId, provider, accountName, accountNumber, qrUri, isPrimary, notes, type = 'ewallet' } = params;
    if (!userId || !provider || !accountNumber) return null;

    let uploadedQrPath: string | undefined;
    let uploadedQrUrl: string | undefined;

    if (qrUri) {
      const uploaded = await uploadExpensePhotos([qrUri], userId);
      if (uploaded.length > 0) {
        uploadedQrPath = uploaded[0].path;
        uploadedQrUrl = uploaded[0].url;
      }
    }

    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `pm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const now = new Date().toISOString();

    const newMethod: PaymentMethod = {
      id: newId,
      userId,
      type,
      provider: provider.trim(),
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
      qrCodeUrl: uploadedQrUrl,
      rawQrPath: uploadedQrPath,
      isPrimary: !!isPrimary,
      notes: notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    // If isPrimary, unset other primary methods
    let currentMethods = await this.loadFromLocalStorage(userId);
    if (isPrimary) {
      currentMethods = currentMethods.map((m) => ({ ...m, isPrimary: false }));
    }
    currentMethods = [newMethod, ...currentMethods];
    this.cache.set(userId, currentMethods);
    await this.saveToLocalStorage(userId, currentMethods);

    // Sync to Supabase
    try {
      const dbRow = {
        id: newId,
        user_id: userId,
        type,
        provider: newMethod.provider,
        account_name: newMethod.accountName,
        account_number: newMethod.accountNumber,
        qr_code_url: uploadedQrPath || null,
        is_primary: !!isPrimary,
        notes: newMethod.notes || null,
        created_at: now,
        updated_at: now,
      };

      if (isPrimary) {
        await supabase
          .from('user_payment_methods')
          .update({ is_primary: false })
          .eq('user_id', userId);
      }

      const { error } = await supabase.from('user_payment_methods').insert(dbRow);
      if (error) {
        console.warn('Supabase insert user_payment_methods error:', error.message);
      }
    } catch (e) {
      console.warn('addPaymentMethod Supabase catch error:', e);
    }

    return newMethod;
  }

  public async editPaymentMethod(
    id: string,
    userId: string,
    params: EditPaymentMethodParams
  ): Promise<boolean> {
    let currentMethods = await this.loadFromLocalStorage(userId);
    const index = currentMethods.findIndex((m) => m.id === id);
    if (index === -1) return false;

    const existing = currentMethods[index];
    let newQrPath = existing.rawQrPath;
    let newQrUrl = existing.qrCodeUrl;

    if (params.qrUri) {
      const uploaded = await uploadExpensePhotos([params.qrUri], userId);
      if (uploaded.length > 0) {
        newQrPath = uploaded[0].path;
        newQrUrl = uploaded[0].url;
      }
    } else if (params.removeQr) {
      newQrPath = undefined;
      newQrUrl = undefined;
    }

    const now = new Date().toISOString();
    const updatedMethod: PaymentMethod = {
      ...existing,
      type: params.type !== undefined ? params.type : existing.type,
      provider: params.provider !== undefined ? params.provider.trim() : existing.provider,
      accountName: params.accountName !== undefined ? params.accountName.trim() : existing.accountName,
      accountNumber: params.accountNumber !== undefined ? params.accountNumber.trim() : existing.accountNumber,
      qrCodeUrl: newQrUrl,
      rawQrPath: newQrPath,
      isPrimary: params.isPrimary !== undefined ? params.isPrimary : existing.isPrimary,
      notes: params.notes !== undefined ? params.notes.trim() || undefined : existing.notes,
      updatedAt: now,
    };

    if (params.isPrimary) {
      currentMethods = currentMethods.map((m) => ({ ...m, isPrimary: m.id === id }));
    }
    currentMethods[index] = updatedMethod;

    this.cache.set(userId, currentMethods);
    await this.saveToLocalStorage(userId, currentMethods);

    // Clean up old QR code if replaced
    if ((params.qrUri || params.removeQr) && existing.rawQrPath && existing.rawQrPath !== newQrPath) {
      deleteExpensePhotos([existing.rawQrPath]).catch(() => {});
    }

    // Sync to Supabase
    try {
      const updates: any = {
        updated_at: now,
      };
      if (params.type !== undefined) updates.type = params.type;
      if (params.provider !== undefined) updates.provider = updatedMethod.provider;
      if (params.accountName !== undefined) updates.account_name = updatedMethod.accountName;
      if (params.accountNumber !== undefined) updates.account_number = updatedMethod.accountNumber;
      if (params.qrUri !== undefined || params.removeQr) updates.qr_code_url = newQrPath || null;
      if (params.isPrimary !== undefined) updates.is_primary = params.isPrimary;
      if (params.notes !== undefined) updates.notes = updatedMethod.notes || null;

      if (params.isPrimary) {
        await supabase
          .from('user_payment_methods')
          .update({ is_primary: false })
          .eq('user_id', userId);
      }

      await supabase
        .from('user_payment_methods')
        .update(updates)
        .eq('id', id);
    } catch (e) {
      console.warn('editPaymentMethod Supabase catch error:', e);
    }

    return true;
  }

  public async deletePaymentMethod(id: string, userId: string, rawQrPath?: string): Promise<boolean> {
    let currentMethods = await this.loadFromLocalStorage(userId);
    currentMethods = currentMethods.filter((m) => m.id !== id);

    this.cache.set(userId, currentMethods);
    await this.saveToLocalStorage(userId, currentMethods);

    if (rawQrPath) {
      deleteExpensePhotos([rawQrPath]).catch(() => {});
    }

    try {
      await supabase
        .from('user_payment_methods')
        .delete()
        .eq('id', id);
    } catch (e) {
      console.warn('deletePaymentMethod Supabase catch error:', e);
    }

    return true;
  }
}
