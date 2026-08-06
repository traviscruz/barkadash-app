export interface AIChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export interface SpotItem {
  id: string;
  name: string;
  rating: string;
  category: string;
  imagePath: any;
  fallbackColor?: string;
}

export interface PlaceItem {
  id: string;
  title: string;
  subtitle: string;
  priceOrTime: string;
  unit: string;
  iconName: string;
  iconBg: string;
  iconColor: string;
}
