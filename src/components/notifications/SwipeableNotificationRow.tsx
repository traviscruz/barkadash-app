import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Animated, PanResponder, StyleSheet, Easing } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

const OPEN_WIDTH = 104;

interface SwipeableNotificationRowProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onDragStateChange?: (dragging: boolean) => void;
  children: React.ReactNode;
}

/**
 * Swipe a row left to reveal a circular delete button, then tap it to delete.
 * Only one row can be open at a time (controlled via `isOpen`).
 */
export const SwipeableNotificationRow: React.FC<SwipeableNotificationRowProps> = ({
  isOpen,
  onOpenChange,
  onDelete,
  onDragStateChange,
  children,
}) => {
  const { colors } = useTheme();
  const pan = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(isOpen);

  // Keep latest callbacks in refs so the once-created PanResponder never
  // calls a stale (undefined) closure.
  const onOpenChangeRef = useRef(onOpenChange);
  const onDragStateChangeRef = useRef(onDragStateChange);
  const onDeleteRef = useRef(onDelete);
  onOpenChangeRef.current = onOpenChange;
  onDragStateChangeRef.current = onDragStateChange;
  onDeleteRef.current = onDelete;

  const translateX = pan.interpolate({
    inputRange: [-OPEN_WIDTH, 0],
    outputRange: [-OPEN_WIDTH, 0],
    extrapolate: 'clamp',
  });
  const btnScale = pan.interpolate({
    inputRange: [-OPEN_WIDTH, 0],
    outputRange: [1, 0.4],
    extrapolate: 'clamp',
  });
  const btnOpacity = pan.interpolate({
    inputRange: [-OPEN_WIDTH, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const setOpen = (open: boolean) => {
    Animated.timing(pan, {
      toValue: open ? -OPEN_WIDTH : 0,
      duration: 190,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  };

  // React to external open/close (another row opened, or this one closed).
  useEffect(() => {
    isOpenRef.current = isOpen;
    setOpen(isOpen);
  }, [isOpen]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 3 && Math.abs(g.dx) > Math.abs(g.dy),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 3 && Math.abs(g.dx) > Math.abs(g.dy),
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        pan.setOffset(isOpenRef.current ? -OPEN_WIDTH : 0);
        pan.setValue(0);
        onDragStateChangeRef.current?.(true);
      },
      onPanResponderMove: Animated.event([null, { dx: pan }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        pan.flattenOffset();
        const v = (pan as any).__getValue();
        let next = isOpenRef.current;
        if (v < -14) next = true;
        else if (v > 14) next = false;
        isOpenRef.current = next;
        setOpen(next);
        onOpenChangeRef.current?.(next);
        onDragStateChangeRef.current?.(false);
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        setOpen(isOpenRef.current);
        onDragStateChangeRef.current?.(false);
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      <View style={styles.deleteZone} pointerEvents="box-none">
        <Animated.View style={{ opacity: btnOpacity, transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onDeleteRef.current?.()}
            style={styles.deleteBtn}
            hitSlop={8}
          >
            <Trash2 size={22} color="#FFFFFF" strokeWidth={2.4} />
          </TouchableOpacity>
        </Animated.View>
      </View>
      <Animated.View
        style={[styles.content, { backgroundColor: colors.paper, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  deleteZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: OPEN_WIDTH,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 28,
  },
  deleteBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    width: '100%',
    backgroundColor: 'transparent',
  },
});