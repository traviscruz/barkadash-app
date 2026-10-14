// Travel Map Service
// Fetches completed trips, destinations, and places visited from the database,
// maps coordinates, and computes visited country highlights for the world & regional map.

import { supabase } from '../utils/supabase';
import { TripService } from './tripService';
import { Trip, ItineraryItem, TripStay } from '../types/trip';
import { getTripDayInfo } from '../utils/tripDates';

export interface VisitedPlace {
  id: string;
  tripId: string;
  tripTitle: string;
  dateRange: string;
  destination: string;
  cityName: string;
  province?: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  spotsCount: number;
  spots: Array<{ id: string; title: string; location?: string; category?: string }>;
  stays: Array<{ id: string; title: string; location?: string }>;
  isCompleted: boolean;
  status: Trip['status'];
}

export interface VisitedCountry {
  name: string;
  code: string;
  lat: number;
  lng: number;
  zoom: number;
  tripsCount: number;
  placesCount: number;
  spotsCount: number;
  places: VisitedPlace[];
}

export interface TravelMapData {
  totalTripsCount: number;
  completedTripsCount: number;
  countriesCount: number;
  placesCount: number;
  totalSpotsCount: number;
  countries: VisitedCountry[];
  places: VisitedPlace[];
}

// Known coordinates for top Philippine and international travel destinations
const KNOWN_DESTINATIONS: Record<string, { city: string; province: string; country: string; code: string; lat: number; lng: number }> = {
  // Metro Manila
  manila: { city: 'Manila', province: 'Metro Manila', country: 'Philippines', code: 'PH', lat: 14.5995, lng: 120.9842 },
  makati: { city: 'Makati', province: 'Metro Manila', country: 'Philippines', code: 'PH', lat: 14.5547, lng: 121.0244 },
  taguig: { city: 'Taguig / BGC', province: 'Metro Manila', country: 'Philippines', code: 'PH', lat: 14.5444, lng: 121.0509 },
  quezon: { city: 'Quezon City', province: 'Metro Manila', country: 'Philippines', code: 'PH', lat: 14.6760, lng: 121.0437 },
  pasay: { city: 'Pasay', province: 'Metro Manila', country: 'Philippines', code: 'PH', lat: 14.5378, lng: 120.9995 },

  // Luzon
  baguio: { city: 'Baguio City', province: 'Benguet', country: 'Philippines', code: 'PH', lat: 16.4023, lng: 120.5960 },
  sagada: { city: 'Sagada', province: 'Mountain Province', country: 'Philippines', code: 'PH', lat: 17.0833, lng: 120.9000 },
  tagaytay: { city: 'Tagaytay', province: 'Cavite', country: 'Philippines', code: 'PH', lat: 14.1153, lng: 120.9621 },
  batangas: { city: 'Batangas', province: 'Batangas', country: 'Philippines', code: 'PH', lat: 13.7565, lng: 121.0583 },
  batanes: { city: 'Batanes (Basco)', province: 'Batanes', country: 'Philippines', code: 'PH', lat: 20.4485, lng: 121.9705 },
  launion: { city: 'La Union (San Juan)', province: 'La Union', country: 'Philippines', code: 'PH', lat: 16.6667, lng: 120.3333 },
  elyu: { city: 'La Union (Elyu)', province: 'La Union', country: 'Philippines', code: 'PH', lat: 16.6667, lng: 120.3333 },
  baler: { city: 'Baler', province: 'Aurora', country: 'Philippines', code: 'PH', lat: 15.7594, lng: 121.5625 },
  vigan: { city: 'Vigan City', province: 'Ilocos Sur', country: 'Philippines', code: 'PH', lat: 17.5747, lng: 120.3869 },
  pagudpud: { city: 'Pagudpud', province: 'Ilocos Norte', country: 'Philippines', code: 'PH', lat: 18.5583, lng: 120.7833 },
  palawan: { city: 'El Nido', province: 'Palawan', country: 'Philippines', code: 'PH', lat: 11.1956, lng: 119.4124 },
  elnido: { city: 'El Nido', province: 'Palawan', country: 'Philippines', code: 'PH', lat: 11.1956, lng: 119.4124 },
  coron: { city: 'Coron', province: 'Palawan', country: 'Philippines', code: 'PH', lat: 11.9986, lng: 120.2064 },
  puertoprincesa: { city: 'Puerto Princesa', province: 'Palawan', country: 'Philippines', code: 'PH', lat: 9.7392, lng: 118.7353 },
  pampanga: { city: 'San Fernando', province: 'Pampanga', country: 'Philippines', code: 'PH', lat: 15.0333, lng: 120.6833 },
  angeles: { city: 'Angeles City', province: 'Pampanga', country: 'Philippines', code: 'PH', lat: 15.1450, lng: 120.5887 },
  laguna: { city: 'Pansol / Los Baños', province: 'Laguna', country: 'Philippines', code: 'PH', lat: 14.1708, lng: 121.2436 },
  tanay: { city: 'Tanay', province: 'Rizal', country: 'Philippines', code: 'PH', lat: 14.4967, lng: 121.2864 },
  subic: { city: 'Subic Bay', province: 'Zambales', country: 'Philippines', code: 'PH', lat: 14.8217, lng: 120.2828 },

  // Visayas
  boracay: { city: 'Boracay Island', province: 'Aklan', country: 'Philippines', code: 'PH', lat: 11.9674, lng: 121.9248 },
  cebu: { city: 'Cebu City', province: 'Cebu', country: 'Philippines', code: 'PH', lat: 10.3157, lng: 123.8854 },
  bohol: { city: 'Panglao & Bohol', province: 'Bohol', country: 'Philippines', code: 'PH', lat: 9.5804, lng: 123.7719 },
  panglao: { city: 'Panglao', province: 'Bohol', country: 'Philippines', code: 'PH', lat: 9.5804, lng: 123.7719 },
  iloilo: { city: 'Iloilo City', province: 'Iloilo', country: 'Philippines', code: 'PH', lat: 10.7202, lng: 122.5621 },
  gigantes: { city: 'Islas de Gigantes', province: 'Iloilo', country: 'Philippines', code: 'PH', lat: 11.5975, lng: 123.3364 },
  bacolod: { city: 'Bacolod City', province: 'Negros Occidental', country: 'Philippines', code: 'PH', lat: 10.6766, lng: 122.9509 },
  dumaguete: { city: 'Dumaguete', province: 'Negros Oriental', country: 'Philippines', code: 'PH', lat: 9.3068, lng: 123.3054 },
  siquijor: { city: 'Siquijor Island', province: 'Siquijor', country: 'Philippines', code: 'PH', lat: 9.2141, lng: 123.5157 },

  // Mindanao
  siargao: { city: 'Siargao Island', province: 'Surigao del Norte', country: 'Philippines', code: 'PH', lat: 9.8653, lng: 126.0469 },
  davao: { city: 'Davao City', province: 'Davao del Sur', country: 'Philippines', code: 'PH', lat: 7.1907, lng: 125.4553 },
  camiguin: { city: 'Camiguin Island', province: 'Camiguin', country: 'Philippines', code: 'PH', lat: 9.1732, lng: 124.7299 },
  cagayan: { city: 'Cagayan de Oro', province: 'Misamis Oriental', country: 'Philippines', code: 'PH', lat: 8.4542, lng: 124.6319 },

  // Japan
  tokyo: { city: 'Tokyo', province: 'Kanto', country: 'Japan', code: 'JP', lat: 35.6762, lng: 139.6503 },
  osaka: { city: 'Osaka', province: 'Kansai', country: 'Japan', code: 'JP', lat: 34.6937, lng: 135.5023 },
  kyoto: { city: 'Kyoto', province: 'Kansai', country: 'Japan', code: 'JP', lat: 35.0116, lng: 135.7681 },
  shibuya: { city: 'Shibuya', province: 'Tokyo', country: 'Japan', code: 'JP', lat: 35.6580, lng: 139.7016 },
  shinjuku: { city: 'Shinjuku', province: 'Tokyo', country: 'Japan', code: 'JP', lat: 35.6938, lng: 139.7034 },
  sapporo: { city: 'Sapporo', province: 'Hokkaido', country: 'Japan', code: 'JP', lat: 43.0618, lng: 141.3545 },
  fukuoka: { city: 'Fukuoka', province: 'Kyushu', country: 'Japan', code: 'JP', lat: 33.5904, lng: 130.4017 },
  okinawa: { city: 'Okinawa', province: 'Okinawa', country: 'Japan', code: 'JP', lat: 26.2124, lng: 127.6809 },
  nagoya: { city: 'Nagoya', province: 'Aichi', country: 'Japan', code: 'JP', lat: 35.1815, lng: 136.9066 },
  hiroshima: { city: 'Hiroshima', province: 'Chugoku', country: 'Japan', code: 'JP', lat: 34.3853, lng: 132.4553 },
  nara: { city: 'Nara', province: 'Kansai', country: 'Japan', code: 'JP', lat: 34.6851, lng: 135.8048 },
  yokohama: { city: 'Yokohama', province: 'Kanagawa', country: 'Japan', code: 'JP', lat: 35.4437, lng: 139.6380 },
  kobe: { city: 'Kobe', province: 'Hyogo', country: 'Japan', code: 'JP', lat: 34.6901, lng: 135.1955 },
  hakone: { city: 'Hakone', province: 'Kanagawa', country: 'Japan', code: 'JP', lat: 35.2323, lng: 139.1069 },
  dotonbori: { city: 'Dōtonbori', province: 'Osaka', country: 'Japan', code: 'JP', lat: 34.6687, lng: 135.5013 },

  // Asia / Pacific
  singapore: { city: 'Singapore', province: 'Singapore', country: 'Singapore', code: 'SG', lat: 1.3521, lng: 103.8198 },
  bangkok: { city: 'Bangkok', province: 'Bangkok', country: 'Thailand', code: 'TH', lat: 13.7563, lng: 100.5018 },
  phuket: { city: 'Phuket', province: 'Phuket', country: 'Thailand', code: 'TH', lat: 7.8804, lng: 98.3923 },
  seoul: { city: 'Seoul', province: 'Seoul', country: 'South Korea', code: 'KR', lat: 37.5665, lng: 126.9780 },
  busan: { city: 'Busan', province: 'Busan', country: 'South Korea', code: 'KR', lat: 35.1796, lng: 129.0756 },
  bali: { city: 'Bali', province: 'Bali', country: 'Indonesia', code: 'ID', lat: -8.4095, lng: 115.1889 },
  taipei: { city: 'Taipei', province: 'Taiwan', country: 'Taiwan', code: 'TW', lat: 25.0330, lng: 121.5654 },
  hongkong: { city: 'Hong Kong', province: 'Hong Kong', country: 'Hong Kong', code: 'HK', lat: 22.3193, lng: 114.1694 },
  danang: { city: 'Da Nang', province: 'Da Nang', country: 'Vietnam', code: 'VN', lat: 16.0544, lng: 108.2022 },
  hanoi: { city: 'Hanoi', province: 'Hanoi', country: 'Vietnam', code: 'VN', lat: 21.0285, lng: 105.8542 },
  saigon: { city: 'Ho Chi Minh City', province: 'Ho Chi Minh', country: 'Vietnam', code: 'VN', lat: 10.8231, lng: 106.6297 },
  kualalumpur: { city: 'Kuala Lumpur', province: 'Federal Territory', country: 'Malaysia', code: 'MY', lat: 3.1390, lng: 101.6869 },
  sydney: { city: 'Sydney', province: 'New South Wales', country: 'Australia', code: 'AU', lat: -33.8688, lng: 151.2093 },
  melbourne: { city: 'Melbourne', province: 'Victoria', country: 'Australia', code: 'AU', lat: -37.8136, lng: 144.9631 },

  // Europe & Americas
  london: { city: 'London', province: 'Greater London', country: 'United Kingdom', code: 'GB', lat: 51.5074, lng: -0.1278 },
  paris: { city: 'Paris', province: 'Ile-de-France', country: 'France', code: 'FR', lat: 48.8566, lng: 2.3522 },
  rome: { city: 'Rome', province: 'Lazio', country: 'Italy', code: 'IT', lat: 41.9028, lng: 12.4964 },
  barcelona: { city: 'Barcelona', province: 'Catalonia', country: 'Spain', code: 'ES', lat: 41.3879, lng: 2.1699 },
  madrid: { city: 'Madrid', province: 'Madrid', country: 'Spain', code: 'ES', lat: 40.4168, lng: -3.7038 },
  amsterdam: { city: 'Amsterdam', province: 'North Holland', country: 'Netherlands', code: 'NL', lat: 52.3676, lng: 4.9041 },
  newyork: { city: 'New York', province: 'New York', country: 'United States', code: 'US', lat: 40.7128, lng: -74.0060 },
  losangeles: { city: 'Los Angeles', province: 'California', country: 'United States', code: 'US', lat: 34.0522, lng: -118.2437 },
  sanfrancisco: { city: 'San Francisco', province: 'California', country: 'United States', code: 'US', lat: 37.7749, lng: -122.4194 },
  hawaii: { city: 'Honolulu', province: 'Hawaii', country: 'United States', code: 'US', lat: 21.3069, lng: -157.8583 },
};

