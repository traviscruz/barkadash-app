import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image as RNImage,
  ActivityIndicator,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SlideUpModal } from '../common/SlideUpModal';
import { QrPhotoOverlay } from './QrPhotoOverlay';
import { PaymentMethod, POPULAR_PROVIDERS } from '../../types/paymentMethod';
import { PaymentMethodService } from '../../services/paymentMethodService';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import {
  X,
  QrCode,
  Copy,
  Check,
  Star,
  Wallet,
  ExternalLink,
} from 'lucide-react-native';

interface MemberPaymentMethodsModalProps {
  visible: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
}

export const MemberPaymentMethodsModal: React.FC<MemberPaymentMethodsModalProps> = ({
  visible,
  onClose,
  memberId,
  memberName,
}) => {
  const { colors, isDark } = useTheme();
  const { sp, fs } = useResponsive();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [sheetHeight, setSheetHeight] = useState(0);

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewQrUrl, setPreviewQrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (visible && (memberId || memberName)) {
      setLoading(true);
      setPreviewQrUrl(null);
      PaymentMethodService.getInstance()
        .getPaymentMethods(memberId, memberName)
        .then((data) => setMethods(data))
        .catch((e) => console.warn('MemberPaymentMethodsModal fetch error:', e))
        .finally(() => setLoading(false));
    }
  }, [visible, memberId, memberName]);

  const copyToClipboard = async (id: string, text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.warn('copyToClipboard error:', e);
    }
  };

  return (
    <>
      <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.6} useKeyboardAvoiding>
        <View
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
          style={{
            backgroundColor: colors.paper,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            minHeight: Math.min(windowHeight * 0.82, 680),
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

          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.md }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontSize: fs.xl, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>
                {memberName}'s Payment Info
              </Text>
              <Text style={{ fontSize: fs.xs, color: colors.inkSoft, marginTop: 2 }}>
                Use these e-wallet or bank details to pay your debt
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
                No payment details added yet
              </Text>
              <Text style={{ fontSize: fs.xs, color: colors.inkSoft, textAlign: 'center', marginTop: 4, lineHeight: 18, maxWidth: 260 }}>
                {memberName} hasn't uploaded their e-wallet or bank details yet. You can ask them directly or remind them to add a QR code!
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: Math.min(windowHeight * 0.62, 540) }} contentContainerStyle={{ paddingBottom: 12, gap: 10 }}>
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
                    {/* Top row: Provider Badge & Primary Tag */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
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
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#B45309' }}>Primary Account</Text>
                        </View>
                      )}
                    </View>

                    {/* Account Name */}
                    <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.inkSoft }}>
                      Account Name: <Text style={{ color: colors.ink, fontWeight: '800' }}>{item.accountName}</Text>
                    </Text>

                    {/* Account Number & Copy Button */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
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
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                        }}
                      >
                        {isCopied ? (
                          <>
                            <Check size={13} color="#059669" />
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#059669' }}>Copied!</Text>
                          </>
                        ) : (
                          <>
                            <Copy size={13} color={colors.ink} />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.ink }}>Copy Number</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Notes if any */}
                    {item.notes ? (
                      <Text style={{ fontSize: 11, color: colors.inkSoft, marginTop: 4, fontStyle: 'italic' }}>
                        Note: {item.notes}
                      </Text>
                    ) : null}

                    {/* QR Code Preview Thumbnail */}
                    {item.qrCodeUrl ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setPreviewQrUrl(item.qrCodeUrl!)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          marginTop: 10,
                          paddingTop: 10,
                          borderTopWidth: 1,
                          borderTopColor: colors.cardBorder,
                          backgroundColor: isDark ? 'rgba(13,148,136,0.08)' : '#F0FDFA',
                          padding: 8,
                          borderRadius: 12,
                        }}
                      >
                        <RNImage
                          source={{ uri: item.qrCodeUrl }}
                          style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: '#FFFFFF' }}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <QrCode size={14} color={colors.tealDark} />
                            <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.tealDark }}>
                              Scan QR Code
                            </Text>
                          </View>
                          <Text style={{ fontSize: 11, color: colors.inkSoft, marginTop: 1 }}>
                            Tap to view & zoom full size
                          </Text>
                        </View>
                        <ExternalLink size={14} color={colors.tealDark} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Close Button */}
          <View style={{ paddingTop: sp.sm }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onClose}
              style={{
                borderWidth: 1,
                borderColor: colors.cardBorder,
                paddingVertical: 12,
                borderRadius: 100,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.inkSoft, fontSize: fs.sm, fontWeight: '700' }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>

          {/* ======================= FULLSCREEN QR VIEWER OVERLAY ======================= */}
          <QrPhotoOverlay
            uri={previewQrUrl}
            onClose={() => setPreviewQrUrl(null)}
            sheetHeight={sheetHeight}
          />
        </View>
      </SlideUpModal>
    </>
  );
};
