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
  Modal,
} from 'react-native';
import { supabase } from '../supabaseClient';
import { launchImageLibrary } from 'react-native-image-picker';

interface ProfileComponentsProps {
  onLogout?: () => void;
}

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

interface UserComplex {
  id: string;
  category: string;
  level: number;
}

const generateLevels = (max: number, unit: string = '') => {
  return Array.from({ length: max }, (_, i) => ({
    level: i + 1,
    label: `レベル${i + 1}`,
    description: unit ? `${(i + 1) * 10}${unit}` : `レベル${i + 1}`,
  }));
};

const COMPLEX_CATEGORIES = [
  { 
    key: 'appearance', 
    label: '容姿', 
    icon: '👤',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'debt', 
    label: '借金', 
    icon: '💰',
    maxLevel: 100,
    levels: Array.from({ length: 100 }, (_, i) => ({
      level: i + 1,
      label: `${(i + 1) * 10}万円`,
      description: `${(i + 1) * 10}万円`,
    }))
  },
  { 
    key: 'job', 
    label: '仕事', 
    icon: '💼',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'education', 
    label: '学歴', 
    icon: '🎓',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'health', 
    label: '健康', 
    icon: '🏥',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'relationship', 
    label: '人間関係', 
    icon: '👥',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'family', 
    label: '家族', 
    icon: '👨‍👩‍👧',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'income', 
    label: '収入', 
    icon: '💵',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'age', 
    label: '年齢', 
    icon: '🎂',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'personality', 
    label: '性格', 
    icon: '🎭',
    maxLevel: 10,
    levels: generateLevels(10)
  },
];

