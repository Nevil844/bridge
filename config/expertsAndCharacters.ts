// Frontend interface - system prompts are NOT included (server-side only)
export interface ExpertOrCharacter {
  id: string;
  name: string;
  type: 'expert' | 'character';
  emoji?: string;
}

