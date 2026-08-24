import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { TripService } from '../../services/tripService';
import { MemberCommitment, getCommitmentTier } from '../../types/trip';
import { CircularCommitmentDragger } from '../../components/trip/CircularCommitmentDragger';
import { supabase } from '../../utils/supabase';
import {
  ChevronLeft,
  RefreshCw,
  Bell,
  Check,
  Users,
} from 'lucide-react-native';

interface CommitmentTrackerScreenProps {
  onBack: () => void;
  tripId?: string;
}

const PRESET_PERCENTAGES = [0, 25, 50, 75, 100];

export const CommitmentTrackerScreen: React.FC<CommitmentTrackerScreenProps> = ({
  onBack,
  tripId: propTripId,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();

  const [trip, setTrip] = useState<any>(null);
  const [members, setMembers] = useState<MemberCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // User's commitment
  const [myCommitment, setMyCommitment] = useState<number>(100);
  const [myNote, setMyNote] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [nudgingUserId, setNudgingUserId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filter
  const [filter, setFilter] = useState<'all' | 'committed' | 'tentative' | 'unlikely'>('all');

  const toastAnim = useRef(new Animated.Value(0)).current;
  const saveBtnScale = useRef(new Animated.Value(1)).current;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToastMessage(null));
  };

  const loadTripData = useCallback(async () => {
    const active = TripService.getInstance().getActiveTrip();
    const targetTripId = propTripId || active?.id;
    if (!targetTripId) {
      setLoading(false);
      return;
    }
    setTrip(active);

    try {
      const dbMembers = await TripService.getInstance().fetchTripCommitmentsDB(targetTripId);
      setMembers(dbMembers);

      if (profile?.id) {
        const me = dbMembers.find((m) => m.userId === profile.id);
        if (me) {
          setMyCommitment(me.commitmentLevel);
          setMyNote(me.commitmentNote || '');
        }
      }
    } catch (e) {
      console.warn('Error loading commitments:', e);
    } finally {
      setLoading(false);
    }
  }, [propTripId, profile?.id]);

  useEffect(() => {
    setLoading(true);
    loadTripData();

    const active = TripService.getInstance().getActiveTrip();
    const targetTripId = propTripId || active?.id;

    if (targetTripId) {
      const channel = supabase
        .channel(`commitments:${targetTripId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'trip_participants',
            filter: `trip_id=eq.${targetTripId}`,
          },
          () => {
            loadTripData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [loadTripData, propTripId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTripData();
    setRefreshing(false);
  };

  const handlePresetTap = (pct: number) => {
    setMyCommitment(pct);
  };

  const handleSave = async () => {
    const active = TripService.getInstance().getActiveTrip();
    const targetTripId = propTripId || active?.id;
    if (!targetTripId || !profile?.id) return;

    Animated.sequence([
      Animated.timing(saveBtnScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(saveBtnScale, { toValue: 1, friction: 4, tension: 150, useNativeDriver: true }),
    ]).start();

    setSaving(true);
    setSaveSuccess(false);

    try {
      const ok = await TripService.getInstance().updateTripCommitmentDB(
        targetTripId,
        profile.id,
        myCommitment,
        myNote
      );

      if (ok) {
        setSaveSuccess(true);
        showToast('Commitment updated');
        await loadTripData();
        setTimeout(() => setSaveSuccess(false), 2500);
      } else {
        Alert.alert('Error', 'Unable to save commitment. Please try again.');
      }
    } catch (err: any) {
      console.warn('Error saving commitment:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleNudge = async (member: MemberCommitment) => {
    const active = TripService.getInstance().getActiveTrip();
    const targetTripId = propTripId || active?.id;
    if (!targetTripId || !profile?.id) return;

    setNudgingUserId(member.userId);
    try {
      const senderName = `${profile.firstName || 'User'} ${profile.lastName || ''}`.trim();
      const tripTitle = trip?.title || 'trip';

      const ok = await TripService.getInstance().sendCommitmentNudgeDB(
        targetTripId,
        profile.id,
        senderName,
        tripTitle,
        member.userId
      );

      if (ok) {
        showToast(`Reminder sent to ${member.name.split(' ')[0]}`);
      }
    } catch (e) {
      console.warn('Nudge error:', e);
    } finally {
      setNudgingUserId(null);
    }
  };

  const totalCount = members.length;
  const avgCommitment = totalCount > 0
    ? Math.round(members.reduce((sum, m) => sum + (m.commitmentLevel ?? 100), 0) / totalCount)
    : 100;
  const committedCount = members.filter((m) => m.commitmentLevel >= 75).length;

  const filteredMembers = members.filter((m) => {
    if (filter === 'committed') return m.commitmentLevel >= 75;
    if (filter === 'tentative') return m.commitmentLevel >= 40 && m.commitmentLevel < 75;
    if (filter === 'unlikely') return m.commitmentLevel < 40;
    return true;
  });

  const myTier = getCommitmentTier(myCommitment);
  const groupTier = getCommitmentTier(avgCommitment);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.paper }]} edges={['top']}>
      {/* Toast Notification */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: isDark ? colors.card : '#0F2A3C',
              borderColor: isDark ? colors.cardBorder : 'rgba(255,255,255,0.1)',
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.ink }]}>Trip Commitment</Text>
          <Text style={[styles.headerSubtitle, { color: colors.inkSoft }]} numberOfLines={1}>
            {trip?.title ? trip.title.toUpperCase() : 'OVERVIEW'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleRefresh}
          style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          activeOpacity={0.7}
        >
          <RefreshCw size={16} color={colors.inkSoft} />
        </TouchableOpacity>
      </View>

      <ScrollView
        scrollEnabled={!isDraggingSlider}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.tealDark}
            colors={[colors.tealDark]}
          />
        }
        contentContainerStyle={styles.content}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.tealDark} />
          </View>
        ) : (
          <>
            {/* Group Summary Card */}
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.summaryTop}>
                <View>
                  <Text style={[styles.summaryLabel, { color: colors.inkSoft }]}>Group Commitment</Text>
                  <Text style={[styles.summaryValue, { color: colors.ink }]}>
                    {avgCommitment}% average
                  </Text>
                </View>
                <View style={[styles.groupPill, { backgroundColor: groupTier.badgeBg }]}>
                  <Text style={[styles.groupPillText, { color: groupTier.color }]}>
                    {committedCount} of {totalCount} ready
                  </Text>
                </View>
              </View>

              <View style={[styles.progressTrack, { backgroundColor: colors.subtleBg }]}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${avgCommitment}%`,
                      backgroundColor: groupTier.color,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Dragger Card */}
            <View style={[styles.draggerCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.draggerHeader}>
                <Text style={[styles.cardTitle, { color: colors.ink }]}>Your Status</Text>
                <View style={[styles.tierTag, { backgroundColor: myTier.badgeBg }]}>
                  <Text style={[styles.tierTagText, { color: myTier.color }]}>
                    {myTier.label}
                  </Text>
                </View>
              </View>

              {/* Circular Dial (Disables scroll when dragged) */}
              <CircularCommitmentDragger
                value={myCommitment}
                onChange={(val) => setMyCommitment(val)}
                onDragStart={() => setIsDraggingSlider(true)}
                onDragEnd={() => setIsDraggingSlider(false)}
                size={250}
                strokeWidth={14}
              />

              {/* Preset Buttons with Spring Feel */}
              <View style={styles.presetRow}>
                {PRESET_PERCENTAGES.map((pct) => {
                  const isSelected = myCommitment === pct;
                  return (
                    <TouchableOpacity
                      key={pct}
                      onPress={() => handlePresetTap(pct)}
                      activeOpacity={0.7}
                      style={[
                        styles.presetBtn,
                        {
                          backgroundColor: isSelected ? colors.tealDark : colors.subtleBg,
                          borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetBtnText,
                          {
                            color: isSelected ? '#FFFFFF' : colors.ink,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {pct}%
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Optional Note */}
              <View style={styles.noteWrap}>
                <TextInput
                  value={myNote}
                  onChangeText={setMyNote}
                  placeholder="Optional note (e.g. Flight booked, pending leave)"
                  placeholderTextColor={colors.inkSoft + '70'}
                  style={[
                    styles.noteInput,
                    {
                      backgroundColor: colors.subtleBg,
                      borderColor: colors.cardBorder,
                      color: colors.ink,
                    },
                  ]}
                  maxLength={100}
                />
              </View>

              {/* Save Button with Spring Bounce */}
              <Animated.View style={{ transform: [{ scale: saveBtnScale }] }}>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  style={[
                    styles.saveBtn,
                    {
                      backgroundColor: saveSuccess ? '#10B981' : colors.tealDark,
                    },
                  ]}
                  activeOpacity={0.88}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : saveSuccess ? (
                    <View style={styles.btnRow}>
                      <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.saveBtnText}>Updated</Text>
                    </View>
                  ) : (
                    <Text style={styles.saveBtnText}>Update Commitment</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Member List */}
            <View style={styles.memberSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.cardTitle, { color: colors.ink }]}>Members</Text>
                <Text style={[styles.memberCountText, { color: colors.inkSoft }]}>{members.length} total</Text>
              </View>

              {/* Filter Chips */}
              <View style={styles.filterRow}>
                {(
                  [
                    { key: 'all', label: 'All' },
                    { key: 'committed', label: 'Committed' },
                    { key: 'tentative', label: 'Tentative' },
                    { key: 'unlikely', label: 'Unlikely' },
                  ] as const
                ).map((tab) => {
                  const active = filter === tab.key;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      onPress={() => setFilter(tab.key)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: active ? colors.tealDark : colors.subtleBg,
                          borderColor: active ? colors.tealDark : colors.cardBorder,
                        },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          {
                            color: active ? '#FFFFFF' : colors.inkSoft,
                            fontWeight: active ? '700' : '600',
                          },
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Member Rows */}
              <View style={styles.memberList}>
                {filteredMembers.map((member) => {
                  const mTier = getCommitmentTier(member.commitmentLevel);
                  const isMe = member.userId === profile?.id;
                  const isNudging = nudgingUserId === member.userId;

                  return (
                    <View
                      key={member.userId}
                      style={[
                        styles.memberRow,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.cardBorder,
                        },
                      ]}
                    >
                      <View style={[styles.avatar, { backgroundColor: member.avatarBg }]}>
                        {member.avatarUrl ? (
                          <Image source={{ uri: member.avatarUrl }} style={styles.avatarImg} />
                        ) : (
                          <Text style={styles.avatarText}>{member.initials}</Text>
                        )}
                      </View>

                      <View style={styles.memberInfo}>
                        <View style={styles.nameRow}>
                          <Text style={[styles.memberName, { color: colors.ink }]}>
                            {member.name}
                          </Text>
                          {isMe && <Text style={[styles.badgeMe, { color: colors.tealDark }]}>You</Text>}
                        </View>
                        {member.commitmentNote ? (
                          <Text style={[styles.memberNote, { color: colors.inkSoft }]} numberOfLines={1}>
                            "{member.commitmentNote}"
                          </Text>
                        ) : (
                          <Text style={[styles.memberHandle, { color: colors.inkSoft }]}>
                            {member.handle}
                          </Text>
                        )}
                      </View>

                      <View style={styles.memberAction}>
                        <View style={[styles.tierBadge, { backgroundColor: mTier.badgeBg }]}>
                          <Text style={[styles.tierBadgeText, { color: mTier.color }]}>
                            {member.commitmentLevel}%
                          </Text>
                        </View>

                        {!isMe && member.commitmentLevel < 100 && (
                          <TouchableOpacity
                            onPress={() => handleNudge(member)}
                            disabled={isNudging}
                            style={[styles.nudgeIconBtn, { backgroundColor: colors.subtleBg }]}
                            activeOpacity={0.7}
                          >
                            {isNudging ? (
                              <ActivityIndicator size="small" color={colors.inkSoft} />
                            ) : (
                              <Bell size={13} color={colors.inkSoft} />
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    position: 'absolute',
    top: 52,
    alignSelf: 'center',
    zIndex: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 1,
  },
  groupPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  groupPillText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  draggerCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  draggerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  tierTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tierTagText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetBtnText: {
    fontSize: 12,
  },
  noteWrap: {
    marginBottom: 12,
  },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 12.5,
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  memberSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  memberCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
  },
  memberList: {
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 34,
    height: 34,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '800',
  },
  badgeMe: {
    fontSize: 10,
    fontWeight: '800',
  },
  memberHandle: {
    fontSize: 11,
    marginTop: 1,
    fontWeight: '500',
  },
  memberNote: {
    fontSize: 11,
    marginTop: 1,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  memberAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tierBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  nudgeIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
