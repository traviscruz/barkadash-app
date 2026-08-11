import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Bell,
  Volume2,
  Moon,
  MapPin,
  ShieldCheck,
  LogOut,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

interface SettingsScreenProps {
  onBack?: () => void;
  onNavigateToTerms?: () => void;
  onLogout?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onNavigateToTerms,
  onLogout,
}) => {
  const { themeMode, setThemeMode, colors, isDark } = useTheme();
  const [notifPush, setNotifPush] = useState(true);
  const [notifExpense, setNotifExpense] = useState(true);
  const [radarLocation, setRadarLocation] = useState(true);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      {/* Centered Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backTouch}>
          <ChevronLeft size={24} color={colors.tealDark} />
          <Text style={[styles.backText, { color: colors.tealDark }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 48 }}
      >
        {/* Notifications Group */}
        <Text style={[styles.groupTitle, { color: colors.inkSoft }]}>Notifications</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.row, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.rowLabelGroup}>
              <Bell size={18} color={colors.tealDark} />
              <Text style={[styles.rowText, { color: colors.ink }]}>Push Notifications</Text>
            </View>
            <Switch
              value={notifPush}
              onValueChange={setNotifPush}
              trackColor={{ false: '#E6E8F0', true: colors.tealDark }}
            />
          </View>

          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLabelGroup}>
              <Volume2 size={18} color={colors.tealDark} />
              <Text style={[styles.rowText, { color: colors.ink }]}>Expense & Ledger Alerts</Text>
            </View>
            <Switch
              value={notifExpense}
              onValueChange={setNotifExpense}
              trackColor={{ false: '#E6E8F0', true: colors.tealDark }}
            />
          </View>
        </View>

        {/* Theme / Appearance Preferences */}
        <Text style={[styles.groupTitle, { color: colors.inkSoft }]}>Appearance Preference</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {[
            { id: 'system', label: 'System Default' },
            { id: 'light', label: 'Light Mode' },
            { id: 'dark', label: 'Dark Mode' },
          ].map((item, idx) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => setThemeMode(item.id as any)}
              activeOpacity={0.7}
              style={[
                styles.row,
                { borderBottomColor: colors.cardBorder },
                idx === 2 ? { borderBottomWidth: 0 } : null,
              ]}
            >
              <View style={styles.rowLabelGroup}>
                <Moon size={18} color={colors.tealDark} />
                <Text style={[styles.rowText, { color: colors.ink }]}>{item.label}</Text>
              </View>
              {themeMode === item.id ? (
                <Check size={18} color={colors.tealDark} strokeWidth={3} />
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        {/* Privacy & Location */}
        <Text style={[styles.groupTitle, { color: colors.inkSoft }]}>Privacy & Location Services</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLabelGroup}>
              <MapPin size={18} color={colors.tealDark} />
              <Text style={[styles.rowText, { color: colors.ink }]}>Barkada Radar Location</Text>
            </View>
            <Switch
              value={radarLocation}
              onValueChange={setRadarLocation}
              trackColor={{ false: '#E6E8F0', true: colors.tealDark }}
            />
          </View>
        </View>

        {/* Legal & Account Actions */}
        <Text style={[styles.groupTitle, { color: colors.inkSoft }]}>Account & Legal</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <TouchableOpacity
            onPress={onNavigateToTerms}
            activeOpacity={0.7}
            style={[styles.row, { borderBottomWidth: 0 }]}
          >
            <View style={styles.rowLabelGroup}>
              <ShieldCheck size={18} color={colors.tealDark} />
              <Text style={[styles.rowText, { color: colors.ink }]}>Terms & Privacy Policy</Text>
            </View>
            <ChevronLeft size={16} color={colors.inkSoft} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={onLogout}
          activeOpacity={0.88}
          style={[
            styles.logoutBtn,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA',
            },
          ]}
        >
          <LogOut size={18} color={isDark ? '#F87171' : '#DC2626'} />
          <Text style={[styles.logoutBtnText, { color: isDark ? '#F87171' : '#DC2626' }]}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  largeAppleTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 4,
    marginBottom: 16,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 16,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    fontSize: 15,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 100,
    paddingVertical: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutBtnText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
  },
});
