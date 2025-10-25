const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// const { RateLimiterMemory } = require('rate-limiter-flexible');
const { MongoClient, GridFSBucket, ObjectId } = require("mongodb");
require('dotenv').config();
const mongoose = require("mongoose");
const stream = require('stream');

const axios= require("axios");
const app = express();
const router = express.Router()


const uri = process.env.MONGO_URI
const client = new MongoClient(uri);
const database = client.db(process.env.DATABASE_NAME);
const usersCollection = database.collection("users");
const gamesCollection = database.collection("games");
const gameSessionsCollection = database.collection("gameSessions");
const userMetricsCollection = database.collection("userMetrics");

const VALID_GAME_KEYS = ['stroop', 'memory', 'naming'];
const BASELINE_WINDOW = 3;
const TREND_WINDOW = 3;
const GAME_WEIGHTS = {
  stroop: 0.4,
  memory: 0.4,
  naming: 0.2,
};

const TREND_UP_THRESHOLD = 0.05;
const TREND_DOWN_THRESHOLD = -0.05;

const bodyParser = require('body-parser');
app.use(cors({
    origin: '*',
  }));
  
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

async function connection(){
    try {
        // Connect to the mongo cluster
        await client.connect();
        console.log("connected to MONGOdb");

        await Promise.all([
            gameSessionsCollection.createIndex({ userId: 1, gameKey: 1, completedAt: -1 }),
            gameSessionsCollection.createIndex({ userId: 1, sessionNumber: 1 }),
            userMetricsCollection.createIndex({ userId: 1 }, { unique: true }),
        ]);
        console.log("ensured indexes for session analytics");
       
    } catch (e) {
        console.error(e);
}
}
connection().catch(console.error);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const percent = (part, total) => (total > 0 ? (part / total) * 100 : 0);
const median = values => {
  const filtered = Array.isArray(values) ? values.filter(v => Number.isFinite(v)) : [];
  if (!filtered.length) {
    return 0;
  }
  const sorted = [...filtered].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const average = values => {
  const filtered = Array.isArray(values) ? values.filter(v => Number.isFinite(v)) : [];
  if (!filtered.length) {
    return 0;
  }
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
};

const calculateTrendDirection = values => {
  if (!Array.isArray(values) || values.length < 2) {
    return 'flat';
  }
  const window = values.slice(-TREND_WINDOW);
  if (window.length < 2) {
    return 'flat';
  }
  const latest = window[window.length - 1];
  const previousAverage = average(window.slice(0, -1));
  if (!previousAverage) {
    return 'flat';
  }
  const delta = (latest - previousAverage) / previousAverage;
  if (delta >= TREND_UP_THRESHOLD) {
    return 'up';
  }
  if (delta <= TREND_DOWN_THRESHOLD) {
    return 'down';
  }
  return 'flat';
};

const deriveStroopBaseline = history => {
  if (!Array.isArray(history) || !history.length) {
    return null;
  }
  const window = history.slice(-BASELINE_WINDOW);
  return {
    accuracyPct: average(window.map(item => item.accuracyPct ?? 0)),
    medianRtMs: average(window.map(item => item.medianRtMs ?? 0)),
    medianRtCongruentMs: average(window.map(item => item.medianRtCongruentMs ?? 0)),
    medianRtIncongruentMs: average(window.map(item => item.medianRtIncongruentMs ?? 0)),
    sessionCount: window.length,
    status: window.length >= BASELINE_WINDOW ? 'ready' : 'building',
  };
};

const computeStroopMetrics = (trials = [], baseline = null) => {
  const totalTrials = trials.length;
  const correctTrials = trials.filter(trial => trial?.isCorrect).length;
  const responseTimes = trials.map(trial => Number(trial?.responseTimeMs)).filter(Number.isFinite);
  const congruentTimes = trials
    .filter(trial => trial?.isCongruent)
    .map(trial => Number(trial?.responseTimeMs))
    .filter(Number.isFinite);
  const incongruentTimes = trials
    .filter(trial => trial && trial.isCongruent === false)
    .map(trial => Number(trial?.responseTimeMs))
    .filter(Number.isFinite);

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

  const compositeScore = Number((0.6 * accuracyScore + 0.4 * speedScore).toFixed(2));

  const accuracyRatio = baselineAccuracy > 0 ? accuracyPct / baselineAccuracy : 1;
  const speedRatio = baselineMedianRt > 0 ? baselineMedianRt / (medianRtMs || baselineMedianRt) : 1;

  let trafficLight = 'yellow';
  if ((baseline?.status ?? 'building') === 'ready') {
    if (accuracyRatio >= 0.95 && speedRatio >= 0.95 && compositeScore >= 95) {
      trafficLight = 'green';
    } else if (accuracyRatio >= 0.8 && speedRatio >= 0.8) {
      trafficLight = 'yellow';
    } else {
      trafficLight = 'red';
    }
  }

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

const deriveMemoryBaseline = history => {
  if (!Array.isArray(history) || !history.length) {
    return null;
  }
  const window = history.slice(-BASELINE_WINDOW);
  const delayedValues = window.map(item => item.delayedRecallPct).filter(value => value !== null && Number.isFinite(value));
  const forgettingValues = window
    .map(item => item.forgettingRatePct)
    .filter(value => value !== null && Number.isFinite(value));
  return {
    immediatePct: average(window.map(item => item.immediateRecallPct ?? 0)),
    delayedPct: delayedValues.length ? average(delayedValues) : null,
    forgettingRatePct: forgettingValues.length ? average(forgettingValues) : null,
    sessionCount: window.length,
    status: window.length >= BASELINE_WINDOW ? 'ready' : 'building',
  };
};

const countOrderedMatches = (responses = [], prompts = []) => {
  if (!Array.isArray(responses) || !Array.isArray(prompts)) {
    return 0;
  }
  return responses.reduce((total, response, index) => {
    if (!prompts[index]) {
      return total;
    }
    if (typeof response !== 'string' || typeof prompts[index] !== 'string') {
      return total;
    }
    return response.trim().toLowerCase() === prompts[index].trim().toLowerCase() ? total + 1 : total;
  }, 0);
};

const computeMemoryMetrics = (attempts = [], listLength = 0, baseline = null) => {
  const immediateAttempt = attempts.find(attempt => attempt?.phase === 'immediate');
  const delayedAttempt = attempts.find(attempt => attempt?.phase === 'delayed');

  const immediateCorrect = countOrderedMatches(immediateAttempt?.responses, immediateAttempt?.correctPrompts ?? []);
  const delayedCorrect = delayedAttempt ? countOrderedMatches(delayedAttempt.responses, delayedAttempt.correctPrompts ?? []) : null;

  const immediateRecallPct = percent(immediateCorrect, listLength);
  const delayedRecallPct = delayedAttempt ? percent(delayedCorrect ?? 0, listLength) : null;
  const forgettingRatePct = delayedRecallPct !== null ? Math.max(0, immediateRecallPct - delayedRecallPct) : null;

  const baselineImmediate = baseline?.immediatePct ?? immediateRecallPct;
  const baselineDelayed = baseline?.delayedPct ?? (delayedRecallPct ?? immediateRecallPct);
  const baselineForget = baseline?.forgettingRatePct;

  const immediateScore = baselineImmediate > 0
    ? clamp((immediateRecallPct / baselineImmediate) * 100, 60, 130)
    : 100;
  const delayedScore = baselineDelayed > 0
    ? clamp(((delayedRecallPct ?? immediateRecallPct) / baselineDelayed) * 100, 60, 130)
    : 100;

  const memoryScore = Number(((0.5 * immediateScore) + (0.5 * delayedScore)).toFixed(2));

  const forgettingFlag = baseline?.status === 'ready'
    && baselineForget !== null
    && forgettingRatePct !== null
    && (forgettingRatePct - baselineForget) > 20;

  let trafficLight = 'yellow';
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

const deriveNamingBaseline = history => {
  if (!Array.isArray(history) || !history.length) {
    return null;
  }
  const window = history.slice(-BASELINE_WINDOW);
  return {
    accuracyPct: average(window.map(item => item.accuracyPct ?? 0)),
    medianRtMs: average(window.map(item => item.medianRtMs ?? 0)),
    sessionCount: window.length,
    status: window.length >= BASELINE_WINDOW ? 'ready' : 'building',
  };
};

const computeNamingMetrics = (trials = [], baseline = null) => {
  const correctCount = trials.filter(trial => trial?.isCorrect).length;
  const accuracyPct = percent(correctCount, trials.length);
  const responseTimes = trials.map(trial => Number(trial?.responseTimeMs)).filter(Number.isFinite);
  const medianRtMs = median(responseTimes);

  const baselineAccuracy = baseline?.accuracyPct ?? accuracyPct;
  const baselineMedianRt = baseline?.medianRtMs ?? medianRtMs;

  const accuracyScore = baselineAccuracy > 0
    ? clamp((accuracyPct / baselineAccuracy) * 100, 60, 130)
    : 100;
  const speedScore = baselineMedianRt > 0
    ? clamp((baselineMedianRt / (medianRtMs || baselineMedianRt)) * 100, 60, 130)
    : 100;

  const namingScore = Number((0.7 * accuracyScore + 0.3 * speedScore).toFixed(2));

  let trafficLight = 'yellow';
  if ((baseline?.status ?? 'building') === 'ready') {
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

const getCompositeMetricValue = (gameKey, metrics = {}) => {
  switch (gameKey) {
    case 'stroop':
      return metrics.compositeScore ?? 0;
    case 'memory':
      return metrics.memoryScore ?? 0;
    case 'naming':
      return metrics.namingScore ?? 0;
    default:
      return 0;
  }
};

const sanitizeContextInputs = context => {
  if (!context || typeof context !== 'object') {
    return null;
  }
  const sanitized = {
    moodLevel: Number.isFinite(context.moodLevel) ? Number(context.moodLevel) : null,
    sleepQuality: Number.isFinite(context.sleepQuality) ? Number(context.sleepQuality) : null,
    medsChanged: Boolean(context.medsChanged),
  };
  if (typeof context.notes === 'string' && context.notes.trim()) {
    sanitized.notes = context.notes.trim();
  }
  return sanitized;
};

const parseDate = value => {
  if (!value) {
    return new Date();
  }
  if (typeof value === 'number') {
    return new Date(value);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
};

const determineSessionPhase = sessionNumber => {
  if (sessionNumber <= 2) {
    return 'learning';
  }
  if (sessionNumber <= 5) {
    return 'baseline';
  }
  return 'production';
};

const normalizeAttempt = (attempt = {}, correctPrompts = []) => {
  const responses = Array.isArray(attempt.responses) ? attempt.responses.map(item => String(item)) : [];
  const normalized = {
    phase: attempt.phase === 'delayed' ? 'delayed' : 'immediate',
    responses,
    correctPrompts,
    responseTimeMs: Number.isFinite(attempt.responseTimeMs) ? Number(attempt.responseTimeMs) : null,
    startedAt: parseDate(attempt.startedAt),
    completedAt: parseDate(attempt.completedAt),
  };
  normalized.recalledCount = countOrderedMatches(responses, correctPrompts);
  return normalized;
};

const normalizeStroopTrial = trial => ({
  word: trial?.word ?? '',
  inkColor: trial?.inkColor ?? '',
  correctColor: trial?.correctColor ?? '',
  presentedAt: parseDate(trial?.presentedAt),
  respondedAt: parseDate(trial?.respondedAt),
  responseTimeMs: Number.isFinite(trial?.responseTimeMs) ? Number(trial.responseTimeMs) : null,
  selectedColor: trial?.selectedColor ?? '',
  isCorrect: Boolean(trial?.isCorrect),
  isCongruent: Boolean(trial?.isCongruent),
});

const normalizeNamingTrial = trial => ({
  promptId: trial?.promptId ?? '',
  promptLabel: trial?.promptLabel ?? '',
  displayedAt: parseDate(trial?.displayedAt),
  submittedAt: parseDate(trial?.submittedAt),
  responseTimeMs: Number.isFinite(trial?.responseTimeMs) ? Number(trial.responseTimeMs) : null,
  answerProvided: typeof trial?.answerProvided === 'string' ? trial.answerProvided : '',
  isCorrect: Boolean(trial?.isCorrect),
  usedHint: Boolean(trial?.usedHint),
});

const normalizeMemoryList = (list = []) => list.map(item => ({
  id: item?.id ?? item?.label ?? `item-${Math.random().toString(36).slice(2)}`,
  label: item?.label ?? String(item ?? ''),
}));

const buildHistorySeries = (sessions = [], gameKey) => {
  return sessions.map(session => ({
    completedAt: session.completedAt,
    score: getCompositeMetricValue(gameKey, session.metrics ?? {}),
    trafficLight: session.metrics?.trafficLight ?? 'yellow',
  })).reverse();
};

const computeMovingAverage = (values = []) => {
  if (!values.length) {
    return 0;
  }
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
};

const computeStreak = (sessions = []) => {
  let streak = 0;
  for (const session of sessions) {
    if (session.metrics?.trafficLight === 'green') {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
};

const serializePerGameMetrics = perGame => {
  const result = {};
  Object.entries(perGame || {}).forEach(([gameKey, value]) => {
    result[gameKey] = {
      ...value,
      latestSessionId: value?.latestSessionId ? value.latestSessionId.toString() : null,
    };
  });
  return result;
};

const rebuildUserMetrics = async userObjectId => {
  const perGame = {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const gameKey of VALID_GAME_KEYS) {
    const sessions = await gameSessionsCollection
      .find({ userId: userObjectId, gameKey })
      .sort({ completedAt: -1 })
      .limit(10)
      .toArray();

    if (!sessions.length) {
      continue;
    }

    const latest = sessions[0];
    const scoreSeries = sessions.map(session => getCompositeMetricValue(gameKey, session.metrics ?? {}));
    const movingAverage = computeMovingAverage(scoreSeries.slice(0, 7));
    const streakGreen = computeStreak(sessions);
    const latestScore = scoreSeries[0] ?? 0;

    weightedSum += latestScore * (GAME_WEIGHTS[gameKey] ?? 0);
    totalWeight += GAME_WEIGHTS[gameKey] ?? 0;

    perGame[gameKey] = {
      latestSessionId: latest._id,
      latestCompletedAt: latest.completedAt,
      latestScore,
      trafficLight: latest.metrics?.trafficLight ?? 'yellow',
      trend: latest.metrics?.trend ?? 'flat',
      movingAverage,
      streakGreen,
      history: buildHistorySeries(sessions.slice(0, 10), gameKey),
    };
  }

  const compositeIndex = totalWeight ? Number((weightedSum / totalWeight).toFixed(2)) : null;

  const trackerSessions = await gameSessionsCollection
    .find({ userId: userObjectId })
    .sort({ completedAt: -1 })
    .limit(25)
    .toArray();

  const compositeHistory = trackerSessions
    .map(session => ({
      gameKey: session.gameKey,
      completedAt: session.completedAt,
      score: getCompositeMetricValue(session.gameKey, session.metrics ?? {}),
    }))
    .reverse();

  const updateDoc = {
    userId: userObjectId,
    compositeIndex,
    perGame,
    compositeHistory,
    updatedAt: new Date(),
  };

  await userMetricsCollection.updateOne(
    { userId: userObjectId },
    { $set: updateDoc },
    { upsert: true },
  );

  return updateDoc;
};

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Authentication Routes
// Register new user

// Check if email already exists
app.get('/api/auth/check-email', async (req, res) => {
    try {
        console.log("in check email")
      const { email } = req.query;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
      }
  
      const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
  
      if (existingUser) {
        return res.status(200).json({ success: true, exists: true });
      } else {
        return res.status(200).json({ success: true, exists: false });
      }
    } catch (error) {
      console.error('Error checking email:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });
  
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, age, preferredLanguage } = req.body;

    // Validate required fields
    if (!email || !password || !name || !age) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: email, password, name, and age are required'
      });
    }

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user document
    const userProfile = {
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name.trim(),
      age: parseInt(age),
      preferredLanguage: preferredLanguage || 'English',
      accuracies: [], // Initialize empty accuracies array
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert user into database
    const result = await usersCollection.insertOne(userProfile);

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.insertedId, email: email.toLowerCase() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: result.insertedId,
        email: email.toLowerCase(),
        name: name.trim(),
        age: parseInt(age),
        preferredLanguage: preferredLanguage || 'English'
      }
    });

  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await usersCollection.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password, did you forget to create an account?'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        age: user.age,
        preferredLanguage: user.preferredLanguage
      }
    });

  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(req.user.userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    res.status(200).json({
      success: true,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// User Profile API Routes
app.post('/api/users/profile', async (req, res) => {
  try {
    const {
      name,
      age,
      preferredLanguage
    } = req.body;

    // Validate required fields
    if (!name || !age || !emergencyContact || !emergencyPhone) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, age, emergency contact, and emergency phone are required'
      });
    }

    // Create user profile document
    const userProfile = {
      name: name.trim(),
      age: parseInt(age),
      preferredLanguage: preferredLanguage || 'English',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert user profile into database
    const result = await usersCollection.insertOne(userProfile);

    res.status(201).json({
      success: true,
      message: 'User profile created successfully',
      userId: result.insertedId
    });

  } catch (error) {
    console.error('Error creating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user profile by ID
app.get('/api/users/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user profile
app.put('/api/users/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Add updated timestamp
    updateData.updatedAt = new Date();

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User profile updated successfully'
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all users (for admin purposes)
app.get('/api/users', async (req, res) => {
  try {
    const users = await usersCollection.find({}).toArray();
    
    res.status(200).json({
      success: true,
      data: users,
      count: users.length
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Game session analytics routes
app.post('/api/games/:gameKey/sessions', authenticateToken, async (req, res) => {
  const { gameKey } = req.params;
  if (!VALID_GAME_KEYS.includes(gameKey)) {
    return res.status(404).json({ success: false, message: 'Unsupported game key' });
  }

  let userObjectId;
  try {
    userObjectId = new ObjectId(req.user.userId);
  } catch (error) {
    console.error('Invalid user id when storing session', error);
    return res.status(400).json({ success: false, message: 'Invalid user identifier' });
  }

  const payload = req.body || {};

  try {
    const sessionCount = await gameSessionsCollection.countDocuments({ userId: userObjectId, gameKey });
    const priorSessions = await gameSessionsCollection
      .find({ userId: userObjectId, gameKey })
      .sort({ completedAt: -1 })
      .limit(10)
      .toArray();

    const priorMetricsChronological = [...priorSessions]
      .reverse()
      .map(session => session.metrics || {});

    const context = sanitizeContextInputs(payload.context);
    const startedAt = parseDate(payload.startedAt);
    const completedAt = parseDate(payload.completedAt);
    const sessionNumber = sessionCount + 1;
    const phase = determineSessionPhase(sessionNumber);

    let metrics;
    let baselineSnapshot = null;
    const extras = {};

    const previousCompositeValues = [...priorSessions]
      .reverse()
      .map(session => getCompositeMetricValue(gameKey, session.metrics || {}));

    if (gameKey === 'stroop') {
      if (!Array.isArray(payload.trials) || !payload.trials.length) {
        return res.status(400).json({ success: false, message: 'Stroop trials are required' });
      }
      const normalizedTrials = payload.trials.map(normalizeStroopTrial);
      const baseline = deriveStroopBaseline(priorMetricsChronological);
      metrics = computeStroopMetrics(normalizedTrials, baseline);
      const compositeSeries = previousCompositeValues.concat(metrics.compositeScore);
      metrics.trend = calculateTrendDirection(compositeSeries);
      baselineSnapshot = baseline;
      extras.trials = normalizedTrials;
      if (payload.settings && typeof payload.settings === 'object') {
        extras.settings = payload.settings;
      }
    } else if (gameKey === 'memory') {
      const list = normalizeMemoryList(payload.list);
      if (!list.length) {
        return res.status(400).json({ success: false, message: 'Memory word list is required' });
      }
      const correctPrompts = list.map(item => item.label);
      const attempts = Array.isArray(payload.attempts)
        ? payload.attempts.map(attempt => normalizeAttempt(attempt, correctPrompts))
        : [];
      if (!attempts.length) {
        return res.status(400).json({ success: false, message: 'Memory attempts are required' });
      }
      const baseline = deriveMemoryBaseline(priorMetricsChronological);
      metrics = computeMemoryMetrics(attempts, list.length, baseline);
      const compositeSeries = previousCompositeValues.concat(metrics.memoryScore);
      metrics.trend = calculateTrendDirection(compositeSeries);
      baselineSnapshot = baseline;
      extras.list = list;
      extras.attempts = attempts;
      extras.encodingDurationMs = Number.isFinite(payload.encodingDurationMs)
        ? Number(payload.encodingDurationMs)
        : null;
    } else if (gameKey === 'naming') {
      if (!Array.isArray(payload.trials) || !payload.trials.length) {
        return res.status(400).json({ success: false, message: 'Naming trials are required' });
      }
      const normalizedTrials = payload.trials.map(normalizeNamingTrial);
      const baseline = deriveNamingBaseline(priorMetricsChronological);
      metrics = computeNamingMetrics(normalizedTrials, baseline);
      const compositeSeries = previousCompositeValues.concat(metrics.namingScore);
      metrics.trend = calculateTrendDirection(compositeSeries);
      baselineSnapshot = baseline;
      extras.trials = normalizedTrials;
      if (payload.settings && typeof payload.settings === 'object') {
        extras.settings = payload.settings;
      }
    }

    const sessionDoc = {
      userId: userObjectId,
      gameKey,
      sessionNumber,
      phase,
      context,
      startedAt,
      completedAt,
      metrics,
      baselineSnapshot,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...extras,
    };

    Object.keys(sessionDoc).forEach(key => {
      if (sessionDoc[key] === undefined) {
        delete sessionDoc[key];
      }
    });

    const insertResult = await gameSessionsCollection.insertOne(sessionDoc);
    sessionDoc._id = insertResult.insertedId;

    const rollup = await rebuildUserMetrics(userObjectId);
    const perGameResponse = serializePerGameMetrics(rollup.perGame);

    const responseSession = {
      id: sessionDoc._id,
      gameKey: sessionDoc.gameKey,
      sessionNumber: sessionDoc.sessionNumber,
      phase: sessionDoc.phase,
      startedAt: sessionDoc.startedAt,
      completedAt: sessionDoc.completedAt,
      context: sessionDoc.context ?? null,
      metrics: sessionDoc.metrics,
      baselineSnapshot: sessionDoc.baselineSnapshot,
    };

    if (sessionDoc.list) {
      responseSession.list = sessionDoc.list;
    }
    if (sessionDoc.attempts) {
      responseSession.attempts = sessionDoc.attempts;
    }
    if (sessionDoc.trials) {
      responseSession.trials = sessionDoc.trials;
    }
    if (sessionDoc.settings) {
      responseSession.settings = sessionDoc.settings;
    }
    if (sessionDoc.encodingDurationMs !== undefined) {
      responseSession.encodingDurationMs = sessionDoc.encodingDurationMs;
    }

    return res.status(201).json({
      success: true,
      data: {
        session: {
          ...responseSession,
          id: responseSession.id.toString(),
        },
        userMetrics: {
          compositeIndex: rollup.compositeIndex,
          perGame: perGameResponse,
          updatedAt: rollup.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Error storing game session', error);
    return res.status(500).json({ success: false, message: 'Failed to store game session' });
  }
});

app.get('/api/games/:gameKey/sessions', authenticateToken, async (req, res) => {
  const { gameKey } = req.params;
  if (!VALID_GAME_KEYS.includes(gameKey)) {
    return res.status(404).json({ success: false, message: 'Unsupported game key' });
  }

  let userObjectId;
  try {
    userObjectId = new ObjectId(req.user.userId);
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Invalid user identifier' });
  }

  const limitParam = parseInt(req.query.limit, 10);
  const limit = Number.isNaN(limitParam) ? 20 : Math.min(Math.max(limitParam, 1), 100);

  try {
    const sessions = await gameSessionsCollection
      .find({ userId: userObjectId, gameKey })
      .sort({ completedAt: -1 })
      .limit(limit)
      .toArray();

    const data = sessions.map(session => ({
      id: session._id.toString(),
      gameKey: session.gameKey,
      sessionNumber: session.sessionNumber,
      phase: session.phase,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      context: session.context ?? null,
      metrics: session.metrics,
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching game sessions', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
});

app.get('/api/games/:gameKey/metrics/latest', authenticateToken, async (req, res) => {
  const { gameKey } = req.params;
  if (!VALID_GAME_KEYS.includes(gameKey)) {
    return res.status(404).json({ success: false, message: 'Unsupported game key' });
  }

  let userObjectId;
  try {
    userObjectId = new ObjectId(req.user.userId);
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Invalid user identifier' });
  }

  try {
    const latestSession = await gameSessionsCollection
      .find({ userId: userObjectId, gameKey })
      .sort({ completedAt: -1 })
      .limit(1)
      .next();

    if (!latestSession) {
      return res.status(404).json({ success: false, message: 'No sessions found for this game' });
    }

    return res.status(200).json({
      success: true,
      data: {
        sessionNumber: latestSession.sessionNumber,
        completedAt: latestSession.completedAt,
        metrics: latestSession.metrics,
        baselineSnapshot: latestSession.baselineSnapshot ?? null,
      },
    });
  } catch (error) {
    console.error('Error fetching latest metrics', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch latest metrics' });
  }
});

app.get('/api/cognitive-index', authenticateToken, async (req, res) => {
  let userObjectId;
  try {
    userObjectId = new ObjectId(req.user.userId);
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Invalid user identifier' });
  }

  try {
    let metricsDoc = await userMetricsCollection.findOne({ userId: userObjectId });
    if (!metricsDoc) {
      metricsDoc = await rebuildUserMetrics(userObjectId);
    }

    const perGameResponse = serializePerGameMetrics(metricsDoc.perGame);

    return res.status(200).json({
      success: true,
      data: {
        compositeIndex: metricsDoc.compositeIndex,
        perGame: perGameResponse,
        updatedAt: metricsDoc.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching cognitive index', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch cognitive index' });
  }
});

app.get('/api/users/me/metrics/tracker', authenticateToken, async (req, res) => {
  let userObjectId;
  try {
    userObjectId = new ObjectId(req.user.userId);
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Invalid user identifier' });
  }

  try {
    let metricsDoc = await userMetricsCollection.findOne({ userId: userObjectId });
    if (!metricsDoc) {
      metricsDoc = await rebuildUserMetrics(userObjectId);
    }

    const contextSamples = await gameSessionsCollection
      .find({ userId: userObjectId, context: { $exists: true, $ne: null } })
      .sort({ completedAt: -1 })
      .limit(20)
      .toArray();

    const moodValues = [];
    const sleepValues = [];
    let medsChangedCount = 0;

    contextSamples.forEach(session => {
      const context = session.context || {};
      if (Number.isFinite(context.moodLevel)) {
        moodValues.push(Number(context.moodLevel));
      }
      if (Number.isFinite(context.sleepQuality)) {
        sleepValues.push(Number(context.sleepQuality));
      }
      if (context.medsChanged) {
        medsChangedCount += 1;
      }
    });

    const contextSampleSize = contextSamples.length;
    const contextSummary = {
      moodAverage: moodValues.length ? Number((moodValues.reduce((sum, value) => sum + value, 0) / moodValues.length).toFixed(2)) : null,
      sleepAverage: sleepValues.length ? Number((sleepValues.reduce((sum, value) => sum + value, 0) / sleepValues.length).toFixed(2)) : null,
      medsChangedRate: contextSampleSize
        ? Number(((medsChangedCount / contextSampleSize) * 100).toFixed(2))
        : null,
      sampleSize: contextSampleSize,
    };

    const perGameResponse = serializePerGameMetrics(metricsDoc.perGame);

    return res.status(200).json({
      success: true,
      data: {
        compositeIndex: metricsDoc.compositeIndex,
        compositeHistory: metricsDoc.compositeHistory ?? [],
        perGame: perGameResponse,
        contextSummary,
        updatedAt: metricsDoc.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching tracker metrics', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch tracker metrics' });
  }
});

// Legacy game score route
// Game Scores Routes
app.post('/api/games/score', authenticateToken, async (req, res) => {
  try {
    const { gameName, accuracy, gameType } = req.body;
    const userId = req.user.userId;
    console.log('Storing game score:', gameName, accuracy, gameType, userId);

    // Validate required fields
    if (!gameName || accuracy === undefined || !gameType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: gameName, accuracy, and gameType are required'
      });
    }

    // Create game score object to append to user's accuracies array
    const gameScore = {
      gameName: gameName,
      accuracy: accuracy,
      gameType: gameType, // 'cognitive' or 'mental_health'
      date: new Date()
    };

    // Append to user's accuracies array in users collection
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $push: { accuracies: gameScore },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Game score stored successfully',
      gameScore: gameScore
    });

  } catch (error) {
    console.error('Error storing game score:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Migration endpoint to add accuracies field to existing users
app.post('/api/users/migrate-accuracies', async (req, res) => {
  try {
    // Add accuracies field to all users who don't have it
    const result = await usersCollection.updateMany(
      { accuracies: { $exists: false } },
      { $set: { accuracies: [] } }
    );

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} users with accuracies field`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Error migrating accuracies field:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user's daily progress
app.get('/api/progress/daily', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's game scores from user's accuracies array
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    const todayScores = user?.accuracies?.filter(score => {
      const scoreDate = new Date(score.date);
      return scoreDate >= today && scoreDate < tomorrow;
    }) || [];

    // Get today's mental health check-ins
    const mentalHealthCollection = database.collection("mental_health_analyses");
    const todayMentalHealth = await mentalHealthCollection
      .find({ 
        userId: new ObjectId(userId),
        timestamp: { $gte: today, $lt: tomorrow }
      })
      .toArray();

    // Define available tasks
    const availableTasks = [
      { id: 'cognitive_game', name: 'Cognitive Function Game', type: 'cognitive' },
      { id: 'mental_health_check', name: 'Mental Health Check-in', type: 'mental_health' },
      { id: 'daily_checkin', name: 'Daily Check-in', type: 'general' }
    ];

    // Check which tasks are completed
    const completedTasks = [];
    const pendingTasks = [];

    availableTasks.forEach(task => {
      if (task.type === 'cognitive') {
        const hasCognitiveGame = todayScores.some(score => score.gameType === 'cognitive');
        if (hasCognitiveGame) {
          completedTasks.push(task);
        } else {
          pendingTasks.push(task);
        }
      } else if (task.type === 'mental_health') {
        const hasMentalHealthCheck = todayMentalHealth.length > 0;
        if (hasMentalHealthCheck) {
          completedTasks.push(task);
        } else {
          pendingTasks.push(task);
        }
      } else if (task.type === 'general') {
        // Daily check-in is considered completed if any game was played
        const hasAnyActivity = todayScores.length > 0 || todayMentalHealth.length > 0;
        if (hasAnyActivity) {
          completedTasks.push(task);
        } else {
          pendingTasks.push(task);
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        date: today.toISOString().split('T')[0],
        completedTasks,
        pendingTasks,
        gameScores: todayScores,
        mentalHealthChecks: todayMentalHealth.length
      }
    });

  } catch (error) {
    console.error('Error fetching daily progress:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

app.listen(8000, () => {
    console.log(`Server is running on port 8000.`);
  });
