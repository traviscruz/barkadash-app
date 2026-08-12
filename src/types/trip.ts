export interface ItineraryItem {
  id: string;
  time: string;
  title: string;
  category: string;
  location: string;
  estCost: string;
  note?: string;
  isCompleted?: boolean;
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
  subtitle?: string;
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
  daysLeft: number;
  weatherTemp: string;
  weatherCondition: string;
  nextActivityTitle: string;
  nextActivityTime: string;
  day1Itinerary: ItineraryItem[];
  inviteCode?: string;
  inviteLink?: string;
  hostName?: string;
  planningStage?: 'DESTINATION_VOTING' | 'ITINERARY_BUILDING' | 'READY';
  invitedFriendIds?: string[];
}
