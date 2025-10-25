import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import GameFramework from '@/components/GameFramework';

export default function MentalGameTab() {
  const moodQuestions = [
    { question: 'How are you feeling today?' },
    { question: 'Name one thing you’re grateful for right now.' },
    { question: 'Take 3 deep breaths — did that feel relaxing?' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <GameFramework
          title="Mindful Reflection"
          description="Gentle mood and mindfulness exercises for daily balance."
          color="#8B6B8B"
          questions={moodQuestions}
          onComplete={(score) => console.log('Mental health game finished with', score)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFCF8' },
});
