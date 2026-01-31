import type { TransformationType } from '../types/messages';

export interface TransformerConfig {
  id: TransformationType;
  label: string;
  description: string;
  promptTemplate: string;
}

class TransformerRegistry {
  private transformers: Map<TransformationType, TransformerConfig> = new Map();

  register(transformer: TransformerConfig): void {
    this.transformers.set(transformer.id, transformer);
  }

  get(id: TransformationType): TransformerConfig | undefined {
    return this.transformers.get(id);
  }

  getAll(): TransformerConfig[] {
    return Array.from(this.transformers.values());
  }

  getStandardTransformers(): TransformerConfig[] {
    return this.getAll().filter(t => t.id !== 'custom' && t.id !== 'translate');
  }
}

export const transformerRegistry = new TransformerRegistry();

// Register default transformers
transformerRegistry.register({
  id: 'improve',
  label: 'Improve',
  description: 'Fix grammar, spelling, and clarity issues',
  promptTemplate: `Fix grammar, spelling, and clarity issues.
Make the text more fluent and professional WITHOUT changing tone or intent.
Avoid stylistic rewriting unless it improves readability or correctness.`,
});

transformerRegistry.register({
  id: 'rephrase',
  label: 'Rephrase',
  description: 'Rewrite using different wording',
  promptTemplate: `Rewrite the text using different wording while preserving meaning, tone, and level of formality.
Do NOT simplify or embellish.
Maintain approximately the same length.`,
});

transformerRegistry.register({
  id: 'shorten',
  label: 'Shorten',
  description: 'Make text more concise',
  promptTemplate: `Reduce the length of the text while preserving all key information and intent.
Remove redundancy and filler.
Do NOT remove essential details.
Aim for at least 30% reduction unless the text is already concise.`,
});

transformerRegistry.register({
  id: 'friendly',
  label: 'Friendly',
  description: 'Make text sound more approachable',
  promptTemplate: `Make the text sound friendly, approachable, and conversational.
Keep professionalism where appropriate.
Avoid slang, emojis, or excessive informality.
Preserve the original message and intent.`,
});

transformerRegistry.register({
  id: 'formal',
  label: 'Formal',
  description: 'Make text more professional',
  promptTemplate: `Make the text sound formal, professional, and business-appropriate.
Avoid casual language, contractions, and colloquial phrasing.
Preserve meaning and structure.`,
});

transformerRegistry.register({
  id: 'translate',
  label: 'Translate',
  description: 'Translate to/from English',
  promptTemplate: `Auto-detect the source language.
If the text is NOT English, translate it into natural, fluent English.
If the text IS English, translate it into natural, fluent Spanish.
Preserve formatting and structure.`,
});

transformerRegistry.register({
  id: 'custom',
  label: 'Custom',
  description: 'Apply custom transformation',
  promptTemplate: `Transform the following text as requested.`,
});
