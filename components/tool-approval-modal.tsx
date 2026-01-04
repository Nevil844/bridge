import { ThemedText } from '@/components/themed-text';
import { getIntegrationTypeForTool } from '@/components/ui/integrations/metadata';
import { getIntegrationDisplay } from '@/config/integrationCatalog';
import { mediumImpact, errorFeedback } from '@/utils/haptics';
import React from 'react';
import { Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface PendingTool {
  id: string;
  name: string;
  args: any;
  integration?: string | null;
}

interface Props {
  visible: boolean;
  isDark: boolean;
  tools: PendingTool[];
  approvalCountdown: string;
  approvalRemainingMs: number;
  approvalProgress: number;
  approvalColor: string;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
}

export function ToolApprovalModal({
  visible,
  isDark,
  tools,
  approvalCountdown,
  approvalRemainingMs,
  approvalProgress,
  approvalColor,
  onApprove,
  onReject,
  isApproving,
}: Props) {
  const resolveBrand = (tool: PendingTool) => {
    const integrationType =
      (typeof tool.args?.integration === 'string' && tool.args.integration) ||
      (typeof tool.integration === 'string' && tool.integration) ||
      getIntegrationTypeForTool(tool.name) ||
      '';
    const entry = getIntegrationDisplay(integrationType);
    return {
      name: entry?.name || integrationType || 'Unknown',
      logo: entry?.logo || null,
      toolName: tool.name || 'Tool',
    };
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onReject}>
      <View style={styles.toolModalOverlay}>
        <View
          style={[
            styles.toolApprovalCard,
            { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' },
          ]}>
          <View style={styles.toolHeaderRow}>
            <ThemedText style={styles.modalTitle}>Confirm tool</ThemedText>
            {approvalCountdown ? (
              <View style={styles.timerWrapper}>
                <View style={styles.timerBackground} />
                <View
                  style={[
                    styles.timerProgress,
                    {
                      borderColor: approvalColor,
                      transform: [{ scale: 0.4 + approvalProgress * 0.6 }],
                    },
                  ]}
                />
                <ThemedText style={styles.timerText}>
                  {Math.max(0, Math.ceil(approvalRemainingMs / 1000))}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText style={styles.toolApprovalSubtitle}>
            The assistant wants to run the following tool{tools.length === 1 ? '' : 's'}.
          </ThemedText>
          <ScrollView style={styles.toolList}>
            {tools.map((tool) => (
              <View
                key={tool.id}
                style={[
                  styles.toolCard,
                  { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' },
                ]}>
                {(() => {
                  const brand = resolveBrand(tool);
                  return (
                    <View style={styles.brandRow}>
                      {brand.logo ? (
                        <Image source={{ uri: brand.logo }} style={styles.brandLogo} resizeMode="contain" />
                      ) : (
                        <View style={[styles.brandLogo, styles.brandLogoPlaceholder]}>
                          <Text style={styles.brandPlaceholderText}>
                            {brand.name[0] || '?'}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.brandName}>{brand.name}</ThemedText>
                        <ThemedText style={styles.toolNameText}>{brand.toolName}</ThemedText>
                      </View>
                    </View>
                  );
                })()}
                <ThemedText style={styles.toolArgsLabel}>Parameters</ThemedText>
                <Text
                  style={[
                    styles.toolArgs,
                    { color: isDark ? '#E5E5EA' : '#1C1C1E' },
                  ]}>
                  {typeof tool.args === 'string'
                    ? tool.args
                    : JSON.stringify(tool.args, null, 2)}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.approvalButtons}>
            <TouchableOpacity
              style={[
                styles.rejectButton,
                {
                  backgroundColor: isDark ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.08)',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                },
              ]}
              onPress={() => {
                errorFeedback();
                onReject();
              }}
              disabled={isApproving}>
              <ThemedText style={styles.rejectButtonText}>
                {isApproving ? 'Processing...' : 'Reject'}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.approveButton,
                { backgroundColor: isDark ? '#0A84FF' : '#007AFF' },
              ]}
              onPress={() => {
                mediumImpact();
                onApprove();
              }}
              disabled={isApproving}>
              <ThemedText style={styles.approveButtonText}>
                {isApproving ? 'Processing...' : 'Approve'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toolModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  toolApprovalCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
    width: '100%',
  },
  toolHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  timerWrapper: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBackground: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  timerProgress: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  toolApprovalSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    paddingHorizontal: 2,
  },
  toolList: {
    maxHeight: 260,
    marginTop: 8,
    marginBottom: 8,
  },
  toolCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  brandLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  brandLogoPlaceholder: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandPlaceholderText: {
    fontSize: 14,
    fontWeight: '700',
  },
  brandName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  toolNameText: {
    fontSize: 12,
    opacity: 0.7,
  },
  toolArgsLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  toolArgs: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  approvalButtons: {
    flexDirection: 'row',
    columnGap: 10,
    marginTop: 4,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  rejectButtonText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default ToolApprovalModal;

