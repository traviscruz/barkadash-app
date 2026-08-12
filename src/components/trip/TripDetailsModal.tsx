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
  KeyboardAvoidingView,
  TextInput,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { useResponsive } from '../../utils/responsive';
import { AppColors } from '../../utils/colors';
import { Trip } from '../../types/trip';
import { TripService } from '../../services/tripService';
import { ConnectionService, DBUserConnection } from '../../services/connectionService';
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
} from 'lucide-react-native';

interface TripDetailsModalProps {
  visible: boolean;
  trip: Trip | null;
  onClose: () => void;
  onTripUpdated?: () => void;
}

export interface TripMember {
  id: string;
  name: string;
  handle: string;
  initials: string;
  avatarBg: string;
  avatarUrl?: string;
  role: 'host' | 'member';
  status?: 'accepted' | 'pending';
}

export const TripDetailsModal: React.FC<TripDetailsModalProps> = ({
  visible,
  trip,
  onClose,
  onTripUpdated,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { sp, fs } = useResponsive();

  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

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

  const isCurrentHost =
    members.some((m) => m.id === profile?.id && m.role === 'host') ||
    trip?.hostName === 'You';

  const [kickTarget, setKickTarget] = useState<{ id: string; name: string } | null>(null);
  const [loadingKick, setLoadingKick] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [loadingLeave, setLoadingLeave] = useState(false);

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

  const toggleSelectFriend = (id: string) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((fId) => fId !== id) : [...prev, id]
    );
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

  if (!visible || !trip) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents="box-none"
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >

        <View style={[styles.sheetCard, { backgroundColor: colors.paper }]}>
          {/* Handle bar */}
          <View style={styles.handleBarWrapper}>
            <View style={[styles.handleBar, { backgroundColor: isDark ? '#4B5563' : '#D1D5DB' }]} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              {isInviteMode ? (
                <TouchableOpacity onPress={() => setIsInviteMode(false)} style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.tealDark }}>
                    ← Back to Trip Details
                  </Text>
                </TouchableOpacity>
              ) : null}

              <Text style={[styles.headerTitle, { color: colors.ink }]} numberOfLines={1}>
                {isInviteMode ? `Invite Barkada to "${trip.title}"` : trip.title}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft }}>
                {isInviteMode
                  ? 'Select connections from your friends list to send trip invites.'
                  : `${trip.destination} · ${trip.dateRange}`}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
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

                {/* Trip Members Section */}
                <View>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Users size={16} color={colors.ink} />
                      <Text style={{ fontSize: 14, fontWeight: '900', color: colors.ink }}>
                        Trip Participants ({members.length || trip.memberCount})
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={handleOpenInviteMode}
                      style={{
                        backgroundColor: colors.lightOrangeBg,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 100,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <UserPlus size={12} color={colors.orangeAccent} />
                      <Text style={{ fontSize: 11, fontWeight: '900', color: colors.orangeAccent }}>
                        + Invite More
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {loadingMembers ? (
                    <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                      <ActivityIndicator color={colors.tealDark} />
                    </View>
                  ) : members.length === 0 ? (
                    <View
                      style={{
                        padding: 12,
                        backgroundColor: colors.card,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft }}>
                        Host & Barkada members joined via trip code will appear here.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {members.map((member) => (
                        <View
                          key={member.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: colors.card,
                            padding: 10,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: member.avatarBg,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>
                                {member.initials}
                              </Text>
                            </View>
                            <View>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
                                {member.name}
                              </Text>
                              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.inkSoft }}>
                                {member.handle}
                              </Text>
                            </View>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {member.role === 'host' ? (
                              <View
                                style={{
                                  backgroundColor: colors.lightOrangeBg,
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 100,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <Crown size={10} color={colors.orangeAccent} />
                                <Text style={{ fontSize: 9, fontWeight: '900', color: colors.orangeAccent }}>
                                  HOST
                                </Text>
                              </View>
                            ) : member.status === 'pending' ? (
                              <>
                                <View
                                  style={{
                                    backgroundColor: '#FEF3C7',
                                    paddingHorizontal: 8,
                                    paddingVertical: 3,
                                    borderRadius: 100,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                >
                                  <Clock size={10} color="#D97706" />
                                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#D97706' }}>
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
                                      paddingHorizontal: 8,
                                      paddingVertical: 4,
                                      borderRadius: 100,
                                    }}
                                  >
                                    <UserMinus size={11} color="#EF4444" strokeWidth={2.2} />
                                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#EF4444' }}>
                                      Kick
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </>
                            ) : (
                              /* Joined Member */
                              isCurrentHost && member.id !== profile?.id ? (
                                <TouchableOpacity
                                  onPress={() => handleKickPress(member.id, member.name)}
                                  activeOpacity={0.75}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 3,
                                    backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FCE8E6',
                                    paddingHorizontal: 10,
                                    paddingVertical: 5,
                                    borderRadius: 100,
                                  }}
                                >
                                  <UserMinus size={12} color="#EF4444" strokeWidth={2.2} />
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#EF4444' }}>
                                    Kick
                                  </Text>
                                </TouchableOpacity>
                              ) : null
                            )}
                          </View>
                        </View>
                      ))}
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
                        paddingVertical: 12,
                        borderRadius: 100,
                        marginTop: 14,
                        borderWidth: 1,
                        borderColor: 'rgba(239,68,68,0.25)',
                      }}
                    >
                      <LogOut size={16} color="#EF4444" />
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#EF4444' }}>
                        Leave Trip
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              /* Invite Barkada Connections View */
              <View style={{ gap: sp.md }}>
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
      </KeyboardAvoidingView>

      {/* Kick Member Confirmation Modal */}
      <Modal
        transparent
        visible={!!kickTarget}
        animationType="fade"
        onRequestClose={() => setKickTarget(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setKickTarget(null)} />
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: isDark ? colors.paper : '#FFFFFF', borderRadius: 28, borderWidth: 1, borderColor: colors.cardBorder, padding: 24, alignItems: 'center', elevation: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FCE8E6', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <UserMinus size={26} color="#EF4444" strokeWidth={2.2} />
            </View>

            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink, textAlign: 'center', marginBottom: 6 }}>
              Kick {kickTarget?.name}?
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
              Are you sure you want to remove {kickTarget?.name} from "{trip?.title}"? They will lose access to the trip planner.
            </Text>

            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={confirmKickMember}
                disabled={loadingKick}
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
                {loadingKick ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                    Yes, Kick Member
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setKickTarget(null)}
                disabled={loadingKick}
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

      {/* Leave Trip Confirmation Modal */}
      <Modal
        transparent
        visible={showLeaveModal}
        animationType="fade"
        onRequestClose={() => setShowLeaveModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowLeaveModal(false)} />
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: isDark ? colors.paper : '#FFFFFF', borderRadius: 28, borderWidth: 1, borderColor: colors.cardBorder, padding: 24, alignItems: 'center', elevation: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FCE8E6', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <LogOut size={26} color="#EF4444" strokeWidth={2.2} />
            </View>

            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink, textAlign: 'center', marginBottom: 6 }}>
              Leave Trip?
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
              Are you sure you want to leave "{trip?.title}"? You will lose access to this trip's planner unless re-invited by the host.
            </Text>

            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={confirmLeaveTrip}
                disabled={loadingLeave}
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
                {loadingLeave ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                    Yes, Leave Trip
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowLeaveModal(false)}
                disabled={loadingLeave}
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
    </Modal>
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
