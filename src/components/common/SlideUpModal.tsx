import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Animated,
  TouchableWithoutFeedback,
  View,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
  StyleSheet,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SlideUpModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  backdropOpacity?: number;
  useKeyboardAvoiding?: boolean;
}

export const SlideUpModal: React.FC<SlideUpModalProps> = ({
  visible,
  onClose,
  children,
  backdropOpacity = 0.5,
  useKeyboardAvoiding = false,
}) => {
  const [modalVisible, setModalVisible] = useState(visible);
  const animValue = useRef(new Animated.Value(0)).current;
  const keyboardShift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.timing(animValue, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setModalVisible(false);
        }
      });
    }
  }, [visible, animValue]);

  // Native-driver keyboard shift (iOS). On Android the window resizes itself
  // (softwareKeyboardLayoutMode: resize), so the OS keeps the sheet above the
  // keyboard without any JS work.
  useEffect(() => {
    if (!useKeyboardAvoiding) {
      // Release the sheet back down when keyboard avoidance is turned off.
      Animated.timing(keyboardShift, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt, (e: any) => {
      if (Platform.OS === 'ios') {
        Animated.timing(keyboardShift, {
          toValue: -e.endCoordinates.height,
          duration: e.duration ?? 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });
    const hideSub = Keyboard.addListener(hideEvt, (e: any) => {
      if (Platform.OS === 'ios') {
        Animated.timing(keyboardShift, {
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
  }, [useKeyboardAvoiding, keyboardShift]);

  if (!modalVisible) return null;

  const backdropAnimStyle = {
    opacity: animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, backdropOpacity],
    }),
  };

  const sheetAnimStyle = {
    transform: [
      {
        translateY: Animated.add(
          animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [SCREEN_HEIGHT * 0.5, 0],
          }),
          keyboardShift
        ),
      },
    ],
  };

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.outerContainer} pointerEvents="box-none">
        {/* Fixed dark backdrop overlay that stays stationary and only fades opacity */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.backdrop, backdropAnimStyle]} />
        </TouchableWithoutFeedback>

        {/* Slide-up bottom sheet container */}
        <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          <Animated.View style={[styles.sheetContainer, sheetAnimStyle]}>
            {children}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  sheetContainer: {
    width: '100%',
    justifyContent: 'flex-end',
  },
});
