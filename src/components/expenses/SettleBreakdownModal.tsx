import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
  Image as RNImage,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SettleUpItem, ItemizedDebt, ExpenseSettlement } from '../../types/expense';
import { SlideUpModal } from '../common/SlideUpModal';
import { ReceiptPhotoCarousel } from './ReceiptPhotoCarousel';
import { MemberPaymentMethodsModal } from './MemberPaymentMethodsModal';
import { ExpenseService } from '../../services/expenseService';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { useResponsive } from '../../utils/responsive';
import { formatCurrency } from '../../utils/formatters';
import {
  X,
  CheckSquare,
  Square,
  CheckCircle2,
  Clock,
  QrCode,
  Wallet,
  ArrowRight,
  Receipt,
  Utensils,
  Home,
  Compass,
  ShoppingBag,
  Car,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Pencil,
  Trash2,
  Camera,
  ImagePlus,
  Eye,
  AlertTriangle,
  ChevronLeft,
} from 'lucide-react-native';

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
  'shopping-bag': ShoppingBag,
  groceries: ShoppingBag,
  car: Car,
  transport: Car,
  receipt: Receipt,
  general: Receipt,
};

interface SettleBreakdownModalProps {
  visible: boolean;
  onClose: () => void;
  settleUpItem: SettleUpItem | null;
  currentUserId?: string;
  tripId?: string;
  onRefresh?: () => void;
}

