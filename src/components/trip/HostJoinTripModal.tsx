import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Share,
  Animated,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { useResponsive } from '../../utils/responsive';
import { AppColors } from '../../utils/colors';
import { TripService } from '../../services/tripService';
import { ConnectionService, DBUserConnection } from '../../services/connectionService';
import {
  X,
  Plus,
  KeyRound,
  Copy,
  Check,
  Share2,
  ArrowRight,
  Vote,
  Search,
} from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface HostJoinTripModalProps {
  visible: boolean;
  onClose: () => void;
  onTripCreatedOrJoined?: () => void;
  initialMode?: 'choice' | 'host' | 'join';
}

export const HostJoinTripModal: React.FC<HostJoinTripModalProps> = ({
  visible,
  onClose,
  onTripCreatedOrJoined,
  initialMode = 'choice',
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const currentUserId = profile?.id;
  const { sp, fs } = useResponsive();

  const [mode, setMode] = useState<'choice' | 'host' | 'join'>(initialMode);
  
  // Host state
  const [tripTitle, setTripTitle] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  
  // Real DB Friends search state (No mock data)
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendsList, setFriendsList] = useState<DBUserConnection[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Join state
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [loading, setLoading] = useState(false);

  // Bottom Sheet Slide & Fade Animation
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Mode Fade Animation
  const modeFadeAnim = useRef(new Animated.Value(1)).current;

  const changeModeWithAnimation = (newMode: 'choice' | 'host' | 'join') => {
    Animated.timing(modeFadeAnim, {
      toValue: 0.2,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setMode(newMode);
      Animated.timing(modeFadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  useEffect(() => {
    if (visible) {
      setMode(initialMode);
      setTripTitle('');
      setJoinCodeInput('');
      setJoinError('');
      setSelectedFriends([]);
      setFriendSearchQuery('');
      setCopied(false);
      modeFadeAnim.setValue(1);
      
      const code = TripService.getInstance().generateShortCode();
      setGeneratedCode(code);

      sheetAnim.setValue(SCREEN_HEIGHT);
      backdropAnim.setValue(0);

      // Load actual friends/connections from database
      loadFriends('');

      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropAnim, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.spring(sheetAnim, {
            toValue: 0,
            stiffness: 350,
            damping: 32,
            mass: 0.8,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [visible, initialMode]);

  const handleCloseModal = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(sheetAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      if (callback) callback();
    });
  };

  const loadFriends = async (query: string) => {
    setLoadingFriends(true);
    try {
      // Direct Database Query via ConnectionService (search profile by name/username)
      const dbResults = await ConnectionService.searchUsers(query, currentUserId);
      setFriendsList(dbResults || []);
    } catch (e) {
      console.warn('Error querying database users:', e);
      setFriendsList([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleFriendSearchChange = (text: string) => {
    setFriendSearchQuery(text);
    loadFriends(text);
  };

  const handleCopyCode = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = async () => {
    try {
      await Share.share({
        message: `Join our Barkada trip on Barkadash! Use trip code: ${generatedCode} or link: https://barkadash.app/join/${generatedCode}`,
      });
    } catch (e) {
      console.warn('Share error:', e);
    }
  };

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((fId) => fId !== id) : [...prev, id]
    );
  };

  const handleHostSubmit = async () => {
    setLoading(true);
    try {
      const res = await TripService.getInstance().createTripDB({
        title: tripTitle.trim() || 'Barkada Getaway',
        hostId: currentUserId || '',
        invitedFriendIds: selectedFriends,
      });
      setLoading(false);
      if (res.success) {
        handleCloseModal(() => {
          onTripCreatedOrJoined?.();
        });
      } else {
        setJoinError(res.message || 'Failed to host trip. Please try again.');
      }
    } catch (e) {
      console.warn('handleHostSubmit exception:', e);
      setLoading(false);
    }
  };

  const handleJoinSubmit = async () => {
    if (!joinCodeInput.trim()) {
      setJoinError('Please enter a trip code');
      return;
    }
    setLoading(true);
    setJoinError('');

    try {
      const res = await TripService.getInstance().joinTripByCodeDB(joinCodeInput, currentUserId);
      setLoading(false);
      if (res.success) {
        handleCloseModal(() => {
          onTripCreatedOrJoined?.();
        });
      } else {
        setJoinError(res.message || 'Invalid 6-character trip code.');
      }
    } catch (e) {
      console.warn('handleJoinSubmit exception:', e);
      setLoading(false);
      setJoinError('Failed to join trip. Please try again.');
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={() => handleCloseModal()}
    >
      {/* Stationary Backdrop Overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: 'rgba(0, 0, 0, 0.6)', opacity: backdropAnim },
        ]}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => handleCloseModal()}
        />
      </Animated.View>

      {/* Keyboard Avoiding Container for Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        pointerEvents="box-none"
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >

        {/* Animated Bottom Sheet Card */}
        <Animated.View
          style={[
            styles.sheetCard,
            {
              backgroundColor: colors.paper,
              transform: [{ translateY: sheetAnim }],
            },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handleBarWrapper}>
            <View style={[styles.handleBar, { backgroundColor: isDark ? '#4B5563' : '#D1D5DB' }]} />
          </View>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              {mode !== 'choice' && (
                <TouchableOpacity
                  onPress={() => changeModeWithAnimation('choice')}
                  style={{ marginBottom: 4 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.tealDark }}>
                    ← Back to Options
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={[styles.headerTitle, { color: colors.ink }]}>
                {mode === 'choice' && 'Barkada Trip Planning'}
                {mode === 'host' && 'Host a New Trip'}
                {mode === 'join' && 'Join Barkada Trip'}
              </Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft }}>
                {mode === 'choice' && 'Start hosting a trip or join your friends using a short code.'}
                {mode === 'host' && 'Set up trip title and generate your barkada invite code.'}
                {mode === 'join' && 'Enter 6-character trip code to join your barkada.'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => handleCloseModal()}
              style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
            >
              <X size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>

          {/* Animated Content Body */}
          <Animated.View style={{ opacity: modeFadeAnim }}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
              style={{ maxHeight: SCREEN_HEIGHT * 0.70 }}
            >
              {/* ================= CHOICE MODE ================= */}
              {mode === 'choice' && (
                <View style={{ gap: sp.md, paddingTop: sp.xs }}>
                  {/* Host Trip Option */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => changeModeWithAnimation('host')}
                    style={[
                      styles.choiceCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: colors.lightOrangeBg },
                      ]}
                    >
                      <Plus size={22} color={colors.orangeAccent} strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text style={[styles.cardTitle, { color: colors.ink }]}>Host a New Trip</Text>
                        <View style={{ backgroundColor: AppColors.lightGreenBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100 }}>
                          <Text style={{ fontSize: 9, fontWeight: '900', color: AppColors.emerald }}>START HERE</Text>
                        </View>
                      </View>
                      <Text style={[styles.cardSub, { color: colors.inkSoft }]}>
                        Set trip title, generate short invite code, and invite your barkada to vote on destinations.
                      </Text>
                    </View>
                    <ArrowRight size={18} color={colors.inkSoft} />
                  </TouchableOpacity>

                  {/* Join Trip Option */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => changeModeWithAnimation('join')}
                    style={[
                      styles.choiceCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: AppColors.lightBlueBg },
                      ]}
                    >
                      <KeyRound size={22} color={AppColors.sky} strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.ink }]}>Join with Trip Code</Text>
                      <Text style={[styles.cardSub, { color: colors.inkSoft }]}>
                        Got an invite code from a friend? Enter it here to join their trip plan.
                      </Text>
                    </View>
                    <ArrowRight size={18} color={colors.inkSoft} />
                  </TouchableOpacity>

                  {/* Feature Callout Banner */}
                  <View
                    style={{
                      backgroundColor: isDark ? 'rgba(59, 122, 158, 0.15)' : '#EBF5FB',
                      borderColor: isDark ? '#3B7A9E' : '#BCE0F5',
                      borderWidth: 1,
                      borderRadius: 16,
                      padding: sp.md,
                      marginTop: sp.xs,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <Vote size={22} color={colors.tealDark} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.ink }}>
                        Destination Voting Coming Up
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginTop: 2 }}>
                        No need to decide the location today. You and your friends will suggest and vote on spots together.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* ================= HOST MODE ================= */}
              {mode === 'host' && (
                <View style={{ paddingTop: sp.xs, gap: sp.md }}>
                  {/* Trip Title Input */}
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.ink }]}>Trip Title</Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.cardBorder,
                          color: colors.ink,
                        },
                      ]}
                      placeholder="Enter trip title"
                      placeholderTextColor={colors.inkSoft}
                      value={tripTitle}
                      onChangeText={setTripTitle}
                    />
                  </View>

                  {/* Auto Generated Short Invite Code Box */}
                  <View
                    style={[
                      styles.codeBox,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: colors.inkSoft, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Trip Code
                      </Text>
                      <Text style={{ fontSize: fs.xxl, fontWeight: '900', color: colors.tealDark, letterSpacing: 2, marginVertical: 2 }}>
                        {generatedCode}
                      </Text>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.inkSoft }}>
                        Share this 6-character code with your friends
                      </Text>
                    </View>

                    <View style={{ gap: 6 }}>
                      <TouchableOpacity
                        onPress={handleCopyCode}
                        style={{
                          backgroundColor: copied ? AppColors.emerald : colors.tealDark,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {copied ? <Check size={14} color="#FFF" /> : <Copy size={14} color="#FFF" />}
                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>
                          {copied ? 'Copied' : 'Copy'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleShareLink}
                        style={{
                          backgroundColor: colors.lightOrangeBg,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Share2 size={14} color={colors.orangeAccent} />
                        <Text style={{ color: colors.orangeAccent, fontSize: 11, fontWeight: '800' }}>
                          Share
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Direct Friend Selection with DB query (No Mock Data) */}
                  <View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={[styles.inputLabel, { color: colors.ink, marginBottom: 0 }]}>
                        Invite Barkada ({selectedFriends.length} selected)
                      </Text>
                    </View>

                    {/* Friend Search Input */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.card,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        marginBottom: 8,
                      }}
                    >
                      <Search size={16} color={colors.inkSoft} style={{ marginRight: 8 }} />
                      <TextInput
                        style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.ink, paddingVertical: 4 }}
                        placeholder="Search friends by name or handle..."
                        placeholderTextColor={colors.inkSoft}
                        value={friendSearchQuery}
                        onChangeText={handleFriendSearchChange}
                      />
                      {loadingFriends && <ActivityIndicator size="small" color={colors.tealDark} />}
                    </View>

                    {/* Friends List from DB */}
                    <View style={{ gap: 6 }}>
                      {loadingFriends ? (
                        <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                          <ActivityIndicator color={colors.tealDark} />
                          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginTop: 4 }}>
                            Searching profiles...
                          </Text>
                        </View>
                      ) : friendsList.length === 0 ? (
                        <View style={{ paddingVertical: 14, alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft }}>
                            {friendSearchQuery.trim()
                              ? `No user found matching "${friendSearchQuery}"`
                              : 'No barkada connections found. Search by name or handle above.'}
                          </Text>
                        </View>
                      ) : (
                        friendsList.map((friend) => {
                          const isSelected = selectedFriends.includes(friend.id);
                          return (
                            <TouchableOpacity
                              key={friend.id}
                              activeOpacity={0.8}
                              onPress={() => toggleFriend(friend.id)}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: colors.card,
                                padding: 8,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 16,
                                    backgroundColor: friend.avatarBg || '#0171F8',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>
                                    {friend.initials || friend.name.substring(0, 2).toUpperCase()}
                                  </Text>
                                </View>
                                <View>
                                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.ink }}>
                                    {friend.name}
                                  </Text>
                                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.inkSoft }}>
                                    {friend.handle}
                                  </Text>
                                </View>
                              </View>

                              <View
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 10,
                                  borderWidth: 2,
                                  borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                                  backgroundColor: isSelected ? colors.tealDark : 'transparent',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {isSelected && <Check size={11} color="#FFF" strokeWidth={3} />}
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  </View>

                  {/* Submit Host Button */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleHostSubmit}
                    disabled={loading}
                    style={[styles.submitBtn, { backgroundColor: colors.tealDark }]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.submitBtnText}>Host and Start Planning</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* ================= JOIN MODE ================= */}
              {mode === 'join' && (
                <View style={{ paddingTop: sp.xs, gap: sp.md }}>
                  <View>
                    <Text style={[styles.inputLabel, { color: colors.ink }]}>Enter Trip Code</Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: colors.card,
                          borderColor: joinError ? AppColors.redAccent : colors.cardBorder,
                          color: colors.ink,
                          fontSize: joinCodeInput ? 22 : 14,
                          fontWeight: '900',
                          letterSpacing: joinCodeInput ? 4 : 0,
                          textAlign: 'center',
                          textTransform: 'uppercase',
                        },
                      ]}
                      placeholder="Enter trip code"
                      placeholderTextColor={colors.inkSoft}
                      maxLength={8}
                      value={joinCodeInput}
                      onChangeText={(val) => {
                        setJoinCodeInput(val.toUpperCase());
                        setJoinError('');
                      }}
                    />
                    {joinError ? (
                      <Text style={{ fontSize: 11, fontWeight: '700', color: AppColors.redAccent, marginTop: 6, textAlign: 'center' }}>
                        {joinError}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginTop: 6, textAlign: 'center' }}>
                        Enter 6-character barkada code to join
                      </Text>
                    )}
                  </View>

                  {/* Submit Join Button */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleJoinSubmit}
                    disabled={loading}
                    style={[styles.submitBtn, { backgroundColor: colors.tealDark }]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={styles.submitBtnText}>Join Barkada Trip</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheetCard: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 999,
  },
  handleBarWrapper: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  cardSub: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '600',
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  submitBtn: {
    paddingVertical: 13,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
