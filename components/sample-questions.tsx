import { API_ENDPOINTS } from '@/config/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SampleQuestionsProps {
  userId: string;
  onQuestionSelect: (question: string) => void;
}

export function SampleQuestions({ userId, onQuestionSelect }: SampleQuestionsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fetch questions from API
    const fetchQuestions = async () => {
      try {
        const response = await fetch(`${API_ENDPOINTS.SAMPLE_QUESTIONS}?userId=${userId}`);
        const data = await response.json();
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
        }
      } catch (error) {
        console.error('Error fetching sample questions:', error);
      }
    };

    fetchQuestions();
  }, [userId]);

  useEffect(() => {
    if (questions.length === 0) return;

    // Rotate questions every 8 seconds
    const interval = setInterval(() => {
      // Fade out and slide up
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Update index
        setCurrentIndex((prev) => (prev + 1) % questions.length);
        
        // Reset animations
        slideAnim.setValue(20);
        
        // Fade in and slide in
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 5000); // 8 seconds

    return () => clearInterval(interval);
  }, [questions, fadeAnim, slideAnim]);

  if (questions.length === 0) {
    return null;
  }

  const currentQuestion = questions[currentIndex];

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onQuestionSelect(currentQuestion)}
        style={[
          styles.questionContainer,
          {
            backgroundColor: isDark ? '#151718' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          },
        ]}>
        <Animated.View
          style={[
            styles.animatedContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}>
          <Text
            style={[
              styles.questionText,
              { color: isDark ? '#FFFFFF' : '#000000' },
            ]}>
            {currentQuestion}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  questionContainer: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer' as any,
    }),
  },
  animatedContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});

