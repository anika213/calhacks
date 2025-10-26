import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { GameContextForm } from '@/components/games/GameContextForm';
import { TrafficLightBadge } from '@/components/games/TrafficLightBadge';
import { useGameSessions } from '@/contexts/GameSessionContext';
import {
  MemoryListItem,
  MemoryRecallAttempt,
  MemorySessionRecord,
  SessionContextInputs,
} from '@/types/games';

interface MemoryGameProps {
  onClose: () => void;
  onSessionComplete?: (session: MemorySessionRecord) => void;
}

type Phase = 'intro' | 'encoding' | 'immediate' | 'delay' | 'delayed' | 'complete';

const WORD_POOL = [
  'Garden',
  'Orange',
  'Window',
  'River',
  'Notebook',
  'Candle',
  'Anchor',
  'Planet',
  'Violin',
  'Basket',
  'Feather',
  'Lighthouse',
  'Compass',
  'Pebble',
  'Olive',
  'Starlight',
  'Lantern',
  'Shell',
  'Harbor',
  'Quill',
  'Maple',
];

const createInitialContext = (): SessionContextInputs => ({
  moodLevel: null,
  sleepQuality: null,
  medsChanged: false,
  notes: '',
});

const generateMemoryList = (count = 6): MemoryListItem[] => {
  const poolCopy = [...WORD_POOL];
  const result: MemoryListItem[] = [];
  for (let index = 0; index < count; index += 1) {
    const selectedIndex = Math.floor(Math.random() * poolCopy.length);
    const [word] = poolCopy.splice(selectedIndex, 1);
    result.push({ id: `word-${word}-${index}`, label: word });
  }
  return result;
};

