import { View, Text } from "react-native";
import { Pizza } from "lucide-react-native";

// Simple stand-in for the speech-bubble pizza logo in the design.
// Swap this for your real logo asset (SVG/PNG) when you have one.
export default function PizzaLogo() {
  return (
    <View className="items-center mb-6">
      <View className="w-20 h-20 rounded-full border-2 border-orange-500 items-center justify-center">
        <Pizza color="#f97316" size={36} />
      </View>
      <Text className="text-orange-500 font-bold text-xs mt-1 tracking-widest">
        PEPPINO
      </Text>
    </View>
  );
}
