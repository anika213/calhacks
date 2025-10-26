export type ConnectionRole = 'user' | 'host' | 'system';

export interface ConnectionMessage {
  id: string;
  role: ConnectionRole;
  content: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export type ConnectionRoundStatus = 'pending' | 'active' | 'completed' | 'failed';

export interface ConnectionAttempt {
  id: string;
  message: string;
  isCorrect: boolean;
  createdAt: number;
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
