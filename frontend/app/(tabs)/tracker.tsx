import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';

const { width } = Dimensions.get('window');

export default function TrackerScreen() {
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  
  // Mock data for demonstration
  const progressData = {
    week: {
      sessions: 5,
      duration: 120, // minutes
      improvement: 15, // percentage
      streak: 3
    },
    month: {
      sessions: 18,
      duration: 450,
      improvement: 25,
      streak: 7
    },
    year: {
      sessions: 156,
      duration: 3900,
      improvement: 40,
      streak: 12
    }
  };

  const currentData = progressData[selectedPeriod as keyof typeof progressData];

  const StatCard = ({ title, value, subtitle, icon, color }: {
    title: string;
    value: string;
    subtitle: string;
    icon: any;
    color: string;
  }) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <IconSymbol name={icon} size={24} color={color} />
        <Text style={styles.statTitle}>{title}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSubtitle}>{subtitle}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Progress Tracker</Text>
          <Text style={styles.subtitle}>Monitor your therapy journey</Text>
        </View>

        <View style={styles.periodSelector}>
          <TouchableOpacity 
            style={[styles.periodButton, selectedPeriod === 'week' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('week')}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === 'week' && styles.periodButtonTextActive]}>
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.periodButton, selectedPeriod === 'month' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('month')}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === 'month' && styles.periodButtonTextActive]}>
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.periodButton, selectedPeriod === 'year' && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod('year')}
          >
            <Text style={[styles.periodButtonText, selectedPeriod === 'year' && styles.periodButtonTextActive]}>
              Year
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            title="Sessions"
            value={currentData.sessions.toString()}
            subtitle={`Completed this ${selectedPeriod}`}
            icon="calendar"
            color="#007AFF"
          />
          <StatCard
            title="Duration"
            value={`${currentData.duration}m`}
            subtitle="Total time spent"
            icon="clock.fill"
            color="#34C759"
          />
          <StatCard
            title="Improvement"
            value={`+${currentData.improvement}%`}
            subtitle="Cognitive enhancement"
            icon="chart.bar.fill"
            color="#FF9500"
          />
          <StatCard
            title="Streak"
            value={`${currentData.streak} days`}
            subtitle="Current streak"
            icon="flame.fill"
            color="#FF3B30"
          />
        </View>

        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Progress Chart</Text>
          <View style={styles.chartPlaceholder}>
            <IconSymbol name="chart.bar.fill" size={60} color="#8E8E93" />
            <Text style={styles.chartPlaceholderText}>
              Interactive chart would be displayed here
            </Text>
          </View>
        </View>

        <View style={styles.achievementsContainer}>
          <Text style={styles.achievementsTitle}>Recent Achievements</Text>
          <View style={styles.achievementItem}>
            <IconSymbol name="star.fill" size={24} color="#FFD700" />
            <View style={styles.achievementContent}>
              <Text style={styles.achievementTitle}>Consistent Practice</Text>
              <Text style={styles.achievementDescription}>Completed 5 sessions this week</Text>
            </View>
          </View>
          <View style={styles.achievementItem}>
            <IconSymbol name="trophy.fill" size={24} color="#FF9500" />
            <View style={styles.achievementContent}>
              <Text style={styles.achievementTitle}>Memory Master</Text>
              <Text style={styles.achievementDescription}>Improved memory recall by 20%</Text>
            </View>
          </View>
          <View style={styles.achievementItem}>
            <IconSymbol name="heart.fill" size={24} color="#FF3B30" />
            <View style={styles.achievementContent}>
              <Text style={styles.achievementTitle}>Mood Booster</Text>
              <Text style={styles.achievementDescription}>Enhanced emotional well-being</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFCF8', // Soft cream background
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A', // Muted sage green
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: 'System',
    color: '#7A8B7A', // Soft muted green
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  periodSelector: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E8EDE8',
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  periodButtonActive: {
    backgroundColor: '#6B8E6B', // Darker green for buttons
  },
  periodButtonText: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '500',
    color: '#7A8B7A',
    letterSpacing: 0.3,
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  statCard: {
    width: (width - 72) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    marginRight: 16,
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E8EDE8',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statTitle: {
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '500',
    color: '#7A8B7A',
    marginLeft: 12,
    letterSpacing: 0.2,
  },
  statValue: {
    fontSize: 28,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  statSubtitle: {
    fontSize: 14,
    fontFamily: 'System',
    color: '#7A8B7A',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  chartContainer: {
    marginHorizontal: 24,
    marginBottom: 30,
  },
  chartTitle: {
    fontSize: 22,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  chartPlaceholder: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 50,
    alignItems: 'center',
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E8EDE8',
  },
  chartPlaceholderText: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#7A8B7A',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  achievementsContainer: {
    marginHorizontal: 24,
    marginBottom: 30,
  },
  achievementsTitle: {
    fontSize: 22,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E8EDE8',
  },
  achievementContent: {
    marginLeft: 16,
    flex: 1,
  },
  achievementTitle: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  achievementDescription: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
});
