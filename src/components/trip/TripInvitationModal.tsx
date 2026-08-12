import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { MailOpen, X, CheckCircle2, XCircle } from 'lucide-react-native';

export interface PendingTripInvite {
  tripId: string;
  tripTitle: string;
  destination: string;
  dateRange: string;
  hostName: string;
  inviteCode: string;
  memberCount: number;
}

interface TripInvitationModalProps {
  visible: boolean;
  invite: PendingTripInvite | null;
  onAccept: (tripId: string) => Promise<void>;
  onDecline: (tripId: string) => Promise<void>;
  onClose: () => void;
}

export const TripInvitationModal: React.FC<TripInvitationModalProps> = ({
  visible,
  invite,
  onAccept,
  onDecline,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const [loadingAccept, setLoadingAccept] = useState(false);
  const [loadingDecline, setLoadingDecline] = useState(false);

  if (!visible || !invite) return null;

  const handleAcceptClick = async () => {
    setLoadingAccept(true);
    try {
      await onAccept(invite.tripId);
    } finally {
      setLoadingAccept(false);
    }
  };

  const handleDeclineClick = async () => {
    setLoadingDecline(true);
    try {
      await onDecline(invite.tripId);
    } finally {
      setLoadingDecline(false);
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

        {/* Clean Rounded Card Container */}
        <View style={[styles.cardContainer, { backgroundColor: isDark ? colors.paper : '#FFFFFF' }]}>
          
          {/* Top Right Close X Button */}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={styles.closeXButton}
          >
            <X size={20} color={colors.inkSoft} />
          </TouchableOpacity>

          {/* SVG Vector Icon Header */}
          <View style={styles.svgIconWrapper}>
            <View style={styles.iconCircleBadge}>
              <MailOpen size={38} color="#FF9F1C" strokeWidth={2.2} />
              
              {/* Red Badge '1' */}
              <View style={styles.redBadgeOne}>
                <Text style={styles.badgeOneText}>1</Text>
              </View>
            </View>
          </View>

          {/* Title */}
          <Text style={[styles.mainHeading, { color: colors.ink }]}>
            New Invitation
          </Text>

          {/* Clean Description Text */}
          <Text style={[styles.descriptionBody, { color: colors.inkSoft }]}>
            <Text style={{ fontWeight: '800', color: colors.ink }}>{invite.hostName}</Text> has invited you to join the trip <Text style={{ fontWeight: '800', color: colors.tealDark }}>"{invite.tripTitle}"</Text> for <Text style={{ fontWeight: '700', color: colors.ink }}>{invite.destination}</Text> ({invite.dateRange}).
          </Text>

          {/* Actions */}
          <View style={styles.actionBlock}>
            {/* Cyan Pill Accept Button */}
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleAcceptClick}
              disabled={loadingAccept || loadingDecline}
              style={styles.cyanPillButton}
            >
              {loadingAccept ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.cyanPillText}>Accept</Text>
              )}
            </TouchableOpacity>

            {/* Secondary Decline Pill Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleDeclineClick}
              disabled={loadingAccept || loadingDecline}
              style={[styles.declinePillButton, { borderColor: colors.cardBorder }]}
            >
              {loadingDecline ? (
                <ActivityIndicator color={colors.inkSoft} size="small" />
              ) : (
                <Text style={[styles.declinePillText, { color: colors.inkSoft }]}>
                  Decline
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 12,
    position: 'relative',
  },
  closeXButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
    zIndex: 10,
  },
  svgIconWrapper: {
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF4E5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#FFE8CC',
  },
  redBadgeOne: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeOneText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  mainHeading: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  descriptionBody: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 6,
  },
  actionBlock: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  cyanPillButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 100,
    backgroundColor: '#00B4D8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00B4D8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  cyanPillText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  declinePillButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declinePillText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
