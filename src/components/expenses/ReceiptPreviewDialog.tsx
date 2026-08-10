import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Expense } from '../../types/expense';
import { ReceiptContainer } from '../common/ReceiptContainer';
import { useTheme } from '../../context/ThemeContext';
import { X } from 'lucide-react-native';

interface ReceiptPreviewDialogProps {
  expense: Expense | null;
  visible: boolean;
  onClose: () => void;
}

export const ReceiptPreviewDialog: React.FC<ReceiptPreviewDialogProps> = ({
  expense,
  visible,
  onClose,
}) => {
  const { colors } = useTheme();

  if (!expense) return null;

  // Mock receipt line items for presentation
  const mockItems = [
    { name: expense.title, qty: 1, price: expense.amount * 0.85 },
    { name: 'Service Charge / Addons', qty: 1, price: expense.amount * 0.15 },
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center bg-black/60 p-4">
        <View
          style={{ backgroundColor: colors.paper, borderColor: colors.cardBorder }}
          className="rounded-3xl w-full max-h-[85%] p-5 border shadow-lg"
        >
          <View style={{ borderColor: colors.cardBorder }} className="flex-row justify-between items-center pb-3 border-b mb-2">
            <Text style={{ color: colors.ink }} className="text-lg font-bold">Receipt Audit Preview</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <X size={22} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <ReceiptContainer
              merchantName={expense.title}
              date={expense.date}
              items={mockItems}
              subtotal={expense.amount * 0.85}
              tax={expense.amount * 0.15}
              total={expense.amount}
              paidBy={expense.paidBy}
            />

            {expense.notes && (
              <View
                style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                className="mt-2 p-3 rounded-xl border"
              >
                <Text style={{ color: colors.inkSoft }} className="text-xs font-bold uppercase mb-1">
                  Attached Notes
                </Text>
                <Text style={{ color: colors.ink }} className="text-sm">{expense.notes}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
