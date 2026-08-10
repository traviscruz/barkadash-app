import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExpenseService } from '../../services/expenseService';
import { Expense, SettleUpItem } from '../../types/expense';
import { AddExpenseModal } from '../../components/expenses/AddExpenseModal';
import { ReceiptPreviewDialog } from '../../components/expenses/ReceiptPreviewDialog';
import { EditExpenseModal } from '../../components/expenses/EditExpenseModal';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { Plus, ArrowRightLeft, Utensils, Home, Compass, Receipt, Menu } from 'lucide-react-native';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { formatCurrency } from '../../utils/formatters';

const CATEGORY_FILTERS = ['All', 'Food', 'Stay', 'Transport', 'Activities', 'Groceries'];

interface ExpenseLedgerScreenProps {
  onScrollDirection?: (direction: 'up' | 'down') => void;
  onOpenCabinet?: () => void;
}

export const ExpenseLedgerScreen: React.FC<ExpenseLedgerScreenProps> = ({ onScrollDirection, onOpenCabinet }) => {
  const { colors } = useTheme();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settleUps, setSettleUps] = useState<SettleUpItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [previewExpense, setPreviewExpense] = useState<Expense | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  const lastOffsetY = useRef(0);
  const { sp, fs, icon, bottomNavOffset, isTablet } = useResponsive();

  useEffect(() => {
    const service = ExpenseService.getInstance();
    setExpenses(service.getExpenses());
    setSettleUps(service.getSettleUps());

    return service.subscribe(() => {
      setExpenses(service.getExpenses());
      setSettleUps(service.getSettleUps());
    });
  }, []);

  const filteredExpenses = expenses.filter((exp) => {
    if (selectedCategory === 'All') return true;
    return exp.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />
      <View style={{ flex: 1, paddingHorizontal: sp.lg, paddingTop: sp.sm }}>
        {/* App Logo & Borderless Hamburger Match Home Screen */}
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

        {/* Header Bar */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.md }}>
          <View>
            <Text style={{ fontSize: fs.xxl, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>Trip Ledger</Text>
            <Text style={{ fontSize: fs.xs, color: colors.inkSoft }}>El Nido shared expenses & settlements</Text>
          </View>

          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.8}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.tealDark,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.tealDark,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Plus size={22} color="#FFFFFF" strokeWidth={2.5} />
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
          } else if (delta > 6) {
            onScrollDirection?.('down');
          } else if (delta < -6) {
            onScrollDirection?.('up');
          }
        }}
        scrollEventThrottle={8}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: bottomNavOffset }}
        >
          {/* Top Summary Cards */}
          <View style={{ flexDirection: 'row', gap: sp.md, marginBottom: sp.md }}>
            {/* Owed Card */}
            <View
              style={{
                flex: 1,
                backgroundColor: colors.lightGreenBg,
                padding: sp.md,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(58,142,113,0.2)',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: colors.emerald, letterSpacing: 1 }}>
                ↓ YOU'RE OWED
              </Text>
              <Text style={{ fontSize: fs.xxl, fontWeight: '900', color: colors.emerald, marginTop: sp.xs }}>₱850</Text>
            </View>

            {/* Settle In Card */}
            <View
              style={{
                flex: 1,
                backgroundColor: colors.lightRedBg,
                padding: sp.md,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(226,96,74,0.2)',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: colors.redAccent, letterSpacing: 1 }}>
                ⇄ SETTLE IN
              </Text>
              <Text style={{ fontSize: fs.xxl, fontWeight: '900', color: colors.redAccent, marginTop: sp.xs }}>2 txns</Text>
            </View>
          </View>

          {/* Category Breakdown Bar */}
          <View
            style={{
              backgroundColor: colors.card,
              padding: sp.md,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              flexDirection: 'row',
              justifyContent: 'space-around',
              alignItems: 'center',
              marginBottom: sp.lg,
            }}
          >
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Utensils size={12} color={colors.inkSoft} />
                <Text style={{ fontSize: 10, color: colors.inkSoft, fontWeight: '600' }}>Food</Text>
              </View>
              <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink, marginTop: 2 }}>₱4.0k</Text>
            </View>
            <View style={{ height: 24, width: 1, backgroundColor: colors.cardBorder }} />
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Home size={12} color={colors.inkSoft} />
                <Text style={{ fontSize: 10, color: colors.inkSoft, fontWeight: '600' }}>Stay</Text>
              </View>
              <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink, marginTop: 2 }}>₱9.6k</Text>
            </View>
            <View style={{ height: 24, width: 1, backgroundColor: colors.cardBorder }} />
            <View style={{ alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Compass size={12} color={colors.inkSoft} />
                <Text style={{ fontSize: 10, color: colors.inkSoft, fontWeight: '600' }}>Activities</Text>
              </View>
              <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink, marginTop: 2 }}>₱4.8k</Text>
            </View>
          </View>

          {/* Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: sp.lg }}>
            <View style={{ flexDirection: 'row', gap: sp.sm }}>
              {CATEGORY_FILTERS.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    style={{
                      paddingHorizontal: sp.lg,
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
                        fontWeight: '700',
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

          {/* Receipt Paper Card */}
          <View
            style={{
              backgroundColor: colors.card,
              padding: sp.xl,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              marginBottom: sp.xxl,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            {/* Receipt Header */}
            <View
              style={{
                alignItems: 'center',
                paddingBottom: sp.lg,
                marginBottom: sp.lg,
                borderBottomWidth: 1,
                borderBottomColor: colors.cardBorder,
                borderStyle: 'dashed',
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 3, color: colors.inkSoft }}>
                BARKADASH TRIP CO.
              </Text>
              <Text style={{ fontSize: fs.xl, fontWeight: '900', color: colors.ink, letterSpacing: -0.5, marginTop: 2 }}>EL NIDO</Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.inkSoft, marginTop: 2 }}>
                Jul 18 – Jul 21, 2026
              </Text>
            </View>

            {/* Table Header */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingBottom: sp.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.cardBorder,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.inkSoft }}>ITEM</Text>
              <View style={{ flexDirection: 'row', gap: sp.xxl }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.inkSoft }}>PAID BY</Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.inkSoft }}>AMT</Text>
              </View>
            </View>

            {/* Items List */}
            <View style={{ paddingVertical: sp.sm, gap: sp.md }}>
              {filteredExpenses.map((exp) => (
                <TouchableOpacity
                  key={exp.id}
                  onPress={() => setPreviewExpense(exp)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: sp.xs + 2,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.cardBorder,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: sp.sm }}>
                    <Text style={{ fontSize: fs.sm, fontWeight: '700', color: colors.ink }}>{exp.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Receipt size={10} color={colors.inkSoft} />
                      <Text style={{ fontSize: 10, color: colors.inkSoft }}>receipt</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xxl }}>
                    <Text style={{ fontSize: fs.xs, fontWeight: '600', color: colors.inkSoft }}>{exp.paidBy}</Text>
                    <Text style={{ fontSize: fs.sm, fontWeight: '900', color: colors.ink }}>
                      {formatCurrency(exp.amount)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Grand Total */}
            <View
              style={{
                paddingTop: sp.lg,
                marginTop: sp.md,
                borderTopWidth: 1,
                borderTopColor: colors.cardBorder,
                borderStyle: 'dashed',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.xs }}>
                <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.inkSoft }}>ITEMS TOTAL</Text>
                <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink }}>{expenses.length} expenses</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.ink }}>GRAND TOTAL</Text>
                <Text style={{ fontSize: fs.xl, fontWeight: '900', color: colors.tealDark }}>
                  {formatCurrency(totalSpent)}
                </Text>
              </View>
            </View>

            {/* Barcode */}
            <View
              style={{
                marginTop: sp.xxl,
                paddingTop: sp.lg,
                borderTopWidth: 1,
                borderTopColor: colors.cardBorder,
                borderStyle: 'dashed',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 9, color: colors.inkSoft, letterSpacing: 3, fontFamily: 'monospace', marginBottom: sp.sm, textTransform: 'uppercase' }}>
                *** THANK YOU FOR BARKADASHIN' ***
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1, height: 40, width: 192, justifyContent: 'center' }}>
                {[2, 1, 3, 1, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 4, 2, 1, 3].map((w, idx) => (
                  <View
                    key={idx}
                    style={{ backgroundColor: colors.ink, height: '100%', borderRadius: 1, width: w }}
                  />
                ))}
              </View>
              <Text style={{ fontSize: 10, color: colors.inkSoft, fontFamily: 'monospace', marginTop: sp.xs }}>4242-BARK-DAS4-2026</Text>
            </View>
          </View>

          {/* Settle Up Ticker */}
          {settleUps.length > 0 && (
            <View
              style={{
                backgroundColor: colors.lightBlueBg,
                padding: sp.md,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(79,134,198,0.3)',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: sp.xxl,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
                <ArrowRightLeft size={icon.sm} color={colors.tealAccent} />
                <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink }}>
                  {settleUps[0].fromUser} → {settleUps[0].toUser}
                </Text>
              </View>
              <Text style={{ fontSize: fs.xs, fontWeight: '900', color: colors.tealAccent }}>
                {formatCurrency(settleUps[0].amount)}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Modals */}
        <AddExpenseModal
          visible={addModalVisible}
          onClose={() => setAddModalVisible(false)}
        />
        <ReceiptPreviewDialog
          expense={previewExpense}
          visible={!!previewExpense}
          onClose={() => setPreviewExpense(null)}
        />
        <EditExpenseModal
          expense={editExpense}
          visible={!!editExpense}
          onClose={() => setEditExpense(null)}
        />
      </View>
    </SafeAreaView>
  );
};
