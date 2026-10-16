import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera,
  Image as ImageIcon,
  Link2,
  Trash2,
  X,
  Check,
  Globe,
  Upload,
} from 'lucide-react-native';
import { ShimmerImage } from '../common/ShimmerImage';
import { getPlacePhotoUrl, PlacePhoto } from '../../services/googlePlaces';

export interface PlacePhotoPickerProps {
  googlePhotos?: PlacePhoto[];
  selectedPhoto?: string;
  onSelectPhoto: (photoRefOrUrl: string) => void;
  onClearPhoto: () => void;
  accent: string;
  border: string;
  ink: string;
  muted: string;
  paper: string;
  isDark: boolean;
  fs?: { xs: number; sm: number; md: number; lg?: number; xl?: number };
  label?: string;
}

export const PlacePhotoPicker: React.FC<PlacePhotoPickerProps> = ({
  googlePhotos,
  selectedPhoto,
  onSelectPhoto,
  onClearPhoto,
  accent,
  border,
  ink,
  muted,
  paper,
  isDark,
  fs = { xs: 11, sm: 13, md: 15 },
  label = 'COVER PHOTO',
}) => {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkError, setLinkError] = useState('');

  // Determine current preview URI
  const previewUri = selectedPhoto
    ? (selectedPhoto.startsWith('http://') || selectedPhoto.startsWith('https://') || selectedPhoto.startsWith('file://') || selectedPhoto.startsWith('content://')
        ? selectedPhoto
        : getPlacePhotoUrl(selectedPhoto, 600))
    : '';

  // Determine source type badge
  const getSourceBadge = (): { label: string; icon: 'google' | 'upload' | 'link' } | null => {
    if (!selectedPhoto) return null;
    if (selectedPhoto.startsWith('file://') || selectedPhoto.startsWith('content://')) {
      return { label: 'New Upload', icon: 'upload' };
    }
    if (selectedPhoto.includes('trip-places') || selectedPhoto.includes('trip-photos') || selectedPhoto.includes('supabase.co')) {
      return { label: 'Uploaded Photo', icon: 'upload' };
    }
    if (selectedPhoto.startsWith('http://') || selectedPhoto.startsWith('https://')) {
      return { label: 'Web Image', icon: 'link' };
    }
    return { label: 'Google Places', icon: 'google' };
  };

  const badge = getSourceBadge();

  // Pick image from phone gallery
  const pickFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Photo library access is needed to select an image for this place.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        onSelectPhoto(result.assets[0].uri);
        setShowLinkInput(false);
      }
    } catch (err) {
      console.warn('pickFromLibrary error:', err);
    }
  };

  // Capture photo from camera
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera access is needed to take a photo for this place.'
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        onSelectPhoto(result.assets[0].uri);
        setShowLinkInput(false);
      }
    } catch (err) {
      console.warn('takePhoto error:', err);
    }
  };

  // Open upload options (Camera or Gallery)
  const handleUploadPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) takePhoto();
          else if (buttonIndex === 2) pickFromLibrary();
        }
      );
    } else {
      Alert.alert('Upload Photo', 'Choose source', [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  // Handle applying online image link
  const handleApplyLink = () => {
    const trimmed = linkText.trim();
    if (!trimmed) {
      setLinkError('Please enter an image URL');
      return;
    }
    let url = trimmed;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    setLinkError('');
    onSelectPhoto(url);
    setShowLinkInput(false);
    setLinkText('');
  };

  const validGooglePhotos = (googlePhotos || []).filter((ph) => !!getPlacePhotoUrl(ph.reference, 400));

  return (
    <View style={{ marginTop: 12, marginBottom: 8 }}>
      {/* Header Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={{
              fontSize: fs.xs,
              fontWeight: '900',
              color: muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </Text>
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 1.5,
              borderRadius: 6,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            }}
          >
            <Text style={{ fontSize: fs.xs - 2, fontWeight: '700', color: muted }}>OPTIONAL</Text>
          </View>
        </View>

        {!!selectedPhoto && (
          <TouchableOpacity
            onPress={onClearPhoto}
            activeOpacity={0.7}
            hitSlop={6}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Trash2 size={12} color="#EF4444" strokeWidth={2.2} />
            <Text style={{ fontSize: fs.xs, fontWeight: '800', color: '#EF4444' }}>
              Remove Photo
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Selected Photo Card Preview */}
      {!!previewUri && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 8,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: accent,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            marginBottom: 10,
            gap: 10,
          }}
        >
          <ShimmerImage
            source={{ uri: previewUri }}
            style={{ width: 68, height: 68, borderRadius: 10 }}
            resizeMode="cover"
          />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 6,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                }}
              >
                <Text style={{ fontSize: fs.xs - 1, fontWeight: '800', color: ink }}>
                  {badge?.label || 'Cover Photo'}
                </Text>
              </View>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
                <Check size={10} color="#FFFFFF" strokeWidth={3} />
              </View>
            </View>
            <Text
              style={{ fontSize: fs.xs, color: muted, fontWeight: '600' }}
              numberOfLines={2}
            >
              {selectedPhoto && (selectedPhoto.startsWith('http') || selectedPhoto.startsWith('file'))
                ? selectedPhoto
                : 'Selected from Google Places'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClearPhoto}
            hitSlop={8}
            activeOpacity={0.7}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : '#FEE2E2',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} color="#EF4444" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      )}

      {/* Google Places Candidates Row (if available) */}
      {validGooglePhotos.length > 0 && (
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: fs.xs - 1, fontWeight: '800', color: muted, marginBottom: 6, letterSpacing: 0.5 }}>
            GOOGLE PLACES PHOTOS
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8 }}
          >
            {validGooglePhotos.map((ph) => {
              const isSelected = ph.reference === selectedPhoto;
              const uri = getPlacePhotoUrl(ph.reference, 400);
              if (!uri) return null;
              return (
                <TouchableOpacity
                  key={ph.reference}
                  onPress={() => {
                    onSelectPhoto(ph.reference);
                    setShowLinkInput(false);
                  }}
                  activeOpacity={0.8}
                >
                  <ShimmerImage
                    source={{ uri }}
                    style={{ width: 64, height: 64, borderRadius: 12 }}
                    containerStyle={{
                      borderRadius: 12,
                      borderWidth: isSelected ? 2.5 : 1,
                      borderColor: isSelected ? accent : border,
                    }}
                  />
                  {isSelected && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: accent,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Check size={11} color="#FFFFFF" strokeWidth={3.5} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Action Buttons: [Upload Photo] & [Paste Image Link] */}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={handleUploadPress}
          activeOpacity={0.75}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: border,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
          }}
        >
          <ImageIcon size={15} color={accent} strokeWidth={2.2} />
          <Text style={{ fontSize: fs.xs, fontWeight: '800', color: ink }}>
            Upload Image
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setShowLinkInput((v) => !v);
            setLinkError('');
          }}
          activeOpacity={0.75}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: showLinkInput ? accent : border,
            backgroundColor: showLinkInput
              ? (isDark ? 'rgba(255,255,255,0.08)' : '#EEF2F6')
              : (isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC'),
          }}
        >
          <Link2 size={15} color={showLinkInput ? accent : muted} strokeWidth={2.2} />
          <Text style={{ fontSize: fs.xs, fontWeight: '800', color: showLinkInput ? accent : ink }}>
            Image Link
          </Text>
        </TouchableOpacity>
      </View>

      {/* Expandable Image Link Input */}
      {showLinkInput && (
        <View
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: border,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Globe size={15} color={muted} strokeWidth={2} />
            <TextInput
              style={{
                flex: 1,
                fontSize: fs.sm,
                color: ink,
                paddingVertical: 4,
              }}
              placeholder="Paste image URL (https://...)"
              placeholderTextColor={muted}
              value={linkText}
              onChangeText={(t) => {
                setLinkText(t);
                setLinkError('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {!!linkText && (
              <TouchableOpacity onPress={() => setLinkText('')} hitSlop={6}>
                <X size={14} color={muted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleApplyLink}
              activeOpacity={0.8}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: accent,
              }}
            >
              <Text style={{ fontSize: fs.xs, fontWeight: '800', color: '#FFFFFF' }}>
                Apply
              </Text>
            </TouchableOpacity>
          </View>
          {!!linkError && (
            <Text style={{ fontSize: fs.xs - 1, color: '#EF4444', fontWeight: '700', marginTop: 4 }}>
              {linkError}
            </Text>
          )}
        </View>
      )}

      {/* Helper text when no photo is selected */}
      {!selectedPhoto && (
        <Text style={{ fontSize: fs.xs - 1, color: muted, marginTop: 6, fontStyle: 'italic' }}>
          Leave empty to show the default icon placeholder.
        </Text>
      )}
    </View>
  );
};
