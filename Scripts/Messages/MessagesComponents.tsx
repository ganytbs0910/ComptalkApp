
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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../supabaseClient';

interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  updated_at: string;
  other_user: {
    id: string;
    name: string | null;
    avatar_url: string | null;
    complex_level: number;
  };
  last_message: {
    content: string;
    created_at: string;
    sender_id: string;
    is_read: boolean;
  } | null;
  unread_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

function MessagesComponents() {
  const isDarkMode = useColorScheme() === 'dark';
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageModalVisible, setMessageModalVisible] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    getCurrentUser();
    fetchConversations();

    const messagesSubscription = supabase
      .channel('messages_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          fetchConversations();
          if (selectedConversation) {
            fetchMessages(selectedConversation.id);
          }
        }
      )
      .subscribe();

    return () => {
      messagesSubscription.unsubscribe();
    };
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const fetchConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: conversationsData, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('会話取得エラー:', error);
        return;
      }

      if (!conversationsData) {
        setConversations([]);
        return;
      }

      const conversationsWithDetails = await Promise.all(
        conversationsData.map(async (conv) => {
          const otherUserId = conv.user1_id === user.id ? conv.user2_id : conv.user1_id;

          const { data: otherUserData } = await supabase
            .from('profiles')
            .select('id, name, avatar_url, complex_level')
            .eq('id', otherUserId)
            .single();

          const { data: lastMessageData } = await supabase
            .from('messages')
            .select('content, created_at, sender_id, is_read')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('is_read', false)
            .neq('sender_id', user.id);

          return {
            ...conv,
            other_user: otherUserData || {
              id: otherUserId,
              name: null,
              avatar_url: null,
              complex_level: 0,
            },
            last_message: lastMessageData,
            unread_count: unreadCount || 0,
          };
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('予期しないエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const openConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setMessageModalVisible(true);
    await fetchMessages(conversation.id);
    await markMessagesAsRead(conversation.id);
  };

  const fetchMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('メッセージ取得エラー:', error);
        return;
      }

      setMessages(data || []);
    } catch (error) {
      console.error('予期しないエラー:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const markMessagesAsRead = async (conversationId: string) => {
    if (!currentUserId) return;

    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)
        .eq('is_read', false);

      fetchConversations();
    } catch (error) {
      console.error('既読更新エラー:', error);
    }
  };

  const sendMessage = async () => {
    if (!messageContent.trim() || !selectedConversation || !currentUserId) {
      return;
    }

    setSendingMessage(true);

    try {
      const { error } = await supabase
        .from('messages')
        .insert([
          {
            conversation_id: selectedConversation.id,
            sender_id: currentUserId,
            content: messageContent,
          },
        ]);

      if (error) {
        console.error('メッセージ送信エラー:', error);
        return;
      }

      setMessageContent('');
      await fetchMessages(selectedConversation.id);
    } catch (error) {
      console.error('予期しないエラー:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date().getTime();
    const messageTime = new Date(timestamp).getTime();
    const diffInSeconds = Math.floor((now - messageTime) / 1000);

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

  const renderConversation = ({ item }: { item: Conversation }) => {
    return (
      <TouchableOpacity
        style={[
          styles.conversationCard,
          {
            backgroundColor: item.unread_count > 0
              ? (isDarkMode ? '#0a2a3a' : '#e3f2fd')
              : (isDarkMode ? '#1a1a1a' : '#f5f5f5')
          }
        ]}
        onPress={() => openConversation(item)}>
        <View style={styles.conversationContent}>
          {item.other_user.avatar_url ? (
            <Image
              source={{ uri: item.other_user.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#333' : '#ddd' }]}>
              <Text style={styles.avatarPlaceholderText}>👤</Text>
            </View>
          )}
          <View style={styles.conversationTextContainer}>
            <Text style={[styles.conversationUserName, { color: isDarkMode ? '#fff' : '#000' }]}>
              {item.other_user.name || '名前未設定'}
            </Text>
            {item.last_message && (
              <>
                <Text
                  style={[
                    styles.lastMessageText,
                    { color: isDarkMode ? '#888' : '#666' },
                    item.unread_count > 0 && styles.unreadMessageText
                  ]}
                  numberOfLines={1}>
                  {item.last_message.content}
                </Text>
                <Text style={styles.messageTime}>
                  {getTimeAgo(item.last_message.created_at)}
                </Text>
              </>
            )}
          </View>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === currentUserId;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
        ]}>
        <View
          style={[
            styles.messageBubble,
            isOwnMessage
              ? [styles.ownMessageBubble, { backgroundColor: '#1DA1F2' }]
              : [styles.otherMessageBubble, { backgroundColor: isDarkMode ? '#333' : '#e0e0e0' }]
          ]}>
          <Text
            style={[
              styles.messageText,
              { color: isOwnMessage ? '#fff' : (isDarkMode ? '#fff' : '#000') }
            ]}>
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTimestamp,
              { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : '#888' }
            ]}>
            {getTimeAgo(item.created_at)}
          </Text>
        </View>
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
          メッセージ
        </Text>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.content}>
          <Text style={[styles.emptyText, { color: isDarkMode ? '#fff' : '#000' }]}>
            メッセージはありません
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.conversationList}
        />
      )}

      <Modal
        animationType="slide"
        transparent={false}
        visible={messageModalVisible}
        onRequestClose={() => setMessageModalVisible(false)}>
        <KeyboardAvoidingView
          style={[styles.messageModalContainer, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}>
          <View style={[styles.messageModalHeader, { borderBottomColor: isDarkMode ? '#333' : '#e0e0e0' }]}>
            <TouchableOpacity onPress={() => setMessageModalVisible(false)}>
              <Text style={[styles.backButton, { color: '#1DA1F2' }]}>← 戻る</Text>
            </TouchableOpacity>
            {selectedConversation && (
              <Text style={[styles.messageModalTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
                {selectedConversation.other_user.name || '名前未設定'}
              </Text>
            )}
            <View style={{ width: 60 }} />
          </View>

          {loadingMessages ? (
            <View style={styles.content}>
              <ActivityIndicator size="large" color="#1DA1F2" />
            </View>
          ) : (
            <FlatList
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              inverted={false}
            />
          )}

          <View style={[styles.messageInputContainer, { borderTopColor: isDarkMode ? '#333' : '#e0e0e0' }]}>
            <TextInput
              style={[
                styles.messageInput,
                {
                  backgroundColor: isDarkMode ? '#1a1a1a' : '#f5f5f5',
                  color: isDarkMode ? '#fff' : '#000'
                }
              ]}
              placeholder="メッセージを入力..."
              placeholderTextColor={isDarkMode ? '#888' : '#999'}
              value={messageContent}
              onChangeText={setMessageContent}
              multiline
              maxLength={500}
              editable={!sendingMessage}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!messageContent.trim() || sendingMessage) && styles.sendButtonDisabled
              ]}
              onPress={sendMessage}
              disabled={!messageContent.trim() || sendingMessage}>
              {sendingMessage ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendButtonText}>送信</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  conversationList: {
    padding: 8,
  },
  conversationCard: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  conversationContent: {
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
    fontSize: 22,
  },
  conversationTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  conversationUserName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  lastMessageText: {
    fontSize: 14,
    marginBottom: 2,
  },
  unreadMessageText: {
    fontWeight: '600',
  },
  messageTime: {
    fontSize: 12,
    color: '#888',
  },
  unreadBadge: {
    backgroundColor: '#1DA1F2',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  messageModalContainer: {
    flex: 1,
  },
  messageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  messageModalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '75%',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  ownMessageBubble: {
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  messageTimestamp: {
    fontSize: 11,
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  messageInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default MessagesComponents;