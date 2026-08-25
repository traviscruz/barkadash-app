import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { X, Globe, Users, Lock, Check, Share2 } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { RecapVisibility } from '../../types/tripRecap';

interface PublishTripPostModalProps {
  visible: boolean;
  tripId: string;
  tripTitle: string;
  currentVisibility?: RecapVisibility;
  currentNotes?: string;
  currentCoverPhoto?: string;
  availablePhotos?: string[];
  onClose: () => void;
  onSave: (visibility: RecapVisibility, notes?: string, coverPhotoUrl?: string) => Promise<void>;
  onUnpublish?: () => Promise<void>;
}

export const PublishTripPostModal: React.FC<PublishTripPostModalProps> = ({
  visible,
  tripId,
  tripTitle,
  currentVisibility = 'private',
  currentNotes = '',
  currentCoverPhoto,
  availablePhotos = [],
  onClose,
  onSave,
  onUnpublish,
}) => {
  const { colors, isDark } = useTheme();
  const { sp, fs } = useResponsive();

  const [visibility, setVisibility] = useState<RecapVisibility>(currentVisibility);
  const [notes, setNotes] = useState(currentNotes);
  const [selectedPhoto, setSelectedPhoto] = useState<string | undefined>(currentCoverPhoto);
  const [saving, setSaving] = useState(false);

  const prevVisibleRef = useRef(false);

  // Sync state ONLY when modal changes from hidden -> visible
  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setVisibility(currentVisibility || 'private');
      setNotes(currentNotes || '');
      setSelectedPhoto(currentCoverPhoto || (availablePhotos && availablePhotos[0]));
    }
    prevVisibleRef.current = visible;
  }, [visible, currentVisibility, currentNotes, currentCoverPhoto]);

  const handlePublish = async () => {
    setSaving(true);
    try {
      await onSave(visibility, notes, selectedPhoto);
      onClose();
    } catch (e) {
      console.warn('Publish error:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    if (!onUnpublish) return;
    setSaving(true);
    try {
      await onUnpublish();
      onClose();
    } catch (e) {
      console.warn('Unpublish error:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.65)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 24,
        }}
      >
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />

        <View
          style={{
            width: '100%',
            maxWidth: 440,
            maxHeight: '90%',
            backgroundColor: colors.card,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 12,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              paddingBottom: 14,
              borderBottomWidth: 1,
              borderColor: colors.cardBorder,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: colors.tealDark,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Share2 size={20} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink }} numberOfLines={1}>
                  Post Trip to Feed
                </Text>
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.inkSoft, marginTop: 1 }} numberOfLines={1}>
                  {tripTitle}
                </Text>
              </View>
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
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 18, paddingBottom: 8 }}
          >
            {/* 1. Visibility Options */}
            <View>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
                Who can see this trip?
              </Text>

              <View style={{ gap: 10 }}>
                {/* Public Option */}
                <TouchableOpacity
                  onPress={() => setVisibility('public')}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: visibility === 'public' ? colors.tealDark : colors.cardBorder,
                    backgroundColor: visibility === 'public' ? (isDark ? 'rgba(59,122,158,0.16)' : '#F0F9FF') : colors.subtleBg,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: visibility === 'public' ? colors.tealDark : (isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Globe size={18} color={visibility === 'public' ? '#FFFFFF' : colors.inkSoft} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '900', color: colors.ink }}>
                        Public (Explore Feed)
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: colors.inkSoft, marginTop: 2, lineHeight: 15 }}>
                        Visible to everyone in Explore even if not friends.
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: visibility === 'public' ? colors.tealDark : colors.cardBorder,
                      backgroundColor: visibility === 'public' ? colors.tealDark : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}
                  >
                    {visibility === 'public' && <Check size={12} color="#FFF" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>

                {/* Friends / Following Option */}
                <TouchableOpacity
                  onPress={() => setVisibility('friends')}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: visibility === 'friends' ? colors.tealDark : colors.cardBorder,
                    backgroundColor: visibility === 'friends' ? (isDark ? 'rgba(59,122,158,0.16)' : '#F0F9FF') : colors.subtleBg,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: visibility === 'friends' ? colors.tealDark : (isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Users size={18} color={visibility === 'friends' ? '#FFFFFF' : colors.inkSoft} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '900', color: colors.ink }}>
                        Friends Only (Following Feed)
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: colors.inkSoft, marginTop: 2, lineHeight: 15 }}>
                        Only your barkada & followers see this in Following.
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: visibility === 'friends' ? colors.tealDark : colors.cardBorder,
                      backgroundColor: visibility === 'friends' ? colors.tealDark : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}
                  >
                    {visibility === 'friends' && <Check size={12} color="#FFF" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>

                {/* Private Draft Option */}
                <TouchableOpacity
                  onPress={() => setVisibility('private')}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: visibility === 'private' ? colors.tealDark : colors.cardBorder,
                    backgroundColor: visibility === 'private' ? (isDark ? 'rgba(59,122,158,0.16)' : '#F0F9FF') : colors.subtleBg,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 12,
                        backgroundColor: visibility === 'private' ? colors.tealDark : (isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'),
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Lock size={18} color={visibility === 'private' ? '#FFFFFF' : colors.inkSoft} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '900', color: colors.ink }}>
                        Private Draft
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: colors.inkSoft, marginTop: 2, lineHeight: 15 }}>
                        Hidden from feeds. Only trip members see it in planner.
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: visibility === 'private' ? colors.tealDark : colors.cardBorder,
                      backgroundColor: visibility === 'private' ? colors.tealDark : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 8,
                    }}
                  >
                    {visibility === 'private' && <Check size={12} color="#FFF" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. Caption Input */}
            <View>
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                Trip Caption / Review
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                placeholder="Write a recap highlight or tip for other travelers..."
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8'}
                style={{
                  backgroundColor: colors.subtleBg,
                  borderRadius: 14,
                  padding: 12,
                  fontSize: 12.5,
                  fontWeight: '500',
                  color: colors.ink,
                  textAlignVertical: 'top',
                  minHeight: 70,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                }}
              />
            </View>

            {/* 3. Cover Photo Selection */}
            {availablePhotos && availablePhotos.length > 0 && (
              <View>
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
                  Pick Cover Photo
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {availablePhotos.map((url, idx) => {
                    const isPicked = selectedPhoto === url;
                    return (
                      <TouchableOpacity
                        key={`cover-${idx}`}
                        onPress={() => setSelectedPhoto(url)}
                        activeOpacity={0.8}
                        style={{
                          width: 68,
                          height: 68,
                          borderRadius: 12,
                          overflow: 'hidden',
                          borderWidth: isPicked ? 2.5 : 1,
                          borderColor: isPicked ? colors.tealDark : colors.cardBorder,
                          position: 'relative',
                        }}
                      >
                        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} />
                        {isPicked && (
                          <View
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              backgroundColor: colors.tealDark,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Check size={10} color="#FFF" strokeWidth={3} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={{ paddingTop: 14, borderTopWidth: 1, borderColor: colors.cardBorder, gap: 8 }}>
            <TouchableOpacity
              onPress={handlePublish}
              disabled={saving}
              activeOpacity={0.85}
              style={{
                backgroundColor: colors.tealDark,
                paddingVertical: 13,
                borderRadius: 100,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                  {visibility === 'private' ? 'Save Private Draft' : `Post Trip to ${visibility === 'public' ? 'Explore' : 'Following'}`}
                </Text>
              )}
            </TouchableOpacity>

            {currentVisibility !== 'private' && (
              <TouchableOpacity
                onPress={handleUnpublish}
                disabled={saving}
                activeOpacity={0.7}
                style={{
                  paddingVertical: 9,
                  borderRadius: 100,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#EF4444', fontSize: 12.5, fontWeight: '700' }}>
                  Unpublish / Remove from Feed
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};
