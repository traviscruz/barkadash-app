import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// TODO: Implement in later sprint
export const DestinationPollScreen: React.FC = () => {
  return (
    <SafeAreaView className="flex-1 bg-paper justify-center items-center p-6">
      <Text className="text-xl font-bold text-ink mb-2">Destination Poll Standalone Screen</Text>
      <Text className="text-xs text-inkSoft text-center">
        // STUB - Standalone full-screen destination voting.
      </Text>
    </SafeAreaView>
  );
};
