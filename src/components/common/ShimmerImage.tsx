import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  ImageProps,
  Animated,
  StyleSheet,
  StyleProp,
  ImageStyle,
  ViewStyle,
  Easing,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

interface ShimmerImageProps extends Omit<ImageProps, 'style'> {
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
}

export const ShimmerImage: React.FC<ShimmerImageProps> = ({
  style,
  containerStyle,
  borderRadius = 12,
  source,
  onLoad,
  onLoadStart,
  onError,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Top-left to bottom-right continuous gray light rays flow animation (2.2s per sweep)
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      })
    );
    loop.start();

    // Show gray light ray flow while image loads (max 1.2s then reveal image cleanly)
    timerRef.current = setTimeout(() => {
      finishLoading();
    }, 1200);

    return () => {
      loop.stop();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const finishLoading = () => {
    setIsLoading(false);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleLoadStart = () => {
    setIsLoading(true);
    if (onLoadStart) (onLoadStart as any)();
  };

  const handleLoad = (e: any) => {
    finishLoading();
    if (onLoad) (onLoad as any)(e);
  };

  const handleError = (e: any) => {
    finishLoading();
    if (onError) (onError as any)(e);
  };

  // Top-left to bottom-right sweep
  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 550],
  });

  return (
    <View
      style={[
        { overflow: 'hidden', borderRadius, backgroundColor: '#E2E8F0', position: 'relative' },
        containerStyle,
        style,
      ]}
    >
      {/* 1. Image Layer */}
      <Animated.View style={[{ width: '100%', height: '100%' }, { opacity: fadeAnim }]}>
        <Image
          source={source}
          onLoadStart={handleLoadStart}
          onLoad={handleLoad}
          onError={handleError}
          style={[{ width: '100%', height: '100%' }, style]}
          {...props}
        />
      </Animated.View>

      {/* 2. Top-Left to Bottom-Right Gray Light Rays Flow Overlay */}
      {isLoading && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: '#CBD5E1',
              zIndex: 10,
              opacity: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            },
          ]}
          pointerEvents="none"
        >
          {/* Neutral Gray Base Skeleton */}
          <View style={{ flex: 1, backgroundColor: '#E2E8F0' }} />

          {/* Flowing Gray Light Rays Beam (Top-Left to Bottom-Right) */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                width: '350%',
                height: '350%',
                top: '-125%',
                left: '-125%',
                transform: [{ rotate: '40deg' }, { translateX }],
              },
            ]}
          >
            <Svg height="100%" width="100%">
              <Defs>
                <LinearGradient id="grayLightRaysTopLeftToBottomRight" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#E2E8F0" stopOpacity="0" />
                  <Stop offset="18%" stopColor="#CBD5E1" stopOpacity="0.4" />
                  <Stop offset="35%" stopColor="#94A3B8" stopOpacity="0.8" />
                  <Stop offset="50%" stopColor="#E2E8F0" stopOpacity="0.95" />
                  <Stop offset="65%" stopColor="#94A3B8" stopOpacity="0.8" />
                  <Stop offset="82%" stopColor="#CBD5E1" stopOpacity="0.4" />
                  <Stop offset="100%" stopColor="#E2E8F0" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#grayLightRaysTopLeftToBottomRight)" />
            </Svg>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
};
