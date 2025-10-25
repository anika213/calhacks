import { BlurView } from 'expo-blur';
import { StyleSheet, Platform } from 'react-native';

export default function TabBarBackground() {
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        style={StyleSheet.absoluteFill}
        blurType="regular"
        blurAmount={20}
      />
    );
  }
  return null;
}
