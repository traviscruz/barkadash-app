import './global.css';
import React, { useState } from 'react';
import { View, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen } from './src/screens/home/HomeScreen';
import { TripPlannerScreen } from './src/screens/planner/TripPlannerScreen';
import { BarkadaRadarScreen } from './src/screens/radar/BarkadaRadarScreen';
import { ExpenseLedgerScreen } from './src/screens/expenses/ExpenseLedgerScreen';
import { TripFeedScreen } from './src/screens/feed/TripFeedScreen';
import { AppBottomNav } from './src/components/nav/AppBottomNav';

export default function App() {
  const [currentTab, setCurrentTab] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleScrollDirection = (direction: 'up' | 'down') => {
    if (direction === 'down' && isExpanded) {
      setIsExpanded(false);
    } else if (direction === 'up' && !isExpanded) {
      setIsExpanded(true);
    }
  };

  const renderActiveScreen = () => {
    switch (currentTab) {
      case 0:
        return (
          <HomeScreen
            onNavigateToTab={(index) => {
              setCurrentTab(index);
              setIsExpanded(true);
            }}
            onScrollDirection={handleScrollDirection}
          />
        );
      case 1:
        return <TripPlannerScreen onScrollDirection={handleScrollDirection} />;
      case 2:
        return <BarkadaRadarScreen onScrollDirection={handleScrollDirection} />;
      case 3:
        return <ExpenseLedgerScreen onScrollDirection={handleScrollDirection} />;
      case 4:
        return <TripFeedScreen onScrollDirection={handleScrollDirection} />;
      default:
        return (
          <HomeScreen
            onNavigateToTab={(index) => {
              setCurrentTab(index);
              setIsExpanded(true);
            }}
            onScrollDirection={handleScrollDirection}
          />
        );
    }
  };

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#FAF8F5' }}>
        <StatusBar barStyle="dark-content" backgroundColor="#FAF8F5" />
        <View style={{ flex: 1 }}>
          {renderActiveScreen()}
          <AppBottomNav
            currentIndex={currentTab}
            onTabChange={(index) => {
              setCurrentTab(index);
              setIsExpanded(true);
            }}
            isExpanded={isExpanded}
            onExpand={() => setIsExpanded(true)}
          />
        </View>
      </View>
    </SafeAreaProvider>
  );
}
