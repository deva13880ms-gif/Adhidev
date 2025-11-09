import { useState, useRef, useCallback, useEffect } from 'react';
// FIX: Removed 'LiveSession' as it is not an exported member of '@google/genai'.
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { createBlob, decode, decodeAudioData } from '../utils/audio';
import type { ChatMessage, Voice } from '../types';
import { MessageAuthor } from '../types';
import { SUPPORTED_LANGUAGES } from '../constants';

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

export enum ConnectionState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
}

export const useGeminiLive = (systemInstruction: string, voice: Voice) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.IDLE);
  const [transcripts, setTranscripts] = useState<ChatMessage[]>([]);
  const [detectedLanguageCode, setDetectedLanguageCode] = useState<string | null>(null);
  
  // FIX: Replaced 'Promise<LiveSession>' with 'Promise<any>' as 'LiveSession' is not an exported type.
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const userTranscriptRef = useRef('');
  const assistantTranscriptRef = useRef('');
  const currentMessageIdsRef = useRef<{ user: string | null; assistant: string | null }>({ user: null, assistant: null });


  const stopAudioProcessing = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close();
    }
    // Stop any pending audio playback
    if (outputAudioContextRef.current){
        outputSourcesRef.current.forEach(source => source.stop());
        outputSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (!sessionPromiseRef.current) return;
    try {
      const session = await sessionPromiseRef.current;
      session.close();
    } catch (error) {
      console.error("Error closing session:", error);
    } finally {
      stopAudioProcessing();
      sessionPromiseRef.current = null;
      setConnectionState(ConnectionState.DISCONNECTED);
    }
  }, [stopAudioProcessing]);

  const connect = useCallback(async () => {
    setConnectionState(ConnectionState.CONNECTING);
    setTranscripts([]);
    setDetectedLanguageCode(null);
    userTranscriptRef.current = '';
    assistantTranscriptRef.current = '';
    currentMessageIdsRef.current = { user: null, assistant: null };

    try {
      if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') {
        // FIX: Cast window to any to access webkitAudioContext for Safari compatibility.
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
      }

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.geminiVoice } },
          },
          systemInstruction,
        },
        callbacks: {
          onopen: async () => {
            setConnectionState(ConnectionState.CONNECTED);
            // FIX: Cast window to any to access webkitAudioContext for Safari compatibility.
            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
            scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };
            source.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            let userUpdated = false;
            let assistantUpdated = false;

            if (message.serverContent?.inputTranscription) {
              userTranscriptRef.current += message.serverContent.inputTranscription.text;
              userUpdated = true;
            }
            if (message.serverContent?.outputTranscription) {
              assistantTranscriptRef.current += message.serverContent.outputTranscription.text;
              assistantUpdated = true;
            }

            if (userUpdated) {
              const text = userTranscriptRef.current.trim();
              if (text) {
                if (currentMessageIdsRef.current.user) {
                  setTranscripts(prev => prev.map(m => m.id === currentMessageIdsRef.current.user ? { ...m, text } : m));
                } else {
                  const newId = crypto.randomUUID();
                  currentMessageIdsRef.current.user = newId;
                  setTranscripts(prev => [...prev, { id: newId, author: MessageAuthor.USER, text: text }]);
                }
              }
            }
            
            if (assistantUpdated) {
              const text = assistantTranscriptRef.current.trim();
              if (text) {
                if (currentMessageIdsRef.current.assistant) {
                  setTranscripts(prev => prev.map(m => m.id === currentMessageIdsRef.current.assistant ? { ...m, text } : m));
                } else {
                  const newId = crypto.randomUUID();
                  currentMessageIdsRef.current.assistant = newId;
                  setTranscripts(prev => [...prev, { id: newId, author: MessageAuthor.ASSISTANT, text: text }]);
                }
              }
            }

            if (message.serverContent?.turnComplete) {
                // FIX: Removed language detection logic as 'languageCode' property does not exist on the 'Transcription' type.
                // The auto-detection feature is disabled as it is not supported by the current API.
                userTranscriptRef.current = '';
                assistantTranscriptRef.current = '';
                currentMessageIdsRef.current = { user: null, assistant: null };
            }

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
              const audioContext = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContext.currentTime);
              const audioBuffer = await decodeAudioData(decode(audioData), audioContext, OUTPUT_SAMPLE_RATE, 1);
              const source = audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContext.destination);
              source.addEventListener('ended', () => {
                outputSourcesRef.current.delete(source);
              });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              outputSourcesRef.current.add(source);
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            setConnectionState(ConnectionState.ERROR);
            disconnect();
          },
          onclose: () => {
            stopAudioProcessing();
            setConnectionState(ConnectionState.DISCONNECTED);
          },
        },
      });

      await sessionPromiseRef.current;
    } catch (error) {
      console.error("Connection failed:", error);
      setConnectionState(ConnectionState.ERROR);
      stopAudioProcessing();
    }
  }, [systemInstruction, voice, disconnect, stopAudioProcessing]);

  useEffect(() => {
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { connect, disconnect, connectionState, transcripts, detectedLanguageCode };
};
