import React from 'react';
import { View, Dimensions } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

interface ZigZagEdgeProps {
  color: string;
  direction?: 'top' | 'bottom';
  tooth?: number;
  height?: number;
  width?: number;
}

export const ZigZagEdge: React.FC<ZigZagEdgeProps> = ({
  color,
  direction = 'top',
  tooth = 14,
  height = 8,
  width = SCREEN_W,
}) => {
  const count = Math.max(1, Math.round(width / tooth) + 1);

  return (
    <View style={{ flexDirection: 'row', overflow: 'hidden', height }}>
      {Array.from({ length: count }).map((_, i) => {
        const up = direction === 'top' ? i % 2 === 0 : i % 2 === 1;
        return up ? (
          <View
            key={i}
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: tooth / 2,
              borderRightWidth: tooth / 2,
              borderBottomWidth: height,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: color,
            }}
          />
        ) : (
          <View
            key={i}
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: tooth / 2,
              borderRightWidth: tooth / 2,
              borderTopWidth: height,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: color,
            }}
          />
        );
      })}
    </View>
  );
};