import React from 'react';
import { View, Text } from 'react-native';
import { formatCurrency } from '../../utils/formatters';

interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
}

interface ReceiptContainerProps {
  merchantName: string;
  date: string;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  paidBy: string;
}

export const ReceiptContainer: React.FC<ReceiptContainerProps> = ({
  merchantName,
  date,
  items,
  subtotal,
  tax,
  total,
  paidBy,
}) => {
  return (
    <View className="bg-white p-5 rounded-2xl border border-rule shadow-sm my-2">
      {/* Receipt Top Header */}
      <View className="items-center border-b border-dashed border-rule pb-4 mb-4">
        <Text className="text-xs uppercase font-extrabold tracking-widest text-inkSoft">
          BARKADASH OFFICIAL RECEIPT
        </Text>
        <Text className="text-xl font-black text-ink mt-1">{merchantName}</Text>
        <Text className="text-xs text-inkSoft mt-0.5">{date}</Text>
      </View>

      {/* Items list */}
      <View className="space-y-2 mb-4">
        {items.map((item, idx) => (
          <View key={idx} className="flex-row justify-between items-center py-1">
            <Text className="text-sm text-ink font-medium flex-1">
              {item.qty}x {item.name}
            </Text>
            <Text className="text-sm text-ink font-bold">
              {formatCurrency(item.qty * item.price)}
            </Text>
          </View>
        ))}
      </View>

      {/* Total Calculations */}
      <View className="border-t border-dashed border-rule pt-3 space-y-1">
        <View className="flex-row justify-between">
          <Text className="text-xs text-inkSoft font-medium">Subtotal</Text>
          <Text className="text-xs text-ink font-semibold">{formatCurrency(subtotal)}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-xs text-inkSoft font-medium">Service Charge / Tax</Text>
          <Text className="text-xs text-ink font-semibold">{formatCurrency(tax)}</Text>
        </View>
        <View className="flex-row justify-between pt-2 mt-2 border-t border-rule">
          <Text className="text-base font-black text-ink">TOTAL</Text>
          <Text className="text-base font-black text-emerald">{formatCurrency(total)}</Text>
        </View>
      </View>

      {/* Footer */}
      <View className="mt-4 pt-3 bg-paperDim/60 p-2.5 rounded-xl items-center">
        <Text className="text-xs text-inkSoft font-medium">
          Paid by <Text className="font-bold text-ink">{paidBy}</Text> · Shared with Barkada
        </Text>
      </View>
    </View>
  );
};
