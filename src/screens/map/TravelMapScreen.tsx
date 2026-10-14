import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Platform,
  UIManager,
  LayoutAnimation,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { useResponsive } from '../../utils/responsive';
import {
  TravelMapService,
  TravelMapData,
  VisitedPlace,
} from '../../services/travelMapService';
import {
  ArrowLeft,
  Globe,
  MapPin,
  Compass,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  X,
  RefreshCw,
  Building,
  Layers,
  Share2,
} from 'lucide-react-native';
import {
  StravaTravelShareModal,
  StravaShareData,
} from '../../components/map/StravaTravelShareModal';

interface TravelMapScreenProps {
  onBack: () => void;
}

type MapStyle = 'streets' | 'dark' | 'satellite';

const detectPlaceIslandGroup = (
  cityName: string,
  province?: string,
  lat?: number
): 'luzon' | 'visayas' | 'mindanao' => {
  const p = (province || cityName || '').toLowerCase();
  if (
    p.includes('visayas') ||
    p.includes('cebu') ||
    p.includes('bohol') ||
    p.includes('aklan') ||
    p.includes('boracay') ||
    p.includes('iloilo') ||
    p.includes('negros') ||
    p.includes('samar') ||
    p.includes('leyte') ||
    p.includes('antique') ||
    p.includes('capiz') ||
    p.includes('guimaras') ||
    p.includes('siquijor') ||
    p.includes('biliran')
  ) {
    return 'visayas';
  }
  if (
    p.includes('mindanao') ||
    p.includes('davao') ||
    p.includes('siargao') ||
    p.includes('surigao') ||
    p.includes('bukidnon') ||
    p.includes('camiguin') ||
    p.includes('zamboanga') ||
    p.includes('misamis') ||
    p.includes('cagayan de oro') ||
    p.includes('cdo') ||
    p.includes('cotabato') ||
    p.includes('sarangani') ||
    p.includes('sultan kudarat') ||
    p.includes('basilan') ||
    p.includes('sulu') ||
    p.includes('tawi') ||
    p.includes('agusan') ||
    p.includes('lanao') ||
    p.includes('maguindanao')
  ) {
    return 'mindanao';
  }
  if (lat !== undefined) {
    if (lat < 9.5) return 'mindanao';
    if (lat < 12.2) return 'visayas';
    return 'luzon';
  }
  return 'luzon';
};

const ISLAND_THEME_INFO = {
  luzon: { label: 'Luzon', color: '#1E60FF', bg: 'rgba(30, 96, 255, 0.14)' },
  visayas: { label: 'Visayas', color: '#E63946', bg: 'rgba(230, 57, 70, 0.14)' },
  mindanao: { label: 'Mindanao', color: '#FFB703', bg: 'rgba(255, 183, 3, 0.16)' },
};

