import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { useFriendLobby } from '@/contexts/FriendLobbyContext';
import {
  ConnectionMessage,
  ConnectionQuestion,
  ConnectionRound,
  ConnectionSessionPhase,
  ConnectionParticipant,
} from '@/types/connection';
import {
  connectionDefaultRoundCount,
  connectionHostName,
  startConnectionSession,
  submitConnectionAttempt,
  requestHostChatReply,
} from '@/services/llm';

const MULTI_STATUS_WAITING = 'waiting';
const MULTI_STATUS_COMPLETED = 'completed';
const HOST_ACCENT = '#6B8E6B';
const SELF_ACCENT = '#4C7DCF';
const CHAT_COLOR_PALETTE = [
  '#4C7DCF',
  '#6B8E6B',
  '#8B6B8B',
  '#B37A5A',
  '#5B92B2',
  '#A46BB7',
  '#C07C7C',
];

const applyAlphaToHex = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized.padEnd(6, '0');
  const bigint = parseInt(expanded, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const hashToIndex = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

const accentForParticipant = (id: string | undefined, fallback: string = HOST_ACCENT): string => {
  if (!id) {
    return fallback;
  }
  if (id === 'host') {
    return HOST_ACCENT;
  }
  const index = hashToIndex(id) % CHAT_COLOR_PALETTE.length;
  return CHAT_COLOR_PALETTE[index];
};

const formatDuration = (ms?: number): string => {
  if (ms === undefined || ms === null) {
    return '—';
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return remaining ? `${minutes}m ${remaining}s` : `${minutes}m`;
};

const createUserMessage = (content: string, overrides?: Partial<ConnectionMessage>): ConnectionMessage => ({
  id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  role: 'user',
  content,
  createdAt: Date.now(),
  ...overrides,
});

const createHostMessage = (
  content: string,
  overrides?: Partial<ConnectionMessage>,
): ConnectionMessage => ({
  id: `host-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  role: 'host',
  content,
  createdAt: Date.now(),
  authorId: 'host',
  authorName: connectionHostName,
  kind: 'chat',
  ...overrides,
});

const SoloConnection: React.FC<{ onStartMultiplayer: () => void }> = ({ onStartMultiplayer }) => {
  const { user } = useAuth();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView | null>(null);

  const userProfile = useMemo(() => {
    if (!user) {
      return undefined;
    }
    return {
      id: user.id,
      name: user.name,
      age: user.age,
      preferredLanguage: user.preferredLanguage,
    };
  }, [user]);

  const selfId = user?.id ?? 'local-user';
  const selfName = useMemo(() => {
    if (!user) {
      return 'You';
    }
    if (user.name?.trim()) {
      return user.name.trim();
    }
    if (user.email) {
      return user.email.split('@')[0];
    }
    return 'You';
  }, [user]);

  const participants = useMemo<Record<string, ConnectionParticipant>>(() => ({
    host: { id: 'host', displayName: connectionHostName, accentColor: HOST_ACCENT },
    [selfId]: { id: selfId, displayName: selfName, accentColor: SELF_ACCENT },
  }), [selfId, selfName]);

  const [phase, setPhase] = useState<ConnectionSessionPhase>('idle');
  const [messages, setMessages] = useState<ConnectionMessage[]>([]);
  const [questions, setQuestions] = useState<ConnectionQuestion[]>([]);
  const [rounds, setRounds] = useState<ConnectionRound[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [composerMode, setComposerMode] = useState<'guess' | 'chat'>('chat');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (messages.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const appendMessages = useCallback((next: ConnectionMessage | ConnectionMessage[]) => {
    setMessages(prev => prev.concat(Array.isArray(next) ? next : [next]));
  }, []);

  const createUserChatMessage = useCallback((content: string, kind: 'guess' | 'chat'): ConnectionMessage => createUserMessage(content, {
    authorId: selfId,
    authorName: selfName,
    kind,
  }), [selfId, selfName]);

  const resetSession = useCallback(() => {
    setPhase('idle');
    setMessages([]);
    setQuestions([]);
    setRounds([]);
    setCurrentRoundIndex(0);
    setInputValue('');
    setComposerMode('guess');
  }, []);

  const finalizeSession = useCallback((roundSnapshot: ConnectionRound[]) => {
    const total = roundSnapshot.length;
    const solved = roundSnapshot.filter(round => round.status === 'completed').length;
    setPhase('complete');
    appendMessages(createHostMessage(
      `Great game! You solved ${solved} of ${total} questions.`,
      { kind: 'system' },
    ));
  }, [appendMessages]);

  const handleStartSession = useCallback(async () => {
    if (isProcessing) {
      return;
    }
    setIsProcessing(true);
    try {
      const { hostMessage, questions: generatedQuestions } = await startConnectionSession(
        userProfile,
        connectionDefaultRoundCount,
        { mode: 'solo', playerCount: 1 },
      );
      if (!generatedQuestions.length) {
        throw new Error('No questions generated');
      }

      const now = Date.now();
      const initialRounds: ConnectionRound[] = generatedQuestions.map((question, index) => ({
        roundIndex: index,
        question,
        attempts: [],
        status: index === 0 ? 'active' : 'pending',
        startedAt: index === 0 ? now : undefined,
      }));

      setPhase('inProgress');
      setCurrentRoundIndex(0);
      setQuestions(generatedQuestions);
      setRounds(initialRounds);
      setComposerMode('guess');

      const introMessages: ConnectionMessage[] = [
        hostMessage,
        createHostMessage(`Round 1: ${generatedQuestions[0].prompt}`, {
          kind: 'system',
          createdAt: now,
        }),
      ];
      setMessages(introMessages);
    } catch (error) {
      console.error('Failed to start connection session', error);
      appendMessages(createHostMessage('Sorry, I could not start the trivia session. Please try again.', {
        kind: 'system',
      }));
    } finally {
      setIsProcessing(false);
    }
  }, [appendMessages, isProcessing, userProfile]);

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }

    const mode = composerMode;
    const userMessage = createUserChatMessage(trimmed, mode);
    appendMessages(userMessage);
    setInputValue('');

    if (mode === 'chat') {
      setIsProcessing(true);
      try {
        const historyWindow = [...messages, userMessage].slice(-8);
        const hostReply = await requestHostChatReply(historyWindow, { mode: 'solo', playerCount: 1 });
        if (hostReply) {
          appendMessages(hostReply);
        }
      } catch (error) {
        console.error('Failed to fetch host chat reply', error);
        appendMessages(createHostMessage("I'm taking a brief pause—keep the conversation going!", {
          kind: 'system',
        }));
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (phase !== 'inProgress') {
      return;
    }

    const activeRound = rounds[currentRoundIndex];
    if (!activeRound || !activeRound.question) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await submitConnectionAttempt(activeRound.question, trimmed, {
        mode: 'solo',
        playerCount: 1,
      });

      const now = Date.now();
      const startedAt = activeRound.startedAt ?? now;
      const elapsed = now - startedAt;

      let nextRounds = rounds.map(round => {
        if (round.roundIndex !== currentRoundIndex) {
          return round;
        }
        const attempts = round.attempts.concat({
          id: userMessage.id,
          message: trimmed,
          isCorrect: response.isCorrect,
          createdAt: userMessage.createdAt,
          authorId: selfId,
          elapsedMs: elapsed,
        });
        return {
          ...round,
          attempts,
          startedAt,
          status: response.isCorrect ? 'completed' : 'active',
          solvedAt: response.isCorrect ? now : round.solvedAt,
          solverId: response.isCorrect ? selfId : round.solverId,
          solveDurationMs: response.isCorrect ? elapsed : round.solveDurationMs,
        };
      });

      const nextMessages: ConnectionMessage[] = [response.hostMessage];

      if (response.isCorrect) {
        const nextIndex = currentRoundIndex + 1;
        if (nextIndex < rounds.length) {
          const activationTimestamp = Date.now();
          nextRounds = nextRounds.map(round =>
            round.roundIndex === nextIndex
              ? {
                  ...round,
                  status: 'active',
                  startedAt: activationTimestamp,
                  solvedAt: undefined,
                  solveDurationMs: undefined,
                }
              : round,
          );
          const nextQuestion = questions[nextIndex];
          if (nextQuestion) {
            nextMessages.push(createHostMessage(`Round ${nextIndex + 1}: ${nextQuestion.prompt}`, {
              kind: 'system',
              createdAt: activationTimestamp,
            }));
          }
          setCurrentRoundIndex(nextIndex);
        } else {
          finalizeSession(nextRounds);
        }
      }

      setRounds(nextRounds);
      appendMessages(nextMessages);
    } catch (error) {
      console.error('Failed to submit attempt', error);
      appendMessages(createHostMessage('Something went wrong while checking that answer. Try again in a moment.', {
        kind: 'system',
      }));
    } finally {
      setIsProcessing(false);
    }
  }, [
    appendMessages,
    composerMode,
    createUserChatMessage,
    currentRoundIndex,
    finalizeSession,
    inputValue,
    messages,
    phase,
    questions,
    rounds,
    selfId,
  ]);

  const handleLoginRedirect = useCallback(() => {
    router.push('/(tabs)/login');
  }, [router]);

  const totalRounds = questions.length;
  const plannedRounds = totalRounds || connectionDefaultRoundCount;
  const solvedCount = rounds.filter(round => round.status === 'completed').length;
  const correctRate = totalRounds > 0 ? Math.round((solvedCount / totalRounds) * 100) : 0;
  const isSendDisabled = !inputValue.trim()
    || isProcessing
    || (composerMode === 'guess' && phase !== 'inProgress');

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.card, styles.centeredCard]}>
          <IconSymbol name="person.crop.circle.badge.exclam" size={48} color="#6B8E6B" />
          <Text style={styles.title}>로그인이 필요해요</Text>
          <Text style={styles.subtitle}>Connection 탭을 이용하려면 먼저 로그인해 주세요.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={handleLoginRedirect}>
            <Text style={styles.primaryButtonText}>로그인 화면으로 이동</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.modeSwitchRow}>
        <TouchableOpacity onPress={onStartMultiplayer} style={styles.modeSwitchButton}>
          <IconSymbol name="person.2.fill" size={18} color="#6B8E6B" />
          <Text style={styles.modeSwitchText}>Switch to Friends Trivia</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <IconSymbol name="sparkles" size={24} color="#6B8E6B" />
          <Text style={styles.headerTitle}>Connection Trivia</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          {phase === 'inProgress'
            ? `${connectionHostName} is guiding you through personalised trivia!`
            : 'Start a three-question trivia session hosted by our LLM.'}
        </Text>
        <View style={styles.progressRow}>
          <View style={[styles.progressBadge, phase === 'inProgress' && styles.progressBadgeActive]}>
            <Text style={[styles.progressBadgeText, phase === 'inProgress' && styles.progressBadgeTextActive]}>
              {phase === 'inProgress'
                ? `Round ${currentRoundIndex + 1} / ${totalRounds}`
                : `Planned rounds ${plannedRounds}`}
            </Text>
          </View>
          {phase === 'complete' && (
            <View style={[styles.progressBadge, styles.progressBadgeActive]}>
              <Text style={[styles.progressBadgeText, styles.progressBadgeTextActive]}>Accuracy {correctRate}%</Text>
            </View>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.transcript}
          contentContainerStyle={styles.transcriptContent}
          keyboardShouldPersistTaps="handled"
        >
            {messages.map((message, index) => {
              const bubbleKey = `${message.id}-${index}`;
              const participant = (message.authorId && participants[message.authorId])
                || (message.role === 'host' ? participants.host : participants[selfId]);
              const accent = participant?.accentColor ?? accentForParticipant(message.authorId ?? message.role);
              const isSelf = message.authorId === selfId;
              const tagLabel = message.kind === 'guess'
              ? 'Answer'
              : message.kind === 'system'
                ? 'Host'
                : undefined;
            const displayName = message.authorName ?? participant?.displayName ?? (message.role === 'host' ? connectionHostName : 'Player');
            return (
              <View
                key={bubbleKey}
                style={[
                  styles.messageBubble,
                  {
                    alignSelf: isSelf ? 'flex-end' : 'flex-start',
                    backgroundColor: applyAlphaToHex(accent, message.kind === 'system' ? 0.08 : 0.16),
                    borderColor: applyAlphaToHex(accent, 0.3),
                  },
                ]}
              >
                <View style={styles.messageMetaRow}>
                  <Text style={[styles.messageMeta, { color: accent }]}>{displayName}</Text>
                  {tagLabel && (
                    <View style={[styles.messageTag, { backgroundColor: applyAlphaToHex(accent, 0.16) }]}>
                      <Text style={[styles.messageTagText, { color: accent }]}>{tagLabel}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.messageText, message.kind === 'system' && styles.systemText]}>
                  {message.content}
                </Text>
              </View>
            );
          })}

          {phase === 'complete' && (
            <View style={[styles.card, styles.summaryCard]}>
              <Text style={styles.summaryTitle}>Session Summary</Text>
              <Text style={styles.summaryStat}>Solved {solvedCount} / {totalRounds}</Text>
              <View style={styles.summaryTable}>
                {rounds.map(round => (
                  <View key={`summary-${round.roundIndex}`} style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Round {round.roundIndex + 1}</Text>
                    <Text style={styles.summaryValue}>
                      {round.status === 'completed'
                        ? `Solved in ${formatDuration(round.solveDurationMs)} (${round.attempts.length} attempt(s))`
                        : `Unsolved (${round.attempts.length} attempt(s))`}
                    </Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={styles.secondaryButton} onPress={resetSession}>
                <Text style={styles.secondaryButtonText}>Start a new session</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputCard}>
          {phase === 'idle' && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartSession} disabled={isProcessing}>
              <IconSymbol name="play.fill" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Start game</Text>
            </TouchableOpacity>
          )}

          {phase === 'inProgress' && (
            <View>
              <View style={styles.composerModeRow}>
                <TouchableOpacity
                  style={[styles.modeChip, composerMode === 'guess' && styles.modeChipActive]}
                  onPress={() => setComposerMode('guess')}
                >
                  <Text style={[styles.modeChipText, composerMode === 'guess' && styles.modeChipTextActive]}>
                    Answer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeChip, composerMode === 'chat' && styles.modeChipActive]}
                  onPress={() => setComposerMode('chat')}
                >
                  <Text style={[styles.modeChipText, composerMode === 'chat' && styles.modeChipTextActive]}>
                    Chat
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.composerRow}>
                <TextInput
                  style={styles.input}
                  value={inputValue}
                  onChangeText={setInputValue}
                  placeholder={composerMode === 'guess' ? 'Share your answer...' : 'Start a friendly chat...'}
                  placeholderTextColor="#9AA79A"
                  editable={!isProcessing}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={isSendDisabled}
                >
                  <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {phase === 'complete' && (
            <TouchableOpacity style={styles.primaryButton} onPress={resetSession}>
              <IconSymbol name="arrow.clockwise" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Play again</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const MultiplayerConnection: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user } = useAuth();
  const {
    friends,
    lobby,
    availableLobbies,
    isConnected,
    createLobby,
    joinLobby,
    leaveLobby,
    startLobby,
    sendLobbyMessage,
    refreshFriends,
    refreshLobbies,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
  } = useFriendLobby();

  const [maxPlayersInput, setMaxPlayersInput] = useState('4');
  const [newFriendId, setNewFriendId] = useState('');
  const [joinLobbyId, setJoinLobbyId] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [composerMode, setComposerMode] = useState<'guess' | 'chat'>('guess');
  const [busy, setBusy] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const chatScrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    refreshLobbies();
  }, [refreshLobbies]);

  useEffect(() => {
    if (lobby?.messages?.length) {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [lobby?.messages]);

  const handleCreateLobby = useCallback(async () => {
    try {
      setBusy(true);
      await createLobby({ maxPlayers: Number(maxPlayersInput) || undefined });
    } catch (error) {
      Alert.alert('Unable to create lobby', error.message);
    } finally {
      setBusy(false);
    }
  }, [createLobby, maxPlayersInput]);

  const handleJoinLobby = useCallback(async (lobbyId: string) => {
    try {
      setBusy(true);
      await joinLobby(lobbyId);
      setJoinLobbyId('');
    } catch (error) {
      Alert.alert('Unable to join lobby', error.message);
    } finally {
      setBusy(false);
    }
  }, [joinLobby]);

  const handleLeaveLobby = useCallback(async () => {
    if (!lobby) {
      return;
    }
    try {
      setBusy(true);
      await leaveLobby(lobby.id);
    } catch (error) {
      Alert.alert('Unable to leave lobby', error.message);
    } finally {
      setBusy(false);
    }
  }, [leaveLobby, lobby]);

  const handleStartLobby = useCallback(async () => {
    if (!lobby) {
      return;
    }
    try {
      setBusy(true);
      await startLobby(lobby.id);
    } catch (error) {
      Alert.alert('Unable to start lobby', error.message);
    } finally {
      setBusy(false);
    }
  }, [lobby, startLobby]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!newFriendId.trim()) {
      return;
    }
    try {
      const response = await sendFriendRequest(newFriendId.trim());
      const successMessage = response?.message || 'Friend request sent.';
      Alert.alert('Friend request sent', successMessage);
      setNewFriendId('');
    } catch (error) {
      Alert.alert('Unable to send friend request', error.message);
    }
  }, [newFriendId, sendFriendRequest]);

  const handleSendMessage = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || !lobby) {
      return;
    }

    if (composerMode === 'guess' && lobby.status !== 'inProgress') {
      Alert.alert('Hold on', 'Wait for the host to start the game before sending answers.');
      return;
    }

    try {
      setIsSending(true);
      await sendLobbyMessage(trimmed, composerMode);
      setInputValue('');
      if (composerMode === 'guess') {
        setComposerMode('chat');
      }
    } catch (error) {
      Alert.alert('Unable to send message', error.message);
    } finally {
      setIsSending(false);
    }
  }, [composerMode, inputValue, lobby, sendLobbyMessage]);

  const normalizeUserId = (value: unknown): string | null => {
    if (!value) {
      return null;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object') {
      const maybeObject = value as { $oid?: string; toString?: () => string };
      if (maybeObject.$oid) {
        return maybeObject.$oid;
      }
      if (typeof maybeObject.toString === 'function') {
        const result = maybeObject.toString();
        if (result && result !== '[object Object]') {
          return result;
        }
      }
    }
    return null;
  };

  const participants = useMemo<Record<string, { displayName: string; accentColor: string }>>(() => {
    if (!lobby) {
      return { host: { displayName: connectionHostName, accentColor: HOST_ACCENT } };
    }
    const map: Record<string, { displayName: string; accentColor: string }> = {
      host: { displayName: connectionHostName, accentColor: HOST_ACCENT },
    };
    lobby.players.forEach(player => {
      const name = player.profile?.name || player.profile?.email || player.userId;
      map[player.userId] = {
        displayName: name,
        accentColor: accentForParticipant(player.userId, SELF_ACCENT),
      };
    });
    return map;
  }, [lobby]);

  const messages = lobby?.messages ?? [];
  const currentUserId = normalizeUserId(user?.id) ?? normalizeUserId((user as any)?._id);
  const isHost = lobby ? lobby.hostId === currentUserId : false;
  const lobbyStatus = useMemo(() => {
    if (!lobby) {
      return 'idle';
    }
    if (lobby.status === MULTI_STATUS_WAITING) {
      const hasQuestionMessage = (lobby.messages ?? []).some(message =>
        message.kind === 'system' && /Round\s+\d+/i.test(message.content));
      if (hasQuestionMessage) {
        return 'inProgress';
      }
    }
    return lobby.status;
  }, [lobby]);
  const solvedCount = lobby ? lobby.questions.filter(question => question.completed).length : 0;
  const lobbyRoundCount = lobby ? lobby.questions.length : 0;
  const guessDisabled = lobbyStatus !== 'inProgress';
  const sendDisabled = !inputValue.trim() || isSending || (composerMode === 'guess' && guessDisabled);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.multiScrollContent}>
        <View style={styles.multiplayerHeaderRow}>
          <TouchableOpacity style={styles.modeSwitchButton} onPress={onBack}>
            <IconSymbol name="arrow.uturn.backward" size={18} color="#6B8E6B" />
            <Text style={styles.modeSwitchText}>Back to Solo</Text>
          </TouchableOpacity>
          <Text style={styles.multiplayerTitle}>Friends Trivia Lobby</Text>
        </View>

        {!isConnected && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>Connecting to realtime service...</Text>
          </View>
        )}

        {!lobby && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Create a Lobby</Text>
            <View style={styles.inlineRow}>
              <TextInput
                style={styles.smallInput}
                value={maxPlayersInput}
                onChangeText={setMaxPlayersInput}
                keyboardType="number-pad"
                placeholder="Max players"
                placeholderTextColor="#9AA79A"
              />
              <TouchableOpacity
                style={[styles.primaryButton, busy && styles.disabledButton]}
                onPress={handleCreateLobby}
                disabled={busy}
              >
                <IconSymbol name="plus" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Create Lobby</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={refreshLobbies}>
              <Text style={styles.secondaryButtonText}>Refresh Available Lobbies</Text>
            </TouchableOpacity>
            <View style={styles.inlineRow}>
              <TextInput
                style={styles.lobbyIdInput}
                value={joinLobbyId}
                onChangeText={setJoinLobbyId}
                placeholder="Enter lobby ID"
                placeholderTextColor="#9AA79A"
              />
              <TouchableOpacity
                style={[styles.secondaryButton, styles.joinButton]}
                onPress={() => handleJoinLobby(joinLobbyId.trim())}
                disabled={!joinLobbyId.trim() || busy}
              >
                <Text style={styles.secondaryButtonText}>Join</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.subTitle}>Friend Lobbies</Text>
            {availableLobbies.length === 0 ? (
              <Text style={styles.emptyStateText}>No friend lobbies are waiting right now.</Text>
            ) : (
              <View style={styles.lobbyListContainer}>
                {availableLobbies.map(item => (
                  <View key={item.id} style={styles.lobbyListItem}>
                    <View>
                      <Text style={styles.lobbyListTitle}>Host: {item.players.find(player => player.isHost)?.profile?.name || 'Friend'}</Text>
                      <Text style={styles.lobbyListSubtitle}>
                        Players {item.players.length}/{item.maxPlayers}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => handleJoinLobby(item.id)}
                      disabled={busy}
                    >
                      <Text style={styles.secondaryButtonText}>Join</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {!lobby && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Friends</Text>
              <TouchableOpacity onPress={refreshFriends}>
                <IconSymbol name="arrow.clockwise" size={18} color="#6B8E6B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.subTitle}>Add Friend by ID, email, or name</Text>
            <View style={styles.inlineRow}>
              <TextInput
                style={styles.lobbyIdInput}
                value={newFriendId}
                onChangeText={setNewFriendId}
                placeholder="Enter user ID, email, or name"
                placeholderTextColor="#9AA79A"
              />
              <TouchableOpacity style={styles.secondaryButton} onPress={handleSendFriendRequest}>
                <Text style={styles.secondaryButtonText}>Send</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.subTitle}>Pending Requests</Text>
            {friends.incoming.length === 0 && friends.outgoing.length === 0 ? (
              <Text style={styles.emptyStateText}>No pending requests.</Text>
            ) : (
              <>
                {friends.incoming.map(request => (
                  <View key={request.id} style={styles.friendRow}>
                    <Text style={styles.friendName}>{request.user.name || request.user.id}</Text>
                    <View style={styles.inlineRow}>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => acceptFriendRequest(request.id)}
                      >
                        <Text style={styles.secondaryButtonText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dangerButton}
                        onPress={() => removeFriend(request.id)}
                      >
                        <Text style={styles.dangerButtonText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {friends.outgoing.map(request => (
                  <View key={request.id} style={styles.friendRow}>
                    <Text style={styles.friendName}>{request.user.name || request.user.id} (sent)</Text>
                    <TouchableOpacity
                      style={styles.dangerButton}
                      onPress={() => removeFriend(request.id)}
                    >
                      <Text style={styles.dangerButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            <Text style={styles.subTitle}>Friends List</Text>
            {friends.friends.length === 0 ? (
              <Text style={styles.emptyStateText}>Add friends to start multiplayer games.</Text>
            ) : (
              friends.friends.map(entry => (
                <View key={entry.id} style={styles.friendRow}>
                  <Text style={styles.friendName}>{entry.user.name || entry.user.id}</Text>
                  <TouchableOpacity
                    style={styles.dangerButton}
                    onPress={() => removeFriend(entry.id)}
                  >
                    <Text style={styles.dangerButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {lobby && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Lobby #{lobby.id.slice(-6)}</Text>
              <TouchableOpacity style={styles.dangerButton} onPress={handleLeaveLobby} disabled={busy}>
                <Text style={styles.dangerButtonText}>Leave</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.subTitle}>Players</Text>
            {lobby.players.map(player => (
              <View key={player.userId} style={styles.friendRow}>
                <Text style={styles.friendName}>
                  {player.profile?.name || player.userId}
                  {player.isHost ? ' (Host)' : ''}
                  {player.isYou ? ' (You)' : ''}
                </Text>
                <Text style={styles.friendMeta}>Score: {player.score}</Text>
              </View>
            ))}

            <Text style={styles.lobbyInfoText}>
              Share this lobby ID with your friends: {lobby.id}
            </Text>

            {lobbyStatus === MULTI_STATUS_WAITING && (
              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerText}>
                  Waiting for the host to start the game.
                </Text>
                {isHost && (
                  <TouchableOpacity
                    style={[styles.primaryButton, busy && styles.disabledButton]}
                    onPress={handleStartLobby}
                    disabled={busy}
                  >
                    <IconSymbol name="play.fill" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Start Game</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Text style={styles.subTitle}>Conversation</Text>
            <ScrollView
              ref={chatScrollRef}
              style={styles.chatScroll}
              contentContainerStyle={styles.chatContent}
              keyboardShouldPersistTaps="handled"
            >
            {messages.length === 0 ? (
              <Text style={styles.emptyStateText}>Say hello to get things started!</Text>
            ) : (
              messages.map((message, index) => {
                const bubbleKey = `${message.id}-${index}`;
                const participant = message.authorId
                  ? participants[message.authorId]
                  : participants.host;
                const accent = participant?.accentColor ?? HOST_ACCENT;
                const alignSelf = message.authorId && currentUserId && message.authorId === currentUserId
                    ? 'flex-end'
                    : 'flex-start';
                  const tagLabel = message.kind === 'guess'
                    ? 'Answer'
                    : message.kind === 'system'
                      ? 'Host'
                      : undefined;
                  const displayName = participant?.displayName || (message.role === 'host' ? connectionHostName : 'Player');
                  return (
                    <View
                    key={bubbleKey}
                      style={[
                        styles.messageBubble,
                        {
                          alignSelf,
                          backgroundColor: applyAlphaToHex(accent, message.kind === 'system' ? 0.08 : 0.16),
                          borderColor: applyAlphaToHex(accent, 0.3),
                        },
                      ]}
                    >
                      <View style={styles.messageMetaRow}>
                        <Text style={[styles.messageMeta, { color: accent }]}>{displayName}</Text>
                        {tagLabel && (
                          <View style={[styles.messageTag, { backgroundColor: applyAlphaToHex(accent, 0.16) }]}>
                            <Text style={[styles.messageTagText, { color: accent }]}>{tagLabel}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.messageText, message.kind === 'system' && styles.systemText]}>
                        {message.content}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.lobbyComposer}>
              <View style={styles.composerModeRow}>
                <TouchableOpacity
                  style={[styles.modeChip, composerMode === 'guess' && styles.modeChipActive]}
                  onPress={() => setComposerMode('guess')}
                >
                  <Text style={[styles.modeChipText, composerMode === 'guess' && styles.modeChipTextActive]}>
                    Answer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeChip, composerMode === 'chat' && styles.modeChipActive]}
                  onPress={() => setComposerMode('chat')}
                >
                  <Text style={[styles.modeChipText, composerMode === 'chat' && styles.modeChipTextActive]}>
                    Chat
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.composerRow}>
                <TextInput
                  style={styles.input}
                  value={inputValue}
                  onChangeText={setInputValue}
                  placeholder={composerMode === 'guess' ? 'Type your answer...' : 'Send a friendly message...'}
                  placeholderTextColor="#9AA79A"
                  editable={!busy && !isSending}
                  onSubmitEditing={handleSendMessage}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[styles.sendButton, sendDisabled && styles.sendButtonDisabled]}
                  onPress={handleSendMessage}
                  disabled={sendDisabled}
                >
                  <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              {composerMode === 'guess' && guessDisabled && (
                <Text style={styles.helperText}>The host needs to start the game before answers count.</Text>
              )}
            </View>

            {lobbyStatus === MULTI_STATUS_COMPLETED && (
              <View style={[styles.card, styles.summaryCard]}>
                <Text style={styles.summaryTitle}>Game Summary</Text>
                <Text style={styles.summaryStat}>Solved {solvedCount} / {lobbyRoundCount}</Text>
              <View style={styles.summaryTable}>
                {lobby.questions.map((question, index) => {
                  const solverName = question.winnerId
                    ? participants[question.winnerId]?.displayName || 'Player'
                    : 'Player';
                  const durationRaw = question.solveDurationMs;
                  const durationValue = durationRaw !== undefined && durationRaw !== null
                    ? Number(durationRaw)
                    : undefined;
                  return (
                    <View key={`multi-summary-${question.id}`} style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Round {index + 1}</Text>
                      <Text style={styles.summaryValue}>
                        {question.completed
                          ? `Solved by ${solverName} in ${formatDuration(durationValue)}`
                          : 'Unsolved'}
                      </Text>
                    </View>
                  );
                })}
              </View>
              </View>
            )}
          </View>
        )}

        {busy && <ActivityIndicator style={styles.loadingSpinner} color="#6B8E6B" />}
      </ScrollView>
    </SafeAreaView>
  );
};

const ConnectionScreen: React.FC = () => {
  const [mode, setMode] = useState<'solo' | 'multi'>('solo');

  if (mode === 'multi') {
    return <MultiplayerConnection onBack={() => setMode('solo')} />;
  }

  return <SoloConnection onStartMultiplayer={() => setMode('multi')} />;
};

const styles = StyleSheet.create({
  modeSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modeSwitchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#E8F3E8',
    gap: 8,
  },
  modeSwitchText: {
    color: '#6B8E6B',
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#F4F9F4',
  },
  flex: {
    flex: 1,
  },
  headerCard: {
    margin: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 12,
    shadowColor: '#B8C5B8',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4E5E4E',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6C7C6C',
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  progressBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#E6F0E6',
  },
  progressBadgeActive: {
    backgroundColor: '#6B8E6B',
  },
  progressBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4E5E4E',
  },
  progressBadgeTextActive: {
    color: '#FFFFFF',
  },
  multiScrollContent: {
    paddingBottom: 40,
    gap: 16,
  },
  multiplayerHeaderRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  multiplayerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4E5E4E',
  },
  infoBanner: {
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF9E6',
  },
  infoBannerText: {
    color: '#8B6B3A',
    fontSize: 13,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: '#B8C5B8',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4E5E4E',
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5A6B5A',
    marginTop: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  smallInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5E4D5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F7FDF7',
    color: '#4E5E4E',
  },
  lobbyIdInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5E4D5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    color: '#4E5E4E',
  },
  disabledButton: {
    opacity: 0.5,
  },
  joinButton: {
    paddingHorizontal: 12,
  },
  lobbyListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0EAE0',
  },
  lobbyListContainer: {
    gap: 8,
  },
  lobbyListTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4E5E4E',
  },
  lobbyListSubtitle: {
    fontSize: 12,
    color: '#6C7C6C',
  },
  emptyStateText: {
    fontSize: 13,
    color: '#8A9A8A',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  friendName: {
    fontSize: 14,
    color: '#4E5E4E',
    fontWeight: '600',
  },
  friendMeta: {
    fontSize: 12,
    color: '#6C7C6C',
  },
  dangerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F9E0E0',
  },
  dangerButtonText: {
    color: '#C64848',
    fontWeight: '600',
  },
  lobbyInfoText: {
    fontSize: 13,
    color: '#6C7C6C',
  },
  questionCard: {
    backgroundColor: '#EEF6EE',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  questionPrompt: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E5E4E',
  },
  questionMeta: {
    fontSize: 12,
    color: '#6C7C6C',
  },
  hostMessageContainer: {
    gap: 8,
    marginTop: 12,
  },
  hostMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0EAE0',
    padding: 12,
    gap: 4,
  },
  loadingSpinner: {
    marginTop: 12,
  },
  transcript: {
    flex: 1,
    marginHorizontal: 20,
  },
  transcriptContent: {
    paddingBottom: 180,
    gap: 12,
  },
  chatScroll: {
    maxHeight: 360,
    marginTop: 12,
  },
  chatContent: {
    paddingBottom: 16,
    gap: 10,
  },
  messageBubble: {
    borderRadius: 18,
    padding: 14,
    gap: 6,
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: '#E0EAE0',
  },
  messageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  messageMeta: {
    fontSize: 11,
    fontWeight: '600',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  systemText: {
    fontStyle: 'italic',
  },
  messageTag: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  messageTagText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  lobbyComposer: {
    borderTopWidth: 1,
    borderTopColor: '#E4ECE4',
    paddingTop: 12,
    marginTop: 16,
    gap: 12,
  },
  composerModeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D6E1D6',
    backgroundColor: '#FFFFFF',
  },
  modeChipActive: {
    backgroundColor: '#E4F3E4',
    borderColor: '#6B8E6B',
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6C7C6C',
  },
  modeChipTextActive: {
    color: '#3F6B3F',
  },
  helperText: {
    fontSize: 12,
    color: '#8E8E8E',
  },
  inputCard: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 8,
    elevation: 10,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D5E4D5',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#4E5E4E',
    backgroundColor: '#F7FDF7',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B8E6B',
  },
  sendButtonDisabled: {
    backgroundColor: '#B8C5B8',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B8E6B',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 12,
    alignSelf: 'stretch',
    backgroundColor: '#EEF6EE',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4E5E4E',
    fontSize: 14,
    fontWeight: '600',
  },
  attemptLabel: {
    fontSize: 12,
    color: '#6C7C6C',
    marginBottom: 8,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    gap: 12,
    margin: 20,
    shadowColor: '#B8C5B8',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  centeredCard: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#4E5E4E',
  },
  subtitle: {
    fontSize: 14,
    color: '#6C7C6C',
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryCard: {
    marginHorizontal: 0,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4E5E4E',
  },
  summaryStat: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5A6B5A',
  },
  summaryTable: {
    marginTop: 8,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F0F5F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#4E5E4E',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    color: '#6C7C6C',
    fontWeight: '600',
  },
});

export default ConnectionScreen;
