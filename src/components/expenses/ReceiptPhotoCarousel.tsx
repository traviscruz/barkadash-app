import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Trash2 } from 'lucide-react-native';

interface ReceiptPhotoCarouselProps {
  photos: string[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
  onDelete?: (index: number) => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export const ReceiptPhotoCarousel: React.FC<ReceiptPhotoCarouselProps> = ({
  photos,
  initialIndex,
  visible,
  onClose,
  onDelete,
}) => {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);

  if (!visible || photos.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.container}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: index * SCREEN_W, y: 0 }}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
          style={styles.carousel}
        >
          {photos.map((uri, i) => (
            <Image key={i} source={{ uri }} resizeMode="contain" style={{ width: SCREEN_W, height: SCREEN_H }} />
          ))}
        </ScrollView>

        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <TouchableOpacity activeOpacity={0.8} onPress={onClose} style={styles.roundBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.counter}>
            {index + 1} / {photos.length}
          </Text>
          {onDelete && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onDelete(index)}
              style={[styles.roundBtn, { backgroundColor: 'rgba(226,96,74,0.35)' }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  carousel: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  counter: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});