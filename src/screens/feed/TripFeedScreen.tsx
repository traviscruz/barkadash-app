import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart } from 'lucide-react-native';
import { useResponsive } from '../../utils/responsive';

const elnidoImg = require('../../../assets/images/elnido.jpg');
const sagadaImg = require('../../../assets/images/sagada.jpeg');
const zambalesImg = require('../../../assets/images/zambales.jpg');

export const TripFeedScreen: React.FC<{ onScrollDirection?: (direction: 'up' | 'down') => void }> = ({ onScrollDirection }) => {
  const [activeTab, setActiveTab] = useState<'Following' | 'Explore'>('Following');
  const lastOffsetY = useRef(0);
  const { sp, fs, icon, bottomNavOffset, isTablet } = useResponsive();

  const feedItems = [
    {
      id: 'f1',
      title: 'El Nido Escape',
      price: '₱18.4k',
      likes: 24,
      image: elnidoImg,
      avatars: ['#4F86C6', '#4F86C6', '#3B7A9E'],
      extraText: '+2 others',
    },
    {
      id: 'f2',
      title: 'Sagada Sunrise',
      price: '₱9.2k',
      likes: 41,
      image: sagadaImg,
      avatars: ['#4F86C6', '#F0A93E', '#3A8E71'],
      extraText: '+4 others',
    },
    {
      id: 'f3',
      title: 'Zambales Weekend',
      price: '₱6.1k',
      likes: 15,
      image: zambalesImg,
      avatars: ['#4F86C6', '#3A8E71'],
      extraText: '+1 other',
    },
  ];

  const cardImgHeight = isTablet ? 220 : 176;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF8F5' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={{ flex: 1, paddingHorizontal: sp.lg, paddingTop: sp.md }}>
        {/* Header */}
        <Text style={{ fontSize: fs.xxl, fontWeight: '900', color: '#1A1D2D', letterSpacing: -0.5, marginBottom: sp.sm }}>
          Barkada Feed
        </Text>

        {/* Sub-Tabs */}
        <View style={{ flexDirection: 'row', gap: sp.sm, marginBottom: sp.lg }}>
          {(['Following', 'Explore'] as const).map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  paddingHorizontal: sp.lg,
                  paddingVertical: sp.xs + 2,
                  borderRadius: 100,
                  borderWidth: 1,
                  backgroundColor: isSelected ? '#1F4E67' : '#FFFFFF',
                  borderColor: isSelected ? '#1F4E67' : '#EAE4D7',
                }}
              >
                <Text
                  style={{
                    fontSize: fs.xs,
                    fontWeight: '700',
                    color: isSelected ? '#FFFFFF' : '#1A1D2D',
                  }}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Feed Cards */}
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
          contentContainerStyle={{ paddingBottom: bottomNavOffset, gap: sp.lg }}
        >
          {feedItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.9}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 24,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#EAE4D7',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              {/* Photo with Overlay */}
              <View style={{ height: cardImgHeight, width: '100%', backgroundColor: '#F0ECE3', position: 'relative' }}>
                <Image source={item.image} style={{ width: '100%', height: '100%' }} resizeMode="cover" />

                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.25)',
                    justifyContent: 'space-between',
                    padding: sp.md,
                  }}
                >
                  {/* Top Price Tag */}
                  <View style={{ alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 10, paddingVertical: sp.xs, borderRadius: 100 }}>
                    <Text style={{ color: '#1A1D2D', fontSize: 11, fontWeight: '900' }}>{item.price}</Text>
                  </View>

                  {/* Bottom Title */}
                  <Text style={{ fontSize: fs.xl, fontWeight: '900', color: '#FFFFFF' }}>
                    {item.title}
                  </Text>
                </View>
              </View>

              {/* Footer Bar */}
              <View
                style={{
                  padding: sp.md,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {/* Avatars + Count */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {item.avatars.map((color, idx) => (
                    <View
                      key={idx}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: '#FFFFFF',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: color,
                        marginLeft: idx > 0 ? -6 : 0,
                      }}
                    />
                  ))}
                  <Text style={{ fontSize: fs.xs, fontWeight: '600', color: '#6E738A', marginLeft: sp.sm }}>
                    {item.extraText}
                  </Text>
                </View>

                {/* Like Counter */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}>
                  <Heart size={icon.sm} color="#2A8563" fill="#2A8563" />
                  <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#1A1D2D' }}>{item.likes}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
