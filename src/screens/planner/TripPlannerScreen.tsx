import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsive } from '../../utils/responsive';
import { AppColors } from '../../utils/colors';
import { MapPin, Compass, Utensils } from 'lucide-react-native';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';

const { width } = Dimensions.get('window');

const bigLagoonImg = require('../../../assets/images/biglagoon.jpg');
const nacpanImg = require('../../../assets/images/nacpan.jpg');
const sagadaImg = require('../../../assets/images/sagada.jpeg');

export const TripPlannerScreen: React.FC<{ onScrollDirection?: (direction: 'up' | 'down') => void }> = ({ onScrollDirection }) => {
  const [activeSubTab, setActiveSubTab] = useState<'Itinerary' | 'Spots' | 'AI Chat'>('Itinerary');
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('DINING');
  const [promptText, setPromptText] = useState('');
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});
  const lastOffsetY = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedDay - 1,
      useNativeDriver: true,
      bounciness: 6,
      speed: 12,
    }).start();
  }, [selectedDay, slideAnim]);
  
  const [chatMessages, setChatMessages] = useState([
    {
      id: '1',
      sender: 'ai',
      text: "Mabuhay. I am your Barkada AI. What shall we plan?",
      time: '10:00 AM',
    },
    {
      id: '2',
      sender: 'user',
      text: 'Best dinner spot for 5 people?',
      time: '10:01 AM',
    },
    {
      id: '3',
      sender: 'ai',
      text: "Based on your criteria, here is the top recommendation.",
      time: '10:01 AM',
      hasCard: true,
      spotTitle: 'Altrove Trattoria',
      spotMeta: 'Italian / Wine / ₱₱',
      rating: '4.8',
      image: bigLagoonImg,
    },
  ]);

  const { sp, fs, bottomNavOffset, isTablet } = useResponsive();

  const itineraryItems = [
    {
      id: 'i1',
      time: '08:00',
      period: 'AM',
      tag: 'TRANSPORT',
      title: 'Meet at Town Dock',
      location: 'Town Harbor — ₱1,200',
      note: 'Bring dry bag & sunscreen',
    },
    {
      id: 'i2',
      time: '09:30',
      period: 'AM',
      tag: 'ACTIVITY',
      title: 'Big Lagoon Kayaking',
      location: 'Miniloc Island — ₱820',
      note: 'AI Highly Recommended',
    },
    {
      id: 'i3',
      time: '12:30',
      period: 'PM',
      tag: 'FOOD',
      title: 'Beachside Grilled Buffet',
      location: 'Shimizu Island — Included',
      note: 'Fresh Seafood',
    },
    {
      id: 'i4',
      time: '03:00',
      period: 'PM',
      tag: 'ACTIVITY',
      title: 'Secret Lagoon',
      location: 'Secret Lagoon Beach — Free',
      note: 'Low tide access only',
    },
  ];

  const handleSendMessage = () => {
    if (!promptText.trim()) return;
    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      text: promptText.trim(),
      time: 'NOW',
    };
    const aiMsg = {
      id: (Date.now() + 1).toString(),
      sender: 'ai',
      text: `Analyzing options for "${promptText.trim()}"... Stand by.`,
      time: 'NOW',
    };
    setChatMessages((prev) => [...prev, userMsg, aiMsg]);
    setPromptText('');
  };

  const toggleItemCompletion = (id: string) => {
    setCompletedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const imgHeight = isTablet ? 240 : 180;
  const spotCardWidth = isTablet ? 200 : 160;
  const spotImgHeight = isTablet ? 140 : 120;

  // App-aligned Colors
  const COLORS = {
    bgDark: '#0F2A3C', // Deep Navy from Home banner
    bgLight: AppColors.paper, // '#FAF8F5'
    accent: AppColors.sun, // Orange accent
    textDark: AppColors.ink, // '#1A1D2D'
    textLight: '#FFFFFF',
    borderDark: AppColors.tealDark, // '#1F4E67'
    borderLight: AppColors.rule, // '#EAE4D7'
    subtleDark: AppColors.inkSoft, // '#6E738A'
    subtleLight: 'rgba(255,255,255,0.6)',
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgLight }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* HEADER - Editorial but App-Themed */}
      <View style={{ paddingHorizontal: sp.lg, paddingTop: sp.md, paddingBottom: sp.lg, backgroundColor: COLORS.bgLight }}>
        
        {/* App Logo Match Home Screen */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: sp.xl }}>
          <BarkadashLogo height={36} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: sp.lg }}>
          <View>
            <Text style={{ fontSize: 10, color: AppColors.sky, fontWeight: '800', letterSpacing: 2, marginBottom: 4, textTransform: 'uppercase' }}>
              El Nido Escape / Aug 14–17
            </Text>
            <Text style={{ fontSize: fs.xxl + 4, fontWeight: '900', color: COLORS.textDark, letterSpacing: -1 }}>
              Trip Planner
            </Text>
          </View>
          <View style={{ alignItems: 'center', paddingBottom: 2 }}>
            <Text style={{ fontSize: 8, fontWeight: '800', color: COLORS.subtleDark, letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>TODAY</Text>
            <View style={{ 
              width: 38, 
              backgroundColor: '#FFFFFF', 
              borderRadius: 6, 
              borderWidth: 1, 
              borderColor: COLORS.borderLight, 
              overflow: 'hidden', 
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}>
              <View style={{ width: '100%', backgroundColor: '#FF3B30', paddingVertical: 2, alignItems: 'center' }}>
                <Text style={{ fontSize: 8, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase' }}>AUG</Text>
              </View>
              <View style={{ paddingVertical: 2, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: COLORS.textDark }}>6</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tab Switcher - Typographic with rounded active pill style */}
        <View style={{ flexDirection: 'row', gap: sp.sm }}>
          {(['Itinerary', 'Spots', 'AI Chat'] as const).map((tab) => {
            const isSelected = activeSubTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveSubTab(tab)}
                style={{
                  paddingVertical: sp.sm,
                  paddingHorizontal: sp.md,
                  borderRadius: 100,
                  backgroundColor: isSelected ? COLORS.textDark : 'transparent',
                  borderWidth: 1,
                  borderColor: isSelected ? COLORS.textDark : COLORS.borderLight,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: isSelected ? COLORS.textLight : COLORS.subtleDark,
                  }}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* MAIN CONTENT BODY */}
      <View style={{ flex: 1, backgroundColor: COLORS.bgLight }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={(e) => {
            const currentY = e.nativeEvent.contentOffset.y;
            const delta = currentY - lastOffsetY.current;
            lastOffsetY.current = currentY;

            if (currentY < 15) {
              onScrollDirection?.('up');
            } else if (delta > 6) {
              onScrollDirection?.('down');
            } else if (delta < -6) {
              onScrollDirection?.('up');
            }
          }}
          scrollEventThrottle={8}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: sp.lg, paddingTop: sp.md, paddingBottom: bottomNavOffset + 40 }}
        >
          {/* ================= ITINERARY ================= */}
          {activeSubTab === 'Itinerary' && (
            <View>
              {/* Premium Segmented Day Selector */}
              <View style={{ 
                flexDirection: 'row', 
                backgroundColor: '#FFFFFF', 
                padding: 6, 
                borderRadius: 100, 
                borderWidth: 1, 
                borderColor: COLORS.borderLight, 
                marginBottom: sp.xl,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.04,
                shadowRadius: 12,
                elevation: 2,
                position: 'relative',
              }}>
                <Animated.View style={{
                  position: 'absolute',
                  top: 6,
                  bottom: 6,
                  left: 6,
                  width: (width - (sp.lg * 2) - 12) / 4,
                  backgroundColor: COLORS.bgDark,
                  borderRadius: 100,
                  transform: [{
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1, 2, 3],
                      outputRange: [0, (width - (sp.lg * 2) - 12) / 4, ((width - (sp.lg * 2) - 12) / 4) * 2, ((width - (sp.lg * 2) - 12) / 4) * 3]
                    })
                  }]
                }} />
                {[
                  { day: 1, date: 'AUG 14' },
                  { day: 2, date: 'AUG 15' },
                  { day: 3, date: 'AUG 16' },
                  { day: 4, date: 'AUG 17' },
                ].map((d) => {
                  const isSelected = selectedDay === d.day;
                  return (
                    <TouchableOpacity
                      key={d.day}
                      onPress={() => setSelectedDay(d.day)}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 100,
                        backgroundColor: 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 9, fontWeight: '800', color: isSelected ? 'rgba(255,255,255,0.7)' : COLORS.subtleDark, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        DAY {d.day}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: isSelected ? COLORS.textLight : COLORS.textDark, letterSpacing: 0.5 }}>
                        {d.date}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Day Summary */}
              <View style={{ marginBottom: sp.xl, paddingLeft: 12, borderLeftWidth: 4, borderLeftColor: AppColors.emerald }}>
                <Text style={{ fontSize: fs.lg, fontWeight: '900', color: COLORS.textDark }}>
                  Island Hopping + Lagoons
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.subtleDark, marginTop: 4, letterSpacing: 0.5 }}>
                  4 activities / ₱1,500 est.
                </Text>
              </View>

              {/* Timeline */}
              <View style={{ gap: sp.lg }}>
                {itineraryItems.map((item, idx) => (
                  <View key={item.id} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    {/* Time Column */}
                    <View style={{ width: 65, alignItems: 'flex-start', paddingTop: 4 }}>
                      <Text style={{ fontSize: fs.md, fontWeight: '900', color: COLORS.textDark }}>{item.time}</Text>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.subtleDark }}>{item.period}</Text>
                    </View>

                    {/* Timeline Line */}
                    <View style={{ width: 24, alignItems: 'center' }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.bgDark, marginTop: 8 }} />
                      {idx < itineraryItems.length - 1 && (
                        <View style={{ width: 2, flex: 1, backgroundColor: COLORS.borderLight, marginVertical: 4 }} />
                      )}
                    </View>

                    {/* Content Card */}
                    <TouchableOpacity 
                      activeOpacity={0.8}
                      onPress={() => toggleItemCompletion(item.id)}
                      style={{ flex: 1, paddingBottom: sp.xl, opacity: completedItems[item.id] ? 0.4 : 1 }}
                    >
                      <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: AppColors.lightOrangeBg, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8, borderRadius: 6 }}>
                        {item.tag === 'TRANSPORT' && <MapPin size={10} color="#B8791E" style={{ marginRight: 4 }} />}
                        {item.tag === 'ACTIVITY' && <Compass size={10} color="#B8791E" style={{ marginRight: 4 }} />}
                        {item.tag === 'FOOD' && <Utensils size={10} color="#B8791E" style={{ marginRight: 4 }} />}
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#B8791E', letterSpacing: 1 }}>{item.tag}</Text>
                      </View>
                      <Text style={{ fontSize: fs.md, fontWeight: '800', color: COLORS.textDark, marginBottom: 4, textDecorationLine: completedItems[item.id] ? 'line-through' : 'none' }}>{item.title}</Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.subtleDark, letterSpacing: 0.2, marginBottom: 8, textDecorationLine: completedItems[item.id] ? 'line-through' : 'none' }}>
                        {item.location}
                      </Text>
                      <View style={{ borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: AppColors.sky }}>+ {item.note}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ================= SPOTS ================= */}
          {activeSubTab === 'Spots' && (
            <View>
              {/* Soft Category Links */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: sp.xl }}>
                <View style={{ flexDirection: 'row', gap: sp.lg }}>
                  {['DINING', 'SUNSET', 'HIDDEN', 'STAYS', 'CULTURE'].map((cat) => {
                    const isSelected = selectedCategory === cat;
                    return (
                      <TouchableOpacity key={cat} onPress={() => setSelectedCategory(cat)}>
                        <Text
                          style={{
                            fontSize: 22,
                            fontWeight: '900',
                            color: isSelected ? COLORS.textDark : '#D1C9B9',
                            textDecorationLine: isSelected ? 'underline' : 'none',
                          }}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Spots Carousel */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: sp.xxl, marginHorizontal: -sp.lg }} contentContainerStyle={{ paddingHorizontal: sp.lg }}>
                <View style={{ flexDirection: 'row', gap: sp.md }}>
                  {[
                    { title: 'Big Lagoon', meta: 'Nature / Water', img: bigLagoonImg },
                    { title: 'Nacpan', meta: 'Beach / Sand', img: nacpanImg },
                    { title: 'Taraw Cliff', meta: 'Hike / View', img: sagadaImg },
                  ].map((spot, idx) => (
                    <View key={idx} style={{ width: spotCardWidth }}>
                      <View style={{ height: spotImgHeight, backgroundColor: COLORS.borderLight, marginBottom: sp.sm, borderRadius: 16, overflow: 'hidden' }}>
                        <Image source={spot.img} style={{ width: '100%', height: '100%' }} />
                      </View>
                      <Text style={{ fontSize: fs.sm, fontWeight: '900', color: COLORS.textDark, letterSpacing: 0 }}>{spot.title}</Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.subtleDark, marginTop: 2 }}>{spot.meta}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Featured AI Pick */}
              <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: sp.md, borderWidth: 1, borderColor: COLORS.borderLight }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.md }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1, color: COLORS.textDark, textTransform: 'uppercase' }}>Featured AI Pick</Text>
                  <View style={{ backgroundColor: AppColors.lightGreenBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', color: AppColors.emerald, textTransform: 'uppercase' }}>96% Match</Text>
                  </View>
                </View>
                
                <View style={{ height: imgHeight, marginBottom: sp.md, borderRadius: 16, overflow: 'hidden' }}>
                  <Image source={bigLagoonImg} style={{ width: '100%', height: '100%' }} />
                </View>

                <Text style={{ fontSize: fs.xl, fontWeight: '900', color: COLORS.textDark, marginBottom: 4 }}>
                  Altrove Trattoria
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: sp.md }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.subtleDark, letterSpacing: 0 }}>
                    Wood-fired Italian / ₱₱
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: COLORS.accent }}>Rating 4.8</Text>
                </View>

                <Text style={{ fontSize: 12, fontWeight: '500', color: COLORS.textDark, lineHeight: 18, marginBottom: sp.lg }}>
                  Famous brick-oven pizzas and fresh pasta. Cozy dim-lit upper deck ideal for barkada dinners. Arrive early to skip the line.
                </Text>

                <TouchableOpacity
                  style={{
                    backgroundColor: COLORS.bgDark,
                    paddingVertical: sp.md,
                    borderRadius: 14,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: COLORS.textLight, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>Add to Itinerary</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ================= AI CHAT ================= */}
          {activeSubTab === 'AI Chat' && (
            <View style={{ flex: 1 }}>
              <View style={{ gap: sp.lg, marginBottom: sp.xl }}>
                {chatMessages.map((msg) => (
                  <View
                    key={msg.id}
                    style={{
                      flexDirection: 'column',
                      alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: '800', color: COLORS.subtleDark, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      {msg.sender === 'user' ? 'You' : 'Barkada AI'} — {msg.time}
                    </Text>
                    
                    <View
                      style={{
                        maxWidth: '85%',
                        backgroundColor: msg.sender === 'user' ? COLORS.bgDark : '#FFFFFF',
                        padding: sp.md,
                        borderRadius: 18,
                        borderBottomRightRadius: msg.sender === 'user' ? 4 : 18,
                        borderBottomLeftRadius: msg.sender === 'ai' ? 4 : 18,
                        borderWidth: msg.sender === 'ai' ? 1 : 0,
                        borderColor: COLORS.borderLight,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fs.sm,
                          fontWeight: '600',
                          lineHeight: 20,
                          color: msg.sender === 'user' ? COLORS.textLight : COLORS.textDark,
                        }}
                      >
                        {msg.text}
                      </Text>

                      {msg.hasCard && (
                        <View style={{ marginTop: sp.md, backgroundColor: COLORS.bgLight, padding: sp.sm, borderRadius: 12 }}>
                          <Image
                            source={msg.image}
                            style={{ height: 100, width: '100%', marginBottom: sp.sm, borderRadius: 8 }}
                          />
                          <Text style={{ fontSize: 12, fontWeight: '900', color: COLORS.textDark }}>{msg.spotTitle}</Text>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: COLORS.subtleDark, marginBottom: 6 }}>{msg.spotMeta}</Text>
                          <View style={{ flexDirection: 'row', gap: sp.sm }}>
                            <TouchableOpacity style={{ flex: 1, backgroundColor: AppColors.lightGreenBg, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}>
                              <Text style={{ color: AppColors.emerald, fontSize: 10, fontWeight: '800' }}>Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ flex: 1, backgroundColor: AppColors.lightRedBg, paddingVertical: 8, borderRadius: 8, alignItems: 'center' }}>
                              <Text style={{ color: AppColors.redAccent, fontSize: 10, fontWeight: '800' }}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              {/* Quick Prompts */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: sp.md }}>
                <View style={{ flexDirection: 'row', gap: sp.sm }}>
                  {['Sunset Spots', 'Dinner for 5', 'Budget Fun'].map((prompt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setPromptText(prompt)}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: COLORS.borderLight,
                        paddingHorizontal: sp.md,
                        paddingVertical: 10,
                        borderRadius: 100,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: COLORS.textDark, fontWeight: '800' }}>{prompt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Chat Input */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 100, paddingLeft: sp.lg, paddingRight: 6, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.borderLight }}>
                <TextInput
                  style={{ flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textDark, paddingVertical: 8 }}
                  placeholder="Type message..."
                  placeholderTextColor={COLORS.subtleDark}
                  value={promptText}
                  onChangeText={setPromptText}
                />
                <TouchableOpacity
                  onPress={handleSendMessage}
                  style={{
                    backgroundColor: COLORS.bgDark,
                    paddingHorizontal: sp.lg,
                    paddingVertical: 10,
                    borderRadius: 100,
                  }}
                >
                  <Text style={{ color: COLORS.textLight, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
