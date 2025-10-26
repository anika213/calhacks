import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  ScrollView,
  SafeAreaView
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

interface Question {
  id: number;
  statement: string;
}

interface QuestionResponse {
  questionId: number;
  statement: string;
  score: number;
}

const WHO5_QUESTIONS: Question[] = [
  {
    id: 1,
    statement: "I have felt cheerful and in good spirits"
  },
  {
    id: 2,
    statement: "I have felt calm and relaxed"
  },
  {
    id: 3,
    statement: "I have felt active and vigorous"
  },
  {
    id: 4,
    statement: "I woke up feeling fresh and rested"
  },
  {
    id: 5,
    statement: "My daily life has been filled with things that interest me"
  }
];

const SCALE_OPTIONS = [
  { label: "All of the time", value: 5 },
  { label: "Most of the time", value: 4 },
  { label: "More than half of the time", value: 3 },
  { label: "Less than half of the time", value: 2 },
  { label: "Some of the time", value: 1 },
  { label: "At no time", value: 0 }
];

export default function MentalHealthScreen() {
  const { user, token } = useAuth();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<QuestionResponse[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const currentQuestion = WHO5_QUESTIONS[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === WHO5_QUESTIONS.length - 1;

  const handleAnswer = (score: number) => {
    const response: QuestionResponse = {
      questionId: currentQuestion.id,
      statement: currentQuestion.statement,
      score: score
    };

    const newResponses = [...responses, response];
    setResponses(newResponses);

    console.log('Answer clicked:', {
      currentQuestionIndex,
      isLastQuestion,
      totalQuestions: WHO5_QUESTIONS.length,
      score,
      response
    });

    if (isLastQuestion) {
      console.log('Last question - completing assessment');
      completeAssessment(newResponses);
    } else {
      console.log('Moving to next question');
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const completeAssessment = async (finalResponses: QuestionResponse[]) => {
    console.log('completeAssessment called with:', finalResponses);
    setIsLoading(true);
    
    try {
      // Check if user is authenticated
       if (!user || !token) { 
        Alert.alert('Authentication Required', 'Please log in to save your assessment results.');
        console.log("User is not authenticated");
        setIsLoading(false);
        return;
      }
      console.log("User is authenticated");
      // Calculate raw score (0-25)
      const rawScore = finalResponses.reduce((sum, response) => sum + response.score, 0);
      console.log("Raw score:", rawScore);
      // Convert to accuracy percentage (0-100)
      const accuracy = Math.round((rawScore / 25) * 100);
      
      // Store individual responses and scores
      const assessmentData = {
        responses: finalResponses,
        rawScore: rawScore,
        accuracy: accuracy,
        maxScore: 25,
        completedAt: new Date().toISOString()
      };

      // Send to backend for storage and Claude analysis
      console.log('Sending assessment data:', assessmentData);
      console.log('User:', user);
      console.log('Token:', token);
      
      const response = await fetch('http://localhost:8000/api/mental-health/assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(assessmentData),
      });

      if (response.ok) {
        const result = await response.json();
        setIsCompleted(true);
        
        Alert.alert(
          'Assessment Complete!',
          `Your mental well-being score: ${rawScore}/25 (${accuracy}%)\n\nThank you for completing the assessment!`,
          [
            { text: 'Take Again', onPress: () => resetAssessment() },
            { text: 'Done', onPress: () => setCurrentQuestionIndex(0) }
          ]
        );
      } else {
        const errorData = await response.json();
        console.error('Backend error response:', errorData);
        console.error('Response status:', response.status);
        throw new Error(`Failed to save assessment: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error completing assessment:', error);
      Alert.alert('Error', 'Failed to save your assessment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetAssessment = () => {
    setCurrentQuestionIndex(0);
    setResponses([]);
    setIsCompleted(false);
  };

  const renderQuestion = () => {
    if (isCompleted) {
      return (
        <View style={styles.completedContainer}>
          <Text style={styles.completedTitle}>Assessment Complete!</Text>
          <Text style={styles.completedText}>
            Thank you for completing the mental health assessment.
          </Text>
          <TouchableOpacity 
            style={styles.restartButton}
            onPress={resetAssessment}
          >
            <Text style={styles.restartButtonText}>Take Assessment Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.questionContainer}>
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Question {currentQuestionIndex + 1} of {WHO5_QUESTIONS.length}
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${((currentQuestionIndex + 1) / WHO5_QUESTIONS.length) * 100}%` }
              ]} 
            />
          </View>
        </View>

        <Text style={styles.questionStatement}>
          {currentQuestion.statement}
        </Text>

        <Text style={styles.instructionText}>
          Please select how often you have felt this way during the past two weeks:
        </Text>

        <View style={styles.optionsContainer}>
          {SCALE_OPTIONS.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={styles.optionButton}
              onPress={() => handleAnswer(option.value)}
              disabled={isLoading}
            >
              <Text style={styles.optionText}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Processing your responses...</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Mental Health Assessment</Text>
          <Text style={styles.subtitle}>
            WHO-5 Well-Being Index
          </Text>
          <Text style={styles.description}>
            This assessment helps us understand your mental well-being over the past two weeks.
          </Text>
        </View>

        {renderQuestion()}
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
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '500',
    color: '#8B6B8B',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  questionContainer: {
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
  progressContainer: {
    marginBottom: 24,
  },
  progressText: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    marginBottom: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E8EDE8',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B6B8B',
    borderRadius: 4,
  },
  questionStatement: {
    fontSize: 20,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 16,
    lineHeight: 28,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  instructionText: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: '#F8F9F8',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E8EDE8',
  },
  optionText: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#5A6B5A',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    fontWeight: '400',
  },
  completedContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
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
  completedTitle: {
    fontSize: 24,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 12,
    textAlign: 'center',
  },
  completedText: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  restartButton: {
    backgroundColor: '#8B6B8B',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  restartButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'System',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});