export const SettleBreakdownModal: React.FC<SettleBreakdownModalProps> = ({
  visible,
  onClose,
  settleUpItem,
  currentUserId,
  tripId,
  onRefresh,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { sp, fs } = useResponsive();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedSettlement, setSelectedSettlement] = useState<ExpenseSettlement | null>(null);
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [memberPaymentModalVisible, setMemberPaymentModalVisible] = useState(false);

  // Settlement details actions state
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [isEditingProof, setIsEditingProof] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [newProofUri, setNewProofUri] = useState<string | null>(null);

  // In-modal Settle Payment step state
  const [isPayingSelected, setIsPayingSelected] = useState(false);
  const [paymentProofUri, setPaymentProofUri] = useState<string | null>(null);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelectedSettlement(null);
      setIsEditingProof(false);
      setNewProofUri(null);
      setSelectedIds([]);
      setShowDeleteConfirm(false);
      setIsPayingSelected(false);
      setPaymentProofUri(null);
      setPaymentNotes('');
    }
  }, [visible]);

  const items = settleUpItem?.items || [];
  const unpaidItems = useMemo(() => items.filter((i) => i.status === 'unpaid'), [items]);
  const pendingItems = useMemo(() => items.filter((i) => i.status === 'pending'), [items]);
  const verifiedItems = useMemo(() => items.filter((i) => i.status === 'verified'), [items]);

  if (!settleUpItem) return null;

  const effectiveUserId = currentUserId || profile?.id;
  const isDebtor = selectedSettlement
    ? (effectiveUserId ? effectiveUserId === selectedSettlement.payerId : false)
    : (effectiveUserId ? effectiveUserId === settleUpItem.fromUserId : false);
  const isCreditor = selectedSettlement
    ? (effectiveUserId ? effectiveUserId === selectedSettlement.payeeId : false)
    : (effectiveUserId ? effectiveUserId === settleUpItem.toUserId : false);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === unpaidItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(unpaidItems.map((i) => i.id));
    }
  };

  const selectedDebts = unpaidItems.filter((i) => selectedIds.includes(i.id));
  const selectedAmount = selectedDebts.reduce((sum, d) => sum + d.amountOwed, 0);

  const openPaymentModal = (specificDebt?: ItemizedDebt) => {
    if (specificDebt) {
      setSelectedIds([specificDebt.id]);
    }
    setIsPayingSelected(true);
  };

  const takePaymentPhoto = async () => {
    try {
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
        setPaymentProofUri(result.assets[0].uri);
      }
    } catch (e: any) {
      console.warn('takePaymentPhoto error:', e);
    }
  };

  const pickPaymentFromLibrary = async () => {
    try {
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
        setPaymentProofUri(result.assets[0].uri);
      }
    } catch (e: any) {
      console.warn('pickPaymentFromLibrary error:', e);
    }
  };

  const handleSubmitPayment = async () => {
    if (!selectedDebts.length) {
      Alert.alert('No items selected', 'Please select at least one item to settle.');
      return;
    }
    const targetTripId = tripId || (settleUpItem as any)?.tripId || selectedDebts[0]?.settlement?.tripId || (items[0] as any)?.tripId;
    const targetPayerId = settleUpItem?.fromUserId || effectiveUserId;
    const targetPayeeId = settleUpItem?.toUserId || selectedDebts[0]?.creditorId;
    if (!targetTripId || !targetPayerId || !targetPayeeId) {
      Alert.alert('Error', 'Missing trip or user reference for payment.');
      return;
    }

    setSubmittingPayment(true);
    try {
      const debtItems = selectedDebts.map((d) => ({
        expenseId: d.expenseId,
        amount: d.amountOwed,
      }));

      const res = await ExpenseService.getInstance().addSettlementDB({
        tripId: targetTripId,
        payerId: targetPayerId,
        payeeId: targetPayeeId,
        amount: selectedAmount,
        proofUri: paymentProofUri || undefined,
        notes: paymentNotes.trim() || undefined,
        items: debtItems,
      });

      if (res) {
        setPaymentProofUri(null);
        setPaymentNotes('');
        setSelectedIds([]);
        setIsPayingSelected(false);
        onRefresh?.();
      } else {
        Alert.alert('Error', 'Failed to submit payment. Please try again.');
      }
    } catch (e: any) {
      console.warn('handleSubmitPayment error:', e);
      Alert.alert('Error', e?.message || 'Something went wrong while submitting payment.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const openSettlementDetails = (item: ItemizedDebt) => {
    let targetSettlement = item.settlement;
    if (!targetSettlement) {
      const allSettlements = ExpenseService.getInstance().getSettlements();
      targetSettlement = allSettlements.find((s) => s.items?.some((it) => it.expenseId === item.expenseId));
    }
    if (targetSettlement) {
      setSelectedSettlement(targetSettlement);
      setIsEditingProof(false);
      setEditedNotes(targetSettlement.notes || '');
      setNewProofUri(null);
    }
  };

  // Debtor Edit Proof Pickers
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setNewProofUri(result.assets[0].uri);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setNewProofUri(result.assets[0].uri);
    }
  };

  // Creditor Actions
  const handleVerify = async () => {
    const targetTripId = tripId || selectedSettlement?.tripId;
    if (!selectedSettlement || !targetTripId) {
      console.warn('handleVerify returning early:', { selectedSettlement, tripId, targetTripId });
      Alert.alert('Error', 'Cannot verify: payment or trip information is missing.');
      return;
    }
    setVerifying(true);
    try {
      const ok = await ExpenseService.getInstance().verifySettlementDB(
        selectedSettlement.id,
        targetTripId,
        'verified'
      );
      if (ok) {
        setSelectedSettlement(null);
        onRefresh?.();
      } else {
        Alert.alert('Error', 'Failed to approve payment.');
      }
    } catch (e: any) {
      console.warn('handleVerify error:', e);
      Alert.alert('Error', e.message || 'Something went wrong.');
    } finally {
      setVerifying(false);
    }
  };

  const handleReject = () => {
    const targetTripId = tripId || selectedSettlement?.tripId;
    if (!selectedSettlement || !targetTripId) {
      console.warn('handleReject returning early:', { selectedSettlement, tripId, targetTripId });
      Alert.alert('Error', 'Cannot reject: payment or trip information is missing.');
      return;
    }
    Alert.alert(
      'Reject Payment?',
      'Are you sure you want to reject this payment? The debtor will be asked to re-settle.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Payment',
          style: 'destructive',
          onPress: async () => {
            setVerifying(true);
            try {
              const ok = await ExpenseService.getInstance().verifySettlementDB(
                selectedSettlement.id,
                targetTripId,
                'rejected'
              );
              if (ok) {
                setSelectedSettlement(null);
                onRefresh?.();
              }
            } finally {
              setVerifying(false);
            }
          },
        },
      ]
    );
  };

  // Debtor Actions
  const handleSaveEdit = async () => {
    const targetTripId = tripId || selectedSettlement?.tripId;
    if (!selectedSettlement || !targetTripId) {
      console.warn('handleSaveEdit returning early:', { selectedSettlement, tripId, targetTripId });
      Alert.alert('Error', 'Cannot save: payment or trip information is missing.');
      return;
    }
    setSavingEdit(true);
    try {
      const ok = await ExpenseService.getInstance().editSettlementDB(
        selectedSettlement.id,
        targetTripId,
        {
          proofUri: newProofUri || undefined,
          notes: editedNotes.trim(),
        }
      );
      if (ok) {
        setIsEditingProof(false);
        const updated = ExpenseService.getInstance().getSettlements().find((s) => s.id === selectedSettlement.id);
        if (updated) {
          setSelectedSettlement(updated);
        }
        onRefresh?.();
      } else {
        Alert.alert('Error', 'Failed to update payment proof.');
      }
    } catch (e: any) {
      console.warn('handleSaveEdit error:', e);
      Alert.alert('Error', e.message || 'Something went wrong.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteSettlement = () => {
    console.log('[handleDeleteSettlement] button pressed!', { selectedSettlement, tripId });
    const targetTripId = tripId || selectedSettlement?.tripId || settleUpItem?.items?.[0]?.settlement?.tripId;
    if (!selectedSettlement || !targetTripId) {
      console.warn('[handleDeleteSettlement] returning early:', { selectedSettlement, tripId, targetTripId });
      Alert.alert('Error', 'Cannot delete: payment or trip reference is missing.');
      return;
    }
    setShowDeleteConfirm(true);
  };

  const confirmDeletePayment = async () => {
    const targetTripId = tripId || selectedSettlement?.tripId || settleUpItem?.items?.[0]?.settlement?.tripId;
    if (!selectedSettlement || !targetTripId) {
      setShowDeleteConfirm(false);
      Alert.alert('Error', 'Cannot delete: payment or trip reference is missing.');
      return;
    }

    setDeleting(true);
    try {
      const ok = await ExpenseService.getInstance().deleteSettlementDB(
        selectedSettlement.id,
        targetTripId
      );
      if (ok) {
        setShowDeleteConfirm(false);
        setSelectedSettlement(null);
        onRefresh?.();
      } else {
        setShowDeleteConfirm(false);
        Alert.alert(
          'Delete Failed',
          'Could not delete the payment. This is likely a database permission issue — check the Metro console for the exact error from [deleteSettlementDB].'
        );
      }
    } catch (e: any) {
      setShowDeleteConfirm(false);
      console.warn('handleDeleteSettlement error:', e);
      Alert.alert('Error', e?.message || 'Something went wrong.');
    } finally {
      setDeleting(false);
    }
  };

  const effectiveTripId = tripId || selectedSettlement?.tripId || settleUpItem?.items?.[0]?.settlement?.tripId || '';
  const effectivePayerId = settleUpItem?.fromUserId || settleUpItem?.items?.[0]?.debtorId || effectiveUserId || '';
  const effectivePayeeId = settleUpItem?.toUserId || settleUpItem?.items?.[0]?.creditorId || '';
  const effectivePayeeName = settleUpItem?.toUser || settleUpItem?.items?.[0]?.creditorName || 'Payee';
  const displayImageUri = newProofUri || selectedSettlement?.proofUrl;

  return (
    <>
      <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.6} useKeyboardAvoiding>
        <View
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
          style={{
            backgroundColor: colors.paper,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: '94%',
            paddingHorizontal: 20,
            paddingBottom: Platform.OS === 'ios' ? 34 : 22,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 20,
          }}
        >
          {/* Handle bar */}
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? '#4B5563' : '#D1D5DB' }} />
          </View>

          {/* ======================= VIEW 1: SETTLEMENT DRILLDOWN DETAILS ======================= */}
          {selectedSettlement ? (
            <>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.md }}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedSettlement(null);
                    setIsEditingProof(false);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <ChevronLeft size={20} color={colors.tealDark} />
                  <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.tealDark }}>
                    Back to Items
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={18} color={colors.ink} />
                </TouchableOpacity>
              </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }} contentContainerStyle={{ paddingBottom: 16 }}>
                  {/* Status Banner */}
                  {!isEditingProof && (
                    <View
                      style={{
                        backgroundColor:
                          selectedSettlement.status === 'verified'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : selectedSettlement.status === 'pending'
                            ? 'rgba(245, 158, 11, 0.12)'
                            : 'rgba(239, 68, 68, 0.12)',
                        borderColor:
                          selectedSettlement.status === 'verified'
                            ? colors.emerald
                            : selectedSettlement.status === 'pending'
                            ? '#F59E0B'
                            : '#EF4444',
                        borderWidth: 1,
                        borderRadius: 14,
                        padding: sp.sm + 2,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: sp.md,
                      }}
                    >
                    {selectedSettlement.status === 'verified' ? (
                      <CheckCircle2 size={18} color={colors.emerald} />
                    ) : selectedSettlement.status === 'pending' ? (
                      <Clock size={18} color="#F59E0B" />
                    ) : (
                      <AlertTriangle size={18} color="#EF4444" />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: fs.xs,
                          fontWeight: '800',
                          color:
                            selectedSettlement.status === 'verified'
                              ? colors.emerald
                              : selectedSettlement.status === 'pending'
                              ? '#B45309'
                              : '#DC2626',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {selectedSettlement.status === 'verified'
                          ? 'Payment Verified'
                          : selectedSettlement.status === 'pending'
                          ? isCreditor
                            ? 'Verification Requested'
                            : 'Pending Creditor Verification'
                          : 'Payment Rejected'}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.inkSoft, marginTop: 1 }}>
                        {selectedSettlement.status === 'verified'
                          ? `Verified by ${selectedSettlement.payeeName}`
                          : selectedSettlement.status === 'pending'
                          ? isCreditor
                            ? 'Check the proof photo below and verify if received.'
                            : `Waiting for ${selectedSettlement.payeeName} to confirm.`
                          : 'Payment proof was rejected.'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Transfer Card */}
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: colors.inkSoft }}>
                        Payer
                      </Text>
                      <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink, marginTop: 2 }}>
                        {selectedSettlement.payerName}
                      </Text>
                    </View>
                    <ArrowRight size={16} color={colors.inkSoft} />
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: colors.inkSoft }}>
                        Recipient
                      </Text>
                      <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink, marginTop: 2 }}>
                        {selectedSettlement.payeeName}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      marginTop: sp.sm,
                      paddingTop: sp.sm,
                      borderTopWidth: 1,
                      borderTopColor: colors.cardBorder,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.inkSoft }}>Amount</Text>
                    <Text style={{ fontSize: fs.xl, fontWeight: '900', color: colors.tealDark }}>
                      {formatCurrency(selectedSettlement.amount)}
                    </Text>
                  </View>
                </View>

                {/* View Payee's Bank / QR Info Card */}
                <TouchableOpacity
                  onPress={() => setMemberPaymentModalVisible(true)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isDark ? 'rgba(13,148,136,0.12)' : '#F0FDFA',
                    borderWidth: 1,
                    borderColor: colors.tealDark,
                    borderRadius: 14,
                    padding: sp.sm + 2,
                    marginBottom: sp.md,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 6 }}>
                    <QrCode size={18} color={colors.tealDark} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: fs.xs, fontWeight: '900', color: colors.tealDark }}>
                        View {effectivePayeeName}'s E-Wallet & Bank Info
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.inkSoft }}>
                        GCash, Maya, Bank numbers & QR codes
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={16} color={colors.tealDark} />
                </TouchableOpacity>

                {/* Items Covered */}
                {selectedSettlement.items && selectedSettlement.items.length > 0 && (
                  <View style={{ marginBottom: sp.md }}>
                    <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: sp.xs, letterSpacing: 0.5 }}>
                      Items Covered ({selectedSettlement.items.length})
                    </Text>
                    <View
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        overflow: 'hidden',
                      }}
                    >
                      {selectedSettlement.items.map((it, idx) => (
                        <View
                          key={it.id}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingVertical: sp.sm,
                            paddingHorizontal: sp.md,
                            borderBottomWidth: idx === selectedSettlement.items!.length - 1 ? 0 : 1,
                            borderBottomColor: colors.cardBorder,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <Receipt size={14} color={colors.tealDark} />
                            <Text numberOfLines={1} style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink, flex: 1 }}>
                              {it.expenseTitle || 'Expense Item'}
                            </Text>
                          </View>
                          <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.tealDark }}>
                            {formatCurrency(it.amount)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Proof Photo */}
                <View style={{ marginBottom: sp.md }}>
                  <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: sp.xs, letterSpacing: 0.5 }}>
                    Proof of Payment
                  </Text>

                  {displayImageUri ? (
                    <View
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={isEditingProof ? 1 : 0.9}
                        onPress={() => (!isEditingProof ? setCarouselVisible(true) : undefined)}
                      >
                        <RNImage
                          source={{ uri: displayImageUri }}
                          style={{ width: '100%', height: 210 }}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>

                      {!isEditingProof && (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => setCarouselVisible(true)}
                          style={{
                            position: 'absolute',
                            bottom: 8,
                            right: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: 'rgba(0,0,0,0.65)',
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 100,
                          }}
                        >
                          <Eye size={13} color="#FFFFFF" />
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>View Full Photo</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        borderStyle: 'dashed',
                        padding: sp.md,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: fs.xs, color: colors.inkSoft }}>
                        No proof photo attached.
                      </Text>
                    </View>
                  )}

                  {/* Editing image buttons */}
                  {isEditingProof && (
                    <View style={{ flexDirection: 'row', gap: sp.sm, marginTop: sp.sm }}>
                      <TouchableOpacity
                        onPress={takePhoto}
                        activeOpacity={0.8}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.cardBorder,
                          borderRadius: 12,
                          paddingVertical: 10,
                        }}
                      >
                        <Camera size={16} color={colors.tealDark} />
                        <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink }}>Take Photo</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={pickFromLibrary}
                        activeOpacity={0.8}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.cardBorder,
                          borderRadius: 12,
                          paddingVertical: 10,
                        }}
                      >
                        <ImagePlus size={16} color={colors.tealDark} />
                        <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink }}>Pick New</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Notes Section */}
                <View style={{ marginBottom: sp.md }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 4 }}>
                    Payment Note / Reference
                  </Text>
                  {isEditingProof ? (
                    <TextInput
                      value={editedNotes}
                      onChangeText={setEditedNotes}
                      placeholder="e.g. GCash Ref #123456789"
                      placeholderTextColor={colors.inkSoft}
                      style={{
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder,
                        borderWidth: 1,
                        borderRadius: 14,
                        padding: 12,
                        fontSize: fs.sm,
                        color: colors.ink,
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        padding: sp.md,
                      }}
                    >
                      <Text style={{ fontSize: fs.xs, color: selectedSettlement.notes ? colors.ink : colors.inkSoft, lineHeight: 18 }}>
                        {selectedSettlement.notes || 'No notes attached.'}
                      </Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={{ paddingTop: sp.sm, gap: 8 }}>
                {/* CREDITOR ACTIONS */}
                {isCreditor && selectedSettlement.status === 'pending' && (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleVerify}
                      disabled={verifying}
                      style={{
                        backgroundColor: '#10B981',
                        paddingVertical: 13,
                        borderRadius: 100,
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: '#10B981',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 8,
                        elevation: 3,
                      }}
                    >
                      {verifying ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ShieldCheck size={18} color="#FFFFFF" />
                          <Text style={{ color: '#FFFFFF', fontSize: fs.sm, fontWeight: '800' }}>
                            Approve & Confirm Received
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleReject}
                      disabled={verifying}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        paddingVertical: 10,
                        borderRadius: 100,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: colors.redAccent, fontSize: fs.xs, fontWeight: '700' }}>
                        Reject Payment
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* DEBTOR ACTIONS - Only when pending! */}
                {isDebtor && selectedSettlement.status === 'pending' && (
                  <>
                    {isEditingProof ? (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={handleSaveEdit}
                          disabled={savingEdit}
                          style={{
                            flex: 1,
                            backgroundColor: colors.tealDark,
                            paddingVertical: 12,
                            borderRadius: 100,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {savingEdit ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <Text style={{ color: '#FFFFFF', fontSize: fs.xs, fontWeight: '800' }}>
                              Save Changes
                            </Text>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => {
                            setIsEditingProof(false);
                            setNewProofUri(null);
                            setEditedNotes(selectedSettlement.notes || '');
                          }}
                          style={{
                            flex: 1,
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                            paddingVertical: 12,
                            borderRadius: 100,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={{ color: colors.inkSoft, fontSize: fs.xs, fontWeight: '700' }}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => setIsEditingProof(true)}
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            backgroundColor: colors.card,
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                            paddingVertical: 12,
                            borderRadius: 100,
                          }}
                        >
                          <Pencil size={14} color={colors.tealDark} />
                          <Text style={{ color: colors.ink, fontSize: fs.xs, fontWeight: '800' }}>
                            Edit Proof
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={handleDeleteSettlement}
                          disabled={deleting}
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            backgroundColor: '#FEE2E2',
                            borderWidth: 1,
                            borderColor: '#FECACA',
                            paddingVertical: 12,
                            borderRadius: 100,
                          }}
                        >
                          {deleting ? (
                            <ActivityIndicator color="#EF4444" />
                          ) : (
                            <>
                              <Trash2 size={14} color="#EF4444" />
                              <Text style={{ color: '#EF4444', fontSize: fs.xs, fontWeight: '800' }}>
                                Delete Payment
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* --- CENTERED DELETE CONFIRMATION OVERLAY (Matches Trip Planner modal) --- */}
              {showDeleteConfirm && (
                <View
                  style={{
                    position: 'absolute',
                    top: -windowHeight,
                    bottom: -windowHeight,
                    left: -windowWidth,
                    right: -windowWidth,
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 24,
                    zIndex: 99999,
                    elevation: 999,
                  }}
                >
                  <TouchableOpacity
                    style={StyleSheet.absoluteFillObject}
                    activeOpacity={1}
                    onPress={() => !deleting && setShowDeleteConfirm(false)}
                  />
                  <View
                    style={{
                      width: '100%',
                      maxWidth: 340,
                      backgroundColor: isDark ? colors.paper : '#FFFFFF',
                      borderRadius: 28,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      padding: 24,
                      alignItems: 'center',
                      elevation: 12,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.25,
                      shadowRadius: 16,
                      transform: [
                        {
                          translateY: sheetHeight ? (sheetHeight - windowHeight) / 2 : 0,
                        },
                      ],
                    }}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FCE8E6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 14,
                      }}
                    >
                      <Trash2 size={26} color="#EF4444" strokeWidth={2.2} />
                    </View>

                    <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink, textAlign: 'center', marginBottom: 6 }}>
                      Delete Payment?
                    </Text>

                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
                      Deleting this payment will remove the uploaded proof and immediately revert all covered items back to unpaid debts. This action cannot be undone.
                    </Text>

                    <View style={{ width: '100%', gap: 10 }}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={confirmDeletePayment}
                        disabled={deleting}
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
                        {deleting ? (
                          <ActivityIndicator color="#FFF" />
                        ) : (
                          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                            Yes, Delete Payment
                          </Text>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setShowDeleteConfirm(false)}
                        disabled={deleting}
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
              )}
            </>
          ) : isPayingSelected ? (
          /* ======================= VIEW 3: IN-MODAL SETTLE PAYMENT FORM ======================= */
          <>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.md }}>
              <TouchableOpacity
                onPress={() => setIsPayingSelected(false)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <ChevronLeft size={20} color={colors.tealDark} />
                <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.tealDark }}>
                  Back to Items
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }} contentContainerStyle={{ paddingBottom: 16 }}>
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
                  {effectivePayeeName}
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
                    {formatCurrency(selectedAmount)}
                  </Text>
                </View>
              </View>

              {/* View Payee's Bank / QR Info Card in View 3 */}
              <TouchableOpacity
                onPress={() => setMemberPaymentModalVisible(true)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isDark ? 'rgba(13,148,136,0.12)' : '#F0FDFA',
                  borderWidth: 1,
                  borderColor: colors.tealDark,
                  borderRadius: 14,
                  padding: sp.sm + 2,
                  marginBottom: sp.md,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 6 }}>
                  <QrCode size={18} color={colors.tealDark} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: fs.xs, fontWeight: '900', color: colors.tealDark }}>
                      View {effectivePayeeName}'s E-Wallet & Bank Info
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.inkSoft }}>
                      GCash, Maya, Bank numbers & QR codes
                    </Text>
                  </View>
                </View>
                <ChevronRight size={16} color={colors.tealDark} />
              </TouchableOpacity>

              {/* Selected Items List */}
              <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: sp.xs, letterSpacing: 0.5 }}>
                Items included ({selectedDebts.length})
              </Text>
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  padding: sp.sm,
                  marginBottom: sp.md,
                  gap: 6,
                }}
              >
                {selectedDebts.map((debt) => (
                  <View
                    key={debt.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 4,
                    }}
                  >
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: fs.xs, fontWeight: '700', color: colors.ink, paddingRight: 8 }}>
                      {debt.expenseTitle}
                    </Text>
                    <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.tealDark }}>
                      {formatCurrency(debt.amountOwed)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Proof of Payment */}
              <View style={{ marginBottom: sp.md }}>
                <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
                  Proof of Payment (Optional)
                </Text>
                <Text style={{ fontSize: 11, color: colors.inkSoft, marginBottom: sp.sm }}>
                  Attach a screenshot or photo of your payment transfer / receipt.
                </Text>

                {paymentProofUri ? (
                  <View style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.cardBorder, marginBottom: sp.sm }}>
                    <RNImage
                      source={{ uri: paymentProofUri }}
                      style={{ width: '100%', height: 180, resizeMode: 'cover' }}
                    />
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setPaymentProofUri(null)}
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        borderRadius: 100,
                        padding: 6,
                      }}
                    >
                      <X size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', gap: sp.sm }}>
                  <TouchableOpacity
                    onPress={takePaymentPhoto}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      borderRadius: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <Camera size={18} color={colors.tealDark} />
                    <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.ink }}>
                      Take Photo
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={pickPaymentFromLibrary}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.cardBorder,
                      borderRadius: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <ImagePlus size={18} color={colors.tealDark} />
                    <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.ink }}>
                      Upload Photo
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Notes Input */}
              <View style={{ marginBottom: sp.md }}>
                <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
                  Payment Note / Reference (Optional)
                </Text>
                <TextInput
                  value={paymentNotes}
                  onChangeText={setPaymentNotes}
                  placeholder="e.g. GCash Ref #123456789"
                  placeholderTextColor={colors.inkSoft}
                  style={{
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    fontSize: fs.sm,
                    color: colors.ink,
                  }}
                />
              </View>
            </ScrollView>

            {/* Submit Action */}
            <View style={{ paddingTop: sp.sm }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSubmitPayment}
                disabled={submittingPayment}
                style={{
                  backgroundColor: colors.tealDark,
                  paddingVertical: 14,
                  borderRadius: 100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  shadowColor: colors.tealDark,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                {submittingPayment ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <ShieldCheck size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: fs.sm, fontWeight: '800' }}>
                      Submit Payment ({formatCurrency(selectedAmount)})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* ======================= VIEW 2: BREAKDOWN CHECKLIST ======================= */
            <>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.md }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ fontSize: fs.xl, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>
                    Settle Up Breakdown
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink }}>
                      {settleUpItem.fromUser}
                    </Text>
                    <ArrowRight size={13} color={colors.inkSoft} />
                    <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink }}>
                      {settleUpItem.toUser}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setMemberPaymentModalVisible(true)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      backgroundColor: isDark ? 'rgba(13,148,136,0.15)' : '#CCFBF1',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(13,148,136,0.3)' : '#99F6E4',
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 100,
                      alignSelf: 'flex-start',
                      marginTop: 8,
                    }}
                  >
                    <QrCode size={12} color={colors.tealDark} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.tealDark }}>
                      View {settleUpItem.toUser}'s Bank / QR
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={18} color={colors.ink} />
                </TouchableOpacity>
              </View>

              {/* Action Required Banner for Creditor */}
              {isCreditor && pendingItems.length > 0 && (
                <View
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.12)',
                    borderColor: '#F59E0B',
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: sp.sm + 2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: sp.md,
                  }}
                >
                  <Clock size={18} color="#F59E0B" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: fs.xs, fontWeight: '800', color: '#B45309', textTransform: 'uppercase' }}>
                      Action Required: {pendingItems.length} of {items.length} items to approve
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.inkSoft, marginTop: 1 }}>
                      Tap any pending item below to inspect proof and verify payment received.
                    </Text>
                  </View>
                </View>
              )}

              {/* Balance Overview Pill */}
              <View
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  padding: sp.md,
                  marginBottom: sp.md,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: colors.inkSoft }}>
                    Remaining Unpaid
                  </Text>
                  <Text style={{ fontSize: fs.lg, fontWeight: '900', color: colors.redAccent, marginTop: 2 }}>
                    {formatCurrency(settleUpItem.unpaidAmount)}
                  </Text>
                </View>
                {settleUpItem.pendingAmount > 0 && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#F59E0B' }}>
                      Pending Verification
                    </Text>
                    <Text style={{ fontSize: fs.md, fontWeight: '900', color: '#F59E0B', marginTop: 2 }}>
                      {formatCurrency(settleUpItem.pendingAmount)}
                    </Text>
                  </View>
                )}
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 520, marginBottom: sp.sm }}
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                {/* UNPAID ITEMS SECTION */}
                <View style={{ marginBottom: sp.lg }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.xs }}>
                    <Text style={{ fontSize: fs.xs, fontWeight: '800', textTransform: 'uppercase', color: colors.inkSoft, letterSpacing: 0.5 }}>
                      Unpaid Items ({unpaidItems.length})
                    </Text>
                    {isDebtor && unpaidItems.length > 1 && (
                      <TouchableOpacity onPress={handleSelectAll}>
                        <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.tealDark }}>
                          {selectedIds.length === unpaidItems.length ? 'Deselect All' : 'Select All'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {unpaidItems.length === 0 ? (
                    <View
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        padding: sp.md,
                        alignItems: 'center',
                      }}
                    >
                      <CheckCircle2 size={24} color={colors.emerald} />
                      <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.emerald, marginTop: 4 }}>
                        No Unpaid Items
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.inkSoft, marginTop: 2 }}>
                        All expenses between you two are submitted or verified.
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
                      {unpaidItems.map((item, idx) => {
                        const isSelected = selectedIds.includes(item.id);
                        const IconComp = CATEGORY_ICONS[item.categoryIconName] || Receipt;

                        return (
                          <TouchableOpacity
                            key={item.id}
                            activeOpacity={isDebtor ? 0.7 : 1}
                            onPress={() => (isDebtor ? toggleSelect(item.id) : undefined)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              padding: sp.md,
                              gap: sp.sm,
                              borderBottomWidth: idx === unpaidItems.length - 1 ? 0 : 1,
                              borderBottomColor: colors.cardBorder,
                              backgroundColor: isSelected ? 'rgba(13, 148, 136, 0.08)' : 'transparent',
                            }}
                          >
                            {isDebtor && (
                              <TouchableOpacity onPress={() => toggleSelect(item.id)} style={{ padding: 2 }}>
                                {isSelected ? (
                                  <CheckSquare size={20} color={colors.tealDark} />
                                ) : (
                                  <Square size={20} color={colors.inkSoft} />
                                )}
                              </TouchableOpacity>
                            )}

                            <View
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 12,
                                backgroundColor: item.categoryBg || colors.paperDim,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <IconComp size={18} color={item.iconColor || colors.tealDark} />
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text numberOfLines={1} style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>
                                {item.expenseTitle}
                              </Text>
                              <Text style={{ fontSize: 11, color: colors.inkSoft, marginTop: 1 }}>
                                {item.date} · Split with {item.splitCount} people
                              </Text>
                            </View>

                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontSize: fs.sm, fontWeight: '900', color: colors.ink }}>
                                {formatCurrency(item.amountOwed)}
                              </Text>
                              {isDebtor && (
                                <TouchableOpacity
                                  onPress={() => openPaymentModal(item)}
                                  style={{
                                    backgroundColor: colors.tealDark,
                                    paddingHorizontal: 8,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                    marginTop: 3,
                                  }}
                                >
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFFFFF' }}>
                                    Pay Single
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* PENDING VERIFICATION SECTION */}
                {pendingItems.length > 0 && (
                  <View style={{ marginBottom: sp.lg }}>
                    <Text style={{ fontSize: fs.xs, fontWeight: '800', textTransform: 'uppercase', color: colors.inkSoft, marginBottom: sp.xs, letterSpacing: 0.5 }}>
                      Pending Verification ({pendingItems.length})
                    </Text>
                    <View
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        overflow: 'hidden',
                      }}
                    >
                      {pendingItems.map((item, idx) => (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.8}
                          onPress={() => openSettlementDetails(item)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: sp.md,
                            gap: sp.sm,
                            borderBottomWidth: idx === pendingItems.length - 1 ? 0 : 1,
                            borderBottomColor: colors.cardBorder,
                          }}
                        >
                          <View
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 12,
                              backgroundColor: 'rgba(245, 158, 11, 0.12)',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Clock size={18} color="#F59E0B" />
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>
                              {item.expenseTitle}
                            </Text>
                            <Text style={{ fontSize: 11, color: isCreditor ? colors.tealDark : colors.inkSoft, fontWeight: isCreditor ? '700' : '500', marginTop: 1 }}>
                              {isCreditor ? 'Proof submitted · Tap to review' : 'Proof submitted · Tap to view/edit'}
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontSize: fs.sm, fontWeight: '900', color: colors.ink }}>
                                {formatCurrency(item.amountOwed)}
                              </Text>
                              <Text style={{ fontSize: 10, fontWeight: '800', color: '#F59E0B', marginTop: 1 }}>
                                Pending
                              </Text>
                            </View>
                            <ChevronRight size={16} color={colors.inkSoft} />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* VERIFIED SETTLEMENTS SECTION */}
                {verifiedItems.length > 0 && (
                  <View style={{ marginBottom: sp.lg }}>
                    <Text style={{ fontSize: fs.xs, fontWeight: '800', textTransform: 'uppercase', color: colors.inkSoft, marginBottom: sp.xs, letterSpacing: 0.5 }}>
                      Verified & Paid ({verifiedItems.length})
                    </Text>
                    <View
                      style={{
                        backgroundColor: colors.card,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        overflow: 'hidden',
                      }}
                    >
                      {verifiedItems.map((item, idx) => (
                        <TouchableOpacity
                          key={item.id}
                          activeOpacity={0.8}
                          onPress={() => openSettlementDetails(item)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: sp.md,
                            gap: sp.sm,
                            borderBottomWidth: idx === verifiedItems.length - 1 ? 0 : 1,
                            borderBottomColor: colors.cardBorder,
                          }}
                        >
                          <View
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 12,
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <CheckCircle2 size={18} color={colors.emerald} />
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>
                              {item.expenseTitle}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.emerald, fontWeight: '700', marginTop: 1 }}>
                              Verified & Settled
                            </Text>
                          </View>

                          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                            <Text style={{ fontSize: fs.sm, fontWeight: '900', color: colors.emerald }}>
                              {formatCurrency(item.amountOwed)}
                            </Text>
                            <ChevronRight size={16} color={colors.inkSoft} />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Bottom Action for Debtor */}
              {isDebtor && selectedIds.length > 0 && (
                <View style={{ paddingTop: sp.sm }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => openPaymentModal()}
                    style={{
                      backgroundColor: colors.tealDark,
                      paddingVertical: 14,
                      borderRadius: 100,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 8,
                      shadowColor: colors.tealDark,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.25,
                      shadowRadius: 8,
                      elevation: 3,
                    }}
                  >
                    <CreditCard size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: fs.sm, fontWeight: '800' }}>
                      Pay Selected ({selectedIds.length}) · {formatCurrency(selectedAmount)}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </SlideUpModal>

      {/* Full Photo Viewer Carousel */}
      {displayImageUri && (
        <ReceiptPhotoCarousel
          photos={[displayImageUri]}
          initialIndex={0}
          visible={carouselVisible}
          onClose={() => setCarouselVisible(false)}
        />
      )}

      {/* Member Payment & Bank Details Modal */}
      {settleUpItem && (
        <MemberPaymentMethodsModal
          visible={memberPaymentModalVisible}
          onClose={() => setMemberPaymentModalVisible(false)}
          memberId={settleUpItem.toUserId || effectivePayeeId || ''}
          memberName={settleUpItem.toUser || effectivePayeeName}
        />
      )}
    </>
  );
};
