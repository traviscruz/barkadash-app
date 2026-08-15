// Weather Service - Open-Meteo (free, no API key required) + OpenWeather (chatbot)

// ---------- Open-Meteo (used by trip cards / radar screens) ----------
export interface WeatherData {
  tempC: number;
  code: number;
  isDay: boolean;
}

const codeToLabel = (code: number): string => {
  if (code === 0) return 'Clear';
  if (code <= 1) return 'Mainly Clear';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain Showers';
  if (code <= 86) return 'Snow Showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
};

/**
 * Fetch current weather (temperature in °C, condition code) for a lat/lng
 * using the free Open-Meteo API. No API key needed.
 */
export async function fetchWeather(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      current: 'temperature_2m,weather_code,is_day',
      temperature_unit: 'celsius',
      timezone: 'auto',
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
    if (!res.ok) {
      console.warn('fetchWeather HTTP error:', res.status);
      return null;
    }
    const json = await res.json();
    const current = json?.current;
    if (!current || typeof current.temperature_2m !== 'number') {
      console.warn('fetchWeather missing current data:', json);
      return null;
    }
    return {
      tempC: Math.round(current.temperature_2m),
      code: current.weather_code ?? 0,
      isDay: current.is_day !== 0,
    };
  } catch (err: any) {
    console.warn('fetchWeather exception:', err?.message);
    return null;
  }
}

export function weatherLabel(code: number): string {
  return codeToLabel(code);
}

// ---------- OpenWeather (used by the Navi chatbot) ----------
const OPENWEATHER_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || '';

export interface WeatherInfo {
  location: string;
  condition: string;
  description: string;
  tempC: number;
  tempF: number;
  feelsLikeC: number;
  humidity: number;
  windMps: number;
  icon: string;
}

export type WeatherError = 'no-key' | 'not-found' | 'api-error' | null;

export interface WeatherResult {
  weather: WeatherInfo | null;
  error: WeatherError;
}

/**
 * Current weather for a place (geocoded by name) via the OpenWeather API.
 * The key must be exposed in the app via EXPO_PUBLIC_OPENWEATHER_API_KEY.
 */
export async function getWeatherForPlace(place: string): Promise<WeatherResult> {
  if (!OPENWEATHER_KEY) {
    console.warn('getWeatherForPlace: EXPO_PUBLIC_OPENWEATHER_API_KEY is not set');
    return { weather: null, error: 'no-key' };
  }
  try {
    const geoRes = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(place)}&limit=1&appid=${OPENWEATHER_KEY}`
    );
    const geo = await geoRes.json();
    const loc = Array.isArray(geo) && geo.length > 0 ? geo[0] : null;
    if (!loc) return { weather: null, error: 'not-found' };

    const wRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${loc.lat}&lon=${loc.lon}&units=metric&appid=${OPENWEATHER_KEY}`
    );
    const w = await wRes.json();
    if (w.cod !== 200 || !w.main) {
      console.warn('getWeatherForPlace api error:', w.cod, w.message || '');
      return { weather: null, error: 'api-error' };
    }

    const weather: WeatherInfo = {
      location: loc.name || place,
      condition: w.weather?.[0]?.main || 'Unknown',
      description: w.weather?.[0]?.description || 'Unknown',
      tempC: Math.round(w.main.temp),
      tempF: Math.round((w.main.temp * 9) / 5 + 32),
      feelsLikeC: Math.round(w.main.feels_like),
      humidity: w.main.humidity ?? 0,
      windMps: Math.round(w.wind?.speed ?? 0),
      icon: w.weather?.[0]?.icon || '',
    };
    return { weather, error: null };
  } catch (err: any) {
    console.warn('getWeatherForPlace exception:', err?.message);
    return { weather: null, error: 'api-error' };
  }
}
