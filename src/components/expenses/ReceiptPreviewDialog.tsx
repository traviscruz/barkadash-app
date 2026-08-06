import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Expense } from '../../types/expense';
import { ReceiptContainer } from '../common/ReceiptContainer';
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
  if (!expense) return null;

  // Mock receipt line items for presentation
  const mockItems = [
    { name: expense.title, qty: 1, price: expense.amount * 0.85 },
    { name: 'Service Charge / Addons', qty: 1, price: expense.amount * 0.15 },
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center bg-black/60 p-4">
        <View className="bg-paper rounded-3xl w-full max-h-[85%] p-5 border border-rule shadow-lg">
          <View className="flex-row justify-between items-center pb-3 border-b border-rule mb-2">
            <Text className="text-lg font-bold text-ink">Receipt Audit Preview</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <X size={22} color="#1A1D2D" />
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
              <View className="mt-2 p-3 bg-white rounded-xl border border-rule">
                <Text className="text-xs font-bold text-inkSoft uppercase mb-1">
                  Attached Notes
                </Text>
                <Text className="text-sm text-ink">{expense.notes}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
