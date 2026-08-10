import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SlideUpModal } from '../common/SlideUpModal';
import { X, Vote, Receipt, MapPin, Calendar, CheckCheck } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

const INITIAL_NOTIFICATIONS = [
  {
    id: '1',
    icon: Vote,
    iconBgKey: 'lightOrangeBg',
    iconColorKey: 'orangeAccent',
    title: 'New Poll Vote',
    message: 'Steven voted for Siargao Island in Destination Poll.',
    time: '5m ago',
    unread: true,
  },
  {
    id: '2',
    icon: Receipt,
    iconBgKey: 'lightRedBg',
    iconColorKey: 'redAccent',
    title: 'New Ledger Expense',
    message: 'Travis added ₱2,450 Seafood Dinner to the group expense.',
    time: '25m ago',
    unread: true,
  },
  {
    id: '3',
    icon: MapPin,
    iconBgKey: 'lightGreenBg',
    iconColorKey: 'tealDark',
    title: 'Barkada Radar Alert',
    message: 'Ahiah checked in at Twin Lagoon, El Nido.',
    time: '1h ago',
    unread: true,
  },
  {
    id: '4',
    icon: Calendar,
    iconBgKey: 'lightBlueBg',
    iconColorKey: 'sky',
    title: 'Upcoming Activity',
    message: 'Island Hopping Tour scheduled tomorrow at 8:00 AM.',
    time: '3h ago',
    unread: false,
  },
];

export const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, unread: false }))
    );
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

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
          <View style={styles.listContainer}>
            {notifications.map((item) => {
              const IconComp = item.icon;
              const bg = (colors as any)[item.iconBgKey] || colors.subtleBg;
              const fg = (colors as any)[item.iconColorKey] || colors.tealDark;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.notificationItem,
                    { backgroundColor: colors.card, borderColor: item.unread ? colors.tealDark : colors.cardBorder },
                  ]}
                >
                  <View
                    style={[styles.iconBox, { backgroundColor: bg }]}
                  >
                    <IconComp size={18} color={fg} />
                  </View>

                  <View style={styles.itemContent}>
                    <View style={styles.itemHeader}>
                      <Text style={[styles.itemTitle, { color: colors.ink }]}>{item.title}</Text>
                      <Text style={[styles.itemTime, { color: colors.inkSoft }]}>{item.time}</Text>
                    </View>
                    <Text style={[styles.itemMessage, { color: colors.inkSoft }]}>{item.message}</Text>
                  </View>

                  {item.unread && <View style={styles.unreadDot} />}
                </View>
              );
            })}
          </View>
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
