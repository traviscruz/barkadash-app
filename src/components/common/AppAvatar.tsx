import React from 'react';
import { View, Text } from 'react-native';

interface AppAvatarProps {
  initials: string;
  size?: number;
  bgHex?: string;
  className?: string;
}

export const AppAvatar: React.FC<AppAvatarProps> = ({
  initials,
  size = 36,
  bgHex = '#4F86C6',
  className = '',
}) => {
  return (
    <View
      style={{ width: size, height: size, backgroundColor: bgHex }}
      className={`rounded-full items-center justify-center border border-white/50 ${className}`}
    >
      <Text className="text-white font-bold text-xs uppercase">{initials}</Text>
    </View>
  );
};
