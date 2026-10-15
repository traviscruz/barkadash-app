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
  const customSharesList = expense.customShares ? Object.values(expense.customShares) : [];
  const hasCustom = !isSolo && customSharesList.length > 0;
  const minShare = hasCustom ? Math.min(...customSharesList) : share;
  const maxShare = hasCustom ? Math.max(...customSharesList) : share;
  const isCustomRange = hasCustom && Math.abs(maxShare - minShare) >= 0.01;
  const shareLabel = isCustomRange
    ? `${formatCurrency(minShare)} – ${formatCurrency(maxShare)}`
    : `${formatCurrency(share)} each`;

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

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.cardBorder,
                  marginTop: 22,
                  paddingTop: 18,
                  gap: 16,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <User size={15} color={colors.inkSoft} />
                    <Text style={{ fontSize: fs.xs, color: colors.inkSoft, fontWeight: '700' }}>Paid by</Text>
                  </View>
                  <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>{payerDisplayName(expense, members)}</Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Split size={15} color={colors.inkSoft} />
                    <Text style={{ fontSize: fs.xs, color: colors.inkSoft, fontWeight: '700' }}>Split</Text>
                  </View>
                  <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>
                    {isSolo ? 'Not split' : `${splitCount} ways · ${shareLabel}`}
                  </Text>
                </View>

                {/* Custom per-member breakdown */}
                {hasCustom && members.length > 0 && (
                  <View
                    style={{
                      marginTop: 4,
                      backgroundColor: colors.paperDim,
                      borderRadius: 12,
                      padding: 12,
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                      Custom Share Breakdown
                    </Text>
                    {members.map((m) => {
                      const memberShare = expense.customShares![m.id];
                      if (memberShare === undefined) return null;
                      return (
                        <View key={m.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, marginRight: 8 }}>
                            <View
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: colors.card,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: colors.cardBorder,
                                flexShrink: 0,
                              }}
                            >
                              <Text style={{ fontSize: 10, fontWeight: '900', color: colors.ink }}>
                                {m.name.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink, flexShrink: 1 }}>{m.name}</Text>
                          </View>
                          <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.tealDark, flexShrink: 0 }}>
                            {formatCurrency(memberShare)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: colors.cardBorder,
                    paddingTop: 16,
                    marginTop: 4,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
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