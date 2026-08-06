import React from 'react';
import { View, ViewProps } from 'react-native';

interface AppCardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export const AppCard: React.FC<AppCardProps> = ({ children, className = '', ...props }) => {
  return (
    <View
      className={`bg-card rounded-2xl p-4 border border-rule shadow-xs ${className}`}
      {...props}
    >
      {children}
    </View>
  );
};
