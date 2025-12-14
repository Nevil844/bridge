import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AIDisclaimerModalProps {
  visible: boolean;
  onUnderstand: () => void;
}

export default function AIDisclaimerModal({ visible, onUnderstand }: AIDisclaimerModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onUnderstand}
    >
      <View style={styles.overlay}>
        <ThemedView style={[styles.modalContainer, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
          <Text style={[styles.title, { color: isDark ? '#4A9EFF' : '#007AFF' }]}>
            Disclaimer
          </Text>

          <ThemedText style={styles.message}>
            AI can make mistakes. Please verify important information and use your judgment when making decisions based on AI-generated responses.
          </ThemedText>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: isDark ? '#4A9EFF' : '#007AFF' }]}
            onPress={onUnderstand}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.buttonText}>I Understand</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.9,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

