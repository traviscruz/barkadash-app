import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import {
  ChevronLeft,
  ShieldCheck,
  FileText,
  Check,
  Lock,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { AppColors } from '../../utils/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_PADDING = 24;
const SEGMENT_PADDING = 4;
const TAB_CONTAINER_WIDTH = SCREEN_WIDTH - CONTAINER_PADDING * 2;
const TAB_WIDTH = (TAB_CONTAINER_WIDTH - SEGMENT_PADDING * 2) / 2;

interface TermsPrivacyScreenProps {
  initialTab?: 'terms' | 'privacy';
  onBack?: () => void;
  onAccept?: () => void;
}

export const TermsPrivacyScreen: React.FC<TermsPrivacyScreenProps> = ({
  initialTab = 'terms',
  onBack,
  onAccept,
}) => {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);
  const [accepted, setAccepted] = useState(false);

  // Animated sliding pill position for tab switcher (replicated from Connections / Itinerary filter)
  const animatedPillX = useRef(
    new Animated.Value(initialTab === 'terms' ? 0 : TAB_WIDTH)
  ).current;

  const handleTabChange = (tab: 'terms' | 'privacy', index: number) => {
    setActiveTab(tab);
    Animated.spring(animatedPillX, {
      toValue: index * TAB_WIDTH,
      stiffness: 320,
      damping: 28,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const handleAcceptPress = () => {
    setAccepted(true);
    if (onAccept) setTimeout(() => onAccept(), 300);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      {/* Centered Top Header Bar */}
      <View style={styles.headerBar}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backTouch}>
            <ChevronLeft size={24} color={colors.tealDark} />
            <Text style={[styles.backText, { color: colors.tealDark }]}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Terms & Privacy</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: onBack ? 36 : 110 }}
      >

        {/* Animated Segmented Capsule Tab Control */}
        <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Animated Sliding Background Pill */}
          <Animated.View
            style={[
              styles.animatedPill,
              {
                width: TAB_WIDTH,
                backgroundColor: colors.tealDark,
                transform: [{ translateX: animatedPillX }],
              },
            ]}
          />

          <TouchableOpacity
            onPress={() => handleTabChange('terms', 0)}
            activeOpacity={0.8}
            style={styles.tab}
          >
            <FileText size={15} color={activeTab === 'terms' ? '#FFFFFF' : colors.inkSoft} />
            <Text style={[styles.tabText, { color: activeTab === 'terms' ? '#FFFFFF' : colors.inkSoft }]}>
              Terms of Service
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleTabChange('privacy', 1)}
            activeOpacity={0.8}
            style={styles.tab}
          >
            <Lock size={15} color={activeTab === 'privacy' ? '#FFFFFF' : colors.inkSoft} />
            <Text style={[styles.tabText, { color: activeTab === 'privacy' ? '#FFFFFF' : colors.inkSoft }]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section Card */}
        {activeTab === 'terms' ? (
          <View style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.iconHeading}>
              <ShieldCheck size={20} color={colors.tealDark} />
              <Text style={[styles.cardTitle, { color: colors.ink }]}>Terms of Service</Text>
            </View>

            <View style={styles.pointRow}>
              <Text style={[styles.pointNumber, { color: colors.tealDark }]}>1.</Text>
              <Text style={[styles.pointBody, { color: colors.inkSoft }]}>
                <Text style={[styles.boldText, { color: colors.ink }]}>Be Real:</Text> Use your real name or handle so your group members know who you are.
              </Text>
            </View>

            <View style={styles.pointRow}>
              <Text style={[styles.pointNumber, { color: colors.tealDark }]}>2.</Text>
              <Text style={[styles.pointBody, { color: colors.inkSoft }]}>
                <Text style={[styles.boldText, { color: colors.ink }]}>Fair Expenses:</Text> Barkadash calculates split bills for your group. Payments happen directly between you and your barkada.
              </Text>
            </View>

            <View style={styles.pointRow}>
              <Text style={[styles.pointNumber, { color: colors.tealDark }]}>3.</Text>
              <Text style={[styles.pointBody, { color: colors.inkSoft }]}>
                <Text style={[styles.boldText, { color: colors.ink }]}>Respect the Crew:</Text> Treat your group members with respect. No spam, fake expense entries, or inappropriate uploads.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.contentCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.iconHeading}>
              <Lock size={20} color={colors.tealDark} />
              <Text style={[styles.cardTitle, { color: colors.ink }]}>Privacy Policy</Text>
            </View>

            <View style={styles.pointRow}>
              <Text style={[styles.pointNumber, { color: colors.tealDark }]}>1.</Text>
              <Text style={[styles.pointBody, { color: colors.inkSoft }]}>
                <Text style={[styles.boldText, { color: colors.ink }]}>Your Data is Private:</Text> Your trip details and expenses are only visible to members of your group.
              </Text>
            </View>

            <View style={styles.pointRow}>
              <Text style={[styles.pointNumber, { color: colors.tealDark }]}>2.</Text>
              <Text style={[styles.pointBody, { color: colors.inkSoft }]}>
                <Text style={[styles.boldText, { color: colors.ink }]}>Barkada Radar:</Text> Live location sharing is 100% opt-in. Turn it on or off whenever you want.
              </Text>
            </View>

            <View style={styles.pointRow}>
              <Text style={[styles.pointNumber, { color: colors.tealDark }]}>3.</Text>
              <Text style={[styles.pointBody, { color: colors.inkSoft }]}>
                <Text style={[styles.boldText, { color: colors.ink }]}>No Third-Party Sales:</Text> We never sell your personal information or receipts to anyone.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Sticky Action: ONLY rendered if NOT logged in (e.g. initial registration flow when onBack is null) */}
      {!onBack && (
        <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
          <TouchableOpacity
            onPress={handleAcceptPress}
            activeOpacity={0.85}
            style={[styles.acceptBtn, { backgroundColor: colors.tealDark }, accepted ? styles.acceptBtnDone : null]}
          >
            <Check size={18} color="#FFFFFF" strokeWidth={3} />
            <Text style={styles.acceptBtnText}>
              {accepted ? 'Accepted ✓' : 'I Agree & Accept'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  },
  largeAppleTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 4,
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 100,
    padding: SEGMENT_PADDING,
    borderWidth: 1,
    marginBottom: 16,
    position: 'relative',
  },
  animatedPill: {
    position: 'absolute',
    top: SEGMENT_PADDING,
    bottom: SEGMENT_PADDING,
    left: SEGMENT_PADDING,
    borderRadius: 100,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 100,
    zIndex: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  contentCard: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
  },
  iconHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.ink,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 10,
  },
  pointNumber: {
    fontSize: 15,
    fontWeight: '900',
  },
  pointBody: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  boldText: {
    fontWeight: '800',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 100,
  },
  acceptBtnDone: {
    backgroundColor: '#059669',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
