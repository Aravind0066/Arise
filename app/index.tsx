import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polygon, Circle, Line, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

// 1. Define strict Types & Interfaces
interface StatItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface QuestItem {
  id: number;
  icon: string;
  name: string;
  xp: number;
  done: boolean;
}

interface HunterData {
  name: string;
  level: number;
  currentXP: number;
  nextLevelXP: number;
  title: string;
  avatar: string;
}

// 2. Strongly typed mock data
const HUNTER: HunterData = { 
  name: 'Rakthesh', 
  level: 14, 
  currentXP: 720, 
  nextLevelXP: 1000, 
  title: 'The Awakening Hunter', 
  avatar: '🗡️' 
};

const STATS: StatItem[] = [
  { key: 'STR', label: 'Strength',    value: 71, color: '#FF4D6D' },
  { key: 'DIS', label: 'Discipline',  value: 58, color: '#7C5CFF' },
  { key: 'KNO', label: 'Knowledge',   value: 64, color: '#3FA9FF' },
  { key: 'HLT', label: 'Health',      value: 49, color: '#3DDC97' },
  { key: 'MIN', label: 'Mindfulness', value: 36, color: '#FFB454' },
];

const DAILY_PROGRESS = { completed: 6, total: 10 };

const ACTIVE_QUESTS: QuestItem[] = [
  { id: 1, icon: '☀', name: 'Sunlight Protocol',     xp: 15, done: true  },
  { id: 2, icon: '💧', name: 'Hydration Protocol',    xp: 30, done: true  },
  { id: 3, icon: '🏋', name: 'Strength Training',     xp: 50, done: false },
  { id: 4, icon: '📖', name: 'Knowledge Acquisition', xp: 80, done: false },
];

// 3. Component Props Interfaces
interface PentagonGraphProps {
  stats: StatItem[];
  size?: number;
}

interface ProgressRingProps {
  completed: number;
  total: number;
  size?: number;
}

// 4. Component Implementations
function PentagonGraph({ stats, size = 260 }: PentagonGraphProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const labelsRadius = size * 0.46;
  const gridLevels = [0.25, 0.5, 0.75, 1];

  const getPoint = (index: number, scale: number) => {
    const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
    return { 
      x: cx + radius * scale * Math.cos(angle), 
      y: cy + radius * scale * Math.sin(angle) 
    };
  };

  const statPoints = stats.map((s, i) => { 
    const p = getPoint(i, s.value / 100); 
    return `${p.x},${p.y}`; 
  }).join(' ');

  return (
    <View style={styles.graphContainer}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="pentagonGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%"   stopColor="#7C5CFF" stopOpacity="0.55" />
            <Stop offset="70%"  stopColor="#3FA9FF" stopOpacity="0.20" />
            <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={radius * 1.05} fill="url(#pentagonGlow)" />
        
        {gridLevels.map((level, idx) => {
          const points = stats.map((_, i) => { 
            const p = getPoint(i, level); 
            return `${p.x},${p.y}`; 
          }).join(' ');
          return <Polygon key={`grid-${idx}`} points={points} fill="none" stroke="#1F1F2E" strokeWidth={1} />;
        })}

        {stats.map((_, i) => { 
          const p = getPoint(i, 1); 
          return <Line key={`axis-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#1F1F2E" strokeWidth={1} />; 
        })}

        <Polygon points={statPoints} fill="#7C5CFF" fillOpacity={0.28} stroke="#7C5CFF" strokeWidth={2} />
        
        {stats.map((s, i) => { 
          const p = getPoint(i, s.value / 100); 
          return <Circle key={`pt-${i}`} cx={p.x} cy={p.y} r={4} fill={s.color} stroke="#0A0A0F" strokeWidth={2} />; 
        })}

        {stats.map((s, i) => {
          const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          const lx = cx + labelsRadius * Math.cos(angle);
          const ly = cy + labelsRadius * Math.sin(angle);
          return (
            <SvgText 
              key={`lbl-${i}`} 
              x={lx} 
              y={ly + 4} 
              fontSize="11" 
              fontWeight="700" 
              fill={s.color} 
              textAnchor="middle"
            >
              {s.key}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

function ProgressRing({ completed, total, size = 110 }: ProgressRingProps) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - completed / total);
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={radius} stroke="#1F1F2E" strokeWidth={stroke} fill="none" />
        <Circle 
          cx={center} 
          cy={center} 
          r={radius} 
          stroke="#3FA9FF" 
          strokeWidth={stroke} 
          fill="none" 
          strokeDasharray={`${circumference} ${circumference}`} 
          strokeDashoffset={dashOffset} 
          strokeLinecap="round" 
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringValue}>{completed}</Text>
        <Text style={styles.ringTotal}>/ {total}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const xpPercent = (HUNTER.currentXP / HUNTER.nextLevelXP) * 100;
  
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.topBar}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{HUNTER.avatar}</Text></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.systemLabel}>HUNTER</Text>
                <Text style={styles.hunterName}>{HUNTER.name}</Text>
              </View>
              <TouchableOpacity style={styles.iconBtn}>
                <Ionicons name="notifications-outline" size={22} color="#A1A1AA" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { marginLeft: 8 }]}>
                <Ionicons name="settings-outline" size={22} color="#A1A1AA" />
              </TouchableOpacity>
            </View>

            <View style={styles.levelRow}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelLabel}>LV</Text>
                <Text style={styles.levelNumber}>{HUNTER.level}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.titleText}>{HUNTER.title}</Text>
                <View style={styles.xpTrack}>
                  <View style={[styles.xpFill, { width: `${xpPercent}%` }]} />
                </View>
                <View style={styles.xpInfoRow}>
                  <Text style={styles.xpInfo}>{HUNTER.currentXP} / {HUNTER.nextLevelXP} XP</Text>
                  <Text style={styles.xpPercent}>{Math.round(xpPercent)}%</Text>
                </View>
              </View>
            </View>

            <View style={styles.unlockPreview}>
              <Ionicons name="lock-open-outline" size={14} color="#7C5CFF" />
              <Text style={styles.unlockText}>
                Level 15 Unlocks: <Text style={styles.unlockHighlight}>Advanced Plans</Text>{' · '}
                <Text style={styles.unlockHighlight}>New Badge</Text>{' · '}
                <Text style={styles.unlockHighlight}>Deep Focus</Text>
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>PENTAGONAL STATS</Text>
              <View style={styles.systemDot} />
            </View>
            <PentagonGraph stats={STATS} size={260} />
            <View style={styles.statList}>
              {STATS.map((s) => (
                <View key={s.key} style={styles.statRow}>
                  <View style={[styles.statDot, { backgroundColor: s.color }]} />
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <View style={styles.statBarTrack}>
                    <View style={[styles.statBarFill, { width: `${s.value}%`, backgroundColor: s.color }]} />
                  </View>
                  <Text style={styles.statValue}>{s.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>DAILY PROGRESS</Text>
              <View style={styles.systemDot} />
            </View>
            <View style={styles.ringRow}>
              <ProgressRing completed={DAILY_PROGRESS.completed} total={DAILY_PROGRESS.total} size={110} />
              <View style={{ flex: 1, marginLeft: 20 }}>
                <Text style={styles.ringTitle}>Today's Missions</Text>
                <Text style={styles.ringSub}>{DAILY_PROGRESS.completed} of {DAILY_PROGRESS.total} complete</Text>
                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>SYSTEM ACTIVE</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>ACTIVE QUESTS</Text>
              <TouchableOpacity><Text style={styles.seeAll}>SEE ALL</Text></TouchableOpacity>
            </View>
            {ACTIVE_QUESTS.map((q) => (
              <View key={q.id} style={[styles.questRow, q.done && styles.questRowDone]}>
                <View style={[styles.questIcon, q.done && styles.questIconDone]}>
                  <Text style={styles.questIconText}>{q.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.questName, q.done && styles.questNameDone]}>{q.name}</Text>
                  <Text style={styles.questXp}>+{q.xp} XP</Text>
                </View>
                <View style={[styles.questStatus, q.done ? styles.questStatusDone : styles.questStatusPending]}>
                  {/* Ionicons has specific string unions for type-safe names */}
                  <Ionicons name={q.done ? 'checkmark' : 'time-outline'} size={14} color={q.done ? '#3DDC97' : '#FFB454'} />
                  <Text style={[styles.questStatusText, { color: q.done ? '#3DDC97' : '#FFB454' }]}>
                    {q.done ? 'DONE' : 'PENDING'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0F' },
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  topBar: { marginBottom: 20 },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#16161F', borderWidth: 1, borderColor: '#7C5CFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22 },
  systemLabel: { color: '#7C5CFF', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  hunterName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#16161F', borderWidth: 1, borderColor: '#26262F', alignItems: 'center', justifyContent: 'center' },
  levelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  levelBadge: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#16161F', borderWidth: 1, borderColor: '#7C5CFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#7C5CFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8 },
  levelLabel: { color: '#7C5CFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  levelNumber: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: -2 },
  titleText: { color: '#E4E4E7', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  xpTrack: { height: 8, backgroundColor: '#1F1F2E', borderRadius: 4, overflow: 'hidden' },
  xpFill: { height: '100%', backgroundColor: '#7C5CFF', borderRadius: 4 },
  xpInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  xpInfo: { color: '#71717A', fontSize: 11, fontWeight: '600' },
  xpPercent: { color: '#7C5CFF', fontSize: 11, fontWeight: '700' },
  unlockPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16161F', borderWidth: 1, borderColor: '#2A2A3A', borderRadius: 12, padding: 12, marginTop: 4 },
  unlockText: { color: '#A1A1AA', fontSize: 12, marginLeft: 8, flex: 1, lineHeight: 18 },
  unlockHighlight: { color: '#7C5CFF', fontWeight: '700' },
  card: { backgroundColor: '#11111A', borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#1F1F2E' },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cardTitle: { color: '#E4E4E7', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  systemDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3DDC97', shadowColor: '#3DDC97', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 6 },
  graphContainer: { alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  statList: { marginTop: 16 },
  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  statLabel: { color: '#A1A1AA', fontSize: 12, fontWeight: '600', width: 90 },
  statBarTrack: { flex: 1, height: 6, backgroundColor: '#1F1F2E', borderRadius: 3, overflow: 'hidden', marginRight: 10 },
  statBarFill: { height: '100%', borderRadius: 3 },
  statValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', width: 28, textAlign: 'right' },
  ringRow: { flexDirection: 'row', alignItems: 'center' },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  ringTotal: { color: '#71717A', fontSize: 12, fontWeight: '700', marginTop: -2 },
  ringTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  ringSub: { color: '#A1A1AA', fontSize: 13, marginBottom: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F2A1F', borderWidth: 1, borderColor: '#1F5C3D', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3DDC97', marginRight: 6 },
  statusText: { color: '#3DDC97', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  seeAll: { color: '#7C5CFF', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  questRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16161F', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1F1F2E' },
  questRowDone: { opacity: 0.5 },
  questIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1F1F2E', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  questIconDone: { backgroundColor: '#0F2A1F' },
  questIconText: { fontSize: 18 },
  questName: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  questNameDone: { textDecorationLine: 'line-through', color: '#A1A1AA' },
  questXp: { color: '#7C5CFF', fontSize: 12, fontWeight: '700' },
  questStatus: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  questStatusDone: { backgroundColor: '#0F2A1F', borderColor: '#1F5C3D' },
  questStatusPending: { backgroundColor: '#2A1F0F', borderColor: '#5C4A1F' },
  questStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginLeft: 4 },
});