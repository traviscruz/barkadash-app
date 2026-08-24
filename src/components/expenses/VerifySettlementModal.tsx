import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image as RNImage,
  ActivityIndicator,
  Alert,
  TextInput,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ExpenseSettlement } from '../../types/expense';
import { ExpenseService } from '../../services/expenseService';
import { ReceiptPhotoCarousel } from './ReceiptPhotoCarousel';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { useResponsive } from '../../utils/responsive';
import { formatCurrency } from '../../utils/formatters';
import {
  X,
  CheckCircle2,
  Clock,
  Trash2,
  ShieldCheck,
  ArrowRight,
  Receipt,
  Eye,
  AlertTriangle,
  Pencil,
  Camera,
  ImagePlus,
  RotateCcw,
} from 'lucide-react-native';

interface VerifySettlementModalProps {
  settlement: ExpenseSettlement | null;
  visible: boolean;
  onClose: () => void;
  currentUserId?: string;
  onSettlementUpdated?: () => void;
}

export const VerifySettlementModal: React.FC<VerifySettlementModalProps> = ({
  settlement,
  visible,
  onClose,
  currentUserId,
  onSettlementUpdated,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { sp, fs } = useResponsive();

  const [carouselVisible, setCarouselVisible] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [newProofUri, setNewProofUri] = useState<string | null>(null);

  useEffect(() => {
    if (settlement && visible) {
      setIsEditing(false);
      setEditedNotes(settlement.notes || '');
      setNewProofUri(null);
      setShowDeleteConfirm(false);
    }
  }, [settlement, visible]);

  if (!settlement) return null;

  const effectiveUserId = currentUserId || profile?.id;
  const isDebtor = effectiveUserId ? effectiveUserId === settlement.payerId : false;
  const isCreditor = effectiveUserId ? effectiveUserId === settlement.payeeId : false;
  const isPending = settlement.status === 'pending';
  const isVerified = settlement.status === 'verified';

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        setNewProofUri(res.assets[0].uri);
      }
    } catch (e: any) {
      console.warn('takePhoto error:', e);
    }
  };

  const pickFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        setNewProofUri(res.assets[0].uri);
      }
    } catch (e: any) {
      console.warn('pickFromLibrary error:', e);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const ok = await ExpenseService.getInstance().verifySettlementDB(
        settlement.id,
        settlement.tripId,
        'verified'
      );
      if (ok) {
        onSettlementUpdated?.();
        onClose();
      } else {
        Alert.alert('Error', 'Failed to approve payment. Please try again.');
      }
    } catch (e: any) {
      console.warn('handleVerify error:', e);
      Alert.alert('Error', e.message || 'Something went wrong.');
    } finally {
      setVerifying(false);
    }
  };

  const handleReject = () => {
    Alert.alert(
      'Reject Payment?',
      'The debtor will be notified to correct and re-upload payment proof.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setVerifying(true);
            try {
              const ok = await ExpenseService.getInstance().verifySettlementDB(
                settlement.id,
                settlement.tripId,
                'rejected'
              );
              if (ok) {
                onSettlementUpdated?.();
                onClose();
              }
            } catch (e: any) {
              console.warn('handleReject error:', e);
            } finally {
              setVerifying(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const ok = await ExpenseService.getInstance().editSettlementDB(
        settlement.id,
        settlement.tripId,
        {
          proofUri: newProofUri || undefined,
          notes: editedNotes.trim(),
        }
      );

      if (ok) {
        setIsEditing(false);
        setNewProofUri(null);
        onSettlementUpdated?.();
        onClose();
      } else {
        Alert.alert('Error', 'Failed to update payment proof.');
      }
    } catch (e: any) {
      console.warn('handleSaveEdit error:', e);
      Alert.alert('Error', e.message || 'Something went wrong while saving changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeletePayment = async () => {
    setDeleting(true);
    try {
      const ok = await ExpenseService.getInstance().deleteSettlementDB(
        settlement.id,
        settlement.tripId
      );
      if (ok) {
        setShowDeleteConfirm(false);
        onSettlementUpdated?.();
        onClose();
      } else {
        setShowDeleteConfirm(false);
        Alert.alert('Error', 'Failed to delete payment.');
      }
    } catch (e: any) {
      setShowDeleteConfirm(false);
      console.warn('handleDelete settlement error:', e);
      Alert.alert('Error', e?.message || 'Something went wrong.');
    } finally {
      setDeleting(false);
    }
  };

  const displayImageUri = newProofUri || settlement.proofUrl;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-center items-center bg-black/60 p-4">
        <View
          style={{ backgroundColor: colors.paper, borderColor: colors.cardBorder }}
          className="rounded-3xl w-full max-h-[88%] p-5 border shadow-lg"
        >
          {showDeleteConfirm ? (
            /* --- DELETE CONFIRMATION VIEW --- */
            <View style={{ paddingVertical: 14, alignItems: 'center' }}>
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FCE8E6',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                <Trash2 size={28} color="#EF4444" strokeWidth={2.2} />
              </View>

              <Text style={{ fontSize: 19, fontWeight: '900', color: colors.ink, textAlign: 'center', marginBottom: 8 }}>
                Delete Payment?
              </Text>

              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: colors.inkSoft,
                  textAlign: 'center',
                  lineHeight: 20,
                  marginBottom: 24,
                  paddingHorizontal: 8,
                }}
              >
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
          ) : (
            <>
              {/* Header */}
              <View className="flex-row justify-between items-center pb-2 mb-2">
                <Text style={{ color: colors.ink }} className="text-lg font-extrabold">
                  {isEditing ? 'Edit Payment Proof' : 'Payment Details'}
                </Text>
                <TouchableOpacity onPress={onClose} className="p-1">
                  <X size={22} color={colors.ink} />
                </TouchableOpacity>
              </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Status Banner */}
            {!isEditing && (
              <View
                style={{
                  backgroundColor: isVerified
                    ? 'rgba(16, 185, 129, 0.12)'
                    : isPending
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)',
                  borderColor: isVerified
                    ? colors.emerald
                    : isPending
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
                {isVerified ? (
                  <CheckCircle2 size={18} color={colors.emerald} />
                ) : isPending ? (
                  <Clock size={18} color="#F59E0B" />
                ) : (
                  <AlertTriangle size={18} color="#EF4444" />
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: fs.xs,
                      fontWeight: '800',
                      color: isVerified
                        ? colors.emerald
                        : isPending
                        ? '#B45309'
                        : '#DC2626',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {isVerified
                      ? 'Payment Verified'
                      : isPending
                      ? isCreditor
                        ? 'Verification Requested'
                        : 'Pending Creditor Verification'
                      : 'Rejected'}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.inkSoft, marginTop: 1 }}>
                    {isVerified
                      ? `Verified and confirmed by ${settlement.payeeName}`
                      : isPending
                      ? isCreditor
                        ? 'Please inspect the proof photo below and approve if received.'
                        : `Waiting for ${settlement.payeeName} to confirm.`
                      : 'Payment was not confirmed.'}
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
                    {settlement.payerName}
                  </Text>
                </View>
                <ArrowRight size={16} color={colors.inkSoft} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: colors.inkSoft }}>
                    Recipient
                  </Text>
                  <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink, marginTop: 2 }}>
                    {settlement.payeeName}
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
                  {formatCurrency(settlement.amount)}
                </Text>
              </View>
            </View>

            {/* Covered Items */}
            {settlement.items && settlement.items.length > 0 && (
              <View style={{ marginBottom: sp.md }}>
                <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: sp.xs, letterSpacing: 0.5 }}>
                  Items Covered ({settlement.items.length})
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
                  {settlement.items.map((it, idx) => (
                    <View
                      key={it.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: sp.sm,
                        paddingHorizontal: sp.md,
                        borderBottomWidth: idx === settlement.items!.length - 1 ? 0 : 1,
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

            {/* Proof Photo Section */}
            <View style={{ marginBottom: sp.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.xs }}>
                <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Proof of Payment
                </Text>
                {isEditing && (
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.tealDark }}>
                    {newProofUri ? 'New photo selected' : 'Current photo'}
                  </Text>
                )}
              </View>

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
                    activeOpacity={isEditing ? 1 : 0.9}
                    onPress={() => (!isEditing ? setCarouselVisible(true) : undefined)}
                  >
                    <RNImage
                      source={{ uri: displayImageUri }}
                      style={{ width: '100%', height: 210 }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>

                  {!isEditing && (
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
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>Full Image</Text>
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

              {/* Edit Image Action Buttons (if in editing mode) */}
              {isEditing && (
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
              {isEditing ? (
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
                  <Text style={{ fontSize: fs.xs, color: settlement.notes ? colors.ink : colors.inkSoft, lineHeight: 18 }}>
                    {settlement.notes || 'No notes attached.'}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={{ paddingTop: sp.sm, gap: 8 }}>
            {/* CREDITOR ACTIONS (Approve / Reject) */}
            {isCreditor && isPending && (
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

            {/* DEBTOR ACTIONS (Edit / Delete / Save) - Only when status is pending! */}
            {isDebtor && isPending && (
              <>
                {isEditing ? (
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
                        setIsEditing(false);
                        setNewProofUri(null);
                        setEditedNotes(settlement.notes || '');
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
                      onPress={() => setIsEditing(true)}
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
                      onPress={handleDelete}
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
        </>
      )}
    </View>

        {displayImageUri && (
          <ReceiptPhotoCarousel
            photos={[displayImageUri]}
            initialIndex={0}
            visible={carouselVisible}
            onClose={() => setCarouselVisible(false)}
          />
        )}
      </View>
    </Modal>
  );
};
