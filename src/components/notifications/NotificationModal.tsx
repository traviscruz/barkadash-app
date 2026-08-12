import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SlideUpModal } from '../common/SlideUpModal';
import { X, Vote, Receipt, MapPin, Calendar, CheckCheck, Sparkles, UserPlus } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { NotificationService, AppNotification } from '../../services/notificationService';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectInviteNotif?: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
  onSelectInviteNotif,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && profile?.id) {
      setLoading(true);
      NotificationService.fetchNotifications(profile.id).then((items) => {
        setNotifications(items);
        setLoading(false);
      });
    }
  }, [visible, profile?.id]);

  const markAllAsRead = async () => {
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, isRead: true }))
    );
    if (profile?.id) {
      await NotificationService.markAllAsRead(profile.id);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.45}>
      <View style={[styles.modalContent, { backgroundColor: colors.paper, borderColor: colors.cardBorder }]}>
        {/* Header */}
        <View style={[styles.header, { borderColor: colors.cardBorder }]}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.ink }]}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.tealDark }]}>
                <Text style={styles.unreadText}>{unreadCount} New</Text>
              </View>
            )}
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={22} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* Mark All Read Action */}
        {unreadCount > 0 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={markAllAsRead}
            style={styles.markReadBtn}
          >
            <CheckCheck size={14} color={colors.tealDark} />
            <Text style={[styles.markReadText, { color: colors.tealDark }]}>Mark all as read</Text>
          </TouchableOpacity>
        )}

        {/* List */}
        <ScrollView showsVerticalScrollIndicator={false} style={styles.listScroll}>
          {loading ? (
            <ActivityIndicator style={{ paddingVertical: 20 }} color={colors.tealDark} />
          ) : notifications.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: colors.inkSoft, fontWeight: '600' }}>
                No notifications yet!
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {notifications.map((item) => {
                const isInvite = item.type === 'trip_invite';
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (isInvite) {
                        onClose();
                        onSelectInviteNotif?.();
                      }
                    }}
                    style={[
                      styles.notificationItem,
                      { backgroundColor: colors.card, borderColor: !item.isRead ? colors.tealDark : colors.cardBorder },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        { backgroundColor: isInvite ? colors.lightOrangeBg : (isDark ? 'rgba(59,122,158,0.2)' : '#EBF5FB') },
                      ]}
                    >
                      {isInvite ? (
                        <Sparkles size={18} color={colors.orangeAccent} />
                      ) : (
                        <UserPlus size={18} color={colors.tealDark} />
                      )}
                    </View>

                    <View style={styles.itemContent}>
                      <View style={styles.itemHeader}>
                        <Text style={[styles.itemTitle, { color: colors.ink }]}>{item.title}</Text>
                        <Text style={[styles.itemTime, { color: colors.inkSoft }]}>{item.timeAgo}</Text>
                      </View>
                      <Text style={[styles.itemMessage, { color: colors.inkSoft }]}>{item.message}</Text>

                      {isInvite && (
                        <Text style={{ fontSize: 10, fontWeight: '900', color: colors.orangeAccent, marginTop: 4 }}>
                          ✨ Tap to view invitation
                        </Text>
                      )}
                    </View>

                    {!item.isRead && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </SlideUpModal>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: '#FAF8F5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#EAE4D7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#EAE4D7',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1A1D2D',
  },
  unreadBadge: {
    backgroundColor: '#1F4E67',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginBottom: 12,
  },
  markReadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F4E67',
  },
  listScroll: {
    marginBottom: 10,
  },
  listContainer: {
    gap: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAE4D7',
    position: 'relative',
  },
  unreadItem: {
    borderColor: '#1F4E67',
    backgroundColor: '#FFFDF7',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
    paddingRight: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1D2D',
  },
  itemTime: {
    fontSize: 10,
    color: '#6E738A',
    fontWeight: '600',
  },
  itemMessage: {
    fontSize: 12,
    color: '#6E738A',
    lineHeight: 16,
  },
  unreadDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2604A',
  },
});
