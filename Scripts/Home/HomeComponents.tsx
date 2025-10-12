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
  RefreshControl,
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
  is_following: boolean;
  post_complexes?: Array<{ category: string }>;
  engagement_score?: number;
}

type FeedType = 'all' | 'following' | 'trending';

export default function Home() {
  const isDarkMode = useColorScheme() === 'dark';
  const [modalVisible, setModalVisible] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userLikedPosts, setUserLikedPosts] = useState<Set<string>>(new Set());
  const [userSharedPosts, setUserSharedPosts] = useState<Set<string>>(new Set());
  const [userBookmarkedPosts, setUserBookmarkedPosts] = useState<Set<string>>(new Set());
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [feedType, setFeedType] = useState<FeedType>('all');
  const [selectedComplexes, setSelectedComplexes] = useState<Set<string>>(new Set());
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [postingReply, setPostingReply] = useState(false);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    getCurrentUser();
    fetchAllData();

    const likesSubscription = supabase
      .channel('likes_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'likes' },
        () => {
          // リアルタイム更新は手動リフレッシュに任せる
        }
      )
      .subscribe();

    const sharesSubscription = supabase
      .channel('shares_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shares' },
        () => {
          // リアルタイム更新は手動リフレッシュに任せる
        }
      )
      .subscribe();

    const followsSubscription = supabase
      .channel('follows_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'follows' },
        () => {
          // リアルタイム更新は手動リフレッシュに任せる
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

  const fetchAllData = async () => {
    await Promise.all([
      fetchPosts(),
      fetchTrendingPosts(),
      fetchUserInteractions(),
    ]);
    setInitialLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

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
        setAllPosts([]);
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

      setAllPosts(postsWithCounts);
    } catch (error) {
      console.error('予期しないエラー:', error);
    }
  };

  const fetchTrendingPosts = async () => {
    try {
      let daysAgo = 7;
      if (timeRange === 'day') daysAgo = 1;
      if (timeRange === 'month') daysAgo = 30;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

      const { data: postsData, error } = await supabase
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
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('投稿取得エラー:', error);
        return;
      }

      if (!postsData) {
        setTrendingPosts([]);
        return;
      }

      const postsWithEngagement = await Promise.all(
        postsData.map(async (post) => {
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

          const engagement_score = 
            (likesCount || 0) * 3 + 
            (repliesCount || 0) * 2 + 
            (sharesCount || 0) * 5;

          return {
            ...post,
            likes_count: likesCount || 0,
            shares_count: sharesCount || 0,
            replies_count: repliesCount || 0,
            engagement_score,
          };
        })
      );

      const sorted = postsWithEngagement
        .sort((a, b) => b.engagement_score! - a.engagement_score!)
        .slice(0, 20);

      setTrendingPosts(sorted);
    } catch (error) {
      console.error('予期しないエラー:', error);
    }
  };

  const fetchUserInteractions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

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
    } catch (error) {
      console.error('予期しないエラー:', error);
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
      
      // 投稿後はデータを再取得
      await fetchAllData();
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
    
    // UIを即座に更新
    setAllPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              likes_count: post.likes_count + 1,
              engagement_score: post.engagement_score ? post.engagement_score + 3 : undefined
            }
          : post
      )
    );
    
    setTrendingPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              likes_count: post.likes_count + 1,
              engagement_score: post.engagement_score ? post.engagement_score + 3 : undefined
            }
          : post
      )
    );

    try {
      const { error } = await supabase
        .from('likes')
        .insert({ post_id: postId, user_id: currentUserId });

      if (error) {
        // エラー時はロールバック
        setUserLikedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });
        
        setAllPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { 
                  ...post, 
                  likes_count: post.likes_count - 1,
                  engagement_score: post.engagement_score ? post.engagement_score - 3 : undefined
                }
              : post
          )
        );
        
        setTrendingPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { 
                  ...post, 
                  likes_count: post.likes_count - 1,
                  engagement_score: post.engagement_score ? post.engagement_score - 3 : undefined
                }
              : post
          )
        );
        
        console.error('いいねエラー:', error);
      }
    } catch (error) {
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
    
    setAllPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              shares_count: post.shares_count + 1,
              engagement_score: post.engagement_score ? post.engagement_score + 5 : undefined
            }
          : post
      )
    );
    
    setTrendingPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              shares_count: post.shares_count + 1,
              engagement_score: post.engagement_score ? post.engagement_score + 5 : undefined
            }
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
        
        setAllPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { 
                  ...post, 
                  shares_count: post.shares_count - 1,
                  engagement_score: post.engagement_score ? post.engagement_score - 5 : undefined
                }
              : post
          )
        );
        
        setTrendingPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { 
                  ...post, 
                  shares_count: post.shares_count - 1,
                  engagement_score: post.engagement_score ? post.engagement_score - 5 : undefined
                }
              : post
          )
        );
        
        console.error('共有エラー:', error);
      }
    } catch (error) {
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
      'このユーザーをブロックしますか?ブロックすると、このユーザーの投稿が表示されなくなり、相互のフォロー関係が解除されます。',
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
              
              // ブロック後はデータを再取得
              await fetchAllData();
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

  const getRankColor = (index: number) => {
    if (index === 0) return '#FFD700';
    if (index === 1) return '#C0C0C0';
    if (index === 2) return '#CD7F32';
    return '#1DA1F2';
  };

  const openReplyModal = (post: Post) => {
    setSelectedPost(post);
    setReplyModalVisible(true);
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
      setReplyModalVisible(false);
      Alert.alert('成功', 'リプライしました');
      
      // UIを即座に更新
      setAllPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === selectedPost.id
            ? { 
                ...post, 
                replies_count: post.replies_count + 1,
                engagement_score: post.engagement_score ? post.engagement_score + 2 : undefined
              }
            : post
        )
      );
      
      setTrendingPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === selectedPost.id
            ? { 
                ...post, 
                replies_count: post.replies_count + 1,
                engagement_score: post.engagement_score ? post.engagement_score + 2 : undefined
              }
            : post
        )
      );
    } catch (error) {
      Alert.alert('エラー', '予期しないエラーが発生しました');
    } finally {
      setPostingReply(false);
    }
  };

  const renderPost = ({ item, index }: { item: Post; index?: number }) => {
    const isLiked = userLikedPosts.has(item.id);
    const isShared = userSharedPosts.has(item.id);
    const isBookmarked = userBookmarkedPosts.has(item.id);
    const isFollowing = followingUsers.has(item.user_id);
    const isOwnPost = currentUserId === item.user_id;
    const isTopThree = feedType === 'trending' && index !== undefined && index < 3;

    return (
      <View style={[styles.postCard, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
        {isTopThree && (
          <View style={[styles.rankBadge, { backgroundColor: getRankColor(index!) }]}>
            <Text style={styles.rankText}>{index! + 1}</Text>
          </View>
        )}

        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            {item.profiles?.avatar_url ? (
              <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#333' : '#ddd' }]}>
                <Image 
                  source={require('../../assets/icon/profile.png')}
                  style={[styles.avatarPlaceholderText, { tintColor: isDarkMode ? '#fff' : '#666' }]}
                />
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
                  <Image
                    source={require('../../assets/icon/setting.png')}
                    style={[styles.menuIcon, { tintColor: isDarkMode ? '#fff' : '#666' }]}
                  />
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
            {item.post_complexes.map((complex, idx) => (
              <View key={idx} style={[styles.complexChip, { backgroundColor: isDarkMode ? '#0a2a3a' : '#e3f2fd' }]}>
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

        {feedType === 'trending' && item.engagement_score !== undefined && (
          <View style={styles.engagementContainer}>
            <View style={styles.engagementScore}>
              <Text style={[styles.engagementScoreText, { color: '#1DA1F2' }]}>
                🔥 エンゲージメント: {item.engagement_score}
              </Text>
            </View>
          </View>
        )}
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, isLiked && styles.actionButtonActive]}
            onPress={(e) => {
              e.stopPropagation();
              handleLike(item.id);
            }}
            disabled={isLiked}>
            <Image 
              source={require('../../assets/icon/heart.png')}
              style={[
                styles.actionIcon, 
                isLiked && styles.actionIconActive,
                { tintColor: isLiked ? '#e91e63' : (isDarkMode ? '#fff' : '#666') }
              ]}
            />
            <Text style={[styles.actionCount, { color: isDarkMode ? '#fff' : '#000' }]}>
              {item.likes_count}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              openReplyModal(item);
            }}>
            <Image 
              source={require('../../assets/icon/comment.png')}
              style={[
                styles.actionIcon,
                { tintColor: isDarkMode ? '#fff' : '#666' }
              ]}
            />
            <Text style={[styles.actionCount, { color: isDarkMode ? '#fff' : '#000' }]}>
              {item.replies_count}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, isShared && styles.actionButtonActive]}
            onPress={(e) => {
              e.stopPropagation();
              handleShare(item.id);
            }}
            disabled={isShared}>
            <Image 
              source={require('../../assets/icon/post.png')}
              style={[
                styles.actionIcon, 
                isShared && styles.actionIconActive,
                { tintColor: isShared ? '#1DA1F2' : (isDarkMode ? '#fff' : '#666') }
              ]}
            />
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
            <Image 
              source={require('../../assets/icon/book.png')}
              style={[
                styles.actionIcon, 
                isBookmarked && styles.actionIconActive,
                { tintColor: isBookmarked ? '#1DA1F2' : (isDarkMode ? '#fff' : '#666') }
              ]}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getDisplayPosts = () => {
    let postsToDisplay = feedType === 'trending' ? trendingPosts : allPosts;
    
    // ブロックユーザーをフィルタリング
    postsToDisplay = postsToDisplay.filter(post => !blockedUsers.has(post.user_id));
    
    // フォロー中フィードのフィルタリング
    if (feedType === 'following') {
      postsToDisplay = postsToDisplay.filter(post => 
        followingUsers.has(post.user_id) || post.user_id === currentUserId
      );
    }
    
    return postsToDisplay;
  };

  const displayPosts = getDisplayPosts();

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#1DA1F2" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.toggleContainer, { borderBottomColor: isDarkMode ? '#333' : '#e0e0e0' }]}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            feedType === 'all' && styles.toggleButtonActive,
            feedType === 'all' && { borderBottomColor: '#1DA1F2' }
          ]}
          onPress={() => setFeedType('all')}>
          <Text style={[
            styles.toggleButtonText,
            { color: isDarkMode ? '#fff' : '#000' },
            feedType === 'all' && styles.toggleButtonTextActive
          ]}>
            すべて
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            feedType === 'following' && styles.toggleButtonActive,
            feedType === 'following' && { borderBottomColor: '#1DA1F2' }
          ]}
          onPress={() => setFeedType('following')}>
          <Text style={[
            styles.toggleButtonText,
            { color: isDarkMode ? '#fff' : '#000' },
            feedType === 'following' && styles.toggleButtonTextActive
          ]}>
            フォロー中
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            feedType === 'trending' && styles.toggleButtonActive,
            feedType === 'trending' && { borderBottomColor: '#1DA1F2' }
          ]}
          onPress={() => setFeedType('trending')}>
          <Text style={[
            styles.toggleButtonText,
            { color: isDarkMode ? '#fff' : '#000' },
            feedType === 'trending' && styles.toggleButtonTextActive
          ]}>
            トレンド
          </Text>
        </TouchableOpacity>
      </View>

      {feedType === 'trending' && (
        <View style={[styles.timeRangeContainer, { borderBottomColor: isDarkMode ? '#333' : '#e0e0e0' }]}>
          <TouchableOpacity
            style={[
              styles.timeRangeButton,
              timeRange === 'day' && styles.timeRangeButtonActive,
              timeRange === 'day' && { borderBottomColor: '#1DA1F2' }
            ]}
            onPress={() => {
              setTimeRange('day');
              onRefresh();
            }}>
            <Text style={[
              styles.timeRangeButtonText,
              { color: isDarkMode ? '#fff' : '#000' },
              timeRange === 'day' && styles.timeRangeButtonTextActive
            ]}>
              24時間
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.timeRangeButton,
              timeRange === 'week' && styles.timeRangeButtonActive,
              timeRange === 'week' && { borderBottomColor: '#1DA1F2' }
            ]}
            onPress={() => {
              setTimeRange('week');
              onRefresh();
            }}>
            <Text style={[
              styles.timeRangeButtonText,
              { color: isDarkMode ? '#fff' : '#000' },
              timeRange === 'week' && styles.timeRangeButtonTextActive
            ]}>
              7日間
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.timeRangeButton,
              timeRange === 'month' && styles.timeRangeButtonActive,
              timeRange === 'month' && { borderBottomColor: '#1DA1F2' }
            ]}
            onPress={() => {
              setTimeRange('month');
              onRefresh();
            }}>
            <Text style={[
              styles.timeRangeButtonText,
              { color: isDarkMode ? '#fff' : '#000' },
              timeRange === 'month' && styles.timeRangeButtonTextActive
            ]}>
              30日間
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {displayPosts.length === 0 ? (
        <View style={styles.content}>
          <Text style={[styles.emptyText, { color: isDarkMode ? '#fff' : '#000' }]}>
            {feedType === 'following' ? 'フォロー中のユーザーの投稿がありません' : 
             feedType === 'trending' ? 'トレンド投稿がありません' : 
             'まだ投稿がありません'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.postList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1DA1F2"
              colors={['#1DA1F2']}
            />
          }
        />
      )}

      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setModalVisible(true)}>
        <Image 
          source={require('../../assets/icon/post.png')}
          style={styles.floatingButtonText}
        />
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
        <TouchableOpacity 
          style={styles.replyModalOverlay}
          activeOpacity={1}
          onPress={() => setReplyModalVisible(false)}>
          <TouchableOpacity 
            style={[styles.replyModalContent, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}>
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

                <View style={styles.replyInputContainer}>
                  <TextInput
                    style={[
                      styles.replyInput,
                      { 
                        color: isDarkMode ? '#fff' : '#000',
                        backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
                        borderColor: isDarkMode ? '#333' : '#ddd'
                      }
                    ]}
                    placeholder="リプライを入力..."
                    placeholderTextColor={isDarkMode ? '#888' : '#999'}
                    value={replyContent}
                    onChangeText={setReplyContent}
                    multiline
                    autoFocus
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
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
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
  timeRangeContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  timeRangeButtonActive: {
  },
  timeRangeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.6,
  },
  timeRangeButtonTextActive: {
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
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  rankText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
    width: 18,
    height: 18,
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
  engagementContainer: {
    marginBottom: 8,
  },
  engagementScore: {
    alignSelf: 'flex-start',
  },
  engagementScoreText: {
    fontSize: 13,
    fontWeight: '700',
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
    width: 16,
    height: 16,
    opacity: 0.6,
    tintColor: '#666',
  },
  actionIconActive: {
    opacity: 1,
    transform: [{ scale: 1.1 }],
    tintColor: '#1DA1F2',
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
    width: 20,
    height: 20,
    tintColor: '#fff',
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
    width: 20,
    height: 20,
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
  replyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  replyModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
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
  },
  replyInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
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
});