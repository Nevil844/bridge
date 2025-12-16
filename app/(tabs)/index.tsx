import AIDisclaimerModal from '@/components/ai-disclaimer-modal';
import { GlowingOrb } from '@/components/glowing-orb';
import { MarkdownText } from '@/components/markdown-text';
import { SampleQuestions } from '@/components/sample-questions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThinkingProcess } from '@/components/thinking-process';
import ToolApprovalModal, { PendingTool } from '@/components/tool-approval-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_ENDPOINTS } from '@/config/api';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePreferences } from '@/hooks/use-preferences';
import { useSafeAreaPadding } from '@/hooks/use-safe-area-padding';
import { storage, STORAGE_KEYS } from '@/utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

interface ThinkingData {
  isInternal: boolean;
  thinking: string;
  action: string;
  toolCalls: string[];
  data: any;
  memoryUsed?: boolean;
  memoryCount?: number;
}

interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  thinking?: ThinkingData[]; // Array of thinking data for AI messages (all internal calls)
  tokenUsage?: TokenUsage;
}

interface Model {
  id: string;
  name: string;
  tier?: 'free' | 'premium';
  provider?: 'gemini' | 'openrouter' | 'bedrock';
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const screenHeight = Dimensions.get('window').height;
  const { user, logout, isAuthenticated } = useAuth();
  const { toolApprovalEnabled } = usePreferences();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('anthropic.claude-sonnet-4-5-20250929-v1:0'); // Default to Claude Sonnet 4.5
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const transcribeWebSocketRef = useRef<WebSocket | null>(null);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{id: string, title: string, lastActive: string, messageCount: number}>>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('default-user');
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set(['bedrock'])); // Default expand Bedrock (default model provider)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [showWebSearchMenu, setShowWebSearchMenu] = useState(false);
  const [pendingToolApproval, setPendingToolApproval] = useState<{
    approvalId: string;
    tools: PendingTool[];
  } | null>(null);
  const [approvalExpiresAt, setApprovalExpiresAt] = useState<number | null>(null);
  const [approvalCountdown, setApprovalCountdown] = useState<string>('');
  const [approvalRemainingMs, setApprovalRemainingMs] = useState<number>(0);
  const TOOL_APPROVAL_TIMEOUT_MS = 45000;
  const [isApprovingTool, setIsApprovingTool] = useState(false);
  const [showAIDisclaimer, setShowAIDisclaimer] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const activeWebSocketRef = useRef<WebSocket | null>(null);
  const { topInset, bottomInset } = useSafeAreaPadding({ top: 12, bottom: 16 });
  const headerPaddingTop = topInset + 20;
  const headerButtonTop = topInset + 24;
  const inputBottomPadding = bottomInset;
  const normalizeTokenUsage = (usage?: { input_tokens?: number; output_tokens?: number }) => {
    if (!usage) return undefined;
    const inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : undefined;
    const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : undefined;
    const totalTokens =
      (inputTokens ?? 0) + (outputTokens ?? 0);
    if (inputTokens === undefined && outputTokens === undefined) {
      return undefined;
    }
    return { inputTokens, outputTokens, totalTokens };
  };

  useEffect(() => {
    loadUserId();
    loadSelectedModel();
    loadAvailableModels();
    cleanupOldData(); // Remove old AsyncStorage data
  }, []);

  // Show disclaimer after login succeeds (when user becomes authenticated)
  useEffect(() => {
    const checkAIDisclaimer = async () => {
      if (!user || !isAuthenticated) return;
      
      try {
        const hasAcknowledged = await storage.getItem(STORAGE_KEYS.AI_DISCLAIMER_ACKNOWLEDGED);
        if (!hasAcknowledged || hasAcknowledged !== 'true') {
          // Show disclaimer if user hasn't acknowledged it yet
          setShowAIDisclaimer(true);
        }
      } catch (error) {
        console.error('Error checking AI disclaimer:', error);
      }
    };

    checkAIDisclaimer();
  }, [user, isAuthenticated]);

  const handleAIDisclaimerAcknowledge = async () => {
    try {
      await storage.setItem(STORAGE_KEYS.AI_DISCLAIMER_ACKNOWLEDGED, 'true');
      setShowAIDisclaimer(false);
    } catch (error) {
      console.error('Error saving AI disclaimer acknowledgment:', error);
      setShowAIDisclaimer(false);
    }
  };

  const loadUserId = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      if (storedUserId && storedUserId !== 'default-user') {
        setUserId(storedUserId);
      } else if (user?.id) {
        setUserId(user.id);
      } else {
        // Fallback (should not happen if auth is working correctly)
        setUserId('default-user');
      }
    } catch (error) {
      console.error('Error loading userId:', error);
    }
  };

  useEffect(() => {
    // Scroll to bottom when messages array length changes
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  useEffect(() => {
    // Listen to keyboard events
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    return () => {
      keyboardWillShow.remove();
    };
  }, []);

  // Load conversations from database
  const loadConversations = useCallback(async (showLoading = false) => {
    try {
      if (!userId) return; // Wait for userId to load
      if (showLoading) setIsLoadingChats(true);
      // Use authenticated fetch - token is automatically added to headers
      const { authenticatedFetch } = require('@/utils/api');
      const response = await authenticatedFetch(`${API_ENDPOINTS.CONVERSATIONS}`);
      if (response.ok) {
        const conversations = await response.json();
        setChatHistory(conversations.map((conv: any) => ({
          id: conv.id,
          title: conv.title,
          lastActive: conv.lastActive,
          messageCount: conv._count?.messages || 0,
        })));
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      if (showLoading) setIsLoadingChats(false);
    }
  }, [userId]);

  // Load conversations when userId changes
  useEffect(() => {
    if (userId) {
      loadConversations();
    }
  }, [userId, loadConversations]);

  // Load messages for a conversation
  const loadConversationMessages = async (conversationId: string) => {
    try {
      // Use authenticated fetch - token is automatically added to headers
      const { authenticatedFetch } = require('@/utils/api');
      const response = await authenticatedFetch(`${API_ENDPOINTS.CONVERSATIONS}/${conversationId}`);
      if (response.ok) {
        const conversation = await response.json();
        const loadedMessages: Message[] = conversation.messages.map((msg: any) => ({
          id: msg.id,
          text: msg.content,
          isUser: msg.role === 'user',
        }));
        setMessages(loadedMessages);
      }
    } catch (error) {
      console.error('Error loading conversation messages:', error);
    }
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setShowSidebar(false);
  };

  const loadChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    await loadConversationMessages(chatId);
    setShowSidebar(false);
  };

  const deleteChat = async (chatId: string) => {
    try {
      // Use authenticated fetch - token is automatically added to headers
      const { authenticatedFetch } = require('@/utils/api');
      const response = await authenticatedFetch(`${API_ENDPOINTS.CONVERSATIONS}/${chatId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Reload conversations list
        await loadConversations();
        
        if (chatId === currentChatId) {
          startNewChat();
        }
      } else {
        if (Platform.OS === 'web') {
          alert('Failed to delete conversation');
        } else {
          Alert.alert('Error', 'Failed to delete conversation');
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      if (Platform.OS === 'web') {
        alert('Failed to delete conversation');
      } else {
      Alert.alert('Error', 'Failed to delete conversation');
      }
    }
  };

  // Clean up old AsyncStorage data
  const cleanupOldData = async () => {
    try {
      await AsyncStorage.removeItem('chatHistory');
    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  };


  const loadAvailableModels = async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.MODELS}`);
      const models = await response.json();
      setAvailableModels(models);
    } catch (error) {
      console.error('Error loading models:', error);
      // Fallback to default free model
      setAvailableModels([
        { id: 'models/gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'free', provider: 'gemini' },
      ]);
    }
  };

  const loadSelectedModel = async () => {
    try {
      const model = await AsyncStorage.getItem('selectedModel');
      if (model) setSelectedModel(model);
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

  const submitToolApproval = useCallback(
    async (decision: 'approve' | 'reject') => {
      if (!pendingToolApproval) {
        return;
      }

      try {
        setIsApprovingTool(true);
        
        // Try to send via WebSocket if available, otherwise fall back to HTTP
        if (activeWebSocketRef.current && activeWebSocketRef.current.readyState === WebSocket.OPEN) {
          activeWebSocketRef.current.send(JSON.stringify({
            type: 'tool_approval',
            approvalId: pendingToolApproval.approvalId,
            decision,
          }));
        } else {
          // Fall back to HTTP
          const { authenticatedFetch } = require('@/utils/api');
          await authenticatedFetch(API_ENDPOINTS.CHAT_TOOL_APPROVAL, {
            method: 'POST',
            body: JSON.stringify({
              approvalId: pendingToolApproval.approvalId,
              decision,
            }),
          });
        }
      } catch (error) {
        console.error('Tool approval failed:', error);
        Alert.alert('Tool approval failed', 'Please try again.');
      } finally {
        setIsApprovingTool(false);
        setPendingToolApproval(null);
        setApprovalExpiresAt(null);
        setApprovalCountdown('');
        setApprovalRemainingMs(0);
      }
    },
    [pendingToolApproval]
  );

  useEffect(() => {
    if (pendingToolApproval && approvalExpiresAt) {
      const updateCountdown = () => {
        const remaining = Math.max(0, approvalExpiresAt - Date.now());
        setApprovalRemainingMs(remaining);
        const seconds = Math.ceil(remaining / 1000);
        const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
        const ss = String(seconds % 60).padStart(2, '0');
        setApprovalCountdown(`${mm}:${ss}`);
      };

      updateCountdown();
      const timer = setInterval(updateCountdown, 500);
      return () => clearInterval(timer);
    }

    setApprovalCountdown('');
    setApprovalRemainingMs(0);
    return undefined;
  }, [pendingToolApproval, approvalExpiresAt]);

  const approvalProgress = approvalExpiresAt
    ? Math.max(0, Math.min(1, approvalRemainingMs / TOOL_APPROVAL_TIMEOUT_MS))
    : 0;

  const approvalColor = approvalProgress > 0.66
    ? '#34C759' // green
    : approvalProgress > 0.33
      ? '#FFD60A' // yellow
      : '#FF3B30'; // red

  const selectModel = async (modelId: string, tier?: 'free' | 'premium') => {
    // Allow selection of both free and premium models
    setSelectedModel(modelId);
    setShowModelPicker(false);
    try {
      await AsyncStorage.setItem('selectedModel', modelId);
    } catch (error) {
      console.error('Error saving model:', error);
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      
      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone permission to use voice input.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording with PCM format for real-time streaming
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
      setTranscriptionText('');

      // Get access token for WebSocket authentication
      const { getAccessToken } = require('@/utils/api');
      const token = await getAccessToken();
      
      if (!token) {
        Alert.alert('Error', 'No access token available. Please log in again.');
        setIsRecording(false);
        return;
      }

      // Create WebSocket connection for real-time transcription
      const ws = new WebSocket(API_ENDPOINTS.TRANSCRIBE_WS);
      transcribeWebSocketRef.current = ws;

      ws.onopen = () => {
        // Authenticate first
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      const messageHandler = (event: MessageEvent) => {
        // Handle binary audio data (shouldn't come from server, but handle gracefully)
        if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
          return;
        }

        try {
          const data = JSON.parse(event.data);
          console.log('📨 Transcription WebSocket message:', data.type);
          
          if (data.type === 'authenticated') {
            // Don't start here - let streamAudioChunks handle it
            console.log('✅ Transcription WebSocket authenticated');
          } else if (data.type === 'transcript') {
            // Update transcription text (partial or final)
            const transcriptText = data.text || '';
            console.log('📝 Transcript received:', transcriptText, data.isPartial ? '(partial)' : '(final)');
            
            if (transcriptText.trim()) {
              setTranscriptionText(transcriptText);
              setInputText(transcriptText);
            } else {
              console.warn('⚠️ Received empty transcript');
            }
            
            // If final transcript, we can auto-send or let user review
            if (!data.isPartial && transcriptText.trim()) {
              console.log('✅ Final transcript ready:', transcriptText);
              // Optionally auto-send final transcript
              // handleSendWithText(transcriptText);
            }
          } else if (data.type === 'error') {
            console.error('Transcription error:', data.message);
            Alert.alert('Transcription Error', data.message);
            setIsTranscribing(false); // Reset on error
          } else if (data.type === 'stopped') {
            console.log('Transcription stopped');
            setIsTranscribing(false); // Reset when stopped
          }
        } catch (error) {
          // Not JSON, might be binary - ignore
          console.warn('Non-JSON message received (likely binary audio):', error);
        }
      };

      ws.addEventListener('message', messageHandler);
      
      // Store handler reference for cleanup
      (ws as any)._transcribeMessageHandler = messageHandler;

      ws.onerror = (error) => {
        console.error('Transcription WebSocket error:', error);
        Alert.alert('Error', 'Failed to connect to transcription service');
      };

      ws.onclose = () => {
        const handler = (ws as any)?._transcribeMessageHandler;
        if (handler) {
          ws.removeEventListener('message', handler);
          delete (ws as any)._transcribeMessageHandler;
        }
        transcribeWebSocketRef.current = null;
        console.log('🔌 Transcription WebSocket closed');
      };

      // Don't stream yet - wait until recording stops
      // Expo Audio's getURI() only works AFTER recording stops
      // We'll stream the file in stopRecording()
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording');
      setIsRecording(false);
    }
  };

  // Stream audio file after recording stops
  // Note: Expo Audio's getURI() only works AFTER recording stops
  // This reads the m4a file and sends it to the backend for transcription
  const streamAudioFile = async (recording: Audio.Recording, ws: WebSocket) => {
    try {
      // Get the recording URI (only available after recording stops)
      const uri = recording.getURI();
      if (!uri) {
        throw new Error('Recording URI not available. Make sure recording has stopped.');
      }

      console.log(`📁 Reading audio file from: ${uri}`);

      // Read the entire audio file using XMLHttpRequest (React Native compatible)
      const audioData = await new Promise<Uint8Array>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', uri, true);
        xhr.responseType = 'arraybuffer';
        
        xhr.onload = () => {
          if (xhr.status === 200) {
            const arrayBuffer = xhr.response as ArrayBuffer;
            resolve(new Uint8Array(arrayBuffer));
          } else {
            reject(new Error(`Failed to read audio file: ${xhr.statusText}`));
          }
        };
        
        xhr.onerror = () => {
          reject(new Error('Failed to read audio file: network error'));
        };
        
        xhr.send();
      });

      const fileSize = audioData.length;
      console.log(`📦 Audio file size: ${fileSize} bytes`);

      if (fileSize === 0) {
        throw new Error('Audio file is empty');
      }

      // Start transcription stream
      if (ws.readyState === WebSocket.OPEN) {
        console.log('🎤 Starting transcription stream...');
        ws.send(JSON.stringify({
          type: 'start',
          languageCode: 'en-US',
          sampleRate: 16000,
        }));

        // Wait a bit for the stream to initialize
        await new Promise(resolve => setTimeout(resolve, 200));

        // Stream the file in chunks
        // Note: This is m4a format, backend needs to convert to PCM
        const chunkSize = 3200; // AWS Transcribe recommended chunk size
        let offset = 0;
        let chunksSent = 0;

        while (offset < fileSize && ws.readyState === WebSocket.OPEN) {
          const endOffset = Math.min(offset + chunkSize, fileSize);
          const audioChunk = audioData.slice(offset, endOffset);
          
          if (audioChunk.length > 0) {
            chunksSent++;
            if (chunksSent <= 5 || chunksSent % 20 === 0) {
              console.log(`📤 Sending audio chunk #${chunksSent}: ${audioChunk.length} bytes (${Math.round(offset / fileSize * 100)}%)`);
            }
            ws.send(audioChunk);
          }
          
          offset += chunkSize;
          
          // Small delay to avoid overwhelming the connection
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        console.log(`✅ Finished streaming audio file. Total chunks: ${chunksSent}`);
      }
    } catch (error) {
      console.error('❌ Error streaming audio file:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to stream audio: ' + (error as Error).message,
        }));
      }
      throw error;
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      setIsTranscribing(true); // Disable buttons during transcription
      setTranscriptionText('Transcribing...'); // Show loading state
      
      // Stop the recording first to get the URI
      console.log('🛑 Stopping recording...');
      await recording.stopAndUnloadAsync();
      
      // Now get the URI and stream the file
      const ws = transcribeWebSocketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Wait for authentication if not already authenticated
        let authenticated = false;
        const checkAuth = () => {
          // Check if we received authenticated message
          return authenticated;
        };
        
        // Set up a one-time auth check
        const authCheckHandler = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'authenticated') {
              authenticated = true;
              ws.removeEventListener('message', authCheckHandler);
            }
          } catch (e) {
            // Not JSON, ignore
          }
        };
        
        // If not authenticated yet, wait for it
        if (!authenticated) {
          ws.addEventListener('message', authCheckHandler);
          // Wait up to 2 seconds for authentication
          await new Promise((resolve) => {
            const timeout = setTimeout(() => {
              ws.removeEventListener('message', authCheckHandler);
              resolve(undefined);
            }, 2000);
            
            const checkInterval = setInterval(() => {
              if (authenticated) {
                clearTimeout(timeout);
                clearInterval(checkInterval);
                ws.removeEventListener('message', authCheckHandler);
                resolve(undefined);
              }
            }, 100);
          });
        }
        
        // Now stream the audio file
        await streamAudioFile(recording, ws);
        
        // Stop transcription stream (triggers batch processing)
        console.log('🛑 Stopping transcription stream...');
        ws.send(JSON.stringify({ type: 'stop' }));
        
        // Wait for transcript message (batch transcription takes time)
        let transcriptReceived = false;
        const transcriptHandler = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'transcript' && !data.isPartial) {
              transcriptReceived = true;
              console.log('✅ Received final transcript, closing WebSocket...');
            }
          } catch (e) {
            // Not JSON, ignore
          }
        };
        
        ws.addEventListener('message', transcriptHandler);
        
        // Wait up to 30 seconds for transcript (batch transcription can take time)
        const maxWaitTime = 30000; // 30 seconds
        const checkInterval = 100; // Check every 100ms
        let waited = 0;
        
        while (!transcriptReceived && waited < maxWaitTime && ws.readyState === WebSocket.OPEN) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waited += checkInterval;
        }
        
        if (!transcriptReceived) {
          console.warn('⚠️ Transcript not received within timeout, closing WebSocket anyway');
        }
        
        ws.removeEventListener('message', transcriptHandler);
        const handler = (ws as any)?._transcribeMessageHandler;
        if (handler) {
          ws.removeEventListener('message', handler);
        }
        ws.close();
        transcribeWebSocketRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      setRecording(null);
      setIsTranscribing(false); // Re-enable buttons after transcription

      // If we have final transcription text, use it
      if (transcriptionText.trim()) {
        setInputText(transcriptionText);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to stop recording');
      setIsTranscribing(false); // Reset transcription state on error
    }
  };

  const handleSendWithText = async (text: string) => {
    await handleSendWithWebSocket(text);
  };

  const handleRetry = (messageIndex: number) => {
    if (isLoading) {
      Alert.alert('Please wait', 'Your previous request is still processing.');
      return;
    }

    const previousUserMessage = [...messages]
      .slice(0, messageIndex)
      .reverse()
      .find((msg) => msg.isUser);

    if (!previousUserMessage) {
      Alert.alert('Retry Unavailable', 'No previous user message found to retry.');
      return;
    }

    handleSendWithText(previousUserMessage.text);
  };

  const handleQuestionSelect = (question: string) => {
    setInputText(question);
    setShowWebSearchMenu(false);
    // Auto-send the question
    setTimeout(() => {
      handleSendWithText(question);
    }, 100);
  };

  const handleSendWithWebSocket = async (text: string) => {
    if (text.trim() && !isLoading) {
      setShowWebSearchMenu(false);
      const userMessage: Message = {
        id: Date.now().toString(),
        text: text,
        isUser: true,
      };
      
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInputText('');
      setIsLoading(true);

      // Create placeholder for AI response
      const aiMessageId = (Date.now() + 1).toString();
      const aiMessagePlaceholder: Message = {
        id: aiMessageId,
        text: '',
        isUser: false,
      };
      setMessages([...newMessages, aiMessagePlaceholder]);

      try {
        // Get access token for WebSocket authentication
        const { getAccessToken } = require('@/utils/api');
        const token = await getAccessToken();
        
        if (!token) {
          throw new Error('No access token available. Please log in again.');
        }

        // Create WebSocket connection
        const ws = new WebSocket(API_ENDPOINTS.CHAT_WS);
        activeWebSocketRef.current = ws;
        
        let accumulatedContent = '';
        let accumulatedThinking = '';
        let currentThinkingIndex = -1;
        let authenticated = false;

        ws.onopen = () => {
          // Authenticate first
          ws.send(JSON.stringify({ type: 'auth', token }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'authenticated') {
              authenticated = true;
              // Send chat message after authentication
              ws.send(JSON.stringify({
                type: 'chat',
                message: userMessage.text,
                model: selectedModel,
                conversationId: currentChatId,
                requireToolApproval: toolApprovalEnabled,
              }));
              return;
            }
            
            if (data.type === 'start') {
              if (data.conversationId && !currentChatId) {
                setCurrentChatId(data.conversationId);
                loadConversations();
              }
            } else if (data.type === 'chunk') {
              accumulatedContent += data.content;
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiMessageId
                    ? { ...msg, text: accumulatedContent }
                    : msg
                )
              );
            } else if (data.type === 'thinking_chunk') {
              accumulatedThinking += data.content;
              setMessages(prev =>
                prev.map(msg => {
                  if (msg.id === aiMessageId) {
                    const thinking = msg.thinking || [];
                    if (currentThinkingIndex === -1) {
                      currentThinkingIndex = thinking.length;
                      return {
                        ...msg,
                        thinking: [...thinking, { 
                          isInternal: true,
                          thinking: accumulatedThinking, 
                          action: '', 
                          toolCalls: [],
                          data: null
                        }]
                      };
                    }
                    const updatedThinking = [...thinking];
                    updatedThinking[currentThinkingIndex] = {
                      ...updatedThinking[currentThinkingIndex],
                      thinking: accumulatedThinking
                    };
                    return { ...msg, thinking: updatedThinking };
                  }
                  return msg;
                })
              );
            } else if (data.type === 'thinking_done') {
              setMessages(prev =>
                prev.map(msg => {
                  if (msg.id === aiMessageId && currentThinkingIndex !== -1) {
                    const thinking = msg.thinking || [];
                    const updatedThinking = [...thinking];
                    updatedThinking[currentThinkingIndex] = {
                      ...data.thinking,
                      thinking: accumulatedThinking
                    };
                    return { ...msg, thinking: updatedThinking };
                  }
                  return msg;
                })
              );
              accumulatedThinking = '';
              currentThinkingIndex = -1;
            } else if (data.type === 'thinking') {
              setMessages(prev =>
                prev.map(msg => {
                  if (msg.id === aiMessageId) {
                    const currentThinking = msg.thinking || [];
                    const newThinking = [...currentThinking, data.thinking];
                    return { 
                      ...msg, 
                      thinking: newThinking
                    };
                  }
                  return msg;
                })
              );
            } else if (data.type === 'tool_confirmation') {
              setPendingToolApproval({
                approvalId: data.approvalId,
                tools: data.tools || [],
              });
              setApprovalExpiresAt(Date.now() + TOOL_APPROVAL_TIMEOUT_MS);
            } else if (data.type === 'done') {
              const finalContent = data.message !== undefined ? data.message : accumulatedContent || '';
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiMessageId
                    ? { 
                        ...msg, 
                        text: finalContent,
                        thinking: data.thinking 
                          ? [...(msg.thinking || []), data.thinking]
                          : msg.thinking,
                        tokenUsage: normalizeTokenUsage(data.usage)
                      }
                    : msg
                )
              );
              
              if (data.conversationId && !currentChatId) {
                setCurrentChatId(data.conversationId);
                loadConversations();
              }
              
              setIsLoading(false);
              ws.close();
              activeWebSocketRef.current = null;
            } else if (data.type === 'error') {
              throw new Error(data.error || 'WebSocket error');
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setMessages(prev =>
            prev.map(msg =>
              msg.id === aiMessageId
                ? { ...msg, text: 'Connection error. Please try again.' }
                : msg
            )
          );
          setIsLoading(false);
          activeWebSocketRef.current = null;
        };

        ws.onclose = () => {
          if (isLoading) {
            setIsLoading(false);
          }
          if (activeWebSocketRef.current === ws) {
            activeWebSocketRef.current = null;
          }
        };

      } catch (error) {
        console.error('Chat error:', error);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === aiMessageId
              ? { 
                  ...msg, 
                  text: `Something went wrong. Please try again.` 
                }
              : msg
          )
        );
        setIsLoading(false);
      }
    }
  };

  const handleSend = async () => {
    await handleSendWithWebSocket(inputText);
  };

  const isDark = colorScheme === 'dark';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={topInset}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => {
              setShowSidebar(true);
              loadConversations(true); // Reload chats when sidebar opens
            }}
          >
            <IconSymbol
              name="line.3.horizontal"
              size={24}
              color={isDark ? '#FFFFFF' : '#000000'}
            />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text
              style={[
                styles.title,
                { color: isDark ? '#4A9EFF' : '#007AFF' },
              ]}
            >
              Bridge AI
            </Text>

            {/* Model Selector temporarily disabled
            <TouchableOpacity
              style={[
                styles.modelSelector,
                {
                  backgroundColor: isDark ? '#151718' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                },
              ]}
              onPress={() => setShowModelPicker(true)}
            >
              <ThemedText style={styles.modelSelectorText}>
                {availableModels.find((m) => m.id === selectedModel)?.name || 'Loading...'}
              </ThemedText>
              <ThemedText style={styles.dropdownIcon}>▼</ThemedText>
            </TouchableOpacity>
            */}
          </View>

          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={startNewChat}
          >
            <IconSymbol
              name="square.and.pencil"
              size={22}
              color={isDark ? '#FFFFFF' : '#000000'}
            />
          </TouchableOpacity>
        </View>

        {/* Sidebar Modal for Chat History */}
        <Modal
          visible={showSidebar}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSidebar(false)}>
          <View style={styles.sidebarOverlay}>
            <View style={[
              styles.sidebar,
              { 
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                paddingTop: topInset + 12,
                paddingBottom: bottomInset,
              },
            ]}>
              <View style={styles.sidebarContent}>
                {/* Sidebar Header */}
                <View style={styles.sidebarHeader}>
                  <View style={styles.sidebarTopBar}>
                    <TouchableOpacity 
                      style={styles.closeIcon}
                      onPress={() => setShowSidebar(false)}>
                      <IconSymbol name="chevron.left" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
                    </TouchableOpacity>
                    <Text style={[
                      styles.sidebarTitle,
                      { color: isDark ? '#4A9EFF' : '#007AFF' }
                    ]}>Bridge AI</Text>
                  </View>
                  <TouchableOpacity 
                    style={[
                      styles.newChatButton,
                      {
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      },
                    ]}
                    onPress={startNewChat}>
                    <IconSymbol name="square.and.pencil" size={18} color={isDark ? '#FFFFFF' : '#000000'} />
                    <ThemedText style={styles.newChatText}>New Chat</ThemedText>
                  </TouchableOpacity>
                </View>

                {/* Chat History List */}
                <ScrollView
                  style={styles.chatList}
                  contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
                >
                  <ThemedText style={styles.chatListTitle}>Recent Chats</ThemedText>
                  
                  {isLoadingChats ? (
                    <View style={styles.emptyChats}>
                      <ActivityIndicator size="small" color="#007AFF" />
                      <ThemedText style={[styles.emptyChatsText, { marginTop: 8 }]}>Loading chats...</ThemedText>
                    </View>
                  ) : chatHistory.length === 0 ? (
                    <View style={styles.emptyChats}>
                      <ThemedText style={styles.emptyChatsText}>No chat history yet</ThemedText>
                    </View>
                  ) : (
                    chatHistory.map((chat) => (
                      <View
                        key={chat.id}
                        style={[
                          styles.chatItem,
                          chat.id === currentChatId && {
                            backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                          },
                        ]}>
                        <View style={styles.chatItemContainer}>
                          <TouchableOpacity 
                            style={styles.chatItemContent}
                            onPress={() => loadChat(chat.id)}
                            activeOpacity={0.7}>
                            <ThemedText style={styles.chatItemTitle} numberOfLines={1}>
                              {chat.title}
                            </ThemedText>
                            <ThemedText style={styles.chatItemDate}>
                              {new Date(chat.lastActive).toLocaleDateString()}
                            </ThemedText>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              if (Platform.OS === 'web') {
                                const confirmed = window.confirm('Are you sure you want to delete this chat?');
                                if (confirmed) {
                                  deleteChat(chat.id);
                                }
                              } else {
                              Alert.alert(
                                'Delete Chat',
                                'Are you sure you want to delete this chat?',
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  { text: 'Delete', style: 'destructive', onPress: () => deleteChat(chat.id) }
                                ]
                              );
                              }
                            }}>
                            <IconSymbol name="trash" size={16} color="#FF3B30" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>

              {/* Profile Section */}
              <View style={[
                styles.profileSection,
                {
                  borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  paddingBottom: bottomInset + 12,
                },
              ]}>
                <TouchableOpacity
                  style={styles.profileButton}
                  onPress={() => setShowProfileMenu(!showProfileMenu)}
                  activeOpacity={0.7}>
                <View style={styles.profilePhotoContainer}>
                    {user?.picture ? (
                  <Image
                        source={{ uri: user.picture }}
                    style={styles.profilePhoto}
                  />
                    ) : (
                      <View style={[
                        styles.profilePhoto,
                        styles.profilePhotoPlaceholder,
                        { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }
                      ]}>
                        <ThemedText style={styles.profileInitial}>
                          {user?.name?.[0]?.toUpperCase() || 'U'}
                        </ThemedText>
                      </View>
                    )}
                </View>
                <View style={styles.profileInfo}>
                    <ThemedText style={styles.profileName} numberOfLines={1}>
                      {user?.name || 'Guest User'}
                    </ThemedText>
                    {!showProfileMenu && (
                      <ThemedText style={styles.profileHint}>Tap to view profile</ThemedText>
                    )}
                </View>
                  <IconSymbol 
                    name={showProfileMenu ? "chevron.down" : "chevron.right"} 
                    size={16} 
                    color={isDark ? '#A0A0A0' : '#666666'} 
                  />
                </TouchableOpacity>

                {/* Expandable Profile Menu */}
                {showProfileMenu && (
                  <View style={[
                    styles.profileMenu,
                    {
                      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }
                  ]}>
                    <View style={styles.profileMenuItem}>
                      <IconSymbol name="envelope" size={16} color={isDark ? '#A0A0A0' : '#666666'} />
                      <ThemedText style={styles.profileMenuText} numberOfLines={1}>
                        {user?.email || 'No email'}
                      </ThemedText>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.logoutButton,
                        {
                          backgroundColor: isDark ? 'rgba(255, 59, 48, 0.1)' : 'rgba(255, 59, 48, 0.05)',
                        }
                      ]}
                      activeOpacity={0.7}
                      onPress={async () => {
                        if (Platform.OS === 'web') {
                          const confirmed = window.confirm('Are you sure you want to logout?');
                          if (confirmed) {
                            await logout();
                            setShowSidebar(false);
                            setShowProfileMenu(false);
                          }
                        } else {
                        Alert.alert(
                          'Logout',
                          'Are you sure you want to logout?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Logout',
                              style: 'destructive',
                              onPress: async () => {
                                await logout();
                                setShowSidebar(false);
                                setShowProfileMenu(false);
                              }
                            }
                          ]
                        );
                        }
                      }}>
                      <IconSymbol name="arrow.right.square" size={16} color="#FF3B30" />
                      <ThemedText style={[styles.logoutButtonText, { color: '#FF3B30' }]}>
                        Logout
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.sidebarBackdrop}
              activeOpacity={1}
              onPress={() => setShowSidebar(false)} />
          </View>
        </Modal>

        {/* Model Picker Modal */}
        <Modal
          visible={showModelPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowModelPicker(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowModelPicker(false)}>
            <View
              style={[
                styles.modalContent,
                { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' },
              ]}>
              <ThemedText style={styles.modalTitle}>Select AI Model</ThemedText>
              <ScrollView style={styles.modalScroll}>
                {['bedrock', 'gemini', 'openrouter'].map((provider) => {
                  const providerModels = availableModels.filter(m => m.provider === provider);
                  if (providerModels.length === 0) return null;
                  
                  const isExpanded = expandedProviders.has(provider);
                  const providerName = provider === 'gemini' ? 'Gemini' : 
                                       provider === 'openrouter' ? 'OpenRouter' : 
                                       'AWS Bedrock';
                  
                  return (
                    <View key={provider} style={styles.providerGroup}>
                      <TouchableOpacity
                        style={[
                          styles.providerHeader,
                          { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' },
                        ]}
                        onPress={() => {
                          const newExpanded = new Set(expandedProviders);
                          if (isExpanded) {
                            newExpanded.delete(provider);
                          } else {
                            newExpanded.add(provider);
                          }
                          setExpandedProviders(newExpanded);
                        }}>
                        <ThemedText style={styles.providerName}>{providerName}</ThemedText>
                        <ThemedText style={styles.expandIcon}>
                          {isExpanded ? '−' : '+'}
                        </ThemedText>
                      </TouchableOpacity>
                      
                      {isExpanded && (
                        <View style={styles.modelsList}>
                          {providerModels.map((model) => (
                            <TouchableOpacity
                              key={model.id}
                              style={[
                                styles.modelOption,
                                { backgroundColor: 'transparent' },
                                selectedModel === model.id && {
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                                },
                                model.tier === 'premium' && styles.modelOptionLocked,
                              ]}
                              onPress={() => selectModel(model.id, model.tier)}>
                              <View style={styles.modelOptionContent}>
                                <ThemedText style={styles.modelOptionName}>
                                  {model.name}
                                </ThemedText>
                                {model.tier && (
                                  <ThemedText style={styles.modelTierText}>
                                    {model.tier === 'free' ? 'Free' : 'Premium'}
                                  </ThemedText>
                                )}
                              </View>
                              {selectedModel === model.id && (
                                <ThemedText style={styles.checkmark}>•</ThemedText>
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={[
                  styles.closeButton,
                  { borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' },
                ]}
                onPress={() => setShowModelPicker(false)}>
                <ThemedText style={styles.closeButtonText}>Close</ThemedText>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <ToolApprovalModal
          visible={!!pendingToolApproval}
          isDark={isDark}
          tools={pendingToolApproval?.tools || []}
          approvalCountdown={approvalCountdown}
          approvalRemainingMs={approvalRemainingMs}
          approvalProgress={approvalProgress}
          approvalColor={approvalColor}
          onApprove={() => submitToolApproval('approve')}
          onReject={() => submitToolApproval('reject')}
          isApproving={isApprovingTool}
        />

        <AIDisclaimerModal
          visible={showAIDisclaimer}
          onUnderstand={handleAIDisclaimerAcknowledge}
        />

        {/* Messages Area */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <GlowingOrb />
              <ThemedText style={styles.emptyText}>
                What's on your mind today?
              </ThemedText>
              <ThemedText style={styles.emptySubtext}>
                Connect integrations to make it more fun!
              </ThemedText>
            </View>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              nestedScrollEnabled={true}
              onContentSizeChange={() => {
                // Only auto-scroll if user is near the bottom (not when interacting with thinking dropdown)
                // This prevents scroll when clicking thinking button
              }}>
              {messages.map((message) => (
                <View key={message.id} style={{ marginBottom: 12 }}>
                  {!message.isUser && message.thinking && message.thinking.length > 0 && (
                    <ThinkingProcess thinking={message.thinking} />
                  )}
                  <View
                  style={[
                    styles.messageBubble,
                    message.isUser ? styles.userMessage : styles.aiMessage,
                    {
                      backgroundColor: message.isUser
                        ? isDark
                          ? '#007AFF'
                          : '#007AFF'
                        : isDark
                        ? '#2C2C2E'
                        : '#F2F2F7',
                    },
                  ]}>
                  <MarkdownText
                    text={message.text}
                    isUser={message.isUser}
                  />
                  </View>
                  {!message.isUser && message.tokenUsage && (
                    <Text
                      style={[
                        styles.tokenUsageText,
                        { color: isDark ? '#9CA3AF' : '#6B7280' },
                      ]}
                    >
                      Token Usage: {typeof message.tokenUsage.totalTokens === 'number' ? message.tokenUsage.totalTokens : '—'}
                    </Text>
                  )}
                  <View
                    style={[
                      styles.messageActions,
                      { alignSelf: message.isUser ? 'flex-end' : 'flex-start' },
                    ]}>
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        { backgroundColor: isDark ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.05)' },
                      ]}
                      onPress={async () => {
                        try {
                          await Clipboard.setStringAsync(message.text);
                          // Show brief feedback
                          Alert.alert('Copied!', 'Message copied to clipboard', [{ text: 'OK' }]);
                        } catch (error) {
                          console.error('Failed to copy:', error);
                          Alert.alert('Error', 'Failed to copy message');
                        }
                      }}
                      activeOpacity={0.7}>
                      <IconSymbol
                        name="doc.on.doc"
                        size={14}
                        color={isDark ? '#9CA3AF' : '#6B7280'}
                      />
                    </TouchableOpacity>
                    {!message.isUser && (
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          { backgroundColor: isDark ? 'rgba(128, 128, 128, 0.1)' : 'rgba(128, 128, 128, 0.05)' },
                        ]}
                        onPress={() => handleRetry(messages.indexOf(message))}
                        activeOpacity={0.7}>
                        <IconSymbol
                          name="arrow.clockwise"
                          size={14}
                          color={isDark ? '#9CA3AF' : '#6B7280'}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              {isLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#007AFF" />
                </View>
              )}
            </ScrollView>
          )}
        </TouchableWithoutFeedback>

        {/* Sample Questions Button - Only shown when chat is new */}
        {messages.length === 0 && (
          <SampleQuestions userId={userId} onQuestionSelect={handleQuestionSelect} />
        )}

        {/* Input Area */}
        <View
          style={[
            styles.inputContainer,
            { 
              borderTopColor: isDark ? '#2C2C2E' : '#E5E5EA',
              backgroundColor: isDark ? '#000000' : '#FFFFFF',
              paddingBottom: inputBottomPadding,
            },
          ]}>
          <View style={styles.webSearchWrapper}>
            <TouchableOpacity
              style={[
                styles.webSearchButton,
                {
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  backgroundColor: showWebSearchMenu
                    ? (isDark ? 'rgba(0, 122, 255, 0.2)' : 'rgba(0, 122, 255, 0.1)')
                    : 'transparent',
                },
                showWebSearchMenu && styles.webSearchButtonActive,
              ]}
              onPress={() => setShowWebSearchMenu(prev => !prev)}
              accessibilityLabel="Toggle web search menu"
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.webSearchPlus,
                  { color: isDark ? '#FFFFFF' : '#000000' },
                ]}
              >
                +
              </Text>
            </TouchableOpacity>

            {showWebSearchMenu && (
              <View
                style={[
                  styles.webSearchMenu,
                  {
                    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.webSearchToggleRow}
                  onPress={() => {
                    setWebSearchEnabled(prev => !prev);
                  }}
                  activeOpacity={0.8}
                >
                  <ThemedText style={styles.webSearchLabel}>Web Search</ThemedText>
                  <View
                    style={[
                      styles.webSearchSwitch,
                      {
                        backgroundColor: webSearchEnabled
                          ? '#34C759'
                          : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.webSearchSwitchKnob,
                        webSearchEnabled && styles.webSearchSwitchKnobOn,
                      ]}
                    />
                  </View>
                </TouchableOpacity>
                <ThemedText style={styles.webSearchHint}>
                  Coming soon
                </ThemedText>
              </View>
            )}
          </View>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                color: isDark ? '#FFFFFF' : '#000000',
              },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => {
              handleSend();
              Keyboard.dismiss();
            }}
            returnKeyType="send"
            blurOnSubmit={false}
            multiline={false}
            onFocus={() => {
              // Scroll to bottom when input is focused (keyboard opens)
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 300);
            }}
          />
          
          {/* Microphone Button */}
          <TouchableOpacity 
            style={[
              styles.micButton,
              isRecording && styles.micButtonRecording,
              (isTranscribing || isLoading) && styles.sendButtonDisabled,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              },
            ]} 
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isLoading || isTranscribing}>
            <IconSymbol 
              name={isRecording ? 'stop.circle.fill' : 'mic.fill'} 
              size={20} 
              color={isDark ? '#FFFFFF' : '#000000'} 
            />
          </TouchableOpacity>

          {/* Send Button */}
          <TouchableOpacity 
            style={[
              styles.sendButton, 
              (isLoading || isRecording || isTranscribing) && styles.sendButtonDisabled,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              },
            ]} 
            onPress={() => {
              handleSend();
              Keyboard.dismiss();
            }}
            disabled={isLoading || isRecording || isTranscribing}>
            <IconSymbol 
              name="arrow.up" 
              size={18} 
              color={isDark ? '#FFFFFF' : '#000000'} 
            />
          </TouchableOpacity>
        </View>
        
        {/* Recording/Transcribing Indicator */}
        {(isRecording || isTranscribing) && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <ThemedText style={styles.recordingText}>
              {isTranscribing ? transcriptionText : (transcriptionText ? `🎤 ${transcriptionText}` : 'Recording...')}
            </ThemedText>
          </View>
        )}
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    position: 'relative',
  },
  hamburgerButton: {
    padding: 8,
  },
  headerIconButton: {
    padding: 8,
  },
  newChatHeaderButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  modelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    columnGap: 8,
  },
  modelSelectorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownIcon: {
    fontSize: 10,
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalScroll: {
    paddingHorizontal: 20,
  },
  providerGroup: {
    marginBottom: 12,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    marginBottom: 2,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '500',
  },
  expandIcon: {
    fontSize: 16,
    opacity: 0.4,
    fontWeight: '300',
  },
  modelsList: {
    paddingLeft: 12,
    paddingRight: 4,
    paddingTop: 4,
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    marginBottom: 2,
  },
  modelOptionLocked: {
    opacity: 0.5,
  },
  modelOptionContent: {
    flex: 1,
  },
  modelOptionName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  modelTierText: {
    fontSize: 12,
    opacity: 0.5,
    fontWeight: '400',
  },
  checkmark: {
    fontSize: 18,
    opacity: 0.7,
    fontWeight: '600',
  },
  closeButton: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '500',
    opacity: 0.7,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 48,
    marginBottom: 12,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.5,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  aiMessage: {
    alignSelf: 'flex-start',
  },
  tokenUsageText: {
    fontSize: 12,
    marginTop: 4,
  },
  messageActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    fontSize: 16,
    minWidth: 0,
  },
  webSearchWrapper: {
    position: 'relative',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  webSearchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webSearchPlus: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 20,
  },
  webSearchButtonActive: {
    borderColor: '#007AFF',
  },
  webSearchMenu: {
    position: 'absolute',
    bottom: 56,
    left: 0,
    width: 220,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 20,
  },
  webSearchToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  webSearchLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  webSearchSwitch: {
    width: 40,
    height: 22,
    borderRadius: 11,
    padding: 2,
    justifyContent: 'center',
  },
  webSearchSwitchKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    transform: [{ translateX: 0 }],
  },
  webSearchSwitchKnobOn: {
    transform: [{ translateX: 18 }],
  },
  webSearchHint: {
    fontSize: 12,
    opacity: 0.6,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  micButtonRecording: {
    borderColor: 'rgba(255, 59, 48, 0.3)',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
  recordingIndicator: {
    position: 'absolute',
    top: -40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'flex-start',
  },
  // Sidebar styles
  sidebarOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  sidebarContent: {
    flex: 1,
  },
  sidebarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebarHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  sidebarTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  closeIcon: {
    padding: 4,
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  newChatText: {
    fontSize: 16,
    fontWeight: '500',
  },
  chatList: {
    flex: 1,
    paddingTop: 16,
  },
  chatListTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    opacity: 0.5,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  emptyChats: {
    padding: 32,
    alignItems: 'center',
  },
  emptyChatsText: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
  },
  chatItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 12,
    marginBottom: 4,
  },
  chatItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chatItemContent: {
    flex: 1,
    gap: 4,
  },
  chatItemTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  chatItemDate: {
    fontSize: 11,
    opacity: 0.5,
  },
  deleteButton: {
    padding: 8,
    zIndex: 10,
    ...(Platform.OS === 'web' && { cursor: 'pointer' as any }),
  },
  profileSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  profilePhotoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
  },
  profilePhotoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 18,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 1,
  },
  profileHint: {
    fontSize: 11,
    opacity: 0.5,
    marginTop: 2,
  },
  profileMenu: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  profileMenuText: {
    fontSize: 13,
    opacity: 0.7,
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 6,
    zIndex: 10,
    ...(Platform.OS === 'web' && { cursor: 'pointer' as any }),
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
