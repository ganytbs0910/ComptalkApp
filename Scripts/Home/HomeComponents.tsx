import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { supabase } from '../supabaseClient';

interface Post {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    name: string | null;
    avatar_url: string | null;
    complex_level: number;
  };
}

export default function Home() {
  const isDarkMode = useColorScheme() === 'dark';
  const [modalVisible, setModalVisible] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (
            name,
            avatar_url,
            complex_level
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('投稿取得エラー:', error);
        return;
      }

      setPosts(data || []);
    } catch (error) {
      console.error('予期しないエラー:', error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handlePost = async () => {
    if (!postContent.trim()) {
      Alert.alert('エラー', '投稿内容を入力してください');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('エラー', 'ログインが必要です');
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('posts')
        .insert([
          {
            content: postContent,
            user_id: user.id,
          },
        ]);

      if (error) {
        Alert.alert('投稿エラー', error.message);
        setLoading(false);
        return;
      }

      setPostContent('');
      setModalVisible(false);
      Alert.alert('成功', '投稿しました');
      fetchPosts();
    } catch (error) {
      Alert.alert('エラー', '予期しないエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: number) => {
    const colors = {
      1: '#4CAF50',
      2: '#8BC34A',
      3: '#FFC107',
      4: '#FF9800',
      5: '#F44336',
    };
    return colors[level as keyof typeof colors] || '#888';
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={[styles.postCard, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          {item.profiles?.avatar_url ? (
            <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#333' : '#ddd' }]}>
              <Text style={styles.avatarPlaceholderText}>👤</Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: isDarkMode ? '#fff' : '#000' }]}>
              {item.profiles?.name || '名前未設定'}
            </Text>
            <View style={styles.levelBadge}>
              <Text style={[styles.levelText, { color: getLevelColor(item.profiles?.complex_level || 1) }]}>
                コンプレックスレベル {item.profiles?.complex_level || 1}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <Text style={[styles.postContent, { color: isDarkMode ? '#fff' : '#000' }]}>
        {item.content}
      </Text>
      <Text style={styles.postTime}>
        {new Date(item.created_at).toLocaleString('ja-JP')}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loadingPosts ? (
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#1DA1F2" />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.content}>
          <Text style={[styles.emptyText, { color: isDarkMode ? '#fff' : '#000' }]}>
            まだ投稿がありません
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.postList}
        />
      )}

      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setModalVisible(true)}>
        <Text style={styles.floatingButtonText}>✏️</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.cancelButton, { color: isDarkMode ? '#fff' : '#000' }]}>
                  キャンセル
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.postButton, loading && styles.postButtonDisabled]}
                onPress={handlePost}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.postButtonText}>投稿</Text>
                )}
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.textInput,
                { color: isDarkMode ? '#fff' : '#000' }
              ]}
              placeholder="いまどうしてる?"
              placeholderTextColor={isDarkMode ? '#888' : '#999'}
              value={postContent}
              onChangeText={setPostContent}
              multiline
              autoFocus
              editable={!loading}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 500,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
  },
  postList: {
    padding: 10,
  },
  postCard: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  postHeader: {
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 24,
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  levelBadge: {
    alignSelf: 'flex-start',
  },
  levelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  postContent: {
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 22,
  },
  postTime: {
    fontSize: 12,
    color: '#888',
  },
  floatingButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1DA1F2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingButtonText: {
    fontSize: 24,
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
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelButton: {
    fontSize: 16,
  },
  postButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.6,
  },
  postButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  textInput: {
    fontSize: 18,
    minHeight: 150,
    textAlignVertical: 'top',
  },
});