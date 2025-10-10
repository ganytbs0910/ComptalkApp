import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

type TabType = 'home' | 'search' | 'notifications' | 'profile';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [activeTab, setActiveTab] = useState<TabType>('home');

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#000' : '#fff',
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <View style={styles.content}>
            <Text style={[styles.contentText, { color: isDarkMode ? '#fff' : '#000' }]}>
              ホーム画面
            </Text>
          </View>
        );
      case 'search':
        return (
          <View style={styles.content}>
            <Text style={[styles.contentText, { color: isDarkMode ? '#fff' : '#000' }]}>
              検索画面
            </Text>
          </View>
        );
      case 'notifications':
        return (
          <View style={styles.content}>
            <Text style={[styles.contentText, { color: isDarkMode ? '#fff' : '#000' }]}>
              通知画面
            </Text>
          </View>
        );
      case 'profile':
        return (
          <View style={styles.content}>
            <Text style={[styles.contentText, { color: isDarkMode ? '#fff' : '#000' }]}>
              プロフィール画面
            </Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, backgroundStyle]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}>
        {renderContent()}
      </ScrollView>
      
      <View style={[styles.tabBar, { borderTopColor: isDarkMode ? '#333' : '#e0e0e0' }]}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('home')}>
          <Text style={[styles.tabText, activeTab === 'home' && styles.activeTabText]}>
            ホーム
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('search')}>
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
            検索
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('notifications')}>
          <Text style={[styles.tabText, activeTab === 'notifications' && styles.activeTabText]}>
            通知
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('profile')}>
          <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>
            プロフィール
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 500,
  },
  contentText: {
    fontSize: 24,
    fontWeight: '600',
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
  tabText: {
    fontSize: 14,
    color: '#888',
  },
  activeTabText: {
    color: '#1DA1F2',
    fontWeight: '600',
  },
});

export default App;