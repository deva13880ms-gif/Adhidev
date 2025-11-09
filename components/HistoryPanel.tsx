import React from 'react';
import { CloseIcon, TrashIcon } from './icons';
import type { ChatSession } from '../types';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: ChatSession[];
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId:string) => void;
  onClearAll: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  history,
  onLoadSession,
  onDeleteSession,
  onClearAll,
}) => {
  if (!isOpen) return null;

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent onLoadSession from firing
    if (window.confirm("Are you sure you want to delete this session?")) {
      onDeleteSession(sessionId);
    }
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to delete ALL chat history? This cannot be undone.")) {
      onClearAll();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/60 z-40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="fixed top-0 left-0 h-full w-96 max-w-[90vw] bg-white/80 dark:bg-slate-800/80 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col backdrop-blur-2xl border-r border-white/20 dark:border-slate-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">History</h2>
          <button onClick={onClose} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-500/20 rounded-full transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {history.length > 0 ? (
            <div className="p-4 space-y-3">
              {history.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onLoadSession(session.id)}
                  className="w-full text-left p-4 rounded-xl bg-white dark:bg-slate-700/60 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/50 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 overflow-hidden">
                      <p className="font-semibold text-cyan-600 dark:text-cyan-400 capitalize">{session.mode} Session</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{new Date(session.timestamp).toLocaleString()}</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 italic truncate pr-2">
                        {session.messages[0]?.text || "Empty session"}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, session.id)}
                      className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      aria-label="Delete session"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center text-slate-400 dark:text-slate-500 p-6">
              <p>No chat history found.</p>
            </div>
          )}
        </div>
        
        {history.length > 0 && (
          <div className="p-6 border-t border-slate-200 dark:border-slate-700/50 flex-shrink-0">
            <button
              onClick={handleClearAll}
              className="w-full p-3 bg-red-600/90 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors shadow-lg hover:shadow-red-500/30"
            >
              Clear All History
            </button>
          </div>
        )}
      </div>
    </div>
  );
};