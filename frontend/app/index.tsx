import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header Section */}
        <View style={styles.header}>
          {/* <Image 
            source={require('@assets/images/everwell-logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          /> */}
          <Text style={styles.title}>EverWell</Text>
          <Text style={styles.subtitle}>
            Track your mental and cognitive wellness daily — with fun, mindful exercises.
          </Text>
        </View>

        {/* Primary Action */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(tabs)/game')}
        >
          <IconSymbol name="heart.fill" size={22} color="#fff" />
          <Text style={styles.primaryButtonText}>Start Daily Check-In</Text>
        </TouchableOpacity>

        {/* Section Divider
        <Text style={styles.sectionTitle}>Your Tools for Growth</Text> */}
{/* 
        {/* Cards Section */}
        {/* <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: '#F7FAF7' }]}>
            <IconSymbol name="calendar.badge.exclamationmark" size={42} color="#6B8E6B" />
            <Text style={styles.cardTitle}>Daily Reflections</Text>
            <Text style={styles.cardDescription}>
              Answer gentle questions that track focus, memory, and mood each day.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: '#F9FDFB' }]}>
            <IconSymbol name="chart.bar.fill" size={42} color="#5A6B5A" />
            <Text style={styles.cardTitle}>Progress Insights</Text>
            <Text style={styles.cardDescription}>
              Visualize your wellness journey and notice positive patterns over time.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: '#FEFCF8' }]}>
            <IconSymbol name="gamecontroller.fill" size={42} color="#FF9500" />
            <Text style={styles.cardTitle}>Mind Games</Text>
            <Text style={styles.cardDescription}>
              Enjoy simple daily exercises to sharpen attention, memory, and reasoning.
            </Text>
          </View>
        </View>  */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F9F4', // soft light green gradient base
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 10,
  },
  title: {
    fontSize: 38,
    fontWeight: '700',
    color: '#4E5E4E',
    marginBottom: 10,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    color: '#6C7C6C',
    lineHeight: 26,
    paddingHorizontal: 15,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#4E5E4E',
    marginBottom: 20,
    marginTop: 30,
    textAlign: 'left',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B8E6B',
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: '#8EBB8E',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 10,
  },
  content: {
    gap: 20,
    marginBottom: 60,
  },
  card: {
    borderRadius: 18,
    padding: 28,
    shadowColor: '#B8C5B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EDE8',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#5A6B5A',
    marginTop: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 17,
    color: '#7A8B7A',
    textAlign: 'center',
    lineHeight: 25,
    paddingHorizontal: 6,
  },
});
