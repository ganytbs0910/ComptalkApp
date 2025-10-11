import React, { useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import Home from './Scripts/Home/HomeComponents';
import Search from './Scripts/Search/SearchComponents';
import Notifications from './Scripts/Notifications/NotificationsComponents';
import Profile from './Scripts/Profile/ProfileComponents';
import Auth from './Scripts/Auth/AuthComponents';

type TabType = 'home' | 'search' | 'notifications' | 'profile';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#000' : '#fff',
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={[styles.container, backgroundStyle]}>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor={backgroundStyle.backgroundColor}
        />
        <Auth onLoginSuccess={() => setIsLoggedIn(true)} />
      </SafeAreaView>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Home />;
      case 'search':
        return <Search />;
      case 'notifications':
        return <Notifications />;
      case 'profile':
        return <Profile />;
    }
  };

  return (
    <SafeAreaView style={[styles.container, backgroundStyle]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>
      
      <View style={[styles.tabBar, { borderTopColor: isDarkMode ? '#333' : '#e0e0e0' }]}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('home')}>
          <Text style={[styles.tabIcon, activeTab !== 'home' && styles.inactiveIcon]}>
            🏠
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('search')}>
          <Text style={[styles.tabIcon, activeTab !== 'search' && styles.inactiveIcon]}>
            🔍
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('notifications')}>
          <Text style={[styles.tabIcon, activeTab !== 'notifications' && styles.inactiveIcon]}>
            🔔
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('profile')}>
          <Text style={[styles.tabIcon, activeTab !== 'profile' && styles.inactiveIcon]}>
            👤
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabIcon: {
    fontSize: 24,
  },
  inactiveIcon: {
    opacity: 0.4,
  },
});

export default App;