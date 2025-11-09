import React, { useState } from 'react';
import type { ChatMessage } from '../types';
import { MessageAuthor } from '../types';
import { CopyIcon, CheckIcon, RobotIcon, SpeakerIcon, SpinnerIcon } from './icons';

interface ChatBubbleProps {
  message: ChatMessage;
  onReadAloud?: (message: ChatMessage) => void;
  ttsLoadingId?: string | null;
  currentlyPlayingId?: string | null;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, onReadAloud, ttsLoadingId, currentlyPlayingId }) => {
  const [copied, setCopied] = useState(false);

  if (message.isLoading) {
    return (
      <div className="w-full max-w-xl lg:max-w-3xl mx-auto flex flex-col items-start">
        <div className="px-4 py-3 rounded-2xl bg-white/20 dark:bg-slate-700/80 self-start flex items-center space-x-3 backdrop-blur-sm">
          <RobotIcon className="w-6 h-6 text-fuchsia-400" />
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-pulse" style={{animationDelay: '-0.3s'}}></span>
            <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-pulse" style={{animationDelay: '-0.15s'}}></span>
            <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-pulse"></span>
          </div>
        </div>
      </div>
    );
  }

  if (message.author === MessageAuthor.SYSTEM) {
    return (
      <div className="w-full max-w-xl lg:max-w-3xl mx-auto flex justify-center">
        <p className="text-sm text-slate-500 dark:text-slate-400 italic px-4 py-2 bg-white/20 dark:bg-slate-800/50 rounded-full backdrop-blur-sm">{message.text}</p>
      </div>
    );
  }

  const isUser = message.author === MessageAuthor.USER;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const authorDisplay = isUser && message.detectedLanguage && message.text
    ? `You (Detected: ${message.detectedLanguage})`
    : (isUser ? "You" : "Vaani");

  const bubbleClasses = isUser
    ? 'bg-gradient-to-br from-cyan-500 to-sky-600 text-white self-end'
    : 'bg-white dark:bg-slate-700/80 self-start backdrop-blur-sm border border-slate-200 dark:border-transparent';
  
  return (
    <div className={`w-full max-w-xl lg:max-w-3xl mx-auto flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`px-5 py-3 rounded-2xl shadow-md ${bubbleClasses} relative group max-w-[90%]`}>
        <p className={`font-bold text-sm mb-1 ${isUser ? 'text-cyan-200' : 'text-fuchsia-600 dark:text-fuchsia-400'}`}>{authorDisplay}</p>
        <p className={`whitespace-pre-wrap ${isUser ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>{message.text}</p>
        
        {message.text && (
          <div className="absolute -top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 bg-slate-100/80 dark:bg-slate-900/50 backdrop-blur-lg border border-slate-200 dark:border-slate-600/50 rounded-full shadow-lg">
            {onReadAloud && (
              <button
                onClick={() => onReadAloud(message)}
                className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-full transition-colors"
                aria-label="Read aloud"
                disabled={ttsLoadingId === message.id}
              >
                {ttsLoadingId === message.id ? (
                  <SpinnerIcon className="w-4 h-4" />
                ) : (
                  <SpeakerIcon className={`w-4 h-4 ${currentlyPlayingId === message.id ? 'text-cyan-500 dark:text-cyan-400 animate-pulse' : ''}`} />
                )}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-full transition-colors"
              aria-label="Copy message"
            >
              {copied ? (
                <CheckIcon className="w-4 h-4 text-green-500" />
              ) : (
                <CopyIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};