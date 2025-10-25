import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import GameFramework from '@/components/GameFramework';

export default function CognitiveGameTab() {
  const cognitiveQuestions = [
    { question: 'Repeat this sequence: 3 - 1 - 4 - 1 - 5' },
    { question: 'What day was it three days ago?' },
    { question: 'Name an animal that starts with “E”.' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <GameFramework
          title="Memory Match"
          description="Test your recall and focus through cognitive challenges."
          color="#6B8E6B"
          questions={cognitiveQuestions}
          gameType="cognitive"
          onComplete={(score) => console.log('Cognitive game finished with', score)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFCF8' },
});
