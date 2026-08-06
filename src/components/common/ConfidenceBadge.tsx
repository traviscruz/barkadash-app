import React from 'react';
import { View, Text } from 'react-native';

interface ConfidenceBadgeProps {
  score: number; // 0 - 100
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ score }) => {
  let bgClass = 'bg-lightGreenBg';
  let textClass = 'text-good';

  if (score < 50) {
    bgClass = 'bg-lightRedBg';
    textClass = 'text-redAccent';
  } else if (score < 80) {
    bgClass = 'bg-lightOrangeBg';
    textClass = 'text-orangeAccent';
  }

  return (
    <View className={`px-2.5 py-1 rounded-full ${bgClass}`}>
      <Text className={`text-xs font-bold ${textClass}`}>{score}% RSVP Confidence</Text>
    </View>
  );
};
