import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
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
}

interface ComplexCategory {
  key: string;
  label: string;
  icon: string;
}

const COMPLEX_CATEGORIES: ComplexCategory[] = [
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

function SearchComponents() {
  const isDarkMode = useColorScheme() === 'dark';
  const [searchText, setSearchText] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userLikedPosts, setUserLikedPosts] = useState<Set<string>>(new Set());
  const [userSharedPosts, setUserSharedPosts] = useState<Set<string>>(new Set());
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedComplexes, setSelectedComplexes] = useState<Set<string>>(new Set());
  const [minComplexLevel, setMinComplexLevel] = useState<number>(0);
  const [maxComplexLevel, setMaxComplexLevel] = useState<number>(100);

  useEffect(() => {
    getCurrentUser();
    fetchPosts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [posts, searchText, selectedComplexes, minComplexLevel, maxComplexLevel]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      fetchUserInteractions(user.id);
    }
  };

  const fetchUserInteractions = async (userId: string) => {
    const { data: likedData } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', userId);

    const { data: sharedData } = await supabase
      .from('shares')
      .select('post_id')
      .eq('user_id', userId);

    if (likedData) {
      setUserLikedPosts(new Set(likedData.map(like => like.post_id)));
    }

    if (sharedData) {
      setUserSharedPosts(new Set(sharedData.map(share => share.post_id)));
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
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

          return {
            ...post,
            likes_count: likesCount || 0,
            shares_count: sharesCount || 0,
          };
        })
      );

      setPosts(postsWithCounts);
    } catch (error) {
      console.error('予期しないエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = async () => {
    let filtered = [...posts];

    // テキスト検索
    if (searchText.trim()) {
      filtered = filtered.filter(post =>
        post.content.toLowerCase().includes(searchText.toLowerCase()) ||
        post.profiles?.name?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // 総合レベルでフィルター
    filtered = filtered.filter(post => {
      const level = post.profiles?.complex_level || 0;
      return level >= minComplexLevel && level <= maxComplexLevel;
    });

    // コンプレックスカテゴリでフィルター
    if (selectedComplexes.size > 0) {
      const filteredByComplex = await Promise.all(
        filtered.map(async (post) => {
          const { data: userComplexes } = await supabase
            .from('user_complexes')
            .select('category')
            .eq('user_id', post.user_id);

          if (!userComplexes) return null;

          const userComplexCategories = new Set(userComplexes.map(c => c.category));
          const hasMatchingComplex = Array.from(selectedComplexes).some(
            category => userComplexCategories.has(category)
          );

          return hasMatchingComplex ? post : null;
        })
      );

      filtered = filteredByComplex.filter(post => post !== null) as Post[];
    }

    setFilteredPosts(filtered);
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

  const clearFilters = () => {
    setSelectedComplexes(new Set());
    setMinComplexLevel(0);
    setMaxComplexLevel(100);
    setSearchText('');
  };

  const handleLike = async (postId: string) => {
    if (!currentUserId || userLikedPosts.has(postId)) return;

    setUserLikedPosts(prev => new Set([...prev, postId]));
    setFilteredPosts(prevPosts =>
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
        setFilteredPosts(prevPosts =>
          prevPosts.map(post =>
            post.id === postId
              ? { ...post, likes_count: post.likes_count - 1 }
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
    if (!currentUserId || userSharedPosts.has(postId)) return;

    setUserSharedPosts(prev => new Set([...prev, postId]));
    setFilteredPosts(prevPosts =>
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
        setFilteredPosts(prevPosts =>
          prevPosts.map(post =>
            post.id === postId
              ? { ...post, shares_count: post.shares_count - 1 }
              : post
          )
        );
        console.error('共有エラー:', error);
      }
    } catch (error) {
      console.error('共有エラー:', error);
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

  const activeFiltersCount = selectedComplexes.size + (minComplexLevel > 0 || maxComplexLevel < 100 ? 1 : 0);

  return (
    <View style={styles.container}>
      <View style={[styles.searchHeader, { borderBottomColor: isDarkMode ? '#333' : '#e0e0e0' }]}>
        <View style={styles.searchInputContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: isDarkMode ? '#fff' : '#000' }]}
            placeholder="投稿を検索..."
            placeholderTextColor={isDarkMode ? '#888' : '#999'}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Text style={styles.clearIcon}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}
          onPress={() => setModalVisible(true)}>
          <Text style={styles.filterIcon}>⚙️</Text>
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeFiltersCount > 0 && (
        <View style={[styles.activeFiltersContainer, { backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5' }]}>
          <Text style={[styles.activeFiltersText, { color: isDarkMode ? '#fff' : '#000' }]}>
            フィルター: {activeFiltersCount}件
          </Text>
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFiltersText}>クリア</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.content}>
          <ActivityIndicator size="large" color="#1DA1F2" />
        </View>
      ) : filteredPosts.length === 0 ? (
        <View style={styles.content}>
          <Text style={[styles.emptyText, { color: isDarkMode ? '#fff' : '#000' }]}>
            {searchText || activeFiltersCount > 0
              ? '検索結果が見つかりませんでした'
              : '投稿がありません'}
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

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                フィルター設定
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.closeButton, { color: isDarkMode ? '#fff' : '#000' }]}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                コンプレックスカテゴリ
              </Text>
              <View style={styles.categoriesContainer}>
                {COMPLEX_CATEGORIES.map((category) => {
                  const isSelected = selectedComplexes.has(category.key);
                  return (
                    <TouchableOpacity
                      key={category.key}
                      style={[
                        styles.categoryChip,
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
                      <Text style={styles.categoryChipIcon}>{category.icon}</Text>
                      <Text
                        style={[
                          styles.categoryChipText,
                          { color: isSelected ? '#fff' : isDarkMode ? '#fff' : '#000' }
                        ]}>
                        {category.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { color: isDarkMode ? '#fff' : '#000', marginTop: 20 }]}>
                コンプレックスレベル範囲
              </Text>
              <View style={styles.levelRangeContainer}>
                <View style={styles.levelInputContainer}>
                  <Text style={[styles.levelLabel, { color: isDarkMode ? '#fff' : '#000' }]}>最小</Text>
                  <TextInput
                    style={[
                      styles.levelInput,
                      {
                        backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
                        color: isDarkMode ? '#fff' : '#000',
                        borderColor: isDarkMode ? '#333' : '#ddd',
                      }
                    ]}
                    keyboardType="numeric"
                    value={minComplexLevel.toString()}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 0;
                      setMinComplexLevel(Math.max(0, Math.min(100, value)));
                    }}
                  />
                </View>
                <Text style={[styles.levelSeparator, { color: isDarkMode ? '#fff' : '#000' }]}>〜</Text>
                <View style={styles.levelInputContainer}>
                  <Text style={[styles.levelLabel, { color: isDarkMode ? '#fff' : '#000' }]}>最大</Text>
                  <TextInput
                    style={[
                      styles.levelInput,
                      {
                        backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
                        color: isDarkMode ? '#fff' : '#000',
                        borderColor: isDarkMode ? '#333' : '#ddd',
                      }
                    ]}
                    keyboardType="numeric"
                    value={maxComplexLevel.toString()}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 100;
                      setMaxComplexLevel(Math.max(0, Math.min(100, value)));
                    }}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.clearButton, { backgroundColor: isDarkMode ? '#333' : '#e0e0e0' }]}
                onPress={clearFilters}>
                <Text style={[styles.clearButtonText, { color: isDarkMode ? '#fff' : '#000' }]}>
                  クリア
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setModalVisible(false)}>
                <Text style={styles.applyButtonText}>適用</Text>
              </TouchableOpacity>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchHeader: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 15,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 15,
  },
  clearIcon: {
    fontSize: 24,
    color: '#888',
    paddingLeft: 8,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterIcon: {
    fontSize: 18,
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#F44336',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  activeFiltersText: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearFiltersText: {
    color: '#1DA1F2',
    fontSize: 13,
    fontWeight: '600',
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
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    fontSize: 32,
    fontWeight: '300',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  categoryChipIcon: {
    fontSize: 14,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  levelRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelInputContainer: {
    flex: 1,
  },
  levelLabel: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '600',
  },
  levelInput: {
    height: 45,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    textAlign: 'center',
  },
  levelSeparator: {
    fontSize: 16,
    marginTop: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  clearButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    height: 50,
    backgroundColor: '#1DA1F2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SearchComponents;