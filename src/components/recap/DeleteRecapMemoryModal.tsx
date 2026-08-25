import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

interface DeleteRecapMemoryModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  title?: string;
  itemType?: string;
}

export const DeleteRecapMemoryModal: React.FC<DeleteRecapMemoryModalProps> = ({
  visible,
  onClose,
  onConfirm,
  loading = false,
  title,
  itemType = 'post',
}) => {
  const { colors, isDark } = useTheme();

  if (!visible) return null;

  const itemLabel = itemType === 'tip' ? 'Travel Tip' : itemType === 'photo' ? 'Photo Post' : itemType === 'place_review' ? 'Review' : 'Note';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.65)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={{
            width: '100%',
            maxWidth: 340,
            backgroundColor: isDark ? colors.paper : '#FFFFFF',
            borderRadius: 28,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            padding: 24,
            alignItems: 'center',
            elevation: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
          }}
        >
          {/* Circular Red Badge */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FCE8E6',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Trash2 size={26} color="#EF4444" strokeWidth={2.2} />
          </View>

          {/* Title */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: '900',
              color: colors.ink,
              textAlign: 'center',
              marginBottom: 6,
            }}
          >
            Delete {itemLabel}?
          </Text>

          {/* Description */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: colors.inkSoft,
              textAlign: 'center',
              lineHeight: 18,
              marginBottom: 20,
            }}
          >
            {title
              ? `Are you sure you want to delete "${title}"? Any attached photos will be removed from storage.`
              : `This permanently removes this ${itemLabel.toLowerCase()} and its photos from the trip recap. This action cannot be undone.`}
          </Text>

          {/* Buttons matching TripSelectorModal */}
          <View style={{ width: '100%', gap: 10 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onConfirm}
              disabled={loading}
              style={{
                backgroundColor: '#EF4444',
                paddingVertical: 13,
                borderRadius: 100,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#EF4444',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                  Yes, Delete {itemLabel}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onClose}
              disabled={loading}
              style={{
                borderWidth: 1,
                borderColor: colors.cardBorder,
                paddingVertical: 11,
                borderRadius: 100,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.inkSoft, fontSize: 13, fontWeight: '700' }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
