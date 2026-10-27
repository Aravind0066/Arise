import { useThemedStyles } from '../lib/AppearanceContext';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface MorningBriefingModalProps {
  visible: boolean;
  hunterName: string;
  onDismiss: (completedCount: number) => void;
}

interface MorningTask {
  id: string;
  icon: string;
  title: string;
  xp: number;
  stat: string;
  done: boolean;
}

export function MorningBriefingModal({
  visible,
  hunterName,
  onDismiss,
}: MorningBriefingModalProps) {
  const themedStyles = useThemedStyles(styles);
  const [tasks, setTasks] = useState<MorningTask[]>([
    { id: 'm1', icon: '☀', title: 'SUNLIGHT // 10 Min Natural Outdoor Light', xp: 20, stat: '+2 Health', done: false },
    { id: 'm2', icon: '💧', title: 'HYDRATION // 750ml Pure Water Matrix', xp: 20, stat: '+2 Health', done: false },
    { id: 'm3', icon: '🛏', title: 'RESTORE ORDER // Make Bed & Declutter Room', xp: 15, stat: '+2 Discipline', done: false },
    { id: 'm4', icon: '🏃', title: 'PHYSIOLOGY // 10 Min Dynamic Mobility & Pushups', xp: 25, stat: '+2 Strength', done: false },
  ]);

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const handleFinish = () => {
    const completedCount = tasks.filter((t) => t.done).length;
    onDismiss(completedCount);
  };

  const completedCount = tasks.filter((t) => t.done).length;
  const isAllDone = completedCount === tasks.length;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={themedStyles.overlay}>
        <View style={themedStyles.modalCard}>
          <ScrollView contentContainerStyle={themedStyles.scroll}>
            <View style={themedStyles.header}>
              <View style={themedStyles.sysPill}>
                <Text style={themedStyles.sysPillText}>SYSTEM ONLINE</Text>
              </View>
              <Text style={themedStyles.greeting}>GOOD MORNING, {hunterName.toUpperCase()}</Text>
              <Text style={themedStyles.subGreeting}>
                Today’s awakening protocol is active. Complete morning directives to initiate the 1.25x daily XP multiplier.
              </Text>
            </View>

            <View style={themedStyles.taskList}>
              {tasks.map((task) => (
                <Pressable
                  key={task.id}
                  style={[themedStyles.taskItem, task.done && themedStyles.taskItemDone]}
                  onPress={() => toggleTask(task.id)}
                >
                  <View style={themedStyles.taskIconBox}>
                    <Text style={themedStyles.taskIcon}>{task.icon}</Text>
                  </View>
                  <View style={themedStyles.taskDetails}>
                    <Text style={[themedStyles.taskTitle, task.done && themedStyles.taskTitleDone]}>
                      {task.title}
                    </Text>
                    <Text style={themedStyles.taskReward}>
                      +{task.xp} XP · {task.stat}
                    </Text>
                  </View>
                  <View style={[themedStyles.checkbox, task.done && themedStyles.checkboxDone]}>
                    <Text style={themedStyles.checkMark}>{task.done ? '✓' : ''}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={themedStyles.multiplierBox}>
              <Text style={themedStyles.multiplierText}>
                {isAllDone
                  ? '⚡ 1.25x DAILY XP MULTIPLIER UNLOCKED'
                  : `PROGRESS: ${completedCount} / ${tasks.length} MORNING DIRECTIVES`}
              </Text>
            </View>

            <Pressable style={themedStyles.engageButton} onPress={handleFinish}>
              <Text style={themedStyles.engageButtonText}>
                {isAllDone ? 'PROTOCOL ENGAGED ➔' : 'DISMISS & ENTER HUD'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 12, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#071524',
    borderWidth: 1,
    borderColor: '#00f3ff',
    borderRadius: 8,
    padding: 20,
    maxHeight: '90%',
  },
  scroll: {
    paddingBottom: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  sysPill: {
    backgroundColor: 'rgba(0, 243, 255, 0.12)',
    borderColor: '#00f3ff',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 10,
  },
  sysPillText: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  greeting: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subGreeting: {
    color: '#7fa3bf',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
  taskList: {
    gap: 10,
    marginVertical: 12,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a1e33',
    borderWidth: 1,
    borderColor: '#193955',
    padding: 12,
    borderRadius: 6,
  },
  taskItemDone: {
    borderColor: '#00f3ff',
    backgroundColor: 'rgba(0, 243, 255, 0.08)',
  },
  taskIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#061321',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  taskIcon: {
    fontSize: 16,
  },
  taskDetails: {
    flex: 1,
  },
  taskTitle: {
    color: '#e6fbff',
    fontSize: 12,
    fontWeight: '800',
  },
  taskTitleDone: {
    color: '#7195af',
    textDecorationLine: 'line-through',
  },
  taskReward: {
    color: '#00f3ff',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderColor: '#3a668c',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  checkboxDone: {
    backgroundColor: '#00f3ff',
    borderColor: '#00f3ff',
  },
  checkMark: {
    color: '#02060c',
    fontWeight: '900',
    fontSize: 13,
  },
  multiplierBox: {
    backgroundColor: '#0d253f',
    borderWidth: 1,
    borderColor: '#24517b',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginVertical: 12,
  },
  multiplierText: {
    color: '#fbb03b',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  engageButton: {
    backgroundColor: '#00f3ff',
    padding: 14,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 6,
  },
  engageButtonText: {
    color: '#02060c',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
});
