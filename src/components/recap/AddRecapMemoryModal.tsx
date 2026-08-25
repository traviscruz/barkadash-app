import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SlideUpModal } from '../common/SlideUpModal';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { RecapMemoryType, TripRecapMemory } from '../../types/tripRecap';
import { TripRecapService } from '../../services/tripRecapService';
import {
  X,
  Camera,
  ImagePlus,
  Compass,
  Lightbulb,
  MessageSquare,
  MapPin,
  Star,
  Check,
  Trash2,
} from 'lucide-react-native';

interface AddRecapMemoryModalProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  tripTitle: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userInitials: string;
  placesVisited?: Array<{ id: string; title: string }>;
  initialMemory?: TripRecapMemory | null;
  onMemoryAdded: (memory: TripRecapMemory) => void;
  onMemoryUpdated?: (memory: TripRecapMemory) => void;
}

export const AddRecapMemoryModal: React.FC<AddRecapMemoryModalProps> = ({
  visible,
  onClose,
  tripId,
  tripTitle,
  userId,
  userName,
  userAvatar,
  userInitials,
  placesVisited = [],
  initialMemory,
  onMemoryAdded,
  onMemoryUpdated,
}) => {
  const { colors, isDark } = useTheme();
  const { sp, fs } = useResponsive();
  const windowHeight = Dimensions.get('window').height;

  const isEditing = !!initialMemory;

  // Types: combined 'note' (Trip Story + Photos), 'tip' (Travel Tip), 'place_review' (Place Review)
  const [memoryType, setMemoryType] = useState<RecapMemoryType>('note');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [initialPhotos, setInitialPhotos] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [placeName, setPlaceName] = useState('');
  const [rating, setRating] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialMemory) {
      setMemoryType(initialMemory.type === 'photo' ? 'note' : initialMemory.type || 'note');
      setTitle(initialMemory.title || '');
      setContent(initialMemory.content || '');
      setPlaceName(initialMemory.placeName || '');
      setRating(initialMemory.rating || 5);
      const existingPhotos = initialMemory.photos && initialMemory.photos.length > 0
        ? initialMemory.photos
        : initialMemory.photoUrl
        ? [initialMemory.photoUrl]
        : [];
      setPhotoUris(existingPhotos);
      setInitialPhotos(existingPhotos);
    } else {
      resetForm();
    }
  }, [initialMemory, visible]);

  const resetForm = () => {
    setMemoryType('note');
    setPhotoUris([]);
    setInitialPhotos([]);
    setTitle('');
    setContent('');
    setPlaceName('');
    setRating(5);
  };

  const pickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Gallery permission is required to choose photos.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const newUris = res.assets.map((a) => a.uri).filter(Boolean);
        setPhotoUris((prev) => [...prev, ...newUris]);
      }
    } catch (e) {
      console.warn('pickImages error:', e);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera permission is required to take photos.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setPhotoUris((prev) => [...prev, res.assets[0].uri]);
      }
    } catch (e) {
      console.warn('takePhoto error:', e);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (photoUris.length === 0 && !content.trim() && !title.trim()) {
      Alert.alert('Content required', 'Please add at least one photo or write a story note.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && initialMemory) {
        // Track removed storage photos
        const oldPhotosToDelete = initialPhotos.filter((p) => !photoUris.includes(p));

        const res = await TripRecapService.getInstance().updateMemory(initialMemory.id, tripId, userId, {
          title: title.trim() || undefined,
          content: content.trim() || undefined,
          rating: memoryType === 'place_review' ? rating : undefined,
          placeName: placeName.trim() || undefined,
          photoUris,
          oldPhotosToDelete,
        });

        const finalPhotos = res.finalPhotos || photoUris;
        const updated: TripRecapMemory = {
          ...initialMemory,
          type: memoryType,
          title: title.trim() || undefined,
          content: content.trim() || undefined,
          placeName: placeName.trim() || undefined,
          rating: memoryType === 'place_review' ? rating : undefined,
          photos: finalPhotos.length > 0 ? finalPhotos : undefined,
          photoUrl: finalPhotos[0] || undefined,
        };
        onMemoryUpdated?.(updated);
        onClose();
      } else {
        const newMem = await TripRecapService.getInstance().addMemory({
          tripId,
          userId,
          userName,
          userAvatar,
          userInitials,
          type: memoryType,
          title: title.trim() || undefined,
          content: content.trim() || undefined,
          photoUris: photoUris.length > 0 ? photoUris : undefined,
          photoUri: photoUris[0] || undefined,
          placeName: placeName.trim() || undefined,
          rating: memoryType === 'place_review' ? rating : undefined,
        });

        onMemoryAdded(newMem);
        resetForm();
        onClose();
      }
    } catch (e: any) {
      console.warn('handleSave error:', e);
      Alert.alert('Error', e?.message || 'Failed to save story.');
    } finally {
      setSaving(false);
    }
  };

  // Combined Post Types: Photos and Story Note are now in ONE unified 'Story Note'
  const MEMORY_TYPES: Array<{ type: RecapMemoryType; label: string; icon: any }> = [
    { type: 'note', label: 'Trip Story', icon: MessageSquare },
    { type: 'tip', label: 'Travel Tip', icon: Lightbulb },
    { type: 'place_review', label: 'Place Review', icon: Star },
  ];

  return (
    <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.5} useKeyboardAvoiding>
      <View
        style={{
          backgroundColor: colors.paper,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          maxHeight: windowHeight * 0.88,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Platform.OS === 'ios' ? 34 : 20,
          borderWidth: 1,
          borderColor: colors.cardBorder,
        }}
      >
        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingBottom: 10 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? '#4B5563' : '#D1D5DB' }} />
        </View>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 }}>
              {isEditing ? 'Edit Story Post' : 'Share to Trip Recap'}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginTop: 2 }}>
              {tripTitle} · Photos & Moments
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.subtleBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} color={colors.inkSoft} />
          </TouchableOpacity>
        </View>

        {/* Scrollable Form Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: sp.lg + 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Post Type Selector (Unified) */}
          {!isEditing && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                Story Type
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {MEMORY_TYPES.map((t) => {
                  const IconComp = t.icon;
                  const isSelected = memoryType === t.type;
                  return (
                    <TouchableOpacity
                      key={t.type}
                      onPress={() => setMemoryType(t.type)}
                      activeOpacity={0.8}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 6,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        backgroundColor: isSelected ? colors.tealDark : colors.card,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                      }}
                    >
                      <IconComp size={16} color={isSelected ? '#FFFFFF' : colors.inkSoft} />
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '800',
                          color: isSelected ? '#FFFFFF' : colors.ink,
                          textAlign: 'center',
                        }}
                        numberOfLines={1}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Photo Gallery & Picker (Available across all post types in both add & edit) */}
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Photos ({photoUris.length})
                </Text>
                {photoUris.length > 0 && (
                  <View style={{ backgroundColor: isDark ? 'rgba(59,122,158,0.2)' : '#E0F2FE', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 100 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.tealDark }}>
                      {photoUris.length} attached
                    </Text>
                  </View>
                )}
              </View>
              {photoUris.length > 0 && (
                <TouchableOpacity onPress={() => setPhotoUris([])}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#EF4444' }}>
                    Clear All
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Photo Preview Carousel */}
            {photoUris.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {photoUris.map((uri, idx) => (
                    <View
                      key={idx}
                      style={{
                        width: 120,
                        height: 140,
                        borderRadius: 18,
                        overflow: 'hidden',
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        position: 'relative',
                      }}
                    >
                      <Image source={{ uri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                      <TouchableOpacity
                        onPress={() => removePhoto(idx)}
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: 'rgba(0,0,0,0.65)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <X size={13} color="#FFFFFF" strokeWidth={2.4} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* Pick / Take Photo Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={takePhoto}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: 16,
                  paddingVertical: 11,
                }}
              >
                <Camera size={17} color={colors.tealDark} />
                <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.ink }}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={pickImages}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: 16,
                  paddingVertical: 11,
                }}
              >
                <ImagePlus size={17} color={colors.tealDark} />
                <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.ink }}>
                  {photoUris.length > 0 ? '+ Add More' : 'Add Photos'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Place Tag / Selection */}
          {placesVisited.length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
                Tag Itinerary Spot (Optional)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {placesVisited.map((p) => {
                    const isSelected = placeName === p.title;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setPlaceName(isSelected ? '' : p.title)}
                        activeOpacity={0.8}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 100,
                          backgroundColor: isSelected ? (isDark ? '#064E3B' : '#D1FAE5') : colors.card,
                          borderWidth: 1,
                          borderColor: isSelected ? '#10B981' : colors.cardBorder,
                        }}
                      >
                        <MapPin size={12} color={isSelected ? '#10B981' : colors.inkSoft} />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: isSelected ? (isDark ? '#34D399' : '#065F46') : colors.ink,
                          }}
                        >
                          {p.title}
                        </Text>
                        {isSelected && <Check size={12} color="#10B981" strokeWidth={2.4} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Rating stars if place review */}
          {memoryType === 'place_review' && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
                Rating
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    activeOpacity={0.8}
                    style={{ padding: 4 }}
                  >
                    <Star
                      size={26}
                      color={star <= rating ? '#F59E0B' : (isDark ? '#4B5563' : '#D1D5DB')}
                      fill={star <= rating ? '#F59E0B' : 'transparent'}
                    />
                  </TouchableOpacity>
                ))}
                <Text style={{ fontSize: fs.sm, fontWeight: '900', color: '#F59E0B', marginLeft: 6 }}>
                  {rating} / 5 Stars
                </Text>
              </View>
            </View>
          )}

          {/* Title Input */}
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
              {memoryType === 'tip' ? 'Tip Summary' : 'Title (Optional)'}
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={
                memoryType === 'tip'
                  ? 'e.g. Bring extra cash for boat entrance fees'
                  : memoryType === 'place_review'
                  ? 'e.g. Crystal clear waters, best sunset view!'
                  : 'e.g. Sunset at the cliffside'
              }
              placeholderTextColor={colors.inkSoft}
              style={{
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                borderWidth: 1,
                borderRadius: 16,
                padding: 12,
                fontSize: fs.sm,
                color: colors.ink,
                fontWeight: '600',
              }}
            />
          </View>

          {/* Content / Story Text Input */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
              {memoryType === 'tip' ? 'Tip Details' : 'Story / Note / Caption'}
            </Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder={
                memoryType === 'tip'
                  ? 'Share insider advice for anyone visiting this place or planning a similar trip...'
                  : 'What was memorable about this? Fun moments, inside jokes, or recommendations...'
              }
              placeholderTextColor={colors.inkSoft}
              multiline
              numberOfLines={4}
              style={{
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                borderWidth: 1,
                borderRadius: 16,
                padding: 12,
                fontSize: fs.sm,
                color: colors.ink,
                minHeight: 90,
                textAlignVertical: 'top',
              }}
            />
          </View>

          {/* Submit Action Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.tealDark,
              paddingVertical: 14,
              borderRadius: 100,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.tealDark,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: fs.sm, fontWeight: '900' }}>
                {isEditing ? 'Save Changes' : 'Post to Trip Recap'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SlideUpModal>
  );
};
