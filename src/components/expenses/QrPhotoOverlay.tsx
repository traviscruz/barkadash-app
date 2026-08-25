import React from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

interface QrPhotoOverlayProps {
  uri: string | null;
  onClose: () => void;
  sheetHeight?: number;
}

export const QrPhotoOverlay: React.FC<QrPhotoOverlayProps> = ({
  uri,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  if (!uri) return null;

  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Fullscreen Backdrop Dismiss */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Top Close Bar aligned with Safe Area */}
        <View
          style={[
            styles.topBar,
            {
              top: insets.top ? insets.top + 10 : (Platform.OS === 'ios' ? 50 : 25),
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Perfectly Centered Full-Screen High-Res Image */}
        <Image
          source={{ uri }}
          resizeMode="contain"
          style={{
            width: windowWidth * 0.92,
            height: windowHeight * 0.80,
          }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    left: 20,
    zIndex: 1000,
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
