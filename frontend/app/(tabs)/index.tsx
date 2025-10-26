import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Animated 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
  const router = useRouter();
  
  // subtle fade + scale animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleCheckInPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/game');
  };

  const handleChatPress = () => {
    // Haptics.selectionAsync();
    // router.push('/(tabs)/chat');
  };

  return (
    <LinearGradient
      colors={['#F4F9F4', '#E8F0E8', '#FAF8F5']}
      style={styles.gradientBackground}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
        >
          {/* Animated Greeting */}
          <Animated.View style={[styles.greetingContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.greeting}>Good Morning</Text>
          </Animated.View>

          {/* Header Section */}
          <View style={styles.header}>
            <Text style={styles.title}>EverWell</Text>
            <Text style={styles.subtitle}>
              Track your mental and cognitive wellness daily with fun, mindful exercises.
            </Text>
          </View>

          {/* Primary Action: Daily Check-In */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCheckInPress}
            activeOpacity={0.85}
          >
            <IconSymbol name="heart.fill" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Start Daily Check-In</Text>
          </TouchableOpacity>

          {/* Secondary Action: Chat */}
          <TouchableOpacity
            style={styles.chatButton}
            onPress={handleChatPress}
            activeOpacity={0.85}
          >
            <IconSymbol name="bubble.left.and.bubble.right.fill" size={20} color="#6B8E6B" />
            <Text style={styles.chatButtonText}>Chat with Me</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  greetingContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '600',
    color: '#5A6B5A',
    letterSpacing: 0.5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: '#4E5E4E',
    marginBottom: 12,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 17,
    textAlign: 'center',
    color: '#6C7C6C',
    lineHeight: 25,
    paddingHorizontal: 15,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B8E6B',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignSelf: 'center',
    width: '70%',
    shadowColor: '#8EBB8E',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 8,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F1',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignSelf: 'center',
    width: '70%',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#D6E0D6',
  },
  chatButtonText: {
    color: '#6B8E6B',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 8,
  },
});
