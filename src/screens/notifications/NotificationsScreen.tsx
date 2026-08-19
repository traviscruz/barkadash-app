import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Bell, UserCheck, UserPlus, CheckCheck, Sparkles, CheckCircle2, XCircle, Trash2, MapPin, ThumbsUp, BedDouble, MessageCircle } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { NotificationService, AppNotification } from '../../services/notificationService';
import { ConnectionService } from '../../services/connectionService';
import { supabase } from '../../utils/supabase';
import { TripInvitationModal, PendingTripInvite } from '../../components/trip/TripInvitationModal';
import { TripService } from '../../services/tripService';
import { SwipeableNotificationRow } from '../../components/notifications/SwipeableNotificationRow';

interface NotificationsScreenProps {
  onBack?: () => void;
  onNavigateToTab?: (index: number) => void;
  onNavigateToConnections?: () => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onBack, onNavigateToTab, onNavigateToConnections }) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const currentUserId = profile?.id;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [localFollowMap, setLocalFollowMap] = useState<Record<string, boolean>>({});
  const [currentInvite, setCurrentInvite] = useState<PendingTripInvite | null>(null);
  const [activeNotifId, setActiveNotifId] = useState<string | null>(null);
  const [inviteStatusMap, setInviteStatusMap] = useState<Record<string, 'pending' | 'accepted' | 'declined'>>({});
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const handleAcceptInviteNotification = async (notif: AppNotification) => {
    if (!currentUserId) return;
    setInviteStatusMap((prev) => ({ ...prev, [notif.id]: 'accepted' }));
    
    const invites = await TripService.getInstance().fetchPendingTripInvitesDB(currentUserId);
    if (invites.length > 0) {
      const tripId = invites[0].tripId;
      await TripService.getInstance().acceptTripInviteDB(tripId, currentUserId);
      NotificationService.createTripInviteResponseNotification(currentUserId, tripId, 'accepted');
      onNavigateToTab?.(1);
    }
  };

  const handleDeclineInviteNotification = async (notif: AppNotification) => {
    if (!currentUserId) return;
    setInviteStatusMap((prev) => ({ ...prev, [notif.id]: 'declined' }));

    const invites = await TripService.getInstance().fetchPendingTripInvitesDB(currentUserId);
    if (invites.length > 0) {
      const tripId = invites[0].tripId;
      await TripService.getInstance().declineTripInviteDB(tripId, currentUserId);
      NotificationService.createTripInviteResponseNotification(currentUserId, tripId, 'declined');
    }
  };

  const loadNotifications = useCallback(async () => {
    if (!currentUserId) {
      setNotifications([]);
      setIsFetching(false);
      return;
    }

    try {
      const dbNotifs = await NotificationService.fetchNotifications(currentUserId);
      setNotifications(dbNotifs);

      // Fetch pending invites for user
      const pendingInvites = await TripService.getInstance().fetchPendingTripInvitesDB(currentUserId);
      const hasPendingInvite = pendingInvites.length > 0;

      // Ensure statuses are isolated per notification ID without bulk overwriting
      setInviteStatusMap((prev) => {
        const statusMap = { ...prev };
        const inviteNotifs = dbNotifs.filter((n) => n.type === 'trip_invite');
        if (inviteNotifs.length > 0) {
          const latestNotifId = inviteNotifs[0].id;
          if (hasPendingInvite && !statusMap[latestNotifId]) {
            statusMap[latestNotifId] = 'pending';
          }
        }
        return statusMap;
      });
    } catch (err) {
      setNotifications([]);
    } finally {
      setIsFetching(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  const handleOpenInviteModal = async (notifId?: string) => {
    if (notifId) setActiveNotifId(notifId);
    if (currentUserId) {
      const invites = await TripService.getInstance().fetchPendingTripInvitesDB(currentUserId);
      if (invites.length > 0) {
        setCurrentInvite(invites[0]);
      }
    }
  };

  const handleOpenNotification = async (item: AppNotification) => {
    // Mark as read (no highlight) regardless of destination
    if (!item.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      await NotificationService.markAsRead(item.id);
    }

    if (item.type === 'trip_invite') {
      handleOpenInviteModal(item.id);
      return;
    }
    if (item.type === 'follow' || item.type === 'follow_back') {
      onBack?.();
      onNavigateToConnections?.();
      return;
    }
    if (item.type === 'itinerary_added' || item.type === 'itinerary_reaction' || item.type === 'poll_result' || item.type === 'stay_added' || item.type === 'stay_reaction' || item.type === 'stay_comment') {
      onBack?.();
      onNavigateToTab?.(1);
      return;
    }
    // system notifications have nowhere to go — stay put
  };

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

  const handleDeleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (currentUserId) {
      await NotificationService.deleteNotification(id);
    }
  };

  const handleDeleteAll = () => {
    setShowDeleteAllModal(true);
  };

  const confirmDeleteAll = async () => {
    if (!currentUserId || deletingAll) return;
    setDeletingAll(true);
    try {
      await NotificationService.deleteAllNotifications(currentUserId);
      setNotifications([]);
      setInviteStatusMap({});
      setLocalFollowMap({});
    } finally {
      setDeletingAll(false);
      setShowDeleteAllModal(false);
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

  const isDarkBg = (colorStr: string) => {
    return colorStr.toLowerCase() === '#1a1d2d' || colorStr.toLowerCase() === '#0f2a3c' || colorStr.toLowerCase() === '#090d16' || colorStr.toLowerCase() === '#000000';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      {/* Top Bar */}
      <View style={[styles.headerBar, { borderColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={onBack} style={styles.backTouch} activeOpacity={0.7}>
          <ChevronLeft size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text pointerEvents="none" style={[styles.headerTitle, { color: colors.ink }]}>Notifications</Text>

        <View style={styles.headerActions}>
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleDeleteAll} activeOpacity={0.7} style={styles.markReadBtn}>
              <Trash2 size={18} color={colors.inkSoft} />
            </TouchableOpacity>
          )}
          {notifications.some((n) => !n.isRead) ? (
            <TouchableOpacity onPress={handleMarkAllRead} activeOpacity={0.7} style={styles.markReadBtn}>
              <CheckCheck size={18} color={colors.tealDark} />
            </TouchableOpacity>
          ) : (
            notifications.length === 0 && <View style={{ width: 36 }} />
          )}
        </View>
      </View>

      {/* Main List */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
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
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {isFetching ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.tealDark} />
            <Text style={[styles.loadingText, { color: colors.inkSoft }]}>Loading activity...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Bell size={40} color={colors.inkSoft} />
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>No Notifications Yet</Text>
            <Text style={[styles.emptySub, { color: colors.inkSoft }]}>
              When someone follows you or invites you to a trip, your activity will show up here.
            </Text>
          </View>
        ) : (
          notifications.map((item) => {
            const isInvite = item.type === 'trip_invite';
            const isSocial = item.type === 'follow' || item.type === 'follow_back';
            const isSystem =
              item.type === 'system' ||
              item.type === 'poll_result' ||
              item.type === 'itinerary_added' ||
              item.type === 'itinerary_reaction' ||
              item.type === 'stay_added' ||
              item.type === 'stay_reaction' ||
              item.type === 'stay_comment';
            const isInviteResponse = item.type === 'trip_invite_response';
            const isAcceptedResp = isInviteResponse && item.title?.toLowerCase().includes('accepted');
            const respTripTitle = isInviteResponse ? item.message.match(/"(.*?)"/)?.[1] : null;
            const isFollowingActor =
              item.actorId && localFollowMap[item.actorId] !== undefined
                ? localFollowMap[item.actorId]
                : item.isFollowingActor ?? false;

            return (
              <SwipeableNotificationRow
                key={item.id}
                isOpen={openRowId === item.id}
                onOpenChange={(open) => setOpenRowId(open ? item.id : null)}
                onDelete={() => handleDeleteNotification(item.id)}
                onDragStateChange={(dragging) =>
                  scrollRef.current?.setNativeProps({ scrollEnabled: !dragging })
                }
              >
              <TouchableOpacity
                activeOpacity={isInvite ? 0.8 : 0.7}
                onPress={() => handleOpenNotification(item)}
              >
                <View
                  style={[
                    styles.notifRow,
                    !item.isRead ? { backgroundColor: isDarkBg(colors.paper) ? 'rgba(255,255,255,0.03)' : 'rgba(1,113,248,0.04)' } : null,
                  ]}
                >
                  {/* Left Avatar with badge */}
                  <View style={{ position: 'relative' }}>
                    <View style={[styles.avatarCircle, { backgroundColor: item.actorAvatarBg }]}>
                      <Text style={styles.avatarText}>{item.actorInitials}</Text>
                    </View>
                    <View style={[styles.typeBadgeCircle, { backgroundColor: isInvite ? '#FF9F1C' : isInviteResponse ? (isAcceptedResp ? '#10B981' : '#EF4444') : colors.tealDark }]}>
                      {isInvite ? (
                        <Sparkles size={9} color="#FFFFFF" strokeWidth={3} />
                      ) : isInviteResponse ? (
                        isAcceptedResp ? (
                          <CheckCircle2 size={9} color="#FFFFFF" strokeWidth={3} />
                        ) : (
                          <XCircle size={9} color="#FFFFFF" strokeWidth={3} />
                        )
                      ) : item.type === 'follow_back' ? (
                        <UserCheck size={9} color="#FFFFFF" strokeWidth={3} />
                      ) : item.type === 'itinerary_added' ? (
                        <MapPin size={9} color="#FFFFFF" strokeWidth={3} />
                      ) : item.type === 'itinerary_reaction' ? (
                        <ThumbsUp size={9} color="#FFFFFF" strokeWidth={3} />
                      ) : item.type === 'stay_added' ? (
                        <BedDouble size={9} color="#FFFFFF" strokeWidth={3} />
                      ) : item.type === 'stay_reaction' ? (
                        <ThumbsUp size={9} color="#FFFFFF" strokeWidth={3} />
                      ) : item.type === 'stay_comment' ? (
                        <MessageCircle size={9} color="#FFFFFF" strokeWidth={3} />
                      ) : isSystem ? (
                        <Bell size={9} color="#FFFFFF" strokeWidth={3} />
                      ) : (
                        <UserPlus size={9} color="#FFFFFF" strokeWidth={3} />
                      )}
                    </View>
                  </View>

                  {/* Middle Text */}
                  <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                    {isInviteResponse ? (
                      <Text style={styles.igTextLine}>
                        <Text style={[styles.actorName, { color: colors.ink }]}>{item.actorName || 'Someone'} </Text>
                        <Text style={[styles.actionText, { color: colors.ink }]}>
                          {isAcceptedResp ? 'accepted' : 'declined'} your invitation to join{' '}
                        </Text>
                        <Text style={[styles.actionText, { color: colors.tealDark, fontWeight: '800' }]}>
                          "{respTripTitle || 'your trip'}"
                        </Text>
                        <Text style={[styles.timeAgo, { color: colors.inkSoft }]}>{' '}{item.timeAgo}</Text>
                      </Text>
                    ) : isSystem ? (
                      <Text style={styles.igTextLine}>
                        <Text style={[styles.actorName, { color: colors.ink }]}>{item.title || 'Barkadash'} </Text>
                        <Text style={[styles.actionText, { color: colors.ink }]}>{item.message}{' '}</Text>
                        <Text style={[styles.timeAgo, { color: colors.inkSoft }]}>{item.timeAgo}</Text>
                      </Text>
                    ) : (
                      <Text style={styles.igTextLine}>
                        <Text style={[styles.actorName, { color: colors.ink }]}>{item.actorName || 'Someone'} </Text>
                        <Text style={[styles.actionText, { color: colors.ink }]}>
                          {isInvite ? 'invited you to join a trip!' : item.type === 'follow_back' ? 'followed you back.' : 'started following you.'}{' '}
                        </Text>
                        <Text style={[styles.timeAgo, { color: colors.inkSoft }]}>{item.timeAgo}</Text>
                      </Text>
                    )}
                  </View>

                  {/* Right Button / Status Badge */}
                  {isInvite ? (
                    (() => {
                      const currentStatus = inviteStatusMap[item.id] || 'pending';
                      if (currentStatus === 'accepted') {
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#E6F4EA', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 }}>
                            <CheckCircle2 size={12} color="#10B981" />
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#10B981' }}>Accepted</Text>
                          </View>
                        );
                      }
                      if (currentStatus === 'declined') {
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FCE8E6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 }}>
                            <XCircle size={12} color="#EF4444" />
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#EF4444' }}>Declined</Text>
                          </View>
                        );
                      }
                      return (
                        <TouchableOpacity
                          onPress={() => handleOpenInviteModal(item.id)}
                          activeOpacity={0.85}
                          style={[styles.igOvalBtn, { backgroundColor: colors.orangeAccent }]}
                        >
                          <Text style={[styles.followBackIgBtnText, { color: '#FFF' }]}>View Invitation</Text>
                        </TouchableOpacity>
                      );
                    })()
                  ) : isSocial && item.actorId ? (
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
                </View>
              </TouchableOpacity>
              </SwipeableNotificationRow>
            );
          })
        )}
      </ScrollView>

      {/* Trip Invitation Modal */}
      <TripInvitationModal
        visible={!!currentInvite}
        invite={currentInvite}
        onClose={() => {
          setCurrentInvite(null);
          setActiveNotifId(null);
        }}
        onAccept={async (tripId) => {
          if (currentUserId) {
            await TripService.getInstance().acceptTripInviteDB(tripId, currentUserId);
            NotificationService.createTripInviteResponseNotification(currentUserId, tripId, 'accepted');
            if (activeNotifId) {
              setInviteStatusMap((prev) => ({ ...prev, [activeNotifId]: 'accepted' }));
            }
            setCurrentInvite(null);
            setActiveNotifId(null);
            onBack?.();
            onNavigateToTab?.(1);
          }
        }}
        onDecline={async (tripId) => {
          if (currentUserId) {
            await TripService.getInstance().declineTripInviteDB(tripId, currentUserId);
            NotificationService.createTripInviteResponseNotification(currentUserId, tripId, 'declined');
            if (activeNotifId) {
              setInviteStatusMap((prev) => ({ ...prev, [activeNotifId]: 'declined' }));
            }
            setCurrentInvite(null);
            setActiveNotifId(null);
          }
        }}
      />

      {/* Delete All Notifications Confirmation Modal */}
      <Modal
        transparent
        visible={showDeleteAllModal}
        animationType="fade"
        onRequestClose={() => setShowDeleteAllModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowDeleteAllModal(false)} />
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: isDark ? colors.paper : '#FFFFFF', borderRadius: 28, borderWidth: 1, borderColor: colors.cardBorder, padding: 24, alignItems: 'center', elevation: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FCE8E6', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Trash2 size={26} color="#EF4444" strokeWidth={2.2} />
            </View>

            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink, textAlign: 'center', marginBottom: 6 }}>
              Delete all notifications?
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
              This clears your entire activity list. This can't be undone.
            </Text>

            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={confirmDeleteAll}
                disabled={deletingAll}
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
                {deletingAll ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                    Yes, Delete All
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowDeleteAllModal(false)}
                disabled={deletingAll}
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
      </Modal>
    </SafeAreaView>
  );
};

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
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  markReadBtn: {
    padding: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 92,
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