const shuffle = <T,>(source: T[]): T[] => {
  const copy = [...source];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

export const MemoryGame: React.FC<MemoryGameProps> = ({ onClose, onSessionComplete }) => {
  const { finalizeMemorySession } = useGameSessions();

  const [phase, setPhase] = useState<Phase>('intro');
  const [list, setList] = useState<MemoryListItem[]>(() => generateMemoryList());
  const [contextInputs, setContextInputs] = useState<SessionContextInputs>(() => createInitialContext());
  const [encodingIndex, setEncodingIndex] = useState(0);
  const [encodingStartedAt, setEncodingStartedAt] = useState<number | null>(null);
  const [encodingDurationMs, setEncodingDurationMs] = useState(0);
  const [phaseStartedAt, setPhaseStartedAt] = useState<number | null>(null);
  const [immediateSelections, setImmediateSelections] = useState<string[]>([]);
  const [delayedSelections, setDelayedSelections] = useState<string[]>([]);
  const [immediateOptions, setImmediateOptions] = useState<string[]>([]);
  const [delayedOptions, setDelayedOptions] = useState<string[]>([]);
  const [attempts, setAttempts] = useState<MemoryRecallAttempt[]>([]);
  const [countdown, setCountdown] = useState(10);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [recap, setRecap] = useState<MemorySessionRecord | null>(null);

  const correctPrompts = useMemo(() => list.map(item => item.label), [list]);

  useEffect(() => {
    if (phase === 'encoding') {
      setEncodingStartedAt(Date.now());
      setPhaseStartedAt(Date.now());
      setEncodingIndex(0);
      setSessionStartedAt(Date.now());
    }

    if (phase === 'immediate' || phase === 'delayed') {
      setPhaseStartedAt(Date.now());
    }

    if (phase === 'delay') {
      setCountdown(10);
      setDelayedSelections([]);
      setDelayedOptions([]);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'encoding') {
      return;
    }

    if (encodingIndex >= list.length) {
      setEncodingDurationMs(Date.now() - (encodingStartedAt ?? Date.now()));
      setPhase('immediate');
      return;
    }

    const timer = setTimeout(() => {
      setEncodingIndex(index => index + 1);
    }, 2000);

    return () => clearTimeout(timer);
  }, [phase, encodingIndex, list.length, encodingStartedAt]);

  useEffect(() => {
    if (phase !== 'delay') {
      return;
    }

    if (countdown <= 0) {
      setPhase('delayed');
      return;
    }

    const timer = setTimeout(() => setCountdown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  const canStart = Boolean(contextInputs.moodLevel && contextInputs.sleepQuality);

  const buildOptionSet = (targetIndex: number, chosen: string[]): string[] => {
    if (targetIndex >= list.length) {
      return [];
    }

    const correctWord = list[targetIndex].label;
    const usedSet = new Set(chosen.map(word => word.toLowerCase()));
    const candidatePool = WORD_POOL.filter(
      word => word.toLowerCase() !== correctWord.toLowerCase() && !usedSet.has(word.toLowerCase())
    );

    const remainingTargets = list
      .map(item => item.label)
      .filter((word, index) => index !== targetIndex && word.toLowerCase() !== correctWord.toLowerCase())
      .filter(word => !usedSet.has(word.toLowerCase()));

    const combined = [...remainingTargets, ...candidatePool];
    const options = new Set<string>([correctWord]);

    while (options.size < 4 && combined.length) {
      const randomIndex = Math.floor(Math.random() * combined.length);
      const [choice] = combined.splice(randomIndex, 1);
      options.add(choice);
    }

    while (options.size < 4) {
      const filler = candidatePool[Math.floor(Math.random() * candidatePool.length)] ?? correctWord;
      options.add(`${filler}-${options.size}`);
    }

    return shuffle(Array.from(options));
  };

  useEffect(() => {
    if (phase === 'immediate') {
      const nextIndex = immediateSelections.length;
      if (nextIndex < list.length) {
        setImmediateOptions(buildOptionSet(nextIndex, immediateSelections));
      } else {
        setImmediateOptions([]);
      }
    }
  }, [phase, immediateSelections, list]);

  useEffect(() => {
    if (phase === 'delayed') {
      const nextIndex = delayedSelections.length;
      if (nextIndex < list.length) {
        setDelayedOptions(buildOptionSet(nextIndex, delayedSelections));
      } else {
        setDelayedOptions([]);
      }
    }
  }, [phase, delayedSelections, list]);

  const handleStart = () => {
    if (!canStart) {
      return;
    }
    setAttempts([]);
    setImmediateSelections([]);
    setDelayedSelections([]);
    setImmediateOptions([]);
    setDelayedOptions([]);
    setEncodingDurationMs(0);
    setPhase('encoding');
  };

  const buildAttempt = (phaseType: 'immediate' | 'delayed', selectedWords: string[]): MemoryRecallAttempt => {
    const responses = selectedWords.map(entry => entry.trim()).filter(Boolean);
    const normalizedCorrect = correctPrompts.map(prompt => prompt.toLowerCase());
    let recalledCount = 0;

    responses.forEach((response, index) => {
      if (normalizedCorrect[index] && response.toLowerCase() === normalizedCorrect[index]) {
        recalledCount += 1;
      }
    });

    return {
      phase: phaseType,
      responses,
      correctPrompts,
      recalledCount,
      responseTimeMs: Date.now() - (phaseStartedAt ?? Date.now()),
      startedAt: phaseStartedAt ?? Date.now(),
      completedAt: Date.now(),
    };
  };

  const handleImmediatePick = (word: string) => {
    if (immediateSelections.includes(word) || immediateSelections.length >= list.length) {
      return;
    }
    setImmediateSelections(prev => prev.concat(word));
  };

  const handleDelayedPick = (word: string) => {
    if (delayedSelections.includes(word) || delayedSelections.length >= list.length) {
      return;
    }
    setDelayedSelections(prev => prev.concat(word));
  };

  const handleImmediateUndo = () => {
    setImmediateSelections(prev => prev.slice(0, -1));
  };

  const handleDelayedUndo = () => {
    setDelayedSelections(prev => prev.slice(0, -1));
  };

  const handleImmediateSubmit = () => {
    const attempt = buildAttempt('immediate', immediateSelections);
    const updatedAttempts = attempts.concat(attempt);
    setAttempts(updatedAttempts);
    setPhase('delay');
  };

  const handleDelayedSubmit = () => {
    const attempt = buildAttempt('delayed', delayedSelections);
    const updatedAttempts = attempts.concat(attempt);
    setAttempts(updatedAttempts);
    finalizeSession(updatedAttempts);
  };

  const finalizeSession = (finalAttempts: MemoryRecallAttempt[]) => {
    const completedAt = Date.now();
    const cleanContext: SessionContextInputs = {
      moodLevel: contextInputs.moodLevel,
      sleepQuality: contextInputs.sleepQuality,
      medsChanged: contextInputs.medsChanged,
      notes: contextInputs.notes?.trim() ? contextInputs.notes.trim() : undefined,
    };

    const session = finalizeMemorySession({
      list,
      attempts: finalAttempts,
      encodingDurationMs,
      context: cleanContext,
      startedAt: sessionStartedAt ?? completedAt,
      completedAt,
    });

    setRecap(session);
    setPhase('complete');
    onSessionComplete?.(session);
  };

  const handleReset = () => {
    setPhase('intro');
    setList(generateMemoryList());
    setAttempts([]);
    setRecap(null);
    setImmediateSelections([]);
    setDelayedSelections([]);
    setImmediateOptions([]);
    setDelayedOptions([]);
    setContextInputs(createInitialContext());
    setEncodingIndex(0);
    setEncodingDurationMs(0);
    setSessionStartedAt(null);
  };

  const immediateReady = immediateSelections.length === list.length;
  const delayedReady = delayedSelections.length === list.length;

  const renderOptionGrid = (
    options: string[],
    onPick: (word: string) => void,
    chosen: string[],
  ) => (
    <View style={styles.optionGrid}>
      {options.map(option => {
        const cleanedOption = option.includes('-') ? option.split('-')[0] : option;
        const disabled = chosen.includes(cleanedOption);
        return (
          <TouchableOpacity
            key={option}
            style={[styles.optionButton, disabled && styles.optionButtonDisabled]}
            onPress={() => onPick(cleanedOption)}
            disabled={disabled}
          >
            <Text style={styles.optionText}>{cleanedOption}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderSelectedSequence = (selections: string[]) => (
    <View style={styles.sequenceRow}>
      {selections.map((word, index) => {
        const expected = correctPrompts[index];
        const isCorrect = expected && word.toLowerCase() === expected.toLowerCase();
        return (
          <View key={`${word}-${index}`} style={[styles.sequenceChip, isCorrect ? styles.sequenceChipCorrect : styles.sequenceChipIncorrect]}>
            <Text style={styles.sequenceChipText}>{word}</Text>
          </View>
        );
      })}
    </View>
  );

  const renderIntro = () => (
    <View style={styles.card}>
      <Text style={styles.title}>List recall</Text>
      <Text style={styles.subtitle}>Remember the order, then press the buttons to recreate the original sequence.</Text>

      <GameContextForm value={contextInputs} onChange={setContextInputs} />

      <View style={styles.listPreview}>
        {list.map(item => (
          <View key={item.id} style={styles.listTag}>
            <Text style={styles.listTagText}>{item.label}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, (!canStart && styles.primaryButtonDisabled)]}
        onPress={handleStart}
        disabled={!canStart}
      >
        <IconSymbol name="play.fill" size={18} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>Begin encoding</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
        <Text style={styles.secondaryButtonText}>Back to games</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEncoding = () => (
    <View style={styles.card}>
      <Text style={styles.stageLabel}>Encoding phase</Text>
      <View style={styles.encodingCard}>
        {encodingIndex < list.length ? (
          <Text style={styles.encodingText}>{list[encodingIndex].label}</Text>
        ) : (
          <Text style={styles.encodingText}>Great job! Preparing recall...</Text>
        )}
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${Math.min((encodingIndex / list.length) * 100, 100)}%` }]} />
      </View>
    </View>
  );

  const renderImmediateRecall = () => (
    <View style={styles.card}>
      <Text style={styles.stageLabel}>Immediate recall</Text>
      <Text style={styles.subtitle}>Select the next word to complete the sequence.</Text>

      {renderSelectedSequence(immediateSelections)}

      {immediateSelections.length < list.length && (
        <View>
          <Text style={styles.optionHelper}>Pick the word that comes next in the sequence.</Text>
          {renderOptionGrid(immediateOptions, handleImmediatePick, immediateSelections)}
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.primaryButton, (!immediateReady && styles.primaryButtonDisabled)]}
          onPress={handleImmediateSubmit}
          disabled={!immediateReady}
        >
          <IconSymbol name="checkmark.circle.fill" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Log recall</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostButton} onPress={handleImmediateUndo} disabled={immediateSelections.length === 0}>
          <Text style={styles.ghostButtonText}>Undo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDelay = () => (
    <View style={styles.card}>
      <Text style={styles.stageLabel}>Short break</Text>
      <Text style={styles.subtitle}>We’ll check again shortly using the same method.</Text>
      <View style={styles.countdownBubble}>
        <Text style={styles.countdownText}>{countdown}</Text>
      </View>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => setPhase('delayed')}>
        <Text style={styles.secondaryButtonText}>Skip countdown</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDelayedRecall = () => (
    <View style={styles.card}>
      <Text style={styles.stageLabel}>Delayed recall</Text>
      <Text style={styles.subtitle}>Choose the word order again just like before.</Text>

      {renderSelectedSequence(delayedSelections)}

      {delayedSelections.length < list.length && (
        <View>
          <Text style={styles.optionHelper}>Select the word that fits the next position.</Text>
          {renderOptionGrid(delayedOptions, handleDelayedPick, delayedSelections)}
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.primaryButton, (!delayedReady && styles.primaryButtonDisabled)]}
          onPress={handleDelayedSubmit}
          disabled={!delayedReady}
        >
          <IconSymbol name="flag.checkered" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Complete session</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostButton} onPress={handleDelayedUndo} disabled={delayedSelections.length === 0}>
          <Text style={styles.ghostButtonText}>Undo</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => finalizeSession(attempts)}>
        <Text style={styles.secondaryButtonText}>Skip delayed recall</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRecap = () => {
    if (!recap) {
      return null;
    }

    const immediateAttempt = recap.attempts.find(attempt => attempt.phase === 'immediate');
    const delayedAttempt = recap.attempts.find(attempt => attempt.phase === 'delayed');

    return (
      <View style={styles.card}>
        <Text style={styles.title}>Session recap</Text>
        <TrafficLightBadge status={recap.metrics.trafficLight} trend={recap.metrics.trend} />

        <View style={styles.recapRow}>
          <View style={styles.recapItem}>
            <Text style={styles.recapLabel}>Immediate recall</Text>
            <Text style={styles.recapValue}>{recap.metrics.immediateRecallPct.toFixed(1)}%</Text>
            {immediateAttempt && (
              <Text style={styles.recapDelta}>{immediateAttempt.recalledCount} / {list.length} correct order</Text>
            )}
          </View>
          <View style={styles.recapItem}>
            <Text style={styles.recapLabel}>Delayed recall</Text>
            <Text style={styles.recapValue}>
              {recap.metrics.delayedRecallPct !== null ? `${recap.metrics.delayedRecallPct.toFixed(1)}%` : 'Skipped'}
            </Text>
            {delayedAttempt && (
              <Text style={styles.recapDelta}>{delayedAttempt.recalledCount} / {list.length} correct order</Text>
            )}
          </View>
        </View>

        <View style={styles.sequenceSummary}>
          <Text style={styles.recapLabel}>Target sequence</Text>
          <View style={styles.sequenceRow}>
            {correctPrompts.map(word => (
              <View key={`target-${word}`} style={[styles.sequenceChip, styles.sequenceChipNeutral]}>
                <Text style={styles.sequenceChipText}>{word}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.recapItemWide}>
          <Text style={styles.recapLabel}>Memory score</Text>
          <Text style={styles.recapValue}>{recap.metrics.memoryScore.toFixed(1)}</Text>
          {recap.metrics.forgettingRatePct !== null && (
            <Text style={styles.recapDelta}>Forgetting: {recap.metrics.forgettingRatePct.toFixed(1)} pts</Text>
          )}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleReset}>
          <IconSymbol name="gobackward" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Start new list</Text>
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
        {phase === 'intro' && renderIntro()}
        {phase === 'encoding' && renderEncoding()}
        {phase === 'immediate' && renderImmediateRecall()}
        {phase === 'delay' && renderDelay()}
        {phase === 'delayed' && renderDelayedRecall()}
        {phase === 'complete' && renderRecap()}
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
    gap: 18,
    shadowColor: '#B8C5B8',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#4E5E4E',
  },
  subtitle: {
    fontSize: 15,
    color: '#6C7C6C',
    lineHeight: 22,
  },
  stageLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#5A6B5A',
  },
  listPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  listTag: {
    backgroundColor: '#EEF6EE',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  listTagText: {
    color: '#4E5E4E',
    fontSize: 13,
    fontWeight: '500',
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
  primaryButtonDisabled: {
    backgroundColor: '#B8C5B8',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
  encodingCard: {
    backgroundColor: '#F0F5F0',
    borderRadius: 20,
    paddingVertical: 32,
    alignItems: 'center',
  },
  encodingText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#4E5E4E',
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
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  optionButton: {
    flexBasis: '48%',
    backgroundColor: '#EEF6EE',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D5E4D5',
  },
  optionButtonDisabled: {
    opacity: 0.4,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E5E4E',
  },
  optionHelper: {
    fontSize: 13,
    color: '#6C7C6C',
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  ghostButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  ghostButtonText: {
    color: '#8B6B8B',
    fontSize: 14,
    fontWeight: '500',
  },
  countdownBubble: {
    alignSelf: 'center',
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#EEF6EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#4E5E4E',
  },
  sequenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sequenceChip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D5E4D5',
    backgroundColor: '#FFFFFF',
  },
  sequenceChipNeutral: {
    backgroundColor: '#F0F5F0',
  },
  sequenceChipCorrect: {
    borderColor: '#4CAF50',
    backgroundColor: '#E3F4E3',
  },
  sequenceChipIncorrect: {
    borderColor: '#F8BBD0',
    backgroundColor: '#FDECEF',
  },
  sequenceChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4E5E4E',
  },
  recapRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  recapItem: {
    flexBasis: '48%',
    backgroundColor: '#F0F5F0',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  recapItemWide: {
    backgroundColor: '#EEF6EE',
    borderRadius: 16,
    padding: 16,
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
  sequenceSummary: {
    gap: 8,
  },
});
