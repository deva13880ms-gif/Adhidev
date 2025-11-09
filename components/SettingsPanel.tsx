import React from 'react';
import { CloseIcon } from './icons';
import type { Voice } from '../types';
import { VOICE_OPTIONS } from '../constants';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  showText: boolean;
  setShowText: (show: boolean) => void;
  selectedVoice: Voice;
  setSelectedVoice: (voice: Voice) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  showText,
  setShowText,
  selectedVoice,
  setSelectedVoice,
  theme,
  setTheme,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/60 z-40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="fixed top-0 right-0 h-full w-96 max-w-[90vw] bg-white/80 dark:bg-slate-800/80 shadow-2xl p-6 z-50 transform transition-transform duration-300 ease-in-out backdrop-blur-2xl border-l border-white/20 dark:border-slate-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h2>
          <button onClick={onClose} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-500/20 rounded-full transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-8">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Theme</label>
            <div className="flex items-center space-x-2 bg-slate-200 dark:bg-slate-700/50 rounded-xl p-1">
              <button
                onClick={() => setTheme('light')}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  theme === 'light' 
                  ? 'bg-white text-cyan-600 shadow-md' 
                  : 'text-slate-500 dark:text-slate-300 hover:bg-white/30 dark:hover:bg-slate-600/50'
                }`}
              >
                Light
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  theme === 'dark' 
                  ? 'bg-slate-600 text-cyan-300 shadow-md' 
                  : 'text-slate-500 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-slate-200/10'
                }`}
              >
                Dark
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Display Transcriptions</label>
            <div className="flex items-center justify-between bg-slate-200/60 dark:bg-slate-700/50 rounded-xl p-4">
              <span className="text-slate-800 dark:text-slate-200 font-medium">Show text on screen</span>
              <button
                onClick={() => setShowText(!showText)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ease-in-out shadow-inner ${showText ? 'bg-cyan-500' : 'bg-slate-400 dark:bg-slate-600'}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ease-in-out ${showText ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Voice Tone</label>
            <div className="grid grid-cols-2 gap-3">
              {VOICE_OPTIONS.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice)}
                  className={`w-full text-center p-4 rounded-xl transition-all duration-200 border-2 transform active:scale-95 ${
                    selectedVoice.id === voice.id
                      ? 'bg-cyan-500/20 border-cyan-500 text-slate-900 dark:text-white font-semibold shadow-lg'
                      : 'bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {voice.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};