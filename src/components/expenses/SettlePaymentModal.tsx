import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SlideUpModal } from '../common/SlideUpModal';
import { AppTextField } from '../inputs/AppTextField';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { ExpenseService } from '../../services/expenseService';
import { ItemizedDebt } from '../../types/expense';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { formatCurrency } from '../../utils/formatters';
import { Camera, ImagePlus, X, CheckCircle2, Receipt, ShieldCheck } from 'lucide-react-native';

interface SettlePaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  tripId: string;
  payerId: string;
  payeeId: string;
  payeeName: string;
  selectedDebts: ItemizedDebt[];
}

export const SettlePaymentModal: React.FC<SettlePaymentModalProps> = ({
  visible,
  onClose,
  onSuccess,
  tripId,
  payerId,
  payeeId,
  payeeName,
  selectedDebts,
}) => {
  const { colors } = useTheme();
  const { sp, fs } = useResponsive();

  const [proofUri, setProofUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalAmount = selectedDebts.reduce((sum, d) => sum + d.amountOwed, 0);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take a photo of your receipt.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setProofUri(result.assets[0].uri);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library permission is required to pick a receipt screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setProofUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDebts.length) {
      Alert.alert('No items selected', 'Please select at least one item to settle.');
      return;
    }
    setSubmitting(true);
    try {
      const items = selectedDebts.map((d) => ({
        expenseId: d.expenseId,
        amount: d.amountOwed,
      }));

      const res = await ExpenseService.getInstance().addSettlementDB({
        tripId,
        payerId,
        payeeId,
        amount: totalAmount,
        proofUri: proofUri || undefined,
        notes: notes.trim() || undefined,
        items,
      });

      if (res) {
        setProofUri(null);
        setNotes('');
        onSuccess?.();
        onClose();
      } else {
        Alert.alert('Error', 'Failed to submit payment. Please try again.');
      }
    } catch (e: any) {
      console.warn('handleSubmit settlement error:', e);
      Alert.alert('Error', e.message || 'Something went wrong while submitting payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.4}>
      <View
        style={{ backgroundColor: colors.paper, borderColor: colors.cardBorder }}
        className="rounded-t-3xl max-h-[90%] p-5 border-t"
      >
        {/* Header */}
        <View style={{ borderColor: colors.cardBorder }} className="flex-row justify-between items-center pb-4 mb-2 border-b">
          <Text style={{ color: colors.ink }} className="text-xl font-extrabold">Settle Payment</Text>
          <TouchableOpacity onPress={onClose} className="p-1">
            <X size={22} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
        {/* Recipient & Total Summary Card */}
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            padding: sp.md,
            marginBottom: sp.md,
          }}
        >
          <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Paying to
          </Text>
          <Text style={{ fontSize: fs.lg, fontWeight: '900', color: colors.ink, marginTop: 2 }}>
            {payeeName}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginTop: sp.sm,
              paddingTop: sp.sm,
              borderTopWidth: 1,
              borderTopColor: colors.cardBorder,
            }}
          >
            <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.inkSoft }}>
              Total ({selectedDebts.length} {selectedDebts.length === 1 ? 'item' : 'items'}):
            </Text>
            <Text style={{ fontSize: fs.xl, fontWeight: '900', color: colors.tealDark }}>
              {formatCurrency(totalAmount)}
            </Text>
          </View>
        </View>

        {/* Selected Items List */}
        <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: sp.xs, letterSpacing: 0.5 }}>
          Items included ({selectedDebts.length})
        </Text>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            marginBottom: sp.lg,
            overflow: 'hidden',
          }}
        >
          {selectedDebts.map((item, index) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: sp.sm,
                paddingHorizontal: sp.md,
                borderBottomWidth: index === selectedDebts.length - 1 ? 0 : 1,
                borderBottomColor: colors.cardBorder,
              }}
            >
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text numberOfLines={1} style={{ fontSize: fs.sm, fontWeight: '700', color: colors.ink }}>
                  {item.expenseTitle}
                </Text>
                <Text style={{ fontSize: 11, color: colors.inkSoft }}>
                  Total: {formatCurrency(item.totalExpenseAmount)} ({item.splitCount} ways)
                </Text>
              </View>
              <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.tealDark }}>
                {formatCurrency(item.amountOwed)}
              </Text>
            </View>
          ))}
        </View>

        {/* Proof of Payment Upload */}
        <View style={{ marginBottom: sp.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: sp.xs }}>
            <ShieldCheck size={16} color={colors.tealDark} />
            <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Proof of Payment (Screenshot / Receipt)
            </Text>
          </View>

          {proofUri ? (
            <View
              style={{
                position: 'relative',
                borderRadius: 16,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.cardBorder,
                backgroundColor: colors.card,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
              }}
            >
              <Image
                source={{ uri: proofUri }}
                style={{ width: '100%', height: 180, borderRadius: 12 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => setProofUri(null)}
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: sp.sm }}>
              <TouchableOpacity
                onPress={takePhoto}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: colors.card,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: colors.cardBorder,
                  borderRadius: 16,
                  paddingVertical: sp.md,
                }}
              >
                <Camera size={20} color={colors.tealDark} />
                <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink }}>
                  Take Photo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={pickFromLibrary}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: colors.card,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: colors.cardBorder,
                  borderRadius: 16,
                  paddingVertical: sp.md,
                }}
              >
                <ImagePlus size={20} color={colors.tealDark} />
                <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink }}>
                  Choose Photo
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Note / Reference */}
        <View style={{ marginBottom: sp.lg }}>
          <AppTextField
            label="Payment Note / Reference (Optional)"
            placeholder="e.g. GCash Ref #123456789 or Sent via Maya"
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Submit Button */}
        <View style={{ marginBottom: sp.md }}>
          <PrimaryButton
            label={submitting ? 'Submitting...' : `Submit Payment Proof (${formatCurrency(totalAmount)})`}
            onPress={handleSubmit}
            disabled={submitting}
          />
        </View>
      </ScrollView>
      </View>
    </SlideUpModal>
  );
};
