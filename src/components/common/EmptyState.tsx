import React from 'react';
import { View, Text } from 'react-native';
import { PrimaryButton } from '../buttons/PrimaryButton';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  buttonLabel?: string;
  onButtonPress?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  buttonLabel,
  onButtonPress,
}) => {
  return (
    <View className="py-12 px-6 items-center justify-center bg-paperDim/50 rounded-3xl border border-dashed border-rule">
      {icon && <View className="mb-3">{icon}</View>}
      <Text className="text-lg font-bold text-ink text-center mb-1">{title}</Text>
      <Text className="text-sm text-inkSoft text-center mb-5 leading-5">{subtitle}</Text>
      {buttonLabel && onButtonPress && (
        <PrimaryButton label={buttonLabel} onPress={onButtonPress} fullWidth={false} />
      )}
    </View>
  );
};
