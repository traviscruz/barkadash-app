import React, { useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
} from "react-native";
import Svg, { Path, G, Rect, Circle } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import {
  X,
  Share2,
  ImagePlus,
  Check,
  Download,
  MapPin,
  Calendar,
} from "lucide-react-native";
import { BarkadashLogo } from "../common/BarkadashLogo";
import {
  PH_PROVINCES,
  PH_VIEWBOX,
  PH_W,
  PH_H,
} from "../../services/phProvinces";
import { buildVisitedProvinceIds } from "../../services/phProvinceMatch";
import {
  getBoundaryForPlace,
  coordsToSvgPath,
} from "../../services/travelMapPolygons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface VisitedPlaceSummary {
  cityName: string;
  province?: string;
}

export interface StravaShareData {
  destination: string;
  tripTitle?: string;
  country: string;
  dateRange?: string;
  isCountry?: boolean;
  lat?: number;
  lng?: number;
  allVisitedPlaces?: VisitedPlaceSummary[];
}

interface StravaTravelShareModalProps {
  visible: boolean;
  onClose: () => void;
  data: StravaShareData | null;
}

export type StoryColor = "blue" | "red" | "yellow";

export interface ColorScheme {
  id: StoryColor;
  label: string;
  fill: string;
  stroke: string;
}

export const STORY_COLORS: Record<StoryColor, ColorScheme> = {
  blue: {
    id: "blue",
    label: "Blue",
    fill: "#1E60FF", // Royal Blue
    stroke: "rgba(30, 96, 255, 0.9)",
  },
  red: {
    id: "red",
    label: "Red",
    fill: "#E63946", // Crimson Red
    stroke: "rgba(230, 57, 70, 0.9)",
  },
  yellow: {
    id: "yellow",
    label: "Yellow",
    fill: "#FFB703", // Sun Gold Yellow
    stroke: "rgba(255, 183, 3, 0.95)",
  },
};

const PRESET_BACKGROUNDS = [
  {
    id: "beach",
    label: "Tropical Beach",
    uri: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1080&q=80",
  },
  {
    id: "islands",
    label: "Lagoon",
    uri: "https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1080&q=80",
  },
  {
    id: "mountains",
    label: "Peaks",
    uri: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1080&q=80",
  },
  {
    id: "sunset",
    label: "Golden Sunset",
    uri: "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1080&q=80",
  },
  {
    id: "chalet",
    label: "Resort",
    uri: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1080&q=80",
  },
  {
    id: "dark",
    label: "Midnight",
    uri: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1080&q=80",
  },
];

