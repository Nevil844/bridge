import { GlowingOrb } from '@/components/glowing-orb';
import { MarkdownText } from '@/components/markdown-text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThinkingProcess } from '@/components/thinking-process';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_ENDPOINTS } from '@/config/api';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
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

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  thinking?: ThinkingData; // Add thinking data for AI messages
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
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('anthropic.claude-sonnet-4-5-20250929-v1:0'); // Default to Claude Sonnet 4.5
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{id: string, title: string, lastActive: string, messageCount: number}>>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('default-user');
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set(['gemini', 'bedrock'])); // Default expand Gemini and Bedrock
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadUserId();
    loadSelectedModel();
    loadAvailableModels();
    cleanupOldData(); // Remove old AsyncStorage data
  }, []);

  const loadUserId = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      // Only use stored userId if it exists and is not default-user
      if (storedUserId && storedUserId !== 'default-user') {
      setUserId(storedUserId);
      } else {
        // If no valid userId, use the one from useAuth hook
        if (user?.id) {
          setUserId(user.id);
        } else {
          setUserId('default-user');
        }
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
  const loadConversations = useCallback(async () => {
    try {
      if (!userId) return; // Wait for userId to load
      const response = await fetch(`${API_ENDPOINTS.CONVERSATIONS}?userId=${userId}`);
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
      const response = await fetch(`${API_ENDPOINTS.CONVERSATIONS}/${conversationId}?userId=${userId}`);
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
      const response = await fetch(`${API_ENDPOINTS.CONVERSATIONS}/${chatId}?userId=${userId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Reload conversations list
        await loadConversations();
        
        if (chatId === currentChatId) {
          startNewChat();
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      Alert.alert('Error', 'Failed to delete conversation');
    }
  };

  // Clean up old AsyncStorage data
  const cleanupOldData = async () => {
    try {
      await AsyncStorage.removeItem('chatHistory');
      console.log('✅ Cleaned up old chat history from AsyncStorage');
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
      // Show immediate feedback
      setInputText('🎤 Transcribing...');
      
      // userId is already in state from loadUserId()

      // Create form data - handle web and mobile differently
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        // For web: fetch the audio file and create a File object
        try {
          const response = await fetch(audioUri);
          const blob = await response.blob();
          const file = new File([blob], 'recording.m4a', { type: 'audio/m4a' });
          formData.append('audio', file);
        } catch (fetchError) {
          console.error('Failed to fetch audio file:', fetchError);
          // Fallback: try to use the URI directly (might work for some cases)
          formData.append('audio', audioUri as any);
        }
      } else {
        // For mobile (React Native): use the object format
        formData.append('audio', {
          uri: audioUri,
          type: 'audio/m4a',
          name: 'recording.m4a',
        } as any);
      }
      
      formData.append('userId', userId);

      const startTime = Date.now();
      const response = await fetch(`${API_ENDPOINTS.CHAT}/transcribe`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let FormData set it automatically with boundary
      });

      const data = await response.json();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (response.ok && data.text) {
        // Set the transcribed text and send it
        setInputText(data.text);
        console.log(`✅ Transcription completed in ${duration}s`);
        // Auto-send after transcription
        setTimeout(() => {
          handleSendWithText(data.text);
        }, 100);
      } else {
        setInputText('');
        Alert.alert('Error', data.error || 'Failed to transcribe audio');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setInputText('');
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
        const response = await fetch(API_ENDPOINTS.CHAT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: text,
            model: selectedModel,
            userId,
            conversationId: currentChatId,
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
          
          // Update conversationId if this was a new conversation
          if (data.conversationId && !currentChatId) {
            setCurrentChatId(data.conversationId);
            await loadConversations();
          }
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
        const response = await fetch(API_ENDPOINTS.CHAT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage.text,
            model: selectedModel,
            userId,
            conversationId: currentChatId, // Pass conversationId to continue existing or create new
            stream: false, // Use non-streaming for reliability
          }),
        });

        // Handle quota exceeded (429)
        if (response.status === 429) {
          const errorData = await response.json();
          
          // Show quota exceeded alert
          Alert.alert(
            'Quota Exceeded',
            errorData.message || 'You have exceeded your monthly token limit.',
            [
              { text: 'OK', style: 'cancel' },
              { text: 'View Usage', onPress: () => {
                // Navigate to settings to see usage
                // @ts-ignore - navigation exists in tab context
                navigation?.navigate?.('settings');
              }},
              { text: 'Upgrade Plan', onPress: () => {
                // Navigate to pricing
                // @ts-ignore - navigation exists in tab context
                navigation?.navigate?.('pricing');
              }},
            ]
          );
          
          // Update messages to show error
          setMessages(prev =>
            prev.map(msg =>
              msg.id === aiMessageId
                ? { ...msg, text: `⚠️ ${errorData.message}\n\nYou've used ${errorData.usage?.percentage || '100'}% of your ${errorData.usage?.plan || 'free'} plan.\n\nPlease upgrade or wait until next month.` }
                : msg
            )
          );
          
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Response error:', errorText);
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        const aiMessage = data.message || data.content;
        
        if (!aiMessage) {
          console.error('No message in response:', data);
          throw new Error('No response received from AI');
        }

        // Update AI message with actual response (including thinking data)
        setMessages(prev =>
          prev.map(msg =>
            msg.id === aiMessageId
              ? { ...msg, text: aiMessage, thinking: data.thinking || undefined }
              : msg
          )
        );
        
        // Update conversationId if this was a new conversation
        if (data.conversationId && !currentChatId) {
          setCurrentChatId(data.conversationId);
          // Reload conversations list to show the new one
          await loadConversations();
        }

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
          {/* Hamburger Menu */}
          <TouchableOpacity 
            style={styles.hamburgerButton}
            onPress={() => setShowSidebar(true)}>
            <IconSymbol name="line.3.horizontal" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={[
              styles.title,
              { color: isDark ? '#4A9EFF' : '#007AFF' }
            ]}>Bridge AI</Text>
            
            {/* Model Selector */}
            <TouchableOpacity
              style={[
                styles.modelSelector,
                { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
              ]}
              onPress={() => setShowModelPicker(true)}>
              <ThemedText style={styles.modelSelectorText}>
                {availableModels.find((m) => m.id === selectedModel)?.name || 'Loading...'}
              </ThemedText>
              <ThemedText style={styles.dropdownIcon}>▼</ThemedText>
            </TouchableOpacity>
          </View>

          {/* New Chat Button */}
          <TouchableOpacity 
            style={styles.newChatHeaderButton}
            onPress={startNewChat}>
            <IconSymbol name="square.and.pencil" size={22} color={isDark ? '#FFFFFF' : '#000000'} />
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
              { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' },
            ]}>
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
              <ScrollView style={styles.chatList}>
                <ThemedText style={styles.chatListTitle}>Recent Chats</ThemedText>
                
                {chatHistory.length === 0 ? (
                  <View style={styles.emptyChats}>
                    <ThemedText style={styles.emptyChatsText}>No chat history yet</ThemedText>
                  </View>
                ) : (
                  chatHistory.map((chat) => (
                    <TouchableOpacity
                      key={chat.id}
                      style={[
                        styles.chatItem,
                        chat.id === currentChatId && {
                          backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                        },
                      ]}
                      onPress={() => loadChat(chat.id)}>
                      <View style={styles.chatItemContainer}>
                        <View style={styles.chatItemContent}>
                          <ThemedText style={styles.chatItemTitle} numberOfLines={1}>
                            {chat.title}
                          </ThemedText>
                          <ThemedText style={styles.chatItemDate}>
                            {new Date(chat.lastActive).toLocaleDateString()}
                          </ThemedText>
                        </View>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            Alert.alert(
                              'Delete Chat',
                              'Are you sure you want to delete this chat?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => deleteChat(chat.id) }
                              ]
                            );
                          }}>
                          <IconSymbol name="trash" size={16} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              {/* Profile Section */}
              <View style={[
                styles.profileSection,
                {
                  borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
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
                      onPress={async () => {
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
                {['gemini', 'openrouter', 'bedrock'].map((provider) => {
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
                  {!message.isUser && message.thinking && (
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
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              },
            ]} 
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isLoading}>
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
              (isLoading || isRecording) && styles.sendButtonDisabled,
              {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              },
            ]} 
            onPress={() => {
              handleSend();
              Keyboard.dismiss();
            }}
            disabled={isLoading || isRecording}>
            <IconSymbol 
              name="arrow.up" 
              size={18} 
              color={isDark ? '#FFFFFF' : '#000000'} 
            />
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
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    position: 'relative',
  },
  hamburgerButton: {
    position: 'absolute',
    left: 16,
    top: 64,
    padding: 8,
    zIndex: 10,
  },
  newChatHeaderButton: {
    position: 'absolute',
    right: 16,
    top: 64,
    padding: 8,
    zIndex: 10,
    opacity: 0.7,
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
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
    backgroundColor: 'transparent',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingTop: 60,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
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
  },
  profileSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
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
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
