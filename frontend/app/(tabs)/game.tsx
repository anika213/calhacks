import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Alert,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function GameScreen() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [gameScore, setGameScore] = useState(0);

  const categories = [
    {
      id: 'cognitive',
      title: 'Cognitive Function',
      description: 'Memory, attention, and problem-solving exercises',
      icon: 'brain.head.profile' as any,
      color: '#6B8E6B',
      games: [
        {
          id: 'memory',
          title: 'Memory Match',
          description: 'Match pairs of cards to improve memory',
          icon: 'brain.head.profile' as any,
          color: '#6B8E6B',
          difficulty: 'Easy',
          duration: '5 min'
        },
        {
          id: 'puzzle',
          title: 'Cognitive Puzzle',
          description: 'Solve puzzles to boost problem-solving skills',
          icon: 'puzzlepiece.fill' as any,
          color: '#6B8E6B',
          difficulty: 'Hard',
          duration: '15 min'
        }
      ]
    },
    {
      id: 'mental',
      title: 'Mental Health',
      description: 'Mood, relaxation, and emotional well-being activities',
      icon: 'heart.fill' as any,
      color: '#8B6B8B',
      games: [
        {
          id: 'rhythm',
          title: 'Rhythm Therapy',
          description: 'Follow musical patterns to enhance coordination',
          icon: 'music.note' as any,
          color: '#8B6B8B',
          difficulty: 'Medium',
          duration: '10 min'
        },
        {
          id: 'word',
          title: 'Word Association',
          description: 'Connect words to improve language skills',
          icon: 'textformat.abc' as any,
          color: '#8B6B8B',
          difficulty: 'Medium',
          duration: '8 min'
        }
      ]
    }
  ];

  const handleStartGame = (gameId: string) => {
    setSelectedGame(gameId);
    setGameScore(0);
    const game = categories
      .flatMap(cat => cat.games)
      .find(g => g.id === gameId);
    
    Alert.alert(
      'Game Started!',
      `Starting ${game?.title}. Good luck!`,
      [
        { text: 'Cancel', onPress: () => setSelectedGame(null) },
        { text: 'Continue', onPress: () => simulateGame(gameId) }
      ]
    );
  };

  const simulateGame = (gameId: string) => {
    // Simulate game progress
    let score = 0;
    const interval = setInterval(() => {
      score += Math.floor(Math.random() * 10) + 5;
      setGameScore(score);
      
      if (score >= 100) {
        clearInterval(interval);
        Alert.alert(
          'Game Complete!',
          `Congratulations! You scored ${score} points!`,
          [{ text: 'OK', onPress: () => setSelectedGame(null) }]
        );
      }
    }, 1000);
  };

  const CategoryCard = ({ category }: { category: typeof categories[0] }) => {
    const handleCategoryPress = () => {
      if (category.id === 'cognitive') {
        router.push('/(tabs)/cogtab');
      } else if (category.id === 'mental') {
        router.push('/(tabs)/mhealth');
      }
    };

    return (
      <TouchableOpacity 
        style={styles.categoryCard}
        onPress={handleCategoryPress}
      >
        <View style={styles.categoryHeader}>
          <IconSymbol name={category.icon} size={36} color={category.color} />
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryTitle}>{category.title}</Text>
            <Text style={styles.categoryDescription}>{category.description}</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.categoryButton, { backgroundColor: category.color }]}
          onPress={handleCategoryPress}
        >
          <Text style={styles.categoryButtonText}>Start Activities</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const GameCard = ({ game }: { game: any }) => (
    <TouchableOpacity 
      style={[styles.gameCard, { borderLeftColor: game.color }]}
      onPress={() => handleStartGame(game.id)}
      disabled={selectedGame !== null}
    >
      <View style={styles.gameHeader}>
        <IconSymbol name={game.icon} size={32} color={game.color} />
        <View style={styles.gameInfo}>
          <Text style={styles.gameTitle}>{game.title}</Text>
          <Text style={styles.gameDescription}>{game.description}</Text>
        </View>
      </View>
      
      <View style={styles.gameMeta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Difficulty</Text>
          <Text style={[styles.metaValue, { color: game.color }]}>{game.difficulty}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Duration</Text>
          <Text style={styles.metaValue}>{game.duration}</Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={[styles.playButton, { backgroundColor: game.color }]}
        onPress={() => handleStartGame(game.id)}
      >
        <IconSymbol name="play.fill" size={16} color="#FFFFFF" />
        <Text style={styles.playButtonText}>Play</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Therapeutic Games</Text>
          <Text style={styles.subtitle}>Engage your mind with fun, therapeutic activities</Text>
        </View>

        {selectedGame && (
          <View style={styles.gameProgress}>
            <Text style={styles.progressTitle}>
              Playing: {categories
                .flatMap(cat => cat.games)
                .find((g: any) => g.id === selectedGame)?.title}
            </Text>
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreLabel}>Score</Text>
              <Text style={styles.scoreValue}>{gameScore}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(gameScore, 100)}%` }]} />
            </View>
          </View>
        )}

        <View style={styles.categoriesContainer}>
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFCF8', // Soft cream background
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A', // Muted sage green
    marginBottom: 12,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#7A8B7A', // Soft muted green
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  gameProgress: {
    marginHorizontal: 24,
    marginBottom: 30,
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
  progressTitle: {
    fontSize: 22,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreLabel: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#7A8B7A',
    marginBottom: 8,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  scoreValue: {
    fontSize: 40,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#6B8E6B', // Darker green for score
    letterSpacing: 0.3,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#E8EDE8',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6B8E6B', // Darker green for progress
    borderRadius: 6,
  },
  categoriesContainer: {
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  categoryCard: {
    backgroundColor: '#F8F9F8',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E8EDE8',
  },
  categoryHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryInfo: {
    alignItems: 'center',
    marginTop: 12,
  },
  categoryTitle: {
    fontSize: 20,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 6,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  categoryDescription: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  categoryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  categoryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '500',
    color: '#6B8E6B',
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  gamesContainer: {
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  gameCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderLeftWidth: 4,
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
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  gameInfo: {
    flex: 1,
    marginLeft: 20,
  },
  gameTitle: {
    fontSize: 22,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  gameDescription: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#7A8B7A',
    lineHeight: 26,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  gameMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    marginBottom: 6,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  metaValue: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    letterSpacing: 0.2,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'System',
    fontWeight: '600',
    marginLeft: 12,
    letterSpacing: 0.3,
  },
  statsContainer: {
    marginHorizontal: 24,
    marginBottom: 30,
  },
  statsTitle: {
    fontSize: 22,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
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
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  statLabel: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  tipsContainer: {
    marginHorizontal: 24,
    marginBottom: 30,
  },
  tipsTitle: {
    fontSize: 22,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E8EDE8',
  },
  tipText: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#5A6B5A',
    marginLeft: 16,
    flex: 1,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
});
