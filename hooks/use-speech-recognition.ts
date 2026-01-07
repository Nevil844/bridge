import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

// Lazy-load expo-speech-recognition so the app doesn't crash if the native module
// isn't available (e.g. Expo Go, certain environments).
let ExpoSpeechRecognitionModule: any = null;
let useSpeechRecognitionEvent: any = () => {};

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch (e) {
  // Module not available – we'll mark isAvailable=false and no-op the hooks.
  ExpoSpeechRecognitionModule = null;
  useSpeechRecognitionEvent = () => {};
}

interface UseSpeechRecognitionOptions {
  language?: string;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isAvailable: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  error: string | null;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { language = 'en-US', onResult, onError } = options;
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);

  // Check if speech recognition is available
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        if (Platform.OS === 'web') {
          // Web Speech API availability check
          const webAvailable = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
          setIsAvailable(webAvailable);
          return;
        }
        
        // On native, only available if the module actually loaded
        setIsAvailable(!!ExpoSpeechRecognitionModule);
      } catch {
        setIsAvailable(false);
      }
    };
    
    checkAvailability();
  }, []);

  // Handle speech recognition results
  if (useSpeechRecognitionEvent && ExpoSpeechRecognitionModule) {
    // Handle speech recognition results
    useSpeechRecognitionEvent('result', (event: any) => {
      const results = event.results;
      if (results && results.length > 0) {
        const latestResult = results[results.length - 1];
        if (latestResult && latestResult.transcript) {
          const recognizedText = latestResult.transcript;
          const isFinal = event.isFinal;
          
          if (isFinal) {
            setTranscript(recognizedText);
            setInterimTranscript('');
            onResult?.(recognizedText, true);
          } else {
            setInterimTranscript(recognizedText);
            onResult?.(recognizedText, false);
          }
        }
      }
    });

    // Handle speech recognition errors
    useSpeechRecognitionEvent('error', (event: any) => {
      const errorMessage = event.error || 'Speech recognition error';
      setError(errorMessage);
      setIsListening(false);
      onError?.(errorMessage);
    });

    // Handle recognition end
    useSpeechRecognitionEvent('end', () => {
      setIsListening(false);
    });

    // Handle recognition start
    useSpeechRecognitionEvent('start', () => {
      setIsListening(true);
      setError(null);
      setTranscript('');
      setInterimTranscript('');
    });
  }

  const startListening = useCallback(async () => {
    try {
      setError(null);

      if (!ExpoSpeechRecognitionModule) {
        const errorMsg = 'Speech recognition is not available on this device.';
        setError(errorMsg);
        Alert.alert(
          'Not Available',
          'Speech recognition is not supported in this environment.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      // Request permissions
      const permissionResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      
      if (!permissionResult.granted) {
        const errorMsg = 'Speech recognition permission denied';
        setError(errorMsg);
        Alert.alert(
          'Permission Required',
          'Please grant microphone and speech recognition permissions to use voice input.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Start listening with on-device recognition
      await ExpoSpeechRecognitionModule.start({
        lang: language,
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
        contextualStrings: [],
      });
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start speech recognition';
      setError(errorMsg);
      setIsListening(false);
      onError?.(errorMsg);
    }
  }, [language, onError]);

  const stopListening = useCallback(async () => {
    try {
      if (ExpoSpeechRecognitionModule) {
        await ExpoSpeechRecognitionModule.stop();
      }
    } catch {
      // Ignore stop errors
    }
    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isAvailable,
    startListening,
    stopListening,
    error,
  };
}
