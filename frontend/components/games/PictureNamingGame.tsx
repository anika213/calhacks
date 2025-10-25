import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { GameContextForm } from '@/components/games/GameContextForm';
import { TrafficLightBadge } from '@/components/games/TrafficLightBadge';
import { useGameSessions } from '@/contexts/GameSessionContext';
import {
  NamingPrompt,
  NamingSessionRecord,
  NamingSettings,
  NamingTrialRecord,
  SessionContextInputs,
} from '@/types/games';

interface PictureNamingGameProps {
  onClose: () => void;
  onSessionComplete?: (session: NamingSessionRecord) => void;
}

type Stage = 'intro' | 'prompt' | 'complete';

const PROMPTS: NamingPrompt[] = [
  {
    id: 'sunflower',
    image: require('../../assets/images/icon.png'),
    answer: 'Sunflower',
    options: ['Sunflower', 'Tulip', 'Rose'],
    altText: 'Illustration of a stylized flower icon',
    hint: 'Bright yellow petals with a round center',
  },
  {
    id: 'violin',
    image: require('../../assets/images/react-logo.png'),
    answer: 'Violin',
    options: ['Cello', 'Violin', 'Guitar'],
    altText: 'Illustration representing a musical instrument shape',
    hint: 'A bowed string instrument often used in orchestras',
  },
  {
    id: 'lighthouse',
    image: require('../../assets/images/everwell-logo.png'),
    answer: 'Lighthouse',
    options: ['Lighthouse', 'Windmill', 'Tower'],
    altText: 'Simplified emblem that can represent a lighthouse',
    hint: 'Guides ships at night with a bright beam',
  },
];

const createInitialContext = (): SessionContextInputs => ({
  moodLevel: null,
  sleepQuality: null,
  medsChanged: false,
  notes: '',
});

