import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppTextField } from '../inputs/AppTextField';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { SlideUpModal } from '../common/SlideUpModal';
import { ReceiptPhotoCarousel } from './ReceiptPhotoCarousel';
import { ExpenseService } from '../../services/expenseService';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import {
  X,
  Utensils,
  Home,
  Compass,
  ShoppingBag,
  Car,
  Receipt,
  Camera,
  ImagePlus,
  Users,
  HandCoins,
  Crown,
} from 'lucide-react-native';

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  tripId?: string;
  members?: { id: string; name: string }[];
  myId?: string;
}

const CATEGORIES = [
  { name: 'Food', icon: Utensils, color: '#F0A93E' },
  { name: 'Stay', icon: Home, color: '#3A8E71' },
  { name: 'Activities', icon: Compass, color: '#3B7A9E' },
  { name: 'Groceries', icon: ShoppingBag, color: '#E2604A' },
  { name: 'Transport', icon: Car, color: '#B8791E' },
  { name: 'General', icon: Receipt, color: '#6E738A' },
];

const SPLIT_MODES = [
  { key: 'split' as const, label: 'Split with barkada', sub: 'Cost is shared by everyone', icon: Users },
  { key: 'pinaluwal' as const, label: 'Pinaluwal mo', sub: 'You advanced it for the barkada', icon: HandCoins },
  { key: 'solo' as const, label: 'Shouldered by you', sub: 'You covered it all yourself', icon: Crown },
];

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ visible, onClose, tripId, members = [], myId }) => {
  const { colors } = useTheme();
  const { sp, fs } = useResponsive();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [splitMode, setSplitMode] = useState<'split' | 'pinaluwal' | 'solo'>('split');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [avoidKeyboard, setAvoidKeyboard] = useState(false);
  const [saving, setSaving] = useState(false);

  const myName = members.find((m) => m.id === myId)?.name ?? 'Me';

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotos((prev) => [...prev, result.assets![0].uri]);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (!result.canceled && result.assets) {
      const uris = result.assets.map((a) => a.uri).filter(Boolean);
      setPhotos((prev) => [...prev, ...uris].slice(0, 5));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim() || !amount.trim()) return;
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (!tripId || !myId) return;

    setSaving(true);
    const result = await ExpenseService.getInstance().addExpenseDB({
      tripId,
      title: title.trim(),
      amount: parsedAmount,
      payerId: myId,
      paidBy: myName,
      createdBy: myId,
      category,
      splitMode,
      splitCount: Math.max(members.length, 1),
      photos,
      notes: notes.trim() ? notes.trim() : undefined,
    });
    setSaving(false);
    if (!result) return;

    // Reset & close
    setTitle('');
    setAmount('');
    setNotes('');
    setCategory('Food');
    setSplitMode('split');
    setPhotos([]);
    setAvoidKeyboard(false);
    onClose();
  };

  return (
    <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.4} useKeyboardAvoiding={avoidKeyboard}>
      <View
        style={{ backgroundColor: colors.paper, borderColor: colors.cardBorder }}
        className="rounded-t-3xl max-h-[90%] p-5 border-t"
      >
        {/* Header */}
        <View style={{ borderColor: colors.cardBorder }} className="flex-row justify-between items-center pb-4 mb-2 border-b">
          <Text style={{ color: colors.ink }} className="text-xl font-extrabold">Add New Expense</Text>
          <TouchableOpacity onPress={onClose} className="p-1">
            <X size={22} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Expense Title */}
          <AppTextField
            label="Expense Title"
            placeholder="e.g. Seafood Dinner at Artcafe"
            value={title}
            onChangeText={setTitle}
            onFocus={() => setAvoidKeyboard(false)}
          />

          {/* Amount */}
          <AppTextField
            label="Amount (₱)"
            placeholder="0.00"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            onFocus={() => setAvoidKeyboard(false)}
          />

          {/* Category */}
          <Text style={{ color: colors.ink }} className="text-xs font-bold mb-2 uppercase">Category</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm, marginBottom: sp.lg }}>
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.name;
              const IconComponent = cat.icon;
              return (
                <TouchableOpacity
                  key={cat.name}
                  onPress={() => setCategory(cat.name)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: sp.sm + 2,
                    paddingVertical: sp.xs + 1,
                    borderRadius: 100,
                    backgroundColor: isSelected ? colors.tealDark : colors.card,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                  }}
                >
                  <IconComponent size={13} color={isSelected ? '#FFFFFF' : cat.color} />
                  <Text
                    style={{
                      fontSize: fs.xs,
                      fontWeight: '800',
                      color: isSelected ? '#FFFFFF' : colors.ink,
                    }}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Split Mode */}
          <Text style={{ color: colors.ink }} className="text-xs font-bold mb-2 uppercase">How was it split?</Text>
          <View style={{ gap: sp.sm, marginBottom: sp.lg }}>
            {SPLIT_MODES.map((mode) => {
              const isSelected = splitMode === mode.key;
              const IconComponent = mode.icon;
              return (
                <TouchableOpacity
                  key={mode.key}
                  onPress={() => setSplitMode(mode.key)}
                  activeOpacity={0.85}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: sp.sm,
                    backgroundColor: isSelected ? colors.tealDark : colors.card,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                    borderRadius: 14,
                    paddingVertical: sp.sm,
                    paddingHorizontal: sp.sm,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.18)' : colors.paperDim,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconComponent size={17} color={isSelected ? '#FFFFFF' : colors.tealDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: fs.sm,
                        fontWeight: '800',
                        color: isSelected ? '#FFFFFF' : colors.ink,
                      }}
                    >
                      {mode.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '500',
                        color: isSelected ? 'rgba(255,255,255,0.75)' : colors.inkSoft,
                      }}
                    >
                      {mode.sub}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: isSelected ? '#FFFFFF' : colors.cardBorder,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' }} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Receipt Photos */}
          <Text style={{ color: colors.ink }} className="text-xs font-bold mb-2 uppercase">Receipt Photos</Text>
          <View style={{ flexDirection: 'row', gap: sp.sm, marginBottom: photos.length ? sp.sm : sp.lg }}>
            <TouchableOpacity
              onPress={takePhoto}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: sp.sm + 2,
                paddingVertical: sp.xs + 1,
                borderRadius: 100,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              <Camera size={13} color={colors.tealDark} />
              <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.ink }}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={pickFromLibrary}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: sp.sm + 2,
                paddingVertical: sp.xs + 1,
                borderRadius: 100,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.cardBorder,
              }}
            >
              <ImagePlus size={13} color={colors.tealDark} />
              <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.ink }}>Upload</Text>
            </TouchableOpacity>
          </View>

          {photos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
              contentContainerStyle={{ paddingTop: 8, paddingRight: 8, paddingBottom: 4 }}
            >
              <View style={{ flexDirection: 'row', gap: sp.sm }}>
                {photos.map((uri, i) => (
                  <View key={i}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        setCarouselIndex(i);
                        setCarouselVisible(true);
                      }}
                    >
                      <Image
                        source={{ uri }}
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.cardBorder,
                          backgroundColor: colors.card,
                        }}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removePhoto(i)}
                      activeOpacity={0.8}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      style={{
                        position: 'absolute',
                        top: -5,
                        right: -5,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: '#E2604A',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1.5,
                        borderColor: colors.paper,
                      }}
                    >
                      <X size={10} color="#FFFFFF" strokeWidth={3} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Notes */}
          <AppTextField
            label="Notes (Optional)"
            placeholder="Add details, receipt reference, etc."
            value={notes}
            onChangeText={setNotes}
            onFocus={() => setAvoidKeyboard(true)}
          />

          {/* Action */}
          <View className="mt-2 mb-6">
            <PrimaryButton
              label={saving ? 'Saving…' : 'Save Expense to Ledger'}
              onPress={handleSave}
              disabled={saving || !tripId || !myId}
            />
            {!tripId && (
              <Text style={{ color: colors.inkSoft }} className="text-xs text-center mt-2">
                Pick an active trip to save expenses.
              </Text>
            )}
          </View>
        </ScrollView>
      </View>

      <ReceiptPhotoCarousel
        photos={photos}
        initialIndex={carouselIndex}
        visible={carouselVisible}
        onClose={() => setCarouselVisible(false)}
        onDelete={(i) => {
          removePhoto(i);
          if (photos.length === 1) setCarouselVisible(false);
        }}
      />
    </SlideUpModal>
  );
};