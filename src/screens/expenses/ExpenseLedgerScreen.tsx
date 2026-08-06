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
import { Plus, ArrowRightLeft } from 'lucide-react-native';
import { formatCurrency } from '../../utils/formatters';

const CATEGORY_FILTERS = ['All', 'Food', 'Stay', 'Transport', 'Activities', 'Groceries'];

export const ExpenseLedgerScreen: React.FC<{ onScrollDirection?: (direction: 'up' | 'down') => void }> = ({ onScrollDirection }) => {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, paddingHorizontal: sp.lg, paddingTop: sp.md }}>
        {/* Header Bar */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.md }}>
          <View>
            <Text style={{ fontSize: fs.xxl, fontWeight: '900', color: '#1A1D2D', letterSpacing: -0.5 }}>Trip Ledger</Text>
            <Text style={{ fontSize: fs.xs, color: '#6E738A' }}>El Nido shared expenses & settlements</Text>
          </View>

          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            style={{
              backgroundColor: '#1F4E67',
              paddingHorizontal: sp.md,
              paddingVertical: sp.sm,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: sp.xs,
            }}
          >
            <Plus size={icon.md} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: fs.xs, fontWeight: '700' }}>Add Expense</Text>
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
                backgroundColor: '#E4F0EA',
                padding: sp.md,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(58,142,113,0.2)',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: '#3A8E71', letterSpacing: 1 }}>
                ↓ YOU'RE OWED
              </Text>
              <Text style={{ fontSize: fs.xxl, fontWeight: '900', color: '#3A8E71', marginTop: sp.xs }}>₱850</Text>
            </View>

            {/* Settle In Card */}
            <View
              style={{
                flex: 1,
                backgroundColor: '#FBE7E1',
                padding: sp.md,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(226,96,74,0.2)',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: '#E2604A', letterSpacing: 1 }}>
                ⇄ SETTLE IN
              </Text>
              <Text style={{ fontSize: fs.xxl, fontWeight: '900', color: '#E2604A', marginTop: sp.xs }}>2 txns</Text>
            </View>
          </View>

          {/* Category Breakdown Bar */}
          <View
            style={{
              backgroundColor: '#FFFFFF',
              padding: sp.md,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#EAE4D7',
              flexDirection: 'row',
              justifyContent: 'space-around',
              alignItems: 'center',
              marginBottom: sp.lg,
            }}
          >
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: '#6E738A', fontWeight: '500' }}>🍽️ Food</Text>
              <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#1A1D2D' }}>₱4.0k</Text>
            </View>
            <View style={{ height: 24, width: 1, backgroundColor: '#EAE4D7' }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: '#6E738A', fontWeight: '500' }}>🏠 Stay</Text>
              <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#1A1D2D' }}>₱9.6k</Text>
            </View>
            <View style={{ height: 24, width: 1, backgroundColor: '#EAE4D7' }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: '#6E738A', fontWeight: '500' }}>⛵ Activities</Text>
              <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#1A1D2D' }}>₱4.8k</Text>
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
                      backgroundColor: isSelected ? '#1F4E67' : '#FFFFFF',
                      borderColor: isSelected ? '#1F4E67' : '#EAE4D7',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fs.xs,
                        fontWeight: '700',
                        color: isSelected ? '#FFFFFF' : '#1A1D2D',
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
              backgroundColor: '#FAF8F5',
              padding: sp.xl,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: '#EAE4D7',
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
                borderBottomColor: '#EAE4D7',
                borderStyle: 'dashed',
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 3, color: '#6E738A' }}>
                BARKADASH TRIP CO.
              </Text>
              <Text style={{ fontSize: fs.xl, fontWeight: '900', color: '#1A1D2D', letterSpacing: -0.5, marginTop: 2 }}>EL NIDO</Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#6E738A', marginTop: 2 }}>
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
                borderBottomColor: 'rgba(234,228,215,0.5)',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#6E738A' }}>ITEM</Text>
              <View style={{ flexDirection: 'row', gap: sp.xxl }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#6E738A' }}>PAID BY</Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#6E738A' }}>AMT</Text>
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
                    borderBottomColor: 'rgba(234,228,215,0.3)',
                  }}
                >
                  <View style={{ flex: 1, paddingRight: sp.sm }}>
                    <Text style={{ fontSize: fs.sm, fontWeight: '700', color: '#1A1D2D' }}>{exp.title}</Text>
                    <Text style={{ fontSize: 10, color: '#6E738A' }}>📄 receipt</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xxl }}>
                    <Text style={{ fontSize: fs.xs, fontWeight: '600', color: '#6E738A' }}>{exp.paidBy}</Text>
                    <Text style={{ fontSize: fs.sm, fontWeight: '900', color: '#1A1D2D' }}>
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
                borderTopColor: '#EAE4D7',
                borderStyle: 'dashed',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.xs }}>
                <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#6E738A' }}>ITEMS TOTAL</Text>
                <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#1A1D2D' }}>{expenses.length} expenses</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: fs.md, fontWeight: '900', color: '#1A1D2D' }}>GRAND TOTAL</Text>
                <Text style={{ fontSize: fs.xl, fontWeight: '900', color: '#1F4E67' }}>
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
                borderTopColor: '#EAE4D7',
                borderStyle: 'dashed',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 9, color: '#6E738A', letterSpacing: 3, fontFamily: 'monospace', marginBottom: sp.sm, textTransform: 'uppercase' }}>
                *** THANK YOU FOR BARKADASHIN' ***
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1, height: 40, width: 192, justifyContent: 'center' }}>
                {[2, 1, 3, 1, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 4, 2, 1, 3].map((w, idx) => (
                  <View
                    key={idx}
                    style={{ backgroundColor: '#1A1D2D', height: '100%', borderRadius: 1, width: w }}
                  />
                ))}
              </View>
              <Text style={{ fontSize: 10, color: '#6E738A', fontFamily: 'monospace', marginTop: sp.xs }}>4242-BARK-DAS4-2026</Text>
            </View>
          </View>

          {/* Settle Up Ticker */}
          {settleUps.length > 0 && (
            <View
              style={{
                backgroundColor: '#E4F0F4',
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
                <ArrowRightLeft size={icon.sm} color="#3B7A9E" />
                <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#1A1D2D' }}>
                  {settleUps[0].fromUser} → {settleUps[0].toUser}
                </Text>
              </View>
              <Text style={{ fontSize: fs.xs, fontWeight: '900', color: '#3B7A9E' }}>
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
