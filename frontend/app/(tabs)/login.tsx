import React, { useState, useEffect } from 'react';

import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useRouter } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

interface DailyProgress {
  date: string;
  completedTasks: Array<{ id: string; name: string; type: string }>;
  pendingTasks: Array<{ id: string; name: string; type: string }>;
  gameScores: Array<{ gameName: string; accuracy: number; gameType: string }>;
  mentalHealthChecks: number;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.30.58:8000/api';

export default function LoginScreen() {
  const router = useRouter();
  const { login, register, isLoading, user, logout, token } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Fetch daily progress when user is logged in
  useEffect(() => {
    if (user && token) {
      fetchDailyProgress();
    }
  }, [user, token]);

  const fetchDailyProgress = async () => {
    if (!token) return;

    setLoadingProgress(true);
    try {
      const response = await fetch(`${API_BASE_URL}/progress/daily`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDailyProgress(data.data);
      } else {
        console.error('Failed to fetch daily progress');
      }
    } catch (error) {
      console.error('Error fetching daily progress:', error);
    } finally {
      setLoadingProgress(false);
    }
  };

  // If user is logged in, show profile view

  if (user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {user.name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <Text style={styles.title}>Welcome, {user.name}!</Text>
            <Text style={styles.subtitle}>Your therapy journey continues</Text>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.infoItem}>
              <IconSymbol name="envelope.fill" size={20} color="#6B8E6B" />
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
            
            <View style={styles.infoItem}>
              <IconSymbol name="calendar" size={20} color="#6B8E6B" />
              <Text style={styles.infoLabel}>Age</Text>
              <Text style={styles.infoValue}>{user.age} years old</Text>
            </View>
            
            <View style={styles.infoItem}>
              <IconSymbol name="globe" size={20} color="#6B8E6B" />
              <Text style={styles.infoLabel}>Language</Text>
              <Text style={styles.infoValue}>{user.preferredLanguage}</Text>
            </View>
          </View>

          {/* Today's Progress Section */}
          <View style={styles.progressSection}>
            <Text style={styles.progressTitle}>Today's Progress</Text>
            
            {loadingProgress ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading your progress...</Text>
              </View>
            ) : dailyProgress ? (
              <View>
                {/* Completed Tasks */}
                {dailyProgress.completedTasks.length > 0 && (
                  <View style={styles.taskSection}>
                    <Text style={styles.taskSectionTitle}>✅ Completed Tasks</Text>
                    {dailyProgress.completedTasks.map((task, index) => (
                      <View key={index} style={styles.taskItem}>
                        <IconSymbol name="checkmark.circle.fill" size={20} color="#34C759" />
                        <Text style={styles.completedTaskText}>{task.name}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Pending Tasks */}
                {dailyProgress.pendingTasks.length > 0 && (
                  <View style={styles.taskSection}>
                    <Text style={styles.taskSectionTitle}>⏳ Pending Tasks</Text>
                    {dailyProgress.pendingTasks.map((task, index) => (
                      <View key={index} style={styles.taskItem}>
                        <IconSymbol name="circle" size={20} color="#8E8E93" />
                        <Text style={styles.pendingTaskText}>{task.name}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Game Scores Summary */}
                {dailyProgress.gameScores.length > 0 && (
                  <View style={styles.scoreSection}>
                    <Text style={styles.scoreSectionTitle}>🎮 Today's Scores</Text>
                    {dailyProgress.gameScores.map((score, index) => (
                      <View key={index} style={styles.scoreItem}>
                        <Text style={styles.scoreGameName}>{score.gameName}</Text>
                        <Text style={styles.scoreValue}>{score.accuracy}%</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* No activity message */}
                {dailyProgress.completedTasks.length === 0 && dailyProgress.pendingTasks.length > 0 && (
                  <View style={styles.noActivityContainer}>
                    <IconSymbol name="calendar.badge.clock" size={40} color="#8E8E93" />
                    <Text style={styles.noActivityText}>Start your day with some activities!</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Unable to load progress</Text>
              </View>
            )}
          </View>

          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={logout}
          >
            <Text style={styles.logoutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const success = await login(email, password);
    if (success) {
      Alert.alert('Success', 'Login successful!', [
        { text: 'OK', onPress: () => router.push('/') }
      ]);
    } else {
      Alert.alert('Error', 'Invalid email or password. Please try again.');
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !name || !age) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
  
    try {
      // Step 1: Check if email already exists
      const checkResponse = await fetch(
        `${API_BASE_URL}/auth/check-email?email=${encodeURIComponent(email)}`
      );
      const checkData = await checkResponse.json();
  
      if (checkData.exists) {
        Alert.alert('Error', 'This email is already in use. Please try logging in or use another email.');
        return;
      }
  
      // Step 2: If not exists, proceed to register
      const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          age: parseInt(age),
          preferredLanguage
        }),
      });
      
  
      const registerData = await registerResponse.json();
  
      if (registerData.success) {
        Alert.alert('Success', 'Account created successfully!', [
          { text: 'OK', onPress: () => router.push('/') }
        ]);
      } else {
        Alert.alert('Error', registerData.message || 'Failed to create account');
      }
  
    } catch (error) {
      console.error('Error during sign-up:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };
  

  const handleForgotPassword = () => {
    Alert.alert('Forgot Password', 'Password reset functionality would be implemented here');
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
    setName('');
    setAge('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <IconSymbol name="person.circle.fill" size={80} color="#6B8E6B" />
            <Text style={styles.title}>
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>
            <Text style={styles.subtitle}>
              {isSignUp 
                ? 'Sign up to start your therapy journey' 
                : 'Sign in to continue your therapy journey'
              }
            </Text>
          </View>

          <View style={styles.form}>
            {isSignUp && (
              <View style={styles.inputContainer}>
                <IconSymbol name="person.fill" size={20} color="#8E8E93" />
                <TextInput
                  style={styles.input}
                  placeholder="Full name"
                  placeholderTextColor="#8E8E93"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            )}

            {isSignUp && (
              <View style={styles.inputContainer}>
                <IconSymbol name="calendar" size={20} color="#8E8E93" />
                <TextInput
                  style={styles.input}
                  placeholder="Age"
                  placeholderTextColor="#8E8E93"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                  autoCorrect={false}
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <IconSymbol name="envelope.fill" size={20} color="#8E8E93" />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#8E8E93"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <IconSymbol name="lock.fill" size={20} color="#8E8E93" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#8E8E93"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {!isSignUp && (
              <TouchableOpacity 
                style={styles.forgotPassword}
                onPress={handleForgotPassword}
              >

                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={isSignUp ? handleSignUp : handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.loginButtonText}>
                {isLoading 
                  ? (isSignUp ? 'Creating Account...' : 'Signing In...') 
                  : (isSignUp ? 'Create Account' : 'Sign In')
                }
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.signUpButton} onPress={toggleMode}>
              <Text style={styles.signUpButtonText}>
                {isSignUp ? 'Already have an account? Sign In' : 'Create New Account'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDFCF8', // Soft cream background
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 32,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A', // Muted sage green
    marginTop: 20,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: 'System',
    color: '#7A8B7A', // Soft muted green
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8EDE8', // Very light pastel border
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  input: {
    flex: 1,
    marginLeft: 16,
    fontSize: 20,
    fontFamily: 'System',
    color: '#5A6B5A',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotPasswordText: {
    color: '#6B8E6B', // Darker green for links
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  loginButton: {
    backgroundColor: '#6B8E6B', // Darker green for buttons
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#B8C5B8',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  loginButtonDisabled: {
    backgroundColor: '#A0B5A0', // Muted darker green
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'System',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8EDE8',
  },
  dividerText: {
    marginHorizontal: 20,
    color: '#7A8B7A',
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  signUpButton: {
    backgroundColor: 'transparent',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6B8E6B',
  },
  signUpButtonText: {
    color: '#6B8E6B',
    fontSize: 15,
    fontFamily: 'System',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  // Profile view styles
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6B8E6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontFamily: 'System',
    fontWeight: '600',
    letterSpacing: 1,
  },
  profileInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 30,
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
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoLabel: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginLeft: 16,
    marginRight: 16,
    minWidth: 80,
    letterSpacing: 0.2,
  },
  infoValue: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#7A8B7A',
    flex: 1,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  logoutButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FFB8B8',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: 'System',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  // Progress section styles
  progressSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 30,
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
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#7A8B7A',
    fontWeight: '400',
  },
  taskSection: {
    marginBottom: 20,
  },
  taskSectionTitle: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  completedTaskText: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#34C759',
    marginLeft: 12,
    fontWeight: '500',
  },
  pendingTaskText: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#7A8B7A',
    marginLeft: 12,
    fontWeight: '400',
  },
  scoreSection: {
    marginBottom: 20,
  },
  scoreSectionTitle: {
    fontSize: 18,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#5A6B5A',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  scoreItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9F8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  scoreGameName: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#5A6B5A',
    fontWeight: '500',
  },
  scoreValue: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#6B8E6B',
    fontWeight: '600',
  },
  noActivityContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noActivityText: {
    fontSize: 18,
    fontFamily: 'System',
    color: '#7A8B7A',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '400',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#FF6B6B',
    fontWeight: '500',
  },
});
