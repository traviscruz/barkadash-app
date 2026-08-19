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
    <View className="mb-4">
      {label && (
        <Text style={{ color: colors.ink }} className="text-xs font-bold mb-1.5 uppercase">
          {label}
        </Text>
      )}
      <TextInput
        style={[
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            color: colors.ink,
            minHeight: 50,
            textAlignVertical: 'center',
            includeFontPadding: false,
          },
          style,
        ]}
        className={`border rounded-xl px-4 py-3 text-base ${className}`}
        placeholderTextColor={colors.inkSoft}
        {...props}
      />
      {error && <Text className="text-xs text-redAccent mt-1 font-medium">{error}</Text>}
    </View>
  );
};
