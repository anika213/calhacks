import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

interface AccuracyData {
  gameName: string;
  accuracy: number;
  gameType?: string;
  date: string;
  rawScore?: number;
  maxScore?: number;
}

interface MentalHealthData {
  responses: Array<{
    questionId: number;
    statement: string;
    score: number;
  }>;
  rawScore: number;
  accuracy: number;
  maxScore: number;
  completedAt: string;
  createdAt: string;
}

export default function TrackerScreen() {
  const { user, token } = useAuth();
  const [accuracyData, setAccuracyData] = useState<AccuracyData[]>([]);
  const [mentalHealthData, setMentalHealthData] = useState<MentalHealthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user && token) {
        fetchUserAccuracies();
      }
    }, [user, token])
  );


  const fetchUserAccuracies = async () => {
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAccuracyData(data.user.accuracies || []);
        setMentalHealthData(data.user.mhealth_games || []);
      } else {
        setError('Failed to fetch accuracy data');
      }
    } catch (error) {
      console.error('Error fetching accuracy data:', error);
      setError('Unable to load your progress');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics from accuracy data and mental health data
  const calculateStats = () => {
    // Process mental health data from mhealth_games array
    const mentalHealthEntries: AccuracyData[] = mentalHealthData.map(mh => ({
      gameName: 'Mental Health Assessment',
      accuracy: mh.accuracy,
      gameType: 'mental_health',
      date: mh.completedAt,
      rawScore: mh.rawScore,
      maxScore: mh.maxScore
    }));

    // Combine all data
    const allData = [...accuracyData, ...mentalHealthEntries];

    if (allData.length === 0) return null;

    const totalSessions = allData.length;
    const averageAccuracy = allData.reduce((sum, item) => sum + item.accuracy, 0) / totalSessions;
    const highestAccuracy = Math.max(...allData.map(item => item.accuracy));
    const cognitiveGames = allData.filter(item => item.gameType === 'cognitive');
    const mentalHealthGames = allData.filter(item => item.gameType === 'mental_health');

    return {
      totalSessions,
      averageAccuracy: Math.round(averageAccuracy),
      highestAccuracy,
      cognitiveCount: cognitiveGames.length,
      mentalHealthCount: mentalHealthGames.length
    };
  };

  const stats = calculateStats();
  const renderAccuracyChart = () => {
    // Process mental health data for chart
    const mentalHealthEntries: AccuracyData[] = mentalHealthData.map(mh => ({
      gameName: 'Mental Health Assessment',
      accuracy: mh.accuracy,
      gameType: 'mental_health',
      date: mh.completedAt,
      rawScore: mh.rawScore,
      maxScore: mh.maxScore
    }));

    // Combine all data
    const allData = [...accuracyData, ...mentalHealthEntries];

    if (allData.length === 0) return null;

    const cognitiveData = allData
      .filter(item => item.gameType === 'cognitive')
      .slice(-10);
    const mentalHealthChartData = allData
      .filter(item => item.gameType === 'mental_health')
      .slice(-10);

    const chartHeight = 160;
    const chartWidth = width - 100;
    const margin = { top: 20, right: 20, bottom: 40, left: 45 };

    const renderScatter = (data: AccuracyData[], title: string, color: string) => {
      if (data.length === 0) {
        return (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Text style={{ color: '#7A8B7A', fontSize: 14 }}>No data yet</Text>
          </View>
        );
      }

      const accuracies = data.map(item => item.accuracy);
      const maxAccuracy = Math.max(...accuracies);
      const minAccuracy = Math.min(...accuracies);
      const range = maxAccuracy - minAccuracy || 1;

      return (
        <View style={{ marginBottom: 30 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#5A6B5A',
              marginBottom: 10,
              textAlign: 'center',
            }}
          >
            {title}
          </Text>

          <View
            style={{
              height: chartHeight + margin.top + margin.bottom,
              width: width * 0.85, // responsive to screen width
              alignSelf: 'center',
              position: 'relative',
              backgroundColor: '#FAFAF9',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#E8EDE8',
              paddingLeft: margin.left + 10,
              paddingRight: margin.right + 10,
              paddingTop: margin.top + 10,
              paddingBottom: margin.bottom + 10,
              overflow: 'hidden', // <-- this stops scatter points from overflowing
              shadowColor: '#B8C5B8',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.1,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            {/* Y-axis line */}
            <View
              style={{
                position: 'absolute',
                left: margin.left,
                top: margin.top,
                bottom: margin.bottom,
                width: 1,
                backgroundColor: '#D1D6D1',
              }}
            />

            {/* X-axis line */}
            <View
              style={{
                position: 'absolute',
                left: margin.left,
                right: margin.right,
                bottom: margin.bottom,
                height: 1,
                backgroundColor: '#D1D6D1',
              }}
            />

            {/* Scatter points */}
            {data.map((item, index) => {
              const x =
                margin.left +
                (index / (data.length - 1 || 1)) * (chartWidth - margin.right);
              const y =
                margin.top +
                ((maxAccuracy - item.accuracy) / range) *
                (chartHeight - margin.top);

              return (
                <View
                  key={index}
                  style={{
                    position: 'absolute',
                    left: x - 5,
                    top: y - 5,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: color,
                  }}
                />
              );
            })}

            {/* Y-axis labels */}
            {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
              const value = maxAccuracy - t * range;
              const y = margin.top + t * (chartHeight - margin.top) - 6;
              return (
                <Text
                  key={`y-${i}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: y,
                    fontSize: 10,
                    color: '#7A8B7A',
                  }}
                >
                  {Math.round(value)}%
                </Text>
              );
            })}

            {/* X-axis labels */}
            {data.map((item, index) => {
              const x =
                margin.left +
                (index / (data.length - 1 || 1)) * (chartWidth - margin.right);
              const dateLabel = new Date(item.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });
              return (
                <Text
                  key={`x-${index}`}
                  style={{
                    position: 'absolute',
                    bottom: 5,
                    left: x - 15,
                    fontSize: 10,
                    color: '#7A8B7A',
                  }}
                >
                  {dateLabel}
                </Text>
              );
            })}
          </View>

          <View style={{ marginTop: 6, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#5A6B5A', fontWeight: '500' }}>
              Date →
            </Text>
          </View>
        </View>
      );
    };

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Your Accuracy Progress</Text>
        {renderScatter(cognitiveData, 'Cognitive Games', '#6B8E6B')}
        {renderScatter(mentalHealthChartData, 'Mental Health Games', '#8B6B8B')}
      </View>
    );
  };



  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Progress Tracker</Text>
          <Text style={styles.subtitle}>Your accuracy journey over time</Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <IconSymbol name="chart.bar.fill" size={60} color="#8E8E93" />
            <Text style={styles.loadingText}>Loading your progress...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <IconSymbol name="exclamationmark.triangle.fill" size={60} color="#FF6B6B" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : accuracyData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol name="chart.bar.fill" size={60} color="#8E8E93" />
            <Text style={styles.emptyText}>No game data yet</Text>
            <Text style={styles.emptySubtext}>Complete some games to see your progress!</Text>
          </View>
        ) : (
          <>
            {/* Statistics Cards */}
            {stats && (
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <IconSymbol name="gamecontroller.fill" size={24} color="#6B8E6B" />
                  <Text style={styles.statValue}>{stats.totalSessions}</Text>
                  <Text style={styles.statLabel}>Total Sessions</Text>
                </View>
                <View style={styles.statCard}>
                  <IconSymbol name="chart.line.uptrend.xyaxis" size={24} color="#34C759" />
                  <Text style={styles.statValue}>{stats.averageAccuracy}%</Text>
                  <Text style={styles.statLabel}>Average Score</Text>
                </View>
                <View style={styles.statCard}>
                  <IconSymbol name="star.fill" size={24} color="#FFD700" />
                  <Text style={styles.statValue}>{stats.highestAccuracy}%</Text>
                  <Text style={styles.statLabel}>Best Score</Text>
                </View>
                <View style={styles.statCard}>
                  <IconSymbol name="brain.head.profile" size={24} color="#8B6B8B" />
                  <Text style={styles.statValue}>{stats.cognitiveCount}</Text>
                  <Text style={styles.statLabel}>Cognitive Games</Text>
                </View>
              </View>
            )}

            {/* Accuracy Chart */}
            {renderAccuracyChart()}

            {/* Recent Games List */}
            <View style={styles.recentGamesContainer}>
              <Text style={styles.recentGamesTitle}>Recent Games</Text>
              {(() => {
                // Process mental health data for recent games
                const mentalHealthEntries: AccuracyData[] = mentalHealthData.map(mh => ({
                  gameName: 'Mental Health Assessment',
                  accuracy: mh.accuracy,
                  gameType: 'mental_health',
                  date: mh.completedAt,
                  rawScore: mh.rawScore,
                  maxScore: mh.maxScore
                }));

                // Combine all data and sort by date
                const allData = [...accuracyData, ...mentalHealthEntries]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5);

                return allData.map((item, index) => (
                  <View key={index} style={styles.gameItem}>
                    <View style={styles.gameInfo}>
                      <Text style={styles.gameName}>{item.gameName}</Text>
                      <Text style={styles.gameDate}>
                        {new Date(item.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                    <View style={styles.gameScore}>
                      <Text style={styles.scoreValue}>{item.accuracy}%</Text>
                      <View style={[
                        styles.gameTypeBadge,
                        { backgroundColor: item.gameType === 'cognitive' ? '#6B8E6B' : '#8B6B8B' }
                      ]}>
                        <Text style={styles.gameTypeText}>
                          {item.gameType === 'cognitive' ? 'Cognitive' : 'Mental Health'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ));
              })()}
            </View>
          </>
        )}
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
    fontSize: 28,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A', // Muted sage green
    marginBottom: 12,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#7A8B7A', // Soft muted green
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#7A8B7A',
    marginTop: 16,
    fontWeight: '400',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  errorText: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#FF6B6B',
    marginTop: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontFamily: 'System',
    color: '#5A6B5A',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '400',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    marginBottom: 30,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    width: (width - 60) / 2,
    alignItems: 'center',
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E8EDE8',
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontFamily: 'System',
    color: '#7A8B7A',
    textAlign: 'center',
    fontWeight: '500',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 30,
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
  chartTitle: {
    fontSize: 20,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  chartArea: {
    height: 220,
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 200,
  },
  barContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 200,
  },
  bar: {
    borderRadius: 4,
    marginBottom: 8,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 12,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 4,
  },
  barDate: {
    fontSize: 10,
    fontFamily: 'System',
    color: '#7A8B7A',
    textAlign: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    fontFamily: 'System',
    color: '#5A6B5A',
    fontWeight: '500',
  },
  recentGamesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 30,
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
  recentGamesTitle: {
    fontSize: 20,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  gameItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDE8',
  },
  gameInfo: {
    flex: 1,
  },
  gameName: {
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 4,
  },
  gameDate: {
    fontSize: 14,
    fontFamily: 'System',
    color: '#7A8B7A',
    fontWeight: '400',
  },
  gameScore: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#6B8E6B',
    marginBottom: 4,
  },
  gameTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gameTypeText: {
    fontSize: 12,
    fontFamily: 'System',
    fontWeight: '500',
    color: '#FFFFFF',
  },
});