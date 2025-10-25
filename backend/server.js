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
console.log(uri)
const client = new MongoClient(uri);
const database = client.db(process.env.DATABASE_NAME);
const usersCollection = database.collection("users");
const gamesCollection = database.collection("games");

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
       
    } catch (e) {
        console.error(e);
}
}
connection().catch(console.error);

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
