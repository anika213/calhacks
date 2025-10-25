import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, TextInput } from 'react-native';

import { SessionContextInputs } from '@/types/games';

interface GameContextFormProps {
  value: SessionContextInputs;
  onChange: (value: SessionContextInputs) => void;
}

const SCALE_VALUES = [1, 2, 3, 4, 5];

export const GameContextForm: React.FC<GameContextFormProps> = ({ value, onChange }) => {
  const handleSelect = (key: 'moodLevel' | 'sleepQuality', selected: number) => {
    onChange({
      ...value,
      [key]: selected,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Today&apos;s context</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Mood</Text>
        <View style={styles.scaleRow}>
          {SCALE_VALUES.map(option => (
            <TouchableOpacity
              key={`mood-${option}`}
              onPress={() => handleSelect('moodLevel', option)}
              style={[styles.scaleOption, value.moodLevel === option && styles.scaleOptionActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: value.moodLevel === option }}
              accessibilityLabel={`Mood level ${option}`}
            >
              <Text style={[styles.scaleText, value.moodLevel === option && styles.scaleTextActive]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Sleep</Text>
        <View style={styles.scaleRow}>
          {SCALE_VALUES.map(option => (
            <TouchableOpacity
              key={`sleep-${option}`}
              onPress={() => handleSelect('sleepQuality', option)}
              style={[styles.scaleOption, value.sleepQuality === option && styles.scaleOptionActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: value.sleepQuality === option }}
              accessibilityLabel={`Sleep quality level ${option}`}
            >
              <Text style={[styles.scaleText, value.sleepQuality === option && styles.scaleTextActive]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.row, styles.switchRow]}>
        <Text style={styles.label}>Medication changes</Text>
        <Switch
          value={value.medsChanged}
          onValueChange={medsChanged => onChange({ ...value, medsChanged })}
          thumbColor={value.medsChanged ? '#6B8E6B' : '#F4F9F4'}
          trackColor={{ true: '#CFE3CF', false: '#DDE8DD' }}
          accessibilityLabel="Medication changed today"
        />
      </View>

      <TextInput
        style={styles.notesInput}
        placeholder="Optional notes"
        placeholderTextColor="#9AA79A"
        value={value.notes}
        onChangeText={notes => onChange({ ...value, notes })}
        multiline
        numberOfLines={3}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F5F0',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E0EAE0',
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4E5E4E',
  },
  row: {
    gap: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#5A6B5A',
  },
  scaleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scaleOption: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0EAE0',
  },
  scaleOptionActive: {
    backgroundColor: '#6B8E6B',
    borderColor: '#6B8E6B',
    shadowColor: '#6B8E6B',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  scaleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6C7C6C',
  },
  scaleTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  notesInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0EAE0',
    padding: 12,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
    color: '#4E5E4E',
    backgroundColor: '#FFFFFF',
  },
});
