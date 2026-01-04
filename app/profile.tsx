import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_ENDPOINTS } from '@/config/api';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaPadding } from '@/hooks/use-safe-area-padding';
import { authenticatedFetch } from '@/utils/api';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const { topInset, bottomInset } = useSafeAreaPadding({ top: 16, bottom: 24 });
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isDeletingChats, setIsDeletingChats] = useState(false);

  const handleDeleteAllChats = async () => {
    // Show confirmation
    const confirmed = Platform.OS === 'web' 
      ? window.confirm('Are you sure you want to delete all your chats? This action cannot be undone.')
      : await new Promise(resolve => {
          Alert.alert(
            'Delete All Chats',
            'Are you sure you want to delete all your chats? This action cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });
    
    if (!confirmed) return;

    try {
      setIsDeletingChats(true);
      const response = await authenticatedFetch(API_ENDPOINTS.CONVERSATIONS, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete chats: ${response.status}`);
      }

      const data = await response.json();
      
      if (Platform.OS === 'web') {
        alert(`Successfully deleted ${data.deletedCount || 0} chats!`);
      } else {
        Alert.alert('Success', `Successfully deleted ${data.deletedCount || 0} chats!`);
      }
    } catch (error) {
      console.error('Error deleting chats:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete chats';
      if (Platform.OS === 'web') {
        alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setIsDeletingChats(false);
    }
  };

  const handleLogout = async () => {
    const confirmed = Platform.OS === 'web' 
      ? window.confirm('Are you sure you want to log out?')
      : await new Promise(resolve => {
          Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Log Out', onPress: () => resolve(true) },
            ]
          );
        });
    
    if (!confirmed) return;

    try {
      await logout();
      // The app will automatically show login screen when user is null
      // Force reload to ensure auth state is properly cleared
      if (Platform.OS === 'web') {
        window.location.reload();
      } else {
        // Don't navigate - let the auth system handle the redirect to login
        // The _layout.tsx will detect isAuthenticated=false and show login screen
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };


  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
      >
        <View style={[styles.header, { paddingTop: topInset + 20 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}>
              <IconSymbol
                name="chevron.left"
                size={24}
                color={isDark ? '#FFFFFF' : '#000000'}
              />
            </TouchableOpacity>
            <ThemedText style={styles.title}>Profile</ThemedText>
            <View style={styles.placeholder} />
          </View>
        </View>

        {/* Profile Info Section */}
        <View style={styles.section}>
          <View
            style={[
              styles.profileCard,
              { 
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
              },
            ]}>
            <View style={styles.profileHeader}>
              {user?.picture ? (
                <Image
                  source={{ uri: user.picture }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={[styles.profileImagePlaceholder, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
                  <ThemedText style={styles.profileInitial}>
                    {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                  </ThemedText>
                </View>
              )}
              <View style={styles.profileInfo}>
                <ThemedText style={styles.profileName}>
                  {user?.name || 'User'}
                </ThemedText>
                <ThemedText style={styles.profileEmail}>
                  {user?.email || 'No email'}
                </ThemedText>
                {user?.plan && (
                  <View style={styles.planBadge}>
                    <ThemedText style={styles.planText}>
                      {user.plan.toUpperCase()} Plan
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { 
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
              },
            ]}
            onPress={handleDeleteAllChats}
            disabled={isDeletingChats}>
            <IconSymbol
              name="trash"
              size={24}
              color={isDark ? '#FF3B30' : '#FF3B30'}
            />
            <View style={styles.actionButtonText}>
              <ThemedText style={styles.actionButtonTitle}>
                Delete All Chats
              </ThemedText>
              <ThemedText style={styles.actionButtonSubtitle}>
                {isDeletingChats ? 'Deleting...' : 'Permanently delete all your conversations'}
              </ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              { 
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                borderWidth: 1,
              },
            ]}
            onPress={handleLogout}
            disabled={isDeletingChats}>
            <IconSymbol
              name="arrow.right.square"
              size={24}
              color={isDark ? '#FFFFFF' : '#000000'}
            />
            <View style={styles.actionButtonText}>
              <ThemedText style={styles.actionButtonTitle}>
                Log Out
              </ThemedText>
              <ThemedText style={styles.actionButtonSubtitle}>
                Sign out of your account
              </ThemedText>
            </View>
          </TouchableOpacity>

        </View>
      </ScrollView>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  placeholder: {
    width: 32,
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  profileCard: {
    borderRadius: 12,
    padding: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 32,
    fontWeight: 'bold',
    opacity: 0.7,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  planBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#4a9eff',
  },
  planText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  dangerButton: {
    borderColor: '#FF3B30',
  },
  actionButtonText: {
    marginLeft: 12,
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionButtonSubtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
  dangerText: {
    color: '#FF3B30',
  },
});

