import {
  MemoryMetrics,
  MemoryRecallAttempt,
  NamingMetrics,
  NamingTrialRecord,
  StroopMetrics,
  StroopTrialRecord,
  TrafficLightStatus,
  TrendDirection,
} from '@/types/games';

const BASELINE_WINDOW = 3;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const percent = (part: number, total: number) => (total === 0 ? 0 : (part / total) * 100);

const median = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const average = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const deriveTrafficLight = (
  baselineStatus: 'building' | 'ready',
  accuracyRatio: number,
  speedRatio: number,
  compositeScore: number
): TrafficLightStatus => {
  if (baselineStatus !== 'ready') {
    return 'yellow';
  }

  if (accuracyRatio >= 0.95 && speedRatio >= 0.95 && compositeScore >= 95) {
    return 'green';
  }

  if (accuracyRatio >= 0.8 && speedRatio >= 0.8) {
    return 'yellow';
  }

  return 'red';
};

export interface StroopBaselineSnapshot {
  accuracyPct: number;
  medianRtMs: number;
  medianRtCongruentMs: number;
  medianRtIncongruentMs: number;
  sessionCount: number;
  status: 'building' | 'ready';
}

export const deriveStroopBaseline = (
  history: StroopMetrics[],
  windowSize = BASELINE_WINDOW
): StroopBaselineSnapshot | null => {
  if (!history.length) {
    return null;
  }
  const recent = history.slice(-windowSize);
  const accuracyPct = average(recent.map(item => item.accuracyPct));
  const medianRtMs = average(recent.map(item => item.medianRtMs));
  const medianRtCongruentMs = average(recent.map(item => item.medianRtCongruentMs));
  const medianRtIncongruentMs = average(recent.map(item => item.medianRtIncongruentMs));

  return {
    accuracyPct,
    medianRtMs,
    medianRtCongruentMs,
    medianRtIncongruentMs,
    sessionCount: recent.length,
    status: recent.length >= windowSize ? 'ready' : 'building',
  };
};

export const computeStroopMetrics = (
  trials: StroopTrialRecord[],
  baseline?: StroopBaselineSnapshot | null
): StroopMetrics => {
  const totalTrials = trials.length;
  const correctTrials = trials.filter(trial => trial.isCorrect).length;
  const responseTimes = trials.map(trial => trial.responseTimeMs).filter(Boolean);
  const congruentTimes = trials
    .filter(trial => trial.isCongruent)
    .map(trial => trial.responseTimeMs)
    .filter(Boolean);
  const incongruentTimes = trials
    .filter(trial => !trial.isCongruent)
    .map(trial => trial.responseTimeMs)
    .filter(Boolean);

  const accuracyPct = percent(correctTrials, totalTrials);
  const medianRtMs = median(responseTimes);
  const medianRtCongruentMs = congruentTimes.length ? median(congruentTimes) : medianRtMs;
  const medianRtIncongruentMs = incongruentTimes.length ? median(incongruentTimes) : medianRtMs;
  const interferenceMs = medianRtIncongruentMs - medianRtCongruentMs;

  const baselineAccuracy = baseline?.accuracyPct ?? accuracyPct;
  const baselineMedianRt = baseline?.medianRtMs ?? medianRtMs;

  const accuracyScore = baseline && baselineAccuracy > 0
    ? clamp((accuracyPct / baselineAccuracy) * 100, 60, 130)
    : 100;

  const speedScore = baseline && baselineMedianRt > 0
    ? clamp((baselineMedianRt / (medianRtMs || baselineMedianRt)) * 100, 60, 130)
    : 100;

  const compositeScore = +(0.6 * accuracyScore + 0.4 * speedScore).toFixed(2);

  const accuracyRatio = baselineAccuracy > 0 ? accuracyPct / baselineAccuracy : 1;
  const speedRatio = baselineMedianRt > 0 ? baselineMedianRt / (medianRtMs || baselineMedianRt) : 1;

  const trafficLight = deriveTrafficLight(baseline?.status ?? 'building', accuracyRatio, speedRatio, compositeScore);

  return {
    accuracyPct,
    medianRtMs,
    medianRtCongruentMs,
    medianRtIncongruentMs,
    interferenceMs,
    accuracyScore,
    speedScore,
    compositeScore,
    trafficLight,
    baselineStatus: baseline?.status ?? 'building',
    baselineAccuracyPct: baseline?.accuracyPct ?? null,
    baselineMedianRtMs: baseline?.medianRtMs ?? null,
    trend: 'flat',
  };
};

export interface MemoryBaselineSnapshot {
  immediatePct: number;
  delayedPct: number | null;
  forgettingRatePct: number | null;
  sessionCount: number;
  status: 'building' | 'ready';
}

export const deriveMemoryBaseline = (
  history: MemoryMetrics[],
  windowSize = BASELINE_WINDOW
): MemoryBaselineSnapshot | null => {
  if (!history.length) {
    return null;
  }
  const recent = history.slice(-windowSize);
  const immediatePct = average(recent.map(item => item.immediateRecallPct));
  const delayedValues = recent
    .map(item => item.delayedRecallPct)
    .filter((value): value is number => value !== null);
  const forgettingValues = recent
    .map(item => item.forgettingRatePct)
    .filter((value): value is number => value !== null);

  return {
    immediatePct,
    delayedPct: delayedValues.length ? average(delayedValues) : null,
    forgettingRatePct: forgettingValues.length ? average(forgettingValues) : null,
    sessionCount: recent.length,
    status: recent.length >= windowSize ? 'ready' : 'building',
  };
};

export const computeMemoryMetrics = (
  attempts: MemoryRecallAttempt[],
  listLength: number,
  baseline?: MemoryBaselineSnapshot | null
): MemoryMetrics => {
  const immediateAttempt = attempts.find(attempt => attempt.phase === 'immediate');
  const delayedAttempt = attempts.find(attempt => attempt.phase === 'delayed');

  const immediateRecallPct = percent(immediateAttempt?.recalledCount ?? 0, listLength);
  const delayedRecallPct = delayedAttempt
    ? percent(delayedAttempt.recalledCount, listLength)
    : null;

  const forgettingRatePct = delayedRecallPct !== null
    ? Math.max(0, immediateRecallPct - delayedRecallPct)
    : null;

  const baselineImmediate = baseline?.immediatePct ?? immediateRecallPct;
  const baselineDelayed = baseline?.delayedPct ?? delayedRecallPct ?? immediateRecallPct;
  const baselineForget = baseline?.forgettingRatePct;

  const immediateScore = baselineImmediate > 0
    ? clamp((immediateRecallPct / baselineImmediate) * 100, 60, 130)
    : 100;
  const delayedScore = baselineDelayed > 0
    ? clamp(((delayedRecallPct ?? immediateRecallPct) / baselineDelayed) * 100, 60, 130)
    : 100;

  const memoryScore = +((0.5 * immediateScore) + (0.5 * delayedScore)).toFixed(2);

  const forgettingFlag = baseline?.status === 'ready'
    && baselineForget !== null
    && forgettingRatePct !== null
    && forgettingRatePct - baselineForget > 20;

  let trafficLight: TrafficLightStatus = 'yellow';
  if (baseline?.status === 'ready') {
    if (memoryScore >= 95) {
      trafficLight = 'green';
    } else if (memoryScore >= 75) {
      trafficLight = 'yellow';
    } else {
      trafficLight = 'red';
    }
  }

  return {
    immediateRecallPct,
    delayedRecallPct,
    forgettingRatePct,
    memoryScore,
    forgettingFlag,
    trafficLight,
    baselineStatus: baseline?.status ?? 'building',
    baselineImmediatePct: baseline?.immediatePct ?? null,
    baselineDelayedPct: baseline?.delayedPct ?? null,
    trend: 'flat',
  };
};

export interface NamingBaselineSnapshot {
  accuracyPct: number;
  medianRtMs: number;
  sessionCount: number;
  status: 'building' | 'ready';
}

export const deriveNamingBaseline = (
  history: NamingMetrics[],
  windowSize = BASELINE_WINDOW
): NamingBaselineSnapshot | null => {
  if (!history.length) {
    return null;
  }

  const recent = history.slice(-windowSize);

  return {
    accuracyPct: average(recent.map(item => item.accuracyPct)),
    medianRtMs: average(recent.map(item => item.medianRtMs)),
    sessionCount: recent.length,
    status: recent.length >= windowSize ? 'ready' : 'building',
  };
};

export const computeNamingMetrics = (
  trials: NamingTrialRecord[],
  baseline?: NamingBaselineSnapshot | null
): NamingMetrics => {
  const correctCount = trials.filter(trial => trial.isCorrect).length;
  const accuracyPct = percent(correctCount, trials.length);
  const responseTimes = trials.map(trial => trial.responseTimeMs).filter(Boolean);
  const medianRtMs = median(responseTimes);

  const baselineAccuracy = baseline?.accuracyPct ?? accuracyPct;
  const baselineMedianRt = baseline?.medianRtMs ?? medianRtMs;

  const accuracyScore = baselineAccuracy > 0
    ? clamp((accuracyPct / baselineAccuracy) * 100, 60, 130)
    : 100;
  const speedScore = baselineMedianRt > 0
    ? clamp((baselineMedianRt / (medianRtMs || baselineMedianRt)) * 100, 60, 130)
    : 100;

  const namingScore = +(0.7 * accuracyScore + 0.3 * speedScore).toFixed(2);

  let trafficLight: TrafficLightStatus = 'yellow';
  if (baseline?.status === 'ready') {
    if (accuracyScore >= 95 && speedScore >= 95) {
      trafficLight = 'green';
    } else if (accuracyScore >= 80) {
      trafficLight = 'yellow';
    } else {
      trafficLight = 'red';
    }
  }

  return {
    accuracyPct,
    medianRtMs,
    namingScore,
    trafficLight,
    baselineStatus: baseline?.status ?? 'building',
    baselineAccuracyPct: baseline?.accuracyPct ?? null,
    baselineMedianRtMs: baseline?.medianRtMs ?? null,
    trend: 'flat',
  };
};

export const calculateTrendDirection = (values: number[]): TrendDirection => {
  if (values.length < 2) {
    return 'flat';
  }

  const recent = values.slice(-3);
  if (recent.length < 2) {
    return 'flat';
  }

  const latest = recent[recent.length - 1];
  const previousAverage = average(recent.slice(0, -1));

  if (!previousAverage) {
    return 'flat';
  }

  const delta = (latest - previousAverage) / previousAverage;

  if (delta >= 0.05) {
    return 'up';
  }

  if (delta <= -0.05) {
    return 'down';
  }

  return 'flat';
};

export { BASELINE_WINDOW };
