import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import PizzaLogo from "../../components/PizzaLogo";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center mt-6">
            <PizzaLogo />
            <Text className="text-xl font-bold text-gray-900">Registration</Text>
            <Text className="text-gray-400 text-sm mt-1 mb-6">
              Enter the fields below to get started
            </Text>
          </View>

          {/* Name */}
          <Text className="text-gray-800 font-medium mb-1.5">Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter your Name"
            placeholderTextColor="#9ca3af"
            className="border border-gray-200 rounded-xl px-4 py-3.5 mb-4 text-gray-900"
          />

          {/* Email */}
          <Text className="text-gray-800 font-medium mb-1.5">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your Email"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
            className="border border-gray-200 rounded-xl px-4 py-3.5 mb-4 text-gray-900"
          />

          {/* Password */}
          <Text className="text-gray-800 font-medium mb-1.5">Password</Text>
          <View className="flex-row items-center border border-gray-200 rounded-xl px-4 mb-2">
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Create Password"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword}
              className="flex-1 py-3.5 text-gray-900"
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
              {showPassword ? (
                <EyeOff size={20} color="#9ca3af" />
              ) : (
                <Eye size={20} color="#9ca3af" />
              )}
            </TouchableOpacity>
          </View>

          {/* Remember me */}
          <TouchableOpacity
            className="flex-row items-center gap-2 mb-6"
            onPress={() => setRememberMe((v) => !v)}
          >
            <View
              className={`w-4 h-4 rounded border ${
                rememberMe ? "bg-orange-500 border-orange-500" : "border-gray-300"
              }`}
            />
            <Text className="text-gray-500 text-xs">Remember me</Text>
          </TouchableOpacity>

          {/* Sign in button */}
          <TouchableOpacity
            className="bg-orange-500 rounded-full py-4 items-center mb-6"
            activeOpacity={0.85}
          >
            <Text className="text-white font-semibold text-base">Sign in</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View className="flex-row items-center mb-6">
            <View className="flex-1 h-px bg-gray-200" />
            <Text className="text-gray-400 text-xs mx-3">Or continue with</Text>
            <View className="flex-1 h-px bg-gray-200" />
          </View>

          {/* Social buttons */}
          <View className="flex-row justify-center gap-6 mb-8">
            <SocialCircle label="G" />
            <SocialCircle label="" />
            <SocialCircle label="f" />
          </View>

          {/* Sign in link */}
          <View className="flex-row justify-center pb-6">
            <Text className="text-gray-500 text-sm">Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text className="text-orange-500 font-medium text-sm">Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SocialCircle({ label }: { label: string }) {
  return (
    <View className="w-11 h-11 rounded-full border border-gray-200 items-center justify-center">
      <Text className="text-gray-700 font-semibold">{label}</Text>
    </View>
  );
}
