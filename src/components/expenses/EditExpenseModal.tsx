import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Expense } from '../../types/expense';
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
  Sliders,
  ChevronDown,
  ChevronUp,
  Heart,
  Minus,
  Plus,
} from 'lucide-react-native';

interface EditExpenseModalProps {
  expense: Expense | null;
  visible: boolean;
  onClose: () => void;
  members?: { id: string; name: string }[];
  myId?: string;
}

interface PhotoEntry {
  uri: string;
  path?: string;
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
  { key: 'split' as const, label: 'Split Equally', sub: 'Cost is divided equally among everyone', icon: Users },
  { key: 'pinaluwal' as const, label: 'Advanced by You', sub: 'You paid upfront on behalf of the group', icon: HandCoins },
  { key: 'solo' as const, label: 'Covered by You', sub: 'You shouldered the entire expense yourself', icon: Crown },
];

const buildEqualShares = (
  members: { id: string; name: string }[],
  totalAmount: number
): Record<string, string> => {
  if (members.length === 0) return {};
  const share = totalAmount / members.length;
  const result: Record<string, string> = {};
  members.forEach((m) => {
    result[m.id] = share > 0 ? String(Number(share.toFixed(2))) : '0';
  });
  return result;
};

export const EditExpenseModal: React.FC<EditExpenseModalProps> = ({ expense, visible, onClose, members = [], myId }) => {
  const { colors, isDark } = useTheme();
  const { sp, fs, icon } = useResponsive();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [splitMode, setSplitMode] = useState<'split' | 'pinaluwal' | 'solo'>('split');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [avoidKeyboard, setAvoidKeyboard] = useState(false);
  const [saving, setSaving] = useState(false);

  // Custom split state
  const [customSplitExpanded, setCustomSplitExpanded] = useState(false);
  const [shareInputs, setShareInputs] = useState<Record<string, string>>({});
  const [hasCustomSplit, setHasCustomSplit] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;

  const resetToEqualShares = useCallback(() => {
    if (members.length === 0) return;
    setShareInputs(buildEqualShares(members, parsedAmount));
    setHasCustomSplit(false);
  }, [members, parsedAmount]);

  useEffect(() => {
    if (!expense) return;
    setTitle(expense.title);
    setAmount(expense.amount.toString());
    setCategory(CATEGORIES.some((c) => c.name.toLowerCase() === expense.category.toLowerCase())
      ? expense.category
      : 'General');
    setSplitMode(expense.splitMode || 'split');
    setNotes(expense.notes || '');

    const existing: PhotoEntry[] = (expense.receiptPhotos || []).map((uri, i) => ({
      uri,
      path: expense.receiptPaths?.[i],
    }));
    setPhotos(existing);

    // Restore existing custom shares if any
    if (expense.customShares && Object.keys(expense.customShares).length > 0) {
      const restored: Record<string, string> = {};
      for (const [id, val] of Object.entries(expense.customShares)) {
        restored[id] = String(val);
      }
      setShareInputs(restored);
      setHasCustomSplit(true);
      setCustomSplitExpanded(true);
    } else {
      setShareInputs(buildEqualShares(members, expense.amount));
      setHasCustomSplit(false);
      setCustomSplitExpanded(false);
    }
  }, [expense]);

  // When splitMode switches to 'pinaluwal', initialise shares if not already set
  useEffect(() => {
    if (splitMode === 'pinaluwal' && members.length > 0 && !hasCustomSplit) {
      setShareInputs(buildEqualShares(members, parsedAmount));
    }
  }, [splitMode, members.length]);

  // Update equal shares when amount changes (only if not customised)
  useEffect(() => {
    if (splitMode === 'pinaluwal' && !hasCustomSplit && members.length > 0 && parsedAmount > 0) {
      setShareInputs(buildEqualShares(members, parsedAmount));
    }
  }, [parsedAmount, splitMode, hasCustomSplit]);

  const sharesTotal = useMemo(() => {
    return Object.values(shareInputs).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  }, [shareInputs]);

  const remaining = useMemo(() => {
    const r = parsedAmount - sharesTotal;
    return Math.round(r * 100) / 100;
  }, [parsedAmount, sharesTotal]);

  const sharesValid = useMemo(() => {
    if (!parsedAmount || members.length === 0) return true;
    return Math.abs(remaining) < 0.02;
  }, [remaining, parsedAmount, members.length]);

  const handleShareChange = (memberId: string, value: string) => {
    setHasCustomSplit(true);
    setShareInputs((prev) => ({ ...prev, [memberId]: value }));
  };

  const handleMyShareChange = (value: string) => {
    const myShare = parseFloat(value) || 0;
    setHasCustomSplit(true);
    const others = members.filter((m) => m.id !== myId);
    const remainder = Math.max(0, parsedAmount - myShare);
    const otherShare = others.length > 0 ? Math.round((remainder / others.length) * 100) / 100 : 0;
    const newInputs: Record<string, string> = {};
    members.forEach((m) => {
      if (m.id === myId) {
        newInputs[m.id] = value;
      } else {
        newInputs[m.id] = otherShare > 0 ? String(otherShare) : '0';
      }
    });
    setShareInputs(newInputs);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotos((prev) => [...prev, { uri: result.assets![0].uri }]);
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
      setPhotos((prev) => [...prev, ...uris.map((uri) => ({ uri }))].slice(0, 5));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!expense) return;
    if (!title.trim() || !amount.trim()) return;
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;
    if (splitMode === 'pinaluwal' && hasCustomSplit && !sharesValid) return;

    const originalPaths = expense.receiptPaths || [];
    const keptPaths = photos.filter((p) => p.path).map((p) => p.path as string);
    const removedPaths = originalPaths.filter((p) => !keptPaths.includes(p));
    const newUris = photos.filter((p) => !p.path).map((p) => p.uri);

    const customShares: Record<string, number> | undefined =
      splitMode === 'pinaluwal' && hasCustomSplit && members.length > 0
        ? Object.fromEntries(
            Object.entries(shareInputs).map(([id, v]) => [id, parseFloat(v) || 0])
          )
        : undefined;

    setSaving(true);
    const ok = await ExpenseService.getInstance().editExpenseDB(expense.id, {
      title: title.trim(),
      amount: parsedAmount,
      category,
      splitMode,
      splitCount: Math.max(members.length, 1),
      notes: notes.trim() ? notes.trim() : undefined,
      addPhotoUris: newUris,
      removePhotoPaths: removedPaths,
      customShares,
    });
    setSaving(false);
    if (!ok) return;
    onClose();
  };

  const tealDark = colors.tealDark;

  return (
    <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.4} useKeyboardAvoiding={avoidKeyboard}>
      <View
        style={{ backgroundColor: colors.paper, borderColor: colors.cardBorder }}
        className="rounded-t-3xl max-h-[90%] p-5 border-t"
      >
        <View style={{ borderColor: colors.cardBorder }} className="flex-row justify-between items-center pb-4 mb-2 border-b">
          <Text style={{ color: colors.ink }} className="text-xl font-extrabold">Edit Expense</Text>
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
                    backgroundColor: isSelected ? tealDark : colors.card,
                    borderWidth: 1,
                    borderColor: isSelected ? tealDark : colors.cardBorder,
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
                    backgroundColor: isSelected ? tealDark : colors.card,
                    borderWidth: 1,
                    borderColor: isSelected ? tealDark : colors.cardBorder,
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
                    <IconComponent size={17} color={isSelected ? '#FFFFFF' : tealDark} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: fs.sm, fontWeight: '800', color: isSelected ? '#FFFFFF' : colors.ink }}>
                      {mode.label}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: '500', color: isSelected ? 'rgba(255,255,255,0.75)' : colors.inkSoft }}>
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

          {/* ─── Custom Split Panel (Pinaluwal mo) ─── */}
          {splitMode === 'pinaluwal' && members.length > 1 && parsedAmount > 0 && (
            <View
              style={{
                marginBottom: sp.lg,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: hasCustomSplit ? tealDark : colors.cardBorder,
                overflow: 'hidden',
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
              }}
            >
              {/* Panel Header */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setCustomSplitExpanded((v) => !v)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  gap: 8,
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    backgroundColor: hasCustomSplit ? tealDark : (isDark ? 'rgba(255,255,255,0.08)' : '#E9F1F7'),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sliders size={14} color={hasCustomSplit ? '#FFF' : tealDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
                    Customize Split
                  </Text>
                  <Text style={{ fontSize: 10.5, fontWeight: '500', color: colors.inkSoft, marginTop: 1 }}>
                    {hasCustomSplit
                      ? `Your share: ₱${parseFloat(shareInputs[myId ?? ''] || '0').toFixed(2)} — tap to adjust`
                      : `Equal share: ₱${parsedAmount > 0 ? (parsedAmount / members.length).toFixed(2) : '0.00'} each`}
                  </Text>
                </View>
                {customSplitExpanded ? (
                  <ChevronUp size={18} color={colors.inkSoft} />
                ) : (
                  <ChevronDown size={18} color={colors.inkSoft} />
                )}
              </TouchableOpacity>

              {customSplitExpanded && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>

                  {/* ── Claim My Share Card ── */}
                  {myId && members.some((m) => m.id === myId) && (
                    <View
                      style={{
                        backgroundColor: isDark ? 'rgba(59,122,158,0.18)' : '#EBF5FB',
                        borderRadius: sp.md + 2,
                        borderWidth: 1.5,
                        borderColor: tealDark,
                        padding: sp.md,
                        marginBottom: sp.md,
                      }}
                    >
                      {/* Header row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs + 2, marginBottom: sp.sm + 2 }}>
                        <Heart size={icon.xs + 1} color={tealDark} />
                        <Text style={{ fontSize: fs.sm, fontWeight: '800', color: tealDark }}>
                          Claim a Larger Share
                        </Text>
                      </View>

                      {/* Stepper row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm + 2 }}>
                        {/* Minus */}
                        <TouchableOpacity
                          onPress={() => {
                            const cur = parseFloat(shareInputs[myId] || '0');
                            const step = Math.max(1, Math.round(parsedAmount / members.length / 10));
                            const minShare = Math.round((parsedAmount / members.length) * 100) / 100;
                            const next = Math.max(minShare, Math.round((cur - step) * 100) / 100);
                            handleMyShareChange(String(next));
                          }}
                          activeOpacity={0.7}
                          style={{
                            width: sp.xl + sp.lg,
                            height: sp.xl + sp.lg,
                            borderRadius: sp.sm + 2,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Minus size={icon.sm} color={colors.ink} />
                        </TouchableOpacity>

                        {/* Amount display / input */}
                        <View
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1.5,
                            borderColor: tealDark,
                            borderRadius: sp.sm + 2,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                            paddingHorizontal: sp.sm,
                            paddingVertical: sp.sm,
                          }}
                        >
                          <Text style={{ fontSize: fs.sm, fontWeight: '700', color: colors.inkSoft, marginRight: sp.xs - 1 }}>₱</Text>
                          <TextInput
                            value={shareInputs[myId] ?? ''}
                            onChangeText={(v) => handleMyShareChange(v)}
                            keyboardType="numeric"
                            style={{
                              fontSize: fs.lg,
                              fontWeight: '900',
                              color: tealDark,
                              padding: 0,
                              textAlign: 'center',
                              minWidth: sp.xxl + sp.xl,
                            }}
                            placeholder="0.00"
                            placeholderTextColor={colors.inkSoft}
                            onFocus={() => setAvoidKeyboard(true)}
                          />
                        </View>

                        {/* Plus */}
                        <TouchableOpacity
                          onPress={() => {
                            const cur = parseFloat(shareInputs[myId] || '0');
                            const step = Math.max(1, Math.round(parsedAmount / members.length / 10));
                            const next = Math.min(parsedAmount, Math.round((cur + step) * 100) / 100);
                            handleMyShareChange(String(next));
                          }}
                          activeOpacity={0.7}
                          style={{
                            width: sp.xl + sp.lg,
                            height: sp.xl + sp.lg,
                            borderRadius: sp.sm + 2,
                            backgroundColor: tealDark,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Plus size={icon.sm} color="#FFF" />
                        </TouchableOpacity>
                      </View>

                      {/* Quick preset pills */}
                      <View style={{ flexDirection: 'row', gap: sp.xs + 2, marginTop: sp.sm + 2, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Equal', factor: 1 },
                          { label: '+25%', factor: 1.25 },
                          { label: '+50%', factor: 1.5 },
                          { label: 'Take All', factor: members.length },
                        ].map(({ label, factor }) => {
                          const equalShare = parsedAmount / members.length;
                          const targetShare = Math.min(parsedAmount, Math.round(equalShare * factor * 100) / 100);
                          const myCurrentShare = parseFloat(shareInputs[myId] || '0');
                          const isTakeAll = factor >= members.length;
                          const isActive = !isTakeAll && Math.abs(myCurrentShare - targetShare) < 0.02;
                          return (
                            <TouchableOpacity
                              key={label}
                              onPress={() => {
                                if (isTakeAll) {
                                  setSplitMode('solo');
                                  setHasCustomSplit(false);
                                  setCustomSplitExpanded(false);
                                } else {
                                  if (splitMode !== 'pinaluwal') setSplitMode('pinaluwal');
                                  handleMyShareChange(String(targetShare));
                                }
                              }}
                              activeOpacity={0.75}
                              style={{
                                paddingHorizontal: sp.md,
                                paddingVertical: sp.xs + 1,
                                borderRadius: 100,
                                backgroundColor: isActive ? tealDark : (isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF'),
                                borderWidth: 1,
                                borderColor: isActive ? tealDark : colors.cardBorder,
                              }}
                            >
                              <Text style={{ fontSize: fs.xs, fontWeight: '800', color: isActive ? '#FFF' : colors.inkSoft }}>
                                {label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Helper text */}
                      <Text style={{ fontSize: fs.xs - 1, fontWeight: '600', color: colors.inkSoft, marginTop: sp.sm }}>
                        The remaining amount ({members.length - 1 === 1 ? '1 person' : `${members.length - 1} people`}) will split ₱{Math.max(0, parsedAmount - (parseFloat(shareInputs[myId] || '0'))).toFixed(2)}
                      </Text>
                    </View>
                  )}

                  {/* ── Share Balance Bar ── */}
                  <View style={{ marginBottom: sp.md }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: sp.xs + 2,
                        paddingHorizontal: 2,
                      }}
                    >
                      <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.inkSoft }}>
                        Total: ₱{parsedAmount.toFixed(2)}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: sp.xs + 1,
                          paddingHorizontal: sp.sm + 2,
                          paddingVertical: sp.xs,
                          borderRadius: 100,
                          backgroundColor:
                            Math.abs(remaining) < 0.02
                              ? (isDark ? 'rgba(16,185,129,0.2)' : '#D1FAE5')
                              : (isDark ? 'rgba(239,68,68,0.2)' : '#FEE2E2'),
                        }}
                      >
                        <Text
                          style={{
                            fontSize: fs.xs,
                            fontWeight: '800',
                            color: Math.abs(remaining) < 0.02 ? '#059669' : '#DC2626',
                          }}
                        >
                          {Math.abs(remaining) < 0.02
                            ? '✓ Balanced'
                            : remaining > 0
                            ? `₱${remaining.toFixed(2)} unallocated`
                            : `₱${Math.abs(remaining).toFixed(2)} over`}
                        </Text>
                      </View>
                    </View>

                    {/* Proportional bar */}
                    {parsedAmount > 0 && sharesTotal > 0 && (
                      <View style={{ flexDirection: 'row', height: sp.xs + 2, borderRadius: 100, overflow: 'hidden', gap: 1 }}>
                        {members.map((member, idx) => {
                          const shareAmt = parseFloat(shareInputs[member.id] || '0');
                          const pct = sharesTotal > 0 ? (shareAmt / parsedAmount) * 100 : 100 / members.length;
                          const isMe = member.id === myId;
                          const barColors = [
                            tealDark, '#F0A93E', '#E2604A', '#3A8E71', '#B8791E', '#6E738A',
                          ];
                          return (
                            <View
                              key={member.id}
                              style={{
                                flex: pct,
                                backgroundColor: isMe ? tealDark : barColors[idx % barColors.length],
                                opacity: isMe ? 1 : 0.55,
                              }}
                            />
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* ── Per-member Fine-tune Rows ── */}
                  <Text style={{ fontSize: fs.xs - 1, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: sp.sm }}>
                    Fine-tune per person
                  </Text>
                  <View style={{ gap: 8 }}>
                    {members.map((member) => {
                      const isMe = member.id === myId;
                      const shareVal = shareInputs[member.id] ?? '';
                      return (
                        <View
                          key={member.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: sp.sm + 2,
                            backgroundColor: isMe
                              ? (isDark ? 'rgba(59,122,158,0.12)' : '#EBF5FB')
                              : (isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF'),
                            borderRadius: sp.md + 2,
                            borderWidth: 1,
                            borderColor: isMe ? tealDark : colors.cardBorder,
                            paddingHorizontal: sp.md,
                            paddingVertical: sp.sm + 2,
                          }}
                        >
                          <View
                            style={{
                              width: sp.xl + sp.sm,
                              height: sp.xl + sp.sm,
                              borderRadius: sp.xl,
                              backgroundColor: isMe ? tealDark : (isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'),
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ fontSize: fs.sm, fontWeight: '900', color: isMe ? '#FFF' : colors.ink }}>
                              {member.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: fs.sm + 1, fontWeight: '800', color: colors.ink }} numberOfLines={1}>
                              {member.name}
                            </Text>
                            {isMe && (
                              <Text style={{ fontSize: fs.xs - 1, fontWeight: '600', color: tealDark }}>You · {parsedAmount > 0 ? Math.round((parseFloat(shareVal || '0') / parsedAmount) * 100) : 0}%</Text>
                            )}
                          </View>

                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              borderWidth: 1.5,
                              borderColor: isMe ? tealDark : colors.cardBorder,
                              borderRadius: sp.sm + 2,
                              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                              paddingHorizontal: sp.sm,
                              paddingVertical: sp.xs + 1,
                              minWidth: sp.xxl * 3 + sp.sm,
                            }}
                          >
                            <Text style={{ fontSize: fs.sm, fontWeight: '700', color: colors.inkSoft, marginRight: sp.xs - 1 }}>₱</Text>
                            <TextInput
                              value={shareVal}
                              onChangeText={(v) => {
                                if (isMe) {
                                  handleMyShareChange(v);
                                } else {
                                  handleShareChange(member.id, v);
                                }
                              }}
                              keyboardType="numeric"
                              style={{
                                flex: 1,
                                fontSize: fs.sm + 1,
                                fontWeight: '800',
                                color: colors.ink,
                                padding: 0,
                              }}
                              placeholder="0.00"
                              placeholderTextColor={colors.inkSoft}
                              onFocus={() => setAvoidKeyboard(true)}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Reset to equal */}
                  {hasCustomSplit && (
                    <TouchableOpacity
                      onPress={resetToEqualShares}
                      activeOpacity={0.7}
                      style={{
                        marginTop: 12,
                        alignSelf: 'flex-end',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 100,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.inkSoft }}>
                        Reset to equal split
                      </Text>
                    </TouchableOpacity>
                  )}

                  {hasCustomSplit && !sharesValid && (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626', marginTop: 8, textAlign: 'center' }}>
                      Shares must add up to ₱{parsedAmount.toFixed(2)} before saving.
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

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
              <Camera size={13} color={tealDark} />
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
              <ImagePlus size={13} color={tealDark} />
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
                {photos.map((photo, i) => (
                  <View key={i}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        setCarouselIndex(i);
                        setCarouselVisible(true);
                      }}
                    >
                      <Image
                        source={{ uri: photo.uri }}
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
              label={saving ? 'Saving…' : 'Save Changes'}
              onPress={handleSave}
              disabled={saving || (splitMode === 'pinaluwal' && hasCustomSplit && !sharesValid)}
            />
          </View>
        </ScrollView>
      </View>

      <ReceiptPhotoCarousel
        photos={photos.map((p) => p.uri)}
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