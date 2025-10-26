export type ConnectionRole = 'user' | 'host' | 'system';
export type ConnectionMessageKind = 'chat' | 'guess' | 'system';

export interface ConnectionMessage {
  id: string;
  role: ConnectionRole;
  content: string;
  createdAt: number;
  authorId?: string;
  authorName?: string;
  kind?: ConnectionMessageKind;
  metadata?: Record<string, unknown>;
}

export type ConnectionRoundStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface ConnectionAttempt {
  id: string;
  message: string;
  isCorrect: boolean;
  createdAt: number;
  authorId?: string;
  elapsedMs?: number;
}

export interface ConnectionQuestion {
  id: string;
  prompt: string;
  answer: string;
  hints?: string[];
}

export interface ConnectionRound {
  roundIndex: number;
  question: ConnectionQuestion | null;
  attempts: ConnectionAttempt[];
  status: ConnectionRoundStatus;
  completedAt?: number;
  startedAt?: number;
  solvedAt?: number;
  solverId?: string;
  solveDurationMs?: number;
}

export type ConnectionSessionPhase = 'idle' | 'inProgress' | 'complete';

export interface ConnectionSessionRecord {
  id: string;
  hostName: string;
  createdAt: number;
  phase: ConnectionSessionPhase;
  rounds: ConnectionRound[];
  questions: ConnectionQuestion[];
  transcript: ConnectionMessage[];
  totalCorrect: number;
  totalRounds: number;
}

export interface ConnectionParticipant {
  id: string;
  displayName: string;
  accentColor?: string;
  avatarSeed?: string;
}
