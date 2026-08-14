import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Animated, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MailOpen, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { PendingTripInvite } from './TripInvitationModal';

interface TripInvitationBannerProps {
  invite: PendingTripInvite | null;
  onAccept: (tripId: string) => Promise<void>;
  onDecline: (tripId: string) => Promise<void>;
  onClose: () => void;
}

/**
 * Top popup "you got mail" invite. Slide the green thumb to accept, the red
 * thumb to decline — just like a missed call.
 */
export const TripInvitationBanner: React.FC<TripInvitationBannerProps> = ({
  invite,
  onAccept,
  onDecline,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet } = useResponsive();
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [loadingAccept, setLoadingAccept] = useState(false);
  const [loadingDecline, setLoadingDecline] = useState(false);

  useEffect(() => {
    if (!invite) return;
    slideAnim.setValue(-300);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: false,
        bounciness: 9,
        speed: 14,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -300,
          duration: 240,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (finished) onClose?.();
      });
    }, 12000);

    return () => clearTimeout(timer);
  }, [invite?.tripId, slideAnim, opacityAnim, onClose]);

  if (!invite) return null;

  const hasDest = !!invite.destination;
  const hasDate = !!invite.dateRange;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 6 }]}>
      <Animated.View
        style={[
          styles.card,
          isTablet && styles.cardTablet,
          {
            backgroundColor: isDark ? colors.paper : '#FFFFFF',
            borderColor: colors.cardBorder,
            opacity: opacityAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
          <X size={16} color={colors.inkSoft} strokeWidth={2.5} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.stampCircle}>
            <MailOpen size={18} color="#FFFFFF" strokeWidth={2.4} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: colors.tealDark }]}>YOU GOT MAIL</Text>
            <Text style={[styles.title, { color: colors.ink }]}>You in?</Text>
          </View>
        </View>

        {/* Paragraph */}
        <Text style={[styles.paragraph, { color: colors.ink }]}>
          <Text style={styles.hostBold}>{invite.hostName}</Text>
          <Text>{' '}is taking the crew</Text>
          {hasDest ? <Text>{' to '}<Text style={styles.tripBold}>{invite.destination}</Text></Text> : null}
          {hasDate ? <Text>{' ('}{invite.dateRange}{')'}</Text> : null}
          <Text>{' on "'}</Text>
          <Text style={styles.tripBold}>{invite.tripTitle}</Text>
          <Text>{'" — '}{invite.memberCount} already in.{' '}</Text>
        </Text>

        {/* Accept / Reject buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (!loadingAccept && !loadingDecline) {
                setLoadingDecline(true);
                onDecline(invite.tripId).finally(() => setLoadingDecline(false));
              }
            }}
            disabled={loadingAccept || loadingDecline}
            style={[styles.declineBtn, { backgroundColor: '#EF4444' }]}
          >
            {loadingDecline ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>Reject</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (!loadingAccept && !loadingDecline) {
                setLoadingAccept(true);
                onAccept(invite.tripId).finally(() => setLoadingAccept(false));
              }
            }}
            disabled={loadingAccept || loadingDecline}
            style={[styles.acceptBtn, { backgroundColor: '#10B981' }]}
          >
            {loadingAccept ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.btnText}>Accept</Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 12,
  },
  cardTablet: {
    maxWidth: 540,
    alignSelf: 'center',
    width: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingRight: 24,
  },
  stampCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    backgroundColor: '#00B4D8',
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 1,
  },
  paragraph: {
    fontSize: 14.5,
    fontWeight: '500',
    lineHeight: 21,
    marginBottom: 14,
    paddingRight: 6,
  },
  hostBold: {
    fontWeight: '900',
  },
  tripBold: {
    fontWeight: '900',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 100,
  },
  declineBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 100,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});