import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView } from 'react-native';
import { DestinationPollOption } from '../../types/trip';
import { TripService } from '../../services/tripService';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { SlideUpModal } from '../common/SlideUpModal';
import { X, CheckCircle2, MessageSquare } from 'lucide-react-native';

interface PollDetailModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PollDetailModal: React.FC<PollDetailModalProps> = ({ visible, onClose }) => {
  const [options, setOptions] = useState<DestinationPollOption[]>([]);

  useEffect(() => {
    const service = TripService.getInstance();
    setOptions(service.getPollOptions());
    return service.subscribe(() => {
      setOptions(service.getPollOptions());
    });
  }, [visible]);

  const handleVote = (id: string) => {
    TripService.getInstance().voteDestination(id);
  };

  return (
    <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.5}>
      <View className="bg-paper rounded-t-3xl max-h-[85%] p-5 border-t border-rule">
        <View className="flex-row justify-between items-center pb-3 border-b border-rule mb-4">
          <View>
            <Text className="text-xl font-black text-ink">Destination Poll</Text>
            <Text className="text-xs text-inkSoft">Where are we going for our next trip?</Text>
          </View>
          <TouchableOpacity onPress={onClose} className="p-1">
            <X size={22} color="#1A1D2D" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="space-y-4 mb-6">
            {options.map((opt) => (
              <View
                key={opt.id}
                className={`p-3.5 bg-white rounded-2xl border ${
                  opt.isVotedByMe ? 'border-[#1F4E67] shadow-sm' : 'border-rule'
                }`}
              >
                <View className="flex-row items-center mb-3">
                  <Image
                    source={opt.imagePath}
                    className="w-16 h-16 rounded-xl mr-3 bg-paperDim"
                    resizeMode="cover"
                  />
                  <View className="flex-1">
                    <Text className="text-base font-bold text-ink">{opt.title}</Text>
                    <Text className="text-xs font-semibold text-[#1F4E67] mt-0.5">
                      {opt.votes} {opt.votes === 1 ? 'vote' : 'votes'}
                    </Text>
                    {opt.leaderComment && (
                      <View className="flex-row items-center mt-1">
                        <MessageSquare size={11} color="#6E738A" />
                        <Text
                          className="text-xs text-inkSoft italic ml-1 flex-1"
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
                  className={`py-2 px-4 rounded-xl flex-row items-center justify-center ${
                    opt.isVotedByMe ? 'bg-[#1F4E67]' : 'bg-paperDim border border-rule'
                  }`}
                >
                  {opt.isVotedByMe && <CheckCircle2 size={16} color="#FFFFFF" className="mr-1.5" />}
                  <Text
                    className={`text-xs font-bold ${
                      opt.isVotedByMe ? 'text-white' : 'text-ink'
                    }`}
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