const shuffle = <T,>(source: T[]): T[] => {
  const copy = [...source];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const DEFAULT_SETTINGS: NamingSettings = {
  allowHints: true,
  useSpeechInput: false,
};

export const PictureNamingGame: React.FC<PictureNamingGameProps> = ({ onClose, onSessionComplete }) => {
  const { finalizeNamingSession } = useGameSessions();

  const [stage, setStage] = useState<Stage>('intro');
  const [contextInputs, setContextInputs] = useState<SessionContextInputs>(() => createInitialContext());
  const [deck, setDeck] = useState<NamingPrompt[]>(() => shuffle(PROMPTS));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [promptShownAt, setPromptShownAt] = useState<number | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [usedHint, setUsedHint] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [trials, setTrials] = useState<NamingTrialRecord[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [recap, setRecap] = useState<NamingSessionRecord | null>(null);

  const currentPrompt = deck[currentIndex];

  useEffect(() => {
    if (stage === 'prompt' && currentPrompt) {
      const now = Date.now();
      setPromptShownAt(now);
    }
  }, [stage, currentPrompt]);

  const canStart = Boolean(contextInputs.moodLevel && contextInputs.sleepQuality);

  const handleToggleHint = () => {
    setHintVisible(previous => {
      const next = !previous;
      if (next) {
        setUsedHint(true);
      }
      return next;
    });
  };

  const handleStart = () => {
    if (!canStart) {
      return;
    }
    setDeck(shuffle(PROMPTS));
    setCurrentIndex(0);
    setTrials([]);
    setSessionStartedAt(Date.now());
    setTypedAnswer('');
    setHintVisible(false);
    setUsedHint(false);
    setFeedback(null);
    setRecap(null);
    setStage('prompt');
  };

  const recordTrial = (answerText: string, skipped = false) => {
    if (!currentPrompt) {
      return;
    }

    const normalizedAnswer = answerText.trim();
    const expected = currentPrompt.answer.trim();
    const isCorrect = !skipped && normalizedAnswer.length > 0 && normalizedAnswer.toLowerCase() === expected.toLowerCase();

    const trial: NamingTrialRecord = {
      promptId: currentPrompt.id,
      promptLabel: currentPrompt.answer,
      displayedAt: promptShownAt ?? Date.now(),
      submittedAt: Date.now(),
      responseTimeMs: Date.now() - (promptShownAt ?? Date.now()),
      answerProvided: skipped ? '' : normalizedAnswer,
      isCorrect,
      usedHint,
    };

    const updatedTrials = trials.concat(trial);
    setTrials(updatedTrials);
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    setTimeout(() => {
      if (currentIndex + 1 < deck.length) {
        setCurrentIndex(index => index + 1);
        setTypedAnswer('');
        setHintVisible(false);
        setUsedHint(false);
        setFeedback(null);
      } else {
        finalizeSession(updatedTrials);
      }
    }, 650);
  };

  const finalizeSession = (finalTrials: NamingTrialRecord[]) => {
    const completedAt = Date.now();
    const cleanContext: SessionContextInputs = {
      moodLevel: contextInputs.moodLevel,
      sleepQuality: contextInputs.sleepQuality,
      medsChanged: contextInputs.medsChanged,
      notes: contextInputs.notes?.trim() ? contextInputs.notes.trim() : undefined,
    };

    const session = finalizeNamingSession({
      trials: finalTrials,
      settings: DEFAULT_SETTINGS,
      context: cleanContext,
      startedAt: sessionStartedAt ?? completedAt,
      completedAt,
    });

    setRecap(session);
    setStage('complete');
    onSessionComplete?.(session);
  };

  const handleSubmit = (explicitAnswer?: string) => {
    const answerToUse = explicitAnswer !== undefined ? explicitAnswer : typedAnswer;
    if (!answerToUse.trim()) {
      return;
    }
    recordTrial(answerToUse);
  };

  const handleSkip = () => {
    recordTrial('', true);
  };

  const handleReset = () => {
    setStage('intro');
    setDeck(shuffle(PROMPTS));
    setTrials([]);
    setRecap(null);
    setTypedAnswer('');
    setHintVisible(false);
    setUsedHint(false);
    setCurrentIndex(0);
    setSessionStartedAt(null);
  };

  const renderIntro = () => (
    <View style={styles.card}>
      <Text style={styles.title}>Picture naming</Text>
      <Text style={styles.subtitle}>Name what you see. You can type an answer or pick from quick choices if you prefer.</Text>

      <GameContextForm value={contextInputs} onChange={setContextInputs} />

      <TouchableOpacity
        style={[styles.primaryButton, (!canStart && styles.primaryButtonDisabled)]}
        onPress={handleStart}
        disabled={!canStart}
      >
        <IconSymbol name="play.fill" size={18} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>Start naming</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
        <Text style={styles.secondaryButtonText}>Back to games</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPrompt = () => {
    if (!currentPrompt) {
      return null;
    }

    const isLast = currentIndex === deck.length - 1;

    return (
      <View style={styles.card}>
        <View style={styles.promptHeader}>
          <Text style={styles.stageLabel}>Prompt {currentIndex + 1} / {deck.length}</Text>
          <TouchableOpacity onPress={handleToggleHint} disabled={!DEFAULT_SETTINGS.allowHints}>
            <IconSymbol name="questionmark.circle" size={22} color={DEFAULT_SETTINGS.allowHints ? '#6B8E6B' : '#B8C5B8'} />
          </TouchableOpacity>
        </View>

        <View style={styles.imageFrame}>
          <Image
            source={currentPrompt.image}
            style={styles.image}
            contentFit="contain"
            accessibilityLabel={currentPrompt.altText}
          />
        </View>

        {hintVisible && currentPrompt.hint && (
          <View style={styles.hintCard}>
            <IconSymbol name="lightbulb.fill" size={18} color="#F4B400" />
            <Text style={styles.hintText}>{currentPrompt.hint}</Text>
          </View>
        )}

        <TextInput
          style={styles.answerInput}
          placeholder="Type your answer"
          placeholderTextColor="#9AA79A"
          value={typedAnswer}
          onChangeText={setTypedAnswer}
        />

        <View style={styles.optionRow}>
          {currentPrompt.options.map(option => (
            <TouchableOpacity
              key={`${currentPrompt.id}-${option}`}
              style={styles.optionChip}
              onPress={() => handleSubmit(option)}
            >
              <Text style={styles.optionText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.primaryButton, (!typedAnswer.trim() && styles.primaryButtonDisabled)]} onPress={() => handleSubmit()} disabled={!typedAnswer.trim()}>
            <IconSymbol name={isLast ? 'flag.checkered' : 'arrow.forward.circle.fill'} size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>{isLast ? 'Finish' : 'Submit'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {feedback && (
          <View style={[styles.feedbackBanner, feedback === 'correct' ? styles.feedbackSuccess : styles.feedbackError]}>
            <IconSymbol name={feedback === 'correct' ? 'checkmark.circle.fill' : 'xmark.octagon.fill'} size={18} color="#FFFFFF" />
            <Text style={styles.feedbackText}>{feedback === 'correct' ? 'Nice!' : `It was ${currentPrompt.answer}`}</Text>
          </View>
        )}
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

        <View style={styles.recapList}>
          {recap.trials.map(trial => (
            <View key={trial.promptId} style={styles.recapRow}>
              <Text style={styles.recapPrompt}>{trial.promptLabel}</Text>
              <Text style={[styles.recapAnswer, trial.isCorrect ? styles.recapAnswerCorrect : styles.recapAnswerIncorrect]}>
                {trial.isCorrect ? 'Correct' : trial.answerProvided || 'Skipped'}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.recapSummary}>
          <Text style={styles.recapLabel}>Accuracy</Text>
          <Text style={styles.recapValue}>{recap.metrics.accuracyPct.toFixed(1)}%</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleReset}>
          <IconSymbol name="gobackward" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Play again</Text>
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
        {stage === 'prompt' && renderPrompt()}
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
    fontSize: 16,
    fontWeight: '600',
    color: '#5A6B5A',
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
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageFrame: {
    backgroundColor: '#F0F5F0',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF9E6',
    borderRadius: 14,
    padding: 12,
  },
  hintText: {
    fontSize: 13,
    color: '#8B6B3A',
    flex: 1,
  },
  answerInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0EAE0',
    padding: 14,
    fontSize: 15,
    color: '#4E5E4E',
    backgroundColor: '#FFFFFF',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    backgroundColor: '#EEF6EE',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionText: {
    color: '#4E5E4E',
    fontSize: 14,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  skipText: {
    color: '#8B6B8B',
    fontSize: 14,
    fontWeight: '500',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
  },
  feedbackSuccess: {
    backgroundColor: '#DFF2E0',
  },
  feedbackError: {
    backgroundColor: '#FDEAEA',
  },
  feedbackText: {
    fontSize: 14,
    color: '#4E5E4E',
    fontWeight: '500',
  },
  recapList: {
    gap: 10,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0F5F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recapPrompt: {
    fontSize: 14,
    color: '#4E5E4E',
  },
  recapAnswer: {
    fontSize: 13,
    fontWeight: '600',
  },
  recapAnswerCorrect: {
    color: '#2E7D32',
  },
  recapAnswerIncorrect: {
    color: '#C62828',
  },
  recapSummary: {
    backgroundColor: '#EEF6EE',
    borderRadius: 16,
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
});