export const TravelMapScreen: React.FC<TravelMapScreenProps> = ({ onBack }) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { sp, fs } = useResponsive();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);

  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'completed' | 'all'>('completed');
  const [mapStyle, setMapStyle] = useState<MapStyle>(isDark ? 'dark' : 'streets');
  const [mapData, setMapData] = useState<TravelMapData>({
    totalTripsCount: 0,
    completedTripsCount: 0,
    countriesCount: 0,
    placesCount: 0,
    totalSpotsCount: 0,
    countries: [],
    places: [],
  });

  const [selectedPlace, setSelectedPlace] = useState<VisitedPlace | null>(null);
  const [detailModalPlace, setDetailModalPlace] = useState<VisitedPlace | null>(null);
  const [isPlacesCollapsed, setIsPlacesCollapsed] = useState(false);
  const [shareModalData, setShareModalData] = useState<StravaShareData | null>(null);

  const togglePlacesCollapse = () => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsPlacesCollapsed((prev) => !prev);
  };

  const handleSharePlace = (place: VisitedPlace) => {
    setShareModalData({
      destination: place.cityName,
      tripTitle: place.tripTitle,
      country: place.country || 'Philippines',
      dateRange: place.dateRange,
      lat: place.lat,
      lng: place.lng,
      isCountry: false,
      allVisitedPlaces: [{ cityName: place.cityName, province: place.province }],
    });
  };

  const handleShareWholeCountry = () => {
    setShareModalData({
      destination: 'Philippines',
      tripTitle: 'Philippine Archipelago',
      country: 'Philippines',
      dateRange: undefined,
      isCountry: true,
      allVisitedPlaces: mapData.places.map((p) => ({ cityName: p.cityName, province: p.province })),
    });
  };

  const loadData = async (mode: 'completed' | 'all' = filterMode) => {
    setLoading(true);
    try {
      const data = await TravelMapService.getInstance().fetchTravelMapData(profile?.id, mode);
      setMapData(data);
      if (data.places.length > 0 && !selectedPlace) {
        setSelectedPlace(data.places[0]);
      }
    } catch (err) {
      console.warn('Failed to load travel map data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(filterMode);
  }, [filterMode, profile?.id]);

  // Update map style in WebView
  const handleSwitchMapStyle = (newStyle: MapStyle) => {
    setMapStyle(newStyle);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.setMapStyle) { window.setMapStyle('${newStyle}'); } true;`);
    }
  };

  // Fly camera to World View
  const handleWorldView = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.map) { window.map.flyTo([15, 115], 2.2, { duration: 1.2 }); } true;`);
    }
  };

  // Fly camera to Philippines
  const handleFocusPhilippines = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.map) { window.map.flyTo([12.8797, 121.7740], 6, { duration: 1.2 }); } true;`);
    }
  };

  // Fly camera to Luzon (Blue)
  const handleFocusLuzon = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.map) { window.map.flyTo([16.0, 121.0], 6.5, { duration: 1.2 }); } true;`);
    }
  };

  // Fly camera to Visayas (Red)
  const handleFocusVisayas = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.map) { window.map.flyTo([10.8, 123.5], 7.2, { duration: 1.2 }); } true;`);
    }
  };

  // Fly camera to Mindanao (Yellow)
  const handleFocusMindanao = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`if (window.map) { window.map.flyTo([7.8, 125.0], 6.8, { duration: 1.2 }); } true;`);
    }
  };

  // Fly camera to specific place & highlight its territory
  const handleSelectPlaceCard = (place: VisitedPlace) => {
    setSelectedPlace(place);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (window.focusPlace) { window.focusPlace('${place.id}', ${place.lat}, ${place.lng}); } true;`
      );
    }
  };

  // Zoom In / Out controls
  const handleZoom = (delta: number) => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(
        `if (window.map) { window.map.setZoom(window.map.getZoom() + ${delta}); } true;`
      );
    }
  };

  // Receive marker / polygon click events from Leaflet WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'MARKER_CLICK') {
        const found = mapData.places.find((p) => p.id === msg.placeId);
        if (found) {
          setSelectedPlace(found);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  // Construct Leaflet HTML with authentic boundaries and minimal styling
  const leafletHtml = useMemo(() => {
    const placesJson = JSON.stringify(
      mapData.places.map((p) => ({
        id: p.id,
        name: p.cityName,
        tripTitle: p.tripTitle,
        lat: p.lat,
        lng: p.lng,
        spotsCount: p.spotsCount,
        country: p.country,
        countryCode: p.countryCode,
        island: detectPlaceIslandGroup(p.cityName, p.province, p.lat),
      }))
    );

    const initialLat = mapData.places.length > 0 ? mapData.places[0].lat : 12.8797;
    const initialLng = mapData.places.length > 0 ? mapData.places[0].lng : 121.7740;
    const initialZoom = mapData.places.length > 0 ? 6 : 4;
    const initialStyle = mapStyle;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body, #map { width: 100%; height: 100%; background: ${isDark ? '#121212' : '#FAF8F5'}; }
          .leaflet-control-attribution { display: none !important; }
          .leaflet-bar { border: none !important; box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important; }
          .leaflet-bar a {
            background-color: ${isDark ? '#1C1C1E' : '#FFFFFF'} !important;
            color: ${isDark ? '#F2F2F7' : '#1A1D2D'} !important;
            border-bottom: 1px solid ${isDark ? '#2C2C2E' : '#EAE4D7'} !important;
          .place-territory {
            cursor: pointer;
            transition: fill-opacity 0.25s ease, stroke-width 0.25s ease;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          var map = L.map('map', {
            zoomControl: false,
            attributionControl: false
          }).setView([${initialLat}, ${initialLng}], ${initialZoom});

          window.map = map;
          window.currentTileLayer = null;
          window.currentRefLayer = null;

          // Free Open Esri Real World Map Tile Providers (100% Free, NO API KEY)
          window.setMapStyle = function(style) {
            if (window.currentTileLayer) {
              map.removeLayer(window.currentTileLayer);
            }
            if (window.currentRefLayer) {
              map.removeLayer(window.currentRefLayer);
              window.currentRefLayer = null;
            }

            if (style === 'dark') {
              window.currentTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 18
              }).addTo(map);
              window.currentRefLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 18
              }).addTo(map);
            } else if (style === 'satellite') {
              window.currentTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 18
              }).addTo(map);
            } else {
              window.currentTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 18
              }).addTo(map);
            }
          };

          window.setMapStyle('${initialStyle}');

          // Real, authentic geographic administrative boundaries (NOT squares)
          var REAL_POLYGONS = {
            manila: [
              [14.6011, 120.7917], [14.5856, 120.7935], [14.5784, 120.8184], [14.5708, 120.8472],
              [14.5607, 120.8816], [14.5578, 120.8936], [14.5508, 120.9103], [14.5520, 120.9237],
              [14.5569, 120.9799], [14.5579, 120.9841], [14.5587, 120.9872], [14.5591, 120.9885],
              [14.5602, 120.9929], [14.5612, 120.9970], [14.5617, 120.9987], [14.5623, 120.9994],
              [14.5636, 121.0007], [14.5651, 121.0022], [14.5670, 121.0042], [14.5684, 121.0055],
              [14.5701, 121.0072], [14.5728, 121.0099], [14.5750, 121.0122], [14.5770, 121.0142],
              [14.5794, 121.0165], [14.5806, 121.0171], [14.5825, 121.0185], [14.5847, 121.0201],
              [14.5888, 121.0227], [14.5916, 121.0240], [14.5941, 121.0262], [14.5975, 121.0249],
              [14.6010, 121.0213], [14.6044, 121.0176], [14.6072, 121.0140], [14.6116, 121.0081],
              [14.6151, 121.0036], [14.6193, 120.9979], [14.6241, 120.9918], [14.6305, 120.9912],
              [14.6369, 120.9903], [14.6383, 120.9859], [14.6367, 120.9826], [14.6381, 120.9815],
              [14.6390, 120.9807], [14.6371, 120.9794], [14.6356, 120.9743], [14.6356, 120.9636],
              [14.6342, 120.9586], [14.6346, 120.9533], [14.6395, 120.8395], [14.6247, 120.8297],
              [14.6167, 120.8208], [14.6111, 120.8086], [14.6011, 120.7917]
            ],
            metromanila: [
              [14.7600, 120.9850], [14.7500, 121.0400], [14.7300, 121.0850], [14.6900, 121.1300],
              [14.6400, 121.1400], [14.5900, 121.1200], [14.5300, 121.0850], [14.4700, 121.0500],
              [14.3800, 121.0400], [14.4100, 120.9850], [14.4700, 120.9650], [14.5300, 120.9800],
              [14.5900, 120.9700], [14.6600, 120.9500], [14.7200, 120.9500], [14.7600, 120.9850]
            ],
            baguio: [
              [16.4343, 120.5448], [16.4286, 120.5469], [16.4221, 120.5495], [16.4177, 120.5511],
              [16.4133, 120.5527], [16.4090, 120.5544], [16.4023, 120.5569], [16.3975, 120.5588],
              [16.3915, 120.5609], [16.3817, 120.5646], [16.3776, 120.5662], [16.3731, 120.5680],
              [16.3719, 120.5691], [16.3714, 120.5723], [16.3709, 120.5746], [16.3702, 120.5783],
              [16.3667, 120.5981], [16.3657, 120.6037], [16.3652, 120.6068], [16.3643, 120.6112],
              [16.3628, 120.6197], [16.3606, 120.6321], [16.3670, 120.6333], [16.3715, 120.6340],
              [16.3754, 120.6346], [16.3801, 120.6355], [16.3891, 120.6341], [16.3955, 120.6332],
              [16.4027, 120.6322], [16.4100, 120.6312], [16.4168, 120.6305], [16.4227, 120.6305],
              [16.4285, 120.6305], [16.4285, 120.6272], [16.4285, 120.6219], [16.4293, 120.6158],
              [16.4304, 120.6082], [16.4312, 120.6026], [16.4318, 120.5985], [16.4318, 120.5926],
              [16.4319, 120.5882], [16.4319, 120.5842], [16.4323, 120.5765], [16.4329, 120.5664],
              [16.4334, 120.5583], [16.4338, 120.5520], [16.4343, 120.5448]
            ],
            boracay: [
              [11.9991, 121.9253], [11.9993, 121.9231], [11.9993, 121.9214], [11.9987, 121.9205],
              [11.9979, 121.9199], [11.9970, 121.9191], [11.9965, 121.9171], [11.9961, 121.9157],
              [11.9955, 121.9136], [11.9945, 121.9115], [11.9937, 121.9101], [11.9922, 121.9082],
              [11.9905, 121.9061], [11.9892, 121.9054], [11.9881, 121.9050], [11.9830, 121.9065],
              [11.9750, 121.9100], [11.9680, 121.9125], [11.9600, 121.9140], [11.9540, 121.9155],
              [11.9480, 121.9180], [11.9440, 121.9220], [11.9470, 121.9260], [11.9540, 121.9290],
              [11.9620, 121.9315], [11.9700, 121.9330], [11.9780, 121.9350], [11.9830, 121.9360],
              [11.9890, 121.9340], [11.9942, 121.9295], [11.9974, 121.9268], [11.9991, 121.9253]
            ],
            cebu: [
              [10.3850, 123.8650], [10.3950, 123.8900], [10.3800, 123.9250], [10.3600, 123.9450],
              [10.3350, 123.9480], [10.3100, 123.9450], [10.2900, 123.9150], [10.2800, 123.8800],
              [10.2850, 123.8500], [10.3000, 123.8200], [10.3300, 123.8350], [10.3600, 123.8450],
              [10.3850, 123.8650]
            ],
            siargao: [
              [10.0300, 126.0400], [10.0100, 126.1100], [9.9500, 126.1500], [9.8700, 126.1600],
              [9.7700, 126.1400], [9.7500, 126.0600], [9.8000, 125.9900], [9.8800, 125.9700],
              [9.9600, 125.9900], [10.0300, 126.0400]
            ],
            tagaytay: [
              [14.1620, 120.9120], [14.1680, 120.9450], [14.1650, 120.9850], [14.1550, 121.0150],
              [14.1350, 121.0180], [14.1100, 121.0050], [14.0950, 120.9750], [14.0900, 120.9350],
              [14.1050, 120.9050], [14.1350, 120.9000], [14.1620, 120.9120]
            ],
            elnido: [
              [11.3300, 119.3800], [11.3300, 119.4500], [11.3100, 119.5100], [11.2500, 119.5300],
              [11.1800, 119.5200], [11.1500, 119.4600], [11.1600, 119.4000], [11.2000, 119.3600],
              [11.2600, 119.3500], [11.3300, 119.3800]
            ],
            coron: [
              [12.2200, 119.8600], [12.2400, 120.0500], [12.2100, 120.2400], [12.1200, 120.2800],
              [12.0200, 120.2500], [11.9800, 120.1500], [12.0100, 119.9500], [12.0800, 119.8600],
              [12.2200, 119.8600]
            ]
          };

          function generateOrganicBoundary(lat, lng) {
            var pts = [];
            var steps = 16;
            var baseR = 0.045;
            for (var i = 0; i < steps; i++) {
              var angle = (i / steps) * Math.PI * 2;
              var variance = 1 + 0.22 * Math.sin(3 * angle) + 0.15 * Math.cos(5 * angle);
              var r = baseR * variance;
              var dLat = Math.sin(angle) * r;
              var dLng = (Math.cos(angle) * r) / Math.cos(lat * Math.PI / 180);
              pts.push([lat + dLat, lng + dLng]);
            }
            return pts;
          }

          function getRealPolygonForPlace(place) {
            var raw = (place.name || '').toLowerCase().replace(/[^a-z]/g, '');
            for (var k in REAL_POLYGONS) {
              if (raw.indexOf(k) !== -1 || k.indexOf(raw) !== -1) {
                return REAL_POLYGONS[k];
              }
            }
            return generateOrganicBoundary(place.lat, place.lng);
          }

          var places = ${placesJson};
          var polyLayers = {};

          // Regional color mapping (Luzon Blue, Visayas Red, Mindanao Yellow)
          var islandColors = {
            luzon: '#1E60FF',
            visayas: '#E63946',
            mindanao: '#FFB703'
          };

          places.forEach(function(place) {
            var initialCoords = getRealPolygonForPlace(place);
            var placeColor = islandColors[place.island] || '#1E60FF';

            // HIGHLIGHT THE REAL PLACE TERRITORY WITH ISLAND GROUP COLOR
            var poly = L.polygon(initialCoords, {
              color: placeColor,
              weight: 2,
              fillColor: placeColor,
              fillOpacity: 0.38,
              className: 'place-territory'
            }).addTo(map);

            poly._origColor = placeColor;
            polyLayers[place.id] = poly;

            poly.on('click', function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'MARKER_CLICK',
                  placeId: place.id
                }));
              }
              window.focusPlace(place.id, place.lat, place.lng);
            });

            // Dynamically query OpenStreetMap Nominatim for official boundary
            if (place.name && place.name !== 'World') {
              var osmQuery = encodeURIComponent(place.name + ', Philippines');
              fetch('https://nominatim.openstreetmap.org/search?q=' + osmQuery + '&format=geojson&polygon_geojson=1&limit=1')
                .then(function(r) { return r.json(); })
                .then(function(data) {
                  if (data && data.features && data.features.length > 0 && data.features[0].geometry) {
                    if (polyLayers[place.id]) {
                      map.removeLayer(polyLayers[place.id]);
                    }
                    var geoLayer = L.geoJSON(data.features[0], {
                      style: {
                        color: placeColor,
                        weight: 2,
                        fillColor: placeColor,
                        fillOpacity: 0.38
                      }
                    }).addTo(map);

                    geoLayer._origColor = placeColor;
                    polyLayers[place.id] = geoLayer;

                    geoLayer.on('click', function() {
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'MARKER_CLICK',
                          placeId: place.id
                        }));
                      }
                      window.focusPlace(place.id, place.lat, place.lng);
                    });
                  }
                })
                .catch(function(e) {});
            }
          });

          // Minimalist Flight/travel routes connecting visited places
          if (places.length > 1) {
            var routeCoords = places.map(function(p) { return [p.lat, p.lng]; });
            L.polyline(routeCoords, {
              color: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(30, 96, 255, 0.55)',
              weight: 1.8,
              dashArray: '4, 4',
              opacity: 0.75
            }).addTo(map);
          }

          // Function to focus a place
          window.focusPlace = function(placeId, lat, lng) {
            for (var id in polyLayers) {
              if (polyLayers[id] && polyLayers[id].setStyle) {
                var baseColor = polyLayers[id]._origColor || '#1E60FF';
                polyLayers[id].setStyle({
                  color: baseColor,
                  weight: 2,
                  fillColor: baseColor,
                  fillOpacity: 0.38
                });
              }
            }

            if (polyLayers[placeId]) {
              var focusColor = polyLayers[placeId]._origColor || '#1E60FF';
              if (polyLayers[placeId].setStyle) {
                polyLayers[placeId].setStyle({
                  color: focusColor,
                  weight: 3.2,
                  fillColor: focusColor,
                  fillOpacity: 0.62
                });
              }
              if (polyLayers[placeId].bringToFront) {
                polyLayers[placeId].bringToFront();
              }
              if (polyLayers[placeId].getBounds) {
                map.fitBounds(polyLayers[placeId].getBounds(), {
                  maxZoom: 14,
                  padding: [40, 40],
                  animate: true,
                  duration: 1.2
                });
                return;
              }
            }

            map.flyTo([lat, lng], 13, { duration: 1.2 });
          };
        </script>
      </body>
      </html>
    `;
  }, [mapData.places, mapStyle, isDark]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      {/* 1. Minimalist App-Styled Header */}
      <View style={[styles.cleanHeader, { borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          style={[styles.minimalBackBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        >
          <ArrowLeft size={18} color={colors.ink} strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={styles.headerTitleColumn}>
          <Text style={[styles.minimalHeaderTitle, { color: colors.ink, fontSize: fs.lg }]}>
            Travel Map
          </Text>
          <Text style={[styles.minimalHeaderSubtitle, { color: colors.inkSoft, fontSize: fs.xs }]}>
            {mapData.placesCount} {mapData.placesCount === 1 ? 'place' : 'places'} · {mapData.totalSpotsCount} spots logged
          </Text>
        </View>

        {/* Minimalist Filter Pill */}
        <View style={[styles.segmentedFilter, { backgroundColor: colors.subtleBg }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFilterMode('completed')}
            style={[
              styles.filterPillBtn,
              filterMode === 'completed' && {
                backgroundColor: colors.card,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.12,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                {
                  fontSize: fs.xs,
                  color: filterMode === 'completed' ? colors.primary : colors.inkSoft,
                  fontWeight: filterMode === 'completed' ? '700' : '500',
                },
              ]}
            >
              Completed
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFilterMode('all')}
            style={[
              styles.filterPillBtn,
              filterMode === 'all' && {
                backgroundColor: colors.card,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.12,
                shadowRadius: 2,
                elevation: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                {
                  fontSize: fs.xs,
                  color: filterMode === 'all' ? colors.primary : colors.inkSoft,
                  fontWeight: filterMode === 'all' ? '700' : '500',
                },
              ]}
            >
              All Trips
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Interactive Map Viewport with Floating Minimalist Controls */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.inkSoft, fontSize: fs.sm }]}>
              Loading travel map...
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, position: 'relative' }}>
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: leafletHtml }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              onMessage={handleWebViewMessage}
              style={styles.webView}
            />

            {/* Floating Top Controls: Map Style, Island Group Navigator, & Actions */}
            <View style={styles.floatingTopBar}>
              {/* Row 1: Map Style Selector & View Actions */}
              <View style={styles.floatingTopRow}>
                {/* Tile Style Selector Pill */}
                <View style={[styles.glassPillRow, { backgroundColor: colors.pillBg, borderColor: colors.pillBorder }]}>
                  <TouchableOpacity
                    onPress={() => handleSwitchMapStyle('streets')}
                    activeOpacity={0.7}
                    style={[
                      styles.glassPillBtn,
                      mapStyle === 'streets' && { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : colors.card },
                    ]}
                  >
                    <Text
                      style={[
                        styles.glassPillText,
                        { color: mapStyle === 'streets' ? colors.primary : colors.inkSoft, fontSize: fs.xs - 1 },
                      ]}
                    >
                      Streets
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSwitchMapStyle('dark')}
                    activeOpacity={0.7}
                    style={[
                      styles.glassPillBtn,
                      mapStyle === 'dark' && { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : colors.card },
                    ]}
                  >
                    <Text
                      style={[
                        styles.glassPillText,
                        { color: mapStyle === 'dark' ? colors.primary : colors.inkSoft, fontSize: fs.xs - 1 },
                      ]}
                    >
                      Dark
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSwitchMapStyle('satellite')}
                    activeOpacity={0.7}
                    style={[
                      styles.glassPillBtn,
                      mapStyle === 'satellite' && { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : colors.card },
                    ]}
                  >
                    <Text
                      style={[
                        styles.glassPillText,
                        { color: mapStyle === 'satellite' ? colors.primary : colors.inkSoft, fontSize: fs.xs - 1 },
                      ]}
                    >
                      Satellite
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* View Actions (World / Philippines / Share Story) */}
                <View style={[styles.glassPillRow, { backgroundColor: colors.pillBg, borderColor: colors.pillBorder }]}>
                  <TouchableOpacity
                    onPress={handleFocusPhilippines}
                    activeOpacity={0.7}
                    style={styles.iconPillBtn}
                  >
                    <Compass size={14} color={colors.primary} />
                  </TouchableOpacity>

                  <View style={[styles.tinyDivider, { backgroundColor: colors.cardBorder }]} />

                  <TouchableOpacity
                    onPress={handleWorldView}
                    activeOpacity={0.7}
                    style={styles.iconPillBtn}
                  >
                    <Globe size={14} color={colors.inkSoft} />
                  </TouchableOpacity>

                  <View style={[styles.tinyDivider, { backgroundColor: colors.cardBorder }]} />

                  <TouchableOpacity
                    onPress={handleShareWholeCountry}
                    activeOpacity={0.7}
                    style={styles.iconPillBtn}
                  >
                    <Share2 size={13} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 2: Island Group Fast-Focus Navigator (All, Luzon, Visayas, Mindanao) */}
              <View style={[styles.islandJumpRow, { backgroundColor: colors.pillBg, borderColor: colors.pillBorder }]}>
                <TouchableOpacity
                  onPress={handleFocusPhilippines}
                  activeOpacity={0.7}
                  style={styles.islandJumpBtn}
                >
                  <Text style={[styles.islandJumpText, { color: colors.ink, fontSize: fs.xs - 2 }]}>
                    All
                  </Text>
                </TouchableOpacity>

                <View style={[styles.tinyDivider, { backgroundColor: colors.cardBorder }]} />

                <TouchableOpacity
                  onPress={handleFocusLuzon}
                  activeOpacity={0.7}
                  style={styles.islandJumpBtn}
                >
                  <View style={[styles.islandDot, { backgroundColor: '#1E60FF' }]} />
                  <Text style={[styles.islandJumpText, { color: colors.ink, fontSize: fs.xs - 2 }]}>
                    Luzon
                  </Text>
                </TouchableOpacity>

                <View style={[styles.tinyDivider, { backgroundColor: colors.cardBorder }]} />

                <TouchableOpacity
                  onPress={handleFocusVisayas}
                  activeOpacity={0.7}
                  style={styles.islandJumpBtn}
                >
                  <View style={[styles.islandDot, { backgroundColor: '#E63946' }]} />
                  <Text style={[styles.islandJumpText, { color: colors.ink, fontSize: fs.xs - 2 }]}>
                    Visayas
                  </Text>
                </TouchableOpacity>

                <View style={[styles.tinyDivider, { backgroundColor: colors.cardBorder }]} />

                <TouchableOpacity
                  onPress={handleFocusMindanao}
                  activeOpacity={0.7}
                  style={styles.islandJumpBtn}
                >
                  <View style={[styles.islandDot, { backgroundColor: '#FFB703' }]} />
                  <Text style={[styles.islandJumpText, { color: colors.ink, fontSize: fs.xs - 2 }]}>
                    Mindanao
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Floating Bottom-Right Zoom Controls */}
            <View style={styles.floatingZoomStack}>
              <TouchableOpacity
                onPress={() => handleZoom(1)}
                activeOpacity={0.8}
                style={[styles.minimalZoomBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              >
                <ZoomIn size={15} color={colors.ink} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleZoom(-1)}
                activeOpacity={0.8}
                style={[styles.minimalZoomBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              >
                <ZoomOut size={15} color={colors.ink} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleFocusPhilippines}
                activeOpacity={0.8}
                style={[styles.minimalZoomBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              >
                <RefreshCw size={13} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 3. Collapsible Places Visited Bottom Section (Barkadash Aesthetic) */}
        <View
          style={[
            isPlacesCollapsed ? styles.collapsedFloatingContainer : styles.placesBottomSection,
            {
              backgroundColor: isPlacesCollapsed ? 'transparent' : colors.card,
              borderTopColor: isPlacesCollapsed ? 'transparent' : colors.cardBorder,
              paddingBottom: isPlacesCollapsed ? Math.max(insets.bottom, 10) : Math.max(insets.bottom, 12),
            },
          ]}
        >
          {isPlacesCollapsed ? (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={togglePlacesCollapse}
              style={[
                styles.collapsedFloatingBar,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View style={styles.collapsedBarLeft}>
                <View style={[styles.collapsedIconBadge, { backgroundColor: colors.subtleBg }]}>
                  <MapPin size={13} color={colors.primary} />
                </View>
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={[styles.collapsedTitleText, { color: colors.ink, fontSize: fs.xs }]}>
                    Places Visited ({mapData.places.length})
                  </Text>
                  <Text style={[styles.collapsedSubText, { color: colors.inkSoft, fontSize: fs.xs - 2 }]} numberOfLines={1}>
                    {selectedPlace ? `Active: ${selectedPlace.cityName}` : 'Tap to expand places list'}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => {
                    const target = selectedPlace || (mapData.places.length > 0 ? mapData.places[0] : null);
                    if (target) {
                      handleSharePlace(target);
                    } else {
                      handleShareWholeCountry();
                    }
                  }}
                  activeOpacity={0.8}
                  style={[styles.collapsedShareBtn, { backgroundColor: colors.subtleBg }]}
                >
                  <Share2 size={13} color={colors.primary} />
                </TouchableOpacity>

                <View style={[styles.collapsedExpandPill, { backgroundColor: colors.subtleBg }]}>
                  <Text style={[styles.collapsedExpandText, { color: colors.primary, fontSize: fs.xs - 1 }]}>
                    Expand
                  </Text>
                  <ChevronUp size={13} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <>
              {/* Grab Handle */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={togglePlacesCollapse}
                style={styles.drawerHandleTouch}
              >
                <View style={[styles.drawerHandleBar, { backgroundColor: colors.rule }]} />
              </TouchableOpacity>

              {/* Section Header */}
              <View style={styles.placesHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MapPin size={13} color={colors.primary} />
                  <Text style={[styles.placesSectionTitle, { color: colors.ink, fontSize: fs.xs }]}>
                    PLACES VISITED
                  </Text>
                  <View style={[styles.placesCountBadge, { backgroundColor: colors.subtleBg }]}>
                    <Text style={[styles.placesCountBadgeText, { color: colors.inkSoft, fontSize: fs.xs - 2 }]}>
                      {mapData.places.length}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity
                    onPress={handleShareWholeCountry}
                    activeOpacity={0.75}
                    style={[styles.shareCountryBtn, { backgroundColor: colors.subtleBg }]}
                  >
                    <Share2 size={11} color={colors.primary} />
                    <Text style={[styles.shareCountryBtnText, { color: colors.primary, fontSize: fs.xs - 2 }]}>
                      Share Country
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={togglePlacesCollapse}
                    activeOpacity={0.7}
                    style={[styles.collapseBtn, { backgroundColor: colors.subtleBg }]}
                  >
                    <Text style={[styles.collapseBtnText, { color: colors.inkSoft, fontSize: fs.xs - 1 }]}>
                      Minimize
                    </Text>
                    <ChevronDown size={13} color={colors.inkSoft} />
                  </TouchableOpacity>
                </View>
              </View>

              {mapData.places.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyTitle, { color: colors.ink, fontSize: fs.sm }]}>
                    No trips recorded yet
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.inkSoft, fontSize: fs.xs }]}>
                    Completed and planned trips will highlight your visited places here.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.placesScrollContainer}
                >
                  {mapData.places.map((place) => {
                    const isSelected = selectedPlace?.id === place.id;
                    const locationLabel = place.province || place.country;
                    return (
                      <TouchableOpacity
                        key={place.id}
                        onPress={() => handleSelectPlaceCard(place)}
                        activeOpacity={0.85}
                        style={[
                          styles.elevatedPlaceCard,
                          {
                            backgroundColor: isSelected ? (isDark ? '#23252E' : '#FFFFFF') : colors.paper,
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                            borderWidth: isSelected ? 1.8 : 1,
                            shadowColor: isSelected ? colors.primary : '#000',
                            shadowOpacity: isSelected ? (isDark ? 0.35 : 0.16) : 0.06,
                            shadowOffset: { width: 0, height: isSelected ? 3 : 1 },
                            shadowRadius: isSelected ? 6 : 3,
                            elevation: isSelected ? 4 : 2,
                          },
                        ]}
                      >
                        {isSelected && (
                          <View style={[styles.cardActiveAccent, { backgroundColor: colors.primary }]} />
                        )}

                        <View style={styles.cardInnerContent}>
                          {/* Row 1: Location Tag + Status Pill */}
                          <View style={styles.cardHeaderRow}>
                            <View style={[styles.regionTagRow, { backgroundColor: colors.subtleBg }]}>
                              <MapPin size={9} color={colors.primary} />
                              <Text
                                style={[styles.cardProvinceText, { color: colors.inkSoft, fontSize: fs.xs - 2 }]}
                                numberOfLines={1}
                              >
                                {locationLabel}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.statusBadge,
                                {
                                  backgroundColor: place.isCompleted
                                    ? (isDark ? 'rgba(52, 211, 153, 0.16)' : '#E6F4EA')
                                    : (isDark ? 'rgba(231, 111, 81, 0.16)' : '#FDF0EC'),
                                },
                              ]}
                            >
                              {place.isCompleted ? (
                                <CheckCircle2 size={10} color={isDark ? '#34D399' : '#15803D'} />
                              ) : (
                                <Calendar size={10} color={colors.primary} />
                              )}
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  {
                                    color: place.isCompleted
                                      ? (isDark ? '#34D399' : '#15803D')
                                      : colors.primary,
                                    fontSize: fs.xs - 2,
                                  },
                                ]}
                              >
                                {place.isCompleted ? 'VISITED' : 'PLANNED'}
                              </Text>
                            </View>
                          </View>

                          {/* Row 2: City / Territory Name */}
                          <Text
                            style={[
                              styles.cardCityTitle,
                              {
                                color: colors.ink,
                                fontSize: fs.md,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {place.cityName}
                          </Text>

                          {/* Row 3: Trip info & date snippet */}
                          {(place.tripTitle || place.dateRange) ? (
                            <View style={styles.cardTripRow}>
                              <Calendar size={10} color={colors.inkSoft} />
                              <Text
                                style={[styles.cardTripTitle, { color: colors.inkSoft, fontSize: fs.xs - 2 }]}
                                numberOfLines={1}
                              >
                                {place.tripTitle}{place.dateRange ? ` · ${place.dateRange}` : ''}
                              </Text>
                            </View>
                          ) : null}

                          {/* Row 4: Spots Counter + Share Button + Details Button */}
                          <View style={styles.cardFooterRow}>
                            <View style={[styles.cardStatsPill, { backgroundColor: colors.subtleBg }]}>
                              <Text style={[styles.cardStatsText, { color: colors.ink, fontSize: fs.xs - 2 }]}>
                                {place.spotsCount} {place.spotsCount === 1 ? 'spot' : 'spots'}
                                {place.stays.length > 0 ? ` · ${place.stays.length} stay` : ''}
                              </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <TouchableOpacity
                                onPress={() => handleSharePlace(place)}
                                activeOpacity={0.7}
                                style={[styles.cardShareBtn, { backgroundColor: colors.subtleBg }]}
                              >
                                <Share2 size={11} color={colors.primary} />
                              </TouchableOpacity>

                              <TouchableOpacity
                                onPress={() => setDetailModalPlace(place)}
                                activeOpacity={0.7}
                                style={[styles.cardDetailsBtn, { backgroundColor: isSelected ? colors.primary : colors.subtleBg }]}
                              >
                                <Text
                                  style={[
                                    styles.cardDetailsBtnText,
                                    {
                                      color: isSelected ? '#FFFFFF' : colors.primary,
                                      fontSize: fs.xs - 2,
                                    },
                                  ]}
                                >
                                  Details
                                </Text>
                                <ChevronRight size={10} color={isSelected ? '#FFFFFF' : colors.primary} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </>
          )}
        </View>
      </View>

      {/* 4. Minimalist Itinerary Spots Modal */}
      {detailModalPlace && (
        <Modal
          visible={!!detailModalPlace}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setDetailModalPlace(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {/* Grab Handle */}
              <View style={styles.grabHandleBox}>
                <View style={[styles.grabHandle, { backgroundColor: colors.rule }]} />
              </View>

              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.cardBorder }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalSub, { color: colors.inkSoft, fontSize: fs.xs }]}>
                    {detailModalPlace.province ? `${detailModalPlace.province}, ` : ''}{detailModalPlace.country}
                  </Text>
                  <Text style={[styles.modalTitle, { color: colors.ink, fontSize: fs.xl }]}>
                    {detailModalPlace.cityName}
                  </Text>
                  <Text style={[styles.modalTripLabel, { color: colors.inkSoft, fontSize: fs.xs }]} numberOfLines={1}>
                    {detailModalPlace.tripTitle} · {detailModalPlace.dateRange}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => handleSharePlace(detailModalPlace)}
                    style={[styles.modalCloseBtn, { backgroundColor: colors.subtleBg }]}
                    activeOpacity={0.7}
                  >
                    <Share2 size={15} color={colors.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setDetailModalPlace(null)}
                    style={[styles.modalCloseBtn, { backgroundColor: colors.subtleBg }]}
                    activeOpacity={0.7}
                  >
                    <X size={16} color={colors.ink} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Scrollable Spots & Stays Content */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollBody}
              >
                <Text style={[styles.modalSectionHeading, { color: colors.inkSoft, fontSize: fs.xs }]}>
                  ITINERARY SPOTS ({detailModalPlace.spotsCount})
                </Text>

                {detailModalPlace.spots.length === 0 ? (
                  <View style={[styles.minimalEmptyCard, { backgroundColor: colors.paper, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.minimalEmptyText, { color: colors.inkSoft, fontSize: fs.sm }]}>
                      No specific itinerary items recorded during this trip.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 6 }}>
                    {detailModalPlace.spots.map((spot, idx) => (
                      <View
                        key={spot.id || idx}
                        style={[
                          styles.minimalSpotRow,
                          { backgroundColor: colors.paper, borderColor: colors.cardBorder },
                        ]}
                      >
                        <View style={[styles.minimalIndexDot, { backgroundColor: colors.subtleBg }]}>
                          <Text style={[styles.minimalIndexText, { color: colors.ink, fontSize: fs.xs }]}>
                            {idx + 1}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.minimalSpotTitle, { color: colors.ink, fontSize: fs.sm }]} numberOfLines={1}>
                            {spot.title}
                          </Text>
                          {spot.location ? (
                            <Text style={[styles.minimalSpotLocation, { color: colors.inkSoft, fontSize: fs.xs }]} numberOfLines={1}>
                              {spot.location}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Accommodations */}
                {detailModalPlace.stays.length > 0 && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={[styles.modalSectionHeading, { color: colors.inkSoft, fontSize: fs.xs }]}>
                      ACCOMMODATIONS ({detailModalPlace.stays.length})
                    </Text>
                    <View style={{ gap: 6, marginTop: 4 }}>
                      {detailModalPlace.stays.map((stay, idx) => (
                        <View
                          key={stay.id || idx}
                          style={[
                            styles.minimalSpotRow,
                            { backgroundColor: colors.paper, borderColor: colors.cardBorder },
                          ]}
                        >
                          <Building size={14} color={colors.primary} style={{ marginTop: 2 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.minimalSpotTitle, { color: colors.ink, fontSize: fs.sm }]} numberOfLines={1}>
                              {stay.title}
                            </Text>
                            {stay.location ? (
                              <Text style={[styles.minimalSpotLocation, { color: colors.inkSoft, fontSize: fs.xs }]} numberOfLines={1}>
                                {stay.location}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* 5. Strava-Style Story Travel Share Modal */}
      <StravaTravelShareModal
        visible={!!shareModalData}
        onClose={() => setShareModalData(null)}
        data={shareModalData}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  cleanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  minimalBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleColumn: {
    flex: 1,
  },
  minimalHeaderTitle: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  minimalHeaderSubtitle: {
    fontWeight: '500',
    marginTop: 1,
  },
  segmentedFilter: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 2,
  },
  filterPillBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  filterPillText: {
    letterSpacing: -0.2,
  },
  mapContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontWeight: '500',
  },
  webView: {
    flex: 1,
  },
  floatingTopBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 10,
    gap: 7,
    zIndex: 10,
  },
  floatingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  islandJumpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  islandJumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
  },
  islandJumpText: {
    fontWeight: '700',
  },
  islandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  glassPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  glassPillBtn: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 13,
  },
  glassPillText: {
    fontWeight: '700',
  },
  iconPillBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinyDivider: {
    width: 1,
    height: 12,
  },
  floatingZoomStack: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    gap: 6,
    zIndex: 10,
  },
  minimalZoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  collapsedFloatingContainer: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  collapsedFloatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  collapsedBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  collapsedIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedTitleText: {
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  collapsedSubText: {
    fontWeight: '500',
    marginTop: 1,
  },
  collapsedExpandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  collapsedExpandText: {
    fontWeight: '700',
  },
  placesBottomSection: {
    borderTopWidth: 1,
    paddingTop: 4,
  },
  drawerHandleTouch: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  drawerHandleBar: {
    width: 34,
    height: 4,
    borderRadius: 2,
  },
  placesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  placesSectionTitle: {
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  placesCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  placesCountBadgeText: {
    fontWeight: '700',
  },
  collapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  collapseBtnText: {
    fontWeight: '600',
  },
  placesScrollContainer: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 6,
  },
  elevatedPlaceCard: {
    width: 215,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  cardActiveAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  cardInnerContent: {
    padding: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  regionTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    maxWidth: '68%',
  },
  regionDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  cardProvinceText: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardCityTitle: {
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  cardTripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  cardTripTitle: {
    fontWeight: '500',
    flex: 1,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  cardStatsPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    flex: 1,
  },
  cardStatsText: {
    fontWeight: '600',
  },
  cardDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cardDetailsBtnText: {
    fontWeight: '700',
  },
  cardShareBtn: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedShareBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCountryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  shareCountryBtnText: {
    fontWeight: '700',
  },
  emptyContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyTitle: {
    fontWeight: '700',
  },
  emptySubtitle: {
    textAlign: 'center',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingBottom: 20,
  },
  grabHandleBox: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  grabHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  modalSub: {
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalTitle: {
    fontWeight: '900',
    marginTop: 1,
  },
  modalTripLabel: {
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollBody: {
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  modalSectionHeading: {
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  minimalEmptyCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  minimalEmptyText: {
    fontWeight: '500',
  },
  minimalSpotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  minimalIndexDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimalIndexText: {
    fontWeight: '700',
  },
  minimalSpotTitle: {
    fontWeight: '700',
  },
  minimalSpotLocation: {
    marginTop: 1,
  },
});
