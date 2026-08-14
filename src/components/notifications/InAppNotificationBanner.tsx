import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export interface InAppNotifPayload {
  id: string;
  actorName?: string;
  actorInitials?: string;
  actorAvatarBg?: string;
  title: string;
  message: string;
  type: string;
}

interface InAppNotificationBannerProps {
  notification: InAppNotifPayload | null;
  onPress?: () => void;
  onClose?: () => void;
  topOffset?: number;
}

/**
 * Global "someone followed you / poll ended" banner shown at the top of the
 * app while it's open. Slides in, auto-dismisses, and is tappable to jump
 * to the Notifications screen.
 */
export const InAppNotificationBanner: React.FC<InAppNotificationBannerProps> = ({
  notification,
  onPress,
  onClose,
  topOffset = 0,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-140)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!notification) return;
    slideAnim.setValue(-140);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 8,
        speed: 14,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -140,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onClose?.();
      });
    }, 4500);

    return () => clearTimeout(timer);
  }, [notification?.id, slideAnim, opacityAnim, onClose]);

  if (!notification) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + 6 + topOffset }]}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            opacity: opacityAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.touchArea}>
          <View style={[styles.iconCircle, { backgroundColor: colors.lightOrangeBg }]}>
            <Bell size={18} color={colors.orangeAccent} strokeWidth={2.4} />
          </View>

          <View style={styles.textArea}>
            <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={[styles.message, { color: colors.inkSoft }]} numberOfLines={2}>
              {notification.message}
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: colors.tealDark }]} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
          <X size={15} color={colors.inkSoft} strokeWidth={2.5} />
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  touchArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textArea: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 2,
  },
  badge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 10,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 4,
  },
});