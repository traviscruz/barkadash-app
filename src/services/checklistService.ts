import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { ChecklistItem, ChecklistCategory, CHECKLIST_CATEGORIES } from '../types/checklistItem';
import { requestJsonRace, requestJson } from './aiStructuredService';
import { NotificationService } from './notificationService';

export class ChecklistService {
  private static instance: ChecklistService;

  public static getInstance(): ChecklistService {
    if (!ChecklistService.instance) {
      ChecklistService.instance = new ChecklistService();
    }
    return ChecklistService.instance;
  }

  /**
   * Fetch all checklist items for a trip.
   * If currentUserId is provided:
   * - Assigned items: isCompleted is controlled by the assigned member
   * - General (unassigned) items: isCompleted is evaluated individually for currentUserId
   */
  public async fetchTripChecklistDB(tripId: string, currentUserId?: string): Promise<ChecklistItem[]> {
    try {
      const { data, error } = await supabase
        .from('trip_checklist_items')
        .select(`
          id,
          trip_id,
          title,
          category,
          is_completed,
          assigned_to,
          created_by,
          created_at,
          updated_at,
          assigned_profile:assigned_to (
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('fetchTripChecklistDB error:', error.message);
        return [];
      }

      if (!data) return [];

      const itemIds = data.map((r: any) => r.id);
      const completionsMap: Record<string, string[]> = {};

      if (itemIds.length > 0) {
        try {
          const { data: compData, error: compErr } = await supabase
            .from('trip_checklist_user_completions')
            .select('item_id, user_id')
            .in('item_id', itemIds);

          if (!compErr && compData) {
            compData.forEach((c: any) => {
              if (!completionsMap[c.item_id]) completionsMap[c.item_id] = [];
              completionsMap[c.item_id].push(c.user_id);
            });
          }
        } catch (e) {
          // Table may not exist yet if user hasn't run the SQL migration
        }
      }

      // Check local storage fallback for individual general completions
      let localCompletions: string[] = [];
      if (currentUserId) {
        try {
          const raw = await AsyncStorage.getItem(`barkada_checklist_user_comp_${tripId}_${currentUserId}`);
          if (raw) localCompletions = JSON.parse(raw);
        } catch {}
      }

      return data.map((row: any) => {
        const prof = row.assigned_profile || {};
        const fn = prof.first_name || '';
        const ln = prof.last_name || '';
        const assignedToName = fn ? `${fn} ${ln}`.trim() : undefined;
        const compUsers = completionsMap[row.id] || [];

        let isCompleted = false;
        if (row.assigned_to) {
          // Assigned item: completion status belongs to the assigned member
          isCompleted = !!row.is_completed;
        } else {
          // General item: each member individually checks it off for themselves
          if (currentUserId) {
            isCompleted = compUsers.includes(currentUserId) || localCompletions.includes(row.id);
          } else {
            isCompleted = !!row.is_completed;
          }
        }

        return {
          id: row.id,
          tripId: row.trip_id,
          title: row.title,
          category: row.category || 'Essentials',
          isCompleted,
          assignedTo: row.assigned_to || undefined,
          assignedToName,
          assignedToAvatarUrl: prof.avatar_url || undefined,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          completedByUserIds: compUsers,
        };
      });
    } catch (err: any) {
      console.warn('fetchTripChecklistDB exception:', err?.message);
      return [];
    }
  }

  /**
   * Add a single checklist item
   */
  public async addChecklistItemDB(
    tripId: string,
    title: string,
    category: string,
    createdBy: string,
    assignedTo?: string | null
  ): Promise<ChecklistItem | null> {
    try {
      const { data, error } = await supabase
        .from('trip_checklist_items')
        .insert({
          trip_id: tripId,
          title: title.trim(),
          category: category.trim() || 'Essentials',
          is_completed: false,
          created_by: createdBy,
          assigned_to: assignedTo || null,
        })
        .select(`
          id,
          trip_id,
          title,
          category,
          is_completed,
          assigned_to,
          created_by,
          created_at,
          updated_at,
          assigned_profile:assigned_to (
            id,
            first_name,
            last_name,
            avatar_url
          )
        `)
        .single();

      if (error || !data) {
        console.warn('addChecklistItemDB error:', error?.message);
        return null;
      }

      const prof = (data as any).assigned_profile || {};
      const fn = prof.first_name || '';
      const ln = prof.last_name || '';
      const assignedToName = fn ? `${fn} ${ln}`.trim() : undefined;

      return {
        id: data.id,
        tripId: data.trip_id,
        title: data.title,
        category: data.category,
        isCompleted: data.is_completed,
        assignedTo: data.assigned_to || undefined,
        assignedToName,
        assignedToAvatarUrl: prof.avatar_url || undefined,
        createdBy: data.created_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        completedByUserIds: [],
      };
    } catch (err: any) {
      console.warn('addChecklistItemDB exception:', err?.message);
      return null;
    }
  }

  /**
   * Assign or unassign a checklist item to a member
   * Pass assignedTo = null or undefined to make it General (unassigned)
   */
  public async assignChecklistItemDB(
    itemId: string,
    assignedTo: string | null,
    actorId?: string,
    actorName?: string
  ): Promise<boolean> {
    try {
      const { data: itemData } = await supabase
        .from('trip_checklist_items')
        .select('trip_id, title, created_by')
        .eq('id', itemId)
        .maybeSingle();

      const { error } = await supabase
        .from('trip_checklist_items')
        .update({
          assigned_to: assignedTo || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) {
        console.warn('assignChecklistItemDB error:', error.message);
        return false;
      }

      if (assignedTo && itemData) {
        try {
          const effectiveActorId = actorId || itemData.created_by;
          let effectiveActorName = actorName;
          if (!effectiveActorName && effectiveActorId) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('first_name, last_name, username')
              .eq('id', effectiveActorId)
              .maybeSingle();
            if (prof) {
              effectiveActorName = [prof.first_name, prof.last_name].filter(Boolean).join(' ') || prof.username || 'A squad member';
            }
          }
          const { data: tripData } = await supabase
            .from('trips')
            .select('title')
            .eq('id', itemData.trip_id)
            .maybeSingle();
          const tripTitle = tripData?.title || 'Barkada Trip';

          await NotificationService.createChecklistAssignedNotification(
            effectiveActorId || '',
            effectiveActorName || 'A squad member',
            assignedTo,
            itemData.trip_id,
            tripTitle,
            itemData.title
          );
        } catch (notifErr) {
          console.warn('assignChecklistItemDB notification error:', notifErr);
        }
      }

      return true;
    } catch (err: any) {
      console.warn('assignChecklistItemDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Toggle item completed status:
   * - If item is assigned to a member: only that member can toggle it (updates `is_completed` in `trip_checklist_items`)
   * - If item is general (unassigned): toggles completion individually for currentUserId
   */
  public async toggleChecklistItemDB(
    itemOrId: ChecklistItem | string,
    isCompleted: boolean,
    currentUserId?: string
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      const isObject = typeof itemOrId === 'object' && itemOrId !== null;
      const itemId = isObject ? itemOrId.id : itemOrId;
      const assignedTo = isObject ? itemOrId.assignedTo : undefined;
      const tripId = isObject ? itemOrId.tripId : undefined;

      // 1. If assigned to a member: only that member can check it off
      if (assignedTo) {
        if (currentUserId && assignedTo !== currentUserId) {
          return { success: false, reason: 'assigned_to_other' };
        }

        const { error } = await supabase
          .from('trip_checklist_items')
          .update({
            is_completed: isCompleted,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId);

        if (error) {
          console.warn('toggleChecklistItemDB error:', error.message);
          return { success: false, reason: error.message };
        }
        return { success: true };
      }

      // 2. If General (unassigned): each member individually checks it off
      if (!currentUserId) {
        // Fallback if user ID is missing
        await supabase
          .from('trip_checklist_items')
          .update({
            is_completed: isCompleted,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId);
        return { success: true };
      }

      // Save to local AsyncStorage fallback
      if (tripId) {
        try {
          const cacheKey = `barkada_checklist_user_comp_${tripId}_${currentUserId}`;
          const raw = await AsyncStorage.getItem(cacheKey);
          let list: string[] = raw ? JSON.parse(raw) : [];
          if (isCompleted && !list.includes(itemId)) {
            list.push(itemId);
          } else if (!isCompleted) {
            list = list.filter((id) => id !== itemId);
          }
          await AsyncStorage.setItem(cacheKey, JSON.stringify(list));
        } catch {}
      }

      // Persist to trip_checklist_user_completions in Supabase
      if (isCompleted) {
        const { error } = await supabase
          .from('trip_checklist_user_completions')
          .upsert(
            { item_id: itemId, user_id: currentUserId },
            { onConflict: 'item_id,user_id' }
          );

        if (error) {
          console.warn('trip_checklist_user_completions upsert warning:', error.message);
        }
      } else {
        const { error } = await supabase
          .from('trip_checklist_user_completions')
          .delete()
          .eq('item_id', itemId)
          .eq('user_id', currentUserId);

        if (error) {
          console.warn('trip_checklist_user_completions delete warning:', error.message);
        }
      }

      return { success: true };
    } catch (err: any) {
      console.warn('toggleChecklistItemDB exception:', err?.message);
      return { success: false, reason: err?.message };
    }
  }

  /**
   * Update item title (Rename)
   */
  public async updateChecklistItemTitleDB(itemId: string, newTitle: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('trip_checklist_items')
        .update({
          title: newTitle.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) {
        console.warn('updateChecklistItemTitleDB error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('updateChecklistItemTitleDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Delete a checklist item
   */
  public async deleteChecklistItemDB(itemId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('trip_checklist_items')
        .delete()
        .eq('id', itemId);

      if (error) {
        console.warn('deleteChecklistItemDB error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('deleteChecklistItemDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Bulk insert checklist items (e.g. from AI generator)
   */
  public async batchAddChecklistItemsDB(
    tripId: string,
    items: Array<{ title: string; category: string; assignedTo?: string }>,
    createdBy: string
  ): Promise<boolean> {
    if (items.length === 0) return true;
    try {
      const rows = items.map((i) => ({
        trip_id: tripId,
        title: i.title.trim(),
        category: i.category.trim() || 'Essentials',
        is_completed: false,
        created_by: createdBy,
        assigned_to: i.assignedTo || null,
      }));

      const { error } = await supabase.from('trip_checklist_items').insert(rows);

      if (error) {
        console.warn('batchAddChecklistItemsDB error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('batchAddChecklistItemsDB exception:', err?.message);
      return false;
    }
  }

  /**
   * AI-Powered Checklist Generator
   * Generates a categorized packing list tailored to the trip's destination and vibe.
   */
  public async generateAiChecklist(
    tripTitle: string,
    destination?: string,
    customVibe?: string
  ): Promise<Array<{ title: string; category: ChecklistCategory }>> {
    const dest = destination && !destination.includes('Voting') ? destination : tripTitle;

    const systemPrompt = `You are an expert travel packing assistant for group trips in the Philippines and abroad.
Generate a practical, comprehensive packing checklist for the given trip.
Group items strictly into these valid categories:
- "Essentials"
- "Hygiene & Toiletries"
- "Clothing & Footwear"
- "Electronics"
- "Health & Meds"
- "Group & Activities"

Return pure JSON matching this structure:
{
  "items": [
    { "title": "Item name", "category": "Category name" }
  ]
}`;

    const userPrompt = `Trip Title: "${tripTitle}"
Destination / Context: "${dest}"
${customVibe ? `Preferences / Notes: "${customVibe}"` : ''}

Generate 14 to 20 well-thought-out packing checklist items.`;

    try {
      const result = await requestJsonRace<{ items: Array<{ title: string; category: string }> }>(
        systemPrompt,
        userPrompt,
        { maxTokens: 1500 }
      );

      if (result?.data?.items && Array.isArray(result.data.items) && result.data.items.length > 0) {
        return result.data.items.map((i) => ({
          title: i.title,
          category: this.normalizeCategory(i.category),
        }));
      }
    } catch (e) {
      console.warn('AI checklist race failed, falling back to template:', e);
    }

    // Built-in intelligent template fallback
    return this.getFallbackTemplate(dest);
  }

  private normalizeCategory(cat: string): ChecklistCategory {
    const lower = (cat || '').toLowerCase();
    if (lower.includes('hygiene') || lower.includes('toilet') || lower.includes('bath')) {
      return 'Hygiene & Toiletries';
    }
    if (lower.includes('cloth') || lower.includes('wear') || lower.includes('shoe')) {
      return 'Clothing & Footwear';
    }
    if (lower.includes('elec') || lower.includes('gadget') || lower.includes('charg')) {
      return 'Electronics';
    }
    if (lower.includes('health') || lower.includes('med') || lower.includes('first aid')) {
      return 'Health & Meds';
    }
    if (lower.includes('group') || lower.includes('activ') || lower.includes('fun') || lower.includes('game')) {
      return 'Group & Activities';
    }
    return 'Essentials';
  }

  private getFallbackTemplate(destination: string): Array<{ title: string; category: ChecklistCategory }> {
    const isBeach = /beach|el nido|boracay|siargao|cebu|la union|palawan|coron|zambales|panglao/i.test(destination);
    const isMountain = /sagada|baguio|pulag|hiking|mountain|batad|banaue/i.test(destination);

    const baseItems: Array<{ title: string; category: ChecklistCategory }> = [
      // Essentials
      { title: 'Valid Government IDs & Cash', category: 'Essentials' },
      { title: 'Hotel / Booking Confirmations', category: 'Essentials' },
      { title: 'Wallet, Cards & Emergency Funds', category: 'Essentials' },

      // Hygiene & Toiletries
      { title: 'Toothbrush, Toothpaste & Floss', category: 'Hygiene & Toiletries' },
      { title: 'Sunscreen / Sunblock (SPF 50+)', category: 'Hygiene & Toiletries' },
      { title: 'Deodorant & Body Wash Travel Kit', category: 'Hygiene & Toiletries' },
      { title: 'Wet Wipes & Tissue Packs', category: 'Hygiene & Toiletries' },

      // Electronics
      { title: 'High-Capacity Powerbank (10000mAh+)', category: 'Electronics' },
      { title: 'Phone Chargers & Long Cables', category: 'Electronics' },
      { title: 'Waterproof Phone Pouch', category: 'Electronics' },

      // Health & Meds
      { title: 'Biogesic / Paracetamol & Ibuprofen', category: 'Health & Meds' },
      { title: 'Diatabs / Imodium (Stomach meds)', category: 'Health & Meds' },
      { title: 'Mosquito Repellent Lotion', category: 'Health & Meds' },
      { title: 'Band-aids & Antiseptic Wipes', category: 'Health & Meds' },

      // Group & Activities
      { title: 'Portable Bluetooth Speaker', category: 'Group & Activities' },
      { title: 'Playing Cards / Board Game', category: 'Group & Activities' },
      { title: 'Road Trip Snacks & Tumblers', category: 'Group & Activities' },
    ];

    if (isBeach) {
      return [
        ...baseItems,
        { title: 'Swimwear / Rashguards', category: 'Clothing & Footwear' },
        { title: 'Quick-dry Microfiber Beach Towel', category: 'Clothing & Footwear' },
        { title: 'Sunglasses with UV Protection', category: 'Essentials' },
        { title: 'Flip-flops / Water Shoes', category: 'Clothing & Footwear' },
        { title: 'Dry Bag (10L - 20L)', category: 'Essentials' },
      ];
    }

    if (isMountain) {
      return [
        ...baseItems,
        { title: 'Fleece Jacket / Windbreaker', category: 'Clothing & Footwear' },
        { title: 'Hiking Shoes / Trail Runners', category: 'Clothing & Footwear' },
        { title: 'Warm Socks & Beanie', category: 'Clothing & Footwear' },
        { title: 'Headlamp / Flashlight', category: 'Electronics' },
        { title: 'Raincoat / Poncho', category: 'Essentials' },
      ];
    }

    return [
      ...baseItems,
      { title: '3-4 Comfortable Daily Outfits', category: 'Clothing & Footwear' },
      { title: 'Light Jacket or Hoodie', category: 'Clothing & Footwear' },
      { title: 'Comfortable Walking Shoes', category: 'Clothing & Footwear' },
      { title: 'Compact Folding Umbrella', category: 'Essentials' },
    ];
  }
}
