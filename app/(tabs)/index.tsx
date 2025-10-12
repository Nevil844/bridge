import { GlowingOrb } from '@/components/glowing-orb';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_ENDPOINTS } from '@/config/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

interface Model {
  id: string;
  name: string;
}

const AVAILABLE_MODELS: Model[] = [
  { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  { id: 'openai/gpt-4', name: 'GPT-4' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
  { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet' },
  { id: 'google/gemini-pro', name: 'Gemini Pro' },
  { id: 'meta-llama/llama-3-8b-instruct', name: 'Llama 3 8B' },
];

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-3.5-turbo');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [mcpConnected, setMcpConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadSelectedModel();
    checkMCPStatus();
    
    // Refresh MCP status when screen comes into focus
    const interval = setInterval(checkMCPStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkMCPStatus = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId') || 'default-user';
      const response = await fetch(`${API_ENDPOINTS.MCP_STATUS}?userId=${userId}`);
      const data = await response.json();
      setMcpConnected(data.connected);
    } catch (error) {
      console.error('Error checking MCP status:', error);
      setMcpConnected(false);
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

  const selectModel = async (modelId: string) => {
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
      console.log('Requesting audio permissions...');
      const permission = await Audio.requestPermissionsAsync();
      
      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant microphone permission to use voice input.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('Starting recording...');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      console.log('Stopping recording...');
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        console.log('Recording saved to', uri);
        await transcribeAudio(uri);
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const transcribeAudio = async (audioUri: string) => {
    try {
      setIsLoading(true);
      const userId = await AsyncStorage.getItem('userId') || 'default-user';

      // Create form data
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      formData.append('userId', userId);

      const response = await fetch(`${API_ENDPOINTS.CHAT}/transcribe`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.text) {
        // Set the transcribed text and send it
        setInputText(data.text);
        // Auto-send after transcription
        setTimeout(() => {
          handleSendWithText(data.text);
        }, 100);
      } else {
        Alert.alert('Error', 'Failed to transcribe audio');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      Alert.alert('Error', 'Failed to transcribe audio');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendWithText = async (text: string) => {
    if (text.trim() && !isLoading) {
      const userMessage: Message = {
        id: Date.now().toString(),
        text: text,
        isUser: true,
      };
      
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInputText('');
      setIsLoading(true);

      try {
        const userId = await AsyncStorage.getItem('userId') || 'default-user';
        const response = await fetch(API_ENDPOINTS.CHAT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: text,
            model: selectedModel,
            userId,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: data.message,
            isUser: false,
          };
          setMessages([...newMessages, aiMessage]);
        } else {
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: `Error: ${data.error || 'Failed to get response'}`,
            isUser: false,
          };
          setMessages([...newMessages, errorMessage]);
        }
      } catch (error) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: 'Error: Could not connect to server. Make sure the backend is running.',
          isUser: false,
        };
        setMessages([...newMessages, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSend = async () => {
    if (inputText.trim() && !isLoading) {
      const userMessage: Message = {
        id: Date.now().toString(),
        text: inputText,
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
        const userId = await AsyncStorage.getItem('userId') || 'default-user';
        const response = await fetch(API_ENDPOINTS.CHAT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({
            message: userMessage.text,
            model: selectedModel,
            userId,
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  continue;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || '';
                  if (content) {
                    accumulatedText += content;
                    // Update message in real-time
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === aiMessageId 
                          ? { ...msg, text: accumulatedText }
                          : msg
                      )
                    );
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        }

        if (!accumulatedText) {
          throw new Error('No response received');
        }

      } catch (error) {
        console.error('Chat error:', error);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === aiMessageId
              ? { ...msg, text: 'Error: Could not connect to server. Make sure the backend is running.' }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isDark = colorScheme === 'dark';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={0}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>AI Assistant</ThemedText>
          
          {/* MCP Status Badge */}
          {mcpConnected && (
            <View style={styles.mcpBadge}>
              <View style={styles.mcpDot} />
              <ThemedText style={styles.mcpText}>MCP Connected</ThemedText>
            </View>
          )}
          
          {/* Model Selector */}
          <TouchableOpacity
            style={[
              styles.modelSelector,
              { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
            ]}
            onPress={() => setShowModelPicker(true)}>
            <ThemedText style={styles.modelSelectorText}>
              {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.name || 'Select Model'}
            </ThemedText>
            <ThemedText style={styles.dropdownIcon}>▼</ThemedText>
          </TouchableOpacity>
        </View>

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
                {AVAILABLE_MODELS.map((model) => (
                  <TouchableOpacity
                    key={model.id}
                    style={[
                      styles.modelOption,
                      selectedModel === model.id && {
                        backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
                      },
                    ]}
                    onPress={() => selectModel(model.id)}>
                    <View>
                      <ThemedText style={styles.modelOptionName}>
                        {model.name}
                      </ThemedText>
                      <ThemedText style={styles.modelOptionId}>
                        {model.id}
                      </ThemedText>
                    </View>
                    {selectedModel === model.id && (
                      <ThemedText style={styles.checkmark}>✓</ThemedText>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowModelPicker(false)}>
                <ThemedText style={styles.closeButtonText}>Close</ThemedText>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Messages Area */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <GlowingOrb />
                <ThemedText style={styles.emptyText}>
                  How can I help you today?
                </ThemedText>
                <ThemedText style={styles.emptySubtext}>
                  {mcpConnected 
                    ? '✓ Connected to GitHub MCP' 
                    : 'Connect integrations to get started'}
                </ThemedText>
              </View>
            ) : (
              messages.map((message) => (
                <View
                  key={message.id}
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
                  <ThemedText
                    style={[
                      styles.messageText,
                      message.isUser && { color: '#FFFFFF' },
                    ]}>
                    {message.text}
                  </ThemedText>
                </View>
              ))
            )}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>

        {/* Input Area */}
        <View
          style={[
            styles.inputContainer,
            { 
              borderTopColor: isDark ? '#2C2C2E' : '#E5E5EA',
              backgroundColor: isDark ? '#000000' : '#FFFFFF',
            },
          ]}>
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
          />
          
          {/* Microphone Button */}
          <TouchableOpacity 
            style={[
              styles.micButton,
              isRecording && styles.micButtonRecording,
            ]} 
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isLoading}>
            <IconSymbol 
              name={isRecording ? 'stop.circle.fill' : 'mic.fill'} 
              size={24} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>

          {/* Send Button */}
          <TouchableOpacity 
            style={[styles.sendButton, (isLoading || isRecording) && styles.sendButtonDisabled]} 
            onPress={() => {
              handleSend();
              Keyboard.dismiss();
            }}
            disabled={isLoading || isRecording}>
            <ThemedText style={styles.sendButtonText}>↑</ThemedText>
          </TouchableOpacity>
        </View>
        
        {/* Recording Indicator */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <ThemedText style={styles.recordingText}>Recording...</ThemedText>
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
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  mcpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 8,
  },
  mcpDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  mcpText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
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
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  modelOptionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modelOptionId: {
    fontSize: 12,
    opacity: 0.5,
  },
  checkmark: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  closeButton: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingBottom: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 32,
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
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  aiMessage: {
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    gap: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    fontSize: 16,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonRecording: {
    backgroundColor: '#FF3B30',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
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
});
