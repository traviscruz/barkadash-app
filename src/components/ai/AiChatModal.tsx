import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Keyboard,
  Platform,
  Animated,
  Easing,
  StyleSheet,
  Image,
  ViewStyle,
} from 'react-native';

import { Plus, History, X, Trash2, Send, MessageSquare, Mic, ArrowUp, MapPin, CalendarDays } from 'lucide-react-native';
import { AiChatService, AiChatSession } from '../../services/aiChatService';
import { TripService } from '../../services/tripService';
import { Trip } from '../../types/trip';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { useUser } from '../../context/UserContext';
import { RichNaviMessage } from './RichNaviMessage';
import { ItineraryAddModal } from '../trip/ItineraryAddModal';
import { PlaceToolData } from '../../services/aiAssistantCommon';
import { tripDayCount } from '../../utils/tripDates';

const PLACEHOLDER_DESTINATIONS = ['Voting in Progress', 'Voting Phase', 'Destination Voting', 'Planning Stage'];
const PLACEHOLDER_DATES = ['Dates TBD', 'Upcoming', 'Upcoming Dates'];

const cleanDateRange = (range: string): string =>
  range.replace(/\s*·\s*\d+\s*barkadas?/i, '').trim();

const aiMascotImg = require('../../../assets/mascot/ai_mascot.webp');

interface AiChatModalProps {
  visible: boolean;
  onClose: () => void;
}



