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
  title: string;
  imagePath: any;
  votes: number;
  isVotedByMe: boolean;
  leaderComment: string;
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
}
