import { View, Text, ImageBackground, TouchableOpacity, StatusBar } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

// Reference: swap this for your own hosted/local pizza hero image
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800";

export default function WelcomeScreen() {
  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" />
      <ImageBackground source={{ uri: HERO_IMAGE }} className="flex-1" resizeMode="cover">
        {/* Dark gradient-style overlay at the bottom for text legibility */}
        <View className="flex-1 justify-end">
          <View className="bg-black/70 px-6 pt-10 pb-8 rounded-t-[32px]">
            {/* Pagination dots */}
            <View className="flex-row gap-1.5 mb-5">
              <View className="w-2 h-2 rounded-full bg-orange-500" />
              <View className="w-2 h-2 rounded-full bg-white/30" />
              <View className="w-2 h-2 rounded-full bg-white/30" />
            </View>

            <Text className="text-white text-3xl font-bold leading-tight mb-3">
              Fresh Pizza{"\n"}Delivered Fast with{"\n"}Just One Click!
            </Text>
            <Text className="text-gray-300 text-sm mb-8">
              Your Ultimate App for Every Craving{"\n"}Any Pizza, Anytime.
            </Text>

            <TouchableOpacity
              className="bg-orange-500 rounded-full py-4 items-center"
              activeOpacity={0.85}
              onPress={() => router.push("/(auth)/login")}
            >
              <Text className="text-white font-semibold text-base">Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}