/**
 * Geocodes a destination name or trip title to a known city and coordinates.
 */
export function resolveDestinationCoordinates(rawDestination: string, fallbackTitle = ''): {
  city: string;
  province: string;
  country: string;
  code: string;
  lat: number;
  lng: number;
} {
  const combined = `${rawDestination} ${fallbackTitle}`.toLowerCase();

  // Try matching against known keywords
  for (const [key, data] of Object.entries(KNOWN_DESTINATIONS)) {
    if (combined.includes(key)) {
      return data;
    }
  }

  // Country checks
  if (combined.includes('japan') || combined.includes('nippon') || combined.includes('nihon')) {
    return { city: rawDestination || 'Tokyo', province: 'Japan', country: 'Japan', code: 'JP', lat: 35.6762, lng: 139.6503 };
  }
  if (combined.includes('singapore')) {
    return { city: 'Singapore', province: 'Singapore', country: 'Singapore', code: 'SG', lat: 1.3521, lng: 103.8198 };
  }
  if (combined.includes('korea')) {
    return { city: 'Seoul', province: 'South Korea', country: 'South Korea', code: 'KR', lat: 37.5665, lng: 126.9780 };
  }
  if (combined.includes('thailand')) {
    return { city: 'Bangkok', province: 'Thailand', country: 'Thailand', code: 'TH', lat: 13.7563, lng: 100.5018 };
  }
  if (combined.includes('vietnam')) {
    return { city: rawDestination || 'Da Nang', province: 'Vietnam', country: 'Vietnam', code: 'VN', lat: 16.0544, lng: 108.2022 };
  }
  if (combined.includes('taiwan')) {
    return { city: 'Taipei', province: 'Taiwan', country: 'Taiwan', code: 'TW', lat: 25.0330, lng: 121.5654 };
  }
  if (combined.includes('indonesia')) {
    return { city: 'Bali', province: 'Bali', country: 'Indonesia', code: 'ID', lat: -8.4095, lng: 115.1889 };
  }
  if (combined.includes('france')) {
    return { city: rawDestination || 'Paris', province: 'France', country: 'France', code: 'FR', lat: 48.8566, lng: 2.3522 };
  }
  if (combined.includes('italy')) {
    return { city: rawDestination || 'Rome', province: 'Italy', country: 'Italy', code: 'IT', lat: 41.9028, lng: 12.4964 };
  }
  if (combined.includes('spain')) {
    return { city: rawDestination || 'Barcelona', province: 'Spain', country: 'Spain', code: 'ES', lat: 41.3879, lng: 2.1699 };
  }
  if (combined.includes('united kingdom') || combined.includes('england') || combined.includes('uk')) {
    return { city: rawDestination || 'London', province: 'United Kingdom', country: 'United Kingdom', code: 'GB', lat: 51.5074, lng: -0.1278 };
  }
  if (combined.includes('united states') || combined.includes('usa') || combined.includes('america')) {
    return { city: rawDestination || 'New York', province: 'United States', country: 'United States', code: 'US', lat: 40.7128, lng: -74.0060 };
  }
  if (combined.includes('australia')) {
    return { city: rawDestination || 'Sydney', province: 'Australia', country: 'Australia', code: 'AU', lat: -33.8688, lng: 151.2093 };
  }

  // Default fallback for Philippines
  return {
    city: rawDestination && rawDestination !== 'Voting in Progress' ? rawDestination : 'Manila',
    province: 'Philippines',
    country: 'Philippines',
    code: 'PH',
    lat: 14.5995,
    lng: 120.9842,
  };
}

