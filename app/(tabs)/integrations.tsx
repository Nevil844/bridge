import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { API_ENDPOINTS } from '@/config/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Integration {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  logo?: string;
  description: string;
}

interface UserIntegration {
  id: string;
  type: string;
  name: string;
  configured: boolean;
}

const AVAILABLE_INTEGRATIONS: Integration[] = [
  {
    id: 'github',
    name: 'GitHub',
    type: 'github',
    connected: false,
    logo: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
    description: 'Access repositories, read code, search projects, and more.',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    type: 'google-drive',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Google_Drive_logo.png/240px-Google_Drive_logo.png',
    description: 'Search files, list documents, and access your Google Drive.',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    type: 'gmail',
    connected: false,
    logo: 'https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png',
    description: 'Read, send, search, and manage your Gmail emails.',
  },
  {
    id: 'zerodha',
    name: 'Zerodha',
    type: 'zerodha',
    connected: false,
    logo: 'https://zerodha.com/static/images/logo.svg',
    description: 'Access your portfolio, market data, and trading insights.',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    type: 'spotify',
    connected: false,
    logo: 'https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png',
    description: 'Control playback, manage playlists, and search music.',
  },
];

const UPCOMING_INTEGRATIONS: Integration[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    type: 'whatsapp',
    connected: false,
    logo: 'https://cdn-icons-png.flaticon.com/512/733/733585.png',
    description: 'Send messages, manage contacts, and automate conversations.',
  },
  {
    id: 'aws',
    name: 'AWS',
    type: 'aws',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Amazon_Web_Services_Logo.svg/300px-Amazon_Web_Services_Logo.svg.png',
    description: 'Manage your AWS infrastructure and cloud resources.',
  },
  {
    id: 'discord',
    name: 'Discord',
    type: 'discord',
    connected: false,
    logo: 'https://cdn-icons-png.flaticon.com/512/5968/5968756.png',
    description: 'Manage servers, channels, and send messages on Discord.',
  },
];

