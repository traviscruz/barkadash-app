import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Share,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { useResponsive } from '../../utils/responsive';
import { AppColors } from '../../utils/colors';
import { SlideUpModal } from '../common/SlideUpModal';
import { Trip, MAX_TRIP_MEMBERS } from '../../types/trip';
import { TripService } from '../../services/tripService';
import { ConnectionService, DBUserConnection } from '../../services/connectionService';
import { isWithinTripDates, getTripDayInfo } from '../../utils/tripDates';
import {
  X,
  Copy,
  Check,
  Share2,
  Users,
  UserPlus,
  Crown,
  Search,
  KeyRound,
  CheckCircle2,
  Clock,
  UserMinus,
  LogOut,
  RotateCcw,
  AlertTriangle,
  Flag,
  Pencil,
  Settings,
  ChevronDown,
  ChevronUp,
  Star,
  ShieldCheck,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react-native';

interface TripDetailsModalProps {
  visible: boolean;
  trip: Trip | null;
  onClose: () => void;
  onTripUpdated?: () => void;
  onEditTour?: () => void;
}

export interface TripMember {
  id: string;
  name: string;
  handle: string;
  initials: string;
  avatarBg: string;
  avatarUrl?: string;
  role: 'host' | 'co-host' | 'member';
  status?: 'accepted' | 'pending';
}

export const TripDetailsModal: React.FC<TripDetailsModalProps> = ({
  visible,
  trip,
  onClose,
  onTripUpdated,
  onEditTour,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { sp, fs } = useResponsive();

  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isParticipantsCollapsed, setIsParticipantsCollapsed] = useState(false);

  // Invite more friends mode
  const [isInviteMode, setIsInviteMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsList, setFriendsList] = useState<DBUserConnection[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (visible && trip) {
      setIsInviteMode(false);
      setSelectedFriends([]);
      setSearchQuery('');
      loadMembers();
    }
  }, [visible, trip?.id]);

  const loadMembers = async () => {
    if (!trip?.id) return;
    setLoadingMembers(true);
    try {
      const dbMembers = await TripService.getInstance().fetchTripParticipantsDB(trip.id);
      setMembers(dbMembers);
    } catch (e) {
      console.warn('Error loading trip members:', e);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadFriendsToInvite = async (query: string) => {
    setLoadingFriends(true);
    try {
      const results = await ConnectionService.searchUsers(query, profile?.id);
      // Filter out existing members
      const memberIds = new Set(members.map((m) => m.id));
      const filtered = results.filter((f) => !memberIds.has(f.id));
      setFriendsList(filtered);
    } catch (e) {
      console.warn('Error searching friends to invite:', e);
      setFriendsList([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleOpenInviteMode = () => {
    setIsInviteMode(true);
    loadFriendsToInvite('');
  };

  const isPrimaryHost =
    (!!profile?.id && trip?.hostId === profile.id) ||
    trip?.hostName === 'You' ||
    (!trip?.hostId && members.length > 0 && members[0]?.id === profile?.id);

  const isCurrentHost =
    isPrimaryHost ||
    members.some((m) => m.id === profile?.id && (m.role === 'host' || m.role === 'co-host')) ||
    members.length === 0 ||
    !trip?.hostId;

  const [kickTarget, setKickTarget] = useState<{ id: string; name: string } | null>(null);
  const [loadingKick, setLoadingKick] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [loadingLeave, setLoadingLeave] = useState(false);

  // Role & Host Management State
  const [roleActionTarget, setRoleActionTarget] = useState<TripMember | null>(null);
  const [transferTarget, setTransferTarget] = useState<TripMember | null>(null);
  const [loadingRoleAction, setLoadingRoleAction] = useState(false);
  const [showHostSwitchPicker, setShowHostSwitchPicker] = useState(false);

  const handleToggleCoHost = async (target: TripMember) => {
    if (!trip || !profile?.id) return;
    const newRole: 'co-host' | 'member' = target.role === 'co-host' ? 'member' : 'co-host';
    setLoadingRoleAction(true);
    try {
      const res = await TripService.getInstance().setParticipantRoleDB(
        trip.id,
        target.id,
        newRole,
        profile.id
      );
      if (res.success) {
        setMembers((prev) =>
          prev.map((m) => (m.id === target.id ? { ...m, role: newRole } : m))
        );
        setRoleActionTarget(null);
        onTripUpdated?.();
      } else {
        Alert.alert('Role Update', res.message || 'Could not update participant role.');
      }
    } finally {
      setLoadingRoleAction(false);
    }
  };

  const confirmTransferHost = async () => {
    if (!trip || !transferTarget || !profile?.id) return;
    setLoadingRoleAction(true);
    try {
      const res = await TripService.getInstance().transferHostDB(
        trip.id,
        transferTarget.id,
        profile.id
      );
      if (res.success) {
        setMembers((prev) =>
          prev.map((m) => {
            if (m.id === transferTarget.id) return { ...m, role: 'host' };
            if (m.id === profile.id) return { ...m, role: 'co-host' };
            return m;
          })
        );
        setTransferTarget(null);
        setRoleActionTarget(null);
        setShowHostSwitchPicker(false);
        onTripUpdated?.();
      } else {
        Alert.alert('Transfer Host', res.message || 'Could not transfer host ownership.');
      }
    } finally {
      setLoadingRoleAction(false);
    }
  };

  // Complete Trip & Undo Complete State
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [showUndoModal, setShowUndoModal] = useState(false);
  const [loadingUndo, setLoadingUndo] = useState(false);

  const withinDates = trip ? isWithinTripDates(trip.dateRange) : false;
  const dayInfo = trip ? getTripDayInfo(trip.dateRange) : null;
  const isTripCompleted = trip ? TripService.getInstance().isTripEnded(trip) : false;

  // Tour has started ONLY if today is within trip dates and on/after Day 1, or already completed
  const hasTourStarted = (!!withinDates && !dayInfo?.isBeforeStart) || isTripCompleted;

  // Edit Tour: ONLY if the tour hasn't started yet and trip is NOT completed
  const canEditTour = isCurrentHost && !hasTourStarted && !isTripCompleted;

  // End Tour (End Trip Early / Complete): ONLY if Day 1 has started and NOT completed
  const canEndTour = isCurrentHost && hasTourStarted && !isTripCompleted;

  // Reopen Tour: ONLY if completed AND trip registered dates are not past today's date
  const canReopenTour = isCurrentHost && isTripCompleted && !dayInfo?.isEnded;

  const confirmCompleteTrip = async () => {
    if (!trip || !profile?.id) return;
    setLoadingComplete(true);
    try {
      const res = await TripService.getInstance().completeTripDB(trip.id, profile.id);
      if (res.success) {
        setShowCompleteModal(false);
        onTripUpdated?.();
      }
    } finally {
      setLoadingComplete(false);
    }
  };

  const confirmUndoCompleteTrip = async () => {
    if (!trip || !profile?.id) return;
    setLoadingUndo(true);
    try {
      const res = await TripService.getInstance().reopenTripDB(trip.id, profile.id);
      if (res.success) {
        setShowUndoModal(false);
        onTripUpdated?.();
      }
    } finally {
      setLoadingUndo(false);
    }
  };

  const handleKickPress = (memberId: string, memberName: string) => {
    setKickTarget({ id: memberId, name: memberName });
  };

  const confirmKickMember = async () => {
    if (!trip || !kickTarget) return;
    setLoadingKick(true);
    try {
      const success = await TripService.getInstance().removeParticipantDB(trip.id, kickTarget.id);
      if (success) {
        setMembers((prev) => prev.filter((m) => m.id !== kickTarget.id));
        onTripUpdated?.();
      }
    } finally {
      setLoadingKick(false);
      setKickTarget(null);
    }
  };

  const confirmLeaveTrip = async () => {
    if (!trip || !profile?.id) return;
    setLoadingLeave(true);
    try {
      const success = await TripService.getInstance().declineTripInviteDB(trip.id, profile.id);
      if (success) {
        setShowLeaveModal(false);
        onClose();
        onTripUpdated?.();
      }
    } finally {
      setLoadingLeave(false);
    }
  };

  const handleCopyCode = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = async () => {
    if (!trip?.inviteCode) return;
    try {
      await Share.share({
        message: `Join our Barkada trip "${trip.title}" on Barkadash! Use trip code: ${trip.inviteCode} or link: https://barkadash.app/join/${trip.inviteCode}`,
      });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  const remainingSpots = Math.max(0, MAX_TRIP_MEMBERS - members.length);

  const toggleSelectFriend = (id: string) => {
    setSelectedFriends((prev) => {
      if (prev.includes(id)) {
        return prev.filter((fId) => fId !== id);
      }
      if (prev.length >= remainingSpots) {
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleSendInvites = async () => {
    if (!trip || selectedFriends.length === 0) return;
    setInviting(true);
    try {
      await TripService.getInstance().inviteFriendsToTripDB(
        trip.id,
        selectedFriends,
        profile?.id || '',
        trip.title,
        trip.inviteCode || ''
      );
      setInviting(false);
      setIsInviteMode(false);
      setSelectedFriends([]);
      loadMembers();
      onTripUpdated?.();
    } catch (e) {
      console.warn('Error sending trip invites:', e);
      setInviting(false);
    }
  };

  if (!trip) return null;

  return (
    <SlideUpModal
      visible={visible}
      onClose={onClose}
      backdropOpacity={0.6}
      useKeyboardAvoiding
    >
      <View style={[styles.sheetCard, { backgroundColor: colors.paper }]}>
          {/* Handle bar */}
          <View style={styles.handleBarWrapper}>
            <View style={[styles.handleBar, { backgroundColor: isDark ? '#4B5563' : '#D1D5DB' }]} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              {isInviteMode ? (
                <TouchableOpacity onPress={() => setIsInviteMode(false)} style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.tealDark }}>
                    ← Back to Trip Details
                  </Text>
                </TouchableOpacity>
              ) : null}

              <Text
                style={[styles.headerTitle, { color: colors.ink }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {isInviteMode ? `Invite Barkada to "${trip.title}"` : trip.title}
              </Text>
              <Text
                style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, marginTop: 2 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {isInviteMode
                  ? 'Select connections from your friends list to send trip invites.'
                  : `${trip.destination} · ${trip.dateRange}`}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeBtn,
                { backgroundColor: colors.card, borderColor: colors.cardBorder, flexShrink: 0, marginTop: 2 },
              ]}
            >
              <X size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            style={{ maxHeight: 520 }}
          >
            {!isInviteMode ? (
              <View style={{ gap: sp.md }}>
                {/* Trip Invite Code Box */}
                <View
                  style={[
                    styles.codeBox,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <KeyRound size={12} color={colors.tealDark} />
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: colors.inkSoft,
                          letterSpacing: 1,
                          textTransform: 'uppercase',
                        }}
                      >
                        Trip Invite Code
                      </Text>
                    </View>

                    <Text
                      style={{
                        fontSize: fs.xxl + 2,
                        fontWeight: '900',
                        color: colors.tealDark,
                        letterSpacing: 3,
                        marginVertical: 2,
                      }}
                    >
                      {trip.inviteCode || 'N/A'}
                    </Text>

                    <Text style={{ fontSize: 10, fontWeight: '600', color: colors.inkSoft }}>
                      Reusable code. Friends enter this code to join your trip!
                    </Text>
                  </View>

                  <View style={{ gap: 6 }}>
                    <TouchableOpacity
                      onPress={handleCopyCode}
                      style={{
                        backgroundColor: copied ? AppColors.emerald : colors.tealDark,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {copied ? <Check size={14} color="#FFF" /> : <Copy size={14} color="#FFF" />}
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>
                        {copied ? 'Copied' : 'Copy'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleShareLink}
                      style={{
                        backgroundColor: colors.lightOrangeBg,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Share2 size={14} color={colors.orangeAccent} />
                      <Text style={{ color: colors.orangeAccent, fontSize: 11, fontWeight: '800' }}>
                        Share
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 1. Trip Participants Section (ABOVE & COLLAPSIBLE) */}
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    padding: 14,
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setIsParticipantsCollapsed(!isParticipantsCollapsed)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0, marginRight: 8 }}
                    >
                      <Users size={16} color={colors.ink} />
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{ fontSize: 13.5, fontWeight: '900', color: colors.ink, flexShrink: 1 }}
                      >
                        Trip Participants ({members.length || trip.memberCount}/{MAX_TRIP_MEMBERS})
                      </Text>
                      {isParticipantsCollapsed ? (
                        <ChevronDown size={16} color={colors.inkSoft} />
                      ) : (
                        <ChevronUp size={16} color={colors.inkSoft} />
                      )}
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <TouchableOpacity
                        onPress={handleOpenInviteMode}
                        disabled={members.length >= MAX_TRIP_MEMBERS}
                        style={{
                          backgroundColor: members.length >= MAX_TRIP_MEMBERS ? colors.subtleBg : colors.lightOrangeBg,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 100,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          opacity: members.length >= MAX_TRIP_MEMBERS ? 0.6 : 1,
                        }}
                      >
                        <UserPlus size={12} color={members.length >= MAX_TRIP_MEMBERS ? colors.inkSoft : colors.orangeAccent} />
                        <Text style={{ fontSize: 10.5, fontWeight: '900', color: members.length >= MAX_TRIP_MEMBERS ? colors.inkSoft : colors.orangeAccent }}>
                          {members.length >= MAX_TRIP_MEMBERS ? 'Trip Full' : '+ Invite'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Collapsed State Preview */}
                  {isParticipantsCollapsed ? (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => setIsParticipantsCollapsed(false)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                        padding: 8,
                        borderRadius: 12,
                        marginTop: 2,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 4 }}>
                        {members.slice(0, 4).map((m, idx) => (
                          <View
                            key={m.id}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 13,
                              backgroundColor: m.avatarBg,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 2,
                              borderColor: colors.card,
                              marginLeft: idx === 0 ? 0 : -8,
                            }}
                          >
                            <Text style={{ color: '#FFF', fontSize: 9.5, fontWeight: '900' }}>
                              {m.initials}
                            </Text>
                          </View>
                        ))}
                        {members.length > 4 && (
                          <View
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 13,
                              backgroundColor: colors.subtleBg,
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 2,
                              borderColor: colors.card,
                              marginLeft: -8,
                            }}
                          >
                            <Text style={{ color: colors.inkSoft, fontSize: 8.5, fontWeight: '800' }}>
                              +{members.length - 4}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.tealDark }}>
                        Show All Members ↓
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    /* Expanded Participants List */
                    <>
                      {loadingMembers ? (
                        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                          <ActivityIndicator color={colors.tealDark} />
                        </View>
                      ) : members.length === 0 ? (
                        <View
                          style={{
                            padding: 10,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                            borderRadius: 10,
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.inkSoft }}>
                            Host & Barkada members joined via trip code will appear here.
                          </Text>
                        </View>
                      ) : (
                        <View style={{ gap: 6, marginTop: 4 }}>
                          {members.map((member) => (
                            <View
                              key={member.id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                                paddingVertical: 8,
                                paddingHorizontal: 10,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: colors.cardBorder,
                                gap: 8,
                              }}
                            >
                              {/* Left: Avatar + Name + Handle + Inline Role Badge */}
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
                                <View
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: member.avatarBg,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>
                                    {member.initials}
                                  </Text>
                                </View>
                                <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Text
                                      numberOfLines={1}
                                      ellipsizeMode="tail"
                                      style={{ fontSize: 12.5, fontWeight: '800', color: colors.ink, flexShrink: 1 }}
                                    >
                                      {member.name}
                                    </Text>
                                    {member.role === 'host' ? (
                                      <View
                                        style={{
                                          backgroundColor: colors.lightOrangeBg,
                                          paddingHorizontal: 6,
                                          paddingVertical: 2,
                                          borderRadius: 100,
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          gap: 3,
                                          flexShrink: 0,
                                        }}
                                      >
                                        <Crown size={9} color={colors.orangeAccent} />
                                        <Text style={{ fontSize: 8.5, fontWeight: '900', color: colors.orangeAccent }}>
                                          HOST
                                        </Text>
                                      </View>
                                    ) : member.role === 'co-host' ? (
                                      <View
                                        style={{
                                          backgroundColor: isDark ? 'rgba(59,122,158,0.22)' : '#E0F2FE',
                                          paddingHorizontal: 6,
                                          paddingVertical: 2,
                                          borderRadius: 100,
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          gap: 3,
                                          flexShrink: 0,
                                        }}
                                      >
                                        <Star size={9} color={colors.tealDark} />
                                        <Text style={{ fontSize: 8.5, fontWeight: '900', color: colors.tealDark }}>
                                          CO-HOST
                                        </Text>
                                      </View>
                                    ) : null}
                                  </View>
                                  <Text
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                    style={{ fontSize: 9.5, fontWeight: '600', color: colors.inkSoft, marginTop: 1 }}
                                  >
                                    {member.handle}
                                  </Text>
                                </View>
                              </View>

                              {/* Right: Actions / Pending Status */}
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                  flexShrink: 0,
                                  justifyContent: 'flex-end',
                                }}
                              >
                                {member.status === 'pending' ? (
                                  <>
                                    <View
                                      style={{
                                        backgroundColor: '#FEF3C7',
                                        paddingHorizontal: 6,
                                        paddingVertical: 3,
                                        borderRadius: 100,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 3,
                                        flexShrink: 0,
                                      }}
                                    >
                                      <Clock size={9} color="#D97706" />
                                      <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#D97706' }}>
                                        PENDING
                                      </Text>
                                    </View>
                                    {isCurrentHost && member.id !== profile?.id && (
                                      <TouchableOpacity
                                        onPress={() => handleKickPress(member.id, member.name)}
                                        activeOpacity={0.75}
                                        style={{
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          gap: 3,
                                          backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FCE8E6',
                                          paddingHorizontal: 7,
                                          paddingVertical: 3.5,
                                          borderRadius: 100,
                                          flexShrink: 0,
                                        }}
                                      >
                                        <UserMinus size={10} color="#EF4444" strokeWidth={2.2} />
                                        <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#EF4444' }}>
                                          Kick
                                        </Text>
                                      </TouchableOpacity>
                                    )}
                                  </>
                                ) : (
                                  /* Joined Member Actions */
                                  member.id !== profile?.id && (
                                    <>
                                      {isPrimaryHost && (
                                        <TouchableOpacity
                                          onPress={() => setRoleActionTarget(member)}
                                          activeOpacity={0.75}
                                          style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 3,
                                            backgroundColor: colors.subtleBg,
                                            paddingHorizontal: 7,
                                            paddingVertical: 3.5,
                                            borderRadius: 100,
                                            borderWidth: 1,
                                            borderColor: colors.cardBorder,
                                            flexShrink: 0,
                                          }}
                                        >
                                          <ArrowRightLeft size={9} color={colors.inkSoft} strokeWidth={2.4} />
                                          <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.ink }}>
                                            Role
                                          </Text>
                                        </TouchableOpacity>
                                      )}
                                      {/* If co-host (not primary host), allow direct kick button */}
                                      {!isPrimaryHost && isCurrentHost && (
                                        <TouchableOpacity
                                          onPress={() => handleKickPress(member.id, member.name)}
                                          activeOpacity={0.75}
                                          style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 3,
                                            backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FCE8E6',
                                            paddingHorizontal: 7,
                                            paddingVertical: 3.5,
                                            borderRadius: 100,
                                            flexShrink: 0,
                                          }}
                                        >
                                          <UserMinus size={10} color="#EF4444" strokeWidth={2.2} />
                                          <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#EF4444' }}>
                                            Kick
                                          </Text>
                                        </TouchableOpacity>
                                      )}
                                    </>
                                  )
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </View>

                {/* 2. Trip Settings & Controls Section (BELOW PARTICIPANTS) */}
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    padding: 14,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingBottom: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.cardBorder,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, marginRight: 8 }}>
                      <Settings size={15} color={colors.tealDark} />
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{
                          fontSize: 11,
                          fontWeight: '900',
                          color: colors.tealDark,
                          textTransform: 'uppercase',
                          letterSpacing: 0.8,
                          flexShrink: 1,
                        }}
                      >
                        Trip Settings & Controls
                      </Text>
                    </View>

                    <View
                      style={{
                        backgroundColor: isTripCompleted
                          ? (isDark ? 'rgba(52,211,153,0.2)' : '#DCFCE7')
                          : (isDark ? 'rgba(59,122,158,0.2)' : '#E0F2FE'),
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 100,
                        flexShrink: 0,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 9.5,
                          fontWeight: '900',
                          color: isTripCompleted
                            ? (isDark ? '#34D399' : '#15803D')
                            : colors.tealDark,
                        }}
                      >
                        {isTripCompleted
                          ? 'COMPLETED'
                          : dayInfo?.totalDays
                            ? `DAY ${dayInfo.currentDay} OF ${dayInfo.totalDays}`
                            : 'ACTIVE'}
                      </Text>
                    </View>
                  </View>

                  {/* Host & Co-Host Permissions Setting (Primary Host only) */}
                  {isPrimaryHost && members.filter((m) => m.id !== profile?.id && m.status !== 'pending').length > 0 && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isDark ? 'rgba(240,169,62,0.1)' : '#FFFBEB',
                        padding: 12,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: isDark ? 'rgba(240,169,62,0.3)' : '#FDE68A',
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Crown size={15} color={colors.orangeAccent} />
                          <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
                            Host & Permissions
                          </Text>
                        </View>
                        <Text style={{ fontSize: 10.5, fontWeight: '500', color: colors.inkSoft, marginTop: 2, lineHeight: 14 }}>
                          Switch primary host or assign co-hosts who share equal planning access.
                        </Text>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setShowHostSwitchPicker(true)}
                        style={{
                          backgroundColor: colors.orangeAccent,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 100,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <ArrowRightLeft size={12} color="#FFFFFF" strokeWidth={2.4} />
                        <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#FFFFFF' }}>
                          Switch Host
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Yellow Edit Tour Action Button (For Host - ONLY if tour hasn't started) */}
                  {canEditTour && (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        onClose();
                        onEditTour?.();
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isDark ? 'rgba(240,169,62,0.15)' : '#FEF6E7',
                        padding: 12,
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: isDark ? 'rgba(240,169,62,0.35)' : '#FDE68A',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            backgroundColor: isDark ? 'rgba(240,169,62,0.25)' : '#FDE68A',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Pencil size={18} color={colors.orangeAccent} strokeWidth={2.4} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '900', color: colors.ink }}>
                            Edit Tour Details
                          </Text>
                          <Text style={{ fontSize: 11, fontWeight: '500', color: colors.inkSoft, marginTop: 1 }}>
                            Modify destination, schedule dates & itinerary
                          </Text>
                        </View>
                      </View>

                      <View
                        style={{
                          backgroundColor: colors.orangeAccent,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 100,
                        }}
                      >
                        <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#FFFFFF' }}>
                          Edit Tour
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Trip Status Complete / End Action (For Host - ONLY if Day 1 has started or completed) */}
                  {(canEndTour || canReopenTour) && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                        padding: 11,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        gap: 10,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
                          {isTripCompleted ? 'Trip Completed' : 'Complete / End Trip'}
                        </Text>
                        <Text style={{ fontSize: 10.5, fontWeight: '500', color: colors.inkSoft, marginTop: 1, lineHeight: 14 }}>
                          {isTripCompleted
                            ? 'Itinerary finalized. You can reopen anytime.'
                            : dayInfo?.isEarly
                              ? `Day ${dayInfo.currentDay} of ${dayInfo.totalDays}. Tap to end early.`
                              : 'All plans done? Mark trip as complete.'}
                        </Text>
                      </View>

                      {isTripCompleted ? (
                        <TouchableOpacity
                          activeOpacity={0.82}
                          onPress={() => setShowUndoModal(true)}
                          style={{
                            backgroundColor: colors.tealDark,
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <RotateCcw size={12} color="#FFFFFF" strokeWidth={2.4} />
                          <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' }}>
                            Reopen
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => setShowCompleteModal(true)}
                          style={{
                            backgroundColor: dayInfo?.isEarly ? '#EF4444' : '#10B981',
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                            borderRadius: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          {dayInfo?.isEarly ? (
                            <>
                              <AlertTriangle size={12} color="#FFFFFF" strokeWidth={2.4} />
                              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' }}>
                                End Trip
                              </Text>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={12} color="#FFFFFF" strokeWidth={2.4} />
                              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' }}>
                                Complete
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Leave Trip Button for Non-Hosts */}
                  {!isCurrentHost && (
                    <TouchableOpacity
                      onPress={() => setShowLeaveModal(true)}
                      activeOpacity={0.8}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FCE8E6',
                        paddingVertical: 11,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(239,68,68,0.25)',
                      }}
                    >
                      <LogOut size={15} color="#EF4444" />
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#EF4444' }}>
                        Leave Trip
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              /* Invite Barkada Connections View */
              <View style={{ gap: sp.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.ink }}>
                    Invite Connections ({selectedFriends.length}/{remainingSpots} spots left)
                  </Text>
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.inkSoft }}>
                    Capacity: {MAX_TRIP_MEMBERS} max
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.card,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  <Search size={16} color={colors.inkSoft} style={{ marginRight: 8 }} />
                  <TextInput
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: '600',
                      color: colors.ink,
                      paddingVertical: 4,
                    }}
                    placeholder="Search connections by name or handle..."
                    placeholderTextColor={colors.inkSoft}
                    value={searchQuery}
                    onChangeText={(text) => {
                      setSearchQuery(text);
                      loadFriendsToInvite(text);
                    }}
                  />
                  {loadingFriends && <ActivityIndicator size="small" color={colors.tealDark} />}
                </View>

                <View style={{ gap: 6 }}>
                  {loadingFriends ? (
                    <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                      <ActivityIndicator color={colors.tealDark} />
                    </View>
                  ) : friendsList.length === 0 ? (
                    <View
                      style={{
                        padding: 14,
                        alignItems: 'center',
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft }}>
                        No connections available to invite.
                      </Text>
                    </View>
                  ) : (
                    friendsList.map((friend) => {
                      const isSelected = selectedFriends.includes(friend.id);
                      const isLimitReached = !isSelected && selectedFriends.length >= remainingSpots;
                      return (
                        <TouchableOpacity
                          key={friend.id}
                          activeOpacity={0.8}
                          onPress={() => toggleSelectFriend(friend.id)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: colors.card,
                            padding: 10,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                            opacity: isLimitReached ? 0.45 : 1,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: colors.lightOrangeBg,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: colors.orangeAccent, fontSize: 12, fontWeight: '900' }}>
                                {friend.initials || 'F'}
                              </Text>
                            </View>
                            <View>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
                                {friend.name}
                              </Text>
                              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.inkSoft }}>
                                {friend.handle}
                              </Text>
                            </View>
                          </View>

                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              borderWidth: 2,
                              borderColor: isSelected ? colors.tealDark : colors.inkSoft,
                              backgroundColor: isSelected ? colors.tealDark : 'transparent',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isSelected && <Check size={12} color="#FFF" strokeWidth={3} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>

                {selectedFriends.length > 0 && (
                  <TouchableOpacity
                    onPress={handleSendInvites}
                    disabled={inviting}
                    style={{
                      backgroundColor: colors.tealDark,
                      paddingVertical: 12,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 8,
                    }}
                  >
                    {inviting ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>
                        Send Invites ({selectedFriends.length})
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </View>

      {/* Kick Member Confirmation Modal */}
      <Modal
        transparent
        visible={!!kickTarget}
        animationType="fade"
        onRequestClose={() => setKickTarget(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setKickTarget(null)} />
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              padding: 22,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            {/* Header with Close */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : '#FEE2E2',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserMinus size={22} color="#EF4444" strokeWidth={2.4} />
              </View>

              <TouchableOpacity
                onPress={() => setKickTarget(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.subtleBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} color={colors.inkSoft} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 17, fontWeight: '900', color: colors.ink, marginBottom: 4 }}>
              Kick {kickTarget?.name}?
            </Text>
            <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.inkSoft, lineHeight: 18, marginBottom: 20 }}>
              Are you sure you want to remove {kickTarget?.name} from "{trip?.title}"? They will lose access to the trip planner.
            </Text>

            <View style={{ gap: 8 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={confirmKickMember}
                disabled={loadingKick}
                style={{
                  backgroundColor: '#EF4444',
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {loadingKick ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800' }}>
                    Yes, Kick Member
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setKickTarget(null)}
                disabled={loadingKick}
                style={{
                  paddingVertical: 11,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.subtleBg,
                }}
              >
                <Text style={{ color: colors.inkSoft, fontSize: 12.5, fontWeight: '700' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Leave Trip Confirmation Modal */}
      <Modal
        transparent
        visible={showLeaveModal}
        animationType="fade"
        onRequestClose={() => setShowLeaveModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowLeaveModal(false)} />
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              padding: 22,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            {/* Header with Close */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : '#FEE2E2',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LogOut size={22} color="#EF4444" strokeWidth={2.4} />
              </View>

              <TouchableOpacity
                onPress={() => setShowLeaveModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.subtleBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} color={colors.inkSoft} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 17, fontWeight: '900', color: colors.ink, marginBottom: 4 }}>
              Leave Trip?
            </Text>
            <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.inkSoft, lineHeight: 18, marginBottom: 20 }}>
              Are you sure you want to leave "{trip?.title}"? You will lose access to this trip's planner unless re-invited by the host.
            </Text>

            <View style={{ gap: 8 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={confirmLeaveTrip}
                disabled={loadingLeave}
                style={{
                  backgroundColor: '#EF4444',
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {loadingLeave ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800' }}>
                    Yes, Leave Trip
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowLeaveModal(false)}
                disabled={loadingLeave}
                style={{
                  paddingVertical: 11,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.subtleBg,
                }}
              >
                <Text style={{ color: colors.inkSoft, fontSize: 12.5, fontWeight: '700' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Complete Trip / Early Finish Confirmation Modal */}
      <Modal
        transparent
        visible={showCompleteModal}
        animationType="fade"
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowCompleteModal(false)} />
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              padding: 22,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            {/* Header with Close */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: dayInfo?.isEarly
                    ? (isDark ? 'rgba(239,68,68,0.18)' : '#FEE2E2')
                    : (isDark ? 'rgba(16,185,129,0.18)' : '#DCFCE7'),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {dayInfo?.isEarly ? (
                  <AlertTriangle size={22} color="#EF4444" strokeWidth={2.4} />
                ) : (
                  <CheckCircle2 size={22} color="#10B981" strokeWidth={2.4} />
                )}
              </View>

              <TouchableOpacity
                onPress={() => setShowCompleteModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.subtleBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} color={colors.inkSoft} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 17, fontWeight: '900', color: colors.ink, marginBottom: 4 }}>
              {dayInfo?.isEarly ? 'End Trip Early?' : 'Complete This Trip?'}
            </Text>
            <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.inkSoft, lineHeight: 18, marginBottom: 14 }}>
              {dayInfo?.isEarly
                ? `You're currently on Day ${dayInfo.currentDay} of ${dayInfo.totalDays}. Ending early will finalize the trip for everyone.`
                : `Finalize "${trip?.title}" and wrap up the itinerary for the barkada.`}
            </Text>

            {/* Checklist / Info Points */}
            <View
              style={{
                backgroundColor: colors.subtleBg,
                borderRadius: 14,
                padding: 12,
                marginBottom: 18,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Check size={14} color={colors.tealDark} strokeWidth={2.6} />
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.ink, flex: 1 }}>
                  Barkada members will be notified
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Check size={14} color={colors.tealDark} strokeWidth={2.6} />
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.ink, flex: 1 }}>
                  Trip recap and memories unlocked
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Check size={14} color={colors.tealDark} strokeWidth={2.6} />
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.ink, flex: 1 }}>
                  You can reopen anytime during trip dates
                </Text>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={confirmCompleteTrip}
                disabled={loadingComplete}
                style={{
                  backgroundColor: dayInfo?.isEarly ? '#EF4444' : '#10B981',
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {loadingComplete ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800' }}>
                    {dayInfo?.isEarly ? 'Yes, End Trip Early' : 'Yes, Complete Trip'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowCompleteModal(false)}
                disabled={loadingComplete}
                style={{
                  paddingVertical: 11,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.subtleBg,
                }}
              >
                <Text style={{ color: colors.inkSoft, fontSize: 12.5, fontWeight: '700' }}>
                  Keep Trip Active
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Undo Complete / Reopen Trip Modal */}
      <Modal
        transparent
        visible={showUndoModal}
        animationType="fade"
        onRequestClose={() => setShowUndoModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowUndoModal(false)} />
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              padding: 22,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            {/* Header with Close */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: isDark ? 'rgba(59,122,158,0.2)' : '#E0F2FE',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RotateCcw size={22} color={colors.tealDark} strokeWidth={2.4} />
              </View>

              <TouchableOpacity
                onPress={() => setShowUndoModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.subtleBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} color={colors.inkSoft} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 17, fontWeight: '900', color: colors.ink, marginBottom: 4 }}>
              Reopen This Trip?
            </Text>
            <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.inkSoft, lineHeight: 18, marginBottom: 14 }}>
              Restore "{trip?.title}" back to active status for all members.
            </Text>

            {/* Checklist / Info Points */}
            <View
              style={{
                backgroundColor: colors.subtleBg,
                borderRadius: 14,
                padding: 12,
                marginBottom: 18,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Check size={14} color={colors.tealDark} strokeWidth={2.6} />
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.ink, flex: 1 }}>
                  Live itinerary planning reactivated
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Check size={14} color={colors.tealDark} strokeWidth={2.6} />
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.ink, flex: 1 }}>
                  Members can vote and react to spots
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Check size={14} color={colors.tealDark} strokeWidth={2.6} />
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.ink, flex: 1 }}>
                  Trip countdown and radar restored
                </Text>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={confirmUndoCompleteTrip}
                disabled={loadingUndo}
                style={{
                  backgroundColor: colors.tealDark,
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {loadingUndo ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800' }}>
                    Yes, Reopen Trip
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowUndoModal(false)}
                disabled={loadingUndo}
                style={{
                  paddingVertical: 11,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.subtleBg,
                }}
              >
                <Text style={{ color: colors.inkSoft, fontSize: 12.5, fontWeight: '700' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Member Role & Permission Management Modal */}
      <Modal
        transparent
        visible={!!roleActionTarget}
        animationType="fade"
        onRequestClose={() => setRoleActionTarget(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setRoleActionTarget(null)} />
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              padding: 22,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: roleActionTarget?.avatarBg || colors.tealDark,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>
                    {roleActionTarget?.initials || 'U'}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: colors.ink }}>
                    {roleActionTarget?.name}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft }}>
                    {roleActionTarget?.handle}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setRoleActionTarget(null)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: colors.subtleBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} color={colors.inkSoft} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Role & Permissions
            </Text>

            <View style={{ gap: 10 }}>
              {/* Option 1: Toggle Co-Host */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => roleActionTarget && handleToggleCoHost(roleActionTarget)}
                disabled={loadingRoleAction}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: isDark ? 'rgba(59,122,158,0.15)' : '#F0F9FF',
                  borderWidth: 1.5,
                  borderColor: isDark ? 'rgba(59,122,158,0.35)' : '#BAE6FD',
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: isDark ? 'rgba(59,122,158,0.3)' : '#E0F2FE',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Star size={18} color={colors.tealDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
                    {roleActionTarget?.role === 'co-host' ? 'Remove Co-Host Role' : 'Make Co-Host'}
                  </Text>
                  <Text style={{ fontSize: 10.5, fontWeight: '500', color: colors.inkSoft, marginTop: 1 }}>
                    {roleActionTarget?.role === 'co-host'
                      ? 'Revert back to regular member permissions'
                      : 'Give same planning & itinerary access as host'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: Transfer Primary Host */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  const target = roleActionTarget;
                  setRoleActionTarget(null);
                  if (target) setTransferTarget(target);
                }}
                disabled={loadingRoleAction}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: isDark ? 'rgba(240,169,62,0.15)' : '#FFFBEB',
                  borderWidth: 1.5,
                  borderColor: isDark ? 'rgba(240,169,62,0.35)' : '#FDE68A',
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: isDark ? 'rgba(240,169,62,0.3)' : '#FEF3C7',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Crown size={18} color={colors.orangeAccent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
                    Make Primary Host
                  </Text>
                  <Text style={{ fontSize: 10.5, fontWeight: '500', color: colors.inkSoft, marginTop: 1 }}>
                    Transfer trip ownership to {roleActionTarget?.name}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option 3: Kick Member */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  const target = roleActionTarget;
                  setRoleActionTarget(null);
                  if (target) handleKickPress(target.id, target.name);
                }}
                disabled={loadingRoleAction}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(239,68,68,0.25)' : '#FEE2E2',
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FEE2E2',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UserMinus size={18} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#EF4444' }}>
                    Kick from Trip
                  </Text>
                  <Text style={{ fontSize: 10.5, fontWeight: '500', color: colors.inkSoft, marginTop: 1 }}>
                    Remove member from this trip
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transfer Host Confirmation Modal */}
      <Modal
        transparent
        visible={!!transferTarget}
        animationType="fade"
        onRequestClose={() => setTransferTarget(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setTransferTarget(null)} />
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              padding: 22,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: isDark ? 'rgba(240,169,62,0.2)' : '#FEF3C7',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Crown size={22} color={colors.orangeAccent} strokeWidth={2.4} />
              </View>

              <TouchableOpacity
                onPress={() => setTransferTarget(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.subtleBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} color={colors.inkSoft} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 17, fontWeight: '900', color: colors.ink, marginBottom: 4 }}>
              Make {transferTarget?.name} Host?
            </Text>
            <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.inkSoft, lineHeight: 18, marginBottom: 16 }}>
              {transferTarget?.name} will become the Primary Host of "{trip?.title}". You will remain as a Co-Host with full organizing privileges.
            </Text>

            <View style={{ gap: 8 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={confirmTransferHost}
                disabled={loadingRoleAction}
                style={{
                  backgroundColor: colors.orangeAccent,
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {loadingRoleAction ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Crown size={15} color="#FFF" />
                    <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800' }}>
                      Yes, Transfer Host
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setTransferTarget(null)}
                disabled={loadingRoleAction}
                style={{
                  paddingVertical: 11,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.subtleBg,
                }}
              >
                <Text style={{ color: colors.inkSoft, fontSize: 12.5, fontWeight: '700' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Switch Host Picker Modal */}
      <Modal
        transparent
        visible={showHostSwitchPicker}
        animationType="fade"
        onRequestClose={() => setShowHostSwitchPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowHostSwitchPicker(false)} />
          <View
            style={{
              width: '100%',
              maxWidth: 380,
              backgroundColor: colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              padding: 22,
              maxHeight: '80%',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Crown size={20} color={colors.orangeAccent} />
                <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink }}>
                  Switch Trip Host
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowHostSwitchPicker(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.subtleBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} color={colors.inkSoft} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.inkSoft, marginBottom: 14, lineHeight: 16 }}>
              Choose a participant to make the new Primary Host of "{trip?.title}":
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
              <View style={{ gap: 8 }}>
                {members
                  .filter((m) => m.id !== profile?.id && m.status !== 'pending')
                  .map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      activeOpacity={0.8}
                      onPress={() => {
                        setShowHostSwitchPicker(false);
                        setTransferTarget(m);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, marginRight: 8 }}>
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            backgroundColor: m.avatarBg,
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Text style={{ color: '#FFF', fontSize: 11.5, fontWeight: '900' }}>
                            {m.initials}
                          </Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
                            {m.name}
                          </Text>
                          <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 10, fontWeight: '600', color: colors.inkSoft }}>
                            {m.handle}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={{
                          backgroundColor: colors.lightOrangeBg,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 100,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          flexShrink: 0,
                        }}
                      >
                        <Crown size={11} color={colors.orangeAccent} />
                        <Text style={{ fontSize: 10.5, fontWeight: '900', color: colors.orangeAccent }}>
                          Make Host
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SlideUpModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetCard: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 999,
  },
  handleBarWrapper: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 23,
    marginBottom: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
});
