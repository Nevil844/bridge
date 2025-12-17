import { API_ENDPOINTS } from '@/config/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authenticatedFetch } from '@/utils/api';
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
        // Use authenticated fetch - token is automatically added to headers
        const response = await authenticatedFetch(`${API_ENDPOINTS.SAMPLE_QUESTIONS}`);
        const data = await response.json();
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
        }
      } catch (error) {
        console.error('Error fetching sample questions:', error);
      }
    };

    if (userId) {
      fetchQuestions();
      
      // Refetch questions after a delay to allow integrations to load
      // This ensures questions update when integrations are initialized
      const refetchTimer = setTimeout(() => {
        fetchQuestions();
      }, 3000); // Refetch after 3 seconds
      
      // Also refetch after 10 seconds to catch any late-loading integrations
      const lateRefetchTimer = setTimeout(() => {
        fetchQuestions();
      }, 10000);
      
      return () => {
        clearTimeout(refetchTimer);
        clearTimeout(lateRefetchTimer);
      };
    }
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
            backgroundColor: 'transparent',
            borderColor: isDark ? 'rgba(0, 122, 255, 0.3)' : 'rgba(0, 122, 255, 0.2)',
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
              { color: isDark ? '#5AC8FA' : '#007AFF' },
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

