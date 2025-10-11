import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../supabaseClient';

interface AuthComponentsProps {
  onLoginSuccess: () => void;
}

function AuthComponents({ onLoginSuccess }: AuthComponentsProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('エラー', 'メールアドレスとパスワードを入力してください');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // ログイン処理
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) {
          Alert.alert('ログインエラー', error.message);
          setLoading(false);
          return;
        }

        if (data.session) {
          onLoginSuccess();
        }
      } else {
        // アカウント作成処理
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
        });

        if (error) {
          Alert.alert('アカウント作成エラー', error.message);
          setLoading(false);
          return;
        }

        if (data.session) {
          onLoginSuccess();
        } else {
          Alert.alert(
            '確認メール送信',
            'アカウント作成のための確認メールを送信しました。メールを確認してください。'
          );
        }
      }
    } catch (error) {
      Alert.alert('エラー', '予期しないエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>
        {isLogin ? 'ログイン' : 'アカウント作成'}
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
        editable={!loading}
      />

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
            color: isDarkMode ? '#fff' : '#000',
            borderColor: isDarkMode ? '#333' : '#ddd',
          },
        ]}
        placeholder="パスワード"
        placeholderTextColor={isDarkMode ? '#888' : '#999'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {isLogin ? 'ログイン' : 'アカウント作成'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsLogin(!isLogin)} disabled={loading}>
        <Text style={[styles.switchText, { color: isDarkMode ? '#1DA1F2' : '#1DA1F2' }]}>
          {isLogin ? 'アカウントを作成' : 'ログインはこちら'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 500,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 40,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#1DA1F2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchText: {
    marginTop: 20,
    fontSize: 14,
  },
});

export default AuthComponents;