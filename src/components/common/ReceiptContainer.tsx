import React from 'react';
import { View, Text } from 'react-native';
import { formatCurrency } from '../../utils/formatters';
import { useTheme } from '../../context/ThemeContext';

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
  const { colors } = useTheme();

  return (
    <View
      style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
      className="p-5 rounded-2xl border shadow-sm my-2"
    >
      {/* Receipt Top Header */}
      <View style={{ borderColor: colors.cardBorder }} className="items-center border-b border-dashed pb-4 mb-4">
        <Text style={{ color: colors.inkSoft }} className="text-xs uppercase font-extrabold tracking-widest">
          BARKADASH OFFICIAL RECEIPT
        </Text>
        <Text style={{ color: colors.ink }} className="text-xl font-black mt-1">{merchantName}</Text>
        <Text style={{ color: colors.inkSoft }} className="text-xs mt-0.5">{date}</Text>
      </View>

      {/* Items list */}
      <View className="space-y-2 mb-4">
        {items.map((item, idx) => (
          <View key={idx} className="flex-row justify-between items-center py-1">
            <Text style={{ color: colors.ink }} className="text-sm font-medium flex-1">
              {item.qty}x {item.name}
            </Text>
            <Text style={{ color: colors.ink }} className="text-sm font-bold">
              {formatCurrency(item.qty * item.price)}
            </Text>
          </View>
        ))}
      </View>

      {/* Total Calculations */}
      <View style={{ borderColor: colors.cardBorder }} className="border-t border-dashed pt-3 space-y-1">
        <View className="flex-row justify-between">
          <Text style={{ color: colors.inkSoft }} className="text-xs font-medium">Subtotal</Text>
          <Text style={{ color: colors.ink }} className="text-xs font-semibold">{formatCurrency(subtotal)}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text style={{ color: colors.inkSoft }} className="text-xs font-medium">Service Charge / Tax</Text>
          <Text style={{ color: colors.ink }} className="text-xs font-semibold">{formatCurrency(tax)}</Text>
        </View>
        <View style={{ borderColor: colors.cardBorder }} className="flex-row justify-between pt-2 mt-2 border-t">
          <Text style={{ color: colors.ink }} className="text-base font-black">TOTAL</Text>
          <Text style={{ color: colors.emerald }} className="text-base font-black">{formatCurrency(total)}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={{ backgroundColor: colors.paperDim }} className="mt-4 pt-3 p-2.5 rounded-xl items-center">
        <Text style={{ color: colors.inkSoft }} className="text-xs font-medium">
          Paid by <Text style={{ color: colors.ink }} className="font-bold">{paidBy}</Text> · Shared with Barkada
        </Text>
      </View>
    </View>
  );
};
