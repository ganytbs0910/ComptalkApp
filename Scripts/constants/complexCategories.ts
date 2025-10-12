// Scripts/constants/complexCategories.ts
// 新しく作成するファイル

export interface ComplexCategory {
  key: string;
  label: string;
  icon: string;
}

export interface ComplexCategoryWithLevels extends ComplexCategory {
  maxLevel: number;
  levels: Array<{
    level: number;
    label: string;
    description: string;
  }>;
}

const generateLevels = (max: number, unit: string = '') => {
  return Array.from({ length: max }, (_, i) => ({
    level: i + 1,
    label: `レベル${i + 1}`,
    description: unit ? `${(i + 1) * 10}${unit}` : `レベル${i + 1}`,
  }));
};

// 基本的なカテゴリリスト(アイコンとラベルのみ)
export const COMPLEX_CATEGORIES: ComplexCategory[] = [
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
  { key: 'housing', label: '住居', icon: '🏠' },
  { key: 'height', label: '身長', icon: '📏' },
  { key: 'weight', label: '体重', icon: '⚖️' },
  { key: 'romance', label: '恋愛', icon: '💕' },
  { key: 'communication', label: 'コミュ力', icon: '💬' },
  { key: 'hobbies', label: '趣味', icon: '🎨' },
  { key: 'past', label: '過去', icon: '⏪' },
  { key: 'future', label: '将来', icon: '🔮' },
  { key: 'social_media', label: 'SNS', icon: '📱' },
  { key: 'loneliness', label: '孤独', icon: '🌙' },
];

// プロフィール設定用のカテゴリリスト(レベル情報含む)
export const COMPLEX_CATEGORIES_WITH_LEVELS: ComplexCategoryWithLevels[] = [
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
  { 
    key: 'housing', 
    label: '住居', 
    icon: '🏠',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'height', 
    label: '身長', 
    icon: '📏',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'weight', 
    label: '体重', 
    icon: '⚖️',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'romance', 
    label: '恋愛', 
    icon: '💕',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'communication', 
    label: 'コミュ力', 
    icon: '💬',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'hobbies', 
    label: '趣味', 
    icon: '🎨',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'past', 
    label: '過去', 
    icon: '⏪',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'future', 
    label: '将来', 
    icon: '🔮',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'social_media', 
    label: 'SNS', 
    icon: '📱',
    maxLevel: 10,
    levels: generateLevels(10)
  },
  { 
    key: 'loneliness', 
    label: '孤独', 
    icon: '🌙',
    maxLevel: 10,
    levels: generateLevels(10)
  },
];

// ヘルパー関数
export const getCategoryLabel = (category: string): string => {
  return COMPLEX_CATEGORIES.find(c => c.key === category)?.label || category;
};

export const getCategoryIcon = (category: string): string => {
  return COMPLEX_CATEGORIES.find(c => c.key === category)?.icon || '📌';
};

export const getCategoryData = (categoryKey: string): ComplexCategoryWithLevels | undefined => {
  return COMPLEX_CATEGORIES_WITH_LEVELS.find(c => c.key === categoryKey);
};