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
  ScrollView,
  Image,
} from 'react-native';
import { supabase } from '../supabaseClient';
import { launchImageLibrary } from 'react-native-image-picker';

interface Profile {
  id: string;
  email: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  complex_level: number;
}

const COMPLEX_LEVELS = [
  { level: 1, label: 'レベル1', description: '少し気になる' },
  { level: 2, label: 'レベル2', description: '気になる' },
  { level: 3, label: 'レベル3', description: 'かなり気になる' },
  { level: 4, label: 'レベル4', description: '非常に気になる' },
  { level: 5, label: 'レベル5', description: '深刻に悩んでいる' },
];

function ProfileComponents() {
  const isDarkMode = useColorScheme() === 'dark';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [complexLevel, setComplexLevel] = useState<number>(1);

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
      setName(data.name || '');
      setBio(data.bio || '');
      setAvatarUrl(data.avatar_url);
      setComplexLevel(data.complex_level || 1);
    } catch (error) {
      console.error('予期しないエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.didCancel) {
      return;
    }

    if (result.errorCode) {
      Alert.alert('エラー', '画像の選択に失敗しました');
      return;
    }

    if (result.assets && result.assets[0]) {
      await uploadImage(result.assets[0]);
    }
  };

  const uploadImage = async (asset: any) => {
    if (!asset.uri) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('エラー', 'ログインが必要です');
        setUploading(false);
        return;
      }

      const fileExt = asset.fileName?.split('.').pop() || 'jpg';
      const filePath = `${user.id}/avatar.${fileExt}`;

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: `avatar.${fileExt}`,
      } as any);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, formData, {
          upsert: true,
          contentType: asset.type || 'image/jpeg',
        });

      if (uploadError) {
        Alert.alert('アップロードエラー', uploadError.message);
        setUploading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        Alert.alert('更新エラー', updateError.message);
        setUploading(false);
        return;
      }

      setAvatarUrl(publicUrl);
      Alert.alert('成功', 'プロフィール画像を更新しました');
    } catch (error) {
      Alert.alert('エラー', '予期しないエラーが発生しました');
      console.error(error);
    } finally {
      setUploading(false);
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
          name: name || null,
          bio: bio || null,
          complex_level: complexLevel,
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
    <ScrollView style={styles.container}>
      <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>
        プロフィール設定
      </Text>

      <View style={styles.avatarContainer}>
        <TouchableOpacity onPress={pickImage} disabled={uploading}>
          <View style={styles.avatarWrapper}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
                <Text style={styles.avatarPlaceholderText}>📷</Text>
              </View>
            )}
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </View>
        </TouchableOpacity>
        <Text style={[styles.avatarHint, { color: isDarkMode ? '#888' : '#666' }]}>
          タップして画像を変更
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>
          名前
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
          placeholder="名前"
          placeholderTextColor={isDarkMode ? '#888' : '#999'}
          value={name}
          onChangeText={setName}
          editable={!saving}
        />
      </View>

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

      <View style={styles.inputContainer}>
        <Text style={[styles.label, { color: isDarkMode ? '#fff' : '#000' }]}>
          紹介文
        </Text>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
              color: isDarkMode ? '#fff' : '#000',
              borderColor: isDarkMode ? '#333' : '#ddd',
            },
          ]}
          placeholder="自己紹介を入力してください"
          placeholderTextColor={isDarkMode ? '#888' : '#999'}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!saving}
        />
      </View>

      <View style={styles.complexContainer}>
        <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
          コンプレックスレベル
        </Text>
        
        <View style={styles.complexLevelContainer}>
          {COMPLEX_LEVELS.map((level) => (
            <TouchableOpacity
              key={level.level}
              style={[
                styles.complexLevelButton,
                {
                  backgroundColor: complexLevel === level.level
                    ? '#1DA1F2'
                    : isDarkMode ? '#1a1a1a' : '#f5f5f5',
                  borderColor: complexLevel === level.level
                    ? '#1DA1F2'
                    : isDarkMode ? '#333' : '#ddd',
                },
              ]}
              onPress={() => setComplexLevel(level.level)}
              disabled={saving}>
              <Text
                style={[
                  styles.complexLevelLabel,
                  {
                    color: complexLevel === level.level
                      ? '#fff'
                      : isDarkMode ? '#fff' : '#000',
                  },
                ]}>
                {level.label}
              </Text>
              <Text
                style={[
                  styles.complexLevelDescription,
                  {
                    color: complexLevel === level.level
                      ? '#fff'
                      : isDarkMode ? '#888' : '#666',
                  },
                ]}>
                {level.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
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
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 48,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: {
    marginTop: 10,
    fontSize: 14,
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
  textArea: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  complexContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  complexLevelContainer: {
    gap: 10,
  },
  complexLevelButton: {
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
  },
  complexLevelLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  complexLevelDescription: {
    fontSize: 14,
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
    marginBottom: 40,
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