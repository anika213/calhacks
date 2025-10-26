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
} from '@/types/connection';
import {
  connectionDefaultRoundCount,
  connectionHostName,
  startConnectionSession,
  submitConnectionAttempt,
} from '@/services/llm';

const MAX_ATTEMPTS_PER_ROUND = 3;
const MULTI_STATUS_WAITING = 'waiting';
const MULTI_STATUS_COMPLETED = 'completed';

const createUserMessage = (content: string): ConnectionMessage => ({
  id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  role: 'user',
  content,
  createdAt: Date.now(),
});

const createHostMessage = (content: string): ConnectionMessage => ({
  id: `host-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  role: 'host',
  content,
  createdAt: Date.now(),
});

const SoloConnection: React.FC<{ onStartMultiplayer: () => void }> = ({ onStartMultiplayer }) => {
  const { user } = useAuth();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView | null>(null);

  const [phase, setPhase] = useState<ConnectionSessionPhase>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConnectionMessage[]>([]);
  const [questions, setQuestions] = useState<ConnectionQuestion[]>([]);
  const [rounds, setRounds] = useState<ConnectionRound[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [totalRounds, setTotalRounds] = useState(connectionDefaultRoundCount);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const streamingStateRef = useRef<Map<string, { display: boolean; hostPrefixRemoved: boolean; buffer: string }>>(new Map());

  const startStreamingHostMessage = useCallback(() => {
    const id = `stream-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const streamingMessage: ConnectionMessage = {
      id,
      role: 'host',
      content: '',
      createdAt: Date.now(),
      metadata: { streaming: true },
    };
    setMessages(prev => prev.concat(streamingMessage));
    streamingStateRef.current.set(id, { display: true, hostPrefixRemoved: false, buffer: '' });
    return id;
  }, []);

  const appendToStreamingHostMessage = useCallback((id: string, token: string) => {
    if (!token) {
      return;
    }

    const state = streamingStateRef.current.get(id);
    if (!state) {
      return;
    }

    state.buffer += token;

    if (!state.hostPrefixRemoved) {
      const hostIndex = state.buffer.toLowerCase().indexOf('host:');
      if (hostIndex >= 0) {
        state.buffer = state.buffer.slice(hostIndex + 5);
        state.hostPrefixRemoved = true;
      } else {
        state.buffer = state.buffer.slice(-6);
        streamingStateRef.current.set(id, state);
        return;
      }
    }

    if (!state.display) {
      streamingStateRef.current.set(id, state);
      return;
    }

    const bufferLower = state.buffer.toLowerCase();
    const metaIndex = bufferLower.indexOf('meta:');
    let chunkToAppend: string | null = null;

    if (metaIndex >= 0) {
      chunkToAppend = state.buffer.slice(0, metaIndex);
      state.buffer = state.buffer.slice(metaIndex);
      state.display = false;
    } else {
      const metaPrefixes = ['meta:', 'meta', 'met', 'me', 'm'];
      let holdLength = 0;
      for (const prefix of metaPrefixes) {
        if (bufferLower.endsWith(prefix)) {
          holdLength = prefix.length;
          break;
        }
      }
      if (holdLength > 0) {
        chunkToAppend = state.buffer.slice(0, state.buffer.length - holdLength);
        state.buffer = state.buffer.slice(state.buffer.length - holdLength);
      } else {
        chunkToAppend = state.buffer;
        state.buffer = '';
      }
    }

    if (chunkToAppend) {
      setMessages(prev => prev.map(message => {
        if (message.id !== id) {
          return message;
        }
        return {
          ...message,
          content: `${message.content}${chunkToAppend}`,
        };
      }));
    }

    streamingStateRef.current.set(id, state);
  }, []);

  const finalizeStreamingHostMessage = useCallback((id: string, finalContent?: string) => {
    setMessages(prev => prev.map(message => {
      if (message.id !== id) {
        return message;
      }
      return {
        ...message,
        content: finalContent ?? (message.content || '...'),
        metadata: { ...message.metadata, streaming: false },
      };
    }));
    streamingStateRef.current.delete(id);
  }, []);

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

  useEffect(() => {
    if (messages.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const appendMessage = useCallback((message: ConnectionMessage) => {
    setMessages(prev => prev.concat(message));
  }, []);

  const resetSession = useCallback(() => {
    setPhase('idle');
    setSessionId(null);
    setMessages([]);
    setQuestions([]);
    setRounds([]);
    setCurrentRoundIndex(0);
    setTotalRounds(connectionDefaultRoundCount);
    setTotalCorrect(0);
    setInputValue('');
  }, []);

  const finalizeSession = useCallback(() => {
    setPhase('complete');
    appendMessage(createHostMessage('That wraps up our session. Thanks for playing!'));
  }, [appendMessage]);

  const activateNextRound = useCallback((nextRoundIndex: number) => {
    const nextQuestion = questions[nextRoundIndex];
    if (!nextQuestion) {
      finalizeSession();
      return;
    }

    setRounds(prev => prev.map(round => {
      if (round.roundIndex === nextRoundIndex) {
        return {
          ...round,
          status: 'active',
        };
      }
      return round;
    }));

    appendMessage(createHostMessage(nextQuestion.prompt));
    setCurrentRoundIndex(nextRoundIndex);
  }, [appendMessage, finalizeSession, questions]);

  const handleStartSession = useCallback(async () => {
    if (isProcessing) {
      return;
    }
    setIsProcessing(true);
    try {
      const { hostMessage, questions: generatedQuestions } = await startConnectionSession(userProfile, connectionDefaultRoundCount);
      if (!generatedQuestions.length) {
        throw new Error('No questions generated');
      }

      const now = Date.now();
      const newSessionId = `connection-${now}-${Math.random().toString(36).slice(2)}`;
      const initialRounds: ConnectionRound[] = generatedQuestions.map((question, index) => ({
        roundIndex: index,
        question,
        attempts: [],
        status: index === 0 ? 'active' : 'pending',
      }));

      const openingMessages: ConnectionMessage[] = [hostMessage, createHostMessage(generatedQuestions[0].prompt)];

      setSessionId(newSessionId);
      setPhase('inProgress');
      setCurrentRoundIndex(0);
      setQuestions(generatedQuestions);
      setRounds(initialRounds);
      setTotalRounds(generatedQuestions.length);
      setMessages(openingMessages);
      setTotalCorrect(0);
      setInputValue('');
    } catch (error) {
      console.error('Failed to start connection session', error);
      appendMessage(createHostMessage('Sorry, I could not start the trivia session. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  }, [appendMessage, isProcessing, userProfile]);

  const markRoundCompletion = useCallback((roundIndex: number, status: 'completed' | 'failed') => {
    setRounds(prev => prev.map(round => {
      if (round.roundIndex !== roundIndex) {
        return round;
      }
      return {
        ...round,
        status,
        completedAt: Date.now(),
      };
    }));
  }, []);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isProcessing || phase !== 'inProgress') {
      return;
    }

    const activeRound = rounds[currentRoundIndex];
    if (!activeRound || !activeRound.question) {
      return;
    }

    const userMessage = createUserMessage(inputValue.trim());
    appendMessage(userMessage);
    setInputValue('');
    setIsProcessing(true);

    let streamingId: string | null = null;
    try {
      const attemptNumber = activeRound.attempts.length;
      const newStreamingId = startStreamingHostMessage();
      streamingId = newStreamingId;
      const response = await submitConnectionAttempt(
        activeRound.question,
        userMessage.content,
        attemptNumber,
        MAX_ATTEMPTS_PER_ROUND,
        token => appendToStreamingHostMessage(newStreamingId, token),
      );

      setRounds(prev => prev.map(round => {
        if (round.roundIndex !== currentRoundIndex) {
          return round;
        }
        return {
          ...round,
          attempts: round.attempts.concat({
            id: userMessage.id,
            message: userMessage.content,
            isCorrect: response.isCorrect,
            createdAt: userMessage.createdAt,
          }),
        };
      }));

      finalizeStreamingHostMessage(newStreamingId, response.hostMessage.content);

      if (response.isCorrect) {
        setTotalCorrect(prev => prev + 1);
        markRoundCompletion(currentRoundIndex, 'completed');

        const nextRoundIndex = currentRoundIndex + 1;
        if (nextRoundIndex < totalRounds) {
          activateNextRound(nextRoundIndex);
        } else {
          finalizeSession();
        }
      } else {
        const attemptsUsed = attemptNumber + 1;
        if (response.provideAnswer || attemptsUsed >= MAX_ATTEMPTS_PER_ROUND) {
          markRoundCompletion(currentRoundIndex, 'failed');
          const nextRoundIndex = currentRoundIndex + 1;
          if (nextRoundIndex < totalRounds) {
            activateNextRound(nextRoundIndex);
          } else {
            finalizeSession();
          }
        }
      }
    } catch (error) {
      console.error('Failed to submit attempt', error);
      if (streamingId) {
        finalizeStreamingHostMessage(streamingId, 'Something went wrong while checking your answer. Please try again.');
      } else {
        const fallbackId = startStreamingHostMessage();
        finalizeStreamingHostMessage(fallbackId, 'Something went wrong while checking your answer. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  }, [activateNextRound, appendMessage, appendToStreamingHostMessage, currentRoundIndex, finalizeSession, finalizeStreamingHostMessage, inputValue, isProcessing, markRoundCompletion, phase, rounds, startStreamingHostMessage, totalRounds]);

  const handleLoginRedirect = useCallback(() => {
    router.push('/(tabs)/login');
  }, [router]);

  const currentRound = rounds[currentRoundIndex];
  const correctRate = totalRounds > 0 ? Math.round((totalCorrect / totalRounds) * 100) : 0;

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
                : `Total rounds ${totalRounds}`}
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
          {messages.map(message => {
            const isUser = message.role === 'user';
            const isStreaming = Boolean(message.metadata?.streaming);
            const displayContent = isStreaming && !message.content
              ? '...' : message.content;
            return (
              <View
                key={message.id}
                style={[styles.messageBubble, isUser ? styles.userBubble : styles.hostBubble]}
              >
                <Text style={[styles.messageMeta, isUser ? styles.userMeta : styles.hostMeta]}>
                  {isUser ? 'You' : connectionHostName}
                </Text>
                <Text style={[styles.messageText, isUser ? styles.userText : styles.hostText]}>
                  {displayContent}
                </Text>
              </View>
            );
          })}

          {phase === 'complete' && (
            <View style={[styles.card, styles.summaryCard]}>
              <Text style={styles.summaryTitle}>Session Summary</Text>
              <Text style={styles.summaryStat}>Correct {totalCorrect} / {totalRounds}</Text>
              <View style={styles.summaryTable}>
                {rounds.map(round => (
                  <View key={`summary-${round.roundIndex}`} style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Round {round.roundIndex + 1}</Text>
                    <Text style={styles.summaryValue}>
                      {round.status === 'completed'
                        ? `Correct (${round.attempts.length} attempt(s))`
                        : `Missed (${round.attempts.length} attempt(s))`}
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
              <Text style={styles.attemptLabel}>
                {currentRound
                  ? `Remaining attempts ${Math.max(0, MAX_ATTEMPTS_PER_ROUND - currentRound.attempts.length)} / ${MAX_ATTEMPTS_PER_ROUND}`
                  : 'Session in progress'}
              </Text>
              <View style={styles.composerRow}>
                <TextInput
                  style={styles.input}
                  value={inputValue}
                  onChangeText={setInputValue}
                  placeholder="Type your answer"
                  placeholderTextColor="#9AA79A"
                  editable={!isProcessing && phase === 'inProgress'}
                  onSubmitEditing={handleSend}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[styles.sendButton, (!inputValue.trim() || isProcessing || phase !== 'inProgress') && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={!inputValue.trim() || isProcessing || phase !== 'inProgress'}
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
    hostMessages,
    isConnected,
    createLobby,
    joinLobby,
    leaveLobby,
    startLobby,
    submitAttempt,
    refreshFriends,
    refreshLobbies,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
  } = useFriendLobby();

  const [maxPlayersInput, setMaxPlayersInput] = useState('4');
  const [newFriendId, setNewFriendId] = useState('');
  const [joinLobbyId, setJoinLobbyId] = useState('');
  const [answerInput, setAnswerInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshLobbies();
  }, [refreshLobbies]);

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

  const handleSubmitAnswer = useCallback(async () => {
    if (!lobby || !answerInput.trim()) {
      return;
    }
    try {
      setBusy(true);
      await submitAttempt(lobby.id, answerInput.trim());
      setAnswerInput('');
    } catch (error) {
      Alert.alert('Unable to submit answer', error.message);
    } finally {
      setBusy(false);
    }
  }, [answerInput, lobby, submitAttempt]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!newFriendId.trim()) {
      return;
    }
    try {
      await sendFriendRequest(newFriendId.trim());
      setNewFriendId('');
    } catch (error) {
      Alert.alert('Unable to send friend request', error.message);
    }
  }, [newFriendId, sendFriendRequest]);

  const activeQuestion = lobby ? lobby.questions[lobby.currentQuestionIndex] : null;
  const hostMessagesForLobby = useMemo(() => (
    lobby ? hostMessages.filter(message => message.lobbyId === lobby.id) : []
  ), [hostMessages, lobby]);

  const isHost = lobby ? lobby.hostId === user?.id : false;
  const isYourTurn = lobby && lobby.players[lobby.currentTurnIndex]?.userId === user?.id;
  const lobbyStatus = lobby?.status ?? 'idle';

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
            <Text style={styles.subTitle}>Add Friend by ID</Text>
            <View style={styles.inlineRow}>
              <TextInput
                style={styles.lobbyIdInput}
                value={newFriendId}
                onChangeText={setNewFriendId}
                placeholder="Enter user ID"
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

        {lobbyStatus === MULTI_STATUS_WAITING && (
              <>
                <Text style={styles.lobbyInfoText}>
                  Share this lobby ID with your friends: {lobby.id}
                </Text>
                {isHost ? (
                  <TouchableOpacity
                    style={[styles.primaryButton, busy && styles.disabledButton]}
                    onPress={handleStartLobby}
                    disabled={busy}
                  >
                    <IconSymbol name="play.fill" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Start Game</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.infoBannerText}>Waiting for host to start...</Text>
                )}
              </>
            )}

            {lobbyStatus !== MULTI_STATUS_WAITING && (
              <>
                <Text style={styles.subTitle}>Round {lobby.currentQuestionIndex + 1} / {lobby.questions.length}</Text>
                {activeQuestion ? (
                  <View style={styles.questionCard}>
                    <Text style={styles.questionPrompt}>{activeQuestion.prompt}</Text>
                    <Text style={styles.questionMeta}>Current turn: {lobby.players[lobby.currentTurnIndex]?.profile?.name || lobby.players[lobby.currentTurnIndex]?.userId}</Text>
                  </View>
                ) : (
                  <Text style={styles.infoBannerText}>No active question.</Text>
                )}

                <View style={styles.hostMessageContainer}>
                  {hostMessagesForLobby.length === 0 ? (
                    <Text style={styles.emptyStateText}>Host responses will appear here.</Text>
                  ) : (
                    hostMessagesForLobby.map(message => (
                      <View key={message.messageId} style={styles.hostMessageBubble}>
                        <Text style={styles.hostMeta}>Host</Text>
                        <Text style={styles.hostText}>{message.content || '...'}</Text>
                      </View>
                    ))
                  )}
                </View>

                {lobbyStatus !== MULTI_STATUS_COMPLETED ? (
                  <View style={styles.inputCard}>
                    <Text style={styles.attemptLabel}>
                      {isYourTurn ? 'It’s your turn!' : 'Waiting for your turn'}
                    </Text>
                    <View style={styles.composerRow}>
                      <TextInput
                        style={styles.input}
                        value={answerInput}
                        onChangeText={setAnswerInput}
                        placeholder={isYourTurn ? 'Type your answer' : 'Please wait for your turn'}
                        placeholderTextColor="#9AA79A"
                        editable={isYourTurn && !busy}
                        onSubmitEditing={handleSubmitAnswer}
                        returnKeyType="send"
                      />
                      <TouchableOpacity
                        style={[styles.sendButton, (!answerInput.trim() || !isYourTurn || busy) && styles.sendButtonDisabled]}
                        onPress={handleSubmitAnswer}
                        disabled={!answerInput.trim() || !isYourTurn || busy}
                      >
                        <IconSymbol name="paperplane.fill" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.infoBannerText}>Game completed! Thanks for playing.</Text>
                )}
              </>
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
  messageBubble: {
    borderRadius: 18,
    padding: 16,
    gap: 6,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: '#6B8E6B',
    alignSelf: 'flex-end',
  },
  hostBubble: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E0EAE0',
  },
  messageMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  userMeta: {
    color: '#FFFFFF',
  },
  hostMeta: {
    color: '#6C7C6C',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  hostText: {
    color: '#4E5E4E',
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
