import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';

export default function Home() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <View style={styles.content}>
      <Text style={[styles.contentText, { color: isDarkMode ? '#fff' : '#000' }]}>
        ホーム画面
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});