import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// 本番用AdMob IDに置き換えてください
const adUnitId = __DEV__ 
  ? TestIds.BANNER 
  : Platform.select({
      ios: 'ca-app-pub-4317478239934902/2294470970',
      android: 'ca-app-pub-4317478239934902~8716409090',
    });

export default function AdBanner() {
  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId!}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 5,
  },
});