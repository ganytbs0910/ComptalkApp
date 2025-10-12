import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { supabase } from '../supabaseClient';
import { COMPLEX_CATEGORIES, getCategoryLabel, getCategoryIcon } from '../constants/complexCategories';

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
  replies_count: number;
  post_complexes?: Array<{ category: string }>;
  bookmarked_at: string;
}

interface Reply {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    name: string | null;
    avatar_url: string | null;
    complex_level: number;
  };
}

function BookmarksComponents() {
  const isDarkMode = useColorScheme() === 'dark';
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  useEffect(() => {
    getCurrentUser();
    fetchBookmarks();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const fetchBookmarks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: bookmarks, error } = await supabase
        .from('bookmarks')
        .select(`
          post_id,
          created_at,
          posts (
            id,
            content,
            created_at,
            user_id,
            profiles (
              name,
              avatar_url,
              complex_level
            ),
            post_complexes (
              category
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('ブックマーク取得エラー:', error);
        return;
      }

      if (!bookmarks) {
        setBookmarkedPosts([]);
        return;
      }

      const postsWithCounts = await Promise.all(
        bookmarks
          .filter(b => b.posts)
          .map(async (bookmark: any) => {
            const post = bookmark.posts;
            
            const { count: likesCount } = await supabase
              .from('likes')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', post.id);

            const { count: sharesCount } = await supabase
              .from('shares')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', post.id);

            const { count: repliesCount } = await supabase
              .from('replies')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', post.id);

            return {
              ...post,
              likes_count: likesCount || 0,
              shares_count: sharesCount || 0,
              replies_count: repliesCount || 0,
              bookmarked_at: bookmark.created_at,
            };
          })
      );

      setBookmarkedPosts(postsWithCounts);
    } catch (error) {
      console.error('予期しないエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeBookmark = async (postId: string) => {
    if (!currentUserId) return;

    Alert.alert(
      'ブックマーク削除',
      'このブックマークを削除しますか?',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bookmarks')
                .delete()
                .eq('post_id', postId)
                .eq('user_id', currentUserId);

              if (error) {
                Alert.alert('エラー', 'ブックマークの削除に失敗しました');
                return;
              }

              setBookmarkedPosts(prev => prev.filter(p => p.id !== postId));
              Alert.alert('完了', 'ブックマークを削除しました');
            } catch (error) {
              Alert.alert('エラー', '予期しないエラーが発生しました');
            }
          }
        }
      ]
    );
  };

  const openPostModal = async (post: Post) => {
    setSelectedPost(post);
    setModalVisible(true);
    await fetchReplies(post.id);
  };

  const fetchReplies = async (postId: string) => {
    setLoadingReplies(true);
    try {
      const { data, error } = await supabase
        .from('replies')
        .select(`
          *,
          profiles (
            name,
            avatar_url,
            complex_level
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('リプライ取得エラー:', error);
        return;
      }

      setReplies(data || []);
    } catch (error) {
      console.error('予期しないエラー:', error);
    } finally {
      setLoadingReplies(false);
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

  const getLevelColor = (level: number) => {
    if (level <= 20) return '#4CAF50';
    if (level <= 40) return '#8BC34A';
    if (level <= 60) return '#FFC107';
    if (level <= 80) return '#FF9800';
    return '#F44336';
  };

  const renderPost = ({ item }: { item: Post }) => {
    return (
      <View style={[styles.postCard, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => openPostModal(item)}>
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
                  <Text style={[styles.levelText, { color: getLevelColor(item.profiles?.complex_level || 0) }]}>
                    コンプレックスレベル {item.profiles?.complex_level || 0}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.postTime}>
              {getTimeAgo(item.created_at)}
            </Text>
          </View>

          {item.post_complexes && item.post_complexes.length > 0 && (
            <View style={styles.postComplexesContainer}>
              {item.post_complexes.map((complex, index) => (
                <View key={index} style={[styles.complexChip, { backgroundColor: isDarkMode ? '#0a2a3a' : '#e3f2fd' }]}>
                  <Text style={styles.complexChipIcon}>{getCategoryIcon(complex.category)}</Text>
                  <Text style={[styles.complexChipText, { color: isDarkMode ? '#fff' : '#000' }]}>
                    {getCategoryLabel(complex.category)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.postContent, { color: isDarkMode ? '#fff' : '#000' }]}>
            {item.content}
          </Text>

          <View style={styles.postStats}>
            <View style={styles.statItem}>
              <Image 
                source={require('../../assets/icon/heart.png')}
                style={[styles.statIcon, { tintColor: isDarkMode ? '#888' : '#666' }]}
              />
              <Text style={[styles.statText, { color: isDarkMode ? '#888' : '#666' }]}>
                {item.likes_count}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Image 
                source={require('../../assets/icon/comment.png')}
                style={[styles.statIcon, { tintColor: isDarkMode ? '#888' : '#666' }]}
              />
              <Text style={[styles.statText, { color: isDarkMode ? '#888' : '#666' }]}>
                {item.replies_count}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Image 
                source={require('../../assets/icon/post.png')}
                style={[styles.statIcon, { tintColor: isDarkMode ? '#888' : '#666' }]}
              />
              <Text style={[styles.statText, { color: isDarkMode ? '#888' : '#666' }]}>
                {item.shares_count}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeBookmark(item.id)}>
          <Text style={styles.removeButtonText}>ブックマーク削除</Text>
        </TouchableOpacity>
      </View>
    );
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
      <View style={[styles.header, { borderBottomColor: isDarkMode ? '#333' : '#e0e0e0' }]}>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
          ブックマーク
        </Text>
      </View>

      {bookmarkedPosts.length === 0 ? (
        <View style={styles.content}>
          <Text style={[styles.emptyText, { color: isDarkMode ? '#fff' : '#000' }]}>
            ブックマークした投稿はありません
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookmarkedPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.postList}
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.closeButton, { color: isDarkMode ? '#fff' : '#000' }]}>
                  閉じる
                </Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                投稿
              </Text>
              <View style={{ width: 60 }} />
            </View>

            {selectedPost && (
              <>
                <View style={[styles.originalPost, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
                  <View style={styles.originalPostHeader}>
                    {selectedPost.profiles?.avatar_url ? (
                      <Image source={{ uri: selectedPost.profiles.avatar_url }} style={styles.smallAvatar} />
                    ) : (
                      <View style={[styles.smallAvatarPlaceholder, { backgroundColor: isDarkMode ? '#333' : '#ddd' }]}>
                        <Text style={styles.smallAvatarPlaceholderText}>👤</Text>
                      </View>
                    )}
                    <Text style={[styles.originalPostUser, { color: isDarkMode ? '#fff' : '#000' }]}>
                      {selectedPost.profiles?.name || '名前未設定'}
                    </Text>
                  </View>
                  <Text style={[styles.originalPostContent, { color: isDarkMode ? '#fff' : '#000' }]}>
                    {selectedPost.content}
                  </Text>
                </View>

                <View style={styles.repliesContainer}>
                  <Text style={[styles.repliesTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                    リプライ ({replies.length})
                  </Text>
                  {loadingReplies ? (
                    <ActivityIndicator size="large" color="#1DA1F2" style={{ marginTop: 20 }} />
                  ) : replies.length === 0 ? (
                    <Text style={[styles.noRepliesText, { color: isDarkMode ? '#888' : '#666' }]}>
                      まだリプライがありません
                    </Text>
                  ) : (
                    <ScrollView style={styles.repliesList}>
                      {replies.map((reply) => (
                        <View key={reply.id} style={[styles.replyItem, { borderBottomColor: isDarkMode ? '#333' : '#e0e0e0' }]}>
                          <View style={styles.replyHeader}>
                            {reply.profiles?.avatar_url ? (
                              <Image source={{ uri: reply.profiles.avatar_url }} style={styles.smallAvatar} />
                            ) : (
                              <View style={[styles.smallAvatarPlaceholder, { backgroundColor: isDarkMode ? '#333' : '#ddd' }]}>
                                <Text style={styles.smallAvatarPlaceholderText}>👤</Text>
                              </View>
                            )}
                            <View style={styles.replyUserInfo}>
                              <Text style={[styles.replyUserName, { color: isDarkMode ? '#fff' : '#000' }]}>
                                {reply.profiles?.name || '名前未設定'}
                              </Text>
                              <Text style={styles.replyTime}>
                                {getTimeAgo(reply.created_at)}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.replyContent, { color: isDarkMode ? '#fff' : '#000' }]}>
                            {reply.content}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </>
            )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
  },
  postList: {
    padding: 8,
  },
  postCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 18,
  },
  userDetails: {
    marginLeft: 10,
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  levelBadge: {
    alignSelf: 'flex-start',
  },
  levelText: {
    fontSize: 11,
    fontWeight: '600',
  },
  postComplexesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  complexChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  complexChipIcon: {
    fontSize: 12,
  },
  complexChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  postContent: {
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 20,
  },
  postTime: {
    fontSize: 11,
    color: '#888',
    marginLeft: 8,
  },
  postStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
    marginBottom: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    width: 12,
    height: 12,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 13,
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    fontSize: 16,
  },
  originalPost: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  originalPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  originalPostUser: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  originalPostContent: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 38,
  },
  smallAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  smallAvatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallAvatarPlaceholderText: {
    fontSize: 14,
  },
  repliesContainer: {
    flex: 1,
  },
  repliesTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  noRepliesText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  repliesList: {
    flex: 1,
  },
  replyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  replyUserInfo: {
    marginLeft: 8,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyUserName: {
    fontSize: 14,
    fontWeight: '700',
  },
  replyTime: {
    fontSize: 11,
    color: '#888',
  },
  replyContent: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 38,
  },
});

export default BookmarksComponents;