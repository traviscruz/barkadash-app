import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useResponsive } from '../../utils/responsive';

interface SectionHeaderProps {
  title: string;
  actionText?: string;
  onActionPress?: () => void;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  actionText,
  onActionPress,
  className = '',
}) => {
  const { fs, sp } = useResponsive();
  return (
    <View
      style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.md }}
      className={className}
    >
      <Text style={{ fontSize: fs.xs, fontWeight: '800', color: '#6E738A', letterSpacing: 1, textTransform: 'uppercase' }}>
        {title}
      </Text>
      {actionText && onActionPress && (
        <TouchableOpacity activeOpacity={0.7} onPress={onActionPress}>
          <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#2A8563', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {actionText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
