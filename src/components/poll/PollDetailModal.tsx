import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView } from 'react-native';
import { DestinationPollOption } from '../../types/trip';
import { TripService } from '../../services/tripService';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { SlideUpModal } from '../common/SlideUpModal';
import { ShimmerImage } from '../common/ShimmerImage';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { getPlacePhotoUrl } from '../../services/googlePlaces';
import { X, CheckCircle2, MessageSquare } from 'lucide-react-native';

interface PollDetailModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PollDetailModal: React.FC<PollDetailModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const { profile } = useUser();
  const [options, setOptions] = useState<DestinationPollOption[]>([]);

  const refresh = async () => {
    const service = TripService.getInstance();
    const activeTrip = service.getActiveTrip();
    if (!activeTrip) {
      setOptions([]);
      return;
    }
    const dbPolls = await service.fetchTripPollsDB(activeTrip.id);
    setOptions(
      dbPolls.map((p) => ({
        ...p,
        isVotedByMe: p.votedUserIds.includes(profile?.id || ''),
        imagePath: p.photoReference
          ? { uri: getPlacePhotoUrl(p.photoReference, 400) }
          : p.imagePath,
      }))
    );
  };

  useEffect(() => {
    if (visible) {
      refresh();
    }
  }, [visible]);

  const handleVote = async (id: string) => {
    const service = TripService.getInstance();
    const activeTrip = service.getActiveTrip();
    if (!activeTrip) return;
    const result = await service.toggleVoteTripPollDB(id, activeTrip.id, profile?.id || '');
    if (result.length > 0) {
      setOptions(
        result.map((p) => ({
          ...p,
          isVotedByMe: p.votedUserIds.includes(profile?.id || ''),
          imagePath: p.photoReference
            ? { uri: getPlacePhotoUrl(p.photoReference, 400) }
            : p.imagePath,
        }))
      );
    }
  };

  return (
    <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.5}>
      <View
        style={{ backgroundColor: colors.paper, borderColor: colors.cardBorder }}
        className="rounded-t-3xl max-h-[85%] p-5 border-t"
      >
        <View style={{ borderColor: colors.cardBorder }} className="flex-row justify-between items-center pb-3 border-b mb-4">
          <View>
            <Text style={{ color: colors.ink }} className="text-xl font-black">Destination Poll</Text>
            <Text style={{ color: colors.inkSoft }} className="text-xs">Where are we going for our next trip?</Text>
          </View>
          <TouchableOpacity onPress={onClose} className="p-1">
            <X size={22} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="space-y-4 mb-6">
            {options.map((opt) => (
              <View
                key={opt.id}
                style={{
                  backgroundColor: colors.card,
                  borderColor: opt.isVotedByMe ? colors.tealDark : colors.cardBorder,
                }}
                className={`p-3.5 rounded-2xl border ${
                  opt.isVotedByMe ? 'shadow-sm' : ''
                }`}
              >
                <View className="flex-row items-center mb-3">
                  <ShimmerImage
                    source={opt.imagePath}
                    style={{ width: 64, height: 64, marginRight: 12 }}
                    borderRadius={12}
                    resizeMode="cover"
                  />
                  <View className="flex-1">
                    <Text style={{ color: colors.ink }} className="text-base font-bold">{opt.title}</Text>
                    <Text style={{ color: colors.tealDark }} className="text-xs font-semibold mt-0.5">
                      {opt.votes} {opt.votes === 1 ? 'vote' : 'votes'}
                    </Text>
                    {opt.leaderComment && (
                      <View className="flex-row items-center mt-1">
                        <MessageSquare size={11} color={colors.inkSoft} />
                        <Text
                          style={{ color: colors.inkSoft }}
                          className="text-xs italic ml-1 flex-1"
                          numberOfLines={1}
                        >
                          {opt.leaderComment}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleVote(opt.id)}
                  style={{
                    backgroundColor: opt.isVotedByMe ? colors.tealDark : colors.paperDim,
                    borderColor: colors.cardBorder,
                  }}
                  className="py-2 px-4 rounded-xl flex-row items-center justify-center border"
                >
                  {opt.isVotedByMe && <CheckCircle2 size={16} color="#FFFFFF" className="mr-1.5" />}
                  <Text
                    style={{ color: opt.isVotedByMe ? '#FFFFFF' : colors.ink }}
                    className="text-xs font-bold"
                  >
                    {opt.isVotedByMe ? 'Voted' : 'Vote for this Destination'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View className="mb-6">
            <PrimaryButton label="Done" onPress={onClose} />
          </View>
        </ScrollView>
      </View>
    </SlideUpModal>
  );
};
