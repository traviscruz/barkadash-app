import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { FeedPost } from '../../types/feedPost';
import { AppCard } from './AppCard';
import { Heart, MessageCircle, MapPin, Share2 } from 'lucide-react-native';

interface FeedPostCardProps {
  post: FeedPost;
}

export const FeedPostCard: React.FC<FeedPostCardProps> = ({ post }) => {
  const [isLiked, setIsLiked] = useState(post.isLikedByMe);
  const [likesCount, setLikesCount] = useState(post.likesCount);

  const toggleLike = () => {
    if (isLiked) {
      setIsLiked(false);
      setLikesCount(likesCount - 1);
    } else {
      setIsLiked(true);
      setLikesCount(likesCount + 1);
    }
  };

  return (
    <AppCard className="mb-5 p-0 overflow-hidden border-rule bg-white">
      {/* Header */}
      <View className="p-3.5 flex-row items-center justify-between border-b border-rule/40">
        <View className="flex-row items-center">
          <View className="w-9 h-9 rounded-full bg-skyDeep items-center justify-center mr-2.5">
            <Text className="text-white font-bold text-sm">{post.authorAvatar}</Text>
          </View>
          <View>
            <Text className="text-sm font-bold text-ink">{post.authorName}</Text>
            <View className="flex-row items-center">
              <MapPin size={11} color="#6E738A" />
              <Text className="text-xs text-inkSoft ml-1 font-medium">{post.location}</Text>
            </View>
          </View>
        </View>
        <Text className="text-xs text-inkSoft">{post.timeAgo}</Text>
      </View>

      {/* Image Carousel / Single Image */}
      {post.imageUrls && post.imageUrls.length > 0 && (
        <View className="h-64 w-full bg-paperDim">
          <Image source={post.imageUrls[0]} className="w-full h-full" resizeMode="cover" />
        </View>
      )}

      {/* Caption & Content */}
      <View className="p-4">
        <Text className="text-sm font-bold text-ink mb-1">{post.tripTitle}</Text>
        <Text className="text-sm text-ink font-normal leading-5">{post.caption}</Text>

        {/* Tags */}
        <View className="flex-row flex-wrap mt-2.5 gap-1.5">
          {post.tags.map((tag, idx) => (
            <View key={idx} className="bg-paperDim px-2.5 py-1 rounded-full border border-rule/50">
              <Text className="text-xs font-semibold text-tealAccent">#{tag}</Text>
            </View>
          ))}
        </View>

        {/* Interaction bar */}
        <View className="flex-row items-center justify-between mt-4 pt-3 border-t border-rule/50">
          <View className="flex-row items-center space-x-4">
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={toggleLike}
              className="flex-row items-center"
            >
              <Heart
                size={20}
                color={isLiked ? '#2A8563' : '#6E738A'}
                fill={isLiked ? '#2A8563' : 'transparent'}
              />
              <Text
                className={`text-xs font-bold ml-1.5 ${isLiked ? 'text-emerald' : 'text-inkSoft'}`}
              >
                {likesCount}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.7} className="flex-row items-center ml-4">
              <MessageCircle size={20} color="#6E738A" />
              <Text className="text-xs font-bold text-inkSoft ml-1.5">
                {post.commentsCount}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity activeOpacity={0.7}>
            <Share2 size={18} color="#6E738A" />
          </TouchableOpacity>
        </View>
      </View>
    </AppCard>
  );
};
