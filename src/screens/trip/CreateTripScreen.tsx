import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HostJoinTripModal } from '../../components/trip/HostJoinTripModal';
import { useTheme } from '../../context/ThemeContext';

export const CreateTripScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(true);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <HostJoinTripModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          onBack?.();
        }}
      />
    </SafeAreaView>
  );
};

