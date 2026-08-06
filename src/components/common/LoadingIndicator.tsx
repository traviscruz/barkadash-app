import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingIndicatorProps {
  message?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = 'Loading...',
}) => {
  return (
    <View className="py-8 items-center justify-center">
      <ActivityIndicator size="large" color="#2A8563" />
      <Text className="text-xs font-semibold text-inkSoft mt-2.5">{message}</Text>
    </View>
  );
};
