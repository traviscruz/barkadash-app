import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { MailOpen, X } from 'lucide-react-native';

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
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.cardContainer,
            { backgroundColor: isDark ? colors.paper : '#FFFFFF', borderColor: colors.cardBorder },
          ]}
        >
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeXButton}>
            <X size={20} color={colors.inkSoft} />
          </TouchableOpacity>

          <View style={styles.stampCircle}>
            <MailOpen size={22} color="#FFFFFF" strokeWidth={2.4} />
          </View>

          <Text style={[styles.eyebrow, { color: colors.tealDark }]}>YOU GOT MAIL</Text>
          <Text style={[styles.title, { color: colors.ink }]}>You in?</Text>

          <Text style={[styles.paragraph, { color: colors.ink }]}>
            <Text style={styles.hostBold}>{invite.hostName}</Text>
            <Text>{' '}is taking the crew</Text>
            {invite.destination ? <Text>{' to '}<Text style={styles.tripBold}>{invite.destination}</Text></Text> : null}
            {invite.dateRange ? <Text>{' ('}{invite.dateRange}{')'}</Text> : null}
            <Text>{' on "'}</Text>
            <Text style={styles.tripBold}>{invite.tripTitle}</Text>
            <Text>{'" — '}{invite.memberCount} already in.</Text>
          </Text>

          <Text style={[styles.codeLine, { color: colors.inkSoft }]}>
            invite code: <Text style={[styles.codeBold, { color: colors.orangeAccent }]}>{invite.inviteCode}</Text>
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleDeclineClick}
              disabled={loadingAccept || loadingDecline}
              style={[styles.declineBtn, { backgroundColor: '#EF4444' }]}
            >
              {loadingDecline ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.btnText}>Reject</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleAcceptClick}
              disabled={loadingAccept || loadingDecline}
              style={[styles.acceptBtn, { backgroundColor: '#10B981' }]}
            >
              {loadingAccept ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.btnText}>Accept</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
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
  stampCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#00B4D8',
    shadowColor: '#00B4D8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  hostBold: {
    fontWeight: '900',
  },
  tripBold: {
    fontWeight: '900',
    fontStyle: 'italic',
  },
  codeLine: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 20,
  },
  codeBold: {
    fontWeight: '900',
    letterSpacing: 1,
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  acceptBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 100,
  },
  declineBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 100,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});