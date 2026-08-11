import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Bell, UserCheck, UserPlus, CheckCheck } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { NotificationService, AppNotification } from '../../services/notificationService';
import { ConnectionService } from '../../services/connectionService';
import { supabase } from '../../utils/supabase';

interface NotificationsScreenProps {
  onBack?: () => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const { profile } = useUser();
  const currentUserId = profile?.id;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [localFollowMap, setLocalFollowMap] = useState<Record<string, boolean>>({});

  const loadNotifications = useCallback(async () => {
    if (!currentUserId) {
      setNotifications([]);
      setIsFetching(false);
      return;
    }

    try {
      const dbNotifs = await NotificationService.fetchNotifications(currentUserId);
      setNotifications(dbNotifs);
    } catch (err) {
      setNotifications([]);
    } finally {
      setIsFetching(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadNotifications();

    // Supabase Real-time Subscription for instant notification updates
    if (currentUserId) {
      const channel = supabase
        .channel(`public:notifications:${currentUserId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentUserId}`,
          },
          () => {
            loadNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUserId, loadNotifications]);

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (currentUserId) {
      await NotificationService.markAllAsRead(currentUserId);
    }
  };

  const handleToggleFollowActor = async (actorId?: string) => {
    if (!actorId || !currentUserId) return;

    const notifItem = notifications.find((n) => n.actorId === actorId);
    const currentlyFollowing =
      localFollowMap[actorId] !== undefined
        ? localFollowMap[actorId]
        : notifItem?.isFollowingActor ?? false;

    const newFollowing = !currentlyFollowing;

    setLocalFollowMap((prev) => ({ ...prev, [actorId]: newFollowing }));

    const followerName =
      `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() ||
      profile?.username ||
      'Someone';

    if (newFollowing) {
      await ConnectionService.followUser(currentUserId, actorId, followerName);
    } else {
      await ConnectionService.unfollowUser(currentUserId, actorId);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      {/* Instagram Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backTouch}>
          <ChevronLeft size={24} color={colors.tealDark} />
          <Text style={[styles.backText, { color: colors.tealDark }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7} style={styles.markReadBtn}>
            <CheckCheck size={18} color={colors.tealDark} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {/* Uncarded Instagram Activity Feed */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 0, paddingTop: 4, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadNotifications();
            }}
            tintColor={colors.tealDark}
          />
        }
      >
        {isFetching && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.tealDark} />
            <Text style={[styles.loadingText, { color: colors.inkSoft }]}>Loading activity...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Bell size={40} color={colors.inkSoft} />
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>No Notifications Yet</Text>
            <Text style={[styles.emptySub, { color: colors.inkSoft }]}>
              When someone follows you or follows you back, your activity will show up here.
            </Text>
          </View>
        ) : (
          notifications.map((item, idx) => {
            const isFollowingActor =
              item.actorId && localFollowMap[item.actorId] !== undefined
                ? localFollowMap[item.actorId]
                : item.isFollowingActor ?? false;

            return (
              <View key={item.id}>
                <View
                  style={[
                    styles.notifRow,
                    !item.isRead ? { backgroundColor: isDarkBg(colors.paper) ? 'rgba(255,255,255,0.03)' : 'rgba(1,113,248,0.04)' } : null,
                  ]}
                >
                  {/* Left Avatar with subtle badge */}
                  <View style={{ position: 'relative' }}>
                    <View style={[styles.avatarCircle, { backgroundColor: item.actorAvatarBg }]}>
                      <Text style={styles.avatarText}>{item.actorInitials}</Text>
                    </View>
                    <View style={[styles.typeBadgeCircle, { backgroundColor: colors.tealDark }]}>
                      {item.type === 'follow_back' ? (
                        <UserCheck size={9} color="#FFFFFF" strokeWidth={3} />
                      ) : (
                        <UserPlus size={9} color="#FFFFFF" strokeWidth={3} />
                      )}
                    </View>
                  </View>

                  {/* Middle Instagram Text Format */}
                  <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                    <Text style={styles.igTextLine}>
                      <Text style={[styles.actorName, { color: colors.ink }]}>{item.actorName || 'Someone'} </Text>
                      <Text style={[styles.actionText, { color: colors.ink }]}>
                        {item.type === 'follow_back' ? 'followed you back.' : 'started following you.'}{' '}
                      </Text>
                      <Text style={[styles.timeAgo, { color: colors.inkSoft }]}>{item.timeAgo}</Text>
                    </Text>
                  </View>

                  {/* Right Instagram Action Button */}
                  {item.actorId ? (
                    <TouchableOpacity
                      onPress={() => handleToggleFollowActor(item.actorId)}
                      activeOpacity={0.8}
                      style={[
                        styles.igOvalBtn,
                        isFollowingActor
                          ? [styles.followingIgBtn, { borderColor: colors.cardBorder }]
                          : [styles.followBackIgBtn, { backgroundColor: colors.tealDark }],
                      ]}
                    >
                      {isFollowingActor ? (
                        <Text style={[styles.followingIgBtnText, { color: colors.ink }]}>Following</Text>
                      ) : (
                        <Text style={styles.followBackIgBtnText}>
                          {item.type === 'follow' ? 'Follow Back' : 'Follow'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : null}

                  {/* Unread Blue Dot */}
                  {!item.isRead && <View style={styles.unreadBlueDot} />}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

function isDarkBg(colorString: string) {
  return colorString.toLowerCase() === '#090d16' || colorString.toLowerCase() === '#000000';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  markReadBtn: {
    padding: 6,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 36,
    lineHeight: 18,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
  },
  rowDivider: {
    height: 1,
    opacity: 0.3,
    marginHorizontal: 20,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  typeBadgeCircle: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  igTextLine: {
    fontSize: 13,
    lineHeight: 18,
  },
  actorName: {
    fontWeight: '800',
  },
  actionText: {
    fontWeight: '400',
  },
  timeAgo: {
    fontSize: 12,
    fontWeight: '600',
  },
  igOvalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
  },
  followingIgBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  followingIgBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  followBackIgBtn: {},
  followBackIgBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  unreadBlueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0171F8',
    marginLeft: 6,
  },
});
