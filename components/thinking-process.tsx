import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface ThinkingData {
  toolCalls: string[];
  thinking?: string;
  action?: string;
  data?: any;
  memoryUsed?: boolean;
  memoryCount?: number;
}

interface ThinkingProcessProps {
  thinking: ThinkingData | ThinkingData[];
}

export function ThinkingProcess({ thinking }: ThinkingProcessProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Normalize to array
  const thinkingArray = Array.isArray(thinking) ? thinking : (thinking ? [thinking] : []);
  
  // Don't show anything if no thinking data at all
  if (!thinkingArray || thinkingArray.length === 0) {
    return null;
  }
  
  // Check if there's ANY data across all thinking entries
  const hasAnyData = thinkingArray.some(t => {
    const hasToolCalls = t.toolCalls && Array.isArray(t.toolCalls) && t.toolCalls.length > 0;
    const hasThinking = t.thinking && t.thinking.trim().length > 0;
    const hasAction = t.action && t.action.trim().length > 0;
    const hasDataObj = t.data && Object.keys(t.data).length > 0;
    return hasToolCalls || hasThinking || hasAction || hasDataObj;
  });
    
  if (!hasAnyData) {
    return null;
  }

  return (
    <View 
      style={styles.wrapper}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => false}
      onResponderGrant={(e) => {
        e.stopPropagation();
      }}
      onResponderRelease={(e) => {
        e.stopPropagation();
      }}>
      <TouchableOpacity
        style={[
          styles.header,
          {
            backgroundColor: isDark ? 'rgba(74, 158, 255, 0.15)' : 'rgba(0, 122, 255, 0.08)',
            borderColor: isDark ? 'rgba(74, 158, 255, 0.6)' : 'rgba(0, 122, 255, 0.4)',
          },
        ]}
        onPress={() => {
          setIsExpanded(!isExpanded);
        }}
        activeOpacity={0.6}>
        <View style={styles.headerLeft}>
          <IconSymbol
            name="brain"
            size={11}
            color={isDark ? '#4A9EFF' : '#007AFF'}
            style={styles.icon}
          />
          <ThemedText style={[
            styles.headerText,
            { color: isDark ? '#4A9EFF' : '#007AFF' }
          ]}>
            Thinking {thinkingArray.length > 1 ? `(${thinkingArray.length})` : ''}
          </ThemedText>
        </View>
        <IconSymbol
          name={isExpanded ? 'chevron.up' : 'chevron.down'}
          size={9}
          color={isDark ? '#4A9EFF' : '#007AFF'}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View
          style={[
            styles.content,
            {
              backgroundColor: isDark ? 'rgba(10, 35, 60, 0.9)' : 'rgba(230, 242, 255, 0.8)',
              borderColor: isDark ? 'rgba(74, 158, 255, 0.4)' : 'rgba(0, 122, 255, 0.15)',
            },
          ]}>
          {thinkingArray.map((thinkingItem, itemIndex) => {
            const hasToolCalls = thinkingItem.toolCalls && Array.isArray(thinkingItem.toolCalls) && thinkingItem.toolCalls.length > 0;
            const hasThinking = thinkingItem.thinking && thinkingItem.thinking.trim().length > 0;
            const hasAction = thinkingItem.action && thinkingItem.action.trim().length > 0;
            const hasDataObj = thinkingItem.data && Object.keys(thinkingItem.data).length > 0;
            const hasMemory = thinkingItem.memoryUsed && thinkingItem.memoryCount && thinkingItem.memoryCount > 0;
            
            // Skip if this item has no data
            if (!hasToolCalls && !hasThinking && !hasAction && !hasDataObj && !hasMemory) {
              return null;
            }
            
            return (
              <View key={itemIndex} style={styles.thinkingItem}>
                {thinkingArray.length > 1 && (
                  <ThemedText style={styles.itemNumber}>
                    Step {itemIndex + 1} of {thinkingArray.length}
                  </ThemedText>
                )}
                
                {hasToolCalls && (
                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Tools Used</ThemedText>
                    <View style={styles.toolsContainer}>
                      {thinkingItem.toolCalls.map((tool, index) => (
                        <View
                          key={index}
                          style={[
                            styles.toolTag,
                            {
                              backgroundColor: isDark ? 'rgba(128, 128, 128, 0.15)' : 'rgba(128, 128, 128, 0.08)',
                            },
                          ]}>
                          <ThemedText style={styles.toolText}>
                            {tool}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                
                {hasThinking && (
                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Reasoning</ThemedText>
                    <ThemedText style={styles.sectionContent}>{thinkingItem.thinking}</ThemedText>
                  </View>
                )}
                
                {hasAction && (
                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Action</ThemedText>
                    <ThemedText style={styles.sectionContent}>{thinkingItem.action}</ThemedText>
                  </View>
                )}
                
                {hasMemory && (
                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Memory Context</ThemedText>
                    <View style={[
                      styles.memoryBadge,
                      {
                        backgroundColor: isDark ? 'rgba(128, 128, 128, 0.15)' : 'rgba(128, 128, 128, 0.08)',
                      }
                    ]}>
                      <ThemedText style={styles.memoryText}>
                        Used {thinkingItem.memoryCount || 0} relevant memor{(thinkingItem.memoryCount || 0) > 1 ? 'ies' : 'y'} from past conversations
                      </ThemedText>
                    </View>
                  </View>
                )}

                {hasDataObj && (
                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Data</ThemedText>
                    <ThemedText style={styles.dataText}>
                      {JSON.stringify(thinkingItem.data, null, 2)}
                    </ThemedText>
                  </View>
                )}
                
                {itemIndex < thinkingArray.length - 1 && (
                  <View style={[
                    styles.separator,
                    { borderBottomColor: isDark ? 'rgba(128, 128, 128, 0.2)' : 'rgba(128, 128, 128, 0.1)' }
                  ]} />
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 6,
    alignSelf: 'flex-start',
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 4,
  },
  headerText: {
    fontSize: 11,
    opacity: 0.85,
    fontWeight: '500',
    marginRight: 4,
  },
  content: {
    padding: 10,
    paddingTop: 8,
    gap: 10,
    borderRadius: 8,
    marginTop: 4,
    minWidth: 200,
    maxWidth: '90%',
    borderWidth: 1,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.5,
    marginBottom: 2,
  },
  sectionContent: {
    fontSize: 12,
    opacity: 0.7,
    lineHeight: 18,
  },
  toolsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  toolTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toolText: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.7,
  },
  dataText: {
    fontSize: 10,
    fontFamily: 'monospace',
    opacity: 0.6,
    lineHeight: 15,
  },
  memoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  memoryText: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.7,
  },
  thinkingItem: {
    gap: 10,
  },
  itemNumber: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.4,
    marginBottom: 4,
  },
  separator: {
    borderBottomWidth: 1,
    marginTop: 12,
    marginBottom: 8,
  },
});

