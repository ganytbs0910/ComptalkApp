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
  Alert,
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
  engagement_score: number;
  post_complexes?: Array<{ category: string }>;
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

function TrendingComponents() {
  const isDarkMode = useColorScheme() === 'dark';
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userLikedPosts, setUserLikedPosts] = useState<Set<string>>(new Set());
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    getCurrentUser();
    fetchTrendingPosts();
  }, [timeRange]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      fetchUserLikes(user.id);
    }
  };

  const fetchUserLikes = async (userId: string) => {
    const { data: likedData } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', userId);

    if (likedData) {
      setUserLikedPosts(new Set(likedData.map(like => like.post_id)));
    }
  };

  const fetchTrendingPosts = async () => {
    setLoading(true);
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
        .sort((a, b) => b.engagement_score - a.engagement_score)
        .slice(0, 20);

      setTrendingPosts(sorted);
    } catch (error) {
      console.error('予期しないエラー:', error);
    } finally {
      setLoading(false);
    }
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
    setTrendingPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              likes_count: post.likes_count + 1,
              engagement_score: post.engagement_score + 3
            }
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
        setTrendingPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { 
                  ...post, 
                  likes_count: post.likes_count - 1,
                  engagement_score: post.engagement_score - 3
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

  const getCategoryLabel = (category: string) => {
    return COMPLEX_CATEGORIES.find(c => c.key === category)?.label || category;
  };

  const getCategoryIcon = (category: string) => {
    return COMPLEX_CATEGORIES.find(c => c.key === category)?.icon || '📌';
  };

  const renderPost = ({ item, index }: { item: Post; index: number }) => {
    const isLiked = userLikedPosts.has(item.id);
    const isTopThree = index < 3;

    return (
      <View style={[styles.postCard, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
        {isTopThree && (
          <View style={[styles.rankBadge, { backgroundColor: getRankColor(index) }]}>
            <Text style={styles.rankText}>{index + 1}</Text>
          </View>
        )}

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

        <View style={styles.engagementContainer}>
          <View style={styles.engagementScore}>
            <Text style={[styles.engagementScoreText, { color: '#1DA1F2' }]}>
              🔥 エンゲージメント: {item.engagement_score}
            </Text>
          </View>
        </View>
        
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

          <View style={styles.actionButton}>
            <Text style={styles.actionIcon}>💬</Text>
            <Text style={[styles.actionCount, { color: isDarkMode ? '#fff' : '#000' }]}>
              {item.replies_count}
            </Text>
          </View>

          <View style={styles.actionButton}>
            <Text style={styles.actionIcon}>🔁</Text>
            <Text style={[styles.actionCount, { color: isDarkMode ? '#fff' : '#000' }]}>
              {item.shares_count}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const getRankColor = (index: number) => {
    if (index === 0) return '#FFD700';
    if (index === 1) return '#C0C0C0';
    if (index === 2) return '#CD7F32';
    return '#1DA1F2';
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
          トレンド
        </Text>
      </View>

      <View style={[styles.timeRangeContainer, { borderBottomColor: isDarkMode ? '#333' : '#e0e0e0' }]}>
        <TouchableOpacity
          style={[
            styles.timeRangeButton,
            timeRange === 'day' && styles.timeRangeButtonActive,
            timeRange === 'day' && { borderBottomColor: '#1DA1F2' }
          ]}
          onPress={() => setTimeRange('day')}>
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
          onPress={() => setTimeRange('week')}>
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
          onPress={() => setTimeRange('month')}>
          <Text style={[
            styles.timeRangeButtonText,
            { color: isDarkMode ? '#fff' : '#000' },
            timeRange === 'month' && styles.timeRangeButtonTextActive
          ]}>
            30日間
          </Text>
        </TouchableOpacity>
      </View>

      {trendingPosts.length === 0 ? (
        <View style={styles.content}>
          <Text style={[styles.emptyText, { color: isDarkMode ? '#fff' : '#000' }]}>
            トレンド投稿がありません
          </Text>
        </View>
      ) : (
        <FlatList
          data={trendingPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.postList}
        />
      )}
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
});

export default TrendingComponents;