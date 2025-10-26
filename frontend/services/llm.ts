import promptConfigJson from '@/constants/connectionPrompt.json';
import type { ConnectionMessage, ConnectionQuestion } from '@/types/connection';

export type ConnectionUserProfile = {
  id?: string;
  name?: string;
  age?: number;
  gender?: string;
  nationality?: string;
  preferredLanguage?: string;
};

type PromptConfig = {
  systemPrompt?: string;
  hostName?: string;
  questionTemplate?: string;
  evaluationTemplate?: string;
  fallbackQuestions?: Array<{
    prompt: string;
    answer: string;
    hints?: string[];
  }>;
};

type TriviaAPIMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type TriviaEvaluation = {
  isCorrect: boolean;
  reason?: string;
  hostResponse?: string;
  hint?: string;
};

const promptConfig = promptConfigJson as PromptConfig;

export const TRIVIA_API_URL = process.env.EXPO_PUBLIC_TRIVIA_API_URL || 'https://janitorai.com/hackathon/completions';
export const TRIVIA_API_KEY = process.env.EXPO_PUBLIC_TRIVIA_API_KEY || 'calhacks2047';

const DEFAULT_SYSTEM_PROMPT = promptConfig.systemPrompt?.trim() || 'You are a friendly trivia host.';
const DEFAULT_HOST_NAME = promptConfig.hostName?.trim() || 'Trivia Guide';
const DEFAULT_ROUND_COUNT = 3;

const DEFAULT_FALLBACK_QUESTIONS = (promptConfig.fallbackQuestions && promptConfig.fallbackQuestions.length > 0)
  ? promptConfig.fallbackQuestions
  : [
      {
        prompt: 'Round 1: I grow in rings but I am not a tree. You can eat me raw or cooked and many say I am fun. What am I?',
        answer: 'mushroom',
      },
      {
        prompt: 'Round 2: I have keys but open no locks, I have space but no rooms. You can enter but cannot go outside. What am I?',
        answer: 'keyboard',
      },
      {
        prompt: 'Round 3: I travel the world yet stay in a corner. What am I?',
        answer: 'stamp',
      },
    ];

const replacePlaceholders = (template: string, values: Record<string, string>): string => {
  let output = template;
  Object.entries(values).forEach(([key, value]) => {
    const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    output = output.replace(pattern, value);
  });
  return output;
};

const createHostMessage = (content: string): ConnectionMessage => ({
  id: `host-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  role: 'host',
  content,
  createdAt: Date.now(),
});

const sanitizeControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const tryParseJSON = <T>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const match = raw.match(/```(?:json)?\s*([\s\S]+?)```/i);
    if (match) {
      try {
        return JSON.parse(match[1]) as T;
      } catch (innerError) {
        console.error('Failed to parse fenced JSON from trivia response', innerError);
      }
    }
    console.error('Failed to parse trivia response as JSON', error);
    return null;
  }
};

const aggregateStreamContent = (raw: string): string => {
  if (!raw) {
    return raw;
  }

  const lines = raw.split(/\r?\n/)
    .filter(line => line.trim().length > 0);

  let aggregated = '';
  let lastJSONSnippet: any = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed.toLowerCase().startsWith('data:')) {
      return;
    }
    const payload = trimmed.slice(5).trimStart();
    if (!payload || payload === '[DONE]') {
      return;
    }
    try {
      const parsed = JSON.parse(payload);
      const choice = parsed?.choices?.[0];
      if (choice?.delta?.content) {
        aggregated += choice.delta.content;
        return;
      }
      if (choice?.message?.content) {
        aggregated += choice.message.content;
        return;
      }
      if (typeof choice?.content === 'string') {
        aggregated += choice.content;
        return;
      }
      if (typeof parsed?.message?.content === 'string') {
        aggregated += parsed.message.content;
        return;
      }
      if (typeof parsed?.content === 'string') {
        aggregated += parsed.content;
        return;
      }
      lastJSONSnippet = parsed;
    } catch (error) {
      aggregated += payload;
    }
  });

  if (aggregated.trim()) {
    return aggregated;
  }
  if (lastJSONSnippet) {
    try {
      return JSON.stringify(lastJSONSnippet);
    } catch (error) {
      // ignore
    }
  }
  return raw;
};

const extractTokensFromChunk = (chunk: string): string[] => {
  if (!chunk) {
    return [];
  }

  const lines = chunk.split(/\r?\n/).filter(line => line.trim().length > 0);
  const tokens: string[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed.toLowerCase().startsWith('data:')) {
      return;
    }
    const payload = trimmed.slice(5);
    if (!payload || payload === '[DONE]') {
      return;
    }
    try {
      const parsed = JSON.parse(payload);
      const choice = parsed?.choices?.[0];
      if (choice?.delta?.content !== undefined) {
        tokens.push(String(choice.delta.content));
        return;
      }
      if (choice?.message?.content !== undefined) {
        tokens.push(String(choice.message.content));
        return;
      }
      if (typeof choice?.content === 'string') {
        tokens.push(choice.content);
        return;
      }
      if (typeof parsed?.message?.content === 'string') {
        tokens.push(parsed.message.content);
        return;
      }
      if (typeof parsed?.content === 'string') {
        tokens.push(parsed.content);
        return;
      }
    } catch (error) {
      tokens.push(payload);
    }
  });

  return tokens;
};

const collectStreamedContent = async (response: Response, onToken?: (token: string) => void): Promise<string> => {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = await response.text();
    if (onToken) {
      extractTokensFromChunk(text).forEach(token => onToken(token));
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let aggregated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    aggregated += chunk;
    if (onToken) {
      extractTokensFromChunk(chunk).forEach(token => onToken(token));
    }
  }

  return aggregated;
};

const callTriviaAPI = async (messages: TriviaAPIMessage[], onToken?: (token: string) => void): Promise<string | null> => {
  try {
    const response = await fetch(TRIVIA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: TRIVIA_API_KEY,
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      console.error('Trivia API error', response.status, await response.text());
      return null;
    }

    const bodyText = await collectStreamedContent(response, onToken);
    const aggregated = aggregateStreamContent(bodyText);
    const cleaned = sanitizeControlCharacters(aggregated);

    try {
      const data = JSON.parse(cleaned);
      const contentFromChoices = data?.choices?.[0]?.message?.content;
      if (contentFromChoices) {
        return contentFromChoices as string;
      }
      if (data?.message?.content) {
        return data.message.content as string;
      }
      if (typeof data?.content === 'string') {
        return data.content;
      }
    } catch (parseError) {
      // fall back to raw text handling
    }

    return cleaned;
  } catch (error) {
    console.error('Trivia API call failed', error);
    return null;
  }
};

const buildUserProfileSummary = (profile?: ConnectionUserProfile): string => {
  if (!profile) {
    return 'No profile data provided';
  }

  const segments: string[] = [];

  if (profile.name) {
    segments.push(`name: ${profile.name}`);
  }
  if (typeof profile.age === 'number') {
    segments.push(`age: ${profile.age}`);
  }
  if (profile.gender) {
    segments.push(`gender: ${profile.gender}`);
  }
  if (profile.nationality) {
    segments.push(`nationality: ${profile.nationality}`);
  }
  if (profile.preferredLanguage) {
    segments.push(`preferredLanguage: ${profile.preferredLanguage}`);
  }

  return segments.length ? segments.join(', ') : 'No profile data provided';
};

const toConnectionQuestion = (item: { prompt: string; answer: string; hints?: string[] }, index: number): ConnectionQuestion => ({
  id: `question-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
  prompt: item.prompt,
  answer: item.answer,
  hints: item.hints,
});

