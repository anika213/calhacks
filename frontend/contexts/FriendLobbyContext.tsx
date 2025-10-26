import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { useAuth } from '@/contexts/AuthContext';

interface FriendUser {
  id: string;
  name?: string;
  email?: string;
  age?: number | null;
  preferredLanguage?: string | null;
}

interface FriendRecord {
  id: string;
  user: FriendUser;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

interface FriendSnapshot {
  friends: FriendRecord[];
  incoming: FriendRecord[];
  outgoing: FriendRecord[];
}

interface LobbyPlayer {
  userId: string;
  score: number;
  order: number;
  joinedAt?: string;
  isHost: boolean;
  isYou: boolean;
  profile?: FriendUser | null;
}

interface LobbyQuestion {
  id: string;
  prompt: string;
  hints: string[];
  completed: boolean;
  winnerId: string | null;
  attempts: Array<{
    userId: string;
    response: string;
    createdAt?: string;
    isCorrect: boolean;
    elapsedMs?: number;
  }>;
  startedAt?: number | null;
  solvedAt?: number | null;
  solveDurationMs?: number | null;
}

interface LobbyMessage {
  id: string;
  role: 'user' | 'host' | 'system';
  authorId: string | null;
  authorName?: string | null;
  content: string;
  kind?: string;
  createdAt?: number;
}

interface LobbyState {
  id: string;
  hostId: string;
  status: string;
  maxPlayers: number;
  currentQuestionIndex: number;
  currentTurnIndex: number;
  players: LobbyPlayer[];
  questions: LobbyQuestion[];
  messages: LobbyMessage[];
  createdAt?: string;
  updatedAt?: string;
}

interface FriendLobbyContextValue {
  friends: FriendSnapshot;
  lobby: LobbyState | null;
  availableLobbies: LobbyState[];
  isConnected: boolean;
  createLobby: (options?: { maxPlayers?: number }) => Promise<void>;
  joinLobby: (lobbyId: string) => Promise<void>;
  leaveLobby: (lobbyId: string) => Promise<void>;
  startLobby: (lobbyId: string) => Promise<void>;
  sendLobbyMessage: (content: string, kind: 'chat' | 'guess') => Promise<void>;
  refreshFriends: () => Promise<void>;
  refreshLobbies: () => Promise<void>;
  sendFriendRequest: (targetUserId: string) => Promise<{ success: boolean; message?: string }>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
}

const FriendLobbyContext = createContext<FriendLobbyContextValue | undefined>(undefined);

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';
const SOCKET_URL = API_BASE_URL.replace(/\/?api\/?$/, '');

const defaultSnapshot: FriendSnapshot = {
  friends: [],
  incoming: [],
  outgoing: [],
};

const getAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export const FriendLobbyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [friends, setFriends] = useState<FriendSnapshot>(defaultSnapshot);
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [availableLobbies, setAvailableLobbies] = useState<LobbyState[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchWithAuth = useCallback(async (path: string, options: RequestInit = {}) => {
    if (!token) {
      throw new Error('Not authenticated');
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...getAuthHeaders(token),
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const text = await response.text();
      let message = text || 'Request failed';
      try {
        const parsed = JSON.parse(text);
        if (parsed?.message) {
          message = parsed.message;
        }
      } catch {
        // ignore parse errors, fallback to raw text
      }
      throw new Error(message);
    }
    return response.json();
  }, [token]);

  const refreshFriends = useCallback(async () => {
    if (!token) {
      setFriends(defaultSnapshot);
      return;
    }
    try {
      const data = await fetchWithAuth('/friends', { method: 'GET' });
      setFriends(data.data || defaultSnapshot);
    } catch (error) {
      console.error('Failed to refresh friends', error);
    }
  }, [fetchWithAuth, token]);

  const refreshLobbies = useCallback(async () => {
    if (!token) {
      setAvailableLobbies([]);
      return;
    }
    try {
      const data = await fetchWithAuth('/lobbies', { method: 'GET' });
      setAvailableLobbies(data.data || []);
    } catch (error) {
      console.error('Failed to refresh lobbies', error);
    }
  }, [fetchWithAuth, token]);

  const connectSocket = useCallback(() => {
    if (!token) {
      return;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('friend:list', (response: any) => {
        if (response?.success && response.data) {
          setFriends(response.data);
        }
      });
      refreshLobbies();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      reconnectTimer.current = setTimeout(() => {
        if (token) {
          connectSocket();
        }
      }, 2000);
    });

    socket.on('friend:update', (payload: FriendSnapshot) => {
      setFriends(payload || defaultSnapshot);
      refreshLobbies();
    });

    socket.on('lobby:update', (payload: LobbyState) => {
      setLobby(payload);
      refreshLobbies();
    });

    socket.on('lobby:closed', () => {
      setLobby(null);
      refreshLobbies();
    });

    socket.on('lobby:message', ({ lobbyId: incomingLobbyId, message }: { lobbyId: string; message: LobbyMessage }) => {
      setLobby(prev => {
        if (!prev || prev.id !== incomingLobbyId) {
          return prev;
        }
        return {
          ...prev,
          messages: (prev.messages || []).concat(message),
        };
      });
    });
  }, [refreshLobbies, token]);

