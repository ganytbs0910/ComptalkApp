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
} from 'react-native';
import { supabase } from '../supabaseClient';

interface Notification {
  id: string;
  type: string;
  message: string;
  related_user_id: string | null;
  related_post_id: string | null;
  is_read: boolean;
  created_at: string;
  profiles: {
    name: string | null;
    avatar_url: string | null;
  } | null;
}

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

function NotificationsComponents() {
  const isDarkMode = useColorScheme() === 'dark';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingPost, setLoadingPost] = useState(false);

  useEffect(() => {
    fetchNotifications();

    const notificationsSubscription = supabase
      .channel('notifications_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      notificationsSubscription.unsubscribe();
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          profiles:related_user_id (
            name,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('通知取得エラー:', error);
        return;
      }

      setNotifications(data || []);
      
      const unread = (data || []).filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('予期しないエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('既読更新エラー:', error);
        return;
      }

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('予期しないエラー:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('一括既読更新エラー:', error);
        return;
      }

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('予期しないエラー:', error);
    }
  };

  const openPost = async (postId: string | null, notificationId: string) => {
    if (!postId) return;

    await markAsRead(notificationId);
    setLoadingPost(true);

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
        .eq('id', postId)
        .single();

      if (error) {
        console.error('投稿取得エラー:', error);
        return;
      }

      setSelectedPost(data);
      await fetchReplies(postId);
      setPostModalVisible(true);
    } catch (error) {
      console.error('予期しないエラー:', error);
    } finally {
      setLoadingPost(false);
    }
  };

  const fetchReplies = async (postId: string) => {
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
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date().getTime();
    const notificationTime = new Date(timestamp).getTime();
    const diffInSeconds = Math.floor((now - notificationTime) / 1000);

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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return '❤️';
      case 'reply':
        return '💬';
      case 'follow':
        return '👤';
      default:
        return '🔔';
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          {
            backgroundColor: item.is_read
              ? (isDarkMode ? '#1a1a1a' : '#f5f5f5')
              : (isDarkMode ? '#0a2a3a' : '#e3f2fd')
          }
        ]}
        onPress={() => {
          if (item.related_post_id) {
            openPost(item.related_post_id, item.id);
          } else {
            markAsRead(item.id);
          }
        }}>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTypeIcon}>
            {getNotificationIcon(item.type)}
          </Text>
          {item.profiles?.avatar_url ? (
            <Image
              source={{ uri: item.profiles.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#333' : '#ddd' }]}>
              <Text style={styles.avatarPlaceholderText}>👤</Text>
            </View>
          )}
          <View style={styles.notificationTextContainer}>
            <Text style={[styles.notificationMessage, { color: isDarkMode ? '#fff' : '#000' }]}>
              {item.message}
            </Text>
            <Text style={styles.notificationTime}>
              {getTimeAgo(item.created_at)}
            </Text>
          </View>
          {!item.is_read && (
            <View style={styles.unreadDot} />
          )}
        </View>
      </TouchableOpacity>
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
          通知
        </Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllButton}>すべて既読</Text>
          </TouchableOpacity>
        )}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.content}>
          <Text style={[styles.emptyText, { color: isDarkMode ? '#fff' : '#000' }]}>
            通知はありません
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.notificationList}
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={postModalVisible}
        onRequestClose={() => setPostModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setPostModalVisible(false)}>
                <Text style={[styles.closeButton, { color: isDarkMode ? '#fff' : '#000' }]}>
                  閉じる
                </Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                投稿
              </Text>
              <View style={{ width: 60 }} />
            </View>

            {loadingPost ? (
              <ActivityIndicator size="large" color="#1DA1F2" style={{ marginTop: 20 }} />
            ) : selectedPost && (
              <>
                <View style={[styles.postContainer, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
                  <View style={styles.postHeader}>
                    {selectedPost.profiles?.avatar_url ? (
                      <Image source={{ uri: selectedPost.profiles.avatar_url }} style={styles.postAvatar} />
                    ) : (
                      <View style={[styles.postAvatarPlaceholder, { backgroundColor: isDarkMode ? '#333' : '#ddd' }]}>
                        <Text style={styles.postAvatarPlaceholderText}>👤</Text>
                      </View>
                    )}
                    <Text style={[styles.postUserName, { color: isDarkMode ? '#fff' : '#000' }]}>
                      {selectedPost.profiles?.name || '名前未設定'}
                    </Text>
                  </View>
                  <Text style={[styles.postContent, { color: isDarkMode ? '#fff' : '#000' }]}>
                    {selectedPost.content}
                  </Text>
                </View>

                <View style={styles.repliesContainer}>
                  <Text style={[styles.repliesTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                    リプライ ({replies.length})
                  </Text>
                  {replies.length === 0 ? (
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
  markAllButton: {
    color: '#1DA1F2',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
  },
  notificationList: {
    padding: 8,
  },
  notificationCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationTypeIcon: {
    fontSize: 24,
    marginRight: 8,
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
  notificationTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#888',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1DA1F2',
    marginLeft: 8,
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
  postContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postAvatarPlaceholderText: {
    fontSize: 18,
  },
  postUserName: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 10,
  },
  postContent: {
    fontSize: 15,
    lineHeight: 22,
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

export default NotificationsComponents;