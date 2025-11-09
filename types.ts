
export enum MessageAuthor {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export interface ChatMessage {
  id: string;
  author: MessageAuthor;
  text: string;
  isLoading?: boolean;
  detectedLanguage?: string;
}

export interface Language {
  code: string;
  name: string;
}

export interface Voice {
  id: string;
  name: string;
  geminiVoice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
}

export interface ChatSession {
  id: string;
  timestamp: number;
  mode: 'translator' | 'assistant';
  language1: Language;
  language2: Language;
  messages: ChatMessage[];
}