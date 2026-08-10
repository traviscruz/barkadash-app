import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import {
  ChevronLeft,
  ShieldCheck,
  FileText,
  Check,
  Lock,
} from 'lucide-react-native';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { useTheme } from '../../context/ThemeContext';
import { AppColors } from '../../utils/colors';

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

  const handleAcceptPress = () => {
    setAccepted(true);
    if (onAccept) setTimeout(() => onAccept(), 300);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      {/* Apple-Style Minimalist Back Bar */}
      <View style={styles.topNavRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backTouch}>
            <ChevronLeft size={24} color={colors.tealDark} />
            <Text style={[styles.backText, { color: colors.tealDark }]}>Back</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 110 }}
      >
        {/* Large Apple-Style Left-Aligned Title */}
        <Text style={[styles.largeAppleTitle, { color: colors.ink }]}>Terms & Privacy</Text>

        {/* Minimalist Segmented Control */}
        <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <TouchableOpacity
            onPress={() => setActiveTab('terms')}
            activeOpacity={0.8}
            style={[styles.tab, activeTab === 'terms' ? { backgroundColor: colors.tealDark } : null]}
          >
            <FileText size={15} color={activeTab === 'terms' ? '#FFFFFF' : colors.inkSoft} />
            <Text style={[styles.tabText, { color: activeTab === 'terms' ? '#FFFFFF' : colors.inkSoft }]}>
              Terms of Service
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('privacy')}
            activeOpacity={0.8}
            style={[styles.tab, activeTab === 'privacy' ? { backgroundColor: colors.tealDark } : null]}
          >
            <Lock size={15} color={activeTab === 'privacy' ? '#FFFFFF' : colors.inkSoft} />
            <Text style={[styles.tabText, { color: activeTab === 'privacy' ? '#FFFFFF' : colors.inkSoft }]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>

        {/* Minimalist Section Card */}
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

      {/* Bottom Sticky Action */}
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
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.7}
            style={styles.closeBtn}
          >
            <Text style={[styles.closeBtnText, { color: colors.inkSoft }]}>Close</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
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
    padding: 4,
    borderWidth: 1,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 100,
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
    fontWeight: '800',
    color: AppColors.tealDark,
    width: 20,
  },
  pointBody: {
    flex: 1,
    fontSize: 14,
    color: AppColors.inkSoft,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '800',
    color: AppColors.ink,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#E6E8F0',
    flexDirection: 'row',
    gap: 12,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: AppColors.tealDark,
    borderRadius: 100,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptBtnDone: {
    backgroundColor: AppColors.emerald,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    backgroundColor: '#E6E8F0',
    borderRadius: 100,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.inkSoft,
  },
});
