import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getIntegrationMetadata } from '@/components/ui/integrations/metadata';
import { API_ENDPOINTS } from '@/config/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authenticatedFetch } from '@/utils/api';
import { useFocusEffect } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
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
    id: 'google-calendar',
    name: 'Google Calendar',
    type: 'google-calendar',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/512px-Google_Calendar_icon_%282020%29.svg.png?20221106121915',
    description: 'View events, create meetings, manage your calendar, and schedule appointments.',
  },
  {
    id: 'jira',
    name: 'Jira',
    type: 'jira',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Jira_Logo.svg/150px-Jira_Logo.svg.png',
    description: 'Create and manage issues, projects, workflows, and more.',
  },
  {
    id: 'zerodha',
    name: 'Zerodha',
    type: 'zerodha',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Zerodha_logo.svg/150px-Zerodha_logo.svg.png',
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
  {
    id: 'slack',
    name: 'Slack',
    type: 'slack',
    connected: false,
    logo: 'https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png',
    description: 'Send messages, read channels, and manage your workspace.',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    type: 'youtube',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/150px-YouTube_full-color_icon_%282017%29.svg.png',
    description: 'Search videos, manage playlists, and access your YouTube content.',
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    type: 'x',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/X_logo.jpg/1200px-X_logo.jpg',
    description: 'Read and post tweets, search content, manage your X account.',
  },
];

const UPCOMING_INTEGRATIONS: Integration[] = [
  {
    id: 'zomato',
    name: 'Zomato',
    type: 'zomato',
    connected: false,
    logo: 'https://logo.clearbit.com/zomato.com',
    description: 'Discover restaurants, browse menus, create carts, and place food orders.',
  },
  // Existing integrations that were there before
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    type: 'whatsapp',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/150px-WhatsApp.svg.png',
    description: 'Send messages, manage groups, and automate conversations.',
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
  // New D2C integrations
  {
    id: 'instagram',
    name: 'Instagram',
    type: 'instagram',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Instagram_logo_2016.svg/150px-Instagram_logo_2016.svg.png',
    description: 'Post photos, manage stories, and grow your social presence.',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    type: 'telegram',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/150px-Telegram_logo.svg.png',
    description: 'Send messages, manage channels, and interact with bots.',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    type: 'reddit',
    connected: false,
    logo: 'https://www.redditstatic.com/desktop2x/img/favicon/android-icon-192x192.png',
    description: 'Post content, manage subreddits, and engage with communities.',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    type: 'pinterest',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Pinterest-logo.png/150px-Pinterest-logo.png',
    description: 'Pin content, manage boards, and discover visual inspiration.',
  },
  // B2B integrations
  {
    id: 'notion',
    name: 'Notion',
    type: 'notion',
    connected: false,
    logo: 'https://www.notion.so/images/logo-ios.png',
    description: 'Create pages, manage databases, and collaborate on documents.',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    type: 'teams',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg/150px-Microsoft_Office_Teams_%282018%E2%80%93present%29.svg.png',
    description: 'Video calls, chat, file sharing, and enterprise collaboration.',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    type: 'salesforce',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Salesforce.com_logo.svg/150px-Salesforce.com_logo.svg.png',
    description: 'Manage leads, opportunities, and customer relationships.',
  },
  // Food Delivery & Transportation
  {
    id: 'swiggy',
    name: 'Swiggy',
    type: 'swiggy',
    connected: false,
    logo: 'https://logo.clearbit.com/swiggy.com',
    description: 'Order food, track deliveries, and manage your Swiggy account.',
  },
  {
    id: 'uber',
    name: 'Uber',
    type: 'uber',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Uber_logo_2018.png/150px-Uber_logo_2018.png',
    description: 'Book rides, track trips, and manage your Uber account.',
  },
  {
    id: 'ola',
    name: 'Ola',
    type: 'ola',
    connected: false,
    logo: 'https://logo.clearbit.com/olacabs.com',
    description: 'Book cabs, track rides, and manage your Ola account.',
  },
  {
    id: 'zepto',
    name: 'Zepto',
    type: 'zepto',
    connected: false,
    logo: 'https://logo.clearbit.com/zeptonow.com',
    description: 'Order groceries and essentials with 10-minute delivery.',
  },
  {
    id: 'blinkit',
    name: 'Blinkit',
    type: 'blinkit',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Blinkit-yellow-app-icon.svg/150px-Blinkit-yellow-app-icon.svg.png',
    description: 'Quick grocery delivery and daily essentials in minutes.',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    type: 'linkedin',
    connected: false,
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/LinkedIn_logo_initials.png/150px-LinkedIn_logo_initials.png',
    description: 'Manage your professional network, share content, and grow your career.',
  }
];

export default function IntegrationsScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [integrations, setIntegrations] = useState<Integration[]>(AVAILABLE_INTEGRATIONS);
  const [upcomingIntegrations, setUpcomingIntegrations] = useState<Integration[]>(UPCOMING_INTEGRATIONS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [detailsIntegration, setDetailsIntegration] = useState<Integration | null>(null);

  const isDark = colorScheme === 'dark';

  useEffect(() => {
    loadUserIntegrations();
  }, []);

  // Reload integrations when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadUserIntegrations();
    }, [])
  );

  const loadUserIntegrations = async () => {
    try {
      // Use authenticated fetch - token is automatically added to headers
      const response = await authenticatedFetch(`${API_ENDPOINTS.INTEGRATIONS}`);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('❌ Integrations API error:', response.status, text.substring(0, 200));
        throw new Error(`API error: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Non-JSON response:', text.substring(0, 200));
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();
      
      // Update integrations with user's connected status
      // Check both 'configured' and 'isActive' for backwards compatibility
      const updated = AVAILABLE_INTEGRATIONS.map(int => ({
        ...int,
        connected: data.integrations.some((ui: any) => 
          ui.type === int.type && (ui.configured || ui.isActive)
        ),
      }));
      
      // Also update upcoming integrations (for JIRA and Zomato)
      const updatedUpcoming = UPCOMING_INTEGRATIONS.map(int => ({
        ...int,
        connected: data.integrations.some((ui: any) => 
          ui.type === int.type && (ui.configured || ui.isActive)
        ),
      }));
      setIntegrations(updated);
      setUpcomingIntegrations(updatedUpcoming);
    } catch (error) {
      console.error('Error loading integrations:', error);
    }
  };

  const openIntegrationDetails = (integration: Integration) => {
    setDetailsIntegration(integration);
  };

  const closeIntegrationDetails = () => {
    setDetailsIntegration(null);
  };

  const handleAddIntegration = async (integration: Integration) => {
    setSelectedIntegration(integration);
    
    // All integrations use OAuth flow for now
    await handleOAuthFlow(integration);
  };

  const handleConnectFromDetails = async () => {
    if (!detailsIntegration) return;
    await handleAddIntegration(detailsIntegration);
    // Details will remain visible while OAuth flow runs; user can close manually if desired
  };

  const handleDisconnectFromDetails = async () => {
    if (!detailsIntegration) return;
    await handleDisconnect(detailsIntegration);
    closeIntegrationDetails();
  };

  const handleOAuthFlow = async (integration: Integration) => {
    try {
      setIsLoading(true);
      
      // Get OAuth URL from backend (generic endpoint)
      // Use authenticated fetch - token is automatically added to headers
      const response = await authenticatedFetch(`${API_ENDPOINTS.INTEGRATIONS}/${integration.type}/oauth-url`);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('❌ OAuth URL API error:', response.status, text.substring(0, 200));
        throw new Error(`Failed to get OAuth URL: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Non-JSON response from OAuth URL:', text.substring(0, 200));
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();
      
      if (data.authUrl) {
        // Open browser for OAuth
        const supported = await Linking.canOpenURL(data.authUrl);
        if (supported) {
          await Linking.openURL(data.authUrl);
          
          // Start polling for connection status
          const pollInterval = setInterval(async () => {
            try {
              // Use authenticated fetch - token is automatically added to headers
              const integrations = await authenticatedFetch(`${API_ENDPOINTS.INTEGRATIONS}`);
              
              if (!integrations.ok) {
                // Don't log errors during polling - just skip this poll
                return;
              }
              
              const contentType = integrations.headers.get('content-type');
              if (!contentType || !contentType.includes('application/json')) {
                // Don't log errors during polling - just skip this poll
                return;
              }
              
              const integrationsData = await integrations.json();
              
              // Check if this integration is now connected
              const isConnected = integrationsData.integrations.some(
                (int: any) => int.type === integration.type && (int.configured || int.isActive)
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
      
      const message = 'Something went wrong. Please try again.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
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
      // Use authenticated fetch - token is automatically added to headers
      const response = await authenticatedFetch(`${API_ENDPOINTS.INTEGRATIONS}/${integration.type}`, {
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

  const sortedIntegrations = useMemo(() => {
    // Connected integrations go first, fall back to name sorting within groups
    return [...integrations].sort((a, b) => {
      if (a.connected === b.connected) {
        return a.name.localeCompare(b.name);
      }
      return a.connected ? -1 : 1;
    });
  }, [integrations]);

  // Full-screen details "screen" instead of popup when an integration is selected
  if (detailsIntegration) {
    const meta = getIntegrationMetadata(detailsIntegration.type);

    return (
      <ThemedView style={styles.container}>
        <ScrollView style={styles.scrollView}>
          <View style={[styles.header, { paddingTop: insets.top + 12, paddingBottom: 12 }]}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <ThemedText style={styles.title}>Integration details</ThemedText>
              <TouchableOpacity
                onPress={closeIntegrationDetails}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <ThemedText style={styles.closeButtonText}>✕</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.section, { paddingTop: 0 }]}>
            <View
              style={[
                styles.detailsCard,
                { 
                  backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  borderWidth: 1,
                },
              ]}
            >
              <View style={styles.modalHeaderRow}>
                <View style={styles.modalHeaderInfo}>
                  {detailsIntegration.logo ? (
                    <Image
                      source={{ uri: detailsIntegration.logo }}
                      style={[styles.detailsLogo]}
                      resizeMode="contain"
                    />
                  ) : (
                    <ThemedText style={styles.integrationIcon}>🔗</ThemedText>
                  )}
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.modalTitle}>
                      {detailsIntegration.name}
                    </ThemedText>
                    <ThemedText style={styles.modalSubtitle}>
                      {detailsIntegration.type}
                    </ThemedText>
                  </View>
                </View>
              </View>

              <ThemedText style={styles.modalDescription}>
                {detailsIntegration.description}
              </ThemedText>

              {meta && (
                <View style={{ marginTop: 12 }}>
                  <ThemedText style={styles.sectionBadge}>How it works</ThemedText>
                  <ThemedText style={styles.modalDescription}>
                    {meta.howItWorks}
                  </ThemedText>

                  {meta.authNotes && (
                    <>
                      <ThemedText style={[styles.sectionBadge, { marginTop: 16 }]}>
                        Authentication
                      </ThemedText>
                      <ThemedText style={styles.modalDescription}>
                        {meta.authNotes}
                      </ThemedText>
                    </>
                  )}

                  {meta.exceptions && meta.exceptions.length > 0 && (
                    <>
                      <ThemedText style={[styles.sectionBadge, { marginTop: 16 }]}>
                        Special notes
                      </ThemedText>
                      {meta.exceptions.map((note, index) => (
                        <View key={index} style={styles.noteChip}>
                          <View style={styles.noteDot} />
                          <ThemedText style={styles.noteText}>
                            {note}
                          </ThemedText>
                        </View>
                      ))}
                    </>
                  )}

                  {meta.tools && meta.tools.length > 0 && (
                    <>
                      <ThemedText style={[styles.sectionBadge, { marginTop: 16 }]}>
                        Available tools
                      </ThemedText>
                      {meta.tools.map((tool, index) => (
                        <View key={index} style={styles.toolCard}>
                          <ThemedText style={styles.toolName}>
                            {tool.name}
                          </ThemedText>
                          <ThemedText style={styles.toolDescription}>
                            {tool.description}
                          </ThemedText>
                          {tool.importantParams && tool.importantParams.length > 0 && (
                            <ThemedText style={styles.toolParams}>
                              Key parameters:{' '}
                              <ThemedText style={styles.toolParamsHighlight}>
                                {tool.importantParams.join(', ')}
                              </ThemedText>
                            </ThemedText>
                          )}
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}

              <View style={styles.modalFooter}>
                {detailsIntegration.connected ? (
                  <TouchableOpacity
                    style={[styles.button, styles.disconnectButton, { flex: 1 }]}
                    onPress={handleDisconnectFromDetails}
                  >
                    <ThemedText style={styles.disconnectButtonText}>
                      Disconnect
                    </ThemedText>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.button, styles.connectButton, { flex: 1 }]}
                    onPress={handleConnectFromDetails}
                  >
                    <ThemedText style={styles.connectButtonText}>
                      Connect
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <ThemedText style={styles.title}>Integrations</ThemedText>
          <ThemedText style={styles.subtitle}>
            Connect your tools to Bridge AI for powerful integrations
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Available Integrations</ThemedText>

          {sortedIntegrations.map((integration) => (
            <View
              key={integration.id}
              style={[
                styles.integrationCard,
                { 
                  backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  borderWidth: 1,
                },
              ]}>
              <View style={styles.integrationHeader}>
                <TouchableOpacity
                  style={styles.integrationInfo}
                  activeOpacity={0.8}
                  onPress={() => openIntegrationDetails(integration)}
                >
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
                  </View>
                </TouchableOpacity>

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

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => openIntegrationDetails(integration)}
              >
                <ThemedText style={styles.integrationDescription}>
                  {integration.description}
                </ThemedText>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Upcoming Integrations */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Upcoming Integrations</ThemedText>
          <ThemedText style={[styles.subtitle, { marginBottom: 16 }]}>
            These integrations are under development
          </ThemedText>

          {upcomingIntegrations.map((integration) => {
            // Zomato works locally - show connect button
            const isFunctional = integration.type === 'zomato';
            
            return (
              <View
                key={integration.id}
                style={[
                  styles.integrationCard,
                  styles.upcomingCard,
                  { 
                    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 1,
                    opacity: isFunctional ? 1 : 0.6,
                  },
                ]}>
                <View style={styles.integrationHeader}>
                  <TouchableOpacity
                    style={styles.integrationInfo}
                    activeOpacity={0.8}
                    onPress={() => openIntegrationDetails(integration)}
                  >
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
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => openIntegrationDetails(integration)}
                >
                  <ThemedText style={styles.integrationDescription}>
                    {integration.description}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            );
          })}
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
    textAlign: 'center',
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
    textAlign: 'center',
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
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  modalDescription: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 16,
    lineHeight: 22,
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
  sectionBadge: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    color: '#94a3b8',
  },
  noteChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
    marginTop: 4,
  },
  noteDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF3B30',
    marginTop: 6,
    marginRight: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    opacity: 0.8,
    lineHeight: 18,
  },
  toolCard: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  toolName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#0a7ea4',
  },
  toolDescription: {
    fontSize: 13,
    opacity: 0.8,
    lineHeight: 19,
  },
  toolParams: {
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
  toolParamsHighlight: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  detailsLogo: {
    width: 40,
    height: 40,
    borderRadius: 9,
  },
  closeButton: {
    marginLeft: 12,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    opacity: 0.9,
    color: '#FF3B30',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  detailsCard: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  learnMoreButton: {
    marginTop: 8,
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
    // Border is now set dynamically in the component
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

