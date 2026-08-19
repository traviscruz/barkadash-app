import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image as RNImage,
  Animated,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExpenseService, computeSettleUps, payerDisplayName, ExpenseMember } from '../../services/expenseService';
import { TripService } from '../../services/tripService';
import { Expense } from '../../types/expense';
import { supabase } from '../../utils/supabase';
import { useUser } from '../../context/UserContext';
import { AddExpenseModal } from '../../components/expenses/AddExpenseModal';
import { EditExpenseModal } from '../../components/expenses/EditExpenseModal';
import { ScanReceiptModal } from '../../components/expenses/ScanReceiptModal';
import { ExpenseDetailsDialog } from '../../components/expenses/ExpenseDetailsDialog';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import {
  Plus,
  ScanLine,
  Menu,
  Utensils,
  Home,
  Compass,
  ShoppingBag,
  Car,
  Receipt,
  ChevronRight,
  ArrowRight,
  Inbox,
  Wallet,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { formatCurrency } from '../../utils/formatters';

const CATEGORY_FILTERS = ['All', 'Food', 'Stay', 'Transport', 'Activities', 'Groceries', 'General'];

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  utensils: Utensils,
  food: Utensils,
  dining: Utensils,
  home: Home,
  stay: Home,
  hotel: Home,
  compass: Compass,
  activities: Compass,
  tours: Compass,
  sail: Compass,
  'shopping-bag': ShoppingBag,
  groceries: ShoppingBag,
  car: Car,
  transport: Car,
  commute: Car,
  bike: Car,
  receipt: Receipt,
  general: Receipt,
};

const iconFor = (exp: Expense) =>
  CATEGORY_ICONS[exp.categoryIconName] || CATEGORY_ICONS[exp.category.toLowerCase()] || Receipt;

const PAYER_COLORS: Record<string, string> = {
  Steven: '#EA4335',
  Harry: '#F59E0B',
  Ahiah: '#34A853',
  Travis: '#0171F8',
  Me: '#8B5CF6',
};

const BouncyReveal: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      reveal.setValue(0);
      Animated.spring(reveal, {
        toValue: 1,
        bounciness: 10,
        speed: 16,
        useNativeDriver: true,
      }).start();
    }, delay);
    return () => clearTimeout(t);
  }, [reveal, delay]);

  return (
    <Animated.View
      style={{
        opacity: reveal,
        transform: [
          { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};

interface ExpenseLedgerScreenProps {
  onScrollDirection?: (direction: 'up' | 'down') => void;
  onOpenCabinet?: () => void;
}

export const ExpenseLedgerScreen: React.FC<ExpenseLedgerScreenProps> = ({ onScrollDirection, onOpenCabinet }) => {
  const { colors, isDark } = useTheme();
  const { sp, fs, icon, bottomNavOffset } = useResponsive();
  const { profile } = useUser();
  const myId = profile?.id;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<ExpenseMember[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | undefined>();
  const [tripTitle, setTripTitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [settleFilter, setSettleFilter] = useState<'mine' | 'all'>('mine');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [previewExpense, setPreviewExpense] = useState<Expense | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);

  const lastOffsetY = useRef(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const trip = TripService.getInstance().getActiveTrip();
      const tripId = trip?.id;
      if (!active) return;
      setActiveTripId(tripId);
      setTripTitle(trip?.title ?? '');

      if (!tripId) {
        setExpenses([]);
        setMembers([]);
        return;
      }

      const [exps, parts] = await Promise.all([
        ExpenseService.getInstance().fetchExpensesDB(tripId),
        TripService.getInstance().fetchTripParticipantsDB(tripId),
      ]);
      if (!active) return;
      setExpenses(exps);
      setMembers(
        parts.filter((p) => p.status === 'accepted').map((p) => ({ id: p.id, name: p.name }))
      );
    };

    load();
    const unsubTrip = TripService.getInstance().subscribe(load);
    const unsubExp = ExpenseService.getInstance().subscribe(() => {
      setExpenses(ExpenseService.getInstance().getExpenses());
    });

    return () => {
      active = false;
      unsubTrip();
      unsubExp();
    };
  }, []);

  // Realtime: refresh when another member adds/changes expenses in this trip.
  useEffect(() => {
    if (!activeTripId) return;
    const channel = supabase
      .channel(`realtime:expenses:${activeTripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses', filter: `trip_id=eq.${activeTripId}` },
        () => {
          ExpenseService.getInstance().fetchExpensesDB(activeTripId).then(setExpenses);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTripId]);

  const filteredExpenses = expenses.filter((exp) => {
    if (selectedCategory === 'All') return true;
    return exp.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  const memberNames = members.map((m) => m.name);
  const myName = members.find((m) => m.id === myId)?.name ?? 'Me';

  const expensesWithPayer = expenses.map((exp) => ({
    ...exp,
    paidBy: payerDisplayName(exp, members),
  }));
  const settleUps = computeSettleUps(expensesWithPayer, memberNames);
  const payerLabel = (exp: Expense) => payerDisplayName(exp, members);

  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const youOwed = settleUps.filter((s) => s.toUser === myName).reduce((sum, s) => sum + s.amount, 0);
  const youOwe = settleUps.filter((s) => s.fromUser === myName).reduce((sum, s) => sum + s.amount, 0);

  const visibleSettleUps =
    settleFilter === 'all' ? settleUps : settleUps.filter((s) => s.fromUser === myName || s.toUser === myName);

  const photoUrisFor = (exp: Expense) => [
    ...(exp.receiptPhotos?.filter(Boolean) ?? []),
    ...(exp.receiptImagePath ? [exp.receiptImagePath] : []),
  ];

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setDeletingExpense(true);
    await ExpenseService.getInstance().deleteExpenseDB(expenseToDelete.id);
    setDeletingExpense(false);
    setExpenseToDelete(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      <View style={{ flex: 1, paddingHorizontal: sp.lg, paddingTop: sp.sm }}>
        {/* App Logo & Hamburger */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: sp.md }}>
          <TouchableOpacity
            onPress={onOpenCabinet}
            activeOpacity={0.7}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
            }}
          >
            <Menu size={22} color={colors.ink} strokeWidth={2.2} />
          </TouchableOpacity>
          <BarkadashLogo height={32} />
        </View>

        {/* Header */}
        <View style={{ marginBottom: sp.lg }}>
          <Text style={{ fontSize: fs.xxl, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>
            Ledger
          </Text>
          <Text style={{ fontSize: fs.xs, color: colors.inkSoft, marginTop: 1 }}>
            {tripTitle ? `${tripTitle} · expenses & settlements` : 'Shared expenses & settlements'}
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={{ flexDirection: 'row', gap: sp.sm, marginBottom: sp.lg }}>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.85}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: sp.xs,
              backgroundColor: colors.tealDark,
              paddingVertical: sp.sm + 2,
              borderRadius: 14,
            }}
          >
            <Plus size={icon.sm} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={{ color: '#FFFFFF', fontSize: fs.sm, fontWeight: '800' }}>Add Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setScanModalVisible(true)}
            activeOpacity={0.85}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: sp.xs,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              paddingVertical: sp.sm + 2,
              borderRadius: 14,
            }}
          >
            <ScanLine size={icon.sm} color={colors.tealDark} strokeWidth={2.5} />
            <Text style={{ color: colors.ink, fontSize: fs.sm, fontWeight: '800' }}>Scan Receipt</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            const currentY = e.nativeEvent.contentOffset.y;
            const delta = currentY - lastOffsetY.current;
            lastOffsetY.current = currentY;

            if (currentY < 15) {
              onScrollDirection?.('up');
            } else if (delta > 2) {
              onScrollDirection?.('down');
            } else if (delta < -2) {
              onScrollDirection?.('up');
            }
          }}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: bottomNavOffset }}
        >
          {/* Summary */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              padding: sp.lg,
              marginBottom: sp.lg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: sp.xs }}>
              <Wallet size={14} color={colors.tealDark} />
              <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: colors.inkSoft, letterSpacing: 1 }}>
                Total Spent
              </Text>
            </View>
            <Text style={{ fontSize: fs.xxxl, fontWeight: '900', color: colors.ink, letterSpacing: -1 }}>
              {formatCurrency(totalSpent)}
            </Text>
            <Text style={{ fontSize: fs.xs, color: colors.inkSoft, marginTop: 2 }}>
              {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'} across all categories
            </Text>

            <View
              style={{
                flexDirection: 'row',
                marginTop: sp.md,
                paddingTop: sp.md,
                borderTopWidth: 1,
                borderTopColor: colors.cardBorder,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: colors.emerald, letterSpacing: 0.5 }}>
                  You're owed
                </Text>
                <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.emerald, marginTop: 2 }}>
                  {formatCurrency(youOwed)}
                </Text>
              </View>
              <View style={{ width: 1, backgroundColor: colors.cardBorder, marginHorizontal: sp.md }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: colors.redAccent, letterSpacing: 0.5 }}>
                  You owe
                </Text>
                <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.redAccent, marginTop: 2 }}>
                  {formatCurrency(youOwe)}
                </Text>
              </View>
            </View>
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: sp.md }}>
            <View style={{ flexDirection: 'row', gap: sp.xs }}>
              {CATEGORY_FILTERS.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    activeOpacity={0.8}
                    style={{
                      paddingHorizontal: sp.md,
                      paddingVertical: sp.xs + 2,
                      borderRadius: 100,
                      borderWidth: 1,
                      backgroundColor: isSelected ? colors.tealDark : colors.card,
                      borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fs.xs,
                        fontWeight: '800',
                        color: isSelected ? '#FFFFFF' : colors.ink,
                      }}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* List Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp.sm }}>
            <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.ink, letterSpacing: -0.3 }}>
              {selectedCategory === 'All' ? 'Expenses' : selectedCategory}
            </Text>
            <Text style={{ fontSize: fs.xs, color: colors.inkSoft, fontWeight: '600' }}>
              {filteredExpenses.length} {filteredExpenses.length === 1 ? 'item' : 'items'}
            </Text>
          </View>

          {filteredExpenses.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                borderStyle: 'dashed',
                paddingVertical: sp.xxl,
                alignItems: 'center',
                gap: sp.sm,
                marginBottom: sp.xxl,
              }}
            >
              <Inbox size={28} color={colors.inkSoft} />
              <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>
                {!activeTripId
                  ? 'No active trip'
                  : `No expenses ${selectedCategory !== 'All' ? `in ${selectedCategory}` : 'yet'}`}
              </Text>
              <Text style={{ fontSize: fs.xs, color: colors.inkSoft, textAlign: 'center', paddingHorizontal: sp.lg }}>
                {!activeTripId
                  ? 'Select an active trip first so we know where to track the expenses.'
                  : selectedCategory !== 'All'
                  ? 'Try another category, or add a new expense.'
                  : 'Add your first expense or scan a receipt to get started.'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: sp.sm, marginBottom: sp.xxl }}>
              {filteredExpenses.map((exp, idx) => {
                const IconComponent = iconFor(exp);
                const photos = photoUrisFor(exp);
                const splitCount = exp.splitCount ?? 5;
                const share = exp.amount / splitCount;
                const isSolo = exp.splitMode === 'solo';

                const metaText = isSolo
                  ? `${payerLabel(exp)} · not split`
                  : `${payerLabel(exp)} · ${splitCount}-way · ${formatCurrency(share)} each`;

                return (
                  <BouncyReveal key={exp.id} delay={Math.min(idx, 8) * 60}>
                    <View
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setPreviewExpense(exp)}
                        style={{
                          padding: sp.md,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: sp.sm,
                          paddingRight: exp.createdBy === myId ? 78 : sp.md,
                        }}
                      >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 15,
                          backgroundColor: exp.categoryBg || colors.paperDim,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconComponent size={22} color={exp.iconColor || colors.tealDark} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          numberOfLines={1}
                          style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink, letterSpacing: -0.2 }}
                        >
                          {exp.title}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                          <View
                            style={{
                              width: 17,
                              height: 17,
                              borderRadius: 9,
                              backgroundColor: PAYER_COLORS[payerLabel(exp)] || '#6E738A',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ fontSize: 8, fontWeight: '900', color: '#FFFFFF' }}>{payerLabel(exp).substring(0, 1).toUpperCase()}</Text>
                          </View>
                          <Text
                            numberOfLines={1}
                            style={{ flex: 1, fontSize: fs.xs, color: colors.inkSoft, fontWeight: '600' }}
                          >
                            {metaText}
                          </Text>
                        </View>
                        {photos.length > 0 && (
                          <View style={{ flexDirection: 'row', gap: 5, marginTop: 7 }}>
                            {photos.slice(0, 3).map((uri, i) => (
                              <RNImage
                                key={i}
                                source={{ uri }}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 7,
                                  borderWidth: 1,
                                  borderColor: colors.cardBorder,
                                  backgroundColor: colors.paperDim,
                                }}
                              />
                            ))}
                            {photos.length > 3 && (
                              <View
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 7,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: colors.paperDim,
                                }}
                              >
                                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.inkSoft }}>+{photos.length - 3}</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                      </TouchableOpacity>

                      <View
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          bottom: 8,
                          right: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <Text style={{ fontSize: fs.sm, fontWeight: '900', color: colors.ink }}>
                          {formatCurrency(exp.amount)}
                        </Text>
                        <ChevronRight size={15} color={colors.inkSoft} />
                      </View>

                      {exp.createdBy === myId && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            flexDirection: 'row',
                            gap: 6,
                            zIndex: 3,
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => setEditExpense(exp)}
                            hitSlop={8}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(255,255,255,0.95)',
                              borderWidth: 1,
                              borderColor: colors.cardBorder,
                            }}
                          >
                            <Pencil size={13} color={colors.tealDark} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setExpenseToDelete(exp)}
                            hitSlop={8}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(255,255,255,0.95)',
                              borderWidth: 1,
                              borderColor: colors.cardBorder,
                            }}
                          >
                            <Trash2 size={13} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </BouncyReveal>
                );
              })}
            </View>
          )}

          {/* Settle Up */}
          <View style={{ marginBottom: sp.xxl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: sp.sm }}>
                <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.ink, letterSpacing: -0.3 }}>
                  Settle Up
                </Text>
                <View style={{ flex: 1 }} />
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: colors.paperDim,
                    borderRadius: 100,
                    padding: 2,
                  }}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setSettleFilter('mine')}
                    style={{
                      paddingHorizontal: sp.md,
                      paddingVertical: 4,
                      borderRadius: 100,
                      backgroundColor: settleFilter === 'mine' ? colors.tealDark : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fs.xs,
                        fontWeight: '800',
                        color: settleFilter === 'mine' ? '#FFFFFF' : colors.inkSoft,
                      }}
                    >
                      Mine
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setSettleFilter('all')}
                    style={{
                      paddingHorizontal: sp.md,
                      paddingVertical: 4,
                      borderRadius: 100,
                      backgroundColor: settleFilter === 'all' ? colors.tealDark : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fs.xs,
                        fontWeight: '800',
                        color: settleFilter === 'all' ? '#FFFFFF' : colors.inkSoft,
                      }}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {visibleSettleUps.length === 0 ? (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    borderStyle: 'dashed',
                    paddingVertical: sp.lg,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>
                    You're all settled up
                  </Text>
                  <Text style={{ fontSize: fs.xs, color: colors.inkSoft, marginTop: 2 }}>
                    No payments needed from you right now
                  </Text>
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    overflow: 'hidden',
                  }}
                >
                  {visibleSettleUps.map((s, idx) => (
                    <View
                      key={s.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: sp.md,
                        borderBottomWidth: idx === visibleSettleUps.length - 1 ? 0 : 1,
                        borderBottomColor: colors.cardBorder,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}>
                        <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>{s.fromUser}</Text>
                        <ArrowRight size={14} color={colors.inkSoft} />
                        <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>{s.toUser}</Text>
                      </View>
                      <Text style={{ fontSize: fs.sm, fontWeight: '900', color: colors.tealDark }}>
                        {formatCurrency(s.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
        </ScrollView>

        {/* Modals */}
        <AddExpenseModal
          visible={addModalVisible}
          onClose={() => setAddModalVisible(false)}
          tripId={activeTripId}
          members={members}
          myId={myId}
        />
        <ScanReceiptModal visible={scanModalVisible} onClose={() => setScanModalVisible(false)} />
        <EditExpenseModal
          expense={editExpense}
          visible={!!editExpense}
          onClose={() => setEditExpense(null)}
          members={members}
        />
        <ExpenseDetailsDialog expense={previewExpense} visible={!!previewExpense} members={members} onClose={() => setPreviewExpense(null)} />

        {/* Delete Expense Confirmation */}
        <Modal
          transparent
          visible={!!expenseToDelete}
          animationType="fade"
          onRequestClose={() => setExpenseToDelete(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
            <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setExpenseToDelete(null)} />
            <View style={{ width: '100%', maxWidth: 340, backgroundColor: isDark ? colors.paper : '#FFFFFF', borderRadius: 28, borderWidth: 1, borderColor: colors.cardBorder, padding: 24, alignItems: 'center', elevation: 12 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FCE8E6', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Trash2 size={26} color="#EF4444" strokeWidth={2.2} />
              </View>

              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink, textAlign: 'center', marginBottom: 6 }}>
                Remove this expense?
              </Text>

              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
                "{expenseToDelete?.title || 'This expense'}" will be permanently removed from the ledger, along with its receipt photos. This cannot be undone.
              </Text>

              <View style={{ width: '100%', gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleDeleteExpense}
                  disabled={deletingExpense}
                  style={{
                    backgroundColor: '#EF4444',
                    paddingVertical: 13,
                    borderRadius: 100,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#EF4444',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 4,
                  }}
                >
                  {deletingExpense ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                      Yes, Remove Expense
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setExpenseToDelete(null)}
                  disabled={deletingExpense}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    paddingVertical: 11,
                    borderRadius: 100,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.inkSoft, fontSize: 13, fontWeight: '700' }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};