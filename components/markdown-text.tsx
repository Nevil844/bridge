import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

interface MarkdownTextProps {
  text: string;
  isUser?: boolean;
}

export function MarkdownText({ text, isUser = false }: MarkdownTextProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textColor = isUser ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#000000');
  const codeBg = isDark ? '#1C1C1E' : '#E5E5EA';
  const codeText = isDark ? '#FFFFFF' : '#000000';

  if (!text) {
    return null;
  }

  // Parse markdown and return React elements
  const parseMarkdown = (input: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    let keyCounter = 0;
    const getKey = () => `md-${keyCounter++}`;

    // First, extract code blocks
    const codeBlockRegex = /```([\s\S]*?)```/g;
    const segments: Array<{ type: 'text' | 'code'; content: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(input)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          type: 'text',
          content: input.substring(lastIndex, match.index),
        });
      }
      segments.push({
        type: 'code',
        content: match[1],
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < input.length) {
      segments.push({
        type: 'text',
        content: input.substring(lastIndex),
      });
    }

    if (segments.length === 0) {
      segments.push({ type: 'text', content: input });
    }

    // Process each segment
    segments.forEach(segment => {
      if (segment.type === 'code') {
        result.push(
          <View key={getKey()} style={[styles.codeBlock, { backgroundColor: codeBg }]}>
            <Text style={[styles.codeBlockText, { color: codeText }]}>
              {segment.content.trim()}
            </Text>
          </View>
        );
      } else {
        // Process text content line by line
        const lines = segment.content.split('\n');
        const processedLines: React.ReactNode[] = [];
        let currentList: Array<string | { 
          type: 'ordered' | 'unordered' | 'checkbox'; 
          content: string; 
          number?: string; 
          checkbox?: string;
          indent?: number;
        }> = [];

        const flushList = () => {
          if (currentList.length === 0) return;
          
          const listKey = getKey();
          processedLines.push(
            <View key={listKey} style={styles.listContainer}>
              {currentList.map((item, idx) => {
                if (typeof item === 'string') {
                  // Legacy support for plain strings
                  return (
                    <View key={`${listKey}-item-${idx}`} style={styles.listItemRow}>
                      <View style={styles.unorderedMarkerContainer}>
                        <Text style={[styles.unorderedMarker, { color: textColor }]}>•</Text>
                      </View>
                      <View style={styles.listItemTextContainer}>
                        <Text style={[styles.listItemText, { color: textColor }]}>
                          {parseInlineFormatting(item, `${listKey}-${idx}`, textColor, codeBg, codeText)}
                        </Text>
                      </View>
                    </View>
                  );
                }

                const isOrdered = item.type === 'ordered';
                const isCheckbox = item.type === 'checkbox';
                const content = item.content;
                const indent = item.indent || 0;
                
                const marker = isOrdered 
                  ? `${item.number}.`
                  : isCheckbox
                  ? (item.checkbox || '☐')
                  : '•';
                
                return (
                  <View 
                    key={`${listKey}-item-${idx}`} 
                    style={[styles.listItemRow, indent > 0 && { paddingLeft: indent * 20 }]}
                  >
                    {isOrdered && (
                      <View style={styles.orderedMarkerContainer}>
                        <Text style={[styles.orderedMarker, { color: textColor }]}>
                          {marker}
                        </Text>
                      </View>
                    )}
                    {isCheckbox && (
                      <View style={styles.checkboxMarkerContainer}>
                        <Text style={[styles.checkboxMarker, { color: textColor }]}>
                          {marker}
                        </Text>
                      </View>
                    )}
                    {!isOrdered && !isCheckbox && (
                      <View style={styles.unorderedMarkerContainer}>
                        <Text style={[styles.unorderedMarker, { color: textColor }]}>
                          {marker}
                        </Text>
                      </View>
                    )}
                    <View style={styles.listItemTextContainer}>
                      <Text style={[styles.listItemText, { color: textColor }]}>
                        {parseInlineFormatting(content, `${listKey}-${idx}`, textColor, codeBg, codeText)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
          currentList = [];
        };

        lines.forEach((line, lineIndex) => {
          const trimmedLine = line.trim();
          const originalLine = line;
          
          // Check for unordered list items (-, *, •)
          const unorderedListMatch = trimmedLine.match(/^[-*•]\s+(.+)$/);
          if (unorderedListMatch) {
            // Check if indented (nested)
            const indent = originalLine.search(/\S/);
            currentList.push({ 
              type: 'unordered', 
              content: unorderedListMatch[1],
              indent: indent > 0 ? Math.floor(indent / 2) : 0
            });
            // Flush at end or when next line is not a list item
            if (lineIndex === lines.length - 1) {
              flushList();
            } else {
              const nextLine = lines[lineIndex + 1].trim();
              if (!nextLine.match(/^[-*•☐□✓✔]\s+/) && !nextLine.match(/^\d+\.\s+/)) {
                flushList();
              }
            }
            return;
          }

          // Check for checkbox list items (☐, □, ✓, ✔) - with or without bullet prefix
          const checkboxMatch = trimmedLine.match(/^[☐□✓✔]\s+(.+)$/);
          const bulletCheckboxMatch = trimmedLine.match(/^[-*•]\s+[☐□✓✔]\s+(.+)$/);
          
          if (bulletCheckboxMatch) {
            // Handle bullet + checkbox format (• ☐ text)
            const indent = originalLine.search(/\S/);
            const checkbox = trimmedLine.match(/[☐□✓✔]/)?.[0] || '☐';
            currentList.push({ 
              type: 'checkbox', 
              content: bulletCheckboxMatch[1],
              checkbox: checkbox,
              indent: indent > 0 ? Math.floor(indent / 2) : 0
            });
            // Flush at end or when next line is not a list item
            if (lineIndex === lines.length - 1) {
              flushList();
            } else {
              const nextLine = lines[lineIndex + 1].trim();
              if (!nextLine.match(/^[-*•☐□✓✔]\s+/) && !nextLine.match(/^\d+\.\s+/)) {
                flushList();
              }
            }
            return;
          } else if (checkboxMatch) {
            // Handle standalone checkbox format (☐ text)
            const indent = originalLine.search(/\S/);
            const checkbox = trimmedLine[0];
            currentList.push({ 
              type: 'checkbox', 
              content: checkboxMatch[1],
              checkbox: checkbox,
              indent: indent > 0 ? Math.floor(indent / 2) : 0
            });
            // Flush at end or when next line is not a list item
            if (lineIndex === lines.length - 1) {
              flushList();
            } else {
              const nextLine = lines[lineIndex + 1].trim();
              if (!nextLine.match(/^[-*•☐□✓✔]\s+/) && !nextLine.match(/^\d+\.\s+/)) {
                flushList();
              }
            }
            return;
          }

          // Check for ordered list items (1., 2., etc.)
          const orderedListMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
          if (orderedListMatch) {
            const indent = originalLine.search(/\S/);
            currentList.push({ 
              type: 'ordered', 
              number: orderedListMatch[1], 
              content: orderedListMatch[2],
              indent: indent > 0 ? Math.floor(indent / 2) : 0
            });
            // Flush at end or when next line is not a list item
            if (lineIndex === lines.length - 1) {
              flushList();
            } else {
              const nextLine = lines[lineIndex + 1].trim();
              if (!nextLine.match(/^[-*•☐□✓✔]\s+/) && !nextLine.match(/^\d+\.\s+/)) {
                flushList();
              }
            }
            return;
          }

          // Flush any pending list
          flushList();

          // Check for headers with # syntax
          const headerMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
          if (headerMatch) {
            const level = headerMatch[1].length;
            processedLines.push(
              <Text key={getKey()} style={[styles[`h${level}` as keyof typeof styles], { color: textColor }]}>
                {parseInlineFormatting(headerMatch[2], getKey(), textColor, codeBg, codeText)}
              </Text>
            );
            return;
          }

          // Check for bold text as heading (entire line is **text**)
          const boldHeadingMatch = trimmedLine.match(/^\*\*(.+)\*\*$/);
          if (boldHeadingMatch) {
            processedLines.push(
              <Text key={getKey()} style={[styles.boldHeading, { color: textColor }]}>
                {boldHeadingMatch[1]}
              </Text>
            );
            return;
          }

          // Regular text line
          if (trimmedLine) {
            processedLines.push(
              <Text key={getKey()} style={{ color: textColor }}>
                {parseInlineFormatting(trimmedLine, getKey(), textColor, codeBg, codeText)}
              </Text>
            );
          } else if (lineIndex < lines.length - 1) {
            // Empty line - add spacing
            processedLines.push(<View key={getKey()} style={{ height: 8 }} />);
          }
        });

        // Flush any remaining list
        flushList();
        result.push(...processedLines);
      }
    });

    return result.length > 0 ? result : [
      <Text key={getKey()} style={{ color: textColor }}>{input}</Text>
    ];
  };

  // Parse inline formatting (bold, italic, links, inline code)
  const parseInlineFormatting = (
    text: string,
    baseKey: string,
    defaultColor: string,
    codeBg: string,
    codeText: string
  ): React.ReactNode[] => {
    if (!text) return [];

    const parts: React.ReactNode[] = [];
    let keyIndex = 0;
    const getKey = () => `${baseKey}-inline-${keyIndex++}`;

    // Find all formatting tokens
    interface Token {
      type: 'code' | 'link' | 'bold' | 'italic';
      start: number;
      end: number;
      content: string;
      url?: string;
    }

    const tokens: Token[] = [];

    // Find inline code (highest priority)
    const codeRegex = /`([^`]+)`/g;
    let match: RegExpExecArray | null;
    while ((match = codeRegex.exec(text)) !== null) {
      tokens.push({
        type: 'code',
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }

    // Find links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    while ((match = linkRegex.exec(text)) !== null) {
      tokens.push({
        type: 'link',
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
        url: match[2],
      });
    }

    // Find bold (**text**)
    const boldRegex = /\*\*(.+?)\*\*/g;
    while ((match = boldRegex.exec(text)) !== null) {
      tokens.push({
        type: 'bold',
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }

    // Find italic (*text* but not **text**)
    // Use negative lookbehind and lookahead to avoid matching bold markers
    const italicRegex = /(?<!\*)\*([^*]+?)\*(?!\*)/g;
    while ((match = italicRegex.exec(text)) !== null) {
      // Skip if overlaps with bold token
      const overlapsBold = tokens.some(t => 
        t.type === 'bold' && match!.index >= t.start && match!.index < t.end
      );
      if (overlapsBold) continue;

      tokens.push({
        type: 'italic',
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }

    // Sort by position and remove overlaps
    tokens.sort((a, b) => a.start - b.start);
    const nonOverlapping: Token[] = [];
    let lastEnd = 0;
    for (const token of tokens) {
      if (token.start >= lastEnd) {
        nonOverlapping.push(token);
        lastEnd = token.end;
      }
    }

    // Build result
    let pos = 0;
    for (const token of nonOverlapping) {
      // Add text before token
      if (token.start > pos) {
        const plainText = text.substring(pos, token.start);
        if (plainText) {
          parts.push(plainText);
        }
      }

      // Add formatted token
      switch (token.type) {
        case 'code':
          parts.push(
            <Text key={getKey()} style={[styles.inlineCode, { backgroundColor: codeBg, color: codeText }]}>
              {token.content}
            </Text>
          );
          break;
        case 'link':
          parts.push(
            <Text
              key={getKey()}
              style={[styles.link, { color: '#4a9eff' }]}
              onPress={() => {
                if (token.url) {
                  Linking.openURL(token.url).catch(err => 
                    console.error('Failed to open URL:', err)
                  );
                }
              }}>
              {token.content}
            </Text>
          );
          break;
        case 'bold':
          parts.push(
            <Text key={getKey()} style={[styles.bold, { color: defaultColor }]}>
              {token.content}
            </Text>
          );
          break;
        case 'italic':
          parts.push(
            <Text key={getKey()} style={[styles.italic, { color: defaultColor }]}>
              {token.content}
            </Text>
          );
          break;
      }

      pos = token.end;
    }

    // Add remaining text
    if (pos < text.length) {
      const remaining = text.substring(pos);
      if (remaining) {
        parts.push(remaining);
      }
    }

    return parts.length > 0 ? parts : [text];
  };

  const parsed = parseMarkdown(text);

  return (
    <View style={styles.container}>
      {parsed}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  link: {
    color: '#4a9eff',
    textDecorationLine: 'underline',
  },
  inlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeBlock: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
  },
  codeBlockText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    lineHeight: 20,
  },
  listContainer: {
    marginVertical: 4,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: 0,
  },
  orderedMarkerContainer: {
    minWidth: 30,
    marginRight: 6,
    alignItems: 'flex-end',
  },
  unorderedMarkerContainer: {
    width: 20,
    marginRight: 6,
    alignItems: 'center',
  },
  checkboxMarkerContainer: {
    width: 20,
    marginRight: 6,
    alignItems: 'flex-start',
  },
  orderedMarker: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 1,
    fontWeight: '600',
  },
  unorderedMarker: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: 1,
  },
  checkboxMarker: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 1,
  },
  bullet: {
    fontSize: 18,
    lineHeight: 22,
    marginRight: 8,
    marginTop: 2,
  },
  listItemTextContainer: {
    flex: 1,
    flexShrink: 1,
  },
  listItemText: {
    lineHeight: 22,
    flexWrap: 'wrap',
  },
  h1: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  h2: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  boldHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
});
