import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface ThinkingData {
  isInternal: boolean;
  thinking: string;
  action: string;
  toolCalls: string[];
  data: any;
  memoryUsed?: boolean;
  memoryCount?: number;
}

interface ThinkingProcessProps {
  thinking: ThinkingData;
}

export function ThinkingProcess({ thinking }: ThinkingProcessProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Don't show anything if no thinking data at all
  if (!thinking) {
    return null;
  }
  
  // Show if there's ANY data
  const hasToolCalls = thinking.toolCalls && Array.isArray(thinking.toolCalls) && thinking.toolCalls.length > 0;
  const hasThinking = thinking.thinking && thinking.thinking.trim().length > 0;
  const hasAction = thinking.action && thinking.action.trim().length > 0;
  const hasDataObj = thinking.data && Object.keys(thinking.data).length > 0;
  
  const hasAnyData = hasToolCalls || hasThinking || hasAction || hasDataObj;
    
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
            backgroundColor: isDark ? 'rgba(128, 128, 128, 0.05)' : 'rgba(128, 128, 128, 0.03)',
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
            color={isDark ? '#9CA3AF' : '#6B7280'}
            style={styles.icon}
          />
          <ThemedText style={styles.headerText}>
            Thinking
          </ThemedText>
        </View>
        <IconSymbol
          name={isExpanded ? 'chevron.up' : 'chevron.down'}
          size={9}
          color={isDark ? '#9CA3AF' : '#6B7280'}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View
          style={[
            styles.content,
            {
              backgroundColor: isDark ? 'rgba(128, 128, 128, 0.05)' : 'rgba(128, 128, 128, 0.03)',
            },
          ]}>
          {hasToolCalls && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Tools Used</ThemedText>
              <View style={styles.toolsContainer}>
                {thinking.toolCalls.map((tool, index) => (
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
              <ThemedText style={styles.sectionContent}>{thinking.thinking}</ThemedText>
            </View>
          )}
          
          {thinking.memoryUsed && thinking.memoryCount && thinking.memoryCount > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Memory Context</ThemedText>
              <View style={[
                styles.memoryBadge,
                {
                  backgroundColor: isDark ? 'rgba(128, 128, 128, 0.15)' : 'rgba(128, 128, 128, 0.08)',
                }
              ]}>
                <ThemedText style={styles.memoryText}>
                  Used {thinking.memoryCount} relevant memor{thinking.memoryCount > 1 ? 'ies' : 'y'} from past conversations
                </ThemedText>
              </View>
            </View>
          )}

          {hasDataObj && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Data</ThemedText>
              <ThemedText style={styles.dataText}>
                {JSON.stringify(thinking.data, null, 2)}
              </ThemedText>
            </View>
          )}
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
    opacity: 0.5,
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
});