export default function IntegrationsScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [integrations, setIntegrations] = useState<Integration[]>(AVAILABLE_INTEGRATIONS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isDark = colorScheme === 'dark';

  useEffect(() => {
    loadUserIntegrations();
  }, []);

  const loadUserIntegrations = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId') || 'default-user';
      const response = await fetch(`${API_ENDPOINTS.INTEGRATIONS}?userId=${userId}`);
      const data = await response.json();
      
      console.log('📡 User integrations from API:', data.integrations);
      
      // Update integrations with user's connected status
      const updated = AVAILABLE_INTEGRATIONS.map(int => ({
        ...int,
        connected: data.integrations.some((ui: UserIntegration) => ui.type === int.type && ui.configured),
      }));
      
      console.log('✅ Updated integrations state:', updated);
      setIntegrations(updated);
    } catch (error) {
      console.error('Error loading integrations:', error);
    }
  };

  const handleAddIntegration = async (integration: Integration) => {
    setSelectedIntegration(integration);
    
    // All integrations use OAuth flow for now
    await handleOAuthFlow(integration);
  };

  const handleOAuthFlow = async (integration: Integration) => {
    try {
      setIsLoading(true);
      const userId = await AsyncStorage.getItem('userId') || 'default-user';
      
      // Get OAuth URL from backend (generic endpoint)
      const response = await fetch(`${API_ENDPOINTS.INTEGRATIONS}/${integration.type}/oauth-url?userId=${userId}`);
      const data = await response.json();
      
      if (data.authUrl) {
        // Open browser for OAuth
        const supported = await Linking.canOpenURL(data.authUrl);
        if (supported) {
          await Linking.openURL(data.authUrl);
          
          // Start polling for connection status
          const pollInterval = setInterval(async () => {
            try {
              const integrations = await fetch(`${API_ENDPOINTS.INTEGRATIONS}?userId=${userId}`);
              const integrationsData = await integrations.json();
              
              // Check if this integration is now connected
              const isConnected = integrationsData.integrations.some(
                (int: any) => int.type === integration.type && int.configured
              );
              
              if (isConnected) {
                clearInterval(pollInterval);
                await loadUserIntegrations();
                setIsLoading(false);
                
                // Show success message
                if (Platform.OS === 'web') {
                  alert(`${integration.name} connected successfully!`);
                } else {
                  Alert.alert('Success', `${integration.name} connected successfully!`);
                }
              }
            } catch (error) {
              // Silently continue polling
            }
          }, 2000); // Poll every 2 seconds
          
          // Stop polling after 2 minutes (timeout)
          setTimeout(() => {
            clearInterval(pollInterval);
            setIsLoading(false);
          }, 120000);
          
          // Show instructions (web-compatible)
          if (Platform.OS === 'web') {
            // Browser will open in new tab
          } else {
            Alert.alert(
              `Authorize ${integration.name}`,
              'Complete the authorization in your browser, then come back to the app.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => {
                    clearInterval(pollInterval);
                    setIsLoading(false);
                  },
                },
              ]
            );
          }
        }
      }
    } catch (error) {
      console.error('OAuth error:', error);
      
      if (Platform.OS === 'web') {
        alert('Failed to start OAuth. Make sure the backend is running.');
      } else {
        Alert.alert('Error', 'Failed to start OAuth. Make sure the backend is running.');
      }
      
      setIsLoading(false);
    }
  };

  const handleDisconnect = async (integration: Integration) => {
    
    // Use window.confirm for web compatibility (Alert.alert doesn't work on web)
    const confirmed = Platform.OS === 'web' 
      ? window.confirm(`Are you sure you want to disconnect ${integration.name}?`)
      : await new Promise(resolve => {
          Alert.alert(
            'Disconnect Integration',
            `Are you sure you want to disconnect ${integration.name}?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Disconnect', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });
    
    if (!confirmed) {
      return;
    }
    
    try {
      const userId = await AsyncStorage.getItem('userId') || 'default-user';
      
      const response = await fetch(`${API_ENDPOINTS.INTEGRATIONS}/${integration.type}?userId=${userId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to disconnect: ${response.status}`);
      }
      
      // Reload integrations to update UI
      await loadUserIntegrations();
      
      // Show success message
      if (Platform.OS === 'web') {
        alert(`${integration.name} disconnected successfully!`);
      } else {
        Alert.alert('Success', `${integration.name} disconnected successfully`);
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      
      if (Platform.OS === 'web') {
        alert(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } else {
        Alert.alert('Error', `Failed to disconnect integration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <ThemedText style={styles.title}>Integrations</ThemedText>
          <ThemedText style={styles.subtitle}>
            Connect AI assistants to your tools and data
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Available Integrations</ThemedText>

          {integrations.map((integration) => (
            <View
              key={integration.id}
              style={[
                styles.integrationCard,
                { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' },
              ]}>
              <View style={styles.integrationHeader}>
                <View style={styles.integrationInfo}>
                  {integration.logo ? (
                    <Image
                      source={{ uri: integration.logo }}
                      style={styles.integrationLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <ThemedText style={styles.integrationIcon}>🔗</ThemedText>
                  )}
                  <View>
                    <ThemedText style={styles.integrationName}>
                      {integration.name}
                    </ThemedText>
                    <ThemedText style={styles.integrationStatus}>
                      {integration.connected ? '✓ Connected' : 'Not connected'}
                    </ThemedText>
                  </View>
                </View>

                {integration.connected ? (
                  <TouchableOpacity
                    style={[styles.button, styles.disconnectButton]}
                    onPress={() => handleDisconnect(integration)}>
                    <ThemedText style={styles.disconnectButtonText}>
                      Disconnect
                    </ThemedText>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.button, styles.connectButton]}
                    onPress={() => handleAddIntegration(integration)}>
                    <ThemedText style={styles.connectButtonText}>
                      Connect
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>

              <ThemedText style={styles.integrationDescription}>
                {integration.description}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Upcoming Integrations */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Coming Soon</ThemedText>
          <ThemedText style={[styles.subtitle, { marginBottom: 16 }]}>
            These integrations are under development
          </ThemedText>

          {UPCOMING_INTEGRATIONS.map((integration) => (
            <View
              key={integration.id}
              style={[
                styles.integrationCard,
                styles.upcomingCard,
                { 
                  backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                  opacity: 0.6,
                },
              ]}>
              <View style={styles.integrationHeader}>
                <View style={styles.integrationInfo}>
                  {integration.logo ? (
                    <Image
                      source={{ uri: integration.logo }}
                      style={styles.integrationLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <ThemedText style={styles.integrationIcon}>🔗</ThemedText>
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ThemedText style={styles.integrationName}>
                        {integration.name}
                      </ThemedText>
                      <View style={[
                        styles.comingSoonBadge,
                        { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }
                      ]}>
                        <ThemedText style={styles.comingSoonText}>
                          Coming Soon
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.integrationStatus}>
                      In development
                    </ThemedText>
                  </View>
                </View>
              </View>

              <ThemedText style={styles.integrationDescription}>
                {integration.description}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.infoSection}>
          <ThemedText style={styles.infoTitle}>How it works</ThemedText>
          <View
            style={[
              styles.infoBox,
              { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' },
            ]}>
            <ThemedText style={styles.infoText}>
              • Connect your tools to give AI access to your data
            </ThemedText>
            <ThemedText style={styles.infoText}>
              • Integrations use MCP (Model Context Protocol)
            </ThemedText>
            <ThemedText style={styles.infoText}>
              • Your credentials are stored securely
            </ThemedText>
            <ThemedText style={styles.infoText}>
              • Enable/disable anytime
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={[
            styles.loadingBox,
            { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' },
          ]}>
            <ActivityIndicator size="large" color="#007AFF" />
            <ThemedText style={styles.loadingText}>Connecting...</ThemedText>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.6,
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  integrationCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  integrationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  integrationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  integrationLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  integrationIcon: {
    fontSize: 32,
  },
  integrationName: {
    fontSize: 18,
    fontWeight: '600',
  },
  integrationStatus: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
  integrationDescription: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 8,
    lineHeight: 20,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  connectButton: {
    backgroundColor: '#007AFF',
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  disconnectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  disconnectButtonText: {
    color: '#FF3B30',
    fontWeight: '600',
    fontSize: 14,
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoBox: {
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 24,
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 20,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 12,
  },
  linkButton: {
    marginBottom: 16,
  },
  linkButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  smallText: {
    fontSize: 12,
    opacity: 0.5,
    marginBottom: 4,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  upcomingCard: {
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    opacity: 0.7,
  },
});

