import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import {
  AnySessionRecord,
  GameKey,
  MemoryListItem,
  MemoryRecallAttempt,
  MemorySessionRecord,

  NamingSessionRecord,
  NamingSettings,
  NamingTrialRecord,
  SessionContextInputs,
  StroopSessionRecord,
  StroopSettings,
  StroopTrialRecord,
  TrendDirection,
} from '@/types/games';
import {
  calculateTrendDirection,
  computeMemoryMetrics,
  computeNamingMetrics,
  computeStroopMetrics,
  deriveMemoryBaseline,
  deriveNamingBaseline,
  deriveStroopBaseline,
} from '@/utils/gameMetrics';

interface GameSessionState {
  history: Record<GameKey, AnySessionRecord[]>;
}

const createInitialState = (): GameSessionState => ({
  history: {
    stroop: [],
    memory: [],
    naming: [],
  },
});

export interface StroopSessionInput {
  trials: StroopTrialRecord[];
  settings: StroopSettings;
  context?: SessionContextInputs;
  startedAt: number;
  completedAt: number;
  practice?: boolean;
}

export interface MemorySessionInput {
  list: MemoryListItem[];
  attempts: MemoryRecallAttempt[];
  encodingDurationMs: number;
  context?: SessionContextInputs;
  startedAt: number;
  completedAt: number;
}

export interface NamingSessionInput {
  trials: NamingTrialRecord[];
  settings: NamingSettings;
  context?: SessionContextInputs;
  startedAt: number;
  completedAt: number;
}

interface GameSessionContextValue {
  history: Record<GameKey, AnySessionRecord[]>;
  latestByGame: Partial<Record<GameKey, AnySessionRecord>>;
  compositeIndex: number | null;
  finalizeStroopSession: (input: StroopSessionInput) => StroopSessionRecord;
  finalizeMemorySession: (input: MemorySessionInput) => MemorySessionRecord;
  finalizeNamingSession: (input: NamingSessionInput) => NamingSessionRecord;
  clearHistory: () => void;
}

const GameSessionContext = createContext<GameSessionContextValue | undefined>(undefined);
const MAX_SESSIONS_PER_GAME = 12;

const computeCompositeIndex = (latest: Partial<Record<GameKey, AnySessionRecord>>): number | null => {
  if (!Object.keys(latest).length) {
    return null;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  const stroopSession = latest.stroop as StroopSessionRecord | undefined;
  if (stroopSession) {
    weightedSum += stroopSession.metrics.compositeScore * 0.4;
    totalWeight += 0.4;
  }

  const memorySession = latest.memory as MemorySessionRecord | undefined;
  if (memorySession) {
    weightedSum += memorySession.metrics.memoryScore * 0.4;
    totalWeight += 0.4;
  }

  const namingSession = latest.naming as NamingSessionRecord | undefined;
  if (namingSession) {
    weightedSum += namingSession.metrics.namingScore * 0.2;
    totalWeight += 0.2;
  }

  if (!totalWeight) {
    return null;
  }

  return +(weightedSum / totalWeight).toFixed(2);
};

export const GameSessionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<GameSessionState>(() => createInitialState());

  const latestByGame = useMemo(() => {
    const result: Partial<Record<GameKey, AnySessionRecord>> = {};
    (Object.keys(state.history) as GameKey[]).forEach(gameKey => {
      const gameHistory = state.history[gameKey];
      if (gameHistory.length) {
        result[gameKey] = gameHistory[gameHistory.length - 1];
      }
    });
    return result;
  }, [state.history]);

  const compositeIndex = useMemo(() => computeCompositeIndex(latestByGame), [latestByGame]);

  const finalizeStroopSession = (input: StroopSessionInput): StroopSessionRecord => {
    let sessionRecord: StroopSessionRecord | null = null;

    setState(prev => {
      const previousHistory = prev.history.stroop as StroopSessionRecord[];
      const baseline = deriveStroopBaseline(previousHistory.map(session => session.metrics));
      const metricsBase = computeStroopMetrics(input.trials, baseline);
      const trendSource = previousHistory
        .map(session => session.metrics.compositeScore)
        .concat(metricsBase.compositeScore);
      const trend: TrendDirection = calculateTrendDirection(trendSource);

      sessionRecord = {
        gameKey: 'stroop',
        trials: input.trials,
        settings: input.settings,
        context: input.context,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        practice: Boolean(input.practice),
        metrics: { ...metricsBase, trend },
      };

      return {
        history: {
          ...prev.history,
          stroop: previousHistory.concat(sessionRecord).slice(-MAX_SESSIONS_PER_GAME),
        },
      };
    });

    if (!sessionRecord) {
      throw new Error('Failed to finalize Stroop session');
    }

    return sessionRecord;
  };

  const finalizeMemorySession = (input: MemorySessionInput): MemorySessionRecord => {
    let sessionRecord: MemorySessionRecord | null = null;

    setState(prev => {
      const previousHistory = prev.history.memory as MemorySessionRecord[];
      const baseline = deriveMemoryBaseline(previousHistory.map(session => session.metrics));
      const metricsBase = computeMemoryMetrics(input.attempts, input.list.length, baseline);
      const trendSource = previousHistory
        .map(session => session.metrics.memoryScore)
        .concat(metricsBase.memoryScore);
      const trend: TrendDirection = calculateTrendDirection(trendSource);

      sessionRecord = {
        gameKey: 'memory',
        list: input.list,
        attempts: input.attempts,
        encodingDurationMs: input.encodingDurationMs,
        context: input.context,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        metrics: { ...metricsBase, trend },
      };

      return {
        history: {
          ...prev.history,
          memory: previousHistory.concat(sessionRecord).slice(-MAX_SESSIONS_PER_GAME),
        },
      };
    });

    if (!sessionRecord) {
      throw new Error('Failed to finalize memory session');
    }

    return sessionRecord;
  };

  const finalizeNamingSession = (input: NamingSessionInput): NamingSessionRecord => {
    let sessionRecord: NamingSessionRecord | null = null;

    setState(prev => {
      const previousHistory = prev.history.naming as NamingSessionRecord[];
      const baseline = deriveNamingBaseline(previousHistory.map(session => session.metrics));
      const metricsBase = computeNamingMetrics(input.trials, baseline);
      const trendSource = previousHistory
        .map(session => session.metrics.namingScore)
        .concat(metricsBase.namingScore);
      const trend: TrendDirection = calculateTrendDirection(trendSource);

      sessionRecord = {
        gameKey: 'naming',
        trials: input.trials,
        settings: input.settings,
        context: input.context,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        metrics: { ...metricsBase, trend },
      };

      return {
        history: {
          ...prev.history,
          naming: previousHistory.concat(sessionRecord).slice(-MAX_SESSIONS_PER_GAME),
        },
      };
    });

    if (!sessionRecord) {
      throw new Error('Failed to finalize naming session');
    }

    return sessionRecord;
  };

  const clearHistory = () => setState(createInitialState());

  const value: GameSessionContextValue = {
    history: state.history,
    latestByGame,
    compositeIndex,
    finalizeStroopSession,
    finalizeMemorySession,
    finalizeNamingSession,
    clearHistory,
  };

  return (
    <GameSessionContext.Provider value={value}>
      {children}
    </GameSessionContext.Provider>
  );
};

export const useGameSessions = () => {
  const context = useContext(GameSessionContext);
  if (!context) {
    throw new Error('useGameSessions must be used within a GameSessionProvider');
  }
  return context;
};
