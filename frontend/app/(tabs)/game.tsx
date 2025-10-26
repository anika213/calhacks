import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { TrafficLightBadge } from '@/components/games/TrafficLightBadge';
import { StroopGame } from '@/components/games/StroopGame';
import { MemoryGame } from '@/components/games/MemoryGame';
import { PictureNamingGame } from '@/components/games/PictureNamingGame';
import { useGameSessions } from '@/contexts/GameSessionContext';
import {
  AnySessionRecord,
  GameKey,
  MemorySessionRecord,
  NamingSessionRecord,
  StroopSessionRecord,
  TrafficLightStatus,
  TrendDirection,
} from '@/types/games';

const GAME_CATALOG: Array<{
  key: GameKey;
  title: string;
  description: string;
  icon: string;
  accent: string;
}> = [
  {
    key: 'stroop',
    title: 'Stroop challenge',
    description: 'Match the ink color, not the word you read.',
    icon: 'textformat',
    accent: '#6B8E6B',
  },
  {
    key: 'memory',
    title: 'List recall',
    description: 'Encode a list and see how much you remember later.',
    icon: 'list.bullet.rectangle',
    accent: '#8B6B8B',
  },
  {
    key: 'naming',
    title: 'Picture naming',
    description: 'Identify everyday objects quickly and accurately.',
    icon: 'photo.on.rectangle',
    accent: '#F4B400',
  },
];

const GAME_LABEL: Record<GameKey, string> = {
  stroop: 'Stroop challenge',
  memory: 'List recall',
  naming: 'Picture naming',
};

type ActiveGame = GameKey | null;

type HistoryEntry = {
  id: string;
  gameKey: GameKey;
  completedAt: number;
  primaryMetric: string;
  status: string;
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const buildStroopSummary = (session?: StroopSessionRecord | null) => {
  if (!session) {
    return null;
  }
  const { metrics } = session;
  return [
    { label: 'Accuracy', value: `${metrics.accuracyPct.toFixed(1)}%` },
    { label: 'Median RT', value: `${Math.round(metrics.medianRtMs)} ms` },
    { label: 'Composite', value: metrics.compositeScore.toFixed(0) },
  ];
};

const buildMemorySummary = (session?: MemorySessionRecord | null) => {
  if (!session) {
    return null;
  }
  const { metrics } = session;
  return [
    { label: 'Immediate', value: `${metrics.immediateRecallPct.toFixed(1)}%` },
    { label: 'Delayed', value: metrics.delayedRecallPct !== null ? `${metrics.delayedRecallPct.toFixed(1)}%` : '—' },
    { label: 'Score', value: metrics.memoryScore.toFixed(0) },
  ];
};

const buildNamingSummary = (session?: NamingSessionRecord | null) => {
  if (!session) {
    return null;
  }
  const { metrics } = session;
  return [
    { label: 'Accuracy', value: `${metrics.accuracyPct.toFixed(1)}%` },
    { label: 'Median RT', value: `${Math.round(metrics.medianRtMs)} ms` },
    { label: 'Score', value: metrics.namingScore.toFixed(0) },
  ];
};

const getBadgeReadout = (session?: AnySessionRecord | null): { status: TrafficLightStatus; trend: TrendDirection } | null => {
  if (!session) {
    return null;
  }
  const metrics = (session as StroopSessionRecord | MemorySessionRecord | NamingSessionRecord).metrics;
  return {
    status: metrics.trafficLight,
    trend: metrics.trend,
  };
};

const buildHistoryEntries = (history: Record<GameKey, AnySessionRecord[]>): HistoryEntry[] => {
  const result: HistoryEntry[] = [];
  (Object.keys(history) as GameKey[]).forEach(gameKey => {
    history[gameKey].slice(-3).forEach(session => {
      result.push({
        id: `${gameKey}-${session.completedAt}`,
        gameKey,
        completedAt: session.completedAt,
        primaryMetric: (() => {
          switch (gameKey) {
            case 'stroop':
              return `${(session as StroopSessionRecord).metrics.accuracyPct.toFixed(1)}% accuracy`;
            case 'memory':
              return `${(session as MemorySessionRecord).metrics.immediateRecallPct.toFixed(1)}% immediate recall`;
            case 'naming':
              return `${(session as NamingSessionRecord).metrics.accuracyPct.toFixed(1)}% accuracy`;
            default:
              return '';
          }
        })(),
        status: (() => {
          switch (gameKey) {
            case 'stroop':
              return (session as StroopSessionRecord).metrics.trafficLight;
            case 'memory':
              return (session as MemorySessionRecord).metrics.trafficLight;
            case 'naming':
              return (session as NamingSessionRecord).metrics.trafficLight;
          }
        })() as string,
      });
    });
  });

  return result.sort((a, b) => b.completedAt - a.completedAt).slice(0, 5);
};

export default function GameScreen() {
  const { history, latestByGame, compositeIndex } = useGameSessions();
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);
  const router = useRouter();

  const latestStroop = latestByGame.stroop as StroopSessionRecord | undefined;
  const latestMemory = latestByGame.memory as MemorySessionRecord | undefined;
  const latestNaming = latestByGame.naming as NamingSessionRecord | undefined;

  const historyEntries = useMemo(() => buildHistoryEntries(history), [history]);

  if (activeGame === 'stroop') {
    return (
      <StroopGame
        onClose={() => setActiveGame(null)}
        onSessionComplete={() => setActiveGame(null)}
      />
    );
  }

  if (activeGame === 'memory') {
    return (
      <MemoryGame
        onClose={() => setActiveGame(null)}
        onSessionComplete={() => setActiveGame(null)}
      />
    );
  }

  if (activeGame === 'naming') {
    return (
      <PictureNamingGame
        onClose={() => setActiveGame(null)}
        onSessionComplete={() => setActiveGame(null)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Cognitive studio</Text>
              <Text style={styles.heroSubtitle}>Track focus, memory, and language with daily sessions.</Text>
            </View>
            <IconSymbol name="brain.head.profile" size={40} color="#6B8E6B" />
          </View>

          <View style={styles.compositeCard}>
            <Text style={styles.compositeLabel}>Composite index</Text>
            <Text style={styles.compositeValue}>{compositeIndex !== null ? compositeIndex.toFixed(0) : '—'}</Text>
            <View style={styles.compositeBadges}>
              {latestStroop && <TrafficLightBadge status={latestStroop.metrics.trafficLight} trend={latestStroop.metrics.trend} compact />}
              {latestMemory && <TrafficLightBadge status={latestMemory.metrics.trafficLight} trend={latestMemory.metrics.trend} compact />}
              {latestNaming && <TrafficLightBadge status={latestNaming.metrics.trafficLight} trend={latestNaming.metrics.trend} compact />}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Games</Text>
        <View style={styles.gameGrid}>
          {GAME_CATALOG.map(item => {
            const latestSession = (() => {
              switch (item.key) {
                case 'stroop':
                  return latestStroop;
                case 'memory':
                  return latestMemory;
                case 'naming':
                  return latestNaming;
                default:
                  return undefined;
              }
            })();

            const summaryRows = (() => {
              switch (item.key) {
                case 'stroop':
                  return buildStroopSummary(latestSession as StroopSessionRecord | undefined);
                case 'memory':
                  return buildMemorySummary(latestSession as MemorySessionRecord | undefined);
                case 'naming':
                  return buildNamingSummary(latestSession as NamingSessionRecord | undefined);
                default:
                  return null;
              }
            })();

            return (
              <TouchableOpacity
                key={item.key}
                style={styles.gameCard}
                onPress={() => setActiveGame(item.key)}
              >
                <View style={styles.gameHeader}>
                  <View style={[styles.iconBadge, { backgroundColor: `${item.accent}1A` }]}>
                    <IconSymbol name={item.icon as any} size={24} color={item.accent} />
                  </View>
                  {(() => {
                    const badge = getBadgeReadout(latestSession || null);
                    if (!badge) {
                      return <Text style={styles.noDataLabel}>No sessions yet</Text>;
                    }
                    return <TrafficLightBadge status={badge.status} trend={badge.trend} compact />;
                  })()}
                </View>
                <Text style={styles.gameTitle}>{item.title}</Text>
                <Text style={styles.gameDescription}>{item.description}</Text>
                {summaryRows && (
                  <View style={styles.summaryRow}>
                    {summaryRows.map(row => (
                      <View key={`${item.key}-${row.label}`} style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>{row.label}</Text>
                        <Text style={styles.summaryValue}>{row.value}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Mental Health</Text>
        <TouchableOpacity
          style={styles.mentalHealthCard}
          onPress={() => router.push('/(tabs)/mhealth')}
        >
          <View style={styles.gameHeader}>
            <View style={[styles.iconBadge, { backgroundColor: '#E8F0E8' }]}>
              <IconSymbol name="heart.fill" size={24} color="#6B8E6B" />
            </View>
          </View>
          <Text style={styles.gameTitle}>Mental Health Assessment</Text>
          <Text style={styles.gameDescription}>
            Complete the WHO-5 Well-Being Index to track your mental wellness.
          </Text>
        </TouchableOpacity>

        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <IconSymbol name="clock" size={18} color="#6B8E6B" />
            <Text style={styles.historyTitle}>Recent sessions</Text>
          </View>
          {historyEntries.length === 0 ? (
            <Text style={styles.historyEmpty}>Play a session to see history here.</Text>
          ) : (
            historyEntries.map(entry => (
              <View key={entry.id} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyGame}>{GAME_LABEL[entry.gameKey]}</Text>
                  <Text style={styles.historyTimestamp}>{formatDate(entry.completedAt)}</Text>
                </View>
                <Text style={styles.historyMetric}>{entry.primaryMetric}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F9F4',
  },
  content: {
    padding: 20,
    gap: 22,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 18,
    shadowColor: '#B8C5B8',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4E5E4E',
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#6C7C6C',
    lineHeight: 20,
  },
  compositeCard: {
    backgroundColor: '#F7FDF7',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0EAE0',
    gap: 8,
  },
  compositeLabel: {
    fontSize: 13,
    color: '#5A6B5A',
    fontWeight: '600',
  },
  compositeValue: {
    fontSize: 34,
    fontWeight: '700',
    color: '#4E5E4E',
  },
  compositeBadges: {
    flexDirection: 'row',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4E5E4E',
  },
  gameGrid: {
    gap: 16,
  },
  gameCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: '#B8C5B8',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  mentalHealthCard: {
    backgroundColor: '#F9FDF9',
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 2,
    borderColor: '#E8F0E8',
    shadowColor: '#B8C5B8',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataLabel: {
    fontSize: 12,
    color: '#8A9A8A',
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4E5E4E',
  },
  gameDescription: {
    fontSize: 14,
    color: '#6C7C6C',
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: '#F0F5F0',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6C7C6C',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E5E4E',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 14,
    shadowColor: '#B8C5B8',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E5E4E',
  },
  historyEmpty: {
    fontSize: 14,
    color: '#6C7C6C',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  historyGame: {
    fontSize: 14,
    color: '#5A6B5A',
    fontWeight: '500',
  },
  historyTimestamp: {
    fontSize: 12,
    color: '#8A9A8A',
  },
  historyMetric: {
    fontSize: 13,
    color: '#4E5E4E',
    fontWeight: '600',
  },
});
