import type { Language, Voice } from './types';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'mr', name: 'Marathi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese (Mandarin)' },
  { code: 'ar', name: 'Arabic' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ur', name: 'Urdu' },
];

export const VOICE_OPTIONS: Voice[] = [
  { id: 'zephyr', name: 'Male 1', geminiVoice: 'Zephyr' },
  { id: 'puck', name: 'Male 2', geminiVoice: 'Puck' },
  { id: 'kore', name: 'Female 1', geminiVoice: 'Kore' },
  { id: 'charon', name: 'Female 2', geminiVoice: 'Charon' },
  { id: 'fenrir', name: 'Male (Child)', geminiVoice: 'Fenrir' },
];

export const DEFAULT_LANGUAGE_1: Language = SUPPORTED_LANGUAGES[3]; // Tamil
export const DEFAULT_LANGUAGE_2: Language = SUPPORTED_LANGUAGES[0]; // English
export const DEFAULT_VOICE: Voice = VOICE_OPTIONS[0]; // Zephyr