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

interface NotificationModalProps {
  visible: boolean;
  onClose: () => void;
}

const INITIAL_NOTIFICATIONS = [
  {
    id: '1',
    icon: Vote,
    iconBg: '#FDEBD3',
    iconColor: '#B8791E',
    title: 'New Poll Vote',
    message: 'Steven voted for Siargao Island in Destination Poll.',
    time: '5m ago',
    unread: true,
  },
  {
    id: '2',
    icon: Receipt,
    iconBg: '#FBE7E1',
    iconColor: '#E2604A',
    title: 'New Ledger Expense',
    message: 'Travis added ₱2,450 Seafood Dinner to the group expense.',
    time: '25m ago',
    unread: true,
  },
  {
    id: '3',
    icon: MapPin,
    iconBg: '#E4F0EA',
    iconColor: '#1F4E67',
    title: 'Barkada Radar Alert',
    message: 'Ahiah checked in at Twin Lagoon, El Nido.',
    time: '1h ago',
    unread: true,
  },
  {
    id: '4',
    icon: Calendar,
    iconBg: '#E4F0F4',
    iconColor: '#3B7A9E',
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
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((item) => ({ ...item, unread: false }))
    );
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.45}>
      <View style={styles.modalContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount} New</Text>
              </View>
            )}
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={22} color="#1A1D2D" />
          </TouchableOpacity>
        </View>

        {/* Mark All Read Action */}
        {unreadCount > 0 && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={markAllAsRead}
            style={styles.markReadBtn}
          >
            <CheckCheck size={14} color="#1F4E67" />
            <Text style={styles.markReadText}>Mark all as read</Text>
          </TouchableOpacity>
        )}

        {/* List */}
        <ScrollView showsVerticalScrollIndicator={false} style={styles.listScroll}>
          <View style={styles.listContainer}>
            {notifications.map((item) => {
              const IconComp = item.icon;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.notificationItem,
                    item.unread ? styles.unreadItem : null,
                  ]}
                >
                  <View
                    style={[styles.iconBox, { backgroundColor: item.iconBg }]}
                  >
                    <IconComp size={18} color={item.iconColor} />
                  </View>

                  <View style={styles.itemContent}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemTime}>{item.time}</Text>
                    </View>
                    <Text style={styles.itemMessage}>{item.message}</Text>
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
