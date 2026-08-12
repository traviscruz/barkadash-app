import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { useResponsive } from '../../utils/responsive';
import { TripService } from '../../services/tripService';
import { DestinationPollOption } from '../../types/trip';
import {
  MapPin,
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  ThumbsUp,
  ChevronLeft,
  ChevronRight,
  X,
  User,
} from 'lucide-react-native';

// ──────────────────────────────────────────────
// Inline Calendar Component
// ──────────────────────────────────────────────
interface InlineCalendarProps {
  startDate: Date | null;
  endDate: Date | null;
  onRangeChange: (start: Date | null, end: Date | null) => void;
  accent: string;
  ink: string;
  muted: string;
  paper: string;
  border: string;
  isDark: boolean;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isBetween = (d: Date, s: Date, e: Date) => d > s && d < e;

const InlineCalendar: React.FC<InlineCalendarProps> = ({
  startDate, endDate, onRangeChange, accent, ink, muted, paper, border, isDark,
}) => {
  const [viewing, setViewing] = useState(() => {
    const d = startDate || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const prevMonth = () => setViewing(v => new Date(v.getFullYear(), v.getMonth() - 1, 1));
  const nextMonth = () => setViewing(v => new Date(v.getFullYear(), v.getMonth() + 1, 1));

  const daysInMonth = new Date(viewing.getFullYear(), viewing.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = startOfMonth(viewing).getDay();

  const handleDayPress = (day: number) => {
    const pressed = new Date(viewing.getFullYear(), viewing.getMonth(), day);
    if (!startDate || (startDate && endDate)) {
      onRangeChange(pressed, null);
    } else {
      if (pressed < startDate) {
        onRangeChange(pressed, startDate);
      } else {
        onRangeChange(startDate, pressed);
      }
    }
  };

  const cellSize = 36;
  const cells: React.ReactElement[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(<View key={`e${i}`} style={{ width: cellSize, height: cellSize }} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewing.getFullYear(), viewing.getMonth(), d);
    const today = new Date();
    const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isStart = startDate && isSameDay(date, startDate);
    const isEnd = endDate && isSameDay(date, endDate);
    const isInRange = startDate && endDate && isBetween(date, startDate, endDate);
    const isToday = isSameDay(date, today);

    let bg = 'transparent';
    let textColor = isPast ? (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') : ink;
    let borderRadius = 8;

    if (isStart || isEnd) {
      bg = accent;
      textColor = '#FFFFFF';
      borderRadius = 10;
    } else if (isInRange) {
      bg = isDark ? 'rgba(31,78,103,0.35)' : 'rgba(31,78,103,0.12)';
      borderRadius = 0;
    }

    cells.push(
      <TouchableOpacity
        key={d}
        disabled={isPast}
        onPress={() => handleDayPress(d)}
        activeOpacity={0.7}
        style={{
          width: cellSize,
          height: cellSize,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          borderRadius,
        }}
      >
        {isToday && !isStart && !isEnd && (
          <View style={{
            position: 'absolute',
            bottom: 4,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: accent,
          }} />
        )}
        <Text style={{
          fontSize: 13,
          fontWeight: isStart || isEnd ? '900' : isToday ? '800' : '500',
          color: textColor,
        }}>
          {d}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: border }}>
      {/* Month nav */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : paper }}>
        <TouchableOpacity onPress={prevMonth} style={{ padding: 4 }}>
          <ChevronLeft size={18} color={muted} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={{ fontSize: 14, fontWeight: '800', color: ink }}>
          {MONTHS[viewing.getMonth()]} {viewing.getFullYear()}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 4 }}>
          <ChevronRight size={18} color={muted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 10, paddingTop: 10, paddingBottom: 4, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FAFAFA' }}>
        {DAYS.map(d => (
          <View key={d} style={{ width: 36, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: muted, letterSpacing: 0.5 }}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Day cells */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingBottom: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FAFAFA' }}>
        {cells}
      </View>
    </View>
  );
};

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
interface TripVotingPollsSectionProps {
  tripId: string;
  onPollsUpdated?: () => void;
}

type PollTab = 'place' | 'date';

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtRange = (s: Date, e: Date) => `${fmtDate(s)} – ${fmtDate(e)}`;

export const TripVotingPollsSection: React.FC<TripVotingPollsSectionProps> = ({ tripId, onPollsUpdated }) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { fs, scale } = useResponsive();

  const userId = profile?.id || 'guest_user';
  const userName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || profile?.username || 'You';

  const [activeTab, setActiveTab] = useState<PollTab>('place');
  const [polls, setPolls] = useState<DestinationPollOption[]>(() => TripService.getInstance().getTripPolls(tripId));

  // Add place
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [placeInput, setPlaceInput] = useState('');
  const [placeNote, setPlaceNote] = useState('');

  // Add date
  const [showAddDate, setShowAddDate] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  // Edit
  const [editPoll, setEditPoll] = useState<DestinationPollOption | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editStart, setEditStart] = useState<Date | null>(null);
  const [editEnd, setEditEnd] = useState<Date | null>(null);

  // Delete
  const [delPoll, setDelPoll] = useState<DestinationPollOption | null>(null);

  const accent = colors.tealDark;
  const paper = colors.paper;
  const border = colors.cardBorder;
  const ink = colors.ink;
  const muted = colors.inkSoft;
  const surface = isDark ? 'rgba(255,255,255,0.04)' : colors.card;

  const refresh = useCallback(() => {
    setPolls(TripService.getInstance().getTripPolls(tripId));
    onPollsUpdated?.();
  }, [tripId, onPollsUpdated]);

  const submitPlace = () => {
    if (!placeInput.trim()) return;
    TripService.getInstance().addTripPollOption({ tripId, title: placeInput.trim(), type: 'place', subtitle: placeNote.trim() || undefined, userId, userName });
    setShowAddPlace(false); setPlaceInput(''); setPlaceNote('');
    refresh();
  };

  const submitDate = (s: Date, e: Date) => {
    TripService.getInstance().addTripPollOption({ tripId, title: fmtRange(s, e), type: 'date', subtitle: undefined, userId, userName });
    setShowAddDate(false); setRangeStart(null); setRangeEnd(null);
    refresh();
  };

  const openEdit = (p: DestinationPollOption) => {
    setEditPoll(p); setEditTitle(p.title); setEditNote(p.subtitle || '');
    setEditStart(null); setEditEnd(null);
  };

  const saveEdit = () => {
    if (!editPoll) return;
    const title = editPoll.type === 'date' && editStart && editEnd ? fmtRange(editStart, editEnd) : editTitle.trim();
    TripService.getInstance().updateTripPollOption(editPoll.id, tripId, title, editNote);
    setEditPoll(null); refresh();
  };

  const filtered = polls.filter(p => p.type === activeTab);
  const totalVotes = filtered.reduce((s, p) => s + p.votes, 0);

  // ── reusable pill style ──
  const pill = (bg: string, bd?: string) => ({
    paddingHorizontal: Math.round(16 * scale), paddingVertical: Math.round(9 * scale),
    borderRadius: 100, backgroundColor: bg, borderWidth: bd ? 1 : 0, borderColor: bd || 'transparent',
  });

  // ── Modal wrapper ──
  const SheetModal = ({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={S.backdrop} onPress={onClose}>
        <Pressable style={[S.sheet, { backgroundColor: paper, borderColor: border }]} onPress={() => {}}>
          <View style={S.sheetHead}>
            <Text style={{ fontSize: fs.md, fontWeight: '900', color: ink }}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={Math.round(20 * scale)} color={muted} />
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );

  const LabelText = ({ children }: { children: string }) => (
    <Text style={{ fontSize: fs.xs, fontWeight: '700', color: muted, marginBottom: 6, marginTop: 14 }}>{children}</Text>
  );

  const FieldWrap = ({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) => (
    <View style={[S.fieldWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', borderColor: border }]}>
      {icon}
      {children}
    </View>
  );

  return (
    <View style={[S.outer, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFD', borderColor: border }]}>
      {/* Header */}
      <View style={[S.header, { borderBottomColor: border }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fs.md, fontWeight: '900', color: ink, letterSpacing: -0.4 }}>Voting Polls</Text>
          <Text style={{ fontSize: fs.xs, color: muted, marginTop: 2 }}>Propose & vote on places or date ranges</Text>
        </View>
        <View style={{ backgroundColor: isDark ? 'rgba(31,78,103,0.3)' : colors.lightBlueBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 }}>
          <Text style={{ fontSize: Math.round(10 * scale), fontWeight: '900', color: accent }}>{filtered.length} options</Text>
        </View>
      </View>

      {/* Tab + Add */}
      <View style={[S.tabRow, { paddingHorizontal: 14 }]}>
        <View style={[S.seg, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2F7' }]}>
          {(['place', 'date'] as PollTab[]).map(tab => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity key={tab} onPress={() => setActiveTab(tab)} activeOpacity={0.8}
                style={[S.segTab, active && { backgroundColor: paper, elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3 }]}>
                {tab === 'place'
                  ? <MapPin size={Math.round(12 * scale)} color={active ? accent : muted} strokeWidth={2} />
                  : <CalendarDays size={Math.round(12 * scale)} color={active ? accent : muted} strokeWidth={2} />}
                <Text style={{ fontSize: Math.round(11 * scale), fontWeight: '800', color: active ? accent : muted }}>
                  {tab === 'place' ? 'Places' : 'Dates'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity activeOpacity={0.85}
          onPress={() => activeTab === 'place' ? setShowAddPlace(true) : setShowAddDate(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: accent, paddingHorizontal: Math.round(14 * scale), paddingVertical: Math.round(8 * scale), borderRadius: 100 }}>
          <Plus size={Math.round(14 * scale)} color="#FFF" strokeWidth={2.5} />
          <Text style={{ color: '#FFF', fontSize: Math.round(11 * scale), fontWeight: '800' }}>
            {activeTab === 'place' ? 'Place' : 'Date'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Cards */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 16, gap: 10 }}>
        {filtered.length === 0 ? (
          <View style={[S.empty, { borderColor: border }]}>
            {activeTab === 'place'
              ? <MapPin size={Math.round(24 * scale)} color={muted} strokeWidth={1.5} />
              : <CalendarDays size={Math.round(24 * scale)} color={muted} strokeWidth={1.5} />}
            <Text style={{ fontSize: fs.sm, color: muted, textAlign: 'center', marginTop: 8, fontWeight: '600' }}>
              {activeTab === 'place' ? 'No places yet. Propose one!' : 'No dates yet. Add one for your barkada!'}
            </Text>
          </View>
        ) : filtered.map(poll => {
          const voted = poll.votedUserIds.includes(userId);
          const isOwn = poll.createdByUserId === userId;
          const pct = totalVotes > 0 ? Math.round((poll.votes / totalVotes) * 100) : 0;

          return (
            <View key={poll.id} style={[S.card, { backgroundColor: surface, borderColor: voted ? accent : border }]}>
              {/* Top */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: activeTab === 'place' ? (isDark ? 'rgba(31,78,103,0.3)' : colors.lightBlueBg) : (isDark ? 'rgba(240,169,62,0.2)' : colors.lightOrangeBg) }}>
                  {activeTab === 'place'
                    ? <MapPin size={Math.round(15 * scale)} color={accent} strokeWidth={2} />
                    : <CalendarDays size={Math.round(15 * scale)} color={colors.orangeAccent} strokeWidth={2} />}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ fontSize: fs.base, fontWeight: '800', color: ink, letterSpacing: -0.2 }} numberOfLines={1}>{poll.title}</Text>
                  {!!poll.subtitle && <Text style={{ fontSize: fs.xs, color: muted, marginTop: 2 }} numberOfLines={1}>{poll.subtitle}</Text>}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                    <User size={Math.round(10 * scale)} color={muted} />
                    <Text style={{ fontSize: Math.round(10 * scale), color: muted, fontWeight: '600' }}>
                      {isOwn ? 'Proposed by you' : `Proposed by ${poll.createdByName}`}
                    </Text>
                  </View>
                </View>
                {isOwn && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity onPress={() => openEdit(poll)} style={{ width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }}>
                      <Pencil size={Math.round(13 * scale)} color={muted} strokeWidth={2} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setDelPoll(poll)} style={{ width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2' }}>
                      <Trash2 size={Math.round(13 * scale)} color="#EF4444" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Bar */}
              <View style={{ height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#E2E8F0', overflow: 'hidden' }}>
                <View style={{ width: `${pct}%`, height: '100%', borderRadius: 2, backgroundColor: voted ? accent : isDark ? '#4B5563' : '#CBD5E1' }} />
              </View>

              {/* Bottom */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <ThumbsUp size={Math.round(12 * scale)} color={voted ? accent : muted} strokeWidth={voted ? 2.5 : 1.8} />
                  <Text style={{ fontSize: fs.xs, color: voted ? accent : muted, fontWeight: '700' }}>
                    {poll.votes} {poll.votes === 1 ? 'vote' : 'votes'} · {pct}%
                  </Text>
                </View>
                <TouchableOpacity onPress={() => { TripService.getInstance().toggleVoteTripPoll(poll.id, tripId, userId); refresh(); }}
                  style={{ paddingHorizontal: Math.round(14 * scale), paddingVertical: Math.round(6 * scale), borderRadius: 100,
                    backgroundColor: voted ? accent : 'transparent', borderWidth: 1, borderColor: voted ? accent : border }}>
                  <Text style={{ fontSize: fs.xs, fontWeight: '800', color: voted ? '#FFF' : ink }}>{voted ? 'Voted' : 'Vote'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── Add Place Modal ── */}
      <SheetModal visible={showAddPlace} onClose={() => setShowAddPlace(false)} title="Propose a Place">
        <LabelText>Destination name</LabelText>
        <FieldWrap icon={<MapPin size={15} color={muted} strokeWidth={1.8} />}>
          <TextInput style={[S.input, { color: ink, fontSize: fs.sm }]}
            placeholder="e.g. El Nido, Baguio, Boracay"
            placeholderTextColor={muted} value={placeInput} onChangeText={setPlaceInput} autoFocus />
        </FieldWrap>
        <LabelText>Short description (optional)</LabelText>
        <FieldWrap>
          <TextInput style={[S.input, { color: ink, fontSize: fs.sm }]}
            placeholder="beaches, cold weather, nightlife..."
            placeholderTextColor={muted} value={placeNote} onChangeText={setPlaceNote} />
        </FieldWrap>
        <View style={S.actions}>
          <TouchableOpacity onPress={() => setShowAddPlace(false)} style={pill('transparent', border)}>
            <Text style={{ color: muted, fontWeight: '700', fontSize: fs.sm }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={submitPlace} style={pill(accent)}>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: fs.sm }}>Propose</Text>
          </TouchableOpacity>
        </View>
      </SheetModal>

      {/* ── Add Date Modal ── */}
      <Modal visible={showAddDate} transparent animationType="fade" onRequestClose={() => setShowAddDate(false)}>
        <Pressable style={S.backdrop} onPress={() => setShowAddDate(false)}>
          <Pressable style={[S.sheet, { backgroundColor: paper, borderColor: border, maxWidth: 420 }]} onPress={() => {}}>
            <View style={S.sheetHead}>
              <View>
                <Text style={{ fontSize: fs.md, fontWeight: '900', color: ink }}>Pick Date Range</Text>
                <Text style={{ fontSize: fs.xs, color: muted, marginTop: 2 }}>
                  {rangeStart && rangeEnd ? fmtRange(rangeStart, rangeEnd)
                    : rangeStart ? `Start: ${fmtDate(rangeStart)} — now tap end`
                    : 'Tap start date, then end date'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setShowAddDate(false); setRangeStart(null); setRangeEnd(null); }}>
                <X size={20} color={muted} />
              </TouchableOpacity>
            </View>

            <InlineCalendar
              startDate={rangeStart} endDate={rangeEnd}
              onRangeChange={(s, e) => {
                setRangeStart(s);
                setRangeEnd(e);
                // Auto-propose the moment a full range is selected
                if (s && e) submitDate(s, e);
              }}
              accent={accent} ink={ink} muted={muted} paper={paper} border={border} isDark={isDark}
            />

            {/* Cancel only — no propose button needed, auto-submits */}
            <TouchableOpacity
              onPress={() => { setShowAddDate(false); setRangeStart(null); setRangeEnd(null); }}
              style={{ marginTop: 16, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: border }}>
              <Text style={{ color: muted, fontWeight: '700', fontSize: fs.sm }}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal visible={!!editPoll} transparent animationType="fade" onRequestClose={() => setEditPoll(null)}>
        <Pressable style={S.backdrop} onPress={() => setEditPoll(null)}>
          <Pressable style={[S.sheet, { backgroundColor: paper, borderColor: border, maxWidth: 420 }]} onPress={() => {}}>
            <View style={S.sheetHead}>
              <Text style={{ fontSize: fs.md, fontWeight: '900', color: ink }}>Edit Option</Text>
              <TouchableOpacity onPress={() => setEditPoll(null)}><X size={20} color={muted} /></TouchableOpacity>
            </View>

            {editPoll?.type === 'place' ? (
              <>
                <Text style={{ fontSize: fs.xs, fontWeight: '700', color: muted, marginBottom: 6 }}>Place name</Text>
                <View style={[S.fieldWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', borderColor: border }]}>
                  <TextInput style={[S.input, { color: ink, fontSize: fs.sm }]} value={editTitle} onChangeText={setEditTitle} placeholderTextColor={muted} />
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: fs.xs, fontWeight: '700', color: muted, marginBottom: 6 }}>
                  {editStart && editEnd ? fmtRange(editStart, editEnd) : 'Tap to select new dates'}
                </Text>
                <InlineCalendar
                  startDate={editStart} endDate={editEnd}
                  onRangeChange={(s, e) => { setEditStart(s); setEditEnd(e); }}
                  accent={accent} ink={ink} muted={muted} paper={paper} border={border} isDark={isDark}
                />
              </>
            )}

            <Text style={{ fontSize: fs.xs, fontWeight: '700', color: muted, marginTop: 14, marginBottom: 6 }}>Notes</Text>
            <View style={[S.fieldWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', borderColor: border }]}>
              <TextInput style={[S.input, { color: ink, fontSize: fs.sm }]} value={editNote} onChangeText={setEditNote}
                placeholder="Short description..." placeholderTextColor={muted} />
            </View>

            <View style={S.actions}>
              <TouchableOpacity onPress={() => setEditPoll(null)} style={pill('transparent', border)}>
                <Text style={{ color: muted, fontWeight: '700', fontSize: fs.sm }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit} style={pill(accent)}>
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: fs.sm }}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Delete Modal ── */}
      <SheetModal visible={!!delPoll} onClose={() => setDelPoll(null)} title="Remove Option?">
        <Text style={{ fontSize: fs.sm, color: muted, marginBottom: 20 }}>
          "{delPoll?.title}" will be permanently removed.
        </Text>
        <View style={S.actions}>
          <TouchableOpacity onPress={() => setDelPoll(null)} style={pill('transparent', border)}>
            <Text style={{ color: muted, fontWeight: '700', fontSize: fs.sm }}>Keep</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { if (delPoll) { TripService.getInstance().deleteTripPollOption(delPoll.id, tripId); setDelPoll(null); refresh(); } }}
            style={pill('#EF4444')}>
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: fs.sm }}>Remove</Text>
          </TouchableOpacity>
        </View>
      </SheetModal>
    </View>
  );
};

// ── Static Styles ──────────────────────────────
const S = StyleSheet.create({
  outer: { borderWidth: 1, overflow: 'hidden', borderRadius: 20, marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1 },
  tabRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, gap: 10 },
  seg: { flexDirection: 'row', borderRadius: 100, padding: 3, flex: 1 },
  segTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, borderRadius: 100 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  empty: { alignItems: 'center', padding: 24, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 380, borderRadius: 24, borderWidth: 1, padding: 22, elevation: 16 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  fieldWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  input: { flex: 1, fontWeight: '600', padding: 0 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 20 },
});
