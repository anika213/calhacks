import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.30.58:8000/api';

interface GameFrameworkProps {
  title: string;
  description: string;
  color?: string;
  questions?: any[];
  simulate?: boolean;
  onComplete?: (score: number) => void;
  gameType?: 'cognitive' | 'mental_health';
}

export default function GameFramework({
  title,
  description,
  color = '#6B8E6B',
  questions = [],
  simulate = true,
  onComplete,
  gameType = 'cognitive'
}: GameFrameworkProps) {
  const { user, token } = useAuth();
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const storeGameScore = async (finalScore: number) => {
    alert('Storing game score:' + finalScore);
    console.log('Storing game score:', finalScore);
    if (!user || !token) {
      console.log('User not authenticated, skipping score storage');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/games/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          gameName: title,
          accuracy: finalScore,
          gameType: gameType
        }),
      });

      if (response.ok) {
        console.log('Game score stored successfully');
      } else {
        console.error('Failed to store game score');
      }
    } catch (error) {
      console.error('Error storing game score:', error);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setTimeout>;
    if (simulate && isPlaying) {
      interval = setInterval(() => {
        setScore(prev => {
          const newScore = prev + Math.floor(Math.random() * 10) + 5;
          if (newScore >= 100) {
            clearInterval(interval);
            setIsPlaying(false);
            // Store the score in the database
            storeGameScore(newScore);
            Alert.alert('Game Complete!', `You scored ${newScore}!`, [
              { text: 'OK', onPress: () => onComplete?.(newScore) }
            ]);
          }
          return Math.min(newScore, 100);
        });
      }, 800);
    }
    return () => clearInterval(interval);
  }, [simulate, isPlaying]);

  return (
    <View style={[styles.container, { borderColor: color }]}>
      <Text style={[styles.title, { color }]}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${score}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.scoreText}>Score: {score}</Text>

      {!isPlaying ? (
        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: color }]}
          onPress={() => setIsPlaying(true)}
        >
          <IconSymbol name="play.fill" size={20} color="#fff" />
          <Text style={styles.playText}>Start Game</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: '#FF6B6B' }]}
          onPress={() => setIsPlaying(false)}
        >
          <IconSymbol name="pause.fill" size={20} color="#fff" />
          <Text style={styles.playText}>Pause</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    borderWidth: 2,
    shadowColor: '#B8C5B8',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 18,
    color: '#7A8B7A',
    textAlign: 'center',
    marginBottom: 20,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#E8EDE8',
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 20,
  },
  progressFill: {
    height: '100%',
    borderRadius: 8,
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    color: '#5A6B5A',
  },
  playButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
  },
  playText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
  },
});
