import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../supabaseClient';

interface Profile {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

function ProfileComponents() {
  const isDarkMode = useColorScheme() === 'dark';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('エラー', 'ログインが必要です');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('プロフィール取得エラー:', error);
        return;
      }

      setProfile(data);
      setEmail(data.email || '');
    } catch (error) {
      console.error('予期しないエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!email.trim()) {
      Alert.alert('エラー', 'メールアドレスを入力してください');
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('エラー', 'ログインが必要です');
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          email: email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert('保存エラー', error.message);
        setSaving(false);
        return;
      }

      Alert.alert('成功', 'プロフィールを更新しました');
      fetchProfile();
    } catch (error) {
      Alert.alert('エラー', '予期しないエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#1DA1F2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>
        プロフィール設定
      </Text>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>
          メールアドレス
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
              color: isDarkMode ? '#fff' : '#000',
              borderColor: isDarkMode ? '#333' : '#ddd',
            },
          ]}
          placeholder="メールアドレス"
          placeholderTextColor={isDarkMode ? '#888' : '#999'}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!saving}
        />
      </View>

      {profile && (
        <View style={styles.infoContainer}>
          <Text style={[styles.infoText, { color: isDarkMode ? '#888' : '#666' }]}>
            作成日: {new Date(profile.created_at).toLocaleString('ja-JP')}
          </Text>
          <Text style={[styles.infoText, { color: isDarkMode ? '#888' : '#666' }]}>
            更新日: {new Date(profile.updated_at).toLocaleString('ja-JP')}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>保存</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    minHeight: 500,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 500,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  infoContainer: {
    marginTop: 20,
    marginBottom: 30,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5,
  },
  saveButton: {
    height: 50,
    backgroundColor: '#1DA1F2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileComponents;