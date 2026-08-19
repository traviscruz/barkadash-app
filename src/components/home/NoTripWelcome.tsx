import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import {
  Plus,
  KeyRound,
  ArrowRight,
  Vote,
  Wallet,
  CalendarDays,
} from 'lucide-react-native';

const greetingMascotImg = require('../../../assets/mascot/greeting_mascot.webp');
const welcomeMascotImg = require('../../../assets/mascot/welcome_mascot.webp');

interface NoTripWelcomeProps {
  firstName?: string;
  variant?: 'landing' | 'welcome';
  onGetStarted?: () => void;
  onHostPress?: () => void;
  onJoinPress?: () => void;
}

const FEATURES = [
  { icon: Vote, bg: 'lightOrangeBg', fg: 'orangeAccent', text: 'Vote on destinations & dates as a barkada' },
  { icon: Wallet, bg: 'lightGreenBg', fg: 'tealDark', text: 'Split trip costs and track expenses together' },
  { icon: CalendarDays, bg: 'lightBlueBg', fg: 'tealDark', text: 'One shared itinerary, AI-suggested spots & chat' },
] as const;

export const NoTripWelcome: React.FC<NoTripWelcomeProps> = ({
  firstName = 'there',
  variant = 'welcome',
  onGetStarted,
  onHostPress,
  onJoinPress,
}) => {
  const { colors } = useTheme();
  const { isTablet } = useResponsive();

  const mascotSize = isTablet ? 230 : 180;
  const buttonPad = isTablet ? 17 : 15;
  const buttonMaxWidth = isTablet ? 380 : 320;

  if (variant === 'landing') {
    return (
      <View style={styles.landingContainer}>
        <Image
          source={welcomeMascotImg}
          style={[styles.landingMascot, { width: mascotSize, height: mascotSize }]}
          resizeMode="contain"
        />

        <Text style={[styles.landingTagline, { color: colors.ink }]}>
          Your barkada. One trip. Zero chaos.
        </Text>
        <Text style={[styles.landingExplain, { color: colors.inkSoft }]}>
          Barkadash brings your whole barkada together — vote on the destination, split the costs, and build one shared itinerary everyone can follow.
        </Text>

        <View style={styles.featureList}>
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <View key={feat.text} style={styles.featureRow}>
                <View
                  style={[
                    styles.featureIcon,
                    { backgroundColor: colors[feat.bg] },
                  ]}
                >
                  <Icon size={16} color={colors[feat.fg]} strokeWidth={2.2} />
                </View>
                <Text style={[styles.featureText, { color: colors.inkSoft }]}>{feat.text}</Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onGetStarted}
          style={[
            styles.getStartedButton,
            {
              backgroundColor: colors.tealDark,
              paddingVertical: buttonPad,
              maxWidth: buttonMaxWidth,
            },
          ]}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
          <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Speech Bubble Greeting */}
      <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Text style={[styles.bubbleTitle, { color: colors.ink }]}>Mabuhay, {firstName}!</Text>
        <Text style={[styles.bubbleSub, { color: colors.inkSoft }]}>
          Welcome to Barkadash — your barkada HQ. Host a new trip or join one with an invite code to start planning together.
        </Text>
      </View>
      {/* Seamless V point tail — same fill as the bubble, tucked under its bottom edge */}
      <View style={[styles.bubbleTail, { borderTopColor: colors.card }]} />

      {/* Mascot */}
      <Image
        source={greetingMascotImg}
        style={[styles.mascot, { width: mascotSize, height: mascotSize }]}
        resizeMode="contain"
      />

      <Text style={[styles.title, { color: colors.ink }]}>Let's plan something fun!</Text>
      <Text style={[styles.sub, { color: colors.inkSoft }]}>
        Your next adventure is just a few taps away.
      </Text>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onHostPress}
        style={[
          styles.button,
          styles.hostButton,
          { backgroundColor: colors.tealDark, paddingVertical: buttonPad, maxWidth: buttonMaxWidth },
        ]}
      >
        <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
        <Text style={styles.hostButtonText}>Host a Trip</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onJoinPress}
        style={[
          styles.button,
          styles.joinButton,
          { borderColor: colors.cardBorder, backgroundColor: colors.card, paddingVertical: buttonPad, maxWidth: buttonMaxWidth },
        ]}
      >
        <KeyRound size={18} color={colors.tealDark} strokeWidth={2.5} />
        <Text style={[styles.joinButtonText, { color: colors.tealDark }]}>Join via Invite Code</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  landingContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  landingMascot: {
    marginBottom: 16,
  },
  landingTagline: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.7,
    textAlign: 'center',
    marginBottom: 10,
  },
  landingExplain: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
    maxWidth: 320,
  },
  featureList: {
    width: '100%',
    maxWidth: 330,
    marginBottom: 26,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  getStartedButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
  },
  getStartedText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  bubble: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  bubbleTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  bubbleSub: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 4,
  },
  bubbleTail: {
    marginTop: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  mascot: {
    marginTop: 14,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
  },
  hostButton: {
    marginBottom: 12,
  },
  hostButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  joinButton: {
    borderWidth: 1,
  },
  joinButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
});