import { useEffect, useRef } from 'react';
import { Animated, Keyboard, Platform, Easing } from 'react-native';

/**
 * Returns an Animated.Value that shifts content up by the keyboard height.
 *
 * - iOS: animated on the native driver using the keyboard's own duration/easing,
 *   so it moves in perfect sync with the keyboard (no JS-thread lag).
 * - Android: returns 0 — the OS resizes the window itself
 *   (softwareKeyboardLayoutMode: "resize"), so no JS work is needed.
 */
export function useKeyboardShift(active = true): Animated.Value {
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt, (e: any) => {
      if (Platform.OS === 'ios') {
        Animated.timing(shift, {
          toValue: -e.endCoordinates.height,
          duration: e.duration ?? 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });
    const hideSub = Keyboard.addListener(hideEvt, (e: any) => {
      if (Platform.OS === 'ios') {
        Animated.timing(shift, {
          toValue: 0,
          duration: e.duration ?? 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [active, shift]);

  return shift;
}