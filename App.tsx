import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { useGeminiLive, ConnectionState } from './hooks/useGeminiLive';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE_1, DEFAULT_LANGUAGE_2, DEFAULT_VOICE } from './constants';
import type { Language, Voice, ChatMessage, ChatSession } from './types';
import { MessageAuthor } from './types';
import { ChatBubble } from './components/ChatBubble';
import { SettingsPanel } from './components/SettingsPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { loadChatHistory, saveOrUpdateSession, deleteSession, clearAllHistory } from './utils/history';
import { decode, decodeAudioData } from './utils/audio';
import { MicrophoneIcon, SettingsIcon, SwitchHorizontalIcon, SendIcon, SpinnerIcon, PlusIcon, TrashIcon, HistoryIcon, BrandIcon } from './components/icons';

type AppMode = 'translator' | 'assistant';
type AppTheme = 'light' | 'dark';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('translator');
  const [language1, setLanguage1] = useState<Language>(DEFAULT_LANGUAGE_1);
  const [language2, setLanguage2] = useState<Language>(DEFAULT_LANGUAGE_2);
  const [selectedVoice, setSelectedVoice] = useState<Voice>(DEFAULT_VOICE);
  const [showText, setShowText] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => {
    const savedTheme = localStorage.getItem('vaani_theme');
    // Default to dark theme if no preference or system prefers dark
    if (savedTheme) return savedTheme as AppTheme;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });


  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isTranslatingText, setIsTranslatingText] = useState(false);

  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  
  const translationCache = useRef(new Map<string, string>());
  const ttsRequestRef = useRef<string | null>(null);
  const ttsAudioContextRef = useRef<AudioContext | null>(null);
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ttsQueueRef = useRef<string[]>([]);


  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      body.classList.add('dark');
      body.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      body.classList.add('light');
      body.classList.remove('dark');
    }
    localStorage.setItem('vaani_theme', theme);
  }, [theme]);

  const systemInstruction = useMemo(() => {
    if (mode === 'translator') {
      return `You are an expert real-time interpreter, a cultural and linguistic bridge between speakers. Your primary goal is to provide translations that are not only accurate but also culturally appropriate, natural, and contextually aware.
- **Translate Meaning, Not Words:** Go beyond literal, word-for-word transliteration. Capture the full meaning, intent, emotion, and nuance of the original phrase.
- **Handle Idioms and Slang:** When you encounter an idiom, colloquialism, or culturally specific phrase (e.g., 'break a leg'), do not translate it literally. Instead, provide the closest equivalent idiom or phrase in the target language that conveys the same meaning and spirit (e.g., a local way of saying 'good luck').
- **Task:** When you hear a phrase in ${language1.name}, you must immediately translate its meaning to ${language2.name} and speak the translation. When you hear a phrase in ${language2.name}, you must immediately translate its meaning to ${language1.name} and speak the translation.
- **Strict Output Format:** Your response must ONLY be the translated speech. Do not add any extra commentary, explanations, or introductory phrases like "The translation is...". Your voice should be pleasant and clear.`;
    } else { // assistant mode
      return `You are Vaani, a friendly and helpful AI assistant. You must converse with the user in ${language2.name}. Respond to their questions and follow their commands helpfully and conversationally.`;
    }
  }, [mode, language1, language2]);

  const { connect, disconnect, connectionState, transcripts, detectedLanguageCode } = useGeminiLive(systemInstruction, selectedVoice);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const liveSessionMessageIds = useRef(new Set<string>());

  const isSessionActive = connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING;

  const stopTtsPlayback = useCallback(() => {
    if (ttsSourceRef.current) {
        try {
            ttsSourceRef.current.onended = null;
            ttsSourceRef.current.stop();
        } catch (e) {
            // Can throw if already stopped
        }
        ttsSourceRef.current.disconnect();
        ttsSourceRef.current = null;
    }
    ttsRequestRef.current = null;
    ttsQueueRef.current = [];
    setCurrentlyPlayingId(null);
    setTtsLoadingId(null);
  }, []);
  
  const handleNewChat = useCallback(() => {
    if (isSessionActive) {
      disconnect();
    }
    stopTtsPlayback();
    setActiveSessionId(null);
    setMessages([]);
    liveSessionMessageIds.current.clear();
    setTextInput('');
  }, [isSessionActive, disconnect, stopTtsPlayback]);

  // Load history on initial render
  useEffect(() => {
    const history = loadChatHistory();
    setChatHistory(history);
    if (history.length > 0) {
      // Load the most recent session
      const lastSession = history[0];
      setActiveSessionId(lastSession.id);
      setMessages(lastSession.messages);
      setMode(lastSession.mode);
      setLanguage1(lastSession.language1);
      setLanguage2(lastSession.language2);
    } else {
      handleNewChat();
    }
  }, [handleNewChat]);

  // Save session whenever messages or settings change for the active session
  useEffect(() => {
    // Don't save empty sessions that haven't started
    if (!activeSessionId || messages.length === 0) return;

    const currentSession: ChatSession = {
      id: activeSessionId,
      timestamp: Date.now(),
      mode,
      language1,
      language2,
      messages,
    };
    saveOrUpdateSession(currentSession);
    // Also update the history state to re-render the panel if it's open
    setChatHistory(loadChatHistory());
  }, [messages, mode, language1, language2, activeSessionId]);

  // Sync voice transcripts from the hook into the main messages state
  useEffect(() => {
    if (!isSessionActive && liveSessionMessageIds.current.size === 0) return;

    const newTranscriptIds = new Set(transcripts.map(t => t.id));

    setMessages(prevMessages => {
        // Filter out old live messages, then append the latest live messages
        const nonLiveMessages = prevMessages.filter(m => !liveSessionMessageIds.current.has(m.id));
        return [...nonLiveMessages, ...transcripts];
    });

    liveSessionMessageIds.current = newTranscriptIds;
  }, [transcripts, isSessionActive]);

  
  // Auto-scroll to the latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTranslatingText]);

  // Update language1 based on auto-detection
  useEffect(() => {
    if (mode === 'translator' && detectedLanguageCode) {
      const baseLanguageCode = detectedLanguageCode.split('-')[0];
      const newLang = SUPPORTED_LANGUAGES.find(l => l.code === baseLanguageCode);
      if (newLang && newLang.code !== language1.code) {
        setLanguage1(newLang);
      }
    }
  }, [detectedLanguageCode, mode, language1.code]);

  // Disconnect voice session & TTS if critical settings change
  useEffect(() => {
    if(isSessionActive) {
      disconnect();
    }
    stopTtsPlayback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, language2, activeSessionId, disconnect, stopTtsPlayback]);
  
  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 200; // 200px max height
      if (scrollHeight > maxHeight) {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.height = `${scrollHeight}px`;
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [textInput]);

  const ensureSessionExists = useCallback(() => {
    if (!activeSessionId) {
      const newSessionId = crypto.randomUUID();
      setActiveSessionId(newSessionId);
    }
  }, [activeSessionId]);

  const handleMicClick = () => {
    stopTtsPlayback();
    if (isSessionActive) {
      disconnect();
    } else {
      ensureSessionExists();
      liveSessionMessageIds.current.clear();
      connect();
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    const wasActiveSession = activeSessionId === sessionId;
    
    deleteSession(sessionId);
    const newHistory = loadChatHistory();
    setChatHistory(newHistory);
    
    if (wasActiveSession) {
      if (newHistory.length > 0) {
        handleLoadSession(newHistory[0].id);
      } else {
        handleNewChat();
      }
    }
  };

  const handleClearMessages = () => {
    if (messages.length === 0) return;
    if (window.confirm("Are you sure you want to delete this chat session from your history? This action cannot be undone.")) {
      if (activeSessionId) {
        handleDeleteSession(activeSessionId);
      } else {
        handleNewChat();
      }
    }
  };

  const handleClearAllHistory = () => {
    clearAllHistory();
    setChatHistory([]);
    handleNewChat();
    setIsHistoryOpen(false);
  };

  const handleLoadSession = (sessionId: string) => {
    const sessionToLoad = chatHistory.find(s => s.id === sessionId);
    if (sessionToLoad) {
      if (isSessionActive) disconnect();
      stopTtsPlayback();
      setActiveSessionId(sessionToLoad.id);
      setMessages(sessionToLoad.messages);
      setMode(sessionToLoad.mode);
      setLanguage1(sessionToLoad.language1);
      setLanguage2(sessionToLoad.language2);
      liveSessionMessageIds.current.clear();
      setIsHistoryOpen(false);
    }
  };
  
  const playNextChunk = useCallback(async (requestId: string) => {
    if (ttsRequestRef.current !== requestId || ttsQueueRef.current.length === 0) {
        if (ttsRequestRef.current === requestId) stopTtsPlayback();
        return;
    }

    const chunk = ttsQueueRef.current.shift();
    if (!chunk) {
      stopTtsPlayback();
      return;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const audioContext = ttsAudioContextRef.current!;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: chunk }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: selectedVoice.geminiVoice },
                    },
                },
            },
        });

        if (ttsRequestRef.current !== requestId) return; // Interrupted during API call

        let base64Audio: string | undefined;
        const parts = response.candidates?.[0]?.content?.parts;
        if (parts) {
          for (const part of parts) {
              if (part.inlineData?.data) {
                  base64Audio = part.inlineData.data;
                  break;
              }
          }
        }

        if (base64Audio) {
            const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
            if (ttsRequestRef.current !== requestId) return;

            if (ttsLoadingId) setTtsLoadingId(null);
            
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            
            source.onended = () => {
                if (ttsRequestRef.current === requestId) {
                    ttsSourceRef.current = null;
                    playNextChunk(requestId); // Play the next chunk
                }
            };
            
            source.start();
            ttsSourceRef.current = source;
        } else {
            // If a chunk fails, try the next one
            playNextChunk(requestId);
        }
    } catch (error) {
        console.error("Text-to-speech chunk failed:", error);
        stopTtsPlayback();
        setMessages(prev => [...prev, { id: crypto.randomUUID(), author: MessageAuthor.SYSTEM, text: "Sorry, I couldn't read that aloud." }]);
    }
}, [selectedVoice.geminiVoice, ttsLoadingId, stopTtsPlayback, setMessages]);


const handleReadAloud = useCallback(async (message: ChatMessage) => {
    if (currentlyPlayingId === message.id) {
        stopTtsPlayback();
        return;
    }
    stopTtsPlayback();

    const requestId = message.id;
    ttsRequestRef.current = requestId;
    setTtsLoadingId(requestId);
    setCurrentlyPlayingId(requestId);

    const chunks = message.text.match(/[^.!?\n]+(?:[.!?\n]|$)/g) || [message.text];
    ttsQueueRef.current = chunks.map(c => c.trim()).filter(Boolean);

    if (ttsQueueRef.current.length > 0) {
        if (!ttsAudioContextRef.current || ttsAudioContextRef.current.state === 'closed') {
            ttsAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        if (ttsAudioContextRef.current.state === 'suspended') {
            await ttsAudioContextRef.current.resume();
        }
        playNextChunk(requestId);
    } else {
        stopTtsPlayback();
    }
}, [currentlyPlayingId, stopTtsPlayback, playNextChunk]);


  const handleTextTranslate = async () => {
    const trimmedInput = textInput.trim();
    if (!trimmedInput || isSessionActive || isTranslatingText) return;

    stopTtsPlayback();
    ensureSessionExists();
    const userMessage: ChatMessage = { id: crypto.randomUUID(), author: MessageAuthor.USER, text: trimmedInput };
    setMessages(prev => [...prev, userMessage]);
    setTextInput('');
    setIsTranslatingText(true);

    const getCacheKey = (input: string) => {
      if (mode === 'translator') {
        return `${mode}:${language1.name}>${language2.name}:${input.toLowerCase()}`;
      }
      return `${mode}:${language2.name}:${input.toLowerCase()}`;
    };
    const cacheKey = getCacheKey(trimmedInput);

    if (translationCache.current.has(cacheKey)) {
      const cachedTranslation = translationCache.current.get(cacheKey)!;
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        author: MessageAuthor.ASSISTANT,
        text: cachedTranslation,
      };
      setTimeout(() => {
        setMessages(prev => [...prev, assistantMessage]);
        setIsTranslatingText(false);
      }, 150);
      return;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const textSystemInstruction = mode === 'translator'
            ? `You are an expert text interpreter and cultural liaison. Your task is to provide translations that are accurate, culturally appropriate, and contextually aware.
- **Translate Meaning, Not Words:** Go beyond literal transliteration. Capture the full meaning, intent, and nuance.
- **Handle Idioms and Slang:** When you encounter an idiom or culturally specific phrase, provide the closest equivalent idiom or phrase in the target language that conveys the same meaning and spirit. Do not translate it literally.
- **Task:** When you receive text in ${language1.name}, translate it to ${language2.name}. When you receive text in ${language2.name}, translate it to ${language1.name}.
- **Strict Output Format:** Your entire response must consist ONLY of the translated text. Do not add any extra commentary or explanations.`
            : `You are Vaani, a friendly and helpful AI assistant. You must converse with the user in ${language2.name}.`;

        const stream = await ai.models.generateContentStream({ model: 'gemini-2.5-pro', contents: trimmedInput, config: { systemInstruction: textSystemInstruction } });

        let assistantMessageId = '';
        let fullResponse = '';

        for await (const chunk of stream) {
            const chunkText = chunk.text;
            if (!chunkText) continue;
            
            fullResponse += chunkText;

            if (!assistantMessageId) {
                setIsTranslatingText(false); // Hide loading bubble on first chunk
                assistantMessageId = crypto.randomUUID();
                const assistantMessage: ChatMessage = { id: assistantMessageId, author: MessageAuthor.ASSISTANT, text: fullResponse };
                setMessages(prev => [...prev, assistantMessage]);
            } else {
                setMessages(prev => prev.map(msg =>
                    msg.id === assistantMessageId
                        ? { ...msg, text: fullResponse }
                        : msg
                ));
            }
        }
        if (fullResponse) {
            translationCache.current.set(cacheKey, fullResponse);
        }
    } catch (error) {
        console.error("Text translation failed:", error);
        const errorMessage: ChatMessage = { id: crypto.randomUUID(), author: MessageAuthor.SYSTEM, text: "Sorry, I couldn't process that. Please try again." };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsTranslatingText(false);
    }
  };
  
  const getStatusText = () => {
    const startText = mode === 'translator' ? "Tap the mic to start translating" : "Tap the mic to start chatting";
    if (isSessionActive) {
      return connectionState === ConnectionState.CONNECTING ? "Connecting..." : "Listening... Speak now.";
    }
    if (messages.length > 0) return "Tap the mic to continue the conversation.";
    return startText;
  }

  const handleLanguageChange = (setter: React.Dispatch<React.SetStateAction<Language>>) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
    if(newLang) setter(newLang);
  }

  const LanguageSelector: React.FC<{ value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, disabled: boolean }> = ({ value, onChange, disabled }) => (
    <div className="relative">
      <select value={value} onChange={onChange} className="bg-white/80 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-lg py-2 pl-3 pr-8 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 appearance-none disabled:opacity-50 transition-colors text-sm font-medium backdrop-blur-sm" disabled={disabled}>
        {SUPPORTED_LANGUAGES.map((lang) => (<option key={lang.code} value={lang.code}>{lang.name}</option>))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
    </div>
  );
  
  const LanguageSelectorsComponent: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => {
    if (mode === 'translator') {
      return (
        <div className="flex items-center justify-center space-x-2">
          <LanguageSelector value={language1.code} onChange={handleLanguageChange(setLanguage1)} disabled={isSessionActive} />
          <SwitchHorizontalIcon className="w-5 h-5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
          <LanguageSelector value={language2.code} onChange={handleLanguageChange(setLanguage2)} disabled={isSessionActive} />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center space-x-2">
        {!isMobile && <p className="text-sm text-slate-500 dark:text-slate-400">Language:</p>}
        <LanguageSelector value={language2.code} onChange={handleLanguageChange(setLanguage2)} disabled={isSessionActive} />
      </div>
    );
  };
  
  const ModeSwitcher = () => (
    <div className="relative bg-slate-200 dark:bg-slate-800 p-1 rounded-full flex text-sm font-semibold text-slate-600 dark:text-slate-300">
      <span className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white dark:bg-slate-700 shadow-md transition-transform duration-300 ease-in-out ${mode === 'assistant' ? 'translate-x-full' : ''}`}></span>
      <button onClick={() => setMode('translator')} disabled={isSessionActive} className="flex-1 px-4 py-1.5 rounded-full z-10 transition-colors disabled:opacity-50">Translator</button>
      <button onClick={() => setMode('assistant')} disabled={isSessionActive} className="flex-1 px-4 py-1.5 rounded-full z-10 transition-colors disabled:opacity-50">Assistant</button>
    </div>
  );

  const micButtonBaseClasses = "relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out shadow-lg transform active:scale-95 disabled:opacity-50";
  const micButtonColor = isSessionActive
      ? 'bg-gradient-to-br from-rose-500 to-red-600'
      : 'bg-gradient-to-br from-cyan-400 to-sky-500';
  const micIconColor = "text-white";

  return (
    <div className="flex flex-col h-screen bg-transparent text-slate-800 dark:text-slate-100 font-sans">
      <header className="p-4 border-b border-white/20 dark:border-slate-700/50 bg-white/10 dark:bg-slate-900/10 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center justify-between space-x-4 max-w-6xl mx-auto">
            <div className="flex-1 flex justify-start items-center space-x-2">
              <BrandIcon className="w-8 h-8"/>
              <h1 className="text-2xl font-bold whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">Vaani</h1>
            </div>
            <div className="flex-shrink-0 hidden md:block">
              <ModeSwitcher />
            </div>
            <div className="flex-1 flex items-center justify-end space-x-1 sm:space-x-2">
              <div className="hidden sm:flex items-center"><LanguageSelectorsComponent /></div>
              <button onClick={handleNewChat} className="p-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-500/20 rounded-full transition-colors" aria-label="New Chat"><PlusIcon className="w-6 h-6" /></button>
              <button onClick={handleClearMessages} disabled={messages.length === 0} className="p-2 text-slate-500 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-transparent" aria-label="Delete Current Session"><TrashIcon className="w-6 h-6" /></button>
              <button onClick={() => setIsHistoryOpen(true)} className="p-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-500/20 rounded-full transition-colors" aria-label="Chat History"><HistoryIcon className="w-6 h-6" /></button>
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-500/20 rounded-full transition-colors" aria-label="Settings"><SettingsIcon className="w-6 h-6" /></button>
            </div>
        </div>
        <div className="sm:hidden flex justify-center mt-4"><LanguageSelectorsComponent isMobile={true} /></div>
        <div className="md:hidden flex justify-center mt-4"><ModeSwitcher /></div>
      </header>
      
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {showText && messages.length > 0 ? (
          messages.map((msg) => <ChatBubble key={msg.id} message={msg} onReadAloud={handleReadAloud} ttsLoadingId={ttsLoadingId} currentlyPlayingId={currentlyPlayingId} />)
        ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400 px-4">
                <div className="relative mb-6">
                  <div className="absolute -inset-4 bg-gradient-to-br from-cyan-400 to-fuchsia-500 rounded-full opacity-20 blur-2xl"></div>
                  <MicrophoneIcon className="w-24 h-24 relative text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-fuchsia-500"/>
                </div>
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">{getStatusText()}</h2>
                {messages.length === 0 && !isSessionActive && !isTranslatingText && <p className="mt-2 text-base max-w-md">{mode === 'translator' ? 'Speak naturally and get instant translations. The conversation will appear here.' : 'Ask me anything or give me a command. Our conversation will appear here.'}</p>}
            </div>
        )}
        {isTranslatingText && <ChatBubble message={{id: 'thinking-bubble', author: MessageAuthor.ASSISTANT, text: '', isLoading: true}} />}
        <div ref={chatEndRef} />
      </main>

      <footer className="p-4 flex flex-col items-center justify-center border-t border-white/20 dark:border-slate-700/50 bg-white/10 dark:bg-slate-900/10 backdrop-blur-xl">
        {!isSessionActive && (
          <div className="w-full max-w-xl lg:max-w-3xl mb-4 relative flex items-center">
            <textarea ref={textareaRef} value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextTranslate(); } }} placeholder={mode === 'translator' ? `Type in ${language1.name} or ${language2.name}...` : `Type a message to Vaani in ${language2.name}...`} className="w-full p-4 pr-14 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition resize-none placeholder-slate-400 dark:placeholder-slate-500 shadow-lg backdrop-blur-sm" rows={1} />
            <button onClick={handleTextTranslate} disabled={!textInput.trim() || isTranslatingText} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-full text-white bg-gradient-to-br from-cyan-500 to-sky-600 hover:opacity-90 disabled:from-slate-400 disabled:to-slate-500 dark:disabled:from-slate-600 dark:disabled:to-slate-700 transition-all transform active:scale-90" aria-label="Send message">
              {isTranslatingText ? <SpinnerIcon className="w-5 h-5" /> : <SendIcon className="w-5 h-5" />}
            </button>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleMicClick}
            className={`${micButtonBaseClasses} ${micButtonColor}`}
            aria-label={isSessionActive ? "Stop session" : "Start session"}
          >
            <div className={`absolute inset-0 rounded-full bg-white/20 ${isSessionActive ? 'animate-[ping_1.5s_ease-out_infinite]' : 'animate-[pulse_2.5s_ease-in-out_infinite]'}`} style={{ animationDelay: isSessionActive ? '0s' : '0.5s' }}></div>
            <MicrophoneIcon className={`w-12 h-12 ${micIconColor} drop-shadow-lg`} />
          </button>
          {showText && <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 font-medium">{getStatusText()}</p>}
        </div>
      </footer>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        showText={showText}
        setShowText={setShowText}
        selectedVoice={selectedVoice}
        setSelectedVoice={setSelectedVoice}
        theme={theme}
        setTheme={setTheme}
      />
      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={chatHistory}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
        onClearAll={handleClearAllHistory}
      />
    </div>
  );
};

export default App;