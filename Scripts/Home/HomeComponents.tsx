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
  ScrollView,
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
  replies_count: number;
  is_following: boolean;
  post_complexes?: Array<{ category: string }>;
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

const COMPLEX_CATEGORIES = [
  { key: 'appearance', label: '容姿', icon: '👤' },
  { key: 'debt', label: '借金', icon: '💰' },
  { key: 'job', label: '仕事', icon: '💼' },
  { key: 'education', label: '学歴', icon: '🎓' },
  { key: 'health', label: '健康', icon: '🏥' },
  { key: 'relationship', label: '人間関係', icon: '👥' },
  { key: 'family', label: '家族', icon: '👨‍👩‍👧' },
  { key: 'income', label: '収入', icon: '💵' },
  { key: 'age', label: '年齢', icon: '🎂' },
  { key: 'personality', label: '性格', icon: '🎭' },
];

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
  const [userBookmarkedPosts, setUserBookmarkedPosts] = useState<Set<string>>(new Set());
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [showFollowingOnly, setShowFollowingOnly] = useState(false);
  const [selectedComplexes, setSelectedComplexes] = useState<Set<string>>(new Set());
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [postingReply, setPostingReply] = useState(false);

  useEffect(() => {
    getCurrentUser();
    fetchPosts();

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

    const followsSubscription = supabase
      .channel('follows_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows' },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      likesSubscription.unsubscribe();
      sharesSubscription.unsubscribe();
      followsSubscription.unsubscribe();
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
          ),
          post_complexes (
            category
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

          const { count: repliesCount } = await supabase
            .from('replies')
            .select('*', { count: 'exact', head: true })
            .eq('post_id', post.id);

          return {
            ...post,
            likes_count: likesCount || 0,
            shares_count: sharesCount || 0,
            replies_count: repliesCount || 0,
            is_following: false,
          };
        })
      );

      setPosts(postsWithCounts);

      if (user) {
        const { data: likedData } = await supabase
          .from('likes')
          .select('post_id')
          .eq('user_id', user.id);

        const { data: sharedData } = await supabase
          .from('shares')
          .select('post_id')
          .eq('user_id', user.id);

        const { data: bookmarkedData } = await supabase
          .from('bookmarks')
          .select('post_id')
          .eq('user_id', user.id);

        const { data: followingData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);

        const { data: blockedData } = await supabase
          .from('blocks')
          .select('blocked_id')
          .eq('blocker_id', user.id);

        if (likedData) {
          setUserLikedPosts(new Set(likedData.map(like => like.post_id)));
        }

        if (sharedData) {
          setUserSharedPosts(new Set(sharedData.map(share => share.post_id)));
        }

        if (bookmarkedData) {
          setUserBookmarkedPosts(new Set(bookmarkedData.map(b => b.post_id)));
        }

        if (followingData) {
          setFollowingUsers(new Set(followingData.map(follow => follow.following_id)));
        }

        if (blockedData) {
          setBlockedUsers(new Set(blockedData.map(b => b.blocked_id)));
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

      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert([
          {
            content: postContent,
            user_id: user.id,
          },
        ])
        .select()
        .single();

      if (postError || !postData) {
        Alert.alert('投稿エラー', postError?.message || '投稿に失敗しました');
        setLoading(false);
        return;
      }

      if (selectedComplexes.size > 0) {
        const complexesToInsert = Array.from(selectedComplexes).map(category => ({
          post_id: postData.id,
          category: category,
        }));

        const { error: complexError } = await supabase
          .from('post_complexes')
          .insert(complexesToInsert);

        if (complexError) {
          console.error('コンプレックス保存エラー:', complexError);
        }
      }

      setPostContent('');
      setSelectedComplexes(new Set());
      setModalVisible(false);
      Alert.alert('成功', '投稿しました');
      fetchPosts();
    } catch (error) {
      Alert.alert('エラー', '予期しないエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const toggleComplexCategory = (category: string) => {
    setSelectedComplexes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handleLike = async (postId: string) => {
    if (!currentUserId) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    if (userLikedPosts.has(postId)) {
      return;
    }

    setUserLikedPosts(prev => new Set([...prev, postId]));
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { ...post, likes_count: post.likes_count + 1 }
          : post
      )
    );

    try {
      const { error } = await supabase
        .from('likes')
        .insert({ post_id: postId, user_id: currentUserId });

      if (error) {
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
    } catch (error) {
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

    if (userSharedPosts.has(postId)) {
      return;
    }

    setUserSharedPosts(prev => new Set([...prev, postId]));
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { ...post, shares_count: post.shares_count + 1 }
          : post
      )
    );

    try {
      const { error } = await supabase
        .from('shares')
        .insert({ post_id: postId, user_id: currentUserId });

      if (error) {
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
    } catch (error) {
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

  const handleBookmark = async (postId: string) => {
    if (!currentUserId) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    const isBookmarked = userBookmarkedPosts.has(postId);

    if (isBookmarked) {
      setUserBookmarkedPosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });

      try {
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId);

        if (error) {
          setUserBookmarkedPosts(prev => new Set([...prev, postId]));
          console.error('ブックマーク削除エラー:', error);
        }
      } catch (error) {
        setUserBookmarkedPosts(prev => new Set([...prev, postId]));
        console.error('ブックマーク削除エラー:', error);
      }
    } else {
      setUserBookmarkedPosts(prev => new Set([...prev, postId]));

      try {
        const { error } = await supabase
          .from('bookmarks')
          .insert({ post_id: postId, user_id: currentUserId });

        if (error) {
          setUserBookmarkedPosts(prev => {
            const newSet = new Set(prev);
            newSet.delete(postId);
            return newSet;
          });
          console.error('ブックマークエラー:', error);
        }
      } catch (error) {
        setUserBookmarkedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
        console.error('ブックマークエラー:', error);
      }
    }
  };

  const handleFollow = async (userId: string) => {
    if (!currentUserId) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    if (currentUserId === userId) {
      return;
    }

    const isFollowing = followingUsers.has(userId);

    if (isFollowing) {
      setFollowingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    } else {
      setFollowingUsers(prev => new Set([...prev, userId]));
    }

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', userId);

        if (error) {
          setFollowingUsers(prev => new Set([...prev, userId]));
          console.error('アンフォローエラー:', error);
        }
      } else {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: currentUserId, following_id: userId });

        if (error) {
          setFollowingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
          console.error('フォローエラー:', error);
        }
      }
    } catch (error) {
      if (isFollowing) {
        setFollowingUsers(prev => new Set([...prev, userId]));
      } else {
        setFollowingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      }
      console.error('フォローエラー:', error);
    }
  };

  const handleBlock = async (userId: string) => {
    if (!currentUserId) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    Alert.alert(
      'ユーザーをブロック',
      'このユーザーをブロックしますか？ブロックすると、このユーザーの投稿が表示されなくなり、相互のフォロー関係が解除されます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ブロック',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('blocks')
                .insert({ blocker_id: currentUserId, blocked_id: userId });

              if (error) {
                Alert.alert('エラー', 'ブロックに失敗しました');
                return;
              }

              setBlockedUsers(prev => new Set([...prev, userId]));
              Alert.alert('完了', 'ユーザーをブロックしました');
              fetchPosts();
            } catch (error) {
              Alert.alert('エラー', '予期しないエラーが発生しました');
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

  const getCategoryLabel = (category: string) => {
    return COMPLEX_CATEGORIES.find(c => c.key === category)?.label || category;
  };

  const getCategoryIcon = (category: string) => {
    return COMPLEX_CATEGORIES.find(c => c.key === category)?.icon || '📌';
  };

  const openReplyModal = async (post: Post) => {
    setSelectedPost(post);
    setReplyModalVisible(true);
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

  const handleReply = async () => {
    if (!replyContent.trim() || !selectedPost) {
      Alert.alert('エラー', 'リプライ内容を入力してください');
      return;
    }

    if (!currentUserId) {
      Alert.alert('エラー', 'ログインが必要です');
      return;
    }

    setPostingReply(true);

    try {
      const { error } = await supabase
        .from('replies')
        .insert([
          {
            post_id: selectedPost.id,
            user_id: currentUserId,
            content: replyContent,
          },
        ]);

      if (error) {
        Alert.alert('リプライエラー', error.message);
        setPostingReply(false);
        return;
      }

      setReplyContent('');
      Alert.alert('成功', 'リプライしました');
      await fetchReplies(selectedPost.id);
      
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === selectedPost.id
            ? { ...post, replies_count: post.replies_count + 1 }
            : post
        )
      );
    } catch (error) {
      Alert.alert('エラー', '予期しないエラーが発生しました');
    } finally {
      setPostingReply(false);
    }
  };

  const renderPost = ({ item }: { item: Post }) => {
    const isLiked = userLikedPosts.has(item.id);
    const isShared = userSharedPosts.has(item.id);
    const isBookmarked = userBookmarkedPosts.has(item.id);
    const isFollowing = followingUsers.has(item.user_id);
    const isOwnPost = currentUserId === item.user_id;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => openReplyModal(item)}>
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
                  <Text style={[styles.levelText, { color: getLevelColor(item.profiles?.complex_level || 0) }]}>
                    コンプレックスレベル {item.profiles?.complex_level || 0}
                  </Text>
                </View>
              </View>
              {!isOwnPost && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.followButton,
                      isFollowing && styles.followingButton,
                      { backgroundColor: isFollowing ? (isDarkMode ? '#333' : '#e0e0e0') : '#1DA1F2' }
                    ]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleFollow(item.user_id);
                    }}>
                    <Text style={[styles.followButtonText, isFollowing && { color: isDarkMode ? '#fff' : '#000' }]}>
                      {isFollowing ? 'フォロー中' : 'フォロー'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      Alert.alert(
                        'メニュー',
                        '',
                        [
                          { text: 'キャンセル', style: 'cancel' },
                          {
                            text: 'ブロック',
                            style: 'destructive',
                            onPress: () => handleBlock(item.user_id)
                          }
                        ]
                      );
                    }}>
                    <Text style={styles.menuIcon}>⋮</Text>
                  </TouchableOpacity>
                </>
              )}
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
          
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, isLiked && styles.actionButtonActive]}
              onPress={(e) => {
                e.stopPropagation();
                handleLike(item.id);
              }}
              disabled={isLiked}>
              <Text style={[styles.actionIcon, isLiked && styles.actionIconActive]}>❤️</Text>
              <Text style={[styles.actionCount, { color: isDarkMode ? '#fff' : '#000' }]}>
                {item.likes_count}
              </Text>
            </TouchableOpacity>

            <View style={styles.actionButton}>
              <Text style={styles.actionIcon}>💬</Text>
              <Text style={[styles.actionCount, { color: isDarkMode ? '#fff' : '#000' }]}>
                {item.replies_count}
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.actionButton, isShared && styles.actionButtonActive]}
              onPress={(e) => {
                e.stopPropagation();
                handleShare(item.id);
              }}
              disabled={isShared}>
              <Text style={[styles.actionIcon, isShared && styles.actionIconActive]}>🔁</Text>
              <Text style={[styles.actionCount, { color: isDarkMode ? '#fff' : '#000' }]}>
                {item.shares_count}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, isBookmarked && styles.actionButtonActive]}
              onPress={(e) => {
                e.stopPropagation();
                handleBookmark(item.id);
              }}>
              <Text style={[styles.actionIcon, isBookmarked && styles.actionIconActive]}>🔖</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getFilteredPosts = () => {
    let filtered = posts;
    
    filtered = filtered.filter(post => !blockedUsers.has(post.user_id));
    
    if (!showFollowingOnly) {
      return filtered;
    }
    return filtered.filter(post => 
      followingUsers.has(post.user_id) || post.user_id === currentUserId
    );
  };

  const filteredPosts = getFilteredPosts();

  return (
    <View style={styles.container}>
      <View style={[styles.toggleContainer, { borderBottomColor: isDarkMode ? '#333' : '#e0e0e0' }]}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            !showFollowingOnly && styles.toggleButtonActive,
            !showFollowingOnly && { borderBottomColor: '#1DA1F2' }
          ]}
          onPress={() => setShowFollowingOnly(false)}>
          <Text style={[
            styles.toggleButtonText,
            { color: isDarkMode ? '#fff' : '#000' },
            !showFollowingOnly && styles.toggleButtonTextActive
          ]}>
            すべて
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            showFollowingOnly && styles.toggleButtonActive,
            showFollowingOnly && { borderBottomColor: '#1DA1F2' }
          ]}
          onPress={() => setShowFollowingOnly(true)}>
          <Text style={[
            styles.toggleButtonText,
            { color: isDarkMode ? '#fff' : '#000' },
            showFollowingOnly && styles.toggleButtonTextActive
          ]}>
            フォロー中
          </Text>
        </TouchableOpacity>
      </View>

      {loadingPosts ? (
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#1DA1F2" />
        </View>
      ) : filteredPosts.length === 0 ? (
        <View style={styles.content}>
          <Text style={[styles.emptyText, { color: isDarkMode ? '#fff' : '#000' }]}>
            {showFollowingOnly ? 'フォロー中のユーザーの投稿がありません' : 'まだ投稿がありません'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPosts}
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

            <View style={styles.complexSelectionContainer}>
              <Text style={[styles.complexSelectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                コンプレックスカテゴリ(任意)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.complexChipsContainer}>
                  {COMPLEX_CATEGORIES.map((category) => {
                    const isSelected = selectedComplexes.has(category.key);
                    return (
                      <TouchableOpacity
                        key={category.key}
                        style={[
                          styles.complexSelectionChip,
                          {
                            backgroundColor: isSelected
                              ? '#1DA1F2'
                              : isDarkMode ? '#1a1a1a' : '#f5f5f5',
                            borderColor: isSelected
                              ? '#1DA1F2'
                              : isDarkMode ? '#333' : '#ddd',
                          }
                        ]}
                        onPress={() => toggleComplexCategory(category.key)}>
                        <Text style={styles.complexSelectionChipIcon}>{category.icon}</Text>
                        <Text
                          style={[
                            styles.complexSelectionChipText,
                            { color: isSelected ? '#fff' : isDarkMode ? '#fff' : '#000' }
                          ]}>
                          {category.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={true}
        visible={replyModalVisible}
        onRequestClose={() => setReplyModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setReplyModalVisible(false)}>
                <Text style={[styles.cancelButton, { color: isDarkMode ? '#fff' : '#000' }]}>
                  閉じる
                </Text>
              </TouchableOpacity>
              <Text style={[styles.replyModalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                リプライ
              </Text>
              <View style={{ width: 60 }} />
            </View>

            {selectedPost && (
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
            )}

            <View style={styles.replyInputContainer}>
              <TextInput
                style={[
                  styles.replyInput,
                  { color: isDarkMode ? '#fff' : '#000' }
                ]}
                placeholder="リプライを入力..."
                placeholderTextColor={isDarkMode ? '#888' : '#999'}
                value={replyContent}
                onChangeText={setReplyContent}
                multiline
                editable={!postingReply}
              />
              <TouchableOpacity
                style={[styles.replyButton, postingReply && styles.replyButtonDisabled]}
                onPress={handleReply}
                disabled={postingReply}>
                {postingReply ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.replyButtonText}>送信</Text>
                )}
              </TouchableOpacity>
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
  toggleContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  toggleButtonActive: {
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.6,
  },
  toggleButtonTextActive: {
    opacity: 1,
    color: '#1DA1F2',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  actionsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(29, 161, 242, 0.1)',
  },
  actionIcon: {
    fontSize: 16,
    opacity: 0.6,
  },
  actionIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
  },
  actionCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
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
    fontSize: 20,
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
    minHeight: 400,
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
    marginBottom: 20,
  },
  followButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 6,
  },
  followingButton: {
  },
  followButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  menuButton: {
    padding: 4,
    marginLeft: 4,
  },
  menuIcon: {
    fontSize: 20,
    color: '#888',
  },
  complexSelectionContainer: {
    marginTop: 10,
  },
  complexSelectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  complexChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 5,
  },
  complexSelectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  complexSelectionChipIcon: {
    fontSize: 14,
  },
  complexSelectionChipText: {
    fontSize: 13,
    fontWeight: '600',
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
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 20,
  },
  replyInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
  },
  replyButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  replyButtonDisabled: {
    opacity: 0.6,
  },
  replyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  replyModalTitle: {
    fontSize: 18,
    fontWeight: '700',
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