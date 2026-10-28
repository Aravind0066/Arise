import { useAppearance, useThemedStyles } from '../lib/AppearanceContext';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from '../components/BottomNavigation';
import {
  getHunterProfile,
  resetAllData,
} from '../lib/hunterStorage';
import { HunterProfile } from '../lib/hunterTypes';

export default function ProfileScreen() {
  const { theme } = useAppearance();
  const themedStyles = useThemedStyles(styles);
  const router = useRouter();
  const [profile, setProfile] = useState<HunterProfile | null>(null);
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    const p = await getHunterProfile();
    setProfile(p);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const executeDelete = async () => {
    try {
      await resetAllData();
      setProfile(null);
      router.replace('/');
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to remove account data';
      setNotice(`ACCOUNT DELETION FAILED: ${errorMsg}`);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Account deletion failed: ${errorMsg}`);
      } else {
        Alert.alert('Deletion Error', errorMsg);
      }
    }
  };

  const handleResetProfile = () => {
    const title = 'Delete Hunter Account?';
    const message = 'This will permanently remove your hunter profile, stats, active quests, and progression history. Appearance preferences will be preserved. Are you sure you want to proceed?';

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
        executeDelete();
      }
    } else {
      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Account',
            style: 'destructive',
            onPress: executeDelete,
          },
        ]
      );
    }
  };

  // BMI Calculation
  const bmi = profile?.height && profile.weight
    ? (profile.weight / ((profile.height / 100) ** 2)).toFixed(1)
    : null;

  return (
    <View style={themedStyles.root}>
      <SafeAreaView style={themedStyles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={themedStyles.content}>
          <View style={themedStyles.header}>
            <View>
              <Text style={themedStyles.systemTag}>Hunter Profile</Text>
              <Text style={themedStyles.title}>CHARACTER SHEET</Text>
            </View>
            <Pressable
              style={themedStyles.settingsBtn}
              onPress={() => router.push('/settings')}
            >
              <Text style={themedStyles.settingsBtnText}>⚙ SETTINGS</Text>
            </Pressable>
          </View>

          {notice ? (
            <View style={themedStyles.noticeBox}>
              <Text style={themedStyles.noticeText}>⚡ {notice}</Text>
            </View>
          ) : null}

          {/* Dossier Card */}
          <View style={themedStyles.card}>
            <View style={themedStyles.dossierTop}>
              <View style={themedStyles.avatarGlow}>
                <Text style={themedStyles.avatarText}>
                  {profile?.name ? profile.name.slice(0, 2).toUpperCase() : 'SJ'}
                </Text>
              </View>
              <View style={themedStyles.dossierMeta}>
                <View style={themedStyles.rankPill}>
                  <Text style={themedStyles.rankPillText}>{profile?.rank || 'E-RANK'}</Text>
                </View>
                <Text style={themedStyles.name}>{profile?.name || 'Hunter'}</Text>
                <Text style={themedStyles.userTitle}>[ {profile?.title || 'THE AWAKENED'} ]</Text>
                <Text style={themedStyles.email}>{profile?.email || 'Email not set'}</Text>
              </View>
            </View>

            {/* Biometrics Grid */}
            <View style={themedStyles.bioGrid}>
              <View style={themedStyles.bioBox}>
                <Text style={themedStyles.bioLabel}>HEIGHT</Text>
                <Text style={themedStyles.bioVal}>{profile?.height ? `${profile.height} cm` : 'Not set'}</Text>
              </View>
              <View style={themedStyles.bioBox}>
                <Text style={themedStyles.bioLabel}>WEIGHT</Text>
                <Text style={themedStyles.bioVal}>{profile?.weight ? `${profile.weight} kg` : 'Not set'}</Text>
              </View>
              <View style={themedStyles.bioBox}>
                <Text style={themedStyles.bioLabel}>BMI INDEX</Text>
                <Text style={themedStyles.bioVal}>{bmi ?? 'Not set'}</Text>
              </View>
              <View style={themedStyles.bioBox}>
                <Text style={themedStyles.bioLabel}>FOCUS</Text>
                <Text style={themedStyles.bioValSmall}>{profile?.studyFocus || 'Not set'}</Text>
              </View>
            </View>
          </View>

          <View style={themedStyles.card}>
            <Text style={themedStyles.cardHeaderTitle}>TRAINING PROFILE</Text>
            <View style={themedStyles.profileDetailsList}>
              <View style={themedStyles.profileDetailRow}>
                <Text style={themedStyles.profileDetailLabel}>FITNESS LEVEL</Text>
                <Text style={themedStyles.profileDetailValue}>{profile?.fitnessLevel || 'Not set'}</Text>
              </View>
              <View style={themedStyles.profileDetailRow}>
                <Text style={themedStyles.profileDetailLabel}>PRIMARY GOAL</Text>
                <Text style={themedStyles.profileDetailValue}>{profile?.primaryGoal || 'Not set'}</Text>
              </View>
              <View style={themedStyles.profileDetailRow}>
                <Text style={themedStyles.profileDetailLabel}>WEEKLY REST DAY</Text>
                <Text style={themedStyles.profileDetailValue}>{profile?.restDay || 'Not set'}</Text>
              </View>
            </View>
          </View>

          {/* Appearance & Themes Configuration Card */}
          <Pressable
            style={themedStyles.settingsCard}
            onPress={() => router.push('/settings')}
          >
            <View style={themedStyles.settingsCardLeft}>
              <Text style={themedStyles.settingsCardIcon}>🎨</Text>
              <View>
                <Text style={themedStyles.settingsCardTag}>Appearance</Text>
                <Text style={themedStyles.settingsCardTitle}>THEMES & TYPOGRAPHY</Text>
                <Text style={themedStyles.settingsCardSub}>Customize HUD colors & text scale</Text>
              </View>
            </View>
            <Text style={themedStyles.settingsCardArrow}>➔</Text>
          </Pressable>

          <Pressable style={themedStyles.historyEntry} onPress={() => router.push('/history')}>
            <View style={themedStyles.settingsCardLeft}>
              <Text style={themedStyles.settingsCardIcon}>📜</Text>
              <View>
                <Text style={themedStyles.settingsCardTag}>Records</Text>
                <Text style={themedStyles.settingsCardTitle}>LOGS & HISTORY</Text>
                <Text style={themedStyles.settingsCardSub}>Review completed quests and progression entries</Text>
              </View>
            </View>
            <Text style={themedStyles.settingsCardArrow}>➔</Text>
          </Pressable>

          {/* System Reset / Diagnostic action */}
          <View style={themedStyles.resetContainer}>
            <Pressable style={themedStyles.resetBtn} onPress={handleResetProfile}>
              <Text style={themedStyles.resetBtnText}>DELETE HUNTER ACCOUNT & RESET PROGRESSION</Text>
            </Pressable>
          </View>
        </ScrollView>
        <BottomNavigation active="system" />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#040b14',
  },
  safe: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  settingsBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#071626',
    borderWidth: 1,
    borderColor: '#00f3ff',
  },
  settingsBtnText: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  systemTag: {
    color: '#00f3ff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  noticeBox: {
    backgroundColor: '#0b233a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00f3ff',
    padding: 10,
    marginBottom: 14,
  },
  noticeText: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#071626',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#163b5e',
    padding: 16,
    marginBottom: 14,
  },
  dossierTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarGlow: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0f2b48',
    borderWidth: 2,
    borderColor: '#00f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#00f3ff',
    fontSize: 22,
    fontWeight: '900',
  },
  dossierMeta: {
    flex: 1,
  },
  rankPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#1b1236',
    borderWidth: 1,
    borderColor: '#9d4edd',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  rankPillText: {
    color: '#c084fc',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  name: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  userTitle: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  email: {
    color: '#557c9c',
    fontSize: 10,
    marginTop: 2,
  },
  levelProgressContainer: {
    backgroundColor: '#0a1d30',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  levelBadgeText: {
    color: '#00f3ff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  levelXpText: {
    color: '#7ba0c0',
    fontSize: 10,
    fontWeight: '700',
  },
  levelTrack: {
    height: 6,
    backgroundColor: '#10273c',
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    backgroundColor: '#00f3ff',
  },
  bioGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  bioBox: {
    flex: 1,
    backgroundColor: '#0a1d30',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  bioLabel: {
    color: '#527c9c',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  bioVal: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  bioValSmall: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  profileDetailsList: { gap: 10 },
  profileDetailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#112b42' },
  profileDetailLabel: { color: '#587c98', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  profileDetailValue: { color: '#d9eaf5', fontSize: 11, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  cardHeaderTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statBarsList: {
    gap: 10,
  },
  barItem: {},
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barName: {
    color: '#8aaecb',
    fontSize: 11,
    fontWeight: '800',
  },
  barScore: {
    fontSize: 11,
    fontWeight: '900',
  },
  barTrack: {
    height: 5,
    backgroundColor: '#0f2438',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  recordsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  recordBox: {
    flex: 1,
    backgroundColor: '#0a1d30',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#173f67',
    paddingVertical: 12,
    alignItems: 'center',
  },
  recordLabel: {
    color: '#557f9f',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  recordVal: {
    color: '#00f3ff',
    fontSize: 16,
    fontWeight: '900',
  },
  badgeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeCounter: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '900',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeItem: {
    width: '48%',
    backgroundColor: '#091828',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#14314c',
    padding: 10,
    opacity: 0.5,
  },
  badgeItemUnlocked: {
    borderColor: '#00f3ff',
    backgroundColor: '#0b233a',
    opacity: 1,
  },
  badgeIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  badgeTitle: {
    color: '#6e93b2',
    fontSize: 11,
    fontWeight: '900',
  },
  badgeTitleUnlocked: {
    color: '#ffffff',
  },
  badgeDesc: {
    color: '#527796',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 2,
    marginBottom: 8,
  },
  badgeStatus: {
    paddingVertical: 2,
    borderRadius: 3,
    alignItems: 'center',
  },
  badgeStatusLocked: {
    backgroundColor: '#0d1e2e',
  },
  badgeStatusDone: {
    backgroundColor: '#00f3ff22',
  },
  badgeStatusText: {
    color: '#4f728f',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  badgeStatusTextDone: {
    color: '#00f3ff',
  },
  resetContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  resetBtn: {
    backgroundColor: '#1b1219',
    borderWidth: 1,
    borderColor: '#ff5376',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetBtnText: {
    color: '#ff5376',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  settingsCard: {
    backgroundColor: '#071626',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#163b5e',
    borderLeftWidth: 4,
    borderLeftColor: '#00f3ff',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  historyEntry: {
    backgroundColor: '#071626',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#163b5e',
    borderLeftWidth: 4,
    borderLeftColor: '#38ef7d',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  settingsCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingsCardIcon: {
    fontSize: 24,
  },
  settingsCardTag: {
    color: '#00f3ff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  settingsCardTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  settingsCardSub: {
    color: '#557c9c',
    fontSize: 10,
    marginTop: 1,
  },
  settingsCardArrow: {
    color: '#00f3ff',
    fontSize: 16,
    fontWeight: '900',
    marginLeft: 8,
  },
});
