import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { RefreshCcw, Clock, X } from 'lucide-react-native';

interface EditTourModalProps {
  visible: boolean;
  currentDeadline: string | null;
  onClose: () => void;
  onSave: (deadline: string) => Promise<{ success: boolean; message?: string }>;
}

const fmtDeadline = (d: Date) =>
  d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * Host-only "Edit Tour": reactivates voting and sets a NEW mandatory deadline.
 * Save is disabled until a future deadline is picked.
 */
export const EditTourModal: React.FC<EditTourModalProps> = ({
  visible,
  currentDeadline,
  onClose,
  onSave,
}) => {
  const { colors, isDark } = useTheme();
  const { fs } = useResponsive();
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDeadline(null);
      setSaving(false);
      setShowAndroidPicker(false);
    }
  }, [visible]);

  const onAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowAndroidPicker(false);
    if (event.type === 'set' && date) setDeadline(date);
  };

  const save = async () => {
    if (!deadline) return;
    setSaving(true);
    await onSave(deadline.toISOString());
    setSaving(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.paper, borderColor: colors.cardBorder, maxWidth: 400 }]}
          onPress={() => {}}
        >
          <View style={styles.sheetHead}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.ink }}>Edit Tour — Reopen Voting</Text>
              <Text style={{ fontSize: fs.xs, color: colors.inkSoft, marginTop: 2 }}>
                {currentDeadline
                  ? `Current deadline: ${fmtDeadline(new Date(currentDeadline))}`
                  : 'No current deadline set'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }}>
              <X size={18} color={colors.inkSoft} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, backgroundColor: isDark ? 'rgba(240,169,62,0.12)' : '#FEF6E7', borderWidth: 1, borderColor: isDark ? 'rgba(240,169,62,0.4)' : 'rgba(240,169,62,0.5)' }}>
            <RefreshCcw size={16} color={colors.orangeAccent} strokeWidth={2} />
            <Text style={{ flex: 1, fontSize: fs.xs, color: colors.inkSoft, lineHeight: 16 }}>
              Voting reopens so the barkada can propose again if plans change. A new deadline is required before reopening.
            </Text>
          </View>

          {/* Deadline picker */}
          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Clock size={15} color={colors.tealDark} strokeWidth={2.2} />
              <Text style={{ fontSize: 11, fontWeight: '900', color: colors.ink, letterSpacing: 0.3 }}>NEW VOTING DEADLINE (REQUIRED)</Text>
            </View>

            {Platform.OS === 'android' ? (
              showAndroidPicker ? (
                <DateTimePicker
                  value={deadline || new Date()}
                  mode="datetime"
                  minimumDate={new Date()}
                  onChange={onAndroidChange}
                />
              ) : (
                <TouchableOpacity
                  onPress={() => setShowAndroidPicker(true)}
                  activeOpacity={0.8}
                  style={{
                    borderWidth: 1,
                    borderColor: deadline ? colors.tealDark : colors.cardBorder,
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                  }}
                >
                  <Text style={{ fontSize: fs.sm, fontWeight: '800', color: deadline ? colors.tealDark : colors.inkSoft }}>
                    {deadline ? fmtDeadline(deadline) : 'Pick new date & time'}
                  </Text>
                </TouchableOpacity>
              )
            ) : (
              <DateTimePicker
                value={deadline || new Date()}
                mode="datetime"
                display="spinner"
                minimumDate={new Date()}
                onChange={(_event, date) => { if (date) setDeadline(date); }}
                style={{ height: 190, alignSelf: 'stretch' }}
              />
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.pill, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.cardBorder }]}
            >
              <Text style={{ color: colors.inkSoft, fontWeight: '700', fontSize: fs.sm }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={save}
              disabled={!deadline || saving}
              style={[styles.pill, { backgroundColor: colors.tealDark }, (!deadline || saving) && { opacity: 0.5 }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ color: '#FFF', fontWeight: '900', fontSize: fs.sm }}>Reopen Voting</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', borderRadius: 24, borderWidth: 1, padding: 22, elevation: 16 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  pill: { flex: 1, paddingVertical: 13, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
});