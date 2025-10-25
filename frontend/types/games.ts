import { ImageSourcePropType } from 'react-native';

export type GameKey = 'stroop' | 'memory' | 'naming';
export type TrafficLightStatus = 'green' | 'yellow' | 'red';
export type TrendDirection = 'up' | 'down' | 'flat';

export interface SessionContextInputs {
  moodLevel: number | null; // 1-5 scale
  sleepQuality: number | null; // 1-5 scale
  medsChanged: boolean;
  notes?: string;
}

export interface StroopSettings {
  trialCount: number;
  congruencyRatio: number; // 0..1 (fraction congruent)
  interTrialDelayMs: number;
  practiceEnabled: boolean;
  highContrast: boolean;
  colorblindAssist: boolean;
}

export interface StroopTrialRecord {
  id: string;
  word: string;
  inkColor: string;
  correctColor: string;
  presentedAt: number;
  respondedAt: number;
  responseTimeMs: number;
  selectedColor: string;
  isCorrect: boolean;
  isCongruent: boolean;
}

export interface StroopMetrics {
  accuracyPct: number;
  medianRtMs: number;
  medianRtCongruentMs: number;
  medianRtIncongruentMs: number;
  interferenceMs: number;
  accuracyScore: number;
  speedScore: number;
  compositeScore: number;
  trafficLight: TrafficLightStatus;
  baselineStatus: 'building' | 'ready';
  baselineAccuracyPct: number | null;
  baselineMedianRtMs: number | null;
  trend: TrendDirection;
}

export interface StroopSessionRecord {
  gameKey: 'stroop';
  trials: StroopTrialRecord[];
  metrics: StroopMetrics;
  settings: StroopSettings;
  context?: SessionContextInputs;
  startedAt: number;
  completedAt: number;
  practice: boolean;
}

export interface MemoryListItem {
  id: string;
  label: string;
  asset?: ImageSourcePropType;
}

export interface MemoryRecallAttempt {
  phase: 'immediate' | 'delayed';
  responses: string[];
  correctPrompts: string[];
  recalledCount: number;
  responseTimeMs: number;
  startedAt: number;
  completedAt: number;
}

export interface MemoryMetrics {
  immediateRecallPct: number;
  delayedRecallPct: number | null;
  forgettingRatePct: number | null;
  memoryScore: number;
  forgettingFlag: boolean;
  trafficLight: TrafficLightStatus;
  baselineStatus: 'building' | 'ready';
  baselineImmediatePct: number | null;
  baselineDelayedPct: number | null;
  trend: TrendDirection;
}

export interface MemorySessionRecord {
  gameKey: 'memory';
  list: MemoryListItem[];
  attempts: MemoryRecallAttempt[];
  encodingDurationMs: number;
  context?: SessionContextInputs;
  metrics: MemoryMetrics;
  startedAt: number;
  completedAt: number;
}

export interface NamingPrompt {
  id: string;
  image: ImageSourcePropType;
  answer: string;
  options: string[];
  altText: string;
  hint?: string;
}

export interface NamingTrialRecord {
  promptId: string;
  promptLabel: string;
  displayedAt: number;
  submittedAt: number;
  responseTimeMs: number;
  answerProvided: string;
  isCorrect: boolean;
  usedHint: boolean;
}

export interface NamingSettings {
  allowHints: boolean;
  useSpeechInput: boolean;
}

export interface NamingMetrics {
  accuracyPct: number;
  medianRtMs: number;
  namingScore: number;
  trafficLight: TrafficLightStatus;
  baselineStatus: 'building' | 'ready';
  baselineAccuracyPct: number | null;
  baselineMedianRtMs: number | null;
  trend: TrendDirection;
}

export interface NamingSessionRecord {
  gameKey: 'naming';
  trials: NamingTrialRecord[];
  metrics: NamingMetrics;
  settings: NamingSettings;
  context?: SessionContextInputs;
  startedAt: number;
  completedAt: number;
}

export type AnySessionRecord =
  | StroopSessionRecord
  | MemorySessionRecord
  | NamingSessionRecord;
