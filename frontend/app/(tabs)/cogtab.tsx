import React, { useState, useEffect } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { Image } from 'react-native';


interface StroopTrial {
  word: string;
  color: string;
  correctAnswer: string;
}

interface StroopGameData {
  gameType: string;
  subType: string;
  metadata: {
    trials: StroopTrial[];
  };
}

interface ListRecallData {
  gameType: string;
  subType: string;
  metadata: {
    trials: string[][];
  };
}

type GameData = StroopGameData | ListRecallData;

// Type guard functions
function isStroopGameData(data: GameData): data is StroopGameData {
  return data.subType === 'Stroop';
}

function isListRecallData(data: GameData): data is ListRecallData {
  return data.subType === 'ListRecall';
}

export default function CognitiveGameTab() {
  const { user, token } = useAuth();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [gameSubType, setGameSubType] = useState<string>('');
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // List Recall state
  const [showWord, setShowWord] = useState(true);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [displayingWords, setDisplayingWords] = useState(false);
  const [recallOrder, setRecallOrder] = useState<string[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  // Check if user has visual impairment
  const isVisuallyImpaired = (user as any)?.isVisuallyImpaired || false;

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
      
      if (result.success && result.data) {
        setGameData(result.data);
        setGameSubType(result.data.subType);
      } else {
        Alert.alert('Error', 'Unable to load game data');
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
    if (!gameData || !isStroopGameData(gameData)) return;

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

    const trialLength = isStroopGameData(gameData) ? gameData.metadata.trials.length : 
                        isListRecallData(gameData) ? gameData.metadata.trials.length : 1;
    const correctCount = finalCorrectAnswers !== undefined ? finalCorrectAnswers : correctAnswers;
    const accuracy = Math.round((correctCount / trialLength) * 100);
    
    console.log('Game completion:', {
      correctCount,
      totalTrials: trialLength,
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
      `You scored ${accuracy}%!\nCorrect answers: ${correctCount}/${trialLength}`,
      [
        { text: 'Play Again', onPress: () => startGame() },
        { text: 'Done', onPress: () => setGameStarted(false) }
      ]
    );
  };

  // List Recall Game Logic
  const startListRecallGame = () => {
    if (!gameData || !isListRecallData(gameData)) return;
    setGameStarted(true);
    setDisplayingWords(true);
    setCurrentWordIndex(0);
    setRecallOrder([]);
    setSelectedWord(null);
  };

  useEffect(() => {
    if (!gameStarted || !displayingWords || gameSubType !== 'ListRecall' || !gameData || !isListRecallData(gameData)) return;
    
    const currentList = gameData.metadata.trials[currentTrialIndex];
    
    if (currentWordIndex < currentList.length) {
      // Show word for 5 seconds
      setShowWord(true);
      const timer1 = setTimeout(() => {
        setShowWord(false);
      }, 3000);

      // Hide for 5 seconds, then show next word
      const timer2 = setTimeout(() => {
        if (currentWordIndex < currentList.length - 1) {
          setCurrentWordIndex(prev => prev + 1);
        } else {
          // All words shown, start recall phase
          setDisplayingWords(false);
          // Shuffle the words for recall
          const shuffled = [...currentList].sort(() => Math.random() - 0.5);
          setRecallOrder(shuffled);
        }
      }, 5000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [currentWordIndex, displayingWords, gameStarted, gameSubType]);

  const handleWordSelect = (word: string) => {
    if (!gameData || !isListRecallData(gameData)) return;
    const currentList = gameData.metadata.trials[currentTrialIndex];
    
    console.log('handleWordSelect called:', word, 'Current selected:', selectedWord);
    console.log('Current recallOrder:', recallOrder);
    
    if (selectedWord === null) {
      console.log('Selecting word:', word);
      setSelectedWord(word);
    } else if (selectedWord === word) {
      console.log('Deselecting word:', word);
      setSelectedWord(null);
    } else {
      // Swap words
      const newOrder = [...recallOrder];
      const word1Index = newOrder.indexOf(selectedWord);
      const word2Index = newOrder.indexOf(word);
      console.log('Swapping:', selectedWord, 'at index', word1Index, 'with', word, 'at index', word2Index);
      if (word1Index !== -1 && word2Index !== -1) {
        [newOrder[word1Index], newOrder[word2Index]] = [newOrder[word2Index], newOrder[word1Index]];
        setRecallOrder(newOrder);
        console.log('New order:', newOrder);
      }
      setSelectedWord(null);
    }
  };

  const submitListRecall = () => {
    if (!gameData || !isListRecallData(gameData)) return;
    
    const currentList = gameData.metadata.trials[currentTrialIndex];
    const correctOrder = currentList;
    let correct = 0;
    
    for (let i = 0; i < recallOrder.length; i++) {
      if (recallOrder[i] === correctOrder[i]) {
        correct++;
      }
    }
    
    const accuracy = Math.round((correct / correctOrder.length) * 100);
    
    // Move to next trial
    if (currentTrialIndex < gameData.metadata.trials.length - 1) {
      setCurrentTrialIndex(prev => prev + 1);
      setDisplayingWords(true);
      setCurrentWordIndex(0);
      setRecallOrder([]);
      setSelectedWord(null);
    } else {
      // Game complete
      completeGame(accuracy);
    }
  };

  const renderListRecallGame = () => {
    if (!gameData || !isListRecallData(gameData)) return null;
    
    const currentList = gameData.metadata.trials[currentTrialIndex];
    
    if (displayingWords) {
      return (
        <View style={styles.gameContainer}>
          {/* Word Display Phase */}
          <View style={styles.wordContainer}>
            {showWord && currentWordIndex < currentList.length && (
              <Text style={[
                styles.wordText,
                { 
                  fontSize: isVisuallyImpaired ? 48 : 32,
                  fontWeight: isVisuallyImpaired ? 'bold' : '700'
                }
              ]}>
                {currentList[currentWordIndex]}
              </Text>
            )}
          </View>
        </View>
      );
    }
    
    // Recall Phase
    return (
      <View style={styles.gameContainer}>
        <Text style={styles.instructionsTitle}>Rearrange the words in the correct order:</Text>
        
        <View style={styles.recallContainer}>
          {recallOrder.map((word, index) => (
            <TouchableOpacity
              key={`tile-${index}`}
              style={[
                styles.wordTile,
                selectedWord === word && styles.wordTileSelected,
                isVisuallyImpaired && styles.wordTileAccessible
              ]}
              onPress={() => handleWordSelect(word)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.wordTileText,
                isVisuallyImpaired && styles.wordTileTextAccessible
              ]}>
                {word}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {selectedWord && (
          <Text style={styles.selectionHint}>
            Tap another tile to swap with "{selectedWord}"
          </Text>
        )}
        
        <TouchableOpacity 
          style={styles.submitButton}
          onPress={submitListRecall}
        >
          <Text style={styles.submitButtonText}>Submit</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderStroopGame = () => {
    if (!gameData || !isStroopGameData(gameData)) return null;

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
            {isVisuallyImpaired 
              ? "Listen to the word and select the COLOR it represents, not what the word says."
              : "Look at the word below and select the COLOR it's displayed in, not what the word says."
            }
          </Text>
        </View>

        {/* Word Display */}
        <View style={styles.wordContainer}>
          <Text 
            style={[
              styles.wordText,
              { 
                color: getColorValue(currentTrial.color),
                fontSize: isVisuallyImpaired ? 36 : 28,
                fontWeight: isVisuallyImpaired ? 'bold' : '600'
              }
            ]}
          >
            {currentTrial.word}
          </Text>
          {isVisuallyImpaired && (
            <Text style={styles.accessibilityHint}>
              The word "{currentTrial.word}" is displayed in {currentTrial.color} color
            </Text>
          )}
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
          <View style={[
            styles.optionsGrid,
            isVisuallyImpaired && styles.optionsGridAccessible
          ]}>
            {Object.entries({
              red: '#E57373',
              blue: '#81C7F4', 
              green: '#A5D6A7',
              orange: '#FFB74D'
            }).map(([colorName, colorValue]) => (
              <TouchableOpacity
                key={colorName}
                style={[
                  styles.optionButton, 
                  { backgroundColor: colorValue },
                  isVisuallyImpaired && styles.optionButtonAccessible
                ]}
                onPress={() => handleAnswer(colorName)}
              >
                <Text style={[
                  styles.optionText,
                  isVisuallyImpaired && styles.optionTextAccessible
                ]}>
                  {colorName.toUpperCase()}
                </Text>
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

    const gameTitle = gameSubType === 'ListRecall' ? 'List Recall Test' : 'Stroop Test';
    const gameDescription = gameSubType === 'ListRecall' 
      ? 'Memorize a list of words and recall them in the correct order.'
      : 'Test your cognitive control by identifying the color of text while ignoring what the word says.';
    
    const trialCount = gameData ? (
      isListRecallData(gameData) ? gameData.metadata.trials.length :
      isStroopGameData(gameData) ? gameData.metadata.trials.length : 0
    ) : 0;

  return (
    <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {!gameStarted ? (
            <View style={styles.startContainer}>
              <IconSymbol name="brain.head.profile" size={80} color="#6B8E6B" />
              <Text style={styles.gameTitle}>{gameTitle}</Text>
              <Text style={styles.gameDescription}>
                {gameDescription}
              </Text>
              {gameSubType === 'ListRecall' && (
                <Text style={styles.gameInstructions}>
                  • Words will appear one at a time{'\n'}
                  • Memorize the order of the words{'\n'}
                  • Rearrange the words in the correct order{'\n'}
                  • Complete all {trialCount} trials
                </Text>
              )}
              {gameSubType === 'Stroop' && (
                <Text style={styles.gameInstructions}>
                  • Look at each word carefully{'\n'}
                  • Select the COLOR the text appears in{'\n'}
                  • Ignore what the word actually says{'\n'}
                  • Complete all {trialCount} trials
                </Text>
              )}
              <TouchableOpacity 
                style={styles.startButton} 
                onPress={gameSubType === 'ListRecall' ? startListRecallGame : startGame}
              >
                <Text style={styles.startButtonText}>Start Test</Text>
              </TouchableOpacity>
            </View>
          ) : (
            gameSubType === 'ListRecall' ? renderListRecallGame() : renderStroopGame()
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
    padding: 20,
  },
  gameTitle: {
    fontSize: 34,
    fontFamily: 'System',
    fontWeight: '700',
    color: '#3A4A3A',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  gameDescription: {
    fontSize: 17,
    fontFamily: 'System',
    color: '#6B7B6B',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
    fontWeight: '400',
    paddingHorizontal: 20,
  },
  gameInstructions: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#5A6B5A',
    textAlign: 'left',
    lineHeight: 26,
    marginBottom: 32,
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#F8FAF8',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
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
  // Accessibility styles
  accessibilityHint: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  optionsGridAccessible: {
    gap: 16,
  },
  optionButtonAccessible: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    minHeight: 60,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  optionTextAccessible: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  recallContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',          // force single line layout
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'scroll',          // allow horizontal scrolling if too wide
    marginVertical: 20,
    paddingHorizontal: 10,
  },
  wordTile: {
    backgroundColor: '#6B8E6B',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    flexShrink: 0,              // prevents tiles from shrinking or wrapping
    minWidth: 80,
  },
  
  wordTileSelected: {
    backgroundColor: '#8EBB8E',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
  },
  wordTileAccessible: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    minWidth: 120,
    minHeight: 60,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  wordTileText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '600',
    textAlign: 'center',
  },
  wordTileTextAccessible: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#6B8E6B',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    alignSelf: 'center',
    marginTop: 20,
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '600',
  },
  selectionHint: {
    fontSize: 14,
    fontFamily: 'System',
    color: '#6B8E6B',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});