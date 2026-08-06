import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  icon,
  fullWidth = true,
  disabled = false,
  className = '',
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      className={`bg-[#1F4E67] py-3.5 px-6 rounded-2xl flex-row items-center justify-center shadow-sm ${
        fullWidth ? 'w-full' : ''
      } ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {icon && <View className="mr-2">{icon}</View>}
      <Text className="text-white font-bold text-base tracking-tight">{label}</Text>
    </TouchableOpacity>
  );
};
