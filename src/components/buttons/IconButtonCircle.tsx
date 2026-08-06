import React from 'react';
import { TouchableOpacity } from 'react-native';

interface IconButtonCircleProps {
  icon: React.ReactNode;
  onPress: () => void;
  size?: number;
  bgHex?: string;
  className?: string;
}

export const IconButtonCircle: React.FC<IconButtonCircleProps> = ({
  icon,
  onPress,
  size = 40,
  bgHex,
  className = '',
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={bgHex ? { backgroundColor: bgHex } : undefined}
      className={`w-10 h-10 rounded-full bg-card border border-rule items-center justify-center shadow-xs ${className}`}
    >
      {icon}
    </TouchableOpacity>
  );
};
