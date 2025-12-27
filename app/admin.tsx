import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_ENDPOINTS } from '@/config/api';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaPadding } from '@/hooks/use-safe-area-padding';
import { authenticatedFetch } from '@/utils/api';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

const ADMIN_EMAIL = 'neviljobanputra34@gmail.com';

interface DashboardStats {
  totalCost: string;
  totalCredits: string;
  currentMonth: string;
  activeUsers: {
    today: number;
    week: number;
    month: number;
  };
  topUsers: Array<{
    userId: string;
    username: string;
    email: string;
    plan: string;
    totalCredits: string;
    cost: string;
  }>;
}

interface User {
  id: string;
  username: string;
  email: string;
  plan: string;
  createdAt: string;
  conversationCount: number;
  messageCount: number;
  integrationCount: number;
  lastChatTime: string | null;
  lastChatTimeIST: string | null;
  monthlyCredits: string;
  monthlyCost: string;
}

export default function AdminScreen() {
  const colorScheme = useColorScheme();
  const { topInset, bottomInset } = useSafeAreaPadding({ top: 16, bottom: 24 });
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'approvals'>('dashboard');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [approvals, setApprovals] = useState<any[]>([]);

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin && user) {
      // Only redirect if user is loaded and not admin
      // Don't redirect if user is still loading
      router.back();
    }
  }, [isAdmin, user, router]);

  // Load dashboard stats
  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.DASHBOARD);
      if (response.ok) {
        const stats = await response.json();
        setDashboardStats(stats);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Dashboard API error:', response.status, errorData);
        throw new Error(errorData.error || `Failed to load dashboard: ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load dashboard';
      if (Platform.OS === 'web') {
        alert(`Failed to load dashboard: ${errorMessage}`);
      } else {
        Alert.alert('Error', `Failed to load dashboard: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load users
  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(`${API_ENDPOINTS.ADMIN.USERS}?includeDeleted=true`);
      if (response.ok) {
        const usersData = await response.json();
        setUsers(usersData);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Users API error:', response.status, errorData);
        throw new Error(errorData.error || `Failed to load users: ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load users';
      if (Platform.OS === 'web') {
        alert(`Failed to load users: ${errorMessage}`);
      } else {
        Alert.alert('Error', `Failed to load users: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load approvals
  const loadApprovals = async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.APPROVALS);
      if (response.ok) {
        const approvalsData = await response.json();
        setApprovals(Array.isArray(approvalsData) ? approvalsData : []);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Approvals API error:', response.status, errorData);
        throw new Error(errorData.error || `Failed to load approvals: ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading approvals:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load approvals';
      // Set empty array on error so UI doesn't break
      setApprovals([]);
      if (Platform.OS === 'web') {
        console.warn(`Failed to load approvals: ${errorMessage}`);
      } else {
        Alert.alert('Warning', `Approvals not available: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when tab changes
  useEffect(() => {
    if (!isAdmin) return;
    
    if (activeTab === 'dashboard') {
      loadDashboard();
    } else if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'approvals') {
      loadApprovals();
    }
  }, [activeTab, isAdmin]);

  // Load user details
  const loadUserDetails = async (userId: string) => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.USER_DETAILS(userId));
      if (response.ok) {
        const details = await response.json();
        setUserDetails(details);
      } else {
        throw new Error('Failed to load user details');
      }
    } catch (error) {
      console.error('Error loading user details:', error);
      if (Platform.OS === 'web') {
        alert('Failed to load user details');
      } else {
        Alert.alert('Error', 'Failed to load user details');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Update user plan
  const updateUserPlan = async (userId: string, newPlan: string) => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.UPDATE_USER_PLAN(userId), {
        method: 'PATCH',
        body: JSON.stringify({ plan: newPlan }),
      });

      if (response.ok) {
        if (Platform.OS === 'web') {
          alert('Plan updated successfully');
        } else {
          Alert.alert('Success', 'Plan updated successfully');
        }
        loadUsers(); // Reload users
      } else {
        throw new Error('Failed to update plan');
      }
    } catch (error) {
      console.error('Error updating plan:', error);
      if (Platform.OS === 'web') {
        alert('Failed to update plan');
      } else {
        Alert.alert('Error', 'Failed to update plan');
      }
    }
  };

  // Format IST time
  const formatIST = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  };

  if (!isAdmin) {
    return null;
  }

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
            <ThemedText style={styles.title}>Admin Dashboard</ThemedText>
            <View style={styles.placeholder} />
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'dashboard' && styles.activeTab,
              { borderBottomColor: activeTab === 'dashboard' ? '#FF9500' : 'transparent' },
            ]}
            onPress={() => setActiveTab('dashboard')}>
            <ThemedText style={[styles.tabText, activeTab === 'dashboard' && { color: '#FF9500', fontWeight: '600' }]}>
              Dashboard
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'users' && styles.activeTab,
              { borderBottomColor: activeTab === 'users' ? '#FF9500' : 'transparent' },
            ]}
            onPress={() => setActiveTab('users')}>
            <ThemedText style={[styles.tabText, activeTab === 'users' && { color: '#FF9500', fontWeight: '600' }]}>
              Users
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'approvals' && styles.activeTab,
              { borderBottomColor: activeTab === 'approvals' ? '#FF9500' : 'transparent' },
            ]}
            onPress={() => setActiveTab('approvals')}>
            <ThemedText style={[styles.tabText, activeTab === 'approvals' && { color: '#FF9500', fontWeight: '600' }]}>
              Approvals
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF9500" />
          </View>
        ) : (
          <>
            {activeTab === 'dashboard' && dashboardStats && (
              <View style={styles.section}>
                {/* Total Cost */}
                <View style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                  <ThemedText style={styles.cardTitle}>Total Monthly Cost</ThemedText>
                  <ThemedText style={[styles.cardValue, { color: '#FF9500' }]}>
                    ${dashboardStats?.totalCost || '0.00'}
                  </ThemedText>
                  <ThemedText style={styles.cardSubtitle}>
                    {dashboardStats?.totalCredits || '0.00'} credits ({dashboardStats?.currentMonth || 'N/A'})
                  </ThemedText>
                </View>

                {/* Active Users */}
                <View style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                  <ThemedText style={styles.cardTitle}>Active Users</ThemedText>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <ThemedText style={styles.statValue}>{dashboardStats.activeUsers.today}</ThemedText>
                      <ThemedText style={styles.statLabel}>Today</ThemedText>
                    </View>
                    <View style={styles.statItem}>
                      <ThemedText style={styles.statValue}>{dashboardStats.activeUsers.week}</ThemedText>
                      <ThemedText style={styles.statLabel}>This Week</ThemedText>
                    </View>
                    <View style={styles.statItem}>
                      <ThemedText style={styles.statValue}>{dashboardStats.activeUsers.month}</ThemedText>
                      <ThemedText style={styles.statLabel}>This Month</ThemedText>
                    </View>
                  </View>
                </View>

                {/* Top Users */}
                <View style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                  <ThemedText style={styles.cardTitle}>Top Users by Credits</ThemedText>
                  {dashboardStats.topUsers.map((topUser, index) => (
                    <View key={topUser.userId} style={styles.topUserItem}>
                      <ThemedText style={styles.topUserRank}>#{index + 1}</ThemedText>
                      <View style={styles.topUserInfo}>
                        <ThemedText style={styles.topUserName}>{topUser.username || topUser.email}</ThemedText>
                        <ThemedText style={styles.topUserPlan}>{topUser.plan}</ThemedText>
                      </View>
                      <View style={styles.topUserCredits}>
                        <ThemedText style={styles.topUserCreditsValue}>${topUser.cost}</ThemedText>
                        <ThemedText style={styles.topUserCreditsLabel}>{topUser.totalCredits} credits</ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {activeTab === 'users' && (
              <View style={styles.section}>
                {users.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={[styles.userCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}
                    onPress={() => {
                      if (selectedUser?.id === user.id) {
                        setSelectedUser(null);
                        setUserDetails(null);
                      } else {
                        setSelectedUser(user);
                        loadUserDetails(user.id);
                      }
                    }}>
                    <View style={styles.userCardHeader}>
                      <View>
                        <ThemedText style={styles.userName}>{user.username || user.email}</ThemedText>
                        <ThemedText style={styles.userEmail}>{user.email}</ThemedText>
                        <View style={styles.userBadges}>
                          <View style={[styles.planBadge, { backgroundColor: '#4a9eff' }]}>
                            <ThemedText style={styles.planBadgeText}>{user.plan.toUpperCase()}</ThemedText>
                          </View>
                        </View>
                      </View>
                      <IconSymbol
                        name={selectedUser?.id === user.id ? 'chevron.up' : 'chevron.down'}
                        size={20}
                        color={isDark ? '#8E8E93' : '#8E8E93'}
                      />
                    </View>

                    {selectedUser?.id === user.id && (
                      <View style={styles.userDetails}>
                        <View style={styles.userDetailRow}>
                          <ThemedText style={styles.userDetailLabel}>Monthly Credits:</ThemedText>
                          <ThemedText style={styles.userDetailValue}>
                            {user.monthlyCredits} (${user.monthlyCost})
                          </ThemedText>
                        </View>
                        <View style={styles.userDetailRow}>
                          <ThemedText style={styles.userDetailLabel}>Conversations:</ThemedText>
                          <ThemedText style={styles.userDetailValue}>{user.conversationCount}</ThemedText>
                        </View>
                        <View style={styles.userDetailRow}>
                          <ThemedText style={styles.userDetailLabel}>Messages:</ThemedText>
                          <ThemedText style={styles.userDetailValue}>{user.messageCount}</ThemedText>
                        </View>
                        <View style={styles.userDetailRow}>
                          <ThemedText style={styles.userDetailLabel}>Last Chat (IST):</ThemedText>
                          <ThemedText style={styles.userDetailValue}>{formatIST(user.lastChatTimeIST)}</ThemedText>
                        </View>

                        <View style={styles.planSelector}>
                          <ThemedText style={styles.planSelectorLabel}>Change Plan:</ThemedText>
                          <View style={styles.planButtons}>
                            {['free', 'pro', 'power', 'enterprise'].map((plan) => (
                              <TouchableOpacity
                                key={plan}
                                style={[
                                  styles.planButton,
                                  user.plan === plan && styles.planButtonActive,
                                  { backgroundColor: user.plan === plan ? '#FF9500' : (isDark ? '#2C2C2E' : '#F2F2F7') },
                                ]}
                                onPress={() => updateUserPlan(user.id, plan)}>
                                <ThemedText style={[styles.planButtonText, user.plan === plan && { color: '#FFFFFF' }]}>
                                  {plan.toUpperCase()}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        {userDetails && (
                          <View style={styles.conversationsSection}>
                            <ThemedText style={styles.conversationsTitle}>All Conversations (Including Deleted)</ThemedText>
                            {userDetails.conversations && userDetails.conversations.length > 0 ? (
                              userDetails.conversations.map((conv: any) => (
                                <View key={conv.id} style={[styles.conversationItem, conv.isDeleted && { opacity: 0.5 }]}>
                                  <View style={styles.conversationHeader}>
                                    <ThemedText style={[styles.conversationTitle, conv.isDeleted && { textDecorationLine: 'line-through' }]}>
                                      {conv.title}
                                    </ThemedText>
                                    {conv.isDeleted && (
                                      <View style={styles.deletedBadge}>
                                        <ThemedText style={styles.deletedBadgeText}>DELETED</ThemedText>
                                      </View>
                                    )}
                                  </View>
                                  <ThemedText style={styles.conversationMeta}>
                                    {conv.messageCount} messages • {formatIST(conv.lastActive)}
                                  </ThemedText>
                                </View>
                              ))
                            ) : (
                              <ThemedText style={styles.emptyText}>No conversations</ThemedText>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeTab === 'approvals' && (
              <View style={styles.section}>
                <View style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                  <ThemedText style={styles.cardTitle}>Approvals</ThemedText>
                  {approvals.length === 0 ? (
                    <ThemedText style={styles.emptyText}>No pending approvals</ThemedText>
                  ) : (
                    <ThemedText style={styles.emptyText}>Approval system coming soon</ThemedText>
                  )}
                </View>
              </View>
            )}
          </>
        )}
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
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
    paddingHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    borderBottomWidth: 2,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 16,
    opacity: 0.7,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  card: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  topUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.1)',
  },
  topUserRank: {
    fontSize: 18,
    fontWeight: 'bold',
    width: 40,
    opacity: 0.5,
  },
  topUserInfo: {
    flex: 1,
    marginLeft: 12,
  },
  topUserName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  topUserPlan: {
    fontSize: 12,
    opacity: 0.7,
  },
  topUserCredits: {
    alignItems: 'flex-end',
  },
  topUserCreditsValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF9500',
  },
  topUserCreditsLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  userCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  userBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.1)',
  },
  userDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  userDetailLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  userDetailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  planSelector: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.1)',
  },
  planSelectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  planButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  planButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  planButtonActive: {
    backgroundColor: '#FF9500',
  },
  planButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
    padding: 20,
  },
  conversationsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.1)',
  },
  conversationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  conversationItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    marginBottom: 8,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  deletedBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  deletedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  conversationMeta: {
    fontSize: 12,
    opacity: 0.7,
  },
});

