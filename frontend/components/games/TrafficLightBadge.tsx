import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { TrafficLightStatus, TrendDirection } from '@/types/games';

interface TrafficLightBadgeProps {
  status: TrafficLightStatus;
  trend?: TrendDirection;
  compact?: boolean;
}

const STATUS_COPY: Record<TrafficLightStatus, string> = {
  green: 'On Track',
  yellow: 'Monitor',
  red: 'Attention',
};

const STATUS_COLOR: Record<TrafficLightStatus, string> = {
  green: '#4CAF50',
  yellow: '#FFC107',
  red: '#F44336',
};

const TREND_ICON: Record<TrendDirection, string> = {
  up: '▲',
  down: '▼',
  flat: '■',
};

export const TrafficLightBadge: React.FC<TrafficLightBadgeProps> = ({ status, trend = 'flat', compact }) => {
  return (
    <View style={[styles.container, compact && styles.compactContainer, { backgroundColor: `${STATUS_COLOR[status]}22` }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Status ${STATUS_COPY[status]}, trend ${trend}`}
    >
      <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]} />
      {!compact && (
        <Text style={styles.label}>{STATUS_COPY[status]}</Text>
      )}
      <Text style={styles.trend}>{TREND_ICON[trend]}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
  },
  compactContainer: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A4A3A',
  },
  trend: {
    fontSize: 12,
    color: '#3A4A3A',
    marginLeft: 'auto',
  },
});
