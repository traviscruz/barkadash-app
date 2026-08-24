import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface AppTextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

export const AppTextField: React.FC<AppTextFieldProps> = ({
  label,
  error,
  className = '',
  style,
  ...props
}) => {
  const { colors } = useTheme();

  return (
    <View style={{ marginBottom: 12 }}>
      {label && (
        <Text style={{ color: colors.ink, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            color: colors.ink,
            height: 42,
            fontSize: 13,
            fontWeight: '600',
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: 1,
            textAlignVertical: 'center',
            includeFontPadding: false,
          },
          style,
        ]}
        placeholderTextColor={colors.inkSoft}
        {...props}
      />
      {error && <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '600', marginTop: 4 }}>{error}</Text>}
    </View>
  );
};
