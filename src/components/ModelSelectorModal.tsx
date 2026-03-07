import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModelInfo } from '../types';
import { COLORS } from '../constants';
import { formatPrice } from '../constants/pricing';

export interface SelectedModel {
  providerId: string;
  modelId: string;
}

interface ModelSelectorModalProps {
  visible: boolean;
  models: Map<string, ModelInfo[]>;
  selectedModel: SelectedModel | null;
  onSelect: (providerId: string, modelId: string) => void;
  onClose: () => void;
}

export default function ModelSelectorModal({
  visible,
  models,
  selectedModel,
  onSelect,
  onClose,
}: ModelSelectorModalProps) {
  const handleSelect = useCallback(
    (providerId: string, modelId: string) => {
      onSelect(providerId, modelId);
      onClose();
    },
    [onSelect, onClose],
  );

  const sections: { providerName: string; items: ModelInfo[] }[] = [];
  models.forEach((items) => {
    if (items.length > 0) {
      sections.push({ providerName: items[0].providerName, items });
    }
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <Text style={styles.title}>Models</Text>
              <ScrollView
                style={styles.list}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {sections.length === 0 && (
                  <Text style={styles.emptyText}>No models available</Text>
                )}
                {sections.map((section) => (
                  <View key={section.providerName} style={styles.section}>
                    <Text style={styles.sectionHeader}>{section.providerName}</Text>
                    {section.items.map((model) => {
                      const isSelected =
                        selectedModel?.providerId === model.providerId &&
                        selectedModel?.modelId === model.id;
                      return (
                        <TouchableOpacity
                          key={`${model.providerId}-${model.id}`}
                          style={[styles.modelRow, isSelected && styles.modelRowSelected]}
                          onPress={() => handleSelect(model.providerId, model.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.modelInfo}>
                            <Text
                              style={[styles.modelName, isSelected && styles.modelNameSelected]}
                              numberOfLines={1}
                            >
                              {model.name}
                            </Text>
                            {model.inputPrice != null && model.outputPrice != null && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                <Ionicons name="arrow-up" size={12} color={COLORS.textMuted} />
                                <Text style={styles.pricingText} numberOfLines={1}>
                                  {formatPrice(model.inputPrice)}{'  '}
                                </Text>
                                <Ionicons name="arrow-down" size={12} color={COLORS.textMuted} />
                                <Text style={styles.pricingText} numberOfLines={1}>
                                  {formatPrice(model.outputPrice)} /MTok
                                </Text>
                              </View>
                            )}
                          </View>
                          {isSelected && <Ionicons name="checkmark" size={18} color={COLORS.secondary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  title: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  list: {
    flexGrow: 0,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  modelRowSelected: {
    backgroundColor: COLORS.surfaceLight,
  },
  modelInfo: {
    flex: 1,
    marginRight: 8,
  },
  modelName: {
    color: COLORS.text,
    fontSize: 16,
  },
  modelNameSelected: {
    fontWeight: '600',
  },
  pricingText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  check: {
    color: COLORS.secondary,
    fontSize: 16,
    fontWeight: '700',
  },
});
