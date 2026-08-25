export type RecapVisibility = 'private' | 'friends' | 'public';

export type RecapMemoryType = 'photo' | 'note' | 'tip' | 'highlight' | 'place_review';

export interface TripRecapMemory {
  id: string;
  tripId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userInitials: string;
  type: RecapMemoryType;
  title?: string;
  content?: string;
  photoUrl?: string;
  photos?: string[];
  placeName?: string;
  dayNumber?: number;
  rating?: number;
  createdAt: string;
}

export interface TripRecapData {
  tripId: string;
  title: string;
  destination: string;
  dateRange: string;
  status: 'Active' | 'Completed' | 'Upcoming' | 'Draft';
  isCompleted: boolean;
  isHappeningNow: boolean;
  isAfterTrip: boolean;
  isUnlocked: boolean;
  totalDays: number;
  totalBudget: number;
  totalSpent: number;
  perPersonSpent: number;
  participantsCount: number;
  participants: Array<{
    id: string;
    name: string;
    avatarUrl?: string;
    initials: string;
    role: 'host' | 'member';
  }>;
  placesVisited: Array<{
    id: string;
    title: string;
    category?: string;
    time?: string;
    dayNumber: number;
    location?: string;
    estCost?: string;
    isCompleted?: boolean;
    photoReference?: string;
  }>;
  stays: Array<{
    id: string;
    title: string;
    placeAddress?: string;
    note?: string;
    photoReference?: string;
    estCost?: string;
  }>;
  memories: TripRecapMemory[];
  photos: string[];
  notes: TripRecapMemory[];
  tips: TripRecapMemory[];
  summaryNote?: string;
  coverPhotoUrl?: string;
  isPublic?: boolean;
  visibility?: RecapVisibility;
  likesCount?: number;
  isLikedByMe?: boolean;
  hostId?: string;
  hostName?: string;
  hostAvatar?: string;
  publishedAt?: string;
}

export interface TripRecapPost {
  tripId: string;
  title: string;
  destination: string;
  dateRange: string;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  hostInitials: string;
  visibility: RecapVisibility;
  isPublic: boolean;
  coverPhotoUrl?: string;
  summaryNote?: string;
  totalSpent: number;
  participantsCount: number;
  participantAvatars: Array<{ id: string; name: string; avatarUrl?: string; initials: string }>;
  likesCount: number;
  isLikedByMe: boolean;
  publishedAt?: string;
  placesCount: number;
  photosCount: number;
  memoriesCount: number;
  placesVisited?: Array<{
    id: string;
    title: string;
    category?: string;
    time?: string;
    dayNumber: number;
    location?: string;
    estCost?: string;
    isCompleted?: boolean;
    photoReference?: string;
  }>;
  stays?: Array<{
    id: string;
    title: string;
    placeAddress?: string;
    note?: string;
    photoReference?: string;
    estCost?: string;
  }>;
  memories?: TripRecapMemory[];
  photos?: string[];
}

