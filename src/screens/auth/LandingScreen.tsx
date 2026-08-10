import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { ChevronRight } from 'lucide-react-native';
import { AppColors } from '../../utils/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface LandingScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const DESTINATION_SLIDES = [
  {
    id: 'elnido',
    title: 'Unforgettable Barkada Trips Delivered Fast with Just One App!',
    subtitle: 'Your Ultimate Companion for Every Adventure, Anytime.',
    image: require('../../../assets/images/elnido.jpg'),
  },
  {
    id: 'biglagoon',
    title: 'Split Bills & Share Memories Seamlessly!',
    subtitle: 'Keep track of group expenses and stay synced on every getaway.',
    image: require('../../../assets/images/biglagoon.jpg'),
  },
  {
    id: 'sagada',
    title: 'Explore Higher Peaks with Real-Time Barkada Radar!',
    subtitle: 'Coordinate meeting points and view live squad locations with ease.',
    image: require('../../../assets/images/sagadasunrise.jpg'),
  },
];

export const LandingScreen: React.FC<LandingScreenProps> = ({ onGetStarted, onSignIn }) => {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % DESTINATION_SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const currentSlide = DESTINATION_SLIDES[activeSlide];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Hero Image Background */}
      <ImageBackground
        source={currentSlide.image}
        style={styles.heroImage}
        resizeMode="cover"
      >
        {/* Dark Gradient Overlay */}
        <View style={styles.gradientOverlay} />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          {/* Top Nav: Standalone Logo + Brand Name */}
          <View style={styles.topNav}>
            <BarkadashLogo height={72} style={styles.standaloneLogo} />
            <Text style={styles.brandTitle}>Barkadash</Text>
          </View>

          {/* Spacer to push content down */}
          <View style={{ flex: 1 }} />

          {/* Bottom Hero Content */}
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{currentSlide.title}</Text>
            <Text style={styles.heroSub}>{currentSlide.subtitle}</Text>

            {/* Pagination Dots */}
            <View style={styles.paginationRow}>
              {DESTINATION_SLIDES.map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setActiveSlide(idx)}
                  activeOpacity={0.8}
                  style={[
                    styles.dot,
                    activeSlide === idx ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>

            {/* Main Action Button - Slim Oval Pill */}
            <TouchableOpacity
              onPress={onGetStarted}
              activeOpacity={0.88}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>Get Started</Text>
              <ChevronRight size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            {/* Sign In Link */}
            <TouchableOpacity
              onPress={onSignIn}
              activeOpacity={0.7}
              style={styles.signInBtn}
            >
              <Text style={styles.signInText}>
                Already a member? <Text style={styles.signInLink}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F2A3C',
  },
  heroImage: {
    flex: 1,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 42, 60, 0.55)',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  topNav: {
    alignItems: 'center',
    marginTop: 24,
  },
  standaloneLogo: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginTop: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroContent: {
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroSub: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 20,
    fontWeight: '400',
    marginBottom: 28,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 28,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 24,
    backgroundColor: AppColors.tealDark,
  },
  dotInactive: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  primaryBtn: {
    backgroundColor: AppColors.tealDark,
    borderRadius: 100,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.tealDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  signInBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  signInText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  signInLink: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