export const AiChatModal: React.FC<AiChatModalProps> = ({ visible, onClose }) => {
  const { colors, isDark } = useTheme();
  const { fs, insets } = useResponsive();
  const { profile } = useUser();
  const service = AiChatService.getInstance();

  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [session, setSession] = useState<AiChatSession | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [lineCount, setLineCount] = useState(1);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [acceptingPlace, setAcceptingPlace] = useState<PlaceToolData | null>(null);
  const acceptResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const handleAcceptPlace = (place: PlaceToolData): Promise<boolean> => {
    setAcceptingPlace(place);
    return new Promise<boolean>((resolve) => {
      acceptResolveRef.current = resolve;
    });
  };

  const closeAccept = (ok: boolean) => {
    acceptResolveRef.current?.(ok);
    acceptResolveRef.current = null;
    setAcceptingPlace(null);
  };

  const historyAnim = useRef(new Animated.Value(-300)).current;
  const typingAnim = useRef(new Animated.Value(0)).current;
  const keyboardShift = useRef(new Animated.Value(0)).current;

  const refresh = () => {
    setSessions(service.getSessions());
    setSession(service.getCurrentSession());
  };

  useEffect(() => {
    if (visible) {
      service.load().then(refresh);
      setShowHistory(false);
      setSending(false);
      const tripService = TripService.getInstance();
      setActiveTrip(tripService.getActiveTrip());
      const unsub = service.subscribe(refresh);
      const unsubTrip = tripService.subscribe(() => {
        setActiveTrip(tripService.getActiveTrip());
      });
      return () => {
        unsub();
        unsubTrip();
      };
    }
  }, [visible]);

  // Native-driver keyboard shift (iOS). Android resizes the window itself via
  // softwareKeyboardLayoutMode, so we only track state there.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt, (e: any) => {
      setKeyboardOpen(true);
      if (Platform.OS === 'ios') {
        Animated.timing(keyboardShift, {
          toValue: -e.endCoordinates.height,
          duration: e.duration ?? 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });
    const hideSub = Keyboard.addListener(hideEvt, (e: any) => {
      setKeyboardOpen(false);
      if (Platform.OS === 'ios') {
        Animated.timing(keyboardShift, {
          toValue: 0,
          duration: e.duration ?? 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardShift]);

  const toggleHistory = (open: boolean) => {
    if (open) {
      Keyboard.dismiss();
    }
    setShowHistory(open);
  };

  useEffect(() => {
    Animated.timing(historyAnim, {
      toValue: showHistory ? 0 : -300,
      duration: 240,
      easing: showHistory ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showHistory, historyAnim]);

  useEffect(() => {
    if (session) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [session?.messages.length]);

  // Animate the typing dots while the AI is "thinking"
  useEffect(() => {
    if (!sending) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(typingAnim, {
          toValue: 1,
          duration: 450,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(typingAnim, {
          toValue: 0,
          duration: 450,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sending, typingAnim]);

  const doSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setSending(true);
    await service.sendMessage(text, activeTrip);
    setSending(false);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.paper }}>
        <View style={{ flex: 1 }}>
            {/* Header */}
            <View
              style={[
                styles.header,
                {
                  paddingTop: insets.top + 8,
                  borderBottomColor: colors.cardBorder,
                  backgroundColor: colors.paper,
                  zIndex: 5,
                },
              ]}
            >
              <View style={styles.headerLeft}>
                <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={roundBtn(colors, isDark)}>
                  <X size={20} color={colors.ink} />
                </TouchableOpacity>
                <Image
                  source={aiMascotImg}
                  style={styles.aiAvatar}
                  resizeMode="contain"
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.ink }}>Navi</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.inkSoft }}>Your trip navigator</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => toggleHistory(true)}
                  activeOpacity={0.8}
                  style={roundBtn(colors, isDark)}
                >
                  <History size={19} color={colors.ink} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    await service.newChat();
                    refresh();
                    toggleHistory(false);
                  }}
                  activeOpacity={0.8}
                  style={[roundBtn(colors, isDark), { backgroundColor: colors.tealDark }]}
                >
                  <Plus size={19} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Trip context — place + dates so the user knows which trip they're messaging */}
            {activeTrip && (
              <View
                style={[
                  styles.tripBar,
                  {
                    backgroundColor: colors.paperDim,
                    borderBottomColor: colors.cardBorder,
                    zIndex: 5,
                  },
                ]}
              >
                <View style={styles.tripChips}>
                  <View style={[styles.locationChip, { backgroundColor: colors.tealDark }]}>
                    <MapPin size={12} color="#FFFFFF" strokeWidth={2.4} />
                    <Text numberOfLines={1} style={styles.locationChipText}>
                      {PLACEHOLDER_DESTINATIONS.includes(activeTrip.destination) && activeTrip.title
                        ? activeTrip.title
                        : activeTrip.destination}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.dateChip,
                      {
                        backgroundColor: isDark ? 'rgba(96,165,250,0.16)' : colors.lightBlueBg,
                        borderColor: isDark ? 'rgba(96,165,250,0.35)' : 'rgba(79,134,198,0.25)',
                      },
                    ]}
                  >
                    <CalendarDays size={11.5} color={isDark ? '#60A5FA' : colors.sky} strokeWidth={2.2} />
                    <Text numberOfLines={1} style={[styles.dateChipText, { color: isDark ? '#BFDBFE' : colors.skyDeep }]}>
                      {PLACEHOLDER_DATES.includes(activeTrip.dateRange) ? 'Dates TBD' : cleanDateRange(activeTrip.dateRange)}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Messages + input move up together, natively synced with the keyboard on iOS */}
            <Animated.View style={{ flex: 1, transform: [{ translateY: keyboardShift }] }}>
            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {session?.messages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <View
                    key={msg.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      gap: 8,
                    }}
                  >
                    {!isUser && (
                      <Image source={aiMascotImg} style={[styles.msgAvatar, { marginTop: 16 }]} resizeMode="contain" />
                    )}
                    <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start', maxWidth: isUser ? '78%' : '86%' }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: colors.inkSoft, marginBottom: 3, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                        {isUser ? 'You' : 'Navi'} · {msg.time}
                      </Text>
                      {isUser ? (
                        <View
                          style={[
                            styles.bubble,
                            {
                              backgroundColor: colors.tealDark,
                              borderBottomRightRadius: 4,
                              borderBottomLeftRadius: 18,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: fs.sm,
                              fontWeight: '600',
                              lineHeight: 20,
                              color: '#FFFFFF',
                            }}
                          >
                            {msg.text}
                          </Text>
                        </View>
                      ) : (
                        <RichNaviMessage
                          message={msg}
                          colors={colors}
                          isDark={isDark}
                          onAcceptPlace={activeTrip ? handleAcceptPlace : undefined}
                        />
                      )}
                    </View>
                  </View>
                );
              })}

              {/* Typing indicator */}
              {sending && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                  <Image source={aiMascotImg} style={styles.msgAvatar} resizeMode="contain" />
                  <View style={[styles.bubble, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, flexDirection: 'row', gap: 4, alignItems: 'center' }]}>
                    {[0, 1, 2].map((i) => (
                      <Animated.View
                        key={i}
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 3.5,
                          backgroundColor: colors.inkSoft,
                          opacity: typingAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3, 1],
                          }),
                          transform: [
                            {
                              translateY: typingAnim.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [0, -3, 0],
                              }),
                            },
                          ],
                        }}
                      />
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Input area */}
            <View
              style={[
                styles.inputArea,
                { borderTopColor: colors.cardBorder, paddingBottom: keyboardOpen ? 8 : insets.bottom + 8 },
              ]}
            >
              {/*
               * Layout is ALWAYS a row with alignItems:'flex-end' so the buttons
               * never move — only borderRadius changes between pill (1 line) and
               * rounded-rect (multiline). This prevents the layout thrash / glitch.
               */}
              <View
                style={{
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderRadius: lineCount < 2 ? 100 : 20,
                  paddingLeft: 14,
                  paddingRight: 6,
                  paddingVertical: 6,
                  flexDirection: 'row',
                  alignItems: 'flex-end',
                }}
              >
                <TextInput
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: '600',
                    color: colors.ink,
                    paddingVertical: 6,
                    maxHeight: 120,
                  }}
                  placeholder="Ask Navi anything…"
                  placeholderTextColor={colors.inkSoft}
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={doSend}
                  returnKeyType="send"
                  multiline
                  blurOnSubmit
                  onContentSizeChange={(e) => {
                    const h = e.nativeEvent.contentSize.height;
                    const next = Math.round(h / 20);
                    // Only update state when the line bucket actually changes
                    // to avoid rapid re-renders causing glitch
                    setLineCount((prev) => (next !== prev ? next : prev));
                  }}
                />

                {/* Mic + Send — always bottom-right inside the container */}
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 2 }}>
                  {/* Mic — no function yet */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Mic size={15} color={colors.inkSoft} strokeWidth={2.2} />
                  </TouchableOpacity>

                  {/* Send — arrow up, teal when there's text */}
                  <TouchableOpacity
                    onPress={doSend}
                    disabled={sending}
                    activeOpacity={0.8}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: draft.trim()
                        ? colors.tealDark
                        : isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: sending ? 0.5 : 1,
                    }}
                  >
                    <ArrowUp size={16} color={draft.trim() ? '#FFFFFF' : colors.inkSoft} strokeWidth={2.6} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* History drawer backdrop — outside keyboard content so height stays static */}
        {showHistory && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => toggleHistory(false)}
            style={styles.drawerBackdrop}
          />
        )}

        {/* History drawer — outside keyboard content so it never shrinks with keyboard */}
        <Animated.View
          style={[
            styles.historyDrawer,
            {
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              transform: [{ translateX: historyAnim }],
            },
          ]}
        >
          <View style={historyHead(colors, isDark, insets.top)}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: colors.ink, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              Chat History
            </Text>
            <TouchableOpacity onPress={() => toggleHistory(false)} activeOpacity={0.7} style={roundBtn(colors, isDark)}>
              <X size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={async () => {
              await service.newChat();
              refresh();
              toggleHistory(false);
            }}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.tealDark,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              marginHorizontal: 12,
              marginTop: 4,
              marginBottom: 10,
            }}
          >
            <Plus size={16} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>New Chat</Text>
          </TouchableOpacity>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 24 }}>
            {sessions.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => {
                  service.setCurrentSession(s.id);
                  refresh();
                  toggleHistory(false);
                }}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  backgroundColor: s.id === session?.id ? (isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9') : 'transparent',
                  marginBottom: 2,
                }}
              >
                <MessageSquare size={15} color={colors.tealDark} />
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: s.id === session?.id ? '800' : '600',
                    color: colors.ink,
                  }}
                >
                  {s.title}
                </Text>
                <Text style={{ fontSize: 9, color: colors.inkSoft }}>
                  {new Date(s.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    await service.deleteSession(s.id);
                    refresh();
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={14} color={colors.inkSoft} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Accept a suggested place → add to itinerary (day + time, with 5-min gap validation) */}
        <ItineraryAddModal
          visible={!!acceptingPlace}
          mode="add"
          tripId={activeTrip?.id || ''}
          dayNumber={1}
          dayCount={tripDayCount(activeTrip?.dateRange)}
          userId={profile?.id || ''}
          initialPlace={
            acceptingPlace
              ? {
                  placeId: acceptingPlace.placeId || undefined,
                  name: acceptingPlace.name,
                  address: acceptingPlace.address || undefined,
                  photoReference: acceptingPlace.photoReference,
                }
              : null
          }
          onClose={() => closeAccept(false)}
          onSaved={() => closeAccept(true)}
        />
      </View>
    </Modal>
  );
};

const roundBtn = (colors: any, isDark: boolean): ViewStyle => ({
  width: 34,
  height: 34,
  borderRadius: 17,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
});

const historyHead = (colors: any, isDark: boolean, topInset: number): ViewStyle => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 16,
  paddingTop: topInset + 8,
  paddingBottom: 12,
  borderBottomWidth: 1,
  borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  aiAvatar: {
    width: 40,
    height: 40,
  },
  tripBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tripChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    flexShrink: 1,
  },
  locationChipText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    flexShrink: 1,
  },
  dateChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  msgAvatar: {
    width: 26,
    height: 26,
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  inputArea: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 100,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
  },
  historyDrawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 300,
    zIndex: 120,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 110,
  },
});