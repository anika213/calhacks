import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

interface UserAvatarProps {
  size?: number;
  onPress?: () => void;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ size = 32, onPress }) => {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const initials = user.name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <TouchableOpacity 
      style={[styles.avatar, { width: size, height: size }]} 
      onPress={onPress}
    >
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
        {initials}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#6B8E6B',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  initials: {
    color: '#FFFFFF',
    fontFamily: 'System',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
