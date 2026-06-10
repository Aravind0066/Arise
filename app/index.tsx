import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      
      {/* 1. Header Section */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Hey Rakthesh,</Text>
        <Text style={styles.title}>Let's Arise Today</Text>
      </View>

      {/* 2. Main Daily Progress Card */}
      <View style={styles.progressCard}>
        <Text style={styles.cardHeader}>Today's Target: Push Day</Text>
        <Text style={styles.cardSub}>0 of 5 exercises done</Text>
        
        {/* Simple Progress Bar Track */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: '20%' }]} />
        </View>
      </View>

      {/* 3. Action Button */}
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => alert('Workout Started!')}
      >
        <Text style={styles.buttonText}>Start Active Session</Text>
      </TouchableOpacity>

    </View>
  );
}

// All styling stays grouped right here at the bottom of your .tsx file
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A', // Ultra dark background
    paddingHorizontal: 24,
    paddingTop: 60,
    justifyContent: 'space-between', // Pushes sections apart cleanly
    paddingBottom: 40,
  },
  header: {
    marginTop: 20,
  },
  greeting: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  progressCard: {
    backgroundColor: '#161618',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#262629',
  },
  cardHeader: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  cardSub: {
    color: '#A1A1AA',
    fontSize: 14,
    marginTop: 6,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#2A2A2E',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#30D158', // Neon electric workout progress green
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});