import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  Linking,
  RefreshControl,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  ArrowUpDown,
  Search,
  CalendarDays,
  Clock,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Info,
} from "lucide-react-native";
import { useResponsive } from "../../utils/responsive";
import { useTheme } from "../../context/ThemeContext";
import { FlightAirport } from "../../services/flightapiService";
import {
  searchFlightsUnified,
  resolveBookingUrl,
  FlightResult,
  UnifiedSearchParams,
} from "../../services/flightSearchProvider";
import { AirportAutocompleteInput } from "./AirportAutocompleteInput";

interface FlightTabProps {
  accentColor: string;
  onScrollDirection?: (direction: "up" | "down") => void;
}

const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

const formatTime = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  let h = d.getHours();
  const min = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
};

const formatDuration = (minutes: number): string => {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// Friendly tier label shown in the badge
const TIER_LABEL: Record<number, string> = {
  1: "ignav · PR/5J",
  2: "ignav",
  3: "flightapi.io",
};

export const FlightTab: React.FC<FlightTabProps> = ({ accentColor, onScrollDirection }) => {
  const { colors, isDark } = useTheme();
  const { sp, icon, bottomNavOffset } = useResponsive();
  const lastOffsetY = useRef(0);

  const [from, setFrom] = useState<FlightAirport | null>(null);
  const [to, setTo] = useState<FlightAirport | null>(null);
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flights, setFlights] = useState<FlightResult[]>([]);
  const [tier, setTier] = useState<1 | 2 | 3>(1);
  const [noPriority, setNoPriority] = useState(false);
  const [error, setError] = useState("");
  const [bookingLoadingId, setBookingLoadingId] = useState<string | null>(null);

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
  };

  const onAndroidDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowAndroidPicker(false);
    if (event.type === "set" && selected) setDate(selected);
  };

  const handleSearch = async () => {
    if (!from || !to) {
      setError("Pick both an origin and a destination airport first.");
      return;
    }
    setLoading(true);
    setError("");
    setFlights([]);
    setNoPriority(false);

    const params: UnifiedSearchParams = {
      originCode: from.code,
      destinationCode: to.code,
      date: toISODate(date),
      adults: 1,
      currency: "PHP",
      limit: 10,
    };

    const res = await searchFlightsUnified(params);
    setLoading(false);

    if (res.error === "no-key") {
      setError("Flight API key is missing — check your .env.local file.");
      return;
    }
    if (res.error === "rate-limited") {
      setError("Rate limit reached — wait a minute and try again.");
      return;
    }
    if (res.error === "forbidden") {
      setError("API key rejected — check your dashboard.");
      return;
    }
    if (res.error || res.results.length === 0) {
      setError(
        "No flights found for that route and date. Try another date or a different route."
      );
      return;
    }

    setFlights(res.results);
    setTier(res.tier);
    setNoPriority(res.noPriorityFlights);
  };

  const openBooking = async (f: FlightResult) => {
    try {
      setBookingLoadingId(f.id);
      const url = await resolveBookingUrl(f);
      if (!url) {
        setError("No booking link available for this flight.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      setError("Couldn\u2019t open the booking link.");
    } finally {
      setBookingLoadingId(null);
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={handleSearch}
          tintColor={accentColor}
          colors={[accentColor]}
        />
      }
      onScroll={(e) => {
        const currentY = e.nativeEvent.contentOffset.y;
        const delta = currentY - lastOffsetY.current;
        lastOffsetY.current = currentY;
        if (currentY < 15) onScrollDirection?.("up");
        else if (delta > 2) onScrollDirection?.("down");
        else if (delta < -2) onScrollDirection?.("up");
      }}
      scrollEventThrottle={16}
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: sp.lg,
        paddingBottom: bottomNavOffset + 24,
      }}
    >
      <Text
        style={{
          fontSize: 12.5,
          fontWeight: "700",
          color: colors.inkSoft,
          marginBottom: sp.md,
          lineHeight: 18,
        }}
      >
        Compare one-way flight prices between any two airports or cities.
      </Text>

      <View style={{ gap: sp.md }}>
        <AirportAutocompleteInput
          label="From"
          placeholder="e.g. Manila"
          accentColor={accentColor}
          value={from ? from.title : ""}
          onSelect={setFrom}
        />

        <View style={{ alignItems: "center", marginVertical: -2 }}>
          <TouchableOpacity
            onPress={handleSwap}
            activeOpacity={0.8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.card,
              borderWidth: 1.5,
              borderColor: accentColor,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowUpDown size={18} color={accentColor} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <AirportAutocompleteInput
          label="To"
          placeholder="e.g. Cebu"
          accentColor={accentColor}
          value={to ? to.title : ""}
          onSelect={setTo}
        />

        {/* Date picker */}
        <View>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              color: colors.inkSoft,
              marginBottom: 6,
            }}
          >
            Depart date
          </Text>
          {Platform.OS === "android" ? (
            showAndroidPicker ? (
              <DateTimePicker
                value={date}
                mode="date"
                minimumDate={new Date()}
                onChange={onAndroidDateChange}
              />
            ) : (
              <TouchableOpacity
                onPress={() => setShowAndroidPicker(true)}
                activeOpacity={0.8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: colors.card,
                  borderWidth: 1.5,
                  borderColor: colors.cardBorder,
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                }}
              >
                <CalendarDays size={16} color={accentColor} strokeWidth={2.2} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.ink }}>
                  {date.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </TouchableOpacity>
            )
          ) : (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <DateTimePicker
                value={date}
                mode="date"
                minimumDate={new Date()}
                display="spinner"
                onChange={(_e, d) => {
                  if (d) setDate(d);
                }}
                style={{ width: 320, height: 140 }}
              />
            </View>
          )}
        </View>
      </View>

      {/* Search button */}
      <TouchableOpacity
        onPress={handleSearch}
        disabled={loading}
        activeOpacity={0.85}
        style={{
          marginTop: sp.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: accentColor,
          borderRadius: 18,
          paddingVertical: 15,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Search size={icon.md} color="#FFFFFF" strokeWidth={2.4} />
        )}
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: "900",
            letterSpacing: -0.2,
          }}
        >
          {loading ? "Searching\u2026" : "Search flights"}
        </Text>
      </TouchableOpacity>

      {/* Error state */}
      {error ? (
        <View
          style={{
            marginTop: sp.lg,
            backgroundColor: colors.lightRedBg,
            borderRadius: 16,
            padding: 14,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: colors.redAccent,
              textAlign: "center",
            }}
          >
            {error}
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: colors.redAccent,
              textAlign: "center",
              marginTop: 6,
              opacity: 0.8,
            }}
          >
            If all providers fail, try a different route or date.
          </Text>
        </View>
      ) : null}

      {/* Results */}
      {flights.length > 0 && (
        <View style={{ marginTop: sp.xl }}>
          {/* Header row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: sp.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "900",
                  color: colors.ink,
                  letterSpacing: -0.3,
                }}
              >
                {flights.length} {flights.length === 1 ? "flight" : "flights"}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: colors.inkSoft,
                  marginTop: 1,
                }}
                numberOfLines={1}
              >
                {from?.title} \u2192 {to?.title}
              </Text>
            </View>
            {/* Provider badge */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: colors.lightBlueBg,
                borderRadius: 100,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Sparkles size={10} color={colors.tealAccent} />
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "800",
                  color: colors.tealAccent,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {TIER_LABEL[tier] ?? "ignav"}
              </Text>
            </View>
          </View>

          {/* No-priority-airlines notice */}
          {noPriority && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: colors.lightOrangeBg,
                borderRadius: 14,
                padding: 12,
                marginBottom: sp.md,
              }}
            >
              <Info size={14} color={colors.orangeAccent} strokeWidth={2.4} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 11.5,
                  fontWeight: "700",
                  color: colors.orangeAccent,
                  lineHeight: 16,
                }}
              >
                No PAL or Cebu Pacific flights found for this route/date. Showing
                other available airlines.
              </Text>
            </View>
          )}

          {/* Flight cards */}
          <View style={{ gap: sp.md }}>
            {flights.map((f) => (
              <View
                key={f.id}
                style={{
                  backgroundColor: colors.card,
                  borderColor: f.isPriority ? accentColor : colors.cardBorder,
                  borderWidth: f.isPriority ? 2 : 1,
                  borderRadius: 20,
                  padding: 16,
                }}
              >
                {/* Priority ribbon */}
                {f.isPriority && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      backgroundColor: accentColor,
                      borderTopRightRadius: 18,
                      borderBottomLeftRadius: 12,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 8.5,
                        fontWeight: "900",
                        color: isDark ? "#121212" : "#FFFFFF",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {f.airlineCode === "PR" ? "PAL" : "Cebu Pacific"}
                    </Text>
                  </View>
                )}

                {/* Airline + price row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      flex: 1,
                    }}
                  >
                    {f.logo ? (
                      <Image
                        source={{ uri: f.logo }}
                        style={{ width: 30, height: 30, borderRadius: 8 }}
                        resizeMode="contain"
                      />
                    ) : (
                      <View
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          backgroundColor: `${accentColor}22`,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "900",
                            color: accentColor,
                          }}
                        >
                          {(f.airline[0] || "?").toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "800",
                          color: colors.ink,
                        }}
                        numberOfLines={1}
                      >
                        {f.airline}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: colors.inkSoft,
                          marginTop: 1,
                          textTransform: "uppercase",
                          letterSpacing: 0.3,
                        }}
                      >
                        {f.airlineCode}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: "900",
                      color: accentColor,
                      letterSpacing: -0.4,
                    }}
                  >
                    {f.priceFormatted}
                  </Text>
                </View>

                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.rule,
                    marginVertical: 14,
                  }}
                />

                {/* Depart / duration / arrive */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 21,
                        fontWeight: "900",
                        color: colors.ink,
                        letterSpacing: -0.8,
                      }}
                    >
                      {formatTime(f.departTime)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: colors.inkSoft,
                        marginTop: 2,
                        letterSpacing: 1,
                      }}
                    >
                      {from?.code ?? ""}
                    </Text>
                  </View>

                  <View style={{ flex: 1.2, alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Clock size={11} color={colors.inkSoft} />
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontWeight: "700",
                          color: colors.inkSoft,
                        }}
                      >
                        {formatDuration(f.durationMinutes)}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 4,
                        width: "100%",
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          height: 1.5,
                          backgroundColor: colors.cardBorder,
                        }}
                      />
                      <ArrowRight size={14} color={accentColor} strokeWidth={2.4} />
                      <View
                        style={{
                          flex: 1,
                          height: 1.5,
                          backgroundColor: colors.cardBorder,
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: colors.inkSoft,
                        marginTop: 4,
                        letterSpacing: 0.3,
                      }}
                    >
                      {f.stops === 0
                        ? "NON-STOP"
                        : `${f.stops} ${f.stops === 1 ? "STOP" : "STOPS"}`}
                    </Text>
                  </View>

                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text
                      style={{
                        fontSize: 21,
                        fontWeight: "900",
                        color: colors.ink,
                        letterSpacing: -0.8,
                      }}
                    >
                      {formatTime(f.arriveTime)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: colors.inkSoft,
                        marginTop: 2,
                        letterSpacing: 1,
                      }}
                    >
                      {to?.code ?? ""}
                    </Text>
                  </View>
                </View>

                {/* Book button */}
                {f.bookingUrl ? (
                  <TouchableOpacity
                    onPress={() => openBooking(f)}
                    disabled={bookingLoadingId === f.id}
                    activeOpacity={0.85}
                    style={{
                      marginTop: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      backgroundColor: accentColor,
                      borderRadius: 14,
                      paddingVertical: 12,
                      opacity: bookingLoadingId === f.id ? 0.75 : 1,
                    }}
                  >
                    {bookingLoadingId === f.id ? (
                      <ActivityIndicator
                        size="small"
                        color={isDark ? colors.paper : "#FFFFFF"}
                      />
                    ) : (
                      <>
                        <ExternalLink
                          size={14}
                          color={isDark ? colors.paper : "#FFFFFF"}
                          strokeWidth={2.4}
                        />
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "900",
                            color: isDark ? colors.paper : "#FFFFFF",
                            letterSpacing: -0.2,
                          }}
                        >
                          {f.bookingLabel}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View
                    style={{
                      marginTop: 14,
                      backgroundColor: colors.paperDim,
                      borderRadius: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: colors.inkSoft,
                        textAlign: "center",
                      }}
                    >
                      No direct booking link available for this flight.
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Disclaimer */}
          <Text
            style={{
              fontSize: 10.5,
              fontWeight: "600",
              color: colors.inkSoft,
              textAlign: "center",
              marginTop: sp.md,
              lineHeight: 15,
            }}
          >
            Prices are indicative and may change on the airline\u2019s site.
            {tier === 3 ? " Powered by flightapi.io." : " Powered by Ignav."}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};
