import { API_ENDPOINTS } from '@/config/api';
import { storage, STORAGE_KEYS } from '@/utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  plan?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasLoggedOut, setHasLoggedOut] = useState(false);

  // Load user from storage on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      setIsLoading(true);
      
      // Check if user has explicitly logged out (persisted in storage)
      const loggedOutFlag = await AsyncStorage.getItem('hasLoggedOut');
      const hasExplicitlyLoggedOut = loggedOutFlag === 'true';
      
      if (hasExplicitlyLoggedOut) {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      
      // First, check if there's a stored user ID
      const storedUserId = await AsyncStorage.getItem('userId');
      
      // Treat default-user as logged out: clear and show login
      if (storedUserId === 'default-user') {
        await AsyncStorage.removeItem('userId');
        const { clearAccessToken } = require('@/utils/api');
        await clearAccessToken();
        setUser(null);
        setIsAuthenticated(false);
        setHasLoggedOut(true);
        setIsLoading(false);
        return;
      }
      
      // If user ID exists and is not default-user, use it (normal flow)
      if (storedUserId) {
        // Fetch access token first
        try {
          const { setAccessToken } = require('@/utils/api');
          const tokenResponse = await fetch(`${API_ENDPOINTS.AUTH.TOKEN}?userId=${storedUserId}`);
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            if (tokenData.accessToken) {
              await setAccessToken(tokenData.accessToken);
            }
          }
        } catch (error) {
          // Ignore token fetch errors
        }
        
        // Fetch user info from backend
        const response = await fetch(`${API_ENDPOINTS.AUTH.ME}?userId=${storedUserId}`);
        
        if (response.ok) {
          const userData = await response.json();
          
          // If backend somehow returns default-user, treat as logged out
          if (userData.id === 'default-user') {
            await AsyncStorage.removeItem('userId');
            const { clearAccessToken } = require('@/utils/api');
            await clearAccessToken();
            setUser(null);
            setIsAuthenticated(false);
            setHasLoggedOut(true);
            setIsLoading(false);
            return;
          }

          setUser({
            id: userData.id,
            email: userData.email,
            name: userData.username || userData.email,
            picture: userData.picture || undefined,
            plan: userData.plan || 'free',
          });
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        } else {
          // User not found, clear storage
          await AsyncStorage.removeItem('userId');
          const { clearAccessToken } = require('@/utils/api');
          await clearAccessToken();
          setUser(null);
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }
      }
      
      // No user found - show login screen
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (userData: User) => {
    try {
      // Store user ID
      await AsyncStorage.setItem('userId', userData.id);
      // Clear logout flag on successful login
      await AsyncStorage.removeItem('hasLoggedOut');
      setUser(userData);
      setIsAuthenticated(true);
      setHasLoggedOut(false);
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('userId');
      // Clear access token
      const { clearAccessToken } = require('@/utils/api');
      await clearAccessToken();
      // Reset AI disclaimer acknowledgment so it shows again next login
      await storage.removeItem(STORAGE_KEYS.AI_DISCLAIMER_ACKNOWLEDGED);
      // Persist logout flag so test mode doesn't auto-login again
      await AsyncStorage.setItem('hasLoggedOut', 'true');
      setUser(null);
      setIsAuthenticated(false);
      setHasLoggedOut(true);
      
      // Force navigation to login
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.replace('/login');
      } else {
        router.replace('/login');
      }
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    reload: loadUser,
  };
}

