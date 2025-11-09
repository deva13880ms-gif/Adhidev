import type { ChatSession } from '../types';

const HISTORY_STORAGE_KEY = 'vaani_chat_history';

/**
 * Loads the entire chat history from localStorage.
 * @returns An array of chat sessions, sorted by most recent first.
 */
export const loadChatHistory = (): ChatSession[] => {
  try {
    const historyJson = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!historyJson) return [];
    const sessions = JSON.parse(historyJson) as ChatSession[];
    // Sort by timestamp descending (newest first)
    return sessions.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Failed to load chat history:", error);
    return [];
  }
};

/**
 * Saves the entire chat history to localStorage.
 * @param sessions The array of chat sessions to save.
 */
const saveChatHistory = (sessions: ChatSession[]): void => {
  try {
    const historyJson = JSON.stringify(sessions);
    localStorage.setItem(HISTORY_STORAGE_KEY, historyJson);
  } catch (error) {
    console.error("Failed to save chat history:", error);
  }
};

/**
 * Adds or updates a single session in the history.
 * @param session The chat session to save or update.
 */
export const saveOrUpdateSession = (session: ChatSession): void => {
  const history = loadChatHistory();
  const existingIndex = history.findIndex(s => s.id === session.id);
  if (existingIndex > -1) {
    // Update existing session
    history[existingIndex] = session;
  } else {
    // Add new session
    history.push(session);
  }
  saveChatHistory(history);
};

/**
 * Deletes a single session from the history by its ID.
 * @param sessionId The ID of the session to delete.
 */
export const deleteSession = (sessionId: string): void => {
  let history = loadChatHistory();
  history = history.filter(s => s.id !== sessionId);
  saveChatHistory(history);
};


/**
 * Clears the entire chat history from localStorage.
 */
export const clearAllHistory = (): void => {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear chat history:", error);
  }
};
