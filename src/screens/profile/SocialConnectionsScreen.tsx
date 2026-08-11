import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, UserCheck, UserPlus, Users, UserSearch, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { ConnectionService, DBUserConnection } from '../../services/connectionService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_PADDING = 20;
const SEGMENT_PADDING = 6;
const TAB_CONTAINER_WIDTH = SCREEN_WIDTH - CONTAINER_PADDING * 2;
const TAB_WIDTH = (TAB_CONTAINER_WIDTH - SEGMENT_PADDING * 2) / 3;

const FALLBACK_MOCK_CONNECTIONS: DBUserConnection[] = [
  {
    id: 'u1',
    name: 'Steven Cruz',
    handle: '@stevencruz',
    initials: 'SC',
    avatarBg: '#0171F8',
    isFollowing: true,
    isFollower: true,
  },
  {
    id: 'u2',
    name: 'Marco Santos',
    handle: '@marcosantos',
    initials: 'MS',
    avatarBg: '#4F86C6',
    isFollowing: true,
    isFollower: true,
  },
  {
    id: 'u3',
    name: 'Patricia Reyes',
    handle: '@patricia_r',
    initials: 'PR',
    avatarBg: '#E11D48',
    isFollowing: false,
    isFollower: true,
  },
  {
    id: 'u4',
    name: 'Bea Tan',
    handle: '@beatan',
    initials: 'BT',
    avatarBg: '#8B5CF6',
    isFollowing: true,
    isFollower: true,
  },
  {
    id: 'u5',
    name: 'Carlos Gonzales',
    handle: '@carlos_g',
    initials: 'CG',
    avatarBg: '#10B981',
    isFollowing: false,
    isFollower: true,
  },
  {
    id: 'u6',
    name: 'Julia Mendoza',
    handle: '@juliamendoz',
    initials: 'JM',
    avatarBg: '#F59E0B',
    isFollowing: true,
    isFollower: false,
  },
  {
    id: 'u7',
    name: 'David Lim',
    handle: '@davidlim',
    initials: 'DL',
    avatarBg: '#3B82F6',
    isFollowing: true,
    isFollower: true,
  },
  {
    id: 'u8',
    name: 'Alexander De La Cruz Montgomery III',
    handle: '@alexander_delacruz_montgomery',
    initials: 'AM',
    avatarBg: '#8B5CF6',
    isFollowing: false,
    isFollower: true,
  },
  {
    id: 'u9',
    name: 'Maria Consuelo Francesca Rodriguez',
    handle: '@maria_consuelo_francesca',
    initials: 'MR',
    avatarBg: '#EC4899',
    isFollowing: true,
    isFollower: true,
  },
];

interface SocialConnectionsScreenProps {
  onBack?: () => void;
}

