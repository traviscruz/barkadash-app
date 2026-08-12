import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { AppColors } from '../../utils/colors';
import { Trip } from '../../types/trip';
import { TripService } from '../../services/tripService';
import {
  X,
  Plus,
  Check,
  Plane,
  Users,
  KeyRound,
  MapPin,
} from 'lucide-react-native';

interface TripSelectorModalProps {
  visible: boolean;
  activeTripId: string;
  trips: Trip[];
  onClose: () => void;
  onSelectTrip: (tripId: string) => void;
  onOpenHostJoin: () => void;
}

export const TripSelectorModal: React.FC<TripSelectorModalProps> = ({
  visible,
  activeTripId,
  trips,
  onClose,
  onSelectTrip,
  onOpenHostJoin,
}) => {
  const { colors, isDark } = useTheme();
  const { sp, fs } = useResponsive();

  if (!visible) return null;

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
                Switch Barkada Trip
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginTop: 2 }}>
                Select an active trip from your Supabase database.
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
            {trips.map((trip) => {
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={{ fontSize: 15, fontWeight: '900', color: colors.ink }}>
                          {trip.title}
                        </Text>
                        {isSelected && (
                          <View style={styles.activeTagPill}>
                            <Text style={styles.activeTagText}>ACTIVE</Text>
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
            })}

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
    paddingVertical: 12,
    borderRadius: 14,
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
});