// Clean SVGs for Instagram and Facebook Story buttons
const InstagramStoryIcon = ({ size = 15, color = "#FFFFFF" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke={color} strokeWidth="2" />
    <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth="2" />
    <Circle cx="17.6" cy="6.4" r="1.3" fill={color} />
  </Svg>
);

const FacebookStoryIcon = ({ size = 15, color = "#FFFFFF" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3V2z"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const StravaTravelShareModal: React.FC<StravaTravelShareModalProps> = ({
  visible,
  onClose,
  data,
}) => {
  const cardRef = useRef<View>(null);
  const [selectedBgUri, setSelectedBgUri] = useState<string>(PRESET_BACKGROUNDS[0].uri);
  const [isCustomBg, setIsCustomBg] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedColor, setSelectedColor] = useState<StoryColor>("blue");

  // Dimensions: 9:16 Story format
  const cardWidth = Math.min(SCREEN_WIDTH * 0.82, 304);
  const cardHeight = Math.round(cardWidth * (16 / 9));

  // Small, minimalist map viewport dimensions
  const mapDisplayWidth = Math.round(cardWidth * 0.52);
  const mapDisplayHeight = Math.round(mapDisplayWidth * (PH_H / PH_W));

  // Detect whether trip is in the Philippines or outside the country
  const isPhilippines = useMemo(() => {
    if (!data) return true;
    if (data.isCountry) return true;
    const c = (data.country || "").toLowerCase().trim();
    const d = (data.destination || "").toLowerCase().trim();

    // If country is explicitly specified as a foreign nation
    if (
      c &&
      !c.includes("philippines") &&
      c !== "ph" &&
      c !== "pilipinas"
    ) {
      return false;
    }

    if (c.includes("philippines") || c === "ph" || c === "pilipinas") return true;
    if (d.includes("philippines") || d === "ph" || d === "pilipinas") return true;

    return true;
  }, [data]);

  // Build visited province IDs (used for Philippines map)
  const visitedIds = useMemo<Set<string>>(() => {
    if (!data) return new Set();
    const places =
      data.allVisitedPlaces && data.allVisitedPlaces.length > 0
        ? data.allVisitedPlaces
        : [{ cityName: data.destination }];
    return buildVisitedProvinceIds(places);
  }, [data]);

  // For places outside the Philippines: project authentic geographic vector contour
  const singlePlaceSvgPath = useMemo(() => {
    if (!data || isPhilippines) return "";
    const polygons = getBoundaryForPlace(data.destination, data.lat, data.lng);
    return coordsToSvgPath(polygons, mapDisplayWidth, mapDisplayHeight, 14);
  }, [data, isPhilippines, mapDisplayWidth, mapDisplayHeight]);

  const activeColorObj = STORY_COLORS[selectedColor];

  // Pick custom photo
  const handlePickCustomImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Please grant photo library access to pick a background.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
        allowsEditing: true,
        aspect: [9, 16],
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setSelectedBgUri(res.assets[0].uri);
        setIsCustomBg(true);
      }
    } catch (err) {
      console.warn("Image picker error:", err);
    }
  };

  // Capture Card View into a local image file URI
  const captureStoryCard = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    try {
      return await captureRef(cardRef, {
        format: "png",
        quality: 1.0,
        result: "tmpfile",
      });
    } catch (err) {
      console.warn("View shot capture error:", err);
      return null;
    }
  };

  // 1. Share on Instagram Story
  const handleShareInstagramStory = async () => {
    setIsExporting(true);
    try {
      const uri = await captureStoryCard();
      if (!uri) throw new Error("Could not capture image");

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share to Instagram Story",
          UTI: "public.png",
        });
      } else {
        await Share.share({
          message: `Traveling to ${data?.destination} with Barkadash!`,
          url: uri,
        });
      }
    } catch (err) {
      console.warn("Instagram share error:", err);
      Alert.alert("Share Story", "Could not complete sharing to Instagram.");
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Share on Facebook Story
  const handleShareFacebookStory = async () => {
    setIsExporting(true);
    try {
      const uri = await captureStoryCard();
      if (!uri) throw new Error("Could not capture image");

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share to Facebook Story",
          UTI: "public.png",
        });
      } else {
        await Share.share({
          message: `Traveling to ${data?.destination} with Barkadash!`,
          url: uri,
        });
      }
    } catch (err) {
      console.warn("Facebook share error:", err);
      Alert.alert("Share Story", "Could not complete sharing to Facebook.");
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Save Image to Photo Library
  const handleSaveImage = async () => {
    setIsExporting(true);
    try {
      const uri = await captureStoryCard();
      if (!uri) throw new Error("Could not capture image");

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please enable photo library access to save your travel story card."
        );
        return;
      }

      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(
        "Saved to Photos! 🎉",
        "Your Barkadash travel story has been saved to your camera roll."
      );
    } catch (err) {
      console.warn("Save image error:", err);
      Alert.alert("Save Error", "Failed to save image to photo library.");
    } finally {
      setIsExporting(false);
    }
  };

  // 4. More Share Options
  const handleShareMore = async () => {
    setIsExporting(true);
    try {
      const uri = await captureStoryCard();
      if (!uri) throw new Error("Could not capture image");

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Share ${data?.destination || "Travel"} Story`,
          UTI: "public.png",
        });
      } else {
        await Share.share({
          message: `Explore ${data?.destination} on Barkadash!`,
          url: uri,
        });
      }
    } catch (err) {
      console.warn("Share error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!data) return null;

  // Header Title & Clean Dates (Strictly remove "x trips logged")
  const displayTripTitle = data.tripTitle || `${data.destination} Adventure`;
  const cleanDateRange =
    data.dateRange && !data.dateRange.toLowerCase().includes("trips logged")
      ? data.dateRange
      : null;

  const cleanDestination = data.destination;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Top Bar Header */}
          <View style={[styles.topBar, { width: cardWidth }]}>
            <View>
              <Text style={styles.modalTitle}>Share Story</Text>
              <Text style={styles.modalSubtitle}>Instagram & Facebook Story</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.7}
              disabled={isExporting}
            >
              <X size={16} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {/* ══════════════════════════════════════════════ */}
          {/* ── THE 9:16 TRAVEL STORY CARD (CAPTURABLE) ── */}
          {/* ══════════════════════════════════════════════ */}
          <View
            ref={cardRef}
            collapsable={false}
            style={[styles.card, { width: cardWidth, height: cardHeight }]}
          >
            {/* Background Image */}
            <Image
              source={{ uri: selectedBgUri }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />

            {/* Dark Aesthetic Vignette & Gradient Overlays */}
            <View style={[StyleSheet.absoluteFillObject, styles.darkOverlay]} pointerEvents="none" />
            <View style={[StyleSheet.absoluteFillObject, styles.vignette]} pointerEvents="none" />

            {/* 1. TOP HEADER: Trip Title & Destination/Dates (No country above) */}
            <View style={styles.cardHeader}>
              <Text style={styles.tripTitle} numberOfLines={2}>
                {displayTripTitle}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaBadge}>
                  <MapPin size={10} color={activeColorObj.fill} strokeWidth={2.4} />
                  <Text style={styles.metaText} numberOfLines={1}>
                    {cleanDestination}
                  </Text>
                </View>

                {cleanDateRange ? (
                  <View style={styles.metaBadge}>
                    <Calendar size={10} color="rgba(255,255,255,0.85)" strokeWidth={2.4} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {cleanDateRange}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* 2. CENTER: COMPACT MINIMALIST MAP (NO BACKGROUND CONTAINER) */}
            <View
              style={[
                styles.mapContainer,
                { width: mapDisplayWidth, height: mapDisplayHeight },
              ]}
              pointerEvents="none"
            >
              {isPhilippines ? (
                /* Inside Philippines: Clean Archipelago with Visited Places Highlighted */
                <Svg
                  width={mapDisplayWidth}
                  height={mapDisplayHeight}
                  viewBox={PH_VIEWBOX}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Subtle depth contour */}
                  <G>
                    {PH_PROVINCES.map((prov) => (
                      <Path
                        key={`shadow-${prov.id}`}
                        d={prov.d}
                        fill="none"
                        stroke="rgba(0,0,0,0.38)"
                        strokeWidth={1.3}
                      />
                    ))}
                  </G>

                  {/* Minimalist provinces */}
                  <G>
                    {PH_PROVINCES.map((prov) => {
                      const visited = visitedIds.has(prov.id);

                      const fill = visited
                        ? activeColorObj.fill
                        : "rgba(255,255,255,0.18)";
                      const stroke = visited
                        ? activeColorObj.stroke
                        : "rgba(255,255,255,0.32)";
                      const strokeWidth = visited ? 0.95 : 0.45;
                      const fillOpacity = visited ? 0.98 : 0.52;

                      return (
                        <Path
                          key={prov.id}
                          d={prov.d}
                          fill={fill}
                          fillOpacity={fillOpacity}
                          stroke={stroke}
                          strokeWidth={strokeWidth}
                          strokeLinejoin="round"
                        />
                      );
                    })}
                  </G>
                </Svg>
              ) : (
                /* Outside Philippines: Old Version Authentic Vector Place Contour */
                <Svg
                  width={mapDisplayWidth}
                  height={mapDisplayHeight}
                  viewBox={`0 0 ${mapDisplayWidth} ${mapDisplayHeight}`}
                >
                  {/* Ambient Glow */}
                  <Path
                    d={singlePlaceSvgPath}
                    fill={activeColorObj.fill}
                    stroke={activeColorObj.stroke}
                    strokeWidth={6}
                    fillOpacity={0.22}
                    strokeOpacity={0.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {/* Sharp Territory Boundary */}
                  <Path
                    d={singlePlaceSvgPath}
                    fill={activeColorObj.fill}
                    stroke="#FFFFFF"
                    strokeWidth={2.4}
                    fillOpacity={0.82}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </Svg>
              )}
            </View>

            {/* 3. BOTTOM FOOTER: Just Logo & Barkadash below (No archipelago text) */}
            <View style={styles.cardFooter}>
              <View style={styles.brandRow}>
                <BarkadashLogo height={20} tintColor="#FFFFFF" />
                <Text style={styles.brandName}>Barkadash</Text>
              </View>
            </View>
          </View>

          {/* ══════════════════════════════════════════════ */}
          {/* ── STORY CONTROL CENTER & SHARING ACTIONS ── */}
          {/* ══════════════════════════════════════════════ */}
          <View style={[styles.controlTray, { width: cardWidth }]}>
            {/* 1. 3 Colors Selector (Blue, Red, Yellow) */}
            <View style={styles.colorSelectorRow}>
              {(["blue", "red", "yellow"] as StoryColor[]).map((c) => {
                const item = STORY_COLORS[c];
                const active = selectedColor === c;
                return (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setSelectedColor(c)}
                    activeOpacity={0.8}
                    style={[
                      styles.colorBtn,
                      active && {
                        borderColor: item.fill,
                        backgroundColor: `${item.fill}24`,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.colorDot,
                        { backgroundColor: item.fill },
                      ]}
                    />
                    <Text
                      style={[
                        styles.colorBtnText,
                        active && { color: "#FFFFFF", fontWeight: "800" },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 2. Photo Background Selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.swatchRow}
            >
              <TouchableOpacity
                onPress={handlePickCustomImage}
                activeOpacity={0.8}
                style={[
                  styles.uploadBtn,
                  isCustomBg && { borderColor: activeColorObj.fill },
                ]}
              >
                <ImagePlus size={13} color="#FFFFFF" />
                <Text style={styles.uploadText}>Custom</Text>
              </TouchableOpacity>

              {PRESET_BACKGROUNDS.map((p) => {
                const active = !isCustomBg && selectedBgUri === p.uri;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => {
                      setSelectedBgUri(p.uri);
                      setIsCustomBg(false);
                    }}
                    activeOpacity={0.8}
                    style={[
                      styles.presetBtn,
                      active && { borderColor: activeColorObj.fill, borderWidth: 2 },
                    ]}
                  >
                    <Image source={{ uri: p.uri }} style={styles.presetImg} />
                    {active && (
                      <View
                        style={[
                          styles.presetCheck,
                          { backgroundColor: `${activeColorObj.fill}B3` },
                        ]}
                      >
                        <Check size={9} color="#FFF" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 3. Action Buttons: Instagram Story, Facebook Story, Save Image */}
            <View style={styles.actionGrid}>
              {/* Instagram Story Button */}
              <TouchableOpacity
                onPress={handleShareInstagramStory}
                activeOpacity={0.85}
                disabled={isExporting}
                style={[styles.storyShareBtn, styles.igBtn]}
              >
                <InstagramStoryIcon size={14} color="#FFFFFF" />
                <Text style={styles.storyBtnText}>Instagram</Text>
              </TouchableOpacity>

              {/* Facebook Story Button */}
              <TouchableOpacity
                onPress={handleShareFacebookStory}
                activeOpacity={0.85}
                disabled={isExporting}
                style={[styles.storyShareBtn, styles.fbBtn]}
              >
                <FacebookStoryIcon size={14} color="#FFFFFF" />
                <Text style={styles.storyBtnText}>Facebook</Text>
              </TouchableOpacity>

              {/* Save Image to Camera Roll Button */}
              <TouchableOpacity
                onPress={handleSaveImage}
                activeOpacity={0.85}
                disabled={isExporting}
                style={[styles.storyShareBtn, styles.saveBtn]}
              >
                <Download size={13} color="#FFFFFF" strokeWidth={2.4} />
                <Text style={styles.storyBtnText}>Save</Text>
              </TouchableOpacity>

              {/* More System Share */}
              <TouchableOpacity
                onPress={handleShareMore}
                activeOpacity={0.85}
                disabled={isExporting}
                style={[styles.storyShareBtn, styles.moreBtn]}
              >
                {isExporting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Share2 size={13} color="#FFFFFF" strokeWidth={2.4} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
  },
  modalContent: {
    alignItems: "center",
    gap: 8,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
    paddingHorizontal: 2,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Share Card (9:16) ──
  card: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#0B0F19",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 16,
  },
  darkOverlay: {
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  vignette: {
    backgroundColor: "rgba(0,0,0,0.22)",
  },

  // Card Top Header
  cardHeader: {
    zIndex: 10,
    width: "100%",
    alignItems: "center",
    paddingTop: 22,
    paddingHorizontal: 16,
    gap: 6,
  },
  tripTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: -0.3,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 5,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 1,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3.5,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "rgba(255,255,255,0.16)",
  },
  metaText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // Center Small Minimalist Map (Transparent, No background container)
  mapContainer: {
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  // Card Bottom Footer
  cardFooter: {
    zIndex: 10,
    width: "100%",
    alignItems: "center",
    paddingBottom: 20,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandName: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: -0.2,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ── Bottom Control Tray ──
  controlTray: {
    gap: 7,
    marginTop: 2,
  },

  // 3 Colors Selector (Blue, Red, Yellow)
  colorSelectorRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between",
  },
  colorBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  colorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  colorBtnText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 10,
    fontWeight: "600",
  },

  // Photo Background Selector
  swatchRow: {
    gap: 6,
    alignItems: "center",
    paddingVertical: 1,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 9,
    paddingVertical: 5.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  uploadText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 10,
  },
  presetBtn: {
    width: 29,
    height: 29,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.22)",
  },
  presetImg: {
    width: "100%",
    height: "100%",
  },
  presetCheck: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },

  // Story Action Buttons
  actionGrid: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  storyShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4.5,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  storyBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: -0.1,
  },
  igBtn: {
    flex: 1.2,
    backgroundColor: "rgba(225, 48, 108, 0.85)",
    borderColor: "rgba(225, 48, 108, 0.95)",
  },
  fbBtn: {
    flex: 1.2,
    backgroundColor: "rgba(24, 119, 242, 0.85)",
    borderColor: "rgba(24, 119, 242, 0.95)",
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.25)",
  },
  moreBtn: {
    width: 36,
    paddingHorizontal: 0,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.2)",
  },
});
