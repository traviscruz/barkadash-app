import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { AppColors } from '../../utils/colors';
import { Trip } from '../../types/trip';
import { TripService } from '../../services/tripService';
import { isTripPast7DaysGracePeriod } from '../../utils/tripDates';
import {
  X,
  Plus,
  Check,
  Plane,
  Users,
  KeyRound,
  MapPin,
  Trash2,
  Pencil,
} from 'lucide-react-native';

interface TripSelectorModalProps {
  visible: boolean;
  activeTripId: string;
  trips: Trip[];
  onClose: () => void;
  onSelectTrip: (tripId: string) => void;
  onOpenHostJoin: () => void;
  currentUserId?: string;
  onDeleteTrip?: (tripId: string) => Promise<boolean>;
  onRenameTrip?: (tripId: string, newTitle: string) => Promise<boolean>;
  /** When true, shows ALL trips including completed ones past the 7-day grace period (for Recap context). */
  showAllTrips?: boolean;
}

export const TripSelectorModal: React.FC<TripSelectorModalProps> = ({
  visible,
  activeTripId,
  trips,
  onClose,
  onSelectTrip,
  onOpenHostJoin,
  currentUserId,
  onDeleteTrip,
  onRenameTrip,
  showAllTrips = false,
}) => {
  const { colors, isDark } = useTheme();
  const { sp, fs } = useResponsive();
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<Trip | null>(null);
  const [editName, setEditName] = useState('');
  const [savingRename, setSavingRename] = useState(false);
  const editNameRef = useRef<TextInput>(null);

  // Hide trips that have finished status and are past 7 days (accessible for 7 days for expense ledger)
  // When showAllTrips=true (Recap context) we bypass the grace-period filter so all completed trips are visible.
  const visibleTrips = showAllTrips
    ? [...trips].sort((a, b) => {
        // Sort: non-completed first, then completed (oldest last)
        if (a.status === 'Completed' && b.status !== 'Completed') return 1;
        if (a.status !== 'Completed' && b.status === 'Completed') return -1;
        return 0;
      })
    : trips.filter((trip) => {
        if (trip.id && TripService.getInstance().isTripEnded(trip) === false && trip.status !== 'Completed') {
          return true;
        }
        return !isTripPast7DaysGracePeriod(trip);
      });

  if (!visible) return null;

  const confirmDelete = async () => {
    if (!deleteTarget || !onDeleteTrip) return;
    setDeleting(true);
    const ok = await onDeleteTrip(deleteTarget.id);
    setDeleting(false);
    if (ok) setDeleteTarget(null);
  };

  const openRename = (trip: Trip) => {
    setEditTarget(trip);
    setEditName(trip.title);
  };

  const saveRename = async () => {
    if (!editTarget || !onRenameTrip) return;
    setSavingRename(true);
    const ok = await onRenameTrip(editTarget.id, editName);
    setSavingRename(false);
    if (ok) setEditTarget(null);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.65)' }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

        {/* Centered Dialog Box */}
        <View style={[styles.centeredCard, { backgroundColor: colors.paper, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.ink }]}>
                {showAllTrips ? 'Select a Trip Recap' : 'Switch Barkada Trip'}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginTop: 2 }}>
                {showAllTrips ? 'View memories from any of your trips.' : 'Select an active trip.'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            >
              <X size={16} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
            style={{ maxHeight: 380 }}
          >
            {visibleTrips.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Plane size={26} color={colors.inkSoft} style={{ opacity: 0.5, marginBottom: 8 }} />
                <Text style={[styles.emptyTitle, { color: colors.ink }]}>
                  {showAllTrips ? 'No Trips Found' : 'No Active Trips'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.inkSoft }]}>
                  {showAllTrips
                    ? 'Host or join a trip to start logging memories and recaps!'
                    : 'Finished trips older than 7 days are archived. Host or join a new trip below!'}
                </Text>
              </View>
            ) : (
              visibleTrips.map((trip) => {
                const isSelected = trip.id === activeTripId;
                return (
                  <TouchableOpacity
                    key={trip.id}
                    activeOpacity={0.85}
                    onPress={() => {
                      onSelectTrip(trip.id);
                      onClose();
                    }}
                    style={[
                      styles.tripCardItem,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(31, 78, 103, 0.35)' : '#EBF5FB')
                          : colors.card,
                        borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                      },
                    ]}
                  >
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                        <Text
                          style={{ fontSize: 15, fontWeight: '900', color: colors.ink, flexShrink: 1 }}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {trip.title}
                        </Text>
                        {isSelected && (
                          <View style={[styles.activeTagPill, { flexShrink: 0 }]}>
                            <Text style={styles.activeTagText}>ACTIVE</Text>
                          </View>
                        )}
                        {showAllTrips && trip.status === 'Completed' && !isSelected && (
                          <View style={[styles.completedTagPill, { flexShrink: 0 }]}>
                            <Text style={styles.completedTagText}>COMPLETED</Text>
                          </View>
                        )}
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <MapPin size={12} color={colors.inkSoft} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.inkSoft }}>
                          {trip.destination}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {!!trip.hostId && trip.hostId === currentUserId && (
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity
                            onPress={() => openRename(trip)}
                            activeOpacity={0.8}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: isDark ? '#2C2C2E' : colors.paper,
                              borderWidth: 1,
                              borderColor: isDark ? 'rgba(56,189,248,0.45)' : colors.cardBorder,
                            }}
                          >
                            <Pencil size={13} color={colors.tealDark} strokeWidth={2.2} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setDeleteTarget(trip)}
                            activeOpacity={0.8}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 14,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : '#FCE8E6',
                            }}
                          >
                            <Trash2 size={13} color="#EF4444" strokeWidth={2.2} />
                          </TouchableOpacity>
                        </View>
                      )}
                      <View
                        style={[
                          styles.checkCircle,
                          {
                            borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                            backgroundColor: isSelected ? colors.tealDark : 'transparent',
                          },
                        ]}
                      >
                        {isSelected && <Check size={12} color="#FFF" strokeWidth={3} />}
                      </View>
                    </View>
                  </View>

                  {/* Details Footer inside Card */}
                  <View
                    style={[
                      styles.cardMetaRow,
                      { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : '#F0ECE3' },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <KeyRound size={11} color={colors.orangeAccent} />
                      <Text style={{ fontSize: 10, fontWeight: '800', color: colors.orangeAccent }}>
                        Code: {trip.inviteCode || 'N/A'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Users size={11} color={colors.inkSoft} />
                      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.inkSoft }}>
                        {trip.memberCount} members
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

            {/* Add / Host New Trip Action Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                onClose();
                onOpenHostJoin();
              }}
              style={[styles.hostNewBtn, { backgroundColor: colors.tealDark }]}
            >
              <Plus size={16} color="#FFF" strokeWidth={2.8} />
              <Text style={styles.hostNewBtnText}>+ Host or Join New Trip</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Delete Trip Confirmation Modal */}
        <Modal
          transparent
          visible={!!deleteTarget}
          animationType="fade"
          onRequestClose={() => setDeleteTarget(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setDeleteTarget(null)} />
            <View style={{ width: '100%', maxWidth: 340, backgroundColor: isDark ? colors.paper : '#FFFFFF', borderRadius: 28, borderWidth: 1, borderColor: colors.cardBorder, padding: 24, alignItems: 'center', elevation: 12 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FCE8E6', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Trash2 size={26} color="#EF4444" strokeWidth={2.2} />
              </View>

              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink, textAlign: 'center', marginBottom: 6 }}>
                Delete {deleteTarget?.title}?
              </Text>

              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
                This permanently removes the trip, its polls, votes, and every member. This action cannot be undone.
              </Text>

              <View style={{ width: '100%', gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={confirmDelete}
                  disabled={deleting}
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
                  {deleting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                      Yes, Delete Trip
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setDeleteTarget(null)}
                  disabled={deleting}
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

        {/* Edit Trip Name Modal */}
        <Modal
          transparent
          visible={!!editTarget}
          animationType="none"
          onShow={() => editNameRef.current?.focus()}
          onRequestClose={() => setEditTarget(null)}
        >
          <KeyboardAvoidingView
            behavior="padding"
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}
          >
            <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setEditTarget(null)} />
            <View style={{ width: '100%', maxWidth: 340, backgroundColor: isDark ? colors.paper : '#FFFFFF', borderRadius: 28, borderWidth: 1, borderColor: colors.cardBorder, padding: 24, elevation: 12 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(56,189,248,0.2)' : '#EBF5FB', alignItems: 'center', justifyContent: 'center', marginBottom: 14, alignSelf: 'center' }}>
                <Pencil size={26} color="#1F4E67" strokeWidth={2.2} />
              </View>

              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink, textAlign: 'center', marginBottom: 6 }}>
                Edit Trip Name
              </Text>

              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, textAlign: 'center', marginBottom: 16 }}>
                Rename "{editTarget?.title}" for your whole barkada.
              </Text>

              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: colors.tealDark,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                marginBottom: 20,
              }}>
                <TextInput
                  ref={editNameRef}
                  style={{ flex: 1, fontWeight: '700', color: colors.ink, fontSize: 14, padding: 0 }}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Trip name"
                  placeholderTextColor={colors.inkSoft}
                  maxLength={60}
                />
                {!!editName && (
                  <TouchableOpacity onPress={() => setEditName('')} hitSlop={8}>
                    <X size={15} color={colors.inkSoft} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ width: '100%', gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={saveRename}
                  disabled={savingRename || !editName.trim()}
                  style={{
                    backgroundColor: colors.tealDark,
                    paddingVertical: 13,
                    borderRadius: 100,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.tealDark,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.25,
                    shadowRadius: 8,
                    elevation: 4,
                    opacity: savingRename || !editName.trim() ? 0.5 : 1,
                  }}
                >
                  {savingRename ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                      Save Name
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setEditTarget(null)}
                  disabled={savingRename}
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
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  centeredCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 999,
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
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripCardItem: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeTagPill: {
    backgroundColor: '#2A8563',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  activeTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  completedTagPill: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  completedTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  hostNewBtn: {
    paddingVertical: 13,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  hostNewBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  emptyContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
});
