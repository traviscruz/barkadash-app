export interface FeedPost {
  id: string;
  authorName: string;
  authorAvatar: string;
  tripTitle: string;
  location: string;
  timeAgo: string;
  caption: string;
  imageUrls: any[];
  likesCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  tags: string[];
}
