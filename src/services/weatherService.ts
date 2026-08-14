// Weather Service - Open-Meteo (free, no API key required)
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