const requestTriviaQuestions = async (
  profileSummary: string,
  count: number,
  onToken?: (token: string) => void,
): Promise<ConnectionQuestion[] | null> => {
  const template = promptConfig.questionTemplate
    || 'Create {{questionCount}} trivia questions for the player described here: {{userProfile}}';

  const userPrompt = replacePlaceholders(template, {
    userProfile: profileSummary,
    questionCount: String(count),
  });

  const content = await callTriviaAPI([
    { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ], onToken);

  if (!content) {
    return null;
  }

  const parsed = tryParseJSON<{ questions?: Array<{ prompt: string; answer: string; hints?: string[] }> }>(content);
  if (!parsed?.questions || !parsed.questions.length) {
    console.warn('Trivia API responded without valid questions; falling back to defaults');
    return null;
  }

  return parsed.questions.slice(0, count).map(toConnectionQuestion);
};

const requestTriviaEvaluation = async (
  question: ConnectionQuestion,
  attempt: string,
  onToken?: (token: string) => void,
): Promise<TriviaEvaluation | null> => {
  const template = promptConfig.evaluationTemplate
    || 'Question: {{question}} | Correct answer: {{answer}} | Player answer: {{attempt}}. Return JSON {"isCorrect": boolean, "reason": string}';

  const userPrompt = replacePlaceholders(template, {
    question: question.prompt,
    answer: question.answer,
    attempt,
  });

  const content = await callTriviaAPI([
    { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ], onToken);

  if (!content) {
    return null;
  }

  const cleaned = sanitizeControlCharacters(content);
  const hostMatch = cleaned.match(/HOST:\s*([\s\S]*?)(?:\n|$)/i);
  const metaMatch = cleaned.match(/META:\s*(\{[\s\S]*\})/i);

  let meta: TriviaEvaluation | null = null;
  if (metaMatch) {
    meta = tryParseJSON<TriviaEvaluation>(metaMatch[1]);
  }

  const hostResponse = hostMatch ? hostMatch[1].trim() : undefined;

  if (!meta) {
    return hostResponse
      ? { isCorrect: false, reason: 'Unable to parse evaluation', hostResponse }
      : null;
  }

  return {
    ...meta,
    hostResponse: hostResponse ?? meta.reason,
  };
};

const fallbackQuestions = (count: number): ConnectionQuestion[] =>
  DEFAULT_FALLBACK_QUESTIONS.slice(0, count).map(toConnectionQuestion);

const evaluateLocally = (question: ConnectionQuestion, attempt: string): TriviaEvaluation => {
  const isCorrect = question.answer.trim().toLowerCase() === attempt.trim().toLowerCase();
  const defaultHint = question.hints?.[0] || 'Try thinking about the broader context of the clue.';
  return {
    isCorrect,
    reason: isCorrect ? 'Exact text match' : 'Answer does not match',
    hostResponse: isCorrect
      ? 'Great job! You nailed it.'
      : `Not quite there yet. Hint: ${defaultHint}`,
    hint: isCorrect ? undefined : defaultHint,
  };
};

export interface StartSessionPayload {
  hostMessage: ConnectionMessage;
  questions: ConnectionQuestion[];
}

export const startConnectionSession = async (
  profile?: ConnectionUserProfile,
  roundCount: number = DEFAULT_ROUND_COUNT,
  onToken?: (token: string) => void,
): Promise<StartSessionPayload> => {
  const profileSummary = buildUserProfileSummary(profile);
  const count = Math.max(1, Math.min(roundCount, DEFAULT_FALLBACK_QUESTIONS.length || DEFAULT_ROUND_COUNT));
  const questions = await requestTriviaQuestions(profileSummary, count, onToken) ?? fallbackQuestions(count);

  const greeting = `Hello! I'm ${DEFAULT_HOST_NAME}. I picked ${questions.length} trivia questions just for you. Let's see how many you can ace!`;

  return {
    hostMessage: createHostMessage(greeting),
    questions,
  };
};

export interface AttemptResponse {
  hostMessage: ConnectionMessage;
  isCorrect: boolean;
  provideAnswer?: boolean;
  evaluationReason?: string;
}

export const submitConnectionAttempt = async (
  question: ConnectionQuestion,
  attempt: string,
  attemptsUsed: number,
  maxAttempts: number,
  onToken?: (token: string) => void,
): Promise<AttemptResponse> => {
  const evaluation = await requestTriviaEvaluation(question, attempt, onToken) ?? evaluateLocally(question, attempt);

  if (evaluation.isCorrect) {
    return {
      isCorrect: true,
      evaluationReason: evaluation.reason,
      hostMessage: createHostMessage(
        evaluation.hostResponse || "Correct! Let's jump to the next question.",
      ),
    };
  }

  const attemptsRemaining = maxAttempts - attemptsUsed - 1;

  if (attemptsRemaining <= 0) {
    return {
      isCorrect: false,
      provideAnswer: true,
      evaluationReason: evaluation.reason,
      hostMessage: createHostMessage(
        evaluation.hostResponse
          || `Close one! The correct answer was "${question.answer}". Let's move to the next challenge.`,
      ),
    };
  }

  const hint = evaluation.hint
    || question.hints?.[Math.min(attemptsUsed, (question.hints?.length || 1) - 1)]
    || `You have ${attemptsRemaining} attempt(s) left. Give it another shot!`;

  const responseText = evaluation.hostResponse ?? hint;

  return {
    isCorrect: false,
    evaluationReason: evaluation.reason,
    hostMessage: createHostMessage(responseText),
  };
};

export const connectionHostName = DEFAULT_HOST_NAME;
export const connectionDefaultRoundCount = DEFAULT_ROUND_COUNT;