  useEffect(() => {
    if (token) {
      connectSocket();
      refreshFriends();
      refreshLobbies();
    } else {
      setFriends(defaultSnapshot);
      setLobby(null);
      setAvailableLobbies([]);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    }
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
    };
  }, [connectSocket, refreshFriends, refreshLobbies, token]);

  const emitWithAck = useCallback(async <T,>(event: string, payload: any): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket not connected'));
        return;
      }
      socketRef.current.emit(event, payload, (response: any) => {
        if (response?.success) {
          resolve(response as T);
        } else {
          reject(new Error(response?.message || 'Operation failed'));
        }
      });
    });
  }, []);

  const createLobby = useCallback(async (options?: { maxPlayers?: number }) => {
    await emitWithAck('lobby:create', { maxPlayers: options?.maxPlayers });
    await refreshLobbies();
  }, [emitWithAck, refreshLobbies]);

  const joinLobby = useCallback(async (lobbyId: string) => {
    await emitWithAck('lobby:join', { lobbyId });
    await refreshLobbies();
  }, [emitWithAck, refreshLobbies]);

  const leaveLobby = useCallback(async (lobbyId: string) => {
    await emitWithAck('lobby:leave', { lobbyId });
    setLobby(null);
    await refreshLobbies();
  }, [emitWithAck, refreshLobbies]);

  const startLobby = useCallback(async (lobbyId: string) => {
    await emitWithAck('lobby:start', { lobbyId });
  }, [emitWithAck]);

  const sendLobbyMessage = useCallback(async (content: string, kind: 'chat' | 'guess') => {
    if (!lobby) {
      throw new Error('No active lobby');
    }
    await emitWithAck('lobby:message', { lobbyId: lobby.id, content, kind });
  }, [emitWithAck, lobby]);

  const sendFriendRequest = useCallback(async (targetUserId: string) => {
    const response = await fetchWithAuth('/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
    await refreshFriends();
    return response;
  }, [fetchWithAuth, refreshFriends]);

  const acceptFriendRequest = useCallback(async (friendshipId: string) => {
    await fetchWithAuth(`/friends/requests/${friendshipId}/accept`, {
      method: 'POST',
    });
    await refreshFriends();
  }, [fetchWithAuth, refreshFriends]);

  const removeFriend = useCallback(async (friendshipId: string) => {
    await fetchWithAuth(`/friends/${friendshipId}`, {
      method: 'DELETE',
    });
    await refreshFriends();
  }, [fetchWithAuth, refreshFriends]);

  const value = useMemo<FriendLobbyContextValue>(() => ({
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
  }), [
    acceptFriendRequest,
    createLobby,
    friends,
    availableLobbies,
    isConnected,
    joinLobby,
    leaveLobby,
    lobby,
    refreshFriends,
    refreshLobbies,
    removeFriend,
    startLobby,
    sendLobbyMessage,
    sendFriendRequest,
  ]);

  return (
    <FriendLobbyContext.Provider value={value}>
      {children}
    </FriendLobbyContext.Provider>
  );
};

export const useFriendLobby = () => {
  const context = useContext(FriendLobbyContext);
  if (!context) {
    throw new Error('useFriendLobby must be used within a FriendLobbyProvider');
  }
  return context;
};