export const SocialConnectionsScreen: React.FC<SocialConnectionsScreenProps> = ({ onBack }) => {
  const { colors } = useTheme();
  const { profile } = useUser();
  const currentUserId = profile?.id;

  const [activeTab, setActiveTab] = useState<'followers' | 'following' | 'discover'>('followers');
  const [searchQuery, setSearchQuery] = useState('');
  const [dbUsers, setDbUsers] = useState<DBUserConnection[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  // Local persistent state map for real-time follow/unfollow synchronization
  const [localFollowMap, setLocalFollowMap] = useState<Record<string, boolean>>({});

  // Animated sliding pill position for 3-tab switcher
  const animatedPillX = useRef(new Animated.Value(0)).current;

  const loadDatabaseUsers = useCallback(async (query: string) => {
    setIsFetching(true);
    try {
      const results = await ConnectionService.searchUsers(query, currentUserId);
      if (results && results.length > 0) {
        setDbUsers(results);
      } else {
        // Fallback to local mock data if no database records match
        setDbUsers(FALLBACK_MOCK_CONNECTIONS);
      }
    } catch (err) {
      setDbUsers(FALLBACK_MOCK_CONNECTIONS);
    } finally {
      setIsFetching(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDatabaseUsers(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, loadDatabaseUsers]);

  const handleTabChange = (tab: 'followers' | 'following' | 'discover', index: number) => {
    setActiveTab(tab);
    Animated.spring(animatedPillX, {
      toValue: index * TAB_WIDTH,
      stiffness: 320,
      damping: 28,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  };

  const toggleFollow = async (targetUserId: string) => {
    const targetUser = dbUsers.find((u) => u.id === targetUserId);
    if (!targetUser) return;

    const currentIsFollowing =
      localFollowMap[targetUserId] !== undefined
        ? localFollowMap[targetUserId]
        : targetUser.isFollowing;

    const newIsFollowing = !currentIsFollowing;

    // Persist local follow state
    setLocalFollowMap((prev) => ({ ...prev, [targetUserId]: newIsFollowing }));

    // Optimistic UI state update
    setDbUsers((prev) =>
      prev.map((user) =>
        user.id === targetUserId ? { ...user, isFollowing: newIsFollowing } : user
      )
    );

    if (currentUserId) {
      if (newIsFollowing) {
        const followerName =
          `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() ||
          profile?.username ||
          'Someone';
        await ConnectionService.followUser(currentUserId, targetUserId, followerName);
      } else {
        await ConnectionService.unfollowUser(currentUserId, targetUserId);
      }
    }
  };

  // Synchronize active user list with local persistent follow map
  const synchronizedUsers = dbUsers.map((u) => ({
    ...u,
    isFollowing: localFollowMap[u.id] !== undefined ? localFollowMap[u.id] : u.isFollowing,
  }));

  const filteredUsers = synchronizedUsers.filter((user) => {
    const queryLower = searchQuery.trim().toLowerCase();
    const matchesSearch =
      queryLower.length === 0 ||
      user.name.toLowerCase().includes(queryLower) ||
      user.handle.toLowerCase().includes(queryLower);

    if (!matchesSearch) return false;

    if (activeTab === 'followers') return user.isFollower;
    if (activeTab === 'following') return user.isFollowing;
    if (activeTab === 'discover') return true;
    return true;
  });

  const followerCount = synchronizedUsers.filter((u) => u.isFollower).length;
  const followingCount = synchronizedUsers.filter((u) => u.isFollowing).length;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backTouch}>
          <ChevronLeft size={24} color={colors.tealDark} />
          <Text style={[styles.backText, { color: colors.tealDark }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Connections</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* 3-Tab Segmented Capsule Bar */}
      <View style={{ paddingHorizontal: CONTAINER_PADDING, marginTop: 4, marginBottom: 16 }}>
        <View
          style={[
            styles.segmentedContainer,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
          ]}
        >
          {/* Animated Sliding Background Pill */}
          <Animated.View
            style={[
              styles.animatedPill,
              {
                width: TAB_WIDTH,
                backgroundColor: colors.tealDark,
                transform: [{ translateX: animatedPillX }],
              },
            ]}
          />

          {/* Tab 1: Followers */}
          <TouchableOpacity
            onPress={() => handleTabChange('followers', 0)}
            activeOpacity={0.8}
            style={styles.segmentBtn}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'followers' ? '#FFFFFF' : colors.inkSoft },
              ]}
              numberOfLines={1}
            >
              {followerCount} Followers
            </Text>
          </TouchableOpacity>

          {/* Tab 2: Following */}
          <TouchableOpacity
            onPress={() => handleTabChange('following', 1)}
            activeOpacity={0.8}
            style={styles.segmentBtn}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'following' ? '#FFFFFF' : colors.inkSoft },
              ]}
              numberOfLines={1}
            >
              {followingCount} Following
            </Text>
          </TouchableOpacity>

          {/* Tab 3: Discover & Add */}
          <TouchableOpacity
            onPress={() => handleTabChange('discover', 2)}
            activeOpacity={0.8}
            style={styles.segmentBtn}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'discover' ? '#FFFFFF' : colors.inkSoft },
              ]}
              numberOfLines={1}
            >
              Add People
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input Field */}
      <View style={{ paddingHorizontal: CONTAINER_PADDING, marginBottom: 12 }}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Search size={18} color={colors.inkSoft} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              activeTab === 'discover'
                ? 'Search anyone to add or follow...'
                : 'Search name or @username...'
            }
            placeholderTextColor={colors.inkSoft}
            style={[styles.searchInput, { color: colors.ink }]}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
              <X size={16} color={colors.inkSoft} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* User List */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: CONTAINER_PADDING, paddingBottom: 48 }}
      >
        {isFetching ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.tealDark} />
            <Text style={[styles.loadingText, { color: colors.inkSoft }]}>Searching database...</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <UserSearch size={40} color={colors.inkSoft} />
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>No accounts found</Text>
            <Text style={[styles.emptySub, { color: colors.inkSoft }]}>
              {activeTab !== 'discover'
                ? "Can't find them here? Try switching to the 'Add People' tab to search all users!"
                : 'No users found matching your search.'}
            </Text>

            {activeTab !== 'discover' && (
              <TouchableOpacity
                onPress={() => handleTabChange('discover', 2)}
                activeOpacity={0.8}
                style={[styles.discoverBtn, { backgroundColor: colors.tealDark }]}
              >
                <UserPlus size={16} color="#FFFFFF" />
                <Text style={styles.discoverBtnText}>Search All People in Barkadash</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredUsers.map((user, idx) => (
            <View key={user.id}>
              <View style={styles.userRow}>
                {/* Avatar */}
                <View style={[styles.avatarCircle, { backgroundColor: user.avatarBg }]}>
                  <Text style={styles.avatarText}>{user.initials}</Text>
                </View>

                {/* Name & Handle */}
                <View style={{ flex: 1, marginLeft: 14, marginRight: 10 }}>
                  <Text style={[styles.userName, { color: colors.ink }]} numberOfLines={1} ellipsizeMode="tail">
                    {user.name}
                  </Text>
                  <Text style={[styles.userHandle, { color: colors.inkSoft }]} numberOfLines={1} ellipsizeMode="tail">
                    {user.handle}
                  </Text>
                </View>

                {/* Oval Follow Button */}
                <TouchableOpacity
                  onPress={() => toggleFollow(user.id)}
                  activeOpacity={0.8}
                  style={[
                    styles.ovalBtn,
                    user.isFollowing
                      ? [styles.followingOvalBtn, { borderColor: colors.cardBorder }]
                      : [styles.followBackOvalBtn, { backgroundColor: colors.tealDark }],
                  ]}
                >
                  {user.isFollowing ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <UserCheck size={14} color={colors.ink} />
                      <Text style={[styles.followingOvalBtnText, { color: colors.ink }]}>Following</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <UserPlus size={14} color="#FFFFFF" />
                      <Text style={styles.followBackOvalBtnText}>
                        {user.isFollower ? 'Follow Back' : 'Add / Follow'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              {idx < filteredUsers.length - 1 && (
                <View style={[styles.rowDivider, { backgroundColor: colors.cardBorder }]} />
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: CONTAINER_PADDING,
    paddingVertical: 12,
  },
  backTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  segmentedContainer: {
    flexDirection: 'row',
    padding: SEGMENT_PADDING,
    borderRadius: 100,
    borderWidth: 1,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  animatedPill: {
    position: 'absolute',
    top: SEGMENT_PADDING,
    bottom: SEGMENT_PADDING,
    left: SEGMENT_PADDING,
    borderRadius: 100,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    zIndex: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowDivider: {
    height: 1,
    opacity: 0.4,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
  },
  userHandle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  ovalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    minWidth: 102,
  },
  followingOvalBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  followingOvalBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  followBackOvalBtn: {},
  followBackOvalBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 30,
    lineHeight: 18,
  },
  discoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
    marginTop: 16,
  },
  discoverBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