export class TravelMapService {
  private static instance: TravelMapService;

  public static getInstance(): TravelMapService {
    if (!TravelMapService.instance) {
      TravelMapService.instance = new TravelMapService();
    }
    return TravelMapService.instance;
  }

  /**
   * Fetches trips from the Supabase database and transforms them into
   * visited country highlights and city pins.
   *
   * @param userId Logged in user id
   * @param filterMode 'completed' | 'all'
   */
  public async fetchTravelMapData(
    userId?: string,
    filterMode: 'completed' | 'all' = 'completed'
  ): Promise<TravelMapData> {
    try {
      const tripService = TripService.getInstance();
      const allTrips = await tripService.fetchUserTripsDB(userId);

      // Determine which trips qualify
      const qualifyingTrips = allTrips.filter((t) => {
        if (!t.id) return false;
        if (filterMode === 'all') return true;

        const dayInfo = getTripDayInfo(t.dateRange);
        const isEnded = tripService.isTripEnded(t) || !!dayInfo?.isEnded;
        return t.status === 'Completed' || isEnded;
      });

      const places: VisitedPlace[] = [];
      const countriesMap = new Map<string, VisitedCountry>();

      for (const trip of qualifyingTrips) {
        // Fetch real itinerary items from DB
        const [itinerary, stays] = await Promise.all([
          tripService.fetchTripItineraryDB(trip.id).catch(() => [] as ItineraryItem[]),
          tripService.fetchTripStaysDB(trip.id).catch(() => [] as TripStay[]),
        ]);

        const resolved = resolveDestinationCoordinates(trip.destination, trip.title);

        const spotItems = itinerary.map((item) => ({
          id: item.id,
          title: item.title,
          location: item.location || item.placeAddress || item.placeName,
          category: item.tag || 'ACTIVITY',
        }));

        const stayItems = stays.map((s) => ({
          id: s.id,
          title: s.title,
          location: s.placeAddress || s.placeName,
        }));

        const isCompleted = trip.status === 'Completed' || tripService.isTripEnded(trip);

        const place: VisitedPlace = {
          id: `place_${trip.id}`,
          tripId: trip.id,
          tripTitle: trip.title,
          dateRange: trip.dateRange || 'Dates not set',
          destination: trip.destination || resolved.city,
          cityName: resolved.city,
          province: resolved.province,
          country: resolved.country,
          countryCode: resolved.code,
          lat: resolved.lat,
          lng: resolved.lng,
          spotsCount: spotItems.length,
          spots: spotItems,
          stays: stayItems,
          isCompleted,
          status: trip.status,
        };

        places.push(place);

        // Group by country
        if (!countriesMap.has(resolved.country)) {
          countriesMap.set(resolved.country, {
            name: resolved.country,
            code: resolved.code,
            lat: resolved.country === 'Philippines' ? 12.8797 : resolved.lat,
            lng: resolved.country === 'Philippines' ? 121.7740 : resolved.lng,
            zoom: resolved.country === 'Philippines' ? 6 : 5,
            tripsCount: 0,
            placesCount: 0,
            spotsCount: 0,
            places: [],
          });
        }

        const country = countriesMap.get(resolved.country)!;
        country.tripsCount += 1;
        country.placesCount += 1;
        country.spotsCount += spotItems.length;
        country.places.push(place);
      }

      const countries = Array.from(countriesMap.values());
      const totalSpots = places.reduce((sum, p) => sum + p.spotsCount, 0);
      const completedCount = allTrips.filter((t) => t.status === 'Completed' || tripService.isTripEnded(t)).length;

      return {
        totalTripsCount: allTrips.length,
        completedTripsCount: completedCount,
        countriesCount: countries.length,
        placesCount: places.length,
        totalSpotsCount: totalSpots,
        countries,
        places,
      };
    } catch (e) {
      console.warn('Error fetching travel map data:', e);
      return {
        totalTripsCount: 0,
        completedTripsCount: 0,
        countriesCount: 0,
        placesCount: 0,
        totalSpotsCount: 0,
        countries: [],
        places: [],
      };
    }
  }
}