function ProfileComponents({ onLogout }: ProfileComponentsProps) {
  const isDarkMode = useColorScheme() === 'dark';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [userComplexes, setUserComplexes] = useState<UserComplex[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [totalComplexLevel, setTotalComplexLevel] = useState<number>(0);

  useEffect(() => {
    fetchProfile();
    
    const followsSubscription = supabase
      .channel('profile_follows_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows' },
        () => {
          fetchFollowCounts();
        }
      )
      .subscribe();

    return () => {
      followsSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    calculateTotalComplexLevel();
  }, [userComplexes]);

  const calculateTotalComplexLevel = () => {
    if (userComplexes.length === 0) {
      setTotalComplexLevel(0);
      return;
    }

    let totalScore = 0;

    userComplexes.forEach(userComplex => {
      const category = COMPLEX_CATEGORIES.find(c => c.key === userComplex.category);
      if (category) {
        totalScore += userComplex.level;
      }
    });

    const clampedLevel = Math.min(100, totalScore);
    setTotalComplexLevel(clampedLevel);
  };

  const updateProfileComplexLevel = async (level: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          complex_level: level,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('総合レベル更新エラー:', error);
      }
    } catch (error) {
      console.error('予期しないエラー:', error);
    }
  };

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

      await fetchFollowCounts();
      await fetchUserComplexes();
    } catch (error) {
      console.error('予期しないエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { count: followersCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      const { count: followingCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      setFollowersCount(followersCount || 0);
      setFollowingCount(followingCount || 0);
    } catch (error) {
      console.error('フォロー数取得エラー:', error);
    }
  };

  const fetchUserComplexes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from('user_complexes')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('コンプレックス取得エラー:', error);
        return;
      }

      setUserComplexes(data || []);
    } catch (error) {
      console.error('予期しないエラー:', error);
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

  const openComplexModal = (categoryKey: string) => {
    const category = COMPLEX_CATEGORIES.find(c => c.key === categoryKey);
    const existing = userComplexes.find(c => c.category === categoryKey);
    
    setSelectedCategory(categoryKey);
    setSelectedLevel(existing?.level || 1);
    setModalVisible(true);
  };

  const saveComplex = async () => {
    if (!selectedCategory) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('エラー', 'ログインが必要です');
        return;
      }

      const { error } = await supabase
        .from('user_complexes')
        .upsert({
          user_id: user.id,
          category: selectedCategory,
          level: selectedLevel,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,category'
        });

      if (error) {
        Alert.alert('保存エラー', error.message);
        return;
      }

      setModalVisible(false);
      await fetchUserComplexes();
      
      setTimeout(() => {
        updateProfileComplexLevel(totalComplexLevel);
      }, 100);
    } catch (error) {
      Alert.alert('エラー', '予期しないエラーが発生しました');
      console.error(error);
    }
  };

  const removeComplex = async (category: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from('user_complexes')
        .delete()
        .eq('user_id', user.id)
        .eq('category', category);

      if (error) {
        Alert.alert('削除エラー', error.message);
        return;
      }

      await fetchUserComplexes();
      
      setTimeout(() => {
        updateProfileComplexLevel(totalComplexLevel);
      }, 100);
    } catch (error) {
      Alert.alert('エラー', '予期しないエラーが発生しました');
      console.error(error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'ログアウト',
      'ログアウトしますか?',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: () => {
            if (onLogout) {
              onLogout();
            }
          }
        }
      ]
    );
  };

  const getLevelColor = (level: number) => {
    if (level <= 20) return '#4CAF50';
    if (level <= 40) return '#8BC34A';
    if (level <= 60) return '#FFC107';
    if (level <= 80) return '#FF9800';
    return '#F44336';
  };

  const getCategoryData = (categoryKey: string) => {
    return COMPLEX_CATEGORIES.find(c => c.key === categoryKey);
  };

  const getCategoryLabel = (category: string) => {
    return COMPLEX_CATEGORIES.find(c => c.key === category)?.label || category;
  };

  const getCategoryIcon = (category: string) => {
    return COMPLEX_CATEGORIES.find(c => c.key === category)?.icon || '📌';
  };

  if (loading) {
    return (
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#1DA1F2" />
      </View>
    );
  }

  const selectedCategoryData = selectedCategory ? getCategoryData(selectedCategory) : null;

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

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: isDarkMode ? '#fff' : '#000' }]}>
            {followersCount}
          </Text>
          <Text style={[styles.statLabel, { color: isDarkMode ? '#888' : '#666' }]}>
            フォロワー
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: isDarkMode ? '#fff' : '#000' }]}>
            {followingCount}
          </Text>
          <Text style={[styles.statLabel, { color: isDarkMode ? '#888' : '#666' }]}>
            フォロー中
          </Text>
        </View>
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
        <View style={styles.complexHeader}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
            コンプレックス
          </Text>
          <View style={[styles.totalLevelBadge, { backgroundColor: getLevelColor(totalComplexLevel) }]}>
            <Text style={styles.totalLevelText}>
              総合レベル {totalComplexLevel}/100
            </Text>
          </View>
        </View>
        
        <View style={styles.complexCategoriesContainer}>
          {COMPLEX_CATEGORIES.map((category) => {
            const userComplex = userComplexes.find(c => c.category === category.key);
            const isSelected = !!userComplex;

            return (
              <TouchableOpacity
                key={category.key}
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: isSelected
                      ? (isDarkMode ? '#0a2a3a' : '#e3f2fd')
                      : (isDarkMode ? '#1a1a1a' : '#f5f5f5'),
                    borderColor: isSelected
                      ? getLevelColor(userComplex?.level || 0)
                      : (isDarkMode ? '#333' : '#ddd'),
                  }
                ]}
                onPress={() => openComplexModal(category.key)}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                  <Text style={[styles.categoryLabel, { color: isDarkMode ? '#fff' : '#000' }]}>
                    {category.label}
                  </Text>
                  {isSelected && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        removeComplex(category.key);
                      }}>
                      <Text style={styles.removeButtonText}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {isSelected && (
                  <View style={styles.categoryLevel}>
                    <Text style={[styles.levelIndicator, { color: getLevelColor(userComplex?.level || 0) }]}>
                      Lv.{userComplex?.level}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
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

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>ログアウト</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                {selectedCategory && getCategoryIcon(selectedCategory)} {selectedCategory && getCategoryLabel(selectedCategory)}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.closeButton, { color: isDarkMode ? '#fff' : '#000' }]}>×</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: isDarkMode ? '#888' : '#666' }]}>
              レベルを選択してください (最大: {selectedCategoryData?.maxLevel})
            </Text>

            <ScrollView style={styles.levelSelectionContainer}>
              {selectedCategoryData?.levels.map((level) => (
                <TouchableOpacity
                  key={level.level}
                  style={[
                    styles.levelSelectionButton,
                    {
                      backgroundColor: selectedLevel === level.level
                        ? getLevelColor(level.level)
                        : isDarkMode ? '#1a1a1a' : '#f5f5f5',
                      borderColor: selectedLevel === level.level
                        ? getLevelColor(level.level)
                        : isDarkMode ? '#333' : '#ddd',
                    },
                  ]}
                  onPress={() => setSelectedLevel(level.level)}>
                  <Text
                    style={[
                      styles.levelSelectionLabel,
                      {
                        color: selectedLevel === level.level
                          ? '#fff'
                          : isDarkMode ? '#fff' : '#000',
                      },
                    ]}>
                    {level.label}
                  </Text>
                  <Text
                    style={[
                      styles.levelSelectionDescription,
                      {
                        color: selectedLevel === level.level
                          ? '#fff'
                          : isDarkMode ? '#888' : '#666',
                      },
                    ]}>
                    {level.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={saveComplex}>
              <Text style={styles.modalSaveButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: 20,
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 15,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#333',
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
  complexHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  totalLevelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  totalLevelText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  complexCategoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '48%',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  removeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryLevel: {
    marginTop: 5,
  },
  levelIndicator: {
    fontSize: 12,
    fontWeight: '600',
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
    marginBottom: 10,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    height: 50,
    backgroundColor: '#F44336',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    fontSize: 32,
    fontWeight: '300',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  levelSelectionContainer: {
    maxHeight: 400,
    marginBottom: 20,
  },
  levelSelectionButton: {
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    marginBottom: 10,
  },
  levelSelectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  levelSelectionDescription: {
    fontSize: 14,
  },
  modalSaveButton: {
    height: 50,
    backgroundColor: '#1DA1F2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileComponents;