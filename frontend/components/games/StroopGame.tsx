import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { GameContextForm } from '@/components/games/GameContextForm';
import { TrafficLightBadge } from '@/components/games/TrafficLightBadge';
import { useGameSessions } from '@/contexts/GameSessionContext';
import {
  SessionContextInputs,
  StroopSessionRecord,
  StroopSettings,
  StroopTrialRecord,
} from '@/types/games';

interface StroopGameProps {
  onClose: () => void;
  onSessionComplete?: (session: StroopSessionRecord) => void;
}

interface TrialTemplate {
  id: string;
  word: string;
  inkColor: string;
  correctColor: string;
  isCongruent: boolean;
}

interface ColorOption {
  key: string;
  label: string;
  hex: string;
  symbol: string;
}

const COLOR_CHOICES: ColorOption[] = [
  { key: 'red', label: 'Red', hex: '#D64545', symbol: '⬤' },
  { key: 'yellow', label: 'Yellow', hex: '#F4B400', symbol: '◆' },
  { key: 'blue', label: 'Blue', hex: '#4285F4', symbol: '■' },
  { key: 'purple', label: 'Purple', hex: '#8E44AD', symbol: '▲' },
];

const DEFAULT_SETTINGS: StroopSettings = {
  trialCount: 12,
  congruencyRatio: 0.5,
  interTrialDelayMs: 650,
  practiceEnabled: true,
  highContrast: false,
  colorblindAssist: false,
};

type Stage = 'intro' | 'practice' | 'session' | 'complete';

const chunk = <T,>(array: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

const buildTrials = (trialCount: number, congruencyRatio: number): TrialTemplate[] => {
  const trials: TrialTemplate[] = [];
  for (let index = 0; index < trialCount; index += 1) {
    const correct = COLOR_CHOICES[Math.floor(Math.random() * COLOR_CHOICES.length)];
    const isCongruent = Math.random() < congruencyRatio;
    let wordOption = correct;

    if (!isCongruent) {
      const alternative = COLOR_CHOICES.filter(option => option.key !== correct.key);
      wordOption = alternative[Math.floor(Math.random() * alternative.length)];
    }

    trials.push({
      id: `trial-${index}-${Date.now()}-${Math.random()}`,
      word: wordOption.label.toUpperCase(),
      inkColor: correct.hex,
      correctColor: correct.key,
      isCongruent,
    });
  }

  // Shuffle trials to avoid predictable order
  for (let i = trials.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [trials[i], trials[j]] = [trials[j], trials[i]];
  }

  return trials;
};

const getColorOption = (key: string) => COLOR_CHOICES.find(option => option.key === key)!;

const createInitialContext = (): SessionContextInputs => ({
  moodLevel: null,
  sleepQuality: null,
  medsChanged: false,
  notes: '',
});

export const StroopGame: React.FC<StroopGameProps> = ({ onClose, onSessionComplete }) => {
  const { finalizeStroopSession } = useGameSessions();

  const [stage, setStage] = useState<Stage>('intro');
  const [contextInputs, setContextInputs] = useState<SessionContextInputs>(() => createInitialContext());
  const [settings, setSettings] = useState<StroopSettings>(() => DEFAULT_SETTINGS);
  const [practiceCompleted, setPracticeCompleted] = useState(false);

  const [practiceTrials, setPracticeTrials] = useState<TrialTemplate[]>([]);
  const [sessionTrials, setSessionTrials] = useState<TrialTemplate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [trialPresentedAt, setTrialPresentedAt] = useState<number | null>(null);
  const [records, setRecords] = useState<StroopTrialRecord[]>([]);
  const [activeChoice, setActiveChoice] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<'none' | 'correct' | 'incorrect'>('none');
  const [interactionLocked, setInteractionLocked] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [recap, setRecap] = useState<StroopSessionRecord | null>(null);

  const activeTrials = stage === 'practice' ? practiceTrials : sessionTrials;
  const currentTrial = activeTrials[currentIndex];

  useEffect(() => {
    if ((stage === 'practice' || stage === 'session') && currentTrial) {
      setTrialPresentedAt(Date.now());
    }
  }, [stage, currentIndex, currentTrial]);

  const handleStartSession = () => {
    const trials = buildTrials(settings.trialCount, settings.congruencyRatio);
    setSessionTrials(trials);
    setRecords([]);
    setCurrentIndex(0);
    setActiveChoice(null);
    setFeedbackState('none');
    setInteractionLocked(false);
    setSessionStartedAt(Date.now());
    setStage('session');
  };

  const handleStartPractice = () => {
    const practiceCount = Math.min(4, Math.max(3, Math.round(settings.trialCount * 0.25)));
    setPracticeTrials(buildTrials(practiceCount, settings.congruencyRatio));
    setCurrentIndex(0);
    setActiveChoice(null);
    setFeedbackState('none');
    setInteractionLocked(false);
    setStage('practice');
  };

  const handleBegin = () => {
    if (!contextInputs.moodLevel || !contextInputs.sleepQuality) {
      Alert.alert('Almost ready', 'Please capture mood and sleep before starting.');
      return;
    }

    if (settings.practiceEnabled && !practiceCompleted) {
      handleStartPractice();
    } else {
      handleStartSession();
    }
  };

  const handleSelectColor = (colorKey: string) => {
    if (!currentTrial || interactionLocked || !trialPresentedAt) {
      return;
    }

    const respondedAt = Date.now();
    const isCorrect = currentTrial.correctColor === colorKey;
    const colorOption = getColorOption(colorKey);
    const record: StroopTrialRecord = {
      id: currentTrial.id,
      word: currentTrial.word,
      inkColor: currentTrial.inkColor,
      correctColor: currentTrial.correctColor,
      presentedAt: trialPresentedAt,
      respondedAt,
      responseTimeMs: respondedAt - trialPresentedAt,
      selectedColor: colorKey,
      isCorrect,
      isCongruent: currentTrial.isCongruent,
    };

    const updatedRecords = stage === 'session' ? records.concat(record) : records;
    if (stage === 'session') {
      setRecords(updatedRecords);
    }

    setActiveChoice(colorKey);
    setFeedbackState(isCorrect ? 'correct' : 'incorrect');
    setInteractionLocked(true);

    setTimeout(() => {
      setInteractionLocked(false);
      setActiveChoice(null);
      setFeedbackState('none');

      if (currentIndex + 1 < activeTrials.length) {
        setCurrentIndex(index => index + 1);
      } else {
        if (stage === 'practice') {
          setStage('intro');
          setPracticeCompleted(true);
          Alert.alert('Ready!', 'Practice round complete. Start the main session when you are ready.');
        } else {
          finalizeSession(updatedRecords);
        }
      }
    }, settings.interTrialDelayMs);
  };

  const finalizeSession = (completedRecords: StroopTrialRecord[]) => {
    const completedAt = Date.now();
    const cleanContext: SessionContextInputs = {
      moodLevel: contextInputs.moodLevel,
      sleepQuality: contextInputs.sleepQuality,
      medsChanged: contextInputs.medsChanged,
      notes: contextInputs.notes?.trim() ? contextInputs.notes.trim() : undefined,
    };

    const session = finalizeStroopSession({
      trials: completedRecords,
      settings,
      context: cleanContext,
      startedAt: sessionStartedAt ?? completedAt,
      completedAt,
      practice: settings.practiceEnabled,
    });

    setRecap(session);
    setStage('complete');
    onSessionComplete?.(session);
  };

  const handleReset = () => {
    setStage('intro');
    setPracticeCompleted(false);
    setRecords([]);
    setRecap(null);
    setCurrentIndex(0);
    setActiveChoice(null);
    setFeedbackState('none');
    setInteractionLocked(false);
    setSessionStartedAt(null);
  };

  const renderSettingsControls = useMemo(() => (
    <View style={styles.settingsCard}>
      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Trials</Text>
        <View style={styles.settingPillRow}>
          {[10, 12, 16].map(option => (
            <TouchableOpacity
              key={`trial-${option}`}
              style={[styles.settingPill, settings.trialCount === option && styles.settingPillActive]}
              onPress={() => setSettings(prev => ({ ...prev, trialCount: option }))}
            >
              <Text style={[styles.settingPillText, settings.trialCount === option && styles.settingPillTextActive]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingLabel}>Congruency</Text>
        <View style={styles.settingPillRow}>
          {[
            { label: 'Balanced', value: 0.5 },
            { label: 'More incongruent', value: 0.35 },
            { label: 'More congruent', value: 0.65 },
          ].map(option => (
            <TouchableOpacity
              key={`congruency-${option.value}`}
              style={[styles.settingPill, settings.congruencyRatio === option.value && styles.settingPillActive]}
              onPress={() => setSettings(prev => ({ ...prev, congruencyRatio: option.value }))}
            >
              <Text style={[styles.settingPillText, settings.congruencyRatio === option.value && styles.settingPillTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.settingToggleRow}>
        <TouchableOpacity
          style={[styles.toggleChip, settings.practiceEnabled && styles.toggleChipActive]}
          onPress={() => setSettings(prev => ({ ...prev, practiceEnabled: !prev.practiceEnabled }))}
        >
          <IconSymbol name={settings.practiceEnabled ? 'checkmark.circle.fill' : 'circle'} size={18} color={settings.practiceEnabled ? '#FFFFFF' : '#6B8E6B'} />
          <Text style={[styles.toggleText, settings.practiceEnabled && styles.toggleTextActive]}>Practice round</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleChip, settings.highContrast && styles.toggleChipActive]}
          onPress={() => setSettings(prev => ({ ...prev, highContrast: !prev.highContrast }))}
        >
          <IconSymbol name="eye.fill" size={18} color={settings.highContrast ? '#FFFFFF' : '#6B8E6B'} />
          <Text style={[styles.toggleText, settings.highContrast && styles.toggleTextActive]}>High contrast</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleChip, settings.colorblindAssist && styles.toggleChipActive]}
          onPress={() => setSettings(prev => ({ ...prev, colorblindAssist: !prev.colorblindAssist }))}
        >
          <IconSymbol name="rectangle.and.hand.point.up.left.fill" size={18} color={settings.colorblindAssist ? '#FFFFFF' : '#6B8E6B'} />
          <Text style={[styles.toggleText, settings.colorblindAssist && styles.toggleTextActive]}>Assist</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [settings]);

  const renderIntro = () => (
    <View style={styles.card}>
      <Text style={styles.title}>Stroop Color Challenge</Text>
      <Text style={styles.subtitle}>Tap the ink color, not the word you read.</Text>

      <GameContextForm value={contextInputs} onChange={setContextInputs} />
      {settings.practiceEnabled && !practiceCompleted && (
        <View style={styles.practiceHint}>
          <IconSymbol name="lightbulb.fill" size={18} color="#F4B400" />
          <Text style={styles.practiceText}>Take a short practice round before the real session.</Text>
        </View>
      )}

      {practiceCompleted && (
        <View style={styles.practiceDone}>
          <IconSymbol name="checkmark.seal.fill" size={20} color="#6B8E6B" />
          <Text style={styles.practiceDoneText}>Practice complete. Ready for the main session.</Text>
        </View>
      )}

      {renderSettingsControls}

      <TouchableOpacity style={styles.primaryButton} onPress={handleBegin}>
        <IconSymbol name="play.fill" size={18} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>{settings.practiceEnabled && !practiceCompleted ? 'Start practice' : 'Start session'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
        <Text style={styles.secondaryButtonText}>Back to games</Text>
      </TouchableOpacity>
    </View>
  );

  const renderActiveGame = () => {
    if (!currentTrial) {
      return null;
    }

    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => Alert.alert('Exit session?', 'Your progress will be lost.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Exit', style: 'destructive', onPress: onClose },
          ])}>
            <IconSymbol name="xmark.circle" size={24} color="#6B8E6B" />
          </TouchableOpacity>
          <Text style={styles.stageLabel}>{stage === 'practice' ? 'Practice round' : `Trial ${currentIndex + 1} / ${activeTrials.length}`}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={[styles.targetCard, settings.highContrast && styles.targetCardHighContrast]}>
          <Text style={styles.targetLabel}>Focus on the color of the ink</Text>
          <Text
            style={[styles.targetWord, { color: currentTrial.inkColor, textShadowColor: settings.highContrast ? '#FFFFFF' : 'transparent', textShadowRadius: settings.highContrast ? 6 : 0 }]}
          >
            {currentTrial.word}
          </Text>
          <Text style={styles.congruencyHint}>{currentTrial.isCongruent ? 'Congruent' : 'Incongruent'}</Text>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((currentIndex + 1) / activeTrials.length) * 100}%` }]} />
        </View>

        <View style={styles.grid}>
          {chunk(COLOR_CHOICES, 2).map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.gridRow}>
              {row.map(option => {
                const isActive = activeChoice === option.key;
                const isCorrectSelection = feedbackState === 'correct' && isActive;
                const isIncorrectSelection = feedbackState === 'incorrect' && isActive;

                return (
                  <TouchableOpacity
                    key={option.key}
                    disabled={interactionLocked}
                    onPress={() => handleSelectColor(option.key)}
                    style={[
                      styles.colorButton,
                      { backgroundColor: option.hex },
                      settings.highContrast && styles.colorButtonHighContrast,
                      isCorrectSelection && styles.correctSelection,
                      isIncorrectSelection && styles.incorrectSelection,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose ${option.label}`}
                  >
                    <Text style={styles.colorLabel}>{option.label}</Text>
                    {settings.colorblindAssist && <Text style={styles.colorSymbol}>{option.symbol}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.helperRow}>
          <View style={styles.helperBadge}>
            <IconSymbol name="timer" size={16} color="#6B8E6B" />
            <Text style={styles.helperText}>Respond quickly and accurately</Text>
          </View>
          {stage === 'practice' && (
            <View style={styles.helperBadge}>
              <IconSymbol name="hand.point.up.fill" size={16} color="#8B6B8B" />
              <Text style={styles.helperText}>Practice mode — no score stored</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderRecap = () => {
    if (!recap) {
      return null;
    }

    return (
      <View style={styles.card}>
        <Text style={styles.title}>Session recap</Text>
        <TrafficLightBadge status={recap.metrics.trafficLight} trend={recap.metrics.trend} />

        <View style={styles.recapGrid}>
          <View style={styles.recapItem}>
            <Text style={styles.recapLabel}>Accuracy</Text>
            <Text style={styles.recapValue}>{recap.metrics.accuracyPct.toFixed(1)}%</Text>
            {recap.metrics.baselineAccuracyPct !== null && (
              <Text style={styles.recapDelta}>
                Baseline {recap.metrics.baselineAccuracyPct.toFixed(1)}%
              </Text>
            )}
          </View>
          <View style={styles.recapItem}>
            <Text style={styles.recapLabel}>Median RT</Text>
            <Text style={styles.recapValue}>{Math.round(recap.metrics.medianRtMs)} ms</Text>
            {recap.metrics.baselineMedianRtMs !== null && (
              <Text style={styles.recapDelta}>
                Baseline {Math.round(recap.metrics.baselineMedianRtMs)} ms
              </Text>
            )}
          </View>
          <View style={styles.recapItem}>
            <Text style={styles.recapLabel}>Interference</Text>
            <Text style={styles.recapValue}>{Math.round(recap.metrics.interferenceMs)} ms</Text>
            <Text style={styles.recapDelta}>Incongruent vs congruent</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleReset}>
          <IconSymbol name="gobackward" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Run again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.secondaryButtonText}>Back to games</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {stage === 'intro' && renderIntro()}
        {(stage === 'practice' || stage === 'session') && renderActiveGame()}
        {stage === 'complete' && renderRecap()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F9F4',
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#B8C5B8',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
    gap: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#4E5E4E',
  },
  subtitle: {
    fontSize: 16,
    color: '#6C7C6C',
    lineHeight: 22,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5A6B5A',
  },
  targetCard: {
    backgroundColor: '#EEF6EE',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  targetCardHighContrast: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#6B8E6B',
  },
  targetLabel: {
    fontSize: 14,
    color: '#7A8B7A',
  },
  targetWord: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 2,
  },
  congruencyHint: {
    fontSize: 12,
    color: '#9AA79A',
  },
  progressBar: {
    height: 10,
    backgroundColor: '#E6F0E6',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6B8E6B',
  },
  grid: {
    gap: 12,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  colorButton: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorButtonHighContrast: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  correctSelection: {
    borderWidth: 3,
    borderColor: '#2ECC71',
  },
  incorrectSelection: {
    borderWidth: 3,
    borderColor: '#E74C3C',
  },
  colorLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  colorSymbol: {
    marginTop: 4,
    fontSize: 16,
    color: '#FFFFFF',
  },
  helperRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  helperBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F5F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  helperText: {
    fontSize: 13,
    color: '#5A6B5A',
  },
  settingsCard: {
    backgroundColor: '#F7FDF7',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: '#E0EAE0',
  },
  settingRow: {
    gap: 8,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5A6B5A',
  },
  settingPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  settingPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D5E4D5',
    backgroundColor: '#FFFFFF',
  },
  settingPillActive: {
    backgroundColor: '#6B8E6B',
    borderColor: '#6B8E6B',
  },
  settingPillText: {
    fontSize: 13,
    color: '#6C7C6C',
    fontWeight: '500',
  },
  settingPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  settingToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5E4D5',
  },
  toggleChipActive: {
    backgroundColor: '#6B8E6B',
    borderColor: '#6B8E6B',
  },
  toggleText: {
    fontSize: 13,
    color: '#5A6B5A',
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#6B8E6B',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    alignSelf: 'center',
  },
  secondaryButtonText: {
    color: '#6B8E6B',
    fontSize: 15,
    fontWeight: '500',
  },
  practiceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF9E6',
    borderRadius: 14,
    padding: 12,
  },
  practiceText: {
    fontSize: 13,
    color: '#8B6B3A',
  },
  practiceDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EEF6EE',
    borderRadius: 14,
    padding: 12,
  },
  practiceDoneText: {
    fontSize: 13,
    color: '#5A6B5A',
  },
  recapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recapItem: {
    flexBasis: '48%',
    backgroundColor: '#F0F5F0',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  recapLabel: {
    fontSize: 13,
    color: '#6C7C6C',
    fontWeight: '500',
  },
  recapValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4E5E4E',
  },
  recapDelta: {
    fontSize: 12,
    color: '#8A9A8A',
  },
});
