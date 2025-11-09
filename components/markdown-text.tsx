import React from 'react';
import { Text, StyleSheet, Linking, View } from 'react-native';
import { ThemedText } from './themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

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

  // Parse markdown and return React elements
  const parseMarkdown = (input: string): React.ReactNode[] => {
    if (!input) return [<Text key="empty" style={{ color: textColor }}>{input}</Text>];

    const result: React.ReactNode[] = [];
    let key = 0;

    // Split by code blocks first
    const codeBlockRegex = /```([\s\S]*?)```/g;
    const parts: Array<{ type: 'text' | 'code'; content: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(input)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: input.substring(lastIndex, match.index),
        });
      }
      // Add code block
      parts.push({
        type: 'code',
        content: match[1],
      });
      lastIndex = match.index + match[0].length;
    }
    // Add remaining text
    if (lastIndex < input.length) {
      parts.push({
        type: 'text',
        content: input.substring(lastIndex),
      });
    }

    // If no code blocks found, treat entire input as text
    if (parts.length === 0) {
      parts.push({ type: 'text', content: input });
    }

    // Process each part
    parts.forEach(part => {
      if (part.type === 'code') {
        result.push(
          <View key={`codeblock-${key++}`} style={[styles.codeBlock, { backgroundColor: codeBg }]}>
            <Text style={[styles.codeBlockText, { color: codeText }]}>
              {part.content.trim()}
            </Text>
          </View>
        );
      } else {
        // Process text for inline markdown
        const lines = part.content.split('\n');
        lines.forEach((line, lineIndex) => {
          // Check for headers
          const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
          if (headerMatch) {
            const level = headerMatch[1].length;
            result.push(
              <Text key={`header-${key++}`} style={[styles[`h${level}` as keyof typeof styles], { color: textColor }]}>
                {headerMatch[2]}
              </Text>
            );
            if (lineIndex < lines.length - 1) {
              result.push(<Text key={`break-${key++}`}>{'\n'}</Text>);
            }
            return;
          }

          // Parse inline formatting
          const parsed = parseInlineFormatting(line, key, textColor, codeBg, codeText);
          if (parsed.length > 0) {
            result.push(
              <Text key={`line-${key++}`} style={{ color: textColor }}>
                {parsed}
              </Text>
            );
          }

          // Add line break (except for last line)
          if (lineIndex < lines.length - 1) {
            result.push(<Text key={`break-${key++}`}>{'\n'}</Text>);
          }
        });
      }
    });

    return result.length > 0 ? result : [<Text key={key} style={{ color: textColor }}>{input}</Text>];
  };

  // Parse inline formatting (bold, italic, links, inline code)
  const parseInlineFormatting = (
    text: string,
    startKey: number,
    defaultColor: string,
    codeBg: string,
    codeText: string
  ): React.ReactNode[] => {
    if (!text) return [];

    const parts: React.ReactNode[] = [];
    let key = startKey;

    // Find all tokens in order
    const tokens: Array<{
      type: 'code' | 'link' | 'bold' | 'italic' | 'text';
      start: number;
      end: number;
      content: string;
      url?: string;
    }> = [];

    // Find inline code (`code`) - highest priority
    const inlineCodeRegex = /`([^`\n]+)`/g;
    let match;
    while ((match = inlineCodeRegex.exec(text)) !== null) {
      tokens.push({
        type: 'code',
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }

    // Find links [text](url)
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
    const boldRegex = /\*\*([^*]+)\*\*/g;
    while ((match = boldRegex.exec(text)) !== null) {
      tokens.push({
        type: 'bold',
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }

    // Find italic (*text* but not **text**)
    const italicRegex = /(?<!\*)\*([^*\n]+)\*(?!\*)/g;
    while ((match = italicRegex.exec(text)) !== null) {
      // Double check it's not part of bold
      const before = text.substring(Math.max(0, match.index - 1), match.index);
      const after = text.substring(match.index + match[0].length, match.index + match[0].length + 1);
      if (before !== '*' && after !== '*') {
        tokens.push({
          type: 'italic',
          start: match.index,
          end: match.index + match[0].length,
          content: match[1],
        });
      }
    }

    // Sort by start position
    tokens.sort((a, b) => a.start - b.start);

    // Remove overlapping (keep first)
    const nonOverlapping: typeof tokens = [];
    let lastEnd = 0;
    tokens.forEach(token => {
      if (token.start >= lastEnd) {
        nonOverlapping.push(token);
        lastEnd = token.end;
      }
    });

    // Build result
    let lastPos = 0;
    nonOverlapping.forEach(token => {
      // Add plain text before token
      if (token.start > lastPos) {
        const plainText = text.substring(lastPos, token.start);
        if (plainText) {
          parts.push(
            <Text key={`text-${key++}`} style={{ color: defaultColor }}>
              {plainText}
            </Text>
          );
        }
      }

      // Add formatted token
      switch (token.type) {
        case 'code':
          parts.push(
            <Text key={`code-${key++}`} style={[styles.inlineCode, { backgroundColor: codeBg, color: codeText }]}>
              {token.content}
            </Text>
          );
          break;
        case 'link':
          parts.push(
            <Text
              key={`link-${key++}`}
              style={[styles.link, { color: '#4a9eff' }]}
              onPress={() => {
                if (token.url) {
                  Linking.openURL(token.url).catch(err => console.error('Failed to open URL:', err));
                }
              }}>
              {token.content}
            </Text>
          );
          break;
        case 'bold':
          parts.push(
            <Text key={`bold-${key++}`} style={[styles.bold, { color: defaultColor }]}>
              {token.content}
            </Text>
          );
          break;
        case 'italic':
          parts.push(
            <Text key={`italic-${key++}`} style={[styles.italic, { color: defaultColor }]}>
              {token.content}
            </Text>
          );
          break;
      }

      lastPos = token.end;
    });

    // Add remaining plain text
    if (lastPos < text.length) {
      const plainText = text.substring(lastPos);
      if (plainText) {
        parts.push(
          <Text key={`text-${key++}`} style={{ color: defaultColor }}>
            {plainText}
          </Text>
        );
      }
    }

    return parts.length > 0 ? parts : [<Text key={key} style={{ color: defaultColor }}>{text}</Text>];
  };

  const parsed = parseMarkdown(text);

  return (
    <ThemedText style={{ color: textColor }}>
      {parsed.length > 0 ? parsed : <Text style={{ color: textColor }}>{text}</Text>}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
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
    fontFamily: 'monospace',
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
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 20,
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
});
