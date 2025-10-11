import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import Home from './Scripts/Home/HomeComponents';
import Search from './Scripts/Search/SearchComponents';
import Notifications from './Scripts/Notifications/NotificationsComponents';
import Profile from './Scripts/Profile/ProfileComponents';
import Bookmarks from './Scripts/Profile/BookmarksComponents';
import Auth from './Scripts/Auth/AuthComponents';
import Messages from './Scripts/Messages/MessagesComponents';
import { supabase } from './Scripts/supabaseClient';

type TabType = 'home' | 'search' | 'bookmarks' | 'notifications' | 'messages' | 'profile';

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    checkAuth();

    const authSubscription = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
      if (session) {
        fetchUnreadCounts(session.user.id);
      }
    });

    return () => {
      authSubscription.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      const interval = setInterval(() => {
        checkAuth();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      if (session) {
        fetchUnreadCounts(session.user.id);
      }
    } catch (error) {
      console.error('認証チェックエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCounts = async (userId: string) => {
    try {
      const { count: notificationsCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      setUnreadNotifications(notificationsCount || 0);

      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

      if (conversations) {
        let totalUnread = 0;
        for (const conv of conversations) {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', userId);
          
          totalUnread += count || 0;
        }
        setUnreadMessages(totalUnread);
      }
    } catch (error) {
      console.error('未読数取得エラー:', error);
    }
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    checkAuth();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setActiveTab('home');
    setUnreadNotifications(0);
    setUnreadMessages(0);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Home />;
      case 'search':
        return <Search />;
      case 'bookmarks':
        return <Bookmarks />;
      case 'notifications':
        return <Notifications />;
      case 'messages':
        return <Messages />;
      case 'profile':
        return <Profile onLogout={handleLogout} />;
      default:
        return <Home />;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: isDarkMode ? '#fff' : '#000' }]}>
            読み込み中...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <Auth onLoginSuccess={handleLoginSuccess} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      <View style={styles.mainContent}>
        {renderContent()}
      </View>

      <View style={[styles.bottomNav, { 
        backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
        borderTopColor: isDarkMode ? '#333' : '#e0e0e0'
      }]}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setActiveTab('home')}>
          <Image
            source={require('./assets/icon/home.png')}
            style={[
              styles.navIcon,
              activeTab === 'home' && styles.navIconActive,
              { tintColor: activeTab === 'home' ? '#1DA1F2' : (isDarkMode ? '#fff' : '#000') }
            ]}
          />
          <Text style={[
            styles.navLabel,
            { color: isDarkMode ? '#fff' : '#000' },
            activeTab === 'home' && styles.navLabelActive
          ]}>ホーム</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setActiveTab('search')}>
          <Image
            source={require('./assets/icon/search.png')}
            style={[
              styles.navIcon,
              activeTab === 'search' && styles.navIconActive,
              { tintColor: activeTab === 'search' ? '#1DA1F2' : (isDarkMode ? '#fff' : '#000') }
            ]}
          />
          <Text style={[
            styles.navLabel,
            { color: isDarkMode ? '#fff' : '#000' },
            activeTab === 'search' && styles.navLabelActive
          ]}>検索</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setActiveTab('bookmarks')}>
          <Image
            source={require('./assets/icon/book.png')}
            style={[
              styles.navIcon,
              activeTab === 'bookmarks' && styles.navIconActive,
              { tintColor: activeTab === 'bookmarks' ? '#1DA1F2' : (isDarkMode ? '#fff' : '#000') }
            ]}
          />
          <Text style={[
            styles.navLabel,
            { color: isDarkMode ? '#fff' : '#000' },
            activeTab === 'bookmarks' && styles.navLabelActive
          ]}>保存</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setActiveTab('notifications')}>
          <View style={styles.navButtonContent}>
            <Image
              source={require('./assets/icon/notification.png')}
              style={[
                styles.navIcon,
                activeTab === 'notifications' && styles.navIconActive,
                { tintColor: activeTab === 'notifications' ? '#1DA1F2' : (isDarkMode ? '#fff' : '#000') }
              ]}
            />
            {unreadNotifications > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </Text>
              </View>
            )}
          </View>
          <Text style={[
            styles.navLabel,
            { color: isDarkMode ? '#fff' : '#000' },
            activeTab === 'notifications' && styles.navLabelActive
          ]}>通知</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setActiveTab('messages')}>
          <View style={styles.navButtonContent}>
            <Image
              source={require('./assets/icon/comment.png')}
              style={[
                styles.navIcon,
                activeTab === 'messages' && styles.navIconActive,
                { tintColor: activeTab === 'messages' ? '#1DA1F2' : (isDarkMode ? '#fff' : '#000') }
              ]}
            />
            {unreadMessages > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </Text>
              </View>
            )}
          </View>
          <Text style={[
            styles.navLabel,
            { color: isDarkMode ? '#fff' : '#000' },
            activeTab === 'messages' && styles.navLabelActive
          ]}>DM</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => setActiveTab('profile')}>
          <Image
            source={require('./assets/icon/profile.png')}
            style={[
              styles.navIcon,
              activeTab === 'profile' && styles.navIconActive,
              { tintColor: activeTab === 'profile' ? '#1DA1F2' : (isDarkMode ? '#fff' : '#000') }
            ]}
          />
          <Text style={[
            styles.navLabel,
            { color: isDarkMode ? '#fff' : '#000' },
            activeTab === 'profile' && styles.navLabelActive
          ]}>プロフィール</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingBottom: 4,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  navButtonContent: {
    position: 'relative',
  },
  navIcon: {
    width: 24,
    height: 24,
    marginBottom: 2,
    opacity: 0.6,
    tintColor: '#000',
  },
  navIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
    tintColor: '#1DA1F2',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.6,
  },
  navLabelActive: {
    opacity: 1,
    color: '#1DA1F2',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});