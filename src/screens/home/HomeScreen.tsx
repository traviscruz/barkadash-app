import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TripService } from '../../services/tripService';
import { DestinationPollOption, BarkadaActivity, Trip } from '../../types/trip';
import { TripCard } from '../../components/cards/TripCard';
import { AppCard } from '../../components/cards/AppCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { PollDetailModal } from '../../components/poll/PollDetailModal';
import { NotificationModal } from '../../components/notifications/NotificationModal';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { PolaroidStack } from '../../components/home/PolaroidStack';
import { HandwrittenText } from '../../components/common/HandwrittenText';
import { useResponsive } from '../../utils/responsive';
import {
  Sun,
  Bell,
  Vote,
  ChevronRight,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react-native';

interface HomeScreenProps {
  onNavigateToTab?: (index: number) => void;
  onScrollDirection?: (direction: 'up' | 'down') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateToTab, onScrollDirection }) => {
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<BarkadaActivity[]>([]);
  const [polls, setPolls] = useState<DestinationPollOption[]>([]);
  const [pollModalVisible, setPollModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);

  const lastOffsetY = useRef(0);
  const { sp, fs, icon, bottomNavOffset } = useResponsive();

  useEffect(() => {
    const service = TripService.getInstance();
    setActiveTrip(service.getActiveTrip());
    setActivities(service.getRecentActivities());
    setPolls(service.getPollOptions());

    return service.subscribe(() => {
      setPolls(service.getPollOptions());
    });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const currentY = e.nativeEvent.contentOffset.y;
          const delta = currentY - lastOffsetY.current;
          lastOffsetY.current = currentY;

          if (currentY < 15) {
            onScrollDirection?.('up');
          } else if (delta > 6) {
            onScrollDirection?.('down');
          } else if (delta < -6) {
            onScrollDirection?.('up');
          }
        }}
        scrollEventThrottle={8}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: sp.lg,
          paddingTop: sp.sm,
          paddingBottom: bottomNavOffset + 20,
        }}
      >
        {/* App Bar Header with Logo SVG */}
        <View style={styles.appHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <BarkadashLogo height={36} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
            {/* Enhanced Weather Badge */}
            <View style={styles.weatherBadge}>
              <View style={styles.sunIconCircle}>
                <Sun size={14} color="#D97706" />
              </View>
              <Text style={styles.weatherTempText}>29°C</Text>
              <View style={styles.weatherDivider} />
              <Text style={styles.weatherLocText}>El Nido</Text>
            </View>

            {/* Notification Bell */}
            <TouchableOpacity
              style={styles.bellButton}
              activeOpacity={0.8}
              onPress={() => setNotifModalVisible(true)}
            >
              <Bell size={icon.md} color="#1A1D2D" />
              <View style={styles.bellUnreadDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Active Trip Card */}
        {activeTrip && (
          <TripCard
            trip={activeTrip}
            onPress={() => onNavigateToTab && onNavigateToTab(1)}
          />
        )}

        {/* Next Up Banner */}
        {activeTrip && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onNavigateToTab && onNavigateToTab(1)}
            style={styles.nextUpBanner}
          >
            <View style={styles.nextUpIconBox}>
              <Clock size={icon.lg} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextUpLabel}>NEXT UP ON ITINERARY</Text>
              <Text style={styles.nextUpTitle} numberOfLines={1}>
                {activeTrip.nextActivityTitle}
              </Text>
              <Text style={styles.nextUpTime}>
                {activeTrip.nextActivityTime}
              </Text>
            </View>
            <ChevronRight size={icon.lg} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Single Featured Quick Access: Destination Poll Widget */}
        <View style={styles.pollQuickSection}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => setPollModalVisible(true)}
            style={styles.pollWidgetCard}
          >
            <View style={styles.pollWidgetHeader}>
              <View style={styles.pollTagPill}>
                <Vote size={14} color="#B8791E" />
                <Text style={styles.pollTagText}>QUICK ACCESS • DESTINATION POLL</Text>
              </View>
            </View>

            <View style={styles.pollWidgetBody}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pollWidgetTitle}>Where to Next?</Text>
                <Text style={styles.pollWidgetSub}>
                  3 destinations competing • Tap to cast or change vote
                </Text>
              </View>

              <View style={styles.castVoteButton}>
                <Text style={styles.castVoteText}>Cast Vote</Text>
                <ChevronRight size={14} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Polaroid Poll Section */}
        <SectionHeader
          title="WHERE TO NEXT? VOTE NOW"
          actionText="View All Options"
          onActionPress={() => setPollModalVisible(true)}
        />

        {/* Interactive Stacked Polaroid Gallery */}
        {polls && polls.length > 0 && (
          <PolaroidStack
            polls={polls}
            onVotePress={() => setPollModalVisible(true)}
          />
        )}

        {/* Live Barkada Updates */}
        <SectionHeader title="LIVE BARKADA UPDATES" />
        <View style={{ gap: sp.sm, marginBottom: sp.xl }}>
          {activities.map((act) => (
            <AppCard key={act.id} className="p-3 border-rule bg-white">
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: sp.md,
                    backgroundColor: act.avatarBgHex,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: fs.xs }}>
                    {act.memberName[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fs.xs, color: '#1A1D2D' }}>
                    <Text style={{ fontWeight: '800', fontSize: fs.sm }}>{act.memberName}</Text>{' '}
                    {act.action}
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: '#6E738A', fontWeight: '600' }}>
                  {act.timeAgo}
                </Text>
              </View>
            </AppCard>
          ))}
        </View>
      </ScrollView>

      <PollDetailModal
        visible={pollModalVisible}
        onClose={() => setPollModalVisible(false)}
      />

      <NotificationModal
        visible={notifModalVisible}
        onClose={() => setNotifModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  weatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF7',
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: 5,
  },
  sunIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherTempText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D97706',
  },
  weatherDivider: {
    width: 1,
    height: 10,
    backgroundColor: '#FCD34D',
  },
  weatherLocText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F2A3C',
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE4D7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellUnreadDot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2604A',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  nextUpBanner: {
    marginBottom: 20,
    backgroundColor: '#0F2A3C',
    padding: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  nextUpIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  nextUpLabel: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.6)',
  },
  nextUpTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  nextUpTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  pollQuickSection: {
    marginBottom: 24,
  },
  pollWidgetCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAE4D7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  pollWidgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pollTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDEBD3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  pollTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#B8791E',
    letterSpacing: 0.8,
  },
  pollActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E4F0EA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  pollActiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2A8563',
  },
  pollWidgetBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pollWidgetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1D2D',
  },
  pollWidgetSub: {
    fontSize: 11,
    color: '#6E738A',
    fontWeight: '500',
    marginTop: 2,
  },
  castVoteButton: {
    backgroundColor: '#1F4E67',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  castVoteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
