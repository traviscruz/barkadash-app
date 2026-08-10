import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface AppCardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export const AppCard: React.FC<AppCardProps> = ({ children, className = '', style, ...props }) => {
  const { colors } = useTheme();

  return (
    <View
      style={[{ backgroundColor: colors.card, borderColor: colors.cardBorder }, style]}
      className={`rounded-2xl p-4 border shadow-xs ${className}`}
      {...props}
    >
      {children}
    </View>
  );
};
