import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { TripService } from '../../services/tripService';
import { ChecklistService } from '../../services/checklistService';
import { ChecklistItem, ChecklistCategory, CHECKLIST_CATEGORIES } from '../../types/checklistItem';
import { supabase } from '../../utils/supabase';
import {
  ChevronLeft,
  Check,
  Trash2,
  X,
  Layers,
  CheckSquare,
  Package,
  FileText,
  CornerDownLeft,
  Tag,
  RefreshCw,
} from 'lucide-react-native';

interface PackingChecklistScreenProps {
  onBack: () => void;
  tripId?: string;
}

const VIBE_PRESETS = [
  'Beach & Island',
  'Mountain & Hiking',
  'City Sightseeing',
  'Road Trip',
  'Staycation',
];

export const PackingChecklistScreen: React.FC<PackingChecklistScreenProps> = ({
  onBack,
  tripId: propTripId,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();

  const [trip, setTrip] = useState<any>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Category filter / target category for new items
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isAutoTagging, setIsAutoTagging] = useState(false);

  // Inline rename state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  // Inline Notes Input State
  const [inputText, setInputText] = useState('');
  const [isSavingLine, setIsSavingLine] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Auto-Fill / Pre-Fill Modal State
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState('');
  const [generating, setGenerating] = useState(false);
  const [previewItems, setPreviewItems] = useState<Array<{ title: string; category: ChecklistCategory }>>([]);
  const [importing, setImporting] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToastMessage(null));
  };

  const isTripEnded = trip ? TripService.getInstance().isTripEnded(trip) : false;

  const loadData = useCallback(async () => {
    const active = TripService.getInstance().getActiveTrip();
    const targetTripId = propTripId || active?.id;
    if (!targetTripId) {
      setLoading(false);
      return;
    }
    setTrip(active);

    try {
      const data = await ChecklistService.getInstance().fetchTripChecklistDB(targetTripId);
      setItems(data);
    } catch (e) {
      console.warn('Error fetching checklist items:', e);
    } finally {
      setLoading(false);
    }
  }, [propTripId]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Toggle item completed status
  const handleToggleItem = async (item: ChecklistItem) => {
    if (isTripEnded) return;
    const nextVal = !item.isCompleted;
    // Instant optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isCompleted: nextVal } : i))
    );

    if (item.id.startsWith('temp-')) {
      return;
    }

    try {
      await ChecklistService.getInstance().toggleChecklistItemDB(item.id, nextVal);
    } catch (e) {
      console.warn('Error toggling item:', e);
    }
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    if (isTripEnded) return;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    await ChecklistService.getInstance().deleteChecklistItemDB(itemId);
  };

  // Start inline rename on word tap
  const handleStartRename = (item: ChecklistItem) => {
    if (isTripEnded) return;
    setEditingItemId(item.id);
    setEditingTitle(item.title);
  };

  // Save renamed item
  const handleSaveRename = async (itemId: string) => {
    if (isTripEnded) return;
    const trimmed = editingTitle.trim();
    setEditingItemId(null);
    if (!trimmed) return;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, title: trimmed } : i))
    );

    if (itemId.startsWith('temp-')) return;

    try {
      await ChecklistService.getInstance().updateChecklistItemTitleDB(itemId, trimmed);
    } catch (e) {
      console.warn('Error saving renamed item:', e);
    }
  };

  // Helper to intelligently infer category based on item title
  const inferCategory = (text: string): ChecklistCategory => {
    const lower = text.toLowerCase();
    if (
      lower.includes('swim') ||
      lower.includes('shirt') ||
      lower.includes('pant') ||
      lower.includes('short') ||
      lower.includes('dress') ||
      lower.includes('jacket') ||
      lower.includes('sock') ||
      lower.includes('undies') ||
      lower.includes('towel') ||
      lower.includes('shoe') ||
      lower.includes('slipper') ||
      lower.includes('sandals') ||
      lower.includes('hoodie') ||
      lower.includes('cap') ||
      lower.includes('hat') ||
      lower.includes('outfit')
    ) {
      return 'Clothing & Footwear';
    }
    if (
      lower.includes('soap') ||
      lower.includes('shampoo') ||
      lower.includes('brush') ||
      lower.includes('paste') ||
      lower.includes('sunblock') ||
      lower.includes('sunscreen') ||
      lower.includes('lotion') ||
      lower.includes('perfume') ||
      lower.includes('deodorant') ||
      lower.includes('skincare') ||
      lower.includes('conditioner') ||
      lower.includes('tissue') ||
      lower.includes('wipes')
    ) {
      return 'Hygiene & Toiletries';
    }
    if (
      lower.includes('phone') ||
      lower.includes('charg') ||
      lower.includes('powerbank') ||
      lower.includes('cable') ||
      lower.includes('camera') ||
      lower.includes('earphone') ||
      lower.includes('headphone') ||
      lower.includes('adapter') ||
      lower.includes('gopro') ||
      lower.includes('laptop') ||
      lower.includes('ipad') ||
      lower.includes('extension')
    ) {
      return 'Electronics';
    }
    if (
      lower.includes('biogesic') ||
      lower.includes('med') ||
      lower.includes('pill') ||
      lower.includes('band aid') ||
      lower.includes('vitamins') ||
      lower.includes('paracetamol') ||
      lower.includes('dolfenal') ||
      lower.includes('bonamine') ||
      lower.includes('first aid') ||
      lower.includes('antihistamine') ||
      lower.includes('inhaler') ||
      lower.includes('spray')
    ) {
      return 'Health & Meds';
    }
    if (
      lower.includes('card') ||
      lower.includes('game') ||
      lower.includes('speaker') ||
      lower.includes('snack') ||
      lower.includes('liquor') ||
      lower.includes('beer') ||
      lower.includes('tent') ||
      lower.includes('cooler') ||
      lower.includes('mat') ||
      lower.includes('snorkeling') ||
      lower.includes('ball') ||
      lower.includes('goggles')
    ) {
      return 'Group & Activities';
    }
    if (
      lower.includes('id') ||
      lower.includes('passport') ||
      lower.includes('cash') ||
      lower.includes('wallet') ||
      lower.includes('ticket') ||
      lower.includes('booking') ||
      lower.includes('key') ||
      lower.includes('license') ||
      lower.includes('insurance')
    ) {
      return 'Essentials';
    }
    return 'Essentials';
  };

  // Auto-tag / Categorize existing items
  const handleAutoTagCategories = async () => {
    if (isTripEnded || items.length === 0) return;
    setIsAutoTagging(true);

    const updatedItems = items.map((i) => ({
      ...i,
      category: inferCategory(i.title),
    }));
    setItems(updatedItems);

    try {
      await Promise.all(
        updatedItems.map((item) =>
          supabase
            .from('trip_checklist_items')
            .update({ category: item.category, updated_at: new Date().toISOString() })
            .eq('id', item.id)
        )
      );
      showToast('All items auto-categorized!');
    } catch (e) {
      console.warn('Auto-tag error:', e);
    } finally {
      setIsAutoTagging(false);
    }
  };

  /**
   * Fast Notes App Style Return Key Insertion:
   * When user presses Return, instantly inserts the item into the DB and stays focused on the new line!
   * Also supports pasting multi-line items.
   */
  const handleReturnPress = async () => {
    if (isTripEnded) return;
    const rawText = inputText.trim();
    if (!rawText || !profile?.id) return;
    const targetTripId = propTripId || trip?.id;
    if (!targetTripId) return;

    // Check if user pasted multi-line text (e.g. multiple lines copied)
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*•\d.)\]\s]+/, '').trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setInputText('');
      return;
    }

    // Clear input immediately so user sees the new blank line ready
    setInputText('');
    setIsSavingLine(true);

    if (lines.length === 1) {
      const singleTitle = lines[0];
      const category = selectedCategory !== 'All' ? (selectedCategory as ChecklistCategory) : inferCategory(singleTitle);

      // Optimistic item
      const tempId = 'temp-' + Date.now();
      const optimisticItem: ChecklistItem = {
        id: tempId,
        tripId: targetTripId,
        title: singleTitle,
        category,
        isCompleted: false,
        createdBy: profile.id,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [...prev, optimisticItem]);

      try {
        const created = await ChecklistService.getInstance().addChecklistItemDB(
          targetTripId,
          singleTitle,
          category,
          profile.id
        );
        if (created) {
          setItems((prev) => prev.map((i) => (i.id === tempId ? created : i)));
        }
      } catch (e) {
        console.warn('Error adding checklist note line:', e);
      } finally {
        setIsSavingLine(false);
      }
    } else {
      // Multi-line batch insert
      const batchItems = lines.map((l) => ({
        title: l,
        category: selectedCategory !== 'All' ? (selectedCategory as ChecklistCategory) : inferCategory(l),
      }));

      // Optimistic update
      const optimisticBatch: ChecklistItem[] = batchItems.map((b, idx) => ({
        id: `temp-${Date.now()}-${idx}`,
        tripId: targetTripId,
        title: b.title,
        category: b.category,
        isCompleted: false,
        createdBy: profile.id,
        createdAt: new Date().toISOString(),
      }));
      setItems((prev) => [...prev, ...optimisticBatch]);

      try {
        await ChecklistService.getInstance().batchAddChecklistItemsDB(
          targetTripId,
          batchItems,
          profile.id
        );
        // Refresh with real IDs
        const updated = await ChecklistService.getInstance().fetchTripChecklistDB(targetTripId);
        setItems(updated);
        showToast(`${lines.length} items added`);
      } catch (e) {
        console.warn('Error batch adding lines:', e);
      } finally {
        setIsSavingLine(false);
      }
    }
  };

  // Pre-fill / Auto-Generate Trigger
  const handleRunGenerator = async (vibeOverride?: string) => {
    if (isTripEnded) return;
    const targetTripId = propTripId || trip?.id;
    if (!targetTripId) return;

    setGenerating(true);
    const chosenVibe = vibeOverride || selectedVibe;

    try {
      const generated = await ChecklistService.getInstance().generateAiChecklist(
        trip?.title || 'Trip',
        trip?.destination,
        chosenVibe
      );
      setPreviewItems(generated);
    } catch (e) {
      console.warn('Generator error:', e);
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenAutoFill = () => {
    if (isTripEnded) return;
    setIsAutoModalOpen(true);
    if (previewItems.length === 0) {
      handleRunGenerator();
    }
  };

  const handleImportItems = async () => {
    if (isTripEnded || previewItems.length === 0 || !profile?.id) return;
    const targetTripId = propTripId || trip?.id;
    if (!targetTripId) return;

    setImporting(true);
    try {
      await ChecklistService.getInstance().batchAddChecklistItemsDB(
        targetTripId,
        previewItems,
        profile.id
      );
      await loadData();
      setIsAutoModalOpen(false);
      setPreviewItems([]);
      setSelectedVibe('');
      showToast(`${previewItems.length} items added to list`);
    } catch (e) {
      console.warn('Import items error:', e);
    } finally {
      setImporting(false);
    }
  };

  // Stats
  const totalCount = items.length;
  const completedCount = items.filter((i) => i.isCompleted).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Filter items
  const filteredItems = items.filter((item) => {
    if (selectedCategory === 'All') return true;
    return item.category === selectedCategory;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]} edges={['top']}>
      {/* Toast Notification */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: isDark ? colors.card : '#0F2A3C',
              borderColor: isDark ? colors.cardBorder : 'rgba(255,255,255,0.1)',
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Screen Header (Extended cleanly to top edge like commitment screen) */}
      <View style={[styles.header, { borderBottomColor: colors.cardBorder, backgroundColor: colors.paper }]}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.ink }]}>Packing Checklist</Text>
          <Text style={[styles.headerSubtitle, { color: colors.inkSoft }]} numberOfLines={1}>
            {trip?.destination || trip?.title ? (trip.destination || trip.title).toUpperCase() : 'TRIP PACKING LIST'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleRefresh}
          style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          activeOpacity={0.7}
        >
          <RefreshCw size={16} color={colors.inkSoft} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.tealDark}
              colors={[colors.tealDark]}
            />
          }
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.tealDark} />
              <Text style={{ fontSize: 12, color: colors.inkSoft, marginTop: 8 }}>Loading packing checklist…</Text>
            </View>
          ) : (
            <>
              {/* Progress Summary Card */}
              <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={styles.progressCardTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: progressPercent === 100 ? '#F0A93E' : colors.tealDark,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={14} color="#FFFFFF" strokeWidth={2.8} />
                    </View>
                    <View>
                      <Text style={[styles.progressCardLabel, { color: colors.inkSoft }]}>PACKING PROGRESS</Text>
                      <Text style={[styles.progressCardValue, { color: colors.ink }]}>
                        {completedCount} of {totalCount} Packed
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.progressPercentPill,
                      {
                        backgroundColor: progressPercent === 100 ? 'rgba(240,169,62,0.18)' : colors.subtleBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.progressPercentText,
                        { color: progressPercent === 100 ? '#F0A93E' : colors.tealDark },
                      ]}
                    >
                      {progressPercent}%
                    </Text>
                  </View>
                </View>

                <View style={[styles.progressTrack, { backgroundColor: colors.subtleBg }]}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${progressPercent}%`,
                        backgroundColor: progressPercent === 100 ? '#F0A93E' : colors.tealDark,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Action Toolbar: Single Auto-Generate Button + Auto-Tag Categories Button */}
              {!isTripEnded ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  {/* Single Auto-Generate Button Above List */}
                  <TouchableOpacity
                    onPress={handleOpenAutoFill}
                    activeOpacity={0.8}
                    style={[
                      styles.primaryActionBtn,
                      { backgroundColor: colors.tealDark },
                    ]}
                  >
                    <Layers size={14} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={styles.primaryActionBtnText}>Auto-Generate List</Text>
                  </TouchableOpacity>

                  {/* Auto-Tag Categories Button */}
                  <TouchableOpacity
                    onPress={handleAutoTagCategories}
                    disabled={isAutoTagging || items.length === 0}
                    activeOpacity={0.75}
                    style={[
                      styles.secondaryActionBtn,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder,
                        opacity: items.length > 0 ? 1 : 0.5,
                      },
                    ]}
                  >
                    {isAutoTagging ? (
                      <ActivityIndicator size="small" color={colors.tealDark} />
                    ) : (
                      <>
                        <Tag size={13} color={colors.tealDark} strokeWidth={2.2} />
                        <Text style={[styles.secondaryActionBtnText, { color: colors.tealDark }]}>Auto-Tag</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, backgroundColor: isDark ? 'rgba(59,122,158,0.12)' : '#F0FDF4', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: isDark ? 'rgba(59,122,158,0.25)' : '#BBF7D0' }}>
                  <Check size={13} color="#10B981" strokeWidth={2.6} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.ink }}>
                    Trip Ended · Checklist is in read-only mode
                  </Text>
                </View>
              )}

              {/* Category Filter Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={{ paddingRight: 10 }}
              >
                <TouchableOpacity
                  onPress={() => setSelectedCategory('All')}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: selectedCategory === 'All' ? colors.tealDark : colors.card,
                      borderColor: selectedCategory === 'All' ? colors.tealDark : colors.cardBorder,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      {
                        color: selectedCategory === 'All' ? '#FFFFFF' : colors.inkSoft,
                        fontWeight: selectedCategory === 'All' ? '800' : '600',
                      },
                    ]}
                  >
                    All ({items.length})
                  </Text>
                </TouchableOpacity>

                {CHECKLIST_CATEGORIES.map((cat) => {
                  const count = items.filter((i) => i.category === cat).length;
                  const isSelected = selectedCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setSelectedCategory(cat)}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: isSelected ? colors.tealDark : colors.card,
                          borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          {
                            color: isSelected ? '#FFFFFF' : colors.inkSoft,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {cat} {count > 0 ? `(${count})` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* THE LONG NOTES NOTEPAD PAPER SHEET */}
              <View
                style={[
                  styles.longNotepadCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                {/* Red Margin Guide (Apple Notes Notepad Rule) */}
                <View
                  style={[
                    styles.notepadMarginLine,
                    { backgroundColor: isDark ? 'rgba(240,169,62,0.18)' : 'rgba(239,68,68,0.18)' },
                  ]}
                />

                {/* Notepad Top Header Strip */}
                <View style={[styles.notepadTopBar, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: colors.tealDark, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    {selectedCategory === 'All' ? 'Packing Items' : `${selectedCategory}`}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.inkSoft }}>
                    {isTripEnded ? 'Read-only' : 'Type on line & press Return ↵'}
                  </Text>
                </View>

                {/* Ruled Checklist Lines */}
                {filteredItems.map((item) => {
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.noteLineRow,
                        { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2F6' },
                      ]}
                    >
                      {/* Signature Yellow Checkbox Button */}
                      <TouchableOpacity
                        onPress={() => handleToggleItem(item)}
                        disabled={isTripEnded}
                        style={[
                          styles.noteCheckbox,
                          {
                            backgroundColor: item.isCompleted ? '#F0A93E' : 'transparent',
                            borderColor: item.isCompleted ? '#F0A93E' : (isDark ? 'rgba(255,255,255,0.25)' : '#CBD5E1'),
                            opacity: isTripEnded ? 0.75 : 1,
                          },
                        ]}
                        activeOpacity={0.7}
                      >
                        {item.isCompleted && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                      </TouchableOpacity>

                      {/* Title Text (Tap word to rename) or Inline Rename Input */}
                      {editingItemId === item.id && !isTripEnded ? (
                        <TextInput
                          value={editingTitle}
                          onChangeText={setEditingTitle}
                          onSubmitEditing={() => handleSaveRename(item.id)}
                          onBlur={() => handleSaveRename(item.id)}
                          autoFocus
                          returnKeyType="done"
                          style={[
                            styles.noteLineInput,
                            {
                              color: colors.ink,
                              fontWeight: '600',
                              paddingVertical: 2,
                            },
                          ]}
                        />
                      ) : (
                        <TouchableOpacity
                          onPress={isTripEnded ? undefined : () => handleStartRename(item)}
                          style={{ flex: 1, paddingVertical: 4 }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.noteItemTitle,
                              {
                                color: item.isCompleted ? colors.inkSoft : colors.ink,
                                textDecorationLine: item.isCompleted ? 'line-through' : 'none',
                                opacity: item.isCompleted ? 0.55 : 1,
                              },
                            ]}
                          >
                            {item.title}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Category Tag Badge */}
                      {selectedCategory === 'All' && item.category && (
                        <View style={[styles.miniCatBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.subtleBg }]}>
                          <Text style={[styles.miniCatText, { color: colors.inkSoft }]} numberOfLines={1}>
                            {item.category}
                          </Text>
                        </View>
                      )}

                      {/* Delete Action */}
                      {!isTripEnded && (
                        <TouchableOpacity
                          onPress={() => handleDeleteItem(item.id)}
                          style={styles.noteDeleteBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.6}
                        >
                          <Trash2 size={13} color={colors.inkSoft} />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                {/* ACTIVE NEW ENTRY LINE (Continuous Return-to-Add) */}
                {!isTripEnded ? (
                  <View
                    style={[
                      styles.activeNoteLine,
                      { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2F6' },
                    ]}
                  >
                    <View
                      style={[
                        styles.noteCheckbox,
                        {
                          borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1',
                          borderStyle: 'dashed',
                        },
                      ]}
                    />

                    <TextInput
                      ref={inputRef}
                      value={inputText}
                      onChangeText={setInputText}
                      onSubmitEditing={handleReturnPress}
                      blurOnSubmit={false}
                      returnKeyType="done"
                      placeholder={
                        selectedCategory === 'All'
                          ? 'Add item (press Return)...'
                          : `Add to ${selectedCategory} (press Return)...`
                      }
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8'}
                      style={[
                        styles.noteLineInput,
                        {
                          color: colors.ink,
                        },
                      ]}
                    />

                    {inputText.trim().length > 0 && (
                      <TouchableOpacity
                        onPress={handleReturnPress}
                        style={[styles.returnSendBtn, { backgroundColor: '#F0A93E' }]}
                        activeOpacity={0.8}
                      >
                        {isSavingLine ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <CornerDownLeft size={13} color="#FFFFFF" strokeWidth={2.4} />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft }}>
                      Checklist is read-only because this trip has ended
                    </Text>
                  </View>
                )}

                {/* Extended blank ruled lines to give long notepad feel */}
                {Array.from({ length: Math.max(6, 12 - filteredItems.length) }).map((_, idx) => (
                  <View
                    key={`blank-line-${idx}`}
                    style={[
                      styles.emptyNoteLine,
                      { borderBottomColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC' },
                    ]}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FIXED BACKDROP AUTO-GENERATE MODAL (Non-swiping backdrop) */}
      <Modal
        visible={isAutoModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAutoModalOpen(false)}
      >
        <View style={styles.fixedModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsAutoModalOpen(false)}
          />

          <View
            style={[
              styles.centeredModalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: isDark ? 'rgba(240,169,62,0.18)' : '#FEF6E7',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Layers size={16} color="#F0A93E" strokeWidth={2.4} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.ink }]}>Auto-Generate Packing List</Text>
                  <Text style={{ fontSize: 11, color: colors.inkSoft, marginTop: 1 }}>
                    Tailored for {trip?.destination || trip?.title || 'your trip'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setIsAutoModalOpen(false)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: colors.subtleBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={16} color={colors.inkSoft} />
              </TouchableOpacity>
            </View>

            {/* Vibe Selection Chips */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Select Trip Vibe:
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {VIBE_PRESETS.map((vibe) => {
                  const isSelected = selectedVibe === vibe;
                  return (
                    <TouchableOpacity
                      key={vibe}
                      onPress={() => {
                        setSelectedVibe(vibe);
                        handleRunGenerator(vibe);
                      }}
                      style={[
                        styles.vibePresetChip,
                        {
                          backgroundColor: isSelected ? colors.tealDark : colors.subtleBg,
                          borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.vibePresetText,
                          { color: isSelected ? '#FFFFFF' : colors.inkSoft },
                        ]}
                      >
                        {vibe}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Generated Items Preview List */}
            <View style={styles.aiPreviewSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={[styles.modalLabel, { color: colors.inkSoft }]}>
                  {generating ? 'BUILDING RECOMMENDATIONS…' : `PROPOSED ITEMS (${previewItems.length})`}
                </Text>
                {!generating && (
                  <TouchableOpacity onPress={() => handleRunGenerator()}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.tealDark }}>Refresh ↺</Text>
                  </TouchableOpacity>
                )}
              </View>

              {generating ? (
                <View style={styles.aiLoadingBox}>
                  <ActivityIndicator size="small" color={colors.tealDark} />
                  <Text style={[styles.aiLoadingText, { color: colors.inkSoft }]}>
                    Gathering smart packing recommendations…
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.aiPreviewList} showsVerticalScrollIndicator={false}>
                  {previewItems.map((item, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.aiPreviewRow,
                        { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2F6' },
                      ]}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.aiPreviewTitle, { color: colors.ink }]}>{item.title}</Text>
                        <Text style={[styles.aiPreviewCat, { color: '#F0A93E' }]}>{item.category}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setPreviewItems((prev) => prev.filter((_, i) => i !== idx))}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X size={14} color={colors.inkSoft} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Modal Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => setIsAutoModalOpen(false)}
                style={[styles.modalSecondaryBtn, { backgroundColor: colors.subtleBg }]}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.inkSoft }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleImportItems}
                disabled={importing || generating || previewItems.length === 0}
                style={[
                  styles.modalActionBtn,
                  {
                    backgroundColor: colors.tealDark,
                    opacity: previewItems.length > 0 ? 1 : 0.5,
                    flex: 1.6,
                  },
                ]}
                activeOpacity={0.85}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalActionBtnText}>
                    Add {previewItems.length} Items
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  progressCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressCardLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  progressCardValue: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 1,
  },
  progressPercentPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 100,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '900',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },

  /* Action Buttons Toolbar */
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },

  categoryScroll: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 100,
    borderWidth: 1,
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: 11.5,
  },

  /* LONG NOTES NOTEPAD STYLING */
  longNotepadCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 480,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  notepadMarginLine: {
    position: 'absolute',
    left: 42,
    top: 0,
    bottom: 0,
    width: 1.5,
  },
  notepadTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 2,
  },
  noteLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 15,
  },
  noteCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
    paddingLeft: 3,
  },
  miniCatBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 90,
  },
  miniCatText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  noteDeleteBtn: {
    padding: 4,
  },

  /* Active Return-To-Add Line */
  activeNoteLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    gap: 15,
  },
  noteLineInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 4,
    paddingLeft: 3,
  },
  returnSendBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyNoteLine: {
    height: 38,
    borderBottomWidth: 1,
  },

  /* PROPER FIXED BACKDROP MODAL */
  fixedModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centeredModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 15.5,
    fontWeight: '900',
  },
  modalLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  vibePresetChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 100,
    borderWidth: 1,
    marginRight: 6,
  },
  vibePresetText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  aiPreviewSection: {
    marginTop: 4,
  },
  aiLoadingBox: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  aiLoadingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  aiPreviewList: {
    maxHeight: 220,
  },
  aiPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  aiPreviewTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  aiPreviewCat: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 1,
  },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtn: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  toast: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
