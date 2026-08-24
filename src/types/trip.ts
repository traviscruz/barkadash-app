export type ItineraryTag = 'TRANSPORT' | 'ACTIVITY' | 'FOOD' | 'MEETUP';

export interface ItineraryReaction {
  id: string;
  itemId: string;
  userId: string;
  reaction: 'like' | 'dislike';
  userFirstName?: string;
  userLastName?: string;
  userInitials?: string;
}

export interface TripStayReaction {
  id: string;
  stayId: string;
  userId: string;
  reaction: 'like' | 'dislike';
  userFirstName?: string;
  userLastName?: string;
  userInitials?: string;
}

export interface TripStayComment {
  id: string;
  stayId: string;
  userId: string;
  comment: string;
  createdAt?: string;
  userFirstName?: string;
  userLastName?: string;
  userInitials?: string;
}

export interface TripStay {
  id: string;
  tripId: string;
  title: string;
  startDay: number;
  endDay: number;
  placeId?: string;
  placeName?: string;
  placeAddress?: string;
  photoReference?: string;
  link?: string;
  note?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  reactions?: TripStayReaction[];
  likeCount?: number;
  dislikeCount?: number;
  myReaction?: 'like' | 'dislike' | null;
  comments?: TripStayComment[];
  commentCount?: number;
}

export interface ItineraryItem {
  id: string;
  time: string;
  title: string;
  category: string;
  location: string;
  estCost: string;
  note?: string;
  isCompleted?: boolean;
  dayNumber?: number;
  tag?: ItineraryTag;
  placeId?: string;
  placeName?: string;
  placeAddress?: string;
  photoReference?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedByName?: string;
  reactions?: ItineraryReaction[];
  likeCount?: number;
  dislikeCount?: number;
  myReaction?: 'like' | 'dislike' | null;
}

export interface DestinationPollOption {
  id: string;
  tripId: string;
  title: string;
  type: 'place' | 'date';
  votes: number;
  votedUserIds: string[];
  createdByUserId: string;
  createdByName: string;
  createdAt?: string;
  subtitle?: string;
  placeId?: string;
  placeName?: string;
  placeAddress?: string;
  photoReference?: string;
  imagePath?: any;
  leaderComment?: string;
  isVotedByMe?: boolean;
}

export interface BarkadaActivity {
  id: string;
  memberName: string;
  action: string;
  timeAgo: string;
  avatarBgHex: string;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  dateRange: string;
  memberCount: number;
  status: 'Active' | 'Upcoming' | 'Completed' | 'Draft';
  imageUrl: any;
  totalBudget: number;
  spentAmount: number;
  daysLeft: number | null;
  weatherTemp: string;
  weatherCondition: string;
  nextActivityTitle: string;
  nextActivityTime: string;
  day1Itinerary: ItineraryItem[];
  inviteCode?: string;
  inviteLink?: string;
  hostName?: string;
  hostId?: string;
  votingDeadline?: string | null;
  planningStage?: 'DESTINATION_VOTING' | 'ITINERARY_BUILDING' | 'READY';
  invitedFriendIds?: string[];
}

export interface MemberCommitment {
  userId: string;
  name: string;
  handle: string;
  initials: string;
  avatarBg: string;
  avatarUrl?: string;
  role: 'host' | 'member';
  status: 'accepted' | 'pending';
  commitmentLevel: number; // 0 - 100
  commitmentNote?: string;
  updatedAt?: string;
}

export interface CommitmentTierInfo {
  tier: 'unlikely' | 'tentative' | 'likely' | 'almost' | 'committed';
  label: string;
  color: string;
  gradientStart: string;
  gradientEnd: string;
  bgLight: string;
  badgeBg: string;
}

export const getCommitmentTier = (percent: number): CommitmentTierInfo => {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  if (p < 25) {
    return {
      tier: 'unlikely',
      label: 'Unlikely',
      color: '#E2604A',
      gradientStart: '#F87171',
      gradientEnd: '#E2604A',
      bgLight: '#FEF2F2',
      badgeBg: 'rgba(226, 96, 74, 0.12)',
    };
  }
  if (p < 50) {
    return {
      tier: 'tentative',
      label: 'Tentative',
      color: '#F59E0B',
      gradientStart: '#FCD34D',
      gradientEnd: '#F59E0B',
      bgLight: '#FFFBEB',
      badgeBg: 'rgba(245, 158, 11, 0.12)',
    };
  }
  if (p < 75) {
    return {
      tier: 'likely',
      label: 'Likely',
      color: '#0284C7',
      gradientStart: '#38BDF8',
      gradientEnd: '#0284C7',
      bgLight: '#F0F9FF',
      badgeBg: 'rgba(2, 132, 199, 0.12)',
    };
  }
  if (p < 100) {
    return {
      tier: 'almost',
      label: 'Almost Sure',
      color: '#0D9488',
      gradientStart: '#2DD4BF',
      gradientEnd: '#0D9488',
      bgLight: '#F0FDFA',
      badgeBg: 'rgba(13, 148, 136, 0.12)',
    };
  }
  return {
    tier: 'committed',
    label: 'Fully Committed',
    color: '#10B981',
    gradientStart: '#34D399',
    gradientEnd: '#059669',
    bgLight: '#ECFDF5',
    badgeBg: 'rgba(16, 185, 129, 0.14)',
  };
};
