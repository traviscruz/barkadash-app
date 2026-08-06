import React from 'react';
import { Text, View, StyleSheet, TextStyle, ViewStyle } from 'react-native';

interface HandwrittenTextProps {
  children: string;
  style?: TextStyle;
  containerStyle?: ViewStyle;
  showStickyNote?: boolean;
}

export const HandwrittenText: React.FC<HandwrittenTextProps> = ({
  children,
  style,
  containerStyle,
  showStickyNote = false,
}) => {
  const content = (
    <Text style={[styles.handwrittenText, style]}>
      "{children}"
    </Text>
  );

  if (showStickyNote) {
    return (
      <View style={[styles.noteBadge, containerStyle]}>
        <View style={styles.tape} />
        {content}
      </View>
    );
  }

  return (
    <View style={[styles.inlineWrapper, containerStyle]}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  inlineWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  handwrittenText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2A8563',
    fontStyle: 'italic',
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 18,
  },
  noteBadge: {
    backgroundColor: '#FEF9E7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3E5AB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  tape: {
    position: 'absolute',
    top: -6,
    alignSelf: 'center',
    width: 48,
    height: 12,
    backgroundColor: 'rgba(245, 166, 91, 0.4)',
    borderRadius: 2,
  },
});
