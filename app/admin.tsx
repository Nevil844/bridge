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
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

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

interface ApprovalUser {
  id: string;
  userId: string;
  username: string;
  email: string;
  plan: string;
  createdAt: string;
  isApproved: boolean;
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
  const [approvals, setApprovals] = useState<ApprovalUser[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);

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

  // Toggle user approval status with confirmation
  const toggleApproval = (user: ApprovalUser) => {
    const action = user.isApproved ? 'ignore' : 'approve';
    const actionText = user.isApproved ? 'Ignore' : 'Approve';
    
    if (Platform.OS === 'web') {
      const confirmed = (typeof window !== 'undefined' && window.confirm) 
        ? window.confirm(
            `Are you sure you want to ${action} ${user.username || user.email}?\n\n` +
            `This will ${user.isApproved ? 'revoke' : 'grant'} access to the app.`
          )
        : confirm(
            `Are you sure you want to ${action} ${user.username || user.email}?\n\n` +
            `This will ${user.isApproved ? 'revoke' : 'grant'} access to the app.`
          );
      if (confirmed) {
        performApprovalToggle(user);
      }
    } else {
      Alert.alert(
        `${actionText} User`,
        `Are you sure you want to ${action} ${user.username || user.email}?\n\n` +
        `This will ${user.isApproved ? 'revoke' : 'grant'} access to the app.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: actionText,
            style: user.isApproved ? 'destructive' : 'default',
            onPress: () => performApprovalToggle(user),
          },
        ]
      );
    }
  };

  // Perform the actual approval toggle
  const performApprovalToggle = async (user: ApprovalUser) => {
    try {
      setIsLoading(true);
      const endpoint = user.isApproved 
        ? API_ENDPOINTS.ADMIN.REMOVE_APPROVAL(user.id)
        : API_ENDPOINTS.ADMIN.APPROVE(user.id);
      
      const method = user.isApproved ? 'DELETE' : 'POST';
      
      const response = await authenticatedFetch(endpoint, {
        method,
      });

      if (response.ok) {
        // Update local state
        setApprovals(approvals.map(a => 
          a.id === user.id ? { ...a, isApproved: !a.isApproved } : a
        ));
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to ${user.isApproved ? 'remove' : 'approve'} user`);
      }
    } catch (error) {
      console.error('Error toggling approval:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update approval';
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
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
        setShowUserModal(true);
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

  // Open user details modal
  const openUserDetails = (user: User) => {
    setSelectedUser(user);
    loadUserDetails(user.id);
  };

  // Close user details modal
  const closeUserModal = () => {
    setShowUserModal(false);
    setSelectedUser(null);
    setUserDetails(null);
  };

  // Open conversation details
  const openConversationDetails = async (conversation: any) => {
    try {
      setIsLoading(true);
      setSelectedConversation(conversation);
      
      // Fetch conversation with messages
      const response = await authenticatedFetch(`${API_ENDPOINTS.CONVERSATIONS}/${conversation.id}`);
      if (response.ok) {
        const convData = await response.json();
        setConversationMessages(convData.messages || []);
        setShowConversationModal(true);
      } else {
        throw new Error('Failed to load conversation');
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      if (Platform.OS === 'web') {
        alert('Failed to load conversation');
      } else {
        Alert.alert('Error', 'Failed to load conversation');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Close conversation modal
  const closeConversationModal = () => {
    setShowConversationModal(false);
    setSelectedConversation(null);
    setConversationMessages([]);
  };

  // Update user plan
  const updateUserPlan = async (userId: string, newPlan: string) => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.UPDATE_USER_PLAN(userId), {
        method: 'PATCH',
        body: JSON.stringify({ plan: newPlan }),
      });

      if (response.ok) {
        // Update local state
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser({ ...selectedUser, plan: newPlan });
        }
        // Update users list
        setUsers(users.map(u => u.id === userId ? { ...u, plan: newPlan } : u));
        
        if (Platform.OS === 'web') {
          // Silent update on web
        } else {
          Alert.alert('Success', 'Plan updated successfully');
        }
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
                    style={[styles.userListItem, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}
                    onPress={() => openUserDetails(user)}>
                    <View style={styles.userListItemContent}>
                      <View style={styles.userListItemLeft}>
                        <ThemedText style={styles.userListItemName}>{user.username || user.email}</ThemedText>
                        <ThemedText style={styles.userListItemEmail}>{user.email}</ThemedText>
                      </View>
                      <View style={styles.userListItemRight}>
                        <View style={[styles.planBadgeSmall, { backgroundColor: '#4a9eff' }]}>
                          <ThemedText style={styles.planBadgeSmallText}>{user.plan.toUpperCase()}</ThemedText>
                        </View>
                        <IconSymbol
                          name="chevron.right"
                          size={16}
                          color={isDark ? '#8E8E93' : '#8E8E93'}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeTab === 'approvals' && (
              <View style={styles.section}>
                {approvals.length === 0 ? (
                  <View style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                    <ThemedText style={styles.emptyText}>No users found</ThemedText>
                  </View>
                ) : (
                  approvals.map((user) => (
                    <View
                      key={user.id}
                      style={[styles.approvalItem, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                      <View style={styles.approvalItemContent}>
                        <View style={styles.approvalItemLeft}>
                          <ThemedText style={styles.approvalItemName}>{user.username || user.email}</ThemedText>
                          <ThemedText style={styles.approvalItemEmail}>{user.email}</ThemedText>
                          <View style={styles.approvalItemMeta}>
                            <View style={[styles.planBadgeSmall, { backgroundColor: '#4a9eff' }]}>
                              <ThemedText style={styles.planBadgeSmallText}>{user.plan.toUpperCase()}</ThemedText>
                            </View>
                            <ThemedText style={styles.approvalItemDate}>
                              Joined: {new Date(user.createdAt).toLocaleDateString()}
                            </ThemedText>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.approvalBadgeButton,
                            { 
                              backgroundColor: user.isApproved ? '#34C759' : '#FF9500',
                              opacity: isLoading ? 0.6 : 1,
                            }
                          ]}
                          onPress={() => toggleApproval(user)}
                          disabled={isLoading}>
                          <ThemedText style={styles.approvalBadgeText}>
                            {user.isApproved ? 'APPROVED' : 'IGNORED'}
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* User Details Modal */}
      <Modal
        visible={showUserModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeUserModal}>
        <ThemedView style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: topInset + 20 }]}>
            <View style={styles.modalHeaderRow}>
              <TouchableOpacity onPress={closeUserModal} style={styles.modalBackButton}>
                <IconSymbol
                  name="chevron.left"
                  size={20}
                  color={isDark ? '#FFFFFF' : '#000000'}
                />
              </TouchableOpacity>
              <ThemedText style={styles.modalTitle}>User Details</ThemedText>
              <View style={styles.placeholder} />
            </View>
          </View>

          {selectedUser && userDetails && (
            <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>
              {/* User Info */}
              <View style={[styles.modalCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                <ThemedText style={styles.modalCardTitle}>User Information</ThemedText>
                <View style={styles.modalInfoRow}>
                  <ThemedText style={styles.modalInfoLabel}>Name:</ThemedText>
                  <ThemedText style={styles.modalInfoValue}>{selectedUser.username || selectedUser.email}</ThemedText>
                </View>
                <View style={styles.modalInfoRow}>
                  <ThemedText style={styles.modalInfoLabel}>Email:</ThemedText>
                  <ThemedText style={styles.modalInfoValue}>{selectedUser.email}</ThemedText>
                </View>
                <View style={styles.modalInfoRow}>
                  <ThemedText style={styles.modalInfoLabel}>Plan:</ThemedText>
                  <View style={[styles.planBadgeSmall, { backgroundColor: '#4a9eff' }]}>
                    <ThemedText style={styles.planBadgeSmallText}>{selectedUser.plan.toUpperCase()}</ThemedText>
                  </View>
                </View>
                <View style={styles.modalInfoRow}>
                  <ThemedText style={styles.modalInfoLabel}>Monthly Credits:</ThemedText>
                  <ThemedText style={styles.modalInfoValue}>{selectedUser.monthlyCredits} (${selectedUser.monthlyCost})</ThemedText>
                </View>
                <View style={styles.modalInfoRow}>
                  <ThemedText style={styles.modalInfoLabel}>Conversations:</ThemedText>
                  <ThemedText style={styles.modalInfoValue}>{selectedUser.conversationCount}</ThemedText>
                </View>
                <View style={styles.modalInfoRow}>
                  <ThemedText style={styles.modalInfoLabel}>Messages:</ThemedText>
                  <ThemedText style={styles.modalInfoValue}>{selectedUser.messageCount}</ThemedText>
                </View>
                <View style={styles.modalInfoRow}>
                  <ThemedText style={styles.modalInfoLabel}>Last Chat:</ThemedText>
                  <ThemedText style={styles.modalInfoValue}>{formatIST(selectedUser.lastChatTimeIST)}</ThemedText>
                </View>
              </View>

              {/* Change Plan */}
              <View style={[styles.modalCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                <ThemedText style={styles.modalCardTitle}>Change Plan</ThemedText>
                <View style={styles.planButtons}>
                  {['free', 'pro', 'power', 'enterprise'].map((plan) => (
                    <TouchableOpacity
                      key={plan}
                      style={[
                        styles.planButton,
                        selectedUser.plan === plan && styles.planButtonActive,
                        { backgroundColor: selectedUser.plan === plan ? '#FF9500' : (isDark ? '#2C2C2E' : '#F2F2F7') },
                      ]}
                      onPress={() => updateUserPlan(selectedUser.id, plan)}>
                      <ThemedText style={[styles.planButtonText, selectedUser.plan === plan && { color: '#FFFFFF' }]}>
                        {plan.toUpperCase()}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Conversations */}
              <View style={[styles.modalCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                <ThemedText style={styles.modalCardTitle}>All Conversations</ThemedText>
                {userDetails.conversations && userDetails.conversations.length > 0 ? (
                  userDetails.conversations.map((conv: any) => (
                    <TouchableOpacity
                      key={conv.id}
                      style={[
                        styles.conversationItemSmall,
                        conv.isDeleted && styles.conversationItemDeleted,
                      ]}
                      onPress={() => openConversationDetails(conv)}>
                      <View style={styles.conversationHeaderSmall}>
                        <ThemedText style={[styles.conversationTitleSmall, conv.isDeleted && { textDecorationLine: 'line-through' }]} numberOfLines={1}>
                          {conv.title}
                        </ThemedText>
                        {conv.isDeleted && (
                          <View style={styles.deletedBadgeSmall}>
                            <ThemedText style={styles.deletedBadgeSmallText}>DELETED</ThemedText>
                          </View>
                        )}
                      </View>
                      <ThemedText style={styles.conversationMetaSmall}>
                        {conv.messageCount} messages • {formatIST(conv.lastActive)}
                      </ThemedText>
                    </TouchableOpacity>
                  ))
                ) : (
                  <ThemedText style={styles.emptyText}>No conversations</ThemedText>
                )}
              </View>
            </ScrollView>
          )}
        </ThemedView>
      </Modal>

      {/* Conversation Details Modal */}
      <Modal
        visible={showConversationModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeConversationModal}>
        <ThemedView style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: topInset + 20 }]}>
            <View style={styles.modalHeaderRow}>
              <TouchableOpacity onPress={closeConversationModal} style={styles.modalBackButton}>
                <IconSymbol
                  name="chevron.left"
                  size={20}
                  color={isDark ? '#FFFFFF' : '#000000'}
                />
              </TouchableOpacity>
              <ThemedText style={styles.modalTitle} numberOfLines={1}>
                {selectedConversation?.title || 'Conversation'}
              </ThemedText>
              <View style={styles.placeholder} />
            </View>
          </View>

          {selectedConversation && (
            <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>
              {/* Conversation Info */}
              <View style={[styles.modalCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                <View style={styles.modalInfoRow}>
                  <ThemedText style={styles.modalInfoLabel}>Title:</ThemedText>
                  <ThemedText style={styles.modalInfoValue}>{selectedConversation.title}</ThemedText>
                </View>
                <View style={styles.modalInfoRow}>
                  <ThemedText style={styles.modalInfoLabel}>Messages:</ThemedText>
                  <ThemedText style={styles.modalInfoValue}>{conversationMessages.length}</ThemedText>
                </View>
                <View style={styles.modalInfoRow}>
                  <ThemedText style={styles.modalInfoLabel}>Last Active:</ThemedText>
                  <ThemedText style={styles.modalInfoValue}>{formatIST(selectedConversation.lastActive)}</ThemedText>
                </View>
                {selectedConversation.isDeleted && (
                  <View style={[styles.deletedBadgeSmall, { alignSelf: 'flex-start', marginTop: 8 }]}>
                    <ThemedText style={styles.deletedBadgeSmallText}>DELETED</ThemedText>
                  </View>
                )}
              </View>

              {/* Messages */}
              <View style={[styles.modalCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                <ThemedText style={styles.modalCardTitle}>Messages</ThemedText>
                {conversationMessages.length > 0 ? (
                  conversationMessages.map((message: any, index: number) => (
                    <View
                      key={message.id || index}
                      style={[
                        styles.messageItem,
                        message.role === 'user' ? styles.messageItemUser : styles.messageItemAssistant,
                        { backgroundColor: message.role === 'user' ? (isDark ? '#2C2C2E' : '#F2F2F7') : (isDark ? '#1C1C1E' : '#FFFFFF') }
                      ]}>
                      <View style={styles.messageHeader}>
                        <ThemedText style={styles.messageRole}>
                          {message.role === 'user' ? '👤 User' : '🤖 Assistant'}
                        </ThemedText>
                        <ThemedText style={styles.messageTime}>
                          {new Date(message.createdAt).toLocaleString()}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.messageContent}>{message.content}</ThemedText>
                    </View>
                  ))
                ) : (
                  <ThemedText style={styles.emptyText}>No messages</ThemedText>
                )}
              </View>
            </ScrollView>
          )}
        </ThemedView>
      </Modal>
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
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 30,
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
    fontSize: 14,
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
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
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
    fontSize: 14,
    fontWeight: 'bold',
    width: 30,
    opacity: 0.5,
  },
  topUserInfo: {
    flex: 1,
    marginLeft: 8,
  },
  topUserName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  topUserPlan: {
    fontSize: 11,
    opacity: 0.7,
  },
  topUserCredits: {
    alignItems: 'flex-end',
  },
  topUserCreditsValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF9500',
  },
  topUserCreditsLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  userListItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  userListItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userListItemLeft: {
    flex: 1,
  },
  userListItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userListItemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  userListItemEmail: {
    fontSize: 12,
    opacity: 0.7,
  },
  planBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  planBadgeSmallText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
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
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalBackButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  modalCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalInfoLabel: {
    fontSize: 13,
    opacity: 0.7,
  },
  modalInfoValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  conversationItemSmall: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    marginBottom: 8,
  },
  conversationItemDeleted: {
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  conversationHeaderSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationTitleSmall: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  deletedBadgeSmall: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    marginLeft: 6,
  },
  deletedBadgeSmallText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  conversationMetaSmall: {
    fontSize: 11,
    opacity: 0.7,
  },
  // Approval styles
  approvalItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  approvalItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  approvalItemLeft: {
    flex: 1,
  },
  approvalItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  approvalItemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  approvalItemEmail: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 6,
  },
  approvalItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  approvalItemDate: {
    fontSize: 11,
    opacity: 0.6,
  },
  approvalBadgeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Message styles
  messageItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.2)',
  },
  messageItemUser: {
    borderLeftWidth: 3,
    borderLeftColor: '#4a9eff',
  },
  messageItemAssistant: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF9500',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageRole: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
  messageTime: {
    fontSize: 11,
    opacity: 0.6,
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 20,
  },
});

