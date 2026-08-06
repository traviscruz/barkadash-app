import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Share2 } from 'lucide-react-native';
import { useResponsive } from '../../utils/responsive';

const mapImg = require('../../../assets/images/map.png');

interface MemberStatus {
  id: string;
  name: string;
  avatarBg: string;
  statusText: string;
  initial: string;
  isMe?: boolean;
}

export const BarkadaRadarScreen: React.FC<{ onScrollDirection?: (direction: 'up' | 'down') => void }> = () => {
  const [selectedMember, setSelectedMember] = useState<string>('m1');
  const { sp, fs, icon, insets, isTablet } = useResponsive();

  const members: MemberStatus[] = [
    {
      id: 'm1',
      name: 'Travis (you)',
      initial: 'T',
      avatarBg: '#3B7A9E',
      statusText: 'At Nacpan Beach',
      isMe: true,
    },
    {
      id: 'm2',
      name: 'Steven',
      initial: 'S',
      avatarBg: '#4F86C6',
      statusText: 'At Town Harbor',
    },
    {
      id: 'm3',
      name: 'Harry',
      initial: 'H',
      avatarBg: '#3B7A9E',
      statusText: 'At Las Cabañas Sunset',
    },
    {
      id: 'm4',
      name: 'Ahiah',
      initial: 'A',
      avatarBg: '#F0A93E',
      statusText: 'At Big Lagoon Kayaks',
    },
    {
      id: 'm5',
      name: 'Ica',
      initial: 'I',
      avatarBg: '#3A8E71',
      statusText: 'At Cadlao Resort',
    },
  ];

  const currentMember = members.find((m) => m.id === selectedMember) || members[0];

  const handleShare = () => {
    Alert.alert('Location Shared! 📍', 'Broadcasted live radar pin to squad.');
  };

  const avatarSize = isTablet ? 44 : 36;
  const bigAvatarSize = isTablet ? 52 : 44;
  const memberAvatarSize = isTablet ? 46 : 40;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#D6E6DE' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* FULL MAP BACKDROP */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Image source={mapImg} style={{ width: '100%', height: '100%' }} resizeMode="cover" />

        {/* Map Member Pin Markers */}
        <View style={{ position: 'absolute', top: '35%', left: '55%', alignItems: 'center' }}>
          <View
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: '#1F4E67',
              borderWidth: 2,
              borderColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: fs.xs }}>I</Text>
          </View>
        </View>

        <View style={{ position: 'absolute', top: '42%', left: '65%', alignItems: 'center' }}>
          <View
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: '#F5A65B',
              borderWidth: 2,
              borderColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: fs.xs }}>A</Text>
          </View>
        </View>

        <View style={{ position: 'absolute', top: '52%', left: '40%', alignItems: 'center' }}>
          <View
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: '#4F86C6',
              borderWidth: 2,
              borderColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: fs.xs }}>S</Text>
          </View>
        </View>

        <View style={{ position: 'absolute', top: '60%', left: '48%', alignItems: 'center' }}>
          <View
            style={{
              width: bigAvatarSize,
              height: bigAvatarSize,
              borderRadius: bigAvatarSize / 2,
              backgroundColor: '#3B7A9E',
              borderWidth: 2,
              borderColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: fs.sm }}>T</Text>
          </View>
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              paddingHorizontal: sp.sm,
              paddingVertical: 2,
              borderRadius: 6,
              marginTop: sp.xs,
              borderWidth: 1,
              borderColor: '#EAE4D7',
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#1A1D2D' }}>El Nido</Text>
          </View>
        </View>

        <View style={{ position: 'absolute', top: '70%', left: '58%', alignItems: 'center' }}>
          <View
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: '#3B7A9E',
              borderWidth: 2,
              borderColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: fs.xs }}>H</Text>
          </View>
        </View>
      </View>

      {/* TOP FLOATING APP BAR */}
      <View style={{ paddingHorizontal: sp.lg, paddingTop: sp.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.9)',
            paddingHorizontal: sp.md,
            paddingVertical: sp.xs + 2,
            borderRadius: 100,
            borderWidth: 1,
            borderColor: '#EAE4D7',
          }}
        >
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3A8E71', marginRight: sp.sm }} />
          <Text style={{ fontSize: fs.xs, fontWeight: '900', color: '#1A1D2D' }}>Barkada Radar</Text>
          <View
            style={{
              backgroundColor: 'rgba(58,142,113,0.15)',
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
              marginLeft: 6,
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: '800', color: '#3A8E71' }}>LIVE</Text>
          </View>
        </View>

        <TouchableOpacity
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderWidth: 1,
            borderColor: '#EAE4D7',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Settings size={icon.lg} color="#1A1D2D" />
        </TouchableOpacity>
      </View>

      {/* BOTTOM SHEET */}
      <View
        style={{
          marginTop: 'auto',
          paddingHorizontal: sp.lg,
          paddingBottom: insets.bottom > 0 ? insets.bottom + 72 : 88,
          zIndex: 20,
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: sp.lg,
            gap: sp.md,
            borderWidth: 1,
            borderColor: '#EAE4D7',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          {/* Member Detail */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: sp.md,
              borderBottomWidth: 1,
              borderBottomColor: '#EAE4D7',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: bigAvatarSize,
                  height: bigAvatarSize,
                  borderRadius: bigAvatarSize / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: sp.md,
                  borderWidth: 1,
                  borderColor: '#FFFFFF',
                  backgroundColor: currentMember.avatarBg,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: fs.md }}>{currentMember.initial}</Text>
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: fs.md, fontWeight: '700', color: '#1A1D2D' }}>{currentMember.name}</Text>
                  {currentMember.isMe && (
                    <View
                      style={{
                        backgroundColor: '#E4F0F4',
                        paddingHorizontal: sp.sm,
                        paddingVertical: 2,
                        borderRadius: 6,
                        marginLeft: 6,
                      }}
                    >
                      <Text style={{ color: '#3B7A9E', fontSize: 9, fontWeight: '800' }}>YOU</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: fs.xs, color: '#6E738A', marginTop: 2 }}>
                  📍 {currentMember.statusText}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 10, color: '#6E738A', fontWeight: '500' }}>Just now</Text>
          </View>

          {/* Member Selector Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: sp.sm, paddingHorizontal: sp.xs }}>
            {members.map((m) => {
              const isSelected = selectedMember === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => setSelectedMember(m.id)}
                  style={{ alignItems: 'center' }}
                >
                  <View
                    style={{
                      width: memberAvatarSize,
                      height: memberAvatarSize,
                      borderRadius: memberAvatarSize / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: m.avatarBg,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? '#4F86C6' : '#EAE4D7',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: fs.sm }}>{m.initial}</Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 10,
                      marginTop: 4,
                      fontWeight: isSelected ? '900' : '400',
                      color: isSelected ? '#4F86C6' : '#6E738A',
                    }}
                  >
                    {m.initial === 'T' ? 'Travis' : m.name.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer Bar */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: sp.sm,
              borderTopWidth: 1,
              borderTopColor: 'rgba(234,228,215,0.6)',
            }}
          >
            <View style={{ flexDirection: 'row', gap: sp.md }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#6E738A' }}>👥 5 Online</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#6E738A' }}>📍 El Nido</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#6E738A' }}>Trip Only</Text>
            </View>

            <TouchableOpacity
              onPress={handleShare}
              style={{
                backgroundColor: '#1F4E67',
                paddingHorizontal: sp.lg,
                paddingVertical: sp.xs + 2,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: sp.xs,
              }}
            >
              <Share2 size={icon.sm} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: fs.xs, fontWeight: '700' }}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};
