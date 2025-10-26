import React, { useState, useEffect } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';

interface Trial {
  word: string;
  color: string;
  correctAnswer: string;
}

interface GameData {
  gameType: string;
  subType: string;
  metadata: {
    trials: Trial[];
  };
}

export default function CognitiveGameTab() {
  const { user, token } = useAuth();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [loading, setLoading] = useState(false);

  const colorMap = {
    red: '#FF3B30',
    blue: '#007AFF',
    green: '#34C759',
    orange: '#FF9500',
    magenta: '#FF2D92',
    black: '#000000'
  };

  const getColorValue = (colorName: string): string => {
    const colorMap: { [key: string]: string } = {
      red: '#E57373',      // Pastel red
      blue: '#81C7F4',     // Pastel blue  
      green: '#A5D6A7',    // Pastel green
      orange: '#FFB74D',   // Pastel orange
      // Map other colors to these 4 options
      magenta: '#E57373',  // Map magenta to red
      black: '#81C7F4'     // Map black to blue
    };
    const color = colorMap[colorName.toLowerCase()] || '#E57373';
    console.log(`Color mapping: "${colorName}" → "${color}"`);
    return color;
  };

  const fetchGameData = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/random-game/Memory');
      const result = await response.json();
      
      if (result.success && result.data && result.data.subType === 'Stroop') {
        setGameData(result.data);
      } else {
        Alert.alert('Error', 'Unable to load Stroop test data');
      }
    } catch (error) {
      console.error('Error fetching game data:', error);
      Alert.alert('Error', 'Failed to load game data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameData();
  }, []);

  const startGame = () => {
    setGameStarted(true);
    setCurrentTrialIndex(0);
    setCorrectAnswers(0);
    setGameCompleted(false);
  };

  const handleAnswer = (selectedColor: string) => {
    if (!gameData) return;

    const currentTrial = gameData.metadata.trials[currentTrialIndex];
    const isCorrect = selectedColor === currentTrial.correctAnswer;
    
    // Update correct answers count
    const newCorrectAnswers = isCorrect ? correctAnswers + 1 : correctAnswers;

    // Move to next trial or complete game
    if (currentTrialIndex < gameData.metadata.trials.length - 1) {
      setCorrectAnswers(newCorrectAnswers);
      setCurrentTrialIndex(prev => prev + 1);
    } else {
      // For the last trial, pass the final count to completeGame
      completeGame(newCorrectAnswers);
    }
  };

  const completeGame = async (finalCorrectAnswers?: number) => {
    if (!gameData) return;

    const correctCount = finalCorrectAnswers !== undefined ? finalCorrectAnswers : correctAnswers;
    const accuracy = Math.round((correctCount / gameData.metadata.trials.length) * 100);
    
    console.log('Game completion:', {
      correctCount,
      totalTrials: gameData.metadata.trials.length,
      accuracy,
      finalCorrectAnswers,
      stateCorrectAnswers: correctAnswers
    });
    
    setGameCompleted(true);

    // Store the score
    if (user && token) {
      try {
        await fetch('http://localhost:8000/api/games/score', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            gameName: 'Stroop Test',
            accuracy: accuracy,
            gameType: 'cognitive'
          }),
        });
      } catch (error) {
        console.error('Error storing score:', error);
      }
    }

    Alert.alert(
      'Game Complete!',
      `You scored ${accuracy}%!\nCorrect answers: ${correctCount}/${gameData.metadata.trials.length}`,
      [
        { text: 'Play Again', onPress: () => startGame() },
        { text: 'Done', onPress: () => setGameStarted(false) }
      ]
    );
  };

  const renderGame = () => {
    if (!gameData) return null;

    const currentTrial = gameData.metadata.trials[currentTrialIndex];
    const progress = ((currentTrialIndex + 1) / gameData.metadata.trials.length) * 100;
    
    console.log('Current trial:', currentTrial);
    console.log('Color from DB:', currentTrial.color);
    console.log('ColorMap value:', getColorValue(currentTrial.color));

    return (
      <View style={styles.gameContainer}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Trial {currentTrialIndex + 1} of {gameData.metadata.trials.length}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Stroop Test</Text>
          <Text style={styles.instructionsText}>
            Look at the word below and select the COLOR it's displayed in, not what the word says.
          </Text>
        </View>

        {/* Word Display */}
        <View style={styles.wordContainer}>
          <Text 
            style={[
              styles.wordText,
              { color: getColorValue(currentTrial.color) }
            ]}
          >
            {currentTrial.word}
          </Text>
          {/* Debug info */}
          {/* <Text style={styles.debugText}>
            Debug: Color="{currentTrial.color}" → {getColorValue(currentTrial.color)}
          </Text> */}
          {/* Test colors */}
          {/* <View style={styles.testColorsContainer}>
            <Text style={[styles.testColorText, { color: '#E57373' }]}>RED</Text>
            <Text style={[styles.testColorText, { color: '#81C7F4' }]}>BLUE</Text>
            <Text style={[styles.testColorText, { color: '#A5D6A7' }]}>GREEN</Text>
            <Text style={[styles.testColorText, { color: '#FFB74D' }]}>ORANGE</Text>
          </View> */}
        </View>

        {/* Answer Options */}
        <View style={styles.optionsContainer}>
          <Text style={styles.optionsTitle}>What color is the text?</Text>
          <View style={styles.optionsGrid}>
            {Object.entries({
              red: '#E57373',
              blue: '#81C7F4', 
              green: '#A5D6A7',
              orange: '#FFB74D'
            }).map(([colorName, colorValue]) => (
              <TouchableOpacity
                key={colorName}
                style={[styles.optionButton, { backgroundColor: colorValue }]}
                onPress={() => handleAnswer(colorName)}
              >
                <Text style={styles.optionText}>{colorName.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <IconSymbol name="brain.head.profile" size={60} color="#6B8E6B" />
          <Text style={styles.loadingText}>Loading Stroop Test...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!gameData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <IconSymbol name="exclamationmark.triangle.fill" size={60} color="#FF6B6B" />
          <Text style={styles.errorText}>Unable to load game data</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchGameData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!gameStarted ? (
          <View style={styles.startContainer}>
            <IconSymbol name="brain.head.profile" size={80} color="#6B8E6B" />
            <Text style={styles.gameTitle}>Stroop Test</Text>
            <Text style={styles.gameDescription}>
              Test your cognitive control by identifying the color of text while ignoring what the word says.
            </Text>
            <Text style={styles.gameInstructions}>
              • Look at each word carefully{'\n'}
              • Select the COLOR the text appears in{'\n'}
              • Ignore what the word actually says{'\n'}
              • Complete all {gameData.metadata.trials.length} trials
            </Text>
            <TouchableOpacity style={styles.startButton} onPress={startGame}>
              <Text style={styles.startButtonText}>Start Test</Text>
            </TouchableOpacity>
          </View>
        ) : (
          renderGame()
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFCF8',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#7A8B7A',
    marginTop: 16,
    fontWeight: '400',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#FF6B6B',
    marginTop: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#6B8E6B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '600',
  },
  startContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameTitle: {
    fontSize: 32,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  gameDescription: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#7A8B7A',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 24,
    fontWeight: '400',
  },
  gameInstructions: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#5A6B5A',
    textAlign: 'left',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  startButton: {
    backgroundColor: '#6B8E6B',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'System',
    fontWeight: '600',
  },
  gameContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  progressContainer: {
    marginBottom: 40,
  },
  progressText: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '500',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E8EDE8',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6B8E6B',
    borderRadius: 4,
  },
  instructionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 40,
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E8EDE8',
  },
  instructionsTitle: {
    fontSize: 22,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 12,
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
  wordContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    marginBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E8EDE8',
  },
  wordText: {
    fontSize: 48,
    fontFamily: 'System',
    fontWeight: '700',
    textAlign: 'center',
  },
  debugText: {
    fontSize: 14,
    fontFamily: 'System',
    color: '#333',
    textAlign: 'center',
    marginTop: 10,
    backgroundColor: '#F0F0F0',
    padding: 8,
    borderRadius: 8,
  },
  testColorsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  testColorText: {
    fontSize: 12,
    fontFamily: 'System',
    fontWeight: '600',
  },
  optionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E8EDE8',
  },
  optionsTitle: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionButton: {
    width: '48%',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'System',
    fontWeight: '600',
  },
});