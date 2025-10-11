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
  likes_count: number;
  shares_count: number;
}

export default function Home() {
  const isDarkMode = useColorScheme() === 'dark';
  const [modalVisible, setModalVisible] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userLikedPosts, setUserLikedPosts] = useState<Set<string>>(new Set());
  const [userSharedPosts, setUserSharedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    getCurrentUser();
    fetchPosts();

    // いいねと共有のリアルタイム更新を購読
    const likesSubscription = supabase
      .channel('likes_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'likes' },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    const sharesSubscription = supabase
      .channel('shares_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shares' },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      likesSubscription.unsubscribe();
      sharesSubscription.unsubscribe();
    };
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date().getTime();
    const postTime = new Date(timestamp).getTime();
    const diffInSeconds = Math.floor((now - postTime) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds}秒前`;
    } else if (diffInSeconds < 3600) {
      return `${Math.floor(diffInSeconds / 60)}分前`;
    } else if (diffInSeconds < 86400) {
      return `${Math.floor(diffInSeconds / 3600)}時間前`;
    } else {
      return `${Math.floor(diffInSeconds / 86400)}日前`;
    }
  };

  const fetchPosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

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

      if (!data) {
        setPosts([]);
        return;
      }

      // いいねと共有の数を取得
      const postsWithCounts = await Promise.all(
        data.map(async (post) => {
          const { count: likesCount } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);

          const { count: sharesCount } = await supabase
            .from('shares')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);

          return {
            ...post,
            likes_count: likesCount || 0,
            shares_count: sharesCount || 0,
          };
        })
      );

      setPosts(postsWithCounts);

      // ユーザーがいいね・共有した投稿を取得
      if (user) {
        const { data: likedData } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', user.id);

        const { data: sharedData } = await supabase
          .from('shares')
          .select('post_id')
          .eq('user_id', user.id);

        if (likedData) {
          setUserLikedPosts(new Set(likedData.map(like => like.post_id)));
        }

        if (sharedData) {
          setUserSharedPosts(new Set(sharedData.map(share => share.post_id)));
        }
      }
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

  const handleLike = async (postId: string) => {
    if (!currentUserId) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    // 既にいいね済みの場合は何もしない
    if (userLikedPosts.has(postId)) {
      return;
    }

    // 楽観的UI更新: いいね済みとして即座にマークし、カウントを+1
    setUserLikedPosts(prev => new Set([...prev, postId]));
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { ...post, likes_count: post.likes_count + 1 }
          : post
      )
    );

    try {
      // いいねを追加
      const { error } = await supabase
        .from('likes')
        .insert({ post_id: postId, user_id: currentUserId });

      if (error) {
        // エラーが発生した場合は楽観的更新を元に戻す
        setUserLikedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { ...post, likes_count: post.likes_count - 1 }
              : post
          )
        );
        console.error('いいねエラー:', error);
      }
      // 成功した場合、リアルタイム購読が自動的にfetchPostsを呼び出す
    } catch (error) {
      // エラーが発生した場合は楽観的更新を元に戻す
      setUserLikedPosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, likes_count: post.likes_count - 1 }
            : post
        )
      );
      console.error('いいねエラー:', error);
    }
  };

  const handleShare = async (postId: string) => {
    if (!currentUserId) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    // 既に共有済みの場合は何もしない
    if (userSharedPosts.has(postId)) {
      return;
    }

    // 楽観的UI更新: 共有済みとして即座にマークし、カウントを+1
    setUserSharedPosts(prev => new Set([...prev, postId]));
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { ...post, shares_count: post.shares_count + 1 }
          : post
      )
    );

    try {
      // 共有を追加
      const { error } = await supabase
        .from('shares')
        .insert({ post_id: postId, user_id: currentUserId });

      if (error) {
        // エラーが発生した場合は楽観的更新を元に戻す
        setUserSharedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { ...post, shares_count: post.shares_count - 1 }
              : post
          )
        );
        console.error('共有エラー:', error);
      }
      // 成功した場合、リアルタイム購読が自動的にfetchPostsを呼び出す
    } catch (error) {
      // エラーが発生した場合は楽観的更新を元に戻す
      setUserSharedPosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, shares_count: post.shares_count - 1 }
            : post
        )
      );
      console.error('共有エラー:', error);
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

  const renderPost = ({ item }: { item: Post }) => {
    const isLiked = userLikedPosts.has(item.id);
    const isShared = userSharedPosts.has(item.id);

    return (
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
          <Text style={styles.postTime}>
            {getTimeAgo(item.created_at)}
          </Text>
        </View>
        <Text style={[styles.postContent, { color: isDarkMode ? '#fff' : '#000' }]}>
          {item.content}
        </Text>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, isLiked && styles.actionButtonActive]}
            onPress={() => handleLike(item.id)}
            disabled={isLiked}>
            <Text style={[styles.actionIcon, isLiked && styles.actionIconActive]}>❤️</Text>
            <Text style={[styles.actionCount, { color: isDarkMode ? '#fff' : '#000' }]}>
              {item.likes_count}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, isShared && styles.actionButtonActive]}
            onPress={() => handleShare(item.id)}
            disabled={isShared}>
            <Text style={[styles.actionIcon, isShared && styles.actionIconActive]}>🔁</Text>
            <Text style={[styles.actionCount, { color: isDarkMode ? '#fff' : '#000' }]}>
              {item.shares_count}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    marginBottom: 12,
    lineHeight: 22,
  },
  postTime: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(29, 161, 242, 0.1)',
  },
  actionIcon: {
    fontSize: 20,
    opacity: 0.6,
  },
  actionIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  actionCount: {
    fontSize: 14,
    fontWeight: '600',
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