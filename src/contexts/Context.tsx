import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ContextType {
  email: string;
  setEmail: (email: string) => void;
  hasEmail: boolean;
  setHasEmail: (hasEmail: boolean) => void;
  question: string;
  setQuestion: (question: string) => void;
  hasQuestion: boolean;
  setHasQuestion: (hasQuestion: boolean) => void;
  listTrigger: number;
  setListTrigger: (fn: (prev: number) => number) => void;
  hasRepository: boolean;
  setHasRepository: (hasRepository: boolean) => void;
  isGitAvailable: boolean;
  isGpgAvailable: boolean;
  isInitializing: boolean;
}

const Context = createContext<ContextType | undefined>(undefined);

export const useCtx = () => {
  const context = useContext(Context);
  if (!context) {
    throw new Error('Failed to use context, please check if ContextProvider is used');
  }
  return context;
};

export const maskEmail = (email: string): string => {
  if (!email || !email.includes('@')) return email;
  const [localPart, domain] = email.split('@');
  if (localPart.length <= 3) {
    return `${localPart[0]}***@${domain}`;
  }
  const maskedLocal = `${localPart.slice(0, 2)}***${localPart.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
};

interface ContextProviderProps {
  children: ReactNode;
}

export const ContextProvider: React.FC<ContextProviderProps> = ({ children }) => {
  const [email, setEmail] = useState('');
  const [hasEmail, setHasEmail] = useState(false);
  const [question, setQuestion] = useState('');
  const [hasQuestion, setHasQuestion] = useState(false);
  const [hasRepository, setHasRepository] = useState(false);
  const [listTrigger, setListTrigger] = useState(0);
  const [isGitAvailable, setIsGitAvailable] = useState(false);
  const [isGpgAvailable, setIsGpgAvailable] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const loadCtx = async () => {
    setIsInitializing(true);
    const results = await Promise.allSettled([
      invoke<string>('get_gpg_email'),
      invoke<string>('get_security_question'),
      invoke<boolean>('is_git_available'),
      invoke<boolean>('is_gpg_available'),
      invoke<boolean>('git_repository_exists'),
    ]);
    if (results[0].status === 'fulfilled') {
      setEmail(maskEmail(results[0].value));
      setHasEmail(true);
    }
    if (results[1].status === 'fulfilled') {
      setQuestion(results[1].value);
      setHasQuestion(true);
    }
    if (results[2].status === 'fulfilled') setIsGitAvailable(results[2].value);
    if (results[3].status === 'fulfilled') setIsGpgAvailable(results[3].value);
    if (results[4].status === 'fulfilled') setHasRepository(results[4].value);
    setIsInitializing(false);
  };

  useEffect(() => {
    loadCtx();
  }, []);

  const value = {
    email,
    setEmail,
    hasEmail,
    setHasEmail,
    question,
    setQuestion,
    hasQuestion,
    setHasQuestion,
    listTrigger,
    setListTrigger,
    isGitAvailable,
    isGpgAvailable,
    hasRepository,
    setHasRepository,
    isInitializing,
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
};
