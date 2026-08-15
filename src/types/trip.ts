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
