import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Image as RNImage } from 'react-native';
import { Expense } from '../../types/expense';
import { payerDisplayName, ExpenseMember } from '../../services/expenseService';
import { ReceiptPhotoCarousel } from './ReceiptPhotoCarousel';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { X, Camera, Receipt, User, Split } from 'lucide-react-native';
import { formatCurrency } from '../../utils/formatters';

interface ExpenseDetailsDialogProps {
  expense: Expense | null;
  visible: boolean;
  onClose: () => void;
  members?: ExpenseMember[];
}

export const ExpenseDetailsDialog: React.FC<ExpenseDetailsDialogProps> = ({
  expense,
  visible,
  onClose,
  members = [],
}) => {
  const { colors } = useTheme();
  const { sp, fs } = useResponsive();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselVisible, setCarouselVisible] = useState(false);

  if (!expense) return null;

  const photoUris = [
    ...(expense.receiptPhotos?.filter(Boolean) ?? []),
    ...(expense.receiptImagePath ? [expense.receiptImagePath] : []),
  ];

  const splitCount = expense.splitCount ?? 1;
  const share = expense.amount / splitCount;
  const isSolo = expense.splitMode === 'solo';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-center items-center bg-black/60 p-4">
        <View
          style={{ backgroundColor: colors.paper, borderColor: colors.cardBorder }}
          className="rounded-3xl w-full max-h-[85%] p-5 border shadow-lg"
        >
          <View className="flex-row justify-between items-center pb-1 mb-3">
            <Text style={{ color: colors.ink }} className="text-lg font-bold">Expense Details</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <X size={22} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Summary card */}
            <View
              style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
              className="p-5 rounded-2xl border my-1"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 15,
                    backgroundColor: expense.categoryBg || colors.paperDim,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Receipt size={22} color={expense.iconColor || colors.tealDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.ink, letterSpacing: -0.3 }}>
                    {expense.title}
                  </Text>
                  <Text style={{ fontSize: fs.xs, color: colors.inkSoft, fontWeight: '600', marginTop: 2 }}>
                    {expense.date}
                  </Text>
                </View>
              </View>

              <View style={{ borderColor: colors.cardBorder }} className="border-t mt-5 pt-5 space-y-4">
                <View className="flex-row justify-between items-center">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <User size={14} color={colors.inkSoft} />
                    <Text style={{ fontSize: fs.xs, color: colors.inkSoft, fontWeight: '600' }}>Paid by</Text>
                  </View>
                  <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>{payerDisplayName(expense, members)}</Text>
                </View>

                <View className="flex-row justify-between items-center">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Split size={14} color={colors.inkSoft} />
                    <Text style={{ fontSize: fs.xs, color: colors.inkSoft, fontWeight: '600' }}>Split</Text>
                  </View>
                  <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>
                    {isSolo ? 'Not split' : `${splitCount} ways · ${formatCurrency(share)} each`}
                  </Text>
                </View>

                <View style={{ borderColor: colors.cardBorder }} className="flex-row justify-between items-center pt-4 border-t">
                  <Text style={{ fontSize: fs.sm, fontWeight: '900', color: colors.ink }}>Total</Text>
                  <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.tealDark }}>
                    {formatCurrency(expense.amount)}
                  </Text>
                </View>
              </View>
            </View>

            {photoUris.length > 0 && (
              <View style={{ borderColor: colors.cardBorder }} className="mt-3 p-4 rounded-xl border bg-white/50 dark:bg-black/20">
                <View className="flex-row items-center gap-1.5 mb-2">
                  <Camera size={13} color={colors.tealDark} />
                  <Text style={{ color: colors.inkSoft }} className="text-xs font-bold uppercase">
                    {photoUris.length} {photoUris.length === 1 ? 'photo' : 'photos'}
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {photoUris.map((uri, i) => (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.85}
                        onPress={() => {
                          setCarouselIndex(i);
                          setCarouselVisible(true);
                        }}
                      >
                        <RNImage
                          source={{ uri }}
                          style={{
                            width: 76,
                            height: 76,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                            backgroundColor: colors.card,
                          }}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {expense.notes && (
              <View
                style={{ backgroundColor: colors.card, borderColor: colors.cardBorder }}
                className="mt-3 p-4 rounded-xl border"
              >
                <Text style={{ color: colors.inkSoft }} className="text-xs font-bold uppercase mb-1.5">
                  Attached Notes
                </Text>
                <Text style={{ color: colors.ink }} className="text-sm">{expense.notes}</Text>
              </View>
            )}
          </ScrollView>
        </View>

        <ReceiptPhotoCarousel
          photos={photoUris}
          initialIndex={carouselIndex}
          visible={carouselVisible}
          onClose={() => setCarouselVisible(false)}
        />
      </View>
    </Modal>
  );
};