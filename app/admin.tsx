import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_ENDPOINTS } from '@/config/api';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaPadding } from '@/hooks/use-safe-area-padding';
import { authenticatedFetch } from '@/utils/api';
import { formatISTDate, getCronNextOccurrences } from '@/utils/cronParser';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

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
  id: string; // Waitlist entry ID
  email: string;
  isApproved: boolean;
  createdAt: string;
  userId: string | null; // User ID if user exists
  username: string | null; // Username if user exists
  plan: string | null; // Plan if user exists
}

export default function AdminScreen() {
  const colorScheme = useColorScheme();
  const { topInset, bottomInset } = useSafeAreaPadding({ top: 16, bottom: 24 });
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'approvals' | 'integrations' | 'notifications'>('dashboard');
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
  const [userIsAdmin, setUserIsAdmin] = useState<boolean>(false);
  const [integrationSettings, setIntegrationSettings] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeCronNotifications, setActiveCronNotifications] = useState<any[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<any[]>([]);
  const [pendingOneTimeNotifications, setPendingOneTimeNotifications] = useState<any[]>([]);
  const [activeCronSkip, setActiveCronSkip] = useState(0);
  const [historySkip, setHistorySkip] = useState(0);
  const [pendingOneTimeSkip, setPendingOneTimeSkip] = useState(0);
  const [activeCronHasMore, setActiveCronHasMore] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [pendingOneTimeHasMore, setPendingOneTimeHasMore] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);
  const [expandedSentUsersId, setExpandedSentUsersId] = useState<string | null>(null);
  const [loadingSentUsers, setLoadingSentUsers] = useState<Record<string, boolean>>({});
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [allUsersList, setAllUsersList] = useState<User[]>([]);
  const [sentUsersMap, setSentUsersMap] = useState<Record<string, User[]>>({});
  const [cronNextOccurrences, setCronNextOccurrences] = useState<Date[]>([]);
  const [editingNotificationId, setEditingNotificationId] = useState<string | null>(null);
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    type: 'push',
    targetType: 'all',
    targetValue: '',
    scheduledFor: '',
    cronExpression: '',
    scheduleType: 'datetime', // 'datetime' or 'cron'
  });

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) return;
      
      try {
        // Try to access admin endpoint - if successful, user is admin
        const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.ADMINS);
        if (response.ok) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          // Redirect if not admin and user is loaded
          if (user) {
            router.back();
          }
        }
      } catch (error) {
        setIsAdmin(false);
        // Redirect if not admin and user is loaded
        if (user) {
          router.back();
        }
      }
    };

    checkAdminStatus();
  }, [user, router]);

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

  // Load integration settings
  const loadIntegrationSettings = async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.INTEGRATIONS);
      if (response.ok) {
        const settings = await response.json();
        setIntegrationSettings(settings);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Integration settings API error:', response.status, errorData);
        throw new Error(errorData.error || `Failed to load integration settings: ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading integration settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load integration settings';
      setIntegrationSettings([]);
      if (Platform.OS === 'web') {
        console.warn(`Failed to load integration settings: ${errorMessage}`);
      } else {
        Alert.alert('Warning', `Integration settings not available: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle integration enabled status
  const toggleIntegration = async (provider: string, currentStatus: boolean) => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.UPDATE_INTEGRATION(provider), {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !currentStatus }),
      });

      if (response.ok) {
        // Update local state
        setIntegrationSettings(integrationSettings.map(setting =>
          setting.provider === provider
            ? { ...setting, isEnabled: !currentStatus }
            : setting
        ));
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to update integration: ${response.status}`);
      }
    } catch (error) {
      console.error('Error toggling integration:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update integration';
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle waitlist approval status with confirmation
  const toggleApproval = (waitlistEntry: ApprovalUser) => {
    const action = waitlistEntry.isApproved ? 'ignore' : 'approve';
    const actionText = waitlistEntry.isApproved ? 'Ignore' : 'Approve';
    const displayName = waitlistEntry.username || waitlistEntry.email;
    
    if (Platform.OS === 'web') {
      const confirmed = (typeof window !== 'undefined' && window.confirm) 
        ? window.confirm(
            `Are you sure you want to ${action} ${displayName}?\n\n` +
            `This will ${waitlistEntry.isApproved ? 'revoke' : 'grant'} access to the app.`
          )
        : confirm(
            `Are you sure you want to ${action} ${displayName}?\n\n` +
            `This will ${waitlistEntry.isApproved ? 'revoke' : 'grant'} access to the app.`
          );
      if (confirmed) {
        performApprovalToggle(waitlistEntry);
      }
    } else {
      Alert.alert(
        `${actionText} Waitlist Entry`,
        `Are you sure you want to ${action} ${displayName}?\n\n` +
        `This will ${waitlistEntry.isApproved ? 'revoke' : 'grant'} access to the app.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: actionText,
            style: waitlistEntry.isApproved ? 'destructive' : 'default',
            onPress: () => performApprovalToggle(waitlistEntry),
          },
        ]
      );
    }
  };

  // Perform the actual approval toggle
  const performApprovalToggle = async (waitlistEntry: ApprovalUser) => {
    try {
      setIsLoading(true);
      const endpoint = waitlistEntry.isApproved 
        ? API_ENDPOINTS.ADMIN.REMOVE_APPROVAL(waitlistEntry.id)
        : API_ENDPOINTS.ADMIN.APPROVE(waitlistEntry.id);
      
      const method = waitlistEntry.isApproved ? 'DELETE' : 'POST';
      
      const response = await authenticatedFetch(endpoint, {
        method,
      });

      if (response.ok) {
        // Update local state
        setApprovals(approvals.map(a => 
          a.id === waitlistEntry.id ? { ...a, isApproved: !a.isApproved } : a
        ));
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to ${waitlistEntry.isApproved ? 'remove' : 'approve'} waitlist entry`);
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

  // Load notifications (separated by cron and one-time)
  const loadNotifications = async (reset = false) => {
    try {
      setIsLoading(true);
      
      if (reset) {
        setActiveCronSkip(0);
        setHistorySkip(0);
        setPendingOneTimeSkip(0);
        setActiveCronNotifications([]);
        setNotificationHistory([]);
        setPendingOneTimeNotifications([]);
      }

      // Load all notifications and separate them - add cache busting to avoid 304
      const cacheBuster = `?skip=0&take=1000&_t=${Date.now()}`;
      const response = await authenticatedFetch(`${API_ENDPOINTS.ADMIN.NOTIFICATIONS}${cacheBuster}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
      
      if (response.ok) {
        let data;
        try {
          const text = await response.text();
          data = text ? JSON.parse(text) : { notifications: [] };
        } catch (e) {
          data = { notifications: [] };
        }
        
        // Handle both response formats: { notifications, total, hasMore } or just array
        const allNotifications = Array.isArray(data.notifications) 
          ? data.notifications 
          : (Array.isArray(data) ? data : []);
        
        // Separate into: active cron, history (sent), and pending one-time
        const activeCron = allNotifications.filter((n: any) => {
          const metadata = n.metadata || {};
          const hasCron = metadata && metadata.cronExpression;
          const cronEnabled = metadata.cronEnabled !== false; // Default to true if not set
          // Active cron = has cron expression AND enabled (regardless of status - cron stays in cron section)
          return hasCron && cronEnabled;
        });
        
        const history = allNotifications.filter((n: any) => {
          const metadata = n.metadata || {};
          const hasCron = metadata && metadata.cronExpression;
          // History = sent notifications that are NOT cron (cron executions create separate entries)
          return n.status === 'sent' && !hasCron;
        });
        
        const pendingOneTime = allNotifications.filter((n: any) => {
          const metadata = n.metadata || {};
          const hasCron = metadata && metadata.cronExpression;
          // Pending one-time = no cron AND (pending or sending)
          return !hasCron && (n.status === 'pending' || n.status === 'sending');
        });

        // Always set notifications - if reset or empty, show first 5
        if (reset || activeCronNotifications.length === 0) {
          setActiveCronNotifications(activeCron.slice(0, 5));
          setNotificationHistory(history.slice(0, 5));
          setPendingOneTimeNotifications(pendingOneTime.slice(0, 5));
          setActiveCronSkip(5);
          setHistorySkip(5);
          setPendingOneTimeSkip(5);
          setActiveCronHasMore(activeCron.length > 5);
          setHistoryHasMore(history.length > 5);
          setPendingOneTimeHasMore(pendingOneTime.length > 5);
        }

        // Combine for backward compatibility
        setNotifications(allNotifications);
      } else {
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load notifications';
      setActiveCronNotifications([]);
      setNotificationHistory([]);
      setPendingOneTimeNotifications([]);
      setNotifications([]);
      if (Platform.OS === 'web') {
        console.warn(`Failed to load notifications: ${errorMessage}`);
      } else {
        Alert.alert('Warning', `Notifications not available: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Load more active cron notifications
  const loadMoreActiveCron = async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(`${API_ENDPOINTS.ADMIN.NOTIFICATIONS}?skip=0&take=1000&_t=${Date.now()}`);
      if (response.ok) {
        const text = await response.text();
        const data = text ? JSON.parse(text) : { notifications: [] };
        const allNotifications = Array.isArray(data.notifications) ? data.notifications : (Array.isArray(data) ? data : []);
        const activeCron = allNotifications.filter((n: any) => {
          const metadata = n.metadata || {};
          const hasCron = metadata && metadata.cronExpression;
          const cronEnabled = metadata.cronEnabled !== false; // Default to true if not set
          // Active cron = has cron expression AND enabled (regardless of status)
          return hasCron && cronEnabled;
        });
        const nextBatch = activeCron.slice(activeCronSkip, activeCronSkip + 5);
        setActiveCronNotifications(prev => [...prev, ...nextBatch]);
        setActiveCronSkip(prev => prev + 5);
        setActiveCronHasMore(activeCronSkip + 5 < activeCron.length);
      }
    } catch (error) {
      console.error('Error loading more active cron notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load more history notifications
  const loadMoreHistory = async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(`${API_ENDPOINTS.ADMIN.NOTIFICATIONS}?skip=0&take=1000&_t=${Date.now()}`);
      if (response.ok) {
        const text = await response.text();
        const data = text ? JSON.parse(text) : { notifications: [] };
        const allNotifications = Array.isArray(data.notifications) ? data.notifications : (Array.isArray(data) ? data : []);
        const history = allNotifications.filter((n: any) => n.status === 'sent');
        const nextBatch = history.slice(historySkip, historySkip + 5);
        setNotificationHistory(prev => [...prev, ...nextBatch]);
        setHistorySkip(prev => prev + 5);
        setHistoryHasMore(historySkip + 5 < history.length);
      }
    } catch (error) {
      console.error('Error loading more history notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load more pending one-time notifications
  const loadMorePendingOneTime = async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(`${API_ENDPOINTS.ADMIN.NOTIFICATIONS}?skip=0&take=1000&_t=${Date.now()}`);
      if (response.ok) {
        const text = await response.text();
        const data = text ? JSON.parse(text) : { notifications: [] };
        const allNotifications = Array.isArray(data.notifications) ? data.notifications : (Array.isArray(data) ? data : []);
        const pendingOneTime = allNotifications.filter((n: any) => {
          const metadata = n.metadata || {};
          return !metadata || !metadata.cronExpression && (n.status === 'pending' || n.status === 'sending');
        });
        const nextBatch = pendingOneTime.slice(pendingOneTimeSkip, pendingOneTimeSkip + 5);
        setPendingOneTimeNotifications(prev => [...prev, ...nextBatch]);
        setPendingOneTimeSkip(prev => prev + 5);
        setPendingOneTimeHasMore(pendingOneTimeSkip + 5 < pendingOneTime.length);
      }
    } catch (error) {
      console.error('Error loading more pending one-time notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load users list for selection
  const loadUsersForSelection = async () => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.USERS);
      if (response.ok) {
        const usersData = await response.json();
        setAllUsersList(Array.isArray(usersData) ? usersData : []);
      }
    } catch (error) {
      console.error('Error loading users for selection:', error);
    }
  };

  // Load sent users for a notification
  const loadSentUsers = async (notificationId: string, userIds: string[]) => {
    if (sentUsersMap[notificationId] || loadingSentUsers[notificationId]) {
      return; // Already loaded or loading
    }

    if (!userIds || userIds.length === 0) {
      // No users to load
      setSentUsersMap(prev => ({
        ...prev,
        [notificationId]: [],
      }));
      return;
    }

    try {
      setLoadingSentUsers(prev => ({ ...prev, [notificationId]: true }));
      
      // Fetch user details for each user ID
      const userPromises = userIds.map(async (userId) => {
        try {
          const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.USER_DETAILS(userId));
          if (response.ok) {
            const userData = await response.json();
            return {
              id: userData.id,
              username: userData.username,
              email: userData.email,
            };
          } else {
            console.error(`Failed to load user ${userId}:`, response.status);
            return null;
          }
        } catch (error) {
          console.error(`Error loading user ${userId}:`, error);
          return null;
        }
      });

      const users = (await Promise.all(userPromises)).filter(u => u !== null) as User[];
      setSentUsersMap(prev => ({
        ...prev,
        [notificationId]: users,
      }));
    } catch (error) {
      console.error('Error loading sent users:', error);
      setSentUsersMap(prev => ({
        ...prev,
        [notificationId]: [],
      }));
    } finally {
      setLoadingSentUsers(prev => {
        const updated = { ...prev };
        delete updated[notificationId];
        return updated;
      });
    }
  };

  // Handle replay to notification
  const handleReplay = (notification: any) => {
    const metadata = notification.metadata || {};
    setNotificationForm({
      title: notification.title, // No "Re:" prefix
      message: notification.message,
      type: 'push',
      targetType: notification.targetType,
      targetValue: notification.targetValue || '',
      scheduledFor: '',
      cronExpression: metadata.cronExpression || '',
      scheduleType: metadata.cronExpression ? 'cron' : 'datetime',
    });
    if (notification.targetType === 'specific' && notification.targetValue) {
      const userIds = notification.targetValue.split(',').map((id: string) => id.trim()).filter(Boolean);
      setSelectedUserIds(userIds);
    } else {
      setSelectedUserIds([]);
    }
    setExpandedNotificationId(null);
    setShowNotificationModal(true);
  };

  // Delete notification
  const deleteNotification = async (id: string) => {
    const confirmed = Platform.OS === 'web' 
      ? window.confirm('Are you sure you want to delete this notification?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Delete Notification',
            'Are you sure you want to delete this notification?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.NOTIFICATION(id), {
        method: 'DELETE',
      });

      if (response.ok) {
        setNotifications(notifications.filter(n => n.id !== id));
        if (Platform.OS === 'web') {
          alert('Notification deleted successfully');
        } else {
          Alert.alert('Success', 'Notification deleted successfully');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to delete notification');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete notification';
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Update targetValue when selectedUserIds changes
  useEffect(() => {
    if (notificationForm.targetType === 'specific') {
      setNotificationForm(prev => ({
        ...prev,
        targetValue: selectedUserIds.join(','),
      }));
    }
  }, [selectedUserIds]);

  // Create notification
  const createNotification = async () => {
    try {
      if (!notificationForm.title || !notificationForm.message) {
        if (Platform.OS === 'web') {
          alert('Title and message are required');
        } else {
          Alert.alert('Error', 'Title and message are required');
        }
        return;
      }

      if (notificationForm.scheduleType === 'cron' && !notificationForm.cronExpression) {
        if (Platform.OS === 'web') {
          alert('Cron expression is required when using cron schedule');
        } else {
          Alert.alert('Error', 'Cron expression is required when using cron schedule');
        }
        return;
      }

      setIsLoading(true);
      const metadata: any = {};
      if (notificationForm.scheduleType === 'cron') {
        metadata.cronExpression = notificationForm.cronExpression;
      }

      // If editing, update existing notification
      if (editingNotificationId) {
        const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.NOTIFICATION(editingNotificationId), {
          method: 'PATCH',
          body: JSON.stringify({
            title: notificationForm.title,
            message: notificationForm.message,
            targetType: notificationForm.targetType,
            targetValue: notificationForm.targetValue || null,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          }),
        });

        if (response.ok) {
          setShowNotificationModal(false);
          setEditingNotificationId(null);
          setNotificationForm({
            title: '',
            message: '',
            type: 'push',
            targetType: 'all',
            targetValue: '',
            scheduledFor: '',
            cronExpression: '',
            scheduleType: 'datetime',
          });
          setSelectedUserIds([]);
          setCronNextOccurrences([]);
          loadNotifications(true);
          if (Platform.OS === 'web') {
            alert('Notification updated successfully');
          } else {
            Alert.alert('Success', 'Notification updated successfully');
          }
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Failed to update notification');
        }
        return;
      }

      // Create new notification
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.NOTIFICATIONS, {
        method: 'POST',
        body: JSON.stringify({
          title: notificationForm.title,
          message: notificationForm.message,
          type: notificationForm.type,
          targetType: notificationForm.targetType,
          targetValue: notificationForm.targetValue || null,
          scheduledFor: notificationForm.scheduleType === 'datetime' ? (notificationForm.scheduledFor || null) : null,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        }),
      });

      if (response.ok) {
        setShowNotificationModal(false);
        setNotificationForm({
          title: '',
          message: '',
          type: 'push',
          targetType: 'all',
          targetValue: '',
          scheduledFor: '',
          cronExpression: '',
          scheduleType: 'datetime',
        });
        setSelectedUserIds([]);
        setCronNextOccurrences([]);
        loadNotifications();
        if (Platform.OS === 'web') {
          alert('Notification created successfully');
        } else {
          Alert.alert('Success', 'Notification created successfully');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to create notification');
      }
    } catch (error) {
      console.error('Error creating notification:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create notification';
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel notification
  const cancelNotification = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.CANCEL_NOTIFICATION(id), {
        method: 'POST',
      });

      if (response.ok) {
        loadNotifications();
        if (Platform.OS === 'web') {
          alert('Notification cancelled');
        } else {
          Alert.alert('Success', 'Notification cancelled');
        }
      } else {
        throw new Error('Failed to cancel notification');
      }
    } catch (error) {
      console.error('Error cancelling notification:', error);
      if (Platform.OS === 'web') {
        alert('Failed to cancel notification');
      } else {
        Alert.alert('Error', 'Failed to cancel notification');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Send notification manually
  const sendNotification = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.SEND_NOTIFICATION(id), {
        method: 'POST',
      });

      if (response.ok) {
        loadNotifications();
        if (Platform.OS === 'web') {
          alert('Notification sending started');
        } else {
          Alert.alert('Success', 'Notification sending started');
        }
      } else {
        throw new Error('Failed to send notification');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      if (Platform.OS === 'web') {
        alert('Failed to send notification');
      } else {
        Alert.alert('Error', 'Failed to send notification');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle cron enabled/disabled state
  const toggleCron = async (id: string, enable: boolean) => {
    const action = enable ? 'enable' : 'disable';
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Are you sure you want to ${action} this cron notification?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            `${enable ? 'Enable' : 'Disable'} Cron`,
            `Are you sure you want to ${action} this cron notification?`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: enable ? 'Enable' : 'Disable', style: enable ? 'default' : 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      setIsLoading(true);
      const notification = notifications.find(n => n.id === id);
      if (!notification) return;

      const metadata = notification.metadata || {};
      metadata.cronEnabled = enable;

      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.NOTIFICATION(id), {
        method: 'PATCH',
        body: JSON.stringify({
          metadata,
        }),
      });

      if (response.ok) {
        loadNotifications(true);
        if (Platform.OS === 'web') {
          alert(`Cron ${action}d successfully`);
        } else {
          Alert.alert('Success', `Cron ${action}d successfully`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to ${action} cron`);
      }
    } catch (error) {
      console.error(`Error ${action}ing cron:`, error);
      const errorMessage = error instanceof Error ? error.message : `Failed to ${action} cron`;
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
    } else if (activeTab === 'integrations') {
      loadIntegrationSettings();
    } else if (activeTab === 'notifications') {
      loadNotifications(true);
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
        
        // Check if this user is an admin
        const adminCheckResponse = await authenticatedFetch(API_ENDPOINTS.ADMIN.ADMINS);
        if (adminCheckResponse.ok) {
          const admins = await adminCheckResponse.json();
          const isAdmin = admins.some((admin: any) => admin.userId === userId);
          setUserIsAdmin(isAdmin);
        }
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

  // Make user admin
  const makeUserAdmin = async (userId: string) => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.ADD_ADMIN, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setUserIsAdmin(true);
        if (Platform.OS === 'web') {
          alert('User has been made an admin');
        } else {
          Alert.alert('Success', 'User has been made an admin');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to make user admin');
      }
    } catch (error) {
      console.error('Error making user admin:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to make user admin';
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Remove admin privileges
  const removeUserAdmin = async (userId: string) => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN.REMOVE_ADMIN(userId), {
        method: 'DELETE',
      });

      if (response.ok) {
        setUserIsAdmin(false);
        if (Platform.OS === 'web') {
          alert('Admin privileges removed');
        } else {
          Alert.alert('Success', 'Admin privileges removed');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to remove admin privileges');
      }
    } catch (error) {
      console.error('Error removing admin:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove admin privileges';
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle make admin with confirmation
  const handleMakeAdmin = (userId: string, username: string, email: string) => {
    const userName = username || email || 'this user';
    
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Make ${userName} an admin?\n\n` +
        `This will give them full access to the admin dashboard, including the ability to manage users, view all data, and add other admins.`
      );
      if (confirmed) {
        makeUserAdmin(userId);
      }
    } else {
      Alert.alert(
        'Make Admin',
        `Make ${userName} an admin?\n\n` +
        `This will give them full access to the admin dashboard, including the ability to manage users, view all data, and add other admins.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Make Admin', style: 'default', onPress: () => makeUserAdmin(userId) },
        ]
      );
    }
  };

  // Handle remove admin with confirmation
  const handleRemoveAdmin = (userId: string, username: string, email: string) => {
    const userName = username || email || 'this user';
    
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Remove admin privileges from ${userName}?\n\n` +
        `This will revoke their access to the admin dashboard.`
      );
      if (confirmed) {
        removeUserAdmin(userId);
      }
    } else {
      Alert.alert(
        'Remove Admin',
        `Remove admin privileges from ${userName}?\n\n` +
        `This will revoke their access to the admin dashboard.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove Admin', style: 'destructive', onPress: () => removeUserAdmin(userId) },
        ]
      );
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
      // Close user details modal first
      setShowUserModal(false);
      setSelectedConversation(conversation);
      
      const endpoint = API_ENDPOINTS.ADMIN.CONVERSATION(conversation.id);
      
      // Fetch conversation with messages using admin endpoint
      const response = await authenticatedFetch(endpoint);
      
      if (response.ok) {
        const convData = await response.json();
        // Update selectedConversation with full data from API
        setSelectedConversation({
          ...conversation,
          ...convData,
        });
        setConversationMessages(convData.messages || []);
        setShowConversationModal(true);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Conversation API error:', response.status, errorData);
        throw new Error(errorData.error || `Failed to load conversation: ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load conversation';
      if (Platform.OS === 'web') {
        alert(`Failed to load conversation: ${errorMessage}`);
      } else {
        Alert.alert('Error', `Failed to load conversation: ${errorMessage}`);
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
    // Reopen user details modal if we had a selected user
    if (selectedUser) {
      setShowUserModal(true);
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

        {/* Tabs - Scrollable on mobile */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
          contentContainerStyle={styles.tabsContent}>
          {[
            { key: 'dashboard', label: 'Dashboard', icon: 'chart.bar' },
            { key: 'users', label: 'Users', icon: 'person.fill' },
            { key: 'approvals', label: 'Approvals', icon: 'checkmark.circle.fill' },
            { key: 'integrations', label: 'Integrations', icon: 'link' },
            { key: 'notifications', label: 'Notifications', icon: 'envelope' },
          ].map((tab) => (
          <TouchableOpacity
              key={tab.key}
            style={[
              styles.tab,
                activeTab === tab.key && styles.activeTab,
                { 
                  borderBottomColor: activeTab === tab.key ? '#FF9500' : 'transparent',
                  backgroundColor: activeTab === tab.key ? (isDark ? 'rgba(255, 149, 0, 0.1)' : 'rgba(255, 149, 0, 0.05)') : 'transparent',
                },
            ]}
              onPress={() => setActiveTab(tab.key as any)}>
              <IconSymbol
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.key ? '#FF9500' : (isDark ? '#8E8E93' : '#8E8E93')}
                style={{ marginRight: 6 }}
              />
              <ThemedText style={[styles.tabText, activeTab === tab.key && { color: '#FF9500', fontWeight: '600' }]}>
                {tab.label}
            </ThemedText>
          </TouchableOpacity>
          ))}
        </ScrollView>

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
                    <ThemedText style={styles.emptyText}>No waitlist entries found</ThemedText>
                  </View>
                ) : (
                  approvals.map((entry) => (
                    <View
                      key={entry.id}
                      style={[styles.approvalItem, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                      <View style={styles.approvalItemContent}>
                        <View style={styles.approvalItemLeft}>
                          <ThemedText style={styles.approvalItemName}>{entry.username || entry.email}</ThemedText>
                          <ThemedText style={styles.approvalItemEmail}>{entry.email}</ThemedText>
                          <View style={styles.approvalItemMeta}>
                            {entry.plan && (
                            <View style={[styles.planBadgeSmall, { backgroundColor: '#4a9eff' }]}>
                                <ThemedText style={styles.planBadgeSmallText}>{entry.plan.toUpperCase()}</ThemedText>
                            </View>
                            )}
                            {entry.userId && (
                              <View style={[styles.planBadgeSmall, { backgroundColor: '#8E8E93', marginLeft: entry.plan ? 4 : 0 }]}>
                                <ThemedText style={styles.planBadgeSmallText}>USER</ThemedText>
                              </View>
                            )}
                            <ThemedText style={styles.approvalItemDate}>
                              {entry.userId ? 'Joined' : 'Waitlisted'}: {new Date(entry.createdAt).toLocaleDateString()}
                            </ThemedText>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.approvalBadgeButton,
                            { 
                              backgroundColor: entry.isApproved ? '#34C759' : '#FF9500',
                              opacity: isLoading ? 0.6 : 1,
                            }
                          ]}
                          onPress={() => toggleApproval(entry)}
                          disabled={isLoading}>
                          <ThemedText style={styles.approvalBadgeText}>
                            {entry.isApproved ? 'APPROVED' : 'PENDING'}
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab === 'integrations' && (
              <View style={styles.section}>
                <ThemedText style={[styles.cardTitle, { marginBottom: 16 }]}>
                  Manage Integrations
                </ThemedText>
                {integrationSettings.length === 0 ? (
                  <View style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                    <ThemedText style={styles.emptyText}>No integrations found</ThemedText>
                  </View>
                ) : (
                  integrationSettings.map((integration) => (
                    <View
                      key={integration.provider}
                      style={[styles.approvalItem, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                      <View style={styles.approvalItemContent}>
                        <View style={styles.approvalItemLeft}>
                          <ThemedText style={styles.approvalItemName}>{integration.name}</ThemedText>
                          <ThemedText style={styles.approvalItemEmail}>{integration.provider}</ThemedText>
                          {integration.description && (
                            <ThemedText style={[styles.approvalItemDate, { marginTop: 4 }]}>
                              {integration.description}
                            </ThemedText>
                          )}
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.approvalBadgeButton,
                            { 
                              backgroundColor: integration.isEnabled ? '#34C759' : '#8E8E93',
                              opacity: isLoading ? 0.6 : 1,
                            }
                          ]}
                          onPress={() => toggleIntegration(integration.provider, integration.isEnabled)}
                          disabled={isLoading}>
                          <ThemedText style={styles.approvalBadgeText}>
                            {integration.isEnabled ? 'ENABLED' : 'DISABLED'}
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab === 'notifications' && (
              <View style={styles.section}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <ThemedText style={styles.cardTitle}>Notifications</ThemedText>
                  <TouchableOpacity
                    style={[styles.approvalBadgeButton, { backgroundColor: '#FF9500', paddingHorizontal: 16, paddingVertical: 8 }]}
                    onPress={() => {
                      setNotificationForm({
                        title: '',
                        message: '',
                        type: 'push',
                        targetType: 'all',
                        targetValue: '',
                        scheduledFor: '',
                        cronExpression: '',
                        scheduleType: 'datetime',
                      });
                      setSelectedUserIds([]);
                      setCronNextOccurrences([]);
                      setEditingNotificationId(null);
                      setShowNotificationModal(true);
                    }}>
                    <ThemedText style={styles.approvalBadgeText}>+ New</ThemedText>
                  </TouchableOpacity>
                </View>

                {/* Active Cron Notifications Section */}
                <View style={{ marginBottom: 24 }}>
                  <ThemedText style={[styles.cardTitle, { marginBottom: 12 }]}>Active Cron Notifications</ThemedText>
                  {activeCronNotifications.length === 0 ? (
                    <View style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                      <ThemedText style={styles.emptyText}>No active cron notifications found</ThemedText>
                    </View>
                  ) : (
                    <>
                      {activeCronNotifications.map((notification: any) => {
                    const isExpanded = expandedNotificationId === notification.id;
                    const metadata = notification.metadata || {};
                    const hasCron = metadata.cronExpression;
                    const timeDisplay = notification.sentAt 
                      ? new Date(notification.sentAt).toLocaleString()
                      : hasCron
                      ? `Cron: ${metadata.cronExpression}`
                      : notification.scheduledFor
                      ? `Scheduled: ${new Date(notification.scheduledFor).toLocaleString()}`
                      : new Date(notification.createdAt).toLocaleString();

                    return (
                      <TouchableOpacity
                        key={notification.id}
                        style={[styles.approvalItem, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}
                        onPress={() => setExpandedNotificationId(isExpanded ? null : notification.id)}>
                        <View style={styles.approvalItemContent}>
                          <View style={[styles.approvalItemLeft, { flex: 1 }]}>
                            <ThemedText style={styles.approvalItemName}>{notification.title}</ThemedText>
                            <ThemedText style={[styles.approvalItemEmail, { marginTop: 4 }]} numberOfLines={isExpanded ? undefined : 2}>
                              {notification.message}
                            </ThemedText>
                            <ThemedText style={[styles.approvalItemDate, { marginTop: 4 }]}>
                              {timeDisplay}
                            </ThemedText>
                            
                            {isExpanded && (
                              <View style={{ marginTop: 12, gap: 8 }}>
                                <View style={styles.approvalItemMeta}>
                                  <ThemedText style={styles.approvalItemDate}>
                                    <ThemedText style={{ fontWeight: '600' }}>Target: </ThemedText>
                                    {notification.targetType === 'all' && 'All Users'}
                                    {notification.targetType === 'plan' && `Plan: ${notification.targetValue || 'N/A'}`}
                                    {notification.targetType === 'waitlist' && `Waitlist: ${notification.targetValue || 'All'}`}
                                    {notification.targetType === 'specific' && `Specific Users (${notification.targetValue?.split(',').length || 0})`}
                                  </ThemedText>
                                </View>
                                
                                {notification.status === 'sent' && (
                                  <TouchableOpacity
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      const metadata = notification.metadata || {};
                                      const sentUserIds = metadata.sentUserIds || [];
                                      
                                      if (sentUserIds.length > 0 && expandedSentUsersId !== notification.id) {
                                        // Load user details
                                        loadSentUsers(notification.id, sentUserIds);
                                      } else if (sentUserIds.length === 0) {
                                        // No users to load, set empty array
                                        setSentUsersMap(prev => ({
                                          ...prev,
                                          [notification.id]: [],
                                        }));
                                      }
                                      setExpandedSentUsersId(expandedSentUsersId === notification.id ? null : notification.id);
                                    }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <ThemedText style={styles.approvalItemDate}>
                                        Sent to {notification.sentCount} users
                                        {notification.failedCount > 0 && ` (${notification.failedCount} failed)`}
                                      </ThemedText>
                                      <IconSymbol
                                        name={expandedSentUsersId === notification.id ? 'chevron.up' : 'chevron.down'}
                                        size={16}
                                        color={isDark ? '#8E8E93' : '#8E8E93'}
                                      />
                                    </View>
                                    {expandedSentUsersId === notification.id && (
                                      <View style={{ marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }}>
                                        {loadingSentUsers[notification.id] ? (
                                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <ActivityIndicator size="small" color="#FF9500" />
                                            <ThemedText style={styles.approvalItemDate}>Loading users...</ThemedText>
                                          </View>
                                        ) : sentUsersMap[notification.id] ? (
                                          sentUsersMap[notification.id].length > 0 ? (
                                            <ScrollView style={{ maxHeight: 200 }}>
                                              {sentUsersMap[notification.id].map((user) => (
                                                <View key={user.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                                                  <ThemedText style={[styles.approvalItemEmail, { fontSize: 12 }]}>{user.email}</ThemedText>
                                                </View>
                                              ))}
                                            </ScrollView>
                                          ) : (
                                            <ThemedText style={styles.approvalItemDate}>No users found</ThemedText>
                                          )
                                        ) : (
                                          <ThemedText style={styles.approvalItemDate}>No user data available</ThemedText>
                                        )}
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                )}

                                {metadata.cronExpression && (
                                  <View style={{ marginTop: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <View style={{ flex: 1 }}>
                                        <ThemedText style={styles.approvalItemDate}>
                                          <ThemedText style={{ fontWeight: '600' }}>Cron: </ThemedText>
                                          {metadata.cronExpression}
                                        </ThemedText>
                                        {metadata.cronEnabled === false && (
                                          <ThemedText style={[styles.approvalItemDate, { color: '#FF3B30', marginTop: 4 }]}>
                                            (Disabled)
                                          </ThemedText>
                                        )}
                                      </View>
                                      {(notification.status === 'pending' || notification.status === 'sent') && (
                                        <TouchableOpacity
                                          style={[styles.approvalBadgeButton, { backgroundColor: '#4a9eff', paddingHorizontal: 12, paddingVertical: 6 }]}
                                          onPress={(e) => {
                                            e.stopPropagation();
                                            setEditingNotificationId(notification.id);
                                            setNotificationForm({
                                              title: notification.title,
                                              message: notification.message,
                                              type: notification.type,
                                              targetType: notification.targetType,
                                              targetValue: notification.targetValue || '',
                                              scheduledFor: notification.scheduledFor || '',
                                              cronExpression: metadata.cronExpression || '',
                                              scheduleType: 'cron',
                                            });
                                            setSelectedUserIds(notification.targetType === 'specific' && notification.targetValue 
                                              ? notification.targetValue.split(',').map((id: string) => id.trim()).filter(Boolean)
                                              : []);
                                            if (notification.targetType === 'specific') {
                                              loadUsersForSelection();
                                            }
                                            setShowNotificationModal(true);
                                          }}>
                                          <ThemedText style={styles.approvalBadgeText}>EDIT</ThemedText>
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                    {(notification.status === 'pending' || notification.status === 'sent') && (
                                      <TouchableOpacity
                                        style={{ marginTop: 8 }}
                                        onPress={(e) => {
                                          e.stopPropagation();
                                          toggleCron(notification.id, metadata.cronEnabled === false);
                                        }}>
                                        <ThemedText style={[styles.approvalItemDate, { color: metadata.cronEnabled === false ? '#34C759' : '#FF3B30' }]}>
                                          {metadata.cronEnabled === false ? 'Enable Cron' : 'Disable Cron'}
                                        </ThemedText>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                )}

                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                  <TouchableOpacity
                                    style={[styles.approvalBadgeButton, { backgroundColor: '#4a9eff', flex: 1, minWidth: 80 }]}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      handleReplay(notification);
                                    }}>
                                    <ThemedText style={styles.approvalBadgeText}>REPLAY</ThemedText>
                                  </TouchableOpacity>
                                  
                                  {notification.status === 'pending' && (
                                    <>
                                      <TouchableOpacity
                                        style={[styles.approvalBadgeButton, { backgroundColor: '#34C759', flex: 1, minWidth: 80, opacity: isLoading ? 0.6 : 1 }]}
                                        onPress={(e) => {
                                          e.stopPropagation();
                                          sendNotification(notification.id);
                                        }}
                                        disabled={isLoading}>
                                        <ThemedText style={styles.approvalBadgeText}>SEND</ThemedText>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[styles.approvalBadgeButton, { backgroundColor: '#8E8E93', flex: 1, minWidth: 80, opacity: isLoading ? 0.6 : 1 }]}
                                        onPress={(e) => {
                                          e.stopPropagation();
                                          cancelNotification(notification.id);
                                        }}
                                        disabled={isLoading}>
                                        <ThemedText style={styles.approvalBadgeText}>CANCEL</ThemedText>
                                      </TouchableOpacity>
                                    </>
                                  )}
                                  
                                  <TouchableOpacity
                                    style={[styles.approvalBadgeButton, { backgroundColor: '#FF3B30', flex: 1, minWidth: 80, opacity: isLoading ? 0.6 : 1 }]}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      deleteNotification(notification.id);
                                    }}
                                    disabled={isLoading}>
                                    <ThemedText style={styles.approvalBadgeText}>DELETE</ThemedText>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                          
                          {!isExpanded && (
                            <View style={[
                              styles.approvalBadgeButton,
                              {
                                backgroundColor:
                                  notification.status === 'sent' ? '#34C759' :
                                  notification.status === 'sending' ? '#FF9500' :
                                  notification.status === 'failed' ? '#FF3B30' :
                                  notification.status === 'cancelled' ? '#8E8E93' :
                                  '#4a9eff',
                              }
                            ]}>
                              <ThemedText style={styles.approvalBadgeText}>
                                {notification.status.toUpperCase()}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                      {activeCronHasMore && (
                        <TouchableOpacity
                          style={[styles.approvalBadgeButton, { backgroundColor: '#4a9eff', marginTop: 12, opacity: isLoading ? 0.6 : 1 }]}
                          onPress={loadMoreActiveCron}
                          disabled={isLoading}>
                          <ThemedText style={styles.approvalBadgeText}>Load 5 More</ThemedText>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>

                {/* Notification History Section */}
                <View style={{ marginBottom: 24 }}>
                  <ThemedText style={[styles.cardTitle, { marginBottom: 12 }]}>Notification History</ThemedText>
                  <ThemedText style={[styles.approvalItemDate, { marginBottom: 12, fontSize: 12 }]}>
                    All sent notifications (including cron notifications that have been sent)
                  </ThemedText>
                  {notificationHistory.length === 0 ? (
                    <View style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                      <ThemedText style={styles.emptyText}>No notification history found</ThemedText>
                    </View>
                  ) : (
                    <>
                      {notificationHistory.map((notification: any) => {
                    const isExpanded = expandedNotificationId === notification.id;
                    const metadata = notification.metadata || {};
                    const hasCron = metadata && metadata.cronExpression;
                    const timeDisplay = notification.sentAt 
                      ? `Sent: ${new Date(notification.sentAt).toLocaleString()}${hasCron ? ` (Cron: ${metadata.cronExpression})` : ''}`
                      : hasCron
                      ? `Cron: ${metadata.cronExpression}`
                      : notification.scheduledFor
                      ? `Scheduled: ${new Date(notification.scheduledFor).toLocaleString()}`
                      : new Date(notification.createdAt).toLocaleString();

                    return (
                      <TouchableOpacity
                        key={notification.id}
                        style={[styles.approvalItem, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}
                        onPress={() => setExpandedNotificationId(isExpanded ? null : notification.id)}>
                        <View style={styles.approvalItemContent}>
                          <View style={[styles.approvalItemLeft, { flex: 1 }]}>
                            <ThemedText style={styles.approvalItemName}>{notification.title}</ThemedText>
                            <ThemedText style={[styles.approvalItemEmail, { marginTop: 4 }]} numberOfLines={isExpanded ? undefined : 2}>
                              {notification.message}
                            </ThemedText>
                            <ThemedText style={[styles.approvalItemDate, { marginTop: 4 }]}>
                              {timeDisplay}
                            </ThemedText>
                            
                            {isExpanded && (
                              <View style={{ marginTop: 12, gap: 8 }}>
                                <View style={styles.approvalItemMeta}>
                                  <ThemedText style={styles.approvalItemDate}>
                                    <ThemedText style={{ fontWeight: '600' }}>Target: </ThemedText>
                                    {notification.targetType === 'all' && 'All Users'}
                                    {notification.targetType === 'plan' && `Plan: ${notification.targetValue || 'N/A'}`}
                                    {notification.targetType === 'waitlist' && `Waitlist: ${notification.targetValue || 'All'}`}
                                    {notification.targetType === 'specific' && `Specific Users (${notification.targetValue?.split(',').length || 0})`}
                                  </ThemedText>
                                </View>
                                
                                {hasCron && (
                                  <View style={{ marginTop: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <ThemedText style={styles.approvalItemDate}>
                                        <ThemedText style={{ fontWeight: '600' }}>Cron: </ThemedText>
                                        {metadata.cronExpression}
                                        {metadata.cronEnabled === false && (
                                          <ThemedText style={{ color: '#FF3B30' }}> (Disabled)</ThemedText>
                                        )}
                                      </ThemedText>
                                      {(notification.status === 'pending' || notification.status === 'sent') && (
                                        <TouchableOpacity
                                          style={[styles.approvalBadgeButton, { backgroundColor: '#4a9eff', paddingHorizontal: 12, paddingVertical: 6 }]}
                                          onPress={(e) => {
                                            e.stopPropagation();
                                            setEditingNotificationId(notification.id);
                                            setNotificationForm({
                                              title: notification.title,
                                              message: notification.message,
                                              type: notification.type,
                                              targetType: notification.targetType,
                                              targetValue: notification.targetValue || '',
                                              scheduledFor: notification.scheduledFor || '',
                                              cronExpression: metadata.cronExpression || '',
                                              scheduleType: 'cron',
                                            });
                                            setSelectedUserIds(notification.targetType === 'specific' && notification.targetValue 
                                              ? notification.targetValue.split(',').map((id: string) => id.trim()).filter(Boolean)
                                              : []);
                                            if (notification.targetType === 'specific') {
                                              loadUsersForSelection();
                                            }
                                            setShowNotificationModal(true);
                                          }}>
                                          <ThemedText style={styles.approvalBadgeText}>EDIT</ThemedText>
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                    {(notification.status === 'pending' || notification.status === 'sent') && (
                                      <TouchableOpacity
                                        style={{ marginTop: 8 }}
                                        onPress={(e) => {
                                          e.stopPropagation();
                                          toggleCron(notification.id, metadata.cronEnabled === false);
                                        }}>
                                        <ThemedText style={[styles.approvalItemDate, { color: metadata.cronEnabled === false ? '#34C759' : '#FF3B30' }]}>
                                          {metadata.cronEnabled === false ? 'Enable Cron' : 'Disable Cron'}
                                        </ThemedText>
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                )}

                                {notification.status === 'sent' && (
                                  <TouchableOpacity
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      const metadata = notification.metadata || {};
                                      const sentUserIds = metadata.sentUserIds || [];
                                      
                                      if (sentUserIds.length > 0 && expandedSentUsersId !== notification.id) {
                                        loadSentUsers(notification.id, sentUserIds);
                                      } else if (sentUserIds.length === 0) {
                                        setSentUsersMap(prev => ({
                                          ...prev,
                                          [notification.id]: [],
                                        }));
                                      }
                                      setExpandedSentUsersId(expandedSentUsersId === notification.id ? null : notification.id);
                                    }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <ThemedText style={styles.approvalItemDate}>
                                        Sent to {notification.sentCount} users
                                        {notification.failedCount > 0 && ` (${notification.failedCount} failed)`}
                                      </ThemedText>
                                      <IconSymbol
                                        name={expandedSentUsersId === notification.id ? 'chevron.up' : 'chevron.down'}
                                        size={16}
                                        color={isDark ? '#8E8E93' : '#8E8E93'}
                                      />
                                    </View>
                                    {expandedSentUsersId === notification.id && (
                                      <View style={{ marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }}>
                                        {loadingSentUsers[notification.id] ? (
                                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <ActivityIndicator size="small" color="#FF9500" />
                                            <ThemedText style={styles.approvalItemDate}>Loading users...</ThemedText>
                                          </View>
                                        ) : sentUsersMap[notification.id] ? (
                                          sentUsersMap[notification.id].length > 0 ? (
                                            <ScrollView style={{ maxHeight: 200 }}>
                                              {sentUsersMap[notification.id].map((user) => (
                                                <View key={user.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                                                  <ThemedText style={[styles.approvalItemEmail, { fontSize: 12 }]}>{user.email}</ThemedText>
                                                </View>
                                              ))}
                                            </ScrollView>
                                          ) : (
                                            <ThemedText style={styles.approvalItemDate}>No users found</ThemedText>
                                          )
                                        ) : (
                                          <ThemedText style={styles.approvalItemDate}>No user data available</ThemedText>
                                        )}
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                )}

                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                  <TouchableOpacity
                                    style={[styles.approvalBadgeButton, { backgroundColor: '#4a9eff', flex: 1, minWidth: 80 }]}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      handleReplay(notification);
                                    }}>
                                    <ThemedText style={styles.approvalBadgeText}>REPLAY</ThemedText>
                                  </TouchableOpacity>
                                  
                                  {notification.status === 'pending' && (
                                    <>
                                      <TouchableOpacity
                                        style={[styles.approvalBadgeButton, { backgroundColor: '#34C759', flex: 1, minWidth: 80, opacity: isLoading ? 0.6 : 1 }]}
                                        onPress={(e) => {
                                          e.stopPropagation();
                                          sendNotification(notification.id);
                                        }}
                                        disabled={isLoading}>
                                        <ThemedText style={styles.approvalBadgeText}>SEND</ThemedText>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[styles.approvalBadgeButton, { backgroundColor: '#8E8E93', flex: 1, minWidth: 80, opacity: isLoading ? 0.6 : 1 }]}
                                        onPress={(e) => {
                                          e.stopPropagation();
                                          cancelNotification(notification.id);
                                        }}
                                        disabled={isLoading}>
                                        <ThemedText style={styles.approvalBadgeText}>CANCEL</ThemedText>
                                      </TouchableOpacity>
                                    </>
                                  )}
                                  
                                  <TouchableOpacity
                                    style={[styles.approvalBadgeButton, { backgroundColor: '#FF3B30', flex: 1, minWidth: 80, opacity: isLoading ? 0.6 : 1 }]}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      deleteNotification(notification.id);
                                    }}
                                    disabled={isLoading}>
                                    <ThemedText style={styles.approvalBadgeText}>DELETE</ThemedText>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                          
                          {!isExpanded && (
                            <View style={[
                              styles.approvalBadgeButton,
                              {
                                backgroundColor:
                                  notification.status === 'sent' ? '#34C759' :
                                  notification.status === 'sending' ? '#FF9500' :
                                  notification.status === 'failed' ? '#FF3B30' :
                                  notification.status === 'cancelled' ? '#8E8E93' :
                                  '#4a9eff',
                              }
                            ]}>
                              <ThemedText style={styles.approvalBadgeText}>
                                {notification.status.toUpperCase()}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                      {historyHasMore && (
                        <TouchableOpacity
                          style={[styles.approvalBadgeButton, { backgroundColor: '#4a9eff', marginTop: 12, opacity: isLoading ? 0.6 : 1 }]}
                          onPress={loadMoreHistory}
                          disabled={isLoading}>
                          <ThemedText style={styles.approvalBadgeText}>Load 5 More</ThemedText>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>

                {/* Pending One-Time Notifications Section */}
                <View style={{ marginBottom: 24 }}>
                  <ThemedText style={[styles.cardTitle, { marginBottom: 12 }]}>Pending One-Time Notifications</ThemedText>
                  {pendingOneTimeNotifications.length === 0 ? (
                    <View style={[styles.card, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                      <ThemedText style={styles.emptyText}>No pending one-time notifications found</ThemedText>
                    </View>
                  ) : (
                    <>
                      {pendingOneTimeNotifications.map((notification) => {
                    const isExpanded = expandedNotificationId === notification.id;
                    const metadata = notification.metadata || {};
                    const hasCron = metadata.cronExpression;
                    const timeDisplay = notification.sentAt 
                      ? new Date(notification.sentAt).toLocaleString()
                      : hasCron
                      ? `Cron: ${metadata.cronExpression}`
                      : notification.scheduledFor
                      ? `Scheduled: ${new Date(notification.scheduledFor).toLocaleString()}`
                      : new Date(notification.createdAt).toLocaleString();

                    return (
                      <TouchableOpacity
                        key={notification.id}
                        style={[styles.approvalItem, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}
                        onPress={() => setExpandedNotificationId(isExpanded ? null : notification.id)}>
                        <View style={styles.approvalItemContent}>
                          <View style={[styles.approvalItemLeft, { flex: 1 }]}>
                            <ThemedText style={styles.approvalItemName}>{notification.title}</ThemedText>
                            <ThemedText style={[styles.approvalItemEmail, { marginTop: 4 }]} numberOfLines={isExpanded ? undefined : 2}>
                              {notification.message}
                            </ThemedText>
                            <ThemedText style={[styles.approvalItemDate, { marginTop: 4 }]}>
                              {timeDisplay}
                            </ThemedText>
                            
                            {isExpanded && (
                              <View style={{ marginTop: 12, gap: 8 }}>
                                <View style={styles.approvalItemMeta}>
                                  <ThemedText style={styles.approvalItemDate}>
                                    <ThemedText style={{ fontWeight: '600' }}>Target: </ThemedText>
                                    {notification.targetType === 'all' && 'All Users'}
                                    {notification.targetType === 'plan' && `Plan: ${notification.targetValue || 'N/A'}`}
                                    {notification.targetType === 'waitlist' && `Waitlist: ${notification.targetValue || 'All'}`}
                                    {notification.targetType === 'specific' && `Specific Users (${notification.targetValue?.split(',').length || 0})`}
                                  </ThemedText>
                                </View>
                                
                                {notification.status === 'sent' && (
                                  <TouchableOpacity
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      const metadata = notification.metadata || {};
                                      const sentUserIds = metadata.sentUserIds || [];
                                      
                                      if (sentUserIds.length > 0 && expandedSentUsersId !== notification.id) {
                                        loadSentUsers(notification.id, sentUserIds);
                                      } else if (sentUserIds.length === 0) {
                                        setSentUsersMap(prev => ({
                                          ...prev,
                                          [notification.id]: [],
                                        }));
                                      }
                                      setExpandedSentUsersId(expandedSentUsersId === notification.id ? null : notification.id);
                                    }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <ThemedText style={styles.approvalItemDate}>
                                        Sent to {notification.sentCount} users
                                        {notification.failedCount > 0 && ` (${notification.failedCount} failed)`}
                                      </ThemedText>
                                      <IconSymbol
                                        name={expandedSentUsersId === notification.id ? 'chevron.up' : 'chevron.down'}
                                        size={16}
                                        color={isDark ? '#8E8E93' : '#8E8E93'}
                                      />
                                    </View>
                                    {expandedSentUsersId === notification.id && (
                                      <View style={{ marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }}>
                                        {loadingSentUsers[notification.id] ? (
                                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <ActivityIndicator size="small" color="#FF9500" />
                                            <ThemedText style={styles.approvalItemDate}>Loading users...</ThemedText>
                                          </View>
                                        ) : sentUsersMap[notification.id] ? (
                                          sentUsersMap[notification.id].length > 0 ? (
                                            <ScrollView style={{ maxHeight: 200 }}>
                                              {sentUsersMap[notification.id].map((user) => (
                                                <View key={user.id} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                                                  <ThemedText style={[styles.approvalItemEmail, { fontSize: 12 }]}>{user.email}</ThemedText>
                                                </View>
                                              ))}
                                            </ScrollView>
                                          ) : (
                                            <ThemedText style={styles.approvalItemDate}>No users found</ThemedText>
                                          )
                                        ) : (
                                          <ThemedText style={styles.approvalItemDate}>No user data available</ThemedText>
                                        )}
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                )}

                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                                  <TouchableOpacity
                                    style={[styles.approvalBadgeButton, { backgroundColor: '#4a9eff', flex: 1, minWidth: 80 }]}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      handleReplay(notification);
                                    }}>
                                    <ThemedText style={styles.approvalBadgeText}>REPLAY</ThemedText>
                                  </TouchableOpacity>
                                  
                                  {notification.status === 'pending' && (
                                    <>
                                      <TouchableOpacity
                                        style={[styles.approvalBadgeButton, { backgroundColor: '#34C759', flex: 1, minWidth: 80, opacity: isLoading ? 0.6 : 1 }]}
                                        onPress={(e) => {
                                          e.stopPropagation();
                                          sendNotification(notification.id);
                                        }}
                                        disabled={isLoading}>
                                        <ThemedText style={styles.approvalBadgeText}>SEND</ThemedText>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[styles.approvalBadgeButton, { backgroundColor: '#8E8E93', flex: 1, minWidth: 80, opacity: isLoading ? 0.6 : 1 }]}
                                        onPress={(e) => {
                                          e.stopPropagation();
                                          cancelNotification(notification.id);
                                        }}
                                        disabled={isLoading}>
                                        <ThemedText style={styles.approvalBadgeText}>CANCEL</ThemedText>
                                      </TouchableOpacity>
                                    </>
                                  )}
                                  
                                  <TouchableOpacity
                                    style={[styles.approvalBadgeButton, { backgroundColor: '#FF3B30', flex: 1, minWidth: 80, opacity: isLoading ? 0.6 : 1 }]}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      deleteNotification(notification.id);
                                    }}
                                    disabled={isLoading}>
                                    <ThemedText style={styles.approvalBadgeText}>DELETE</ThemedText>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                          
                          {!isExpanded && (
                            <View style={[
                              styles.approvalBadgeButton,
                              {
                                backgroundColor:
                                  notification.status === 'sent' ? '#34C759' :
                                  notification.status === 'sending' ? '#FF9500' :
                                  notification.status === 'failed' ? '#FF3B30' :
                                  notification.status === 'cancelled' ? '#8E8E93' :
                                  '#4a9eff',
                              }
                            ]}>
                              <ThemedText style={styles.approvalBadgeText}>
                                {notification.status.toUpperCase()}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                      {pendingOneTimeHasMore && (
                        <TouchableOpacity
                          style={[styles.approvalBadgeButton, { backgroundColor: '#4a9eff', marginTop: 12, opacity: isLoading ? 0.6 : 1 }]}
                          onPress={loadMorePendingOneTime}
                          disabled={isLoading}>
                          <ThemedText style={styles.approvalBadgeText}>Load 5 More</ThemedText>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
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

              {/* Admin Status */}
              <View style={[styles.modalCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
                <ThemedText style={styles.modalCardTitle}>Admin Status</ThemedText>
                <View style={styles.modalInfoRow}>
                  <ThemedText style={styles.modalInfoLabel}>Status:</ThemedText>
                  <View style={[styles.planBadgeSmall, { backgroundColor: userIsAdmin ? '#34C759' : '#8E8E93' }]}>
                    <ThemedText style={styles.planBadgeSmallText}>
                      {userIsAdmin ? 'ADMIN' : 'USER'}
                    </ThemedText>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.approvalBadgeButton,
                    { 
                      backgroundColor: userIsAdmin ? '#FF3B30' : '#34C759',
                      marginTop: 12,
                      opacity: isLoading ? 0.6 : 1,
                    },
                  ]}
                  onPress={() => {
                    if (userIsAdmin) {
                      handleRemoveAdmin(selectedUser.id, selectedUser.username, selectedUser.email);
                    } else {
                      handleMakeAdmin(selectedUser.id, selectedUser.username, selectedUser.email);
                    }
                  }}
                  disabled={isLoading}>
                  <ThemedText style={styles.approvalBadgeText}>
                    {userIsAdmin ? 'Remove Admin' : 'Make Admin'}
                  </ThemedText>
                </TouchableOpacity>
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

          {selectedConversation ? (
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
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FF9500" />
              <ThemedText style={styles.emptyText}>Loading conversation...</ThemedText>
            </View>
          )}
        </ThemedView>
      </Modal>

      {/* Notification Creation Modal */}
      <Modal
        visible={showNotificationModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotificationModal(false)}>
        <ThemedView style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: topInset + 20 }]}>
            <View style={styles.modalHeaderRow}>
              <TouchableOpacity onPress={() => setShowNotificationModal(false)} style={styles.modalBackButton}>
                <IconSymbol
                  name="chevron.left"
                  size={20}
                  color={isDark ? '#FFFFFF' : '#000000'}
                />
              </TouchableOpacity>
              <ThemedText style={styles.modalTitle}>Create Notification</ThemedText>
              <View style={styles.placeholder} />
            </View>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: bottomInset + 24 }}>
            <View style={[styles.modalCard, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }]}>
              <ThemedText style={styles.modalCardTitle}>Notification Details</ThemedText>
              
              <View style={{ marginBottom: 16 }}>
                <ThemedText style={[styles.modalInfoLabel, { marginBottom: 8 }]}>Title *</ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', color: isDark ? '#FFFFFF' : '#000000' }]}
                  value={notificationForm.title}
                  onChangeText={(text) => setNotificationForm({ ...notificationForm, title: text })}
                  placeholder="Notification title"
                  placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <ThemedText style={[styles.modalInfoLabel, { marginBottom: 8 }]}>Message *</ThemedText>
                <TextInput
                  style={[styles.textInput, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', color: isDark ? '#FFFFFF' : '#000000', minHeight: 100, textAlignVertical: 'top' }]}
                  value={notificationForm.message}
                  onChangeText={(text) => setNotificationForm({ ...notificationForm, message: text })}
                  placeholder="Notification message"
                  placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <ThemedText style={[styles.modalInfoLabel, { marginBottom: 8 }]}>Type</ThemedText>
                <View style={[styles.approvalBadgeButton, { backgroundColor: '#FF9500', paddingHorizontal: 16, paddingVertical: 8 }]}>
                  <ThemedText style={styles.approvalBadgeText}>PUSH NOTIFICATIONS</ThemedText>
                </View>
                <ThemedText style={[styles.approvalItemDate, { marginTop: 8 }]}>
                  Notifications will be sent as push notifications to user devices
                </ThemedText>
              </View>

              <View style={{ marginBottom: 16 }}>
                <ThemedText style={[styles.modalInfoLabel, { marginBottom: 8 }]}>Target Audience</ThemedText>
                <View style={styles.planButtons}>
                  {['all', 'plan', 'waitlist', 'specific'].map((target) => (
                    <TouchableOpacity
                      key={target}
                      style={[
                        styles.planButton,
                        notificationForm.targetType === target && styles.planButtonActive,
                        { backgroundColor: notificationForm.targetType === target ? '#FF9500' : (isDark ? '#2C2C2E' : '#F2F2F7') },
                      ]}
                      onPress={() => {
                        setNotificationForm({ ...notificationForm, targetType: target, targetValue: '' });
                        if (target === 'specific') {
                          loadUsersForSelection();
                        } else {
                          setSelectedUserIds([]);
                        }
                      }}>
                      <ThemedText style={[styles.planButtonText, notificationForm.targetType === target && { color: '#FFFFFF' }]}>
                        {target.toUpperCase()}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {notificationForm.targetType === 'plan' && (
                <View style={{ marginBottom: 16 }}>
                  <ThemedText style={[styles.modalInfoLabel, { marginBottom: 8 }]}>Plan</ThemedText>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', color: isDark ? '#FFFFFF' : '#000000' }]}
                    value={notificationForm.targetValue}
                    onChangeText={(text) => setNotificationForm({ ...notificationForm, targetValue: text })}
                    placeholder="free, pro, power, or enterprise"
                    placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
                  />
                </View>
              )}

              {notificationForm.targetType === 'waitlist' && (
                <View style={{ marginBottom: 16 }}>
                  <ThemedText style={[styles.modalInfoLabel, { marginBottom: 8 }]}>Status</ThemedText>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', color: isDark ? '#FFFFFF' : '#000000' }]}
                    value={notificationForm.targetValue}
                    onChangeText={(text) => setNotificationForm({ ...notificationForm, targetValue: text })}
                    placeholder="approved, pending, or leave empty for all"
                    placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
                  />
                </View>
              )}

              {notificationForm.targetType === 'specific' && (
                <View style={{ marginBottom: 16 }}>
                  <ThemedText style={[styles.modalInfoLabel, { marginBottom: 8 }]}>Select Users</ThemedText>
                  {allUsersList.length === 0 ? (
                    <TouchableOpacity
                      style={[styles.approvalBadgeButton, { backgroundColor: '#4a9eff', marginBottom: 8 }]}
                      onPress={loadUsersForSelection}>
                      <ThemedText style={styles.approvalBadgeText}>Load Users</ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <ScrollView style={{ maxHeight: 200, marginBottom: 8 }}>
                      {allUsersList.map((user) => (
                        <TouchableOpacity
                          key={user.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 12,
                            borderRadius: 8,
                            marginBottom: 4,
                            backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                          }}
                          onPress={() => toggleUserSelection(user.id)}>
                          <View style={{
                            width: 24,
                            height: 24,
                            borderRadius: 4,
                            borderWidth: 2,
                            borderColor: selectedUserIds.includes(user.id) ? '#FF9500' : (isDark ? '#8E8E93' : '#8E8E93'),
                            backgroundColor: selectedUserIds.includes(user.id) ? '#FF9500' : 'transparent',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}>
                            {selectedUserIds.includes(user.id) && (
                              <ThemedText style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>✓</ThemedText>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <ThemedText style={styles.approvalItemName}>{user.username || user.email}</ThemedText>
                            <ThemedText style={styles.approvalItemEmail}>{user.email}</ThemedText>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                  {selectedUserIds.length > 0 && (
                    <ThemedText style={[styles.approvalItemDate, { marginTop: 4 }]}>
                      {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
                    </ThemedText>
                  )}
                </View>
              )}

              <View style={{ marginBottom: 16 }}>
                <ThemedText style={[styles.modalInfoLabel, { marginBottom: 8 }]}>Schedule Type</ThemedText>
                <View style={styles.planButtons}>
                  {['datetime', 'cron'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.planButton,
                        notificationForm.scheduleType === type && styles.planButtonActive,
                        { backgroundColor: notificationForm.scheduleType === type ? '#FF9500' : (isDark ? '#2C2C2E' : '#F2F2F7') },
                      ]}
                      onPress={() => setNotificationForm({ ...notificationForm, scheduleType: type as any })}>
                      <ThemedText style={[styles.planButtonText, notificationForm.scheduleType === type && { color: '#FFFFFF' }]}>
                        {type.toUpperCase()}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>

                {notificationForm.scheduleType === 'datetime' && (
                  <>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', color: isDark ? '#FFFFFF' : '#000000', marginTop: 12 }]}
                      value={notificationForm.scheduledFor}
                      onChangeText={(text) => setNotificationForm({ ...notificationForm, scheduledFor: text })}
                      placeholder="YYYY-MM-DDTHH:mm (leave empty for immediate)"
                      placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
                    />
                    <ThemedText style={[styles.approvalItemDate, { marginTop: 4 }]}>
                      Leave empty to send immediately, or use ISO format: 2025-01-15T14:30
                    </ThemedText>
                  </>
                )}

                {notificationForm.scheduleType === 'cron' && (
                  <>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7', color: isDark ? '#FFFFFF' : '#000000', marginTop: 12 }]}
                      value={notificationForm.cronExpression}
                      onChangeText={(text) => {
                        setNotificationForm({ ...notificationForm, cronExpression: text });
                        // Calculate next 3 occurrences in IST
                        if (text.trim()) {
                          const result = getCronNextOccurrences(text.trim(), 3);
                          if (result.isValid) {
                            setCronNextOccurrences(result.occurrences);
                          } else {
                            setCronNextOccurrences([]);
                          }
                        } else {
                          setCronNextOccurrences([]);
                        }
                      }}
                      placeholder="0 9 * * * (e.g., daily at 9 AM IST)"
                      placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
                    />
                    {cronNextOccurrences.length > 0 && (
                      <View style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }}>
                        <ThemedText style={[styles.modalInfoLabel, { marginBottom: 8 }]}>Next 3 occurrences (IST):</ThemedText>
                        {cronNextOccurrences.map((date, index) => (
                          <ThemedText key={index} style={[styles.approvalItemDate, { marginTop: 4 }]}>
                            {index + 1}. {formatISTDate(date)}
                          </ThemedText>
                        ))}
                      </View>
                    )}
                    <ThemedText style={[styles.approvalItemDate, { marginTop: 4 }]}>
                      Cron expression format: minute hour day month weekday (all times in IST){'\n'}
                      Examples:{'\n'}
                      • 0 9 * * * - Daily at 9 AM IST{'\n'}
                      • 0 0 * * 0 - Weekly on Sunday at midnight IST{'\n'}
                      • 0 0 1 * * - Monthly on the 1st at midnight IST{'\n'}
                      • */30 * * * * - Every 30 minutes
                    </ThemedText>
                  </>
                )}
              </View>

              <TouchableOpacity
                style={[styles.approvalBadgeButton, { backgroundColor: '#FF9500', marginTop: 16, opacity: isLoading ? 0.6 : 1 }]}
                onPress={createNotification}
                disabled={isLoading}>
                <ThemedText style={styles.approvalBadgeText}>
                  {editingNotificationId ? 'UPDATE NOTIFICATION' : 'CREATE NOTIFICATION'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  tabsContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 13,
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
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.3)',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 44,
  },
});

