import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  label,
  onPress,
  icon,
  fullWidth = true,
  disabled = false,
  className = '',
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      className={`bg-paperDim border border-rule py-3 px-5 rounded-2xl flex-row items-center justify-center ${
        fullWidth ? 'w-full' : ''
      } ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {icon && <View className="mr-2">{icon}</View>}
      <Text className="text-ink font-semibold text-sm">{label}</Text>
    </TouchableOpacity>
  );
};
