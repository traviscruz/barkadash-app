import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';

interface AppTextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

export const AppTextField: React.FC<AppTextFieldProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <View className="mb-4">
      {label && <Text className="text-xs font-bold text-ink mb-1.5 uppercase">{label}</Text>}
      <TextInput
        className={`bg-white border border-rule rounded-xl px-4 py-3 text-base text-ink ${className}`}
        placeholderTextColor="#6E738A"
        {...props}
      />
      {error && <Text className="text-xs text-redAccent mt-1 font-medium">{error}</Text>}
    </View>
  );
};
