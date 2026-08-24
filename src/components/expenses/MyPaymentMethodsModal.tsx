import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image as RNImage,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { SlideUpModal } from '../common/SlideUpModal';
import { PaymentMethod, POPULAR_PROVIDERS } from '../../types/paymentMethod';
import { PaymentMethodService } from '../../services/paymentMethodService';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { useResponsive } from '../../utils/responsive';
import {
  X,
  Plus,
  QrCode,
  CreditCard,
  Trash2,
  Pencil,
  Copy,
  Check,
  Camera,
  ImagePlus,
  ChevronLeft,
  Star,
  Wallet,
} from 'lucide-react-native';

interface MyPaymentMethodsModalProps {
  visible: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const MyPaymentMethodsModal: React.FC<MyPaymentMethodsModalProps> = ({
  visible,
  onClose,
  onUpdated,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { sp, fs } = useResponsive();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form mode: null (view list) | 'add' | 'edit'
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);

  // Form inputs
  const [selectedProvider, setSelectedProvider] = useState('GCash');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [removeQr, setRemoveQr] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // QR Full Preview
  const [previewQrUrl, setPreviewQrUrl] = useState<string | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);

  const myId = profile?.id;
  const fullName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || profile?.username || 'Account Holder';

  const loadMethods = async () => {
    if (!myId) return;
    setLoading(true);
    try {
      const data = await PaymentMethodService.getInstance().getPaymentMethods(myId);
      setMethods(data);
    } catch (e) {
      console.warn('loadMethods error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && myId) {
      loadMethods();
      setFormMode(null);
      setEditingMethod(null);
      setDeletingId(null);
    }
  }, [visible, myId]);

  const openAddForm = () => {
    setSelectedProvider('GCash');
    setAccountName(fullName);
    setAccountNumber('');
    setNotes('');
    setIsPrimary(methods.length === 0);
    setQrUri(null);
    setRemoveQr(false);
    setEditingMethod(null);
    setFormMode('add');
  };

  const openEditForm = (m: PaymentMethod) => {
    setSelectedProvider(m.provider);
    setAccountName(m.accountName);
    setAccountNumber(m.accountNumber);
    setNotes(m.notes || '');
    setIsPrimary(!!m.isPrimary);
    setQrUri(null);
    setRemoveQr(false);
    setEditingMethod(m);
    setFormMode('edit');
  };

  const takeQrPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to scan/photograph your QR code.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        quality: 0.85,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setQrUri(res.assets[0].uri);
        setRemoveQr(false);
      }
    } catch (e) {
      console.warn('takeQrPhoto error:', e);
    }
  };

  const pickQrFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required to pick a QR code image.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        quality: 0.85,
        allowsMultipleSelection: false,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setQrUri(res.assets[0].uri);
        setRemoveQr(false);
      }
    } catch (e) {
      console.warn('pickQrFromLibrary error:', e);
    }
  };

  const handleSave = async () => {
    if (!accountName.trim()) {
      Alert.alert('Missing Name', 'Please enter an account name.');
      return;
    }
    if (!accountNumber.trim()) {
      Alert.alert('Missing Number', 'Please enter an account number or mobile number.');
      return;
    }
    if (!myId) return;

    setSaving(true);
    try {
      const providerObj = POPULAR_PROVIDERS.find((p) => p.name.toLowerCase() === selectedProvider.toLowerCase());
      const type = providerObj?.type || 'ewallet';

      if (formMode === 'add') {
        const added = await PaymentMethodService.getInstance().addPaymentMethod({
          userId: myId,
          type,
          provider: selectedProvider,
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          qrUri: qrUri || undefined,
          isPrimary,
          notes: notes.trim() || undefined,
        });
        if (added) {
          await loadMethods();
          setFormMode(null);
          onUpdated?.();
        }
      } else if (formMode === 'edit' && editingMethod) {
        const ok = await PaymentMethodService.getInstance().editPaymentMethod(editingMethod.id, myId, {
          type,
          provider: selectedProvider,
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          qrUri: qrUri || undefined,
          removeQr,
          isPrimary,
          notes: notes.trim() || undefined,
        });
        if (ok) {
          await loadMethods();
          setFormMode(null);
          onUpdated?.();
        }
      }
    } catch (e: any) {
      console.warn('handleSave paymentMethod error:', e);
      Alert.alert('Error', e?.message || 'Failed to save payment method.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId || !myId) return;
    const target = methods.find((m) => m.id === deletingId);
    setDeleting(true);
    try {
      await PaymentMethodService.getInstance().deletePaymentMethod(deletingId, myId, target?.rawQrPath);
      setDeletingId(null);
      await loadMethods();
      onUpdated?.();
    } catch (e: any) {
      console.warn('confirmDelete paymentMethod error:', e);
      Alert.alert('Error', e?.message || 'Failed to delete payment method.');
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = async (id: string, text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.warn('copyToClipboard error:', e);
    }
  };

  const displayQrPreview = qrUri || (removeQr ? null : editingMethod?.qrCodeUrl);

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

          {/* ======================= VIEW: FORM (ADD / EDIT) ======================= */}
          {formMode ? (
            <>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.md }}>
                <TouchableOpacity
                  onPress={() => setFormMode(null)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <ChevronLeft size={20} color={colors.tealDark} />
                  <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.tealDark }}>
                    My Accounts
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

              <Text style={{ fontSize: fs.lg, fontWeight: '900', color: colors.ink, marginBottom: sp.sm }}>
                {formMode === 'add' ? 'Add E-Wallet / Bank Account' : 'Edit Account Details'}
              </Text>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }} contentContainerStyle={{ paddingBottom: 16 }}>
                {/* Provider Selector Pills */}
                <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                  Select Provider / Bank
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: sp.md }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {POPULAR_PROVIDERS.map((p) => {
                      const isSelected = selectedProvider.toLowerCase() === p.name.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={p.id}
                          activeOpacity={0.8}
                          onPress={() => setSelectedProvider(p.name)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 9,
                            borderRadius: 100,
                            backgroundColor: isSelected ? colors.tealDark : colors.card,
                            borderWidth: 1,
                            borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: fs.xs,
                              fontWeight: isSelected ? '800' : '700',
                              color: isSelected ? '#FFFFFF' : colors.ink,
                            }}
                          >
                            {p.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Account Name Input */}
                <View style={{ marginBottom: sp.md }}>
                  <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
                    Account Name
                  </Text>
                  <TextInput
                    value={accountName}
                    onChangeText={setAccountName}
                    placeholder="e.g. Juan Dela Cruz"
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

                {/* Account Number Input */}
                <View style={{ marginBottom: sp.md }}>
                  <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
                    Account Number / Mobile Number
                  </Text>
                  <TextInput
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                    placeholder="e.g. 0917 123 4567 or 1234-5678-90"
                    placeholderTextColor={colors.inkSoft}
                    keyboardType="default"
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

                {/* QR Code Upload */}
                <View style={{ marginBottom: sp.md }}>
                  <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>
                    QR Code Image (Optional)
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.inkSoft, marginBottom: sp.sm }}>
                    Upload your GCash, Maya, or Bank QR code so friends can scan and pay you easily.
                  </Text>

                  {displayQrPreview ? (
                    <View style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.cardBorder, marginBottom: sp.sm }}>
                      <RNImage
                        source={{ uri: displayQrPreview }}
                        style={{ width: '100%', height: 200, resizeMode: 'contain', backgroundColor: isDark ? '#1F2937' : '#F9FAFB' }}
                      />
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          setQrUri(null);
                          setRemoveQr(true);
                        }}
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
                      onPress={takeQrPhoto}
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
                      onPress={pickQrFromLibrary}
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
                        Upload QR Image
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Primary Toggle */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setIsPrimary(!isPrimary)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    borderRadius: 14,
                    padding: sp.md,
                    marginBottom: sp.md,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>
                      Set as Primary Account
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.inkSoft, marginTop: 2 }}>
                      This account will appear first when friends settle debts with you.
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: isPrimary ? colors.tealDark : colors.cardBorder,
                      backgroundColor: isPrimary ? colors.tealDark : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isPrimary && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              </ScrollView>

              {/* Submit Button */}
              <View style={{ paddingTop: sp.sm }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleSave}
                  disabled={saving}
                  style={{
                    backgroundColor: colors.tealDark,
                    paddingVertical: 14,
                    borderRadius: 100,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.tealDark,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontSize: fs.sm, fontWeight: '800' }}>
                      {formMode === 'add' ? 'Save Payment Method' : 'Update Payment Method'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* ======================= VIEW: LIST ACCOUNTS ======================= */
            <>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.md }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ fontSize: fs.xl, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>
                    My E-Wallets & Bank Accounts
                  </Text>
                  <Text style={{ fontSize: fs.xs, color: colors.inkSoft, marginTop: 2 }}>
                    Add your GCash, Maya, and bank info for easy settlements
                  </Text>
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

              {loading ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={colors.tealDark} />
                </View>
              ) : methods.length === 0 ? (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    borderStyle: 'dashed',
                    padding: sp.xl,
                    alignItems: 'center',
                    marginVertical: sp.md,
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: isDark ? 'rgba(13,148,136,0.15)' : '#CCFBF1',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <Wallet size={26} color={colors.tealDark} />
                  </View>
                  <Text style={{ fontSize: fs.base, fontWeight: '900', color: colors.ink, textAlign: 'center' }}>
                    No payment accounts added yet
                  </Text>
                  <Text style={{ fontSize: fs.xs, color: colors.inkSoft, textAlign: 'center', marginTop: 4, lineHeight: 18, maxWidth: 260 }}>
                    Add your GCash or bank account details with a QR code so your trip mates can easily scan and pay you.
                  </Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }} contentContainerStyle={{ paddingBottom: 12, gap: 10 }}>
                  {methods.map((item) => {
                    const providerInfo = POPULAR_PROVIDERS.find((p) => p.name.toLowerCase() === item.provider.toLowerCase());
                    const badgeBg = providerInfo?.bgColor || (isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6');
                    const badgeColor = providerInfo?.color || colors.ink;
                    const isCopied = copiedId === item.id;

                    return (
                      <View
                        key={item.id}
                        style={{
                          backgroundColor: colors.card,
                          borderRadius: 18,
                          borderWidth: 1,
                          borderColor: colors.cardBorder,
                          padding: sp.md,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.05,
                          shadowRadius: 6,
                          elevation: 2,
                        }}
                      >
                        {/* Top row: Provider Badge & Actions */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View
                              style={{
                                backgroundColor: badgeBg,
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '900', color: badgeColor }}>
                                {item.provider}
                              </Text>
                            </View>

                            {item.isPrimary && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(245, 158, 11, 0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Star size={10} color="#F59E0B" fill="#F59E0B" />
                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#B45309' }}>Primary</Text>
                              </View>
                            )}
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => openEditForm(item)}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Pencil size={13} color={colors.ink} />
                            </TouchableOpacity>

                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => setDeletingId(item.id)}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor: '#FEE2E2',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Trash2 size={13} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Account Name & Number with Copy */}
                        <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.inkSoft }}>
                          {item.accountName}
                        </Text>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <Text style={{ fontSize: fs.base, fontWeight: '900', color: colors.ink, letterSpacing: 0.5 }}>
                            {item.accountNumber}
                          </Text>

                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => copyToClipboard(item.id, item.accountNumber)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              backgroundColor: isCopied ? '#D1FAE5' : (isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6'),
                              paddingHorizontal: 9,
                              paddingVertical: 5,
                              borderRadius: 8,
                            }}
                          >
                            {isCopied ? (
                              <>
                                <Check size={12} color="#059669" />
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#059669' }}>Copied</Text>
                              </>
                            ) : (
                              <>
                                <Copy size={12} color={colors.ink} />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.ink }}>Copy</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>

                        {/* QR Code Preview Thumbnail */}
                        {item.qrCodeUrl ? (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => setPreviewQrUrl(item.qrCodeUrl!)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              marginTop: 10,
                              paddingTop: 10,
                              borderTopWidth: 1,
                              borderTopColor: colors.cardBorder,
                            }}
                          >
                            <RNImage
                              source={{ uri: item.qrCodeUrl }}
                              style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: isDark ? '#374151' : '#E5E7EB' }}
                            />
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <QrCode size={13} color={colors.tealDark} />
                                <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.tealDark }}>
                                  QR Code Attached
                                </Text>
                              </View>
                              <Text style={{ fontSize: 11, color: colors.inkSoft }}>
                                Tap to view full size
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </ScrollView>
              )}

              {/* Add Account Button */}
              <View style={{ paddingTop: sp.sm }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={openAddForm}
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
                  <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={{ color: '#FFFFFF', fontSize: fs.sm, fontWeight: '800' }}>
                    Add Payment Method
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ======================= CENTERED DELETE CONFIRMATION DIALOG ======================= */}
          {deletingId && (
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
                onPress={() => !deleting && setDeletingId(null)}
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
                  Delete Account?
                </Text>

                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
                  This will remove this payment method and QR code from your profile.
                </Text>

                <View style={{ width: '100%', gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={confirmDelete}
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
                        Yes, Delete Account
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setDeletingId(null)}
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

          {/* ======================= FULLSCREEN QR CODE VIEWER OVERLAY ======================= */}
          {previewQrUrl && (
            <View
              style={{
                position: 'absolute',
                top: -windowHeight,
                bottom: -windowHeight,
                left: -windowWidth,
                right: -windowWidth,
                backgroundColor: 'rgba(0,0,0,0.85)',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 20,
                zIndex: 99999,
                elevation: 999,
              }}
            >
              <TouchableOpacity
                style={StyleSheet.absoluteFillObject}
                activeOpacity={1}
                onPress={() => setPreviewQrUrl(null)}
              />

              {/* Close Floating Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setPreviewQrUrl(null)}
                style={{
                  position: 'absolute',
                  top: Platform.OS === 'ios' ? 60 : 40,
                  right: 20,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 100,
                }}
              >
                <X size={22} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Centered QR Card */}
              <View
                style={{
                  width: '100%',
                  maxWidth: 340,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 28,
                  padding: 24,
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: 0.4,
                  shadowRadius: 24,
                  elevation: 12,
                  transform: [
                    {
                      translateY: sheetHeight ? (sheetHeight - windowHeight) / 2 : 0,
                    },
                  ],
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <QrCode size={18} color="#0D9488" />
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#111827' }}>
                    My QR Code
                  </Text>
                </View>

                <View
                  style={{
                    width: 250,
                    height: 250,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: '#F9FAFB',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <RNImage
                    source={{ uri: previewQrUrl }}
                    style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
                  />
                </View>

                <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7280', marginTop: 14, textAlign: 'center' }}>
                  Scan with GCash, Maya, or any banking app
                </Text>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setPreviewQrUrl(null)}
                  style={{
                    marginTop: 16,
                    backgroundColor: '#F3F4F6',
                    paddingVertical: 10,
                    paddingHorizontal: 24,
                    borderRadius: 100,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#374151' }}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </SlideUpModal>
    </>
  );
};
