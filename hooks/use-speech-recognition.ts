import Voice from '@react-native-voice/voice';
import { useEffect, useRef, useState } from 'react';

interface UseSpeechRecognitionOptions {
  onResult?: (text: string) => void;
  onError?: (error: Error) => void;
  onStart?: () => void;
  onStop?: () => void;
  language?: string; // e.g., 'en-US', 'hi-IN'
}

interface UseSpeechRecognitionReturn {
  isRecording: boolean;
  transcript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  destroy: () => void;
}

/**
 * Custom hook for on-device speech recognition
 * Uses native iOS Speech Framework and Android SpeechRecognizer
 * 
 * Note: This requires a development build (not Expo Go) as it uses native modules
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { onResult, onError, onStart, onStop, language = 'en-US' } = options;
  
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isInitialized = useRef(false);

  useEffect(() => {
    // Initialize Voice recognition
    if (!isInitialized.current) {
      Voice.onSpeechStart = () => {
        setIsRecording(true);
        setError(null);
        onStart?.();
      };

      Voice.onSpeechEnd = () => {
        setIsRecording(false);
        onStop?.();
      };

      Voice.onSpeechResults = (e) => {
        if (e.value && e.value.length > 0) {
          const text = e.value[0]; // Get the most confident result
          setTranscript(text);
          onResult?.(text);
        }
      };

      Voice.onSpeechPartialResults = (e) => {
        // Real-time partial results (as user speaks)
        if (e.value && e.value.length > 0) {
          const text = e.value[0];
          setTranscript(text);
          onResult?.(text);
        }
      };

      Voice.onSpeechError = (e) => {
        const errorMessage = e.error?.message || 'Speech recognition error';
        setError(errorMessage);
        setIsRecording(false);
        
        // Don't show error for user cancellation
        if (e.error?.code !== '9' && e.error?.code !== '7') { // 9 = not_authorized, 7 = recognition_service
          onError?.(new Error(errorMessage));
        }
      };

      isInitialized.current = true;
    }

    return () => {
      // Cleanup on unmount
      if (isInitialized.current) {
        Voice.destroy().catch(() => {
          // Ignore cleanup errors
        });
        isInitialized.current = false;
      }
    };
  }, [onResult, onError, onStart, onStop]);

  const start = async () => {
    try {
      setError(null);
      setTranscript('');
      
      // Check if speech recognition is available
      const available = await Voice.isAvailable();
      if (!available) {
        throw new Error('Speech recognition is not available on this device');
      }

      // Start listening
      await Voice.start(language);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start speech recognition';
      setError(errorMessage);
      onError?.(new Error(errorMessage));
    }
  };

  const stop = async () => {
    try {
      await Voice.stop();
      setIsRecording(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop speech recognition';
      setError(errorMessage);
      onError?.(new Error(errorMessage));
    }
  };

  const destroy = () => {
    Voice.destroy().catch(() => {
      // Ignore cleanup errors
    });
    setIsRecording(false);
    setTranscript('');
    setError(null);
  };

  return {
    isRecording,
    transcript,
    error,
    start,
    stop,
    destroy,
  };
}

