// AI Chat Service - session history persisted to AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateReply, ChatToolResult } from './geminiService';

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  tools?: ChatToolResult[];
}

export interface AiChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AiChatMessage[];
}

export interface TripContextParam {
  title?: string;
  destination?: string;
  dateRange?: string;
}

const STORAGE_KEY = '@barkadash_ai_chat_sessions';

const nowTime = () =>
  new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const makeId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const welcomeMessage = (): AiChatMessage => ({
  id: makeId(),
  sender: 'ai',
  text: "Mabuhay! I'm Navi, your barkada trip navigator. Ask me about spots, food, weather, or how to plan your barkada trip.",
  time: nowTime(),
});

export class AiChatService {
  private static instance: AiChatService;
  private sessions: AiChatSession[] = [];
  private currentSessionId: string | null = null;
  private listeners = new Set<() => void>();

  static getInstance(): AiChatService {
    if (!AiChatService.instance) {
      AiChatService.instance = new AiChatService();
    }
    return AiChatService.instance;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  async load() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.sessions = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('AiChatService load error:', e);
    }
    if (this.sessions.length === 0) {
      const first = this.createSessionInternal();
      this.sessions.push(first);
      this.currentSessionId = first.id;
    } else if (!this.currentSessionId) {
      this.currentSessionId = this.sessions[0].id;
    }
    this.notify();
  }

  getSessions(): AiChatSession[] {
    return [...this.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getCurrentSession(): AiChatSession | null {
    return this.sessions.find((s) => s.id === this.currentSessionId) || null;
  }

  setCurrentSession(id: string) {
    if (this.sessions.some((s) => s.id === id)) {
      this.currentSessionId = id;
      this.notify();
    }
  }

  async newChat(): Promise<string> {
    const session = this.createSessionInternal();
    this.sessions.unshift(session);
    this.currentSessionId = session.id;
    await this.persist();
    this.notify();
    return session.id;
  }

  private createSessionInternal(): AiChatSession {
    const now = Date.now();
    return {
      id: makeId(),
      title: 'New Chat',
      createdAt: now,
      updatedAt: now,
      messages: [welcomeMessage()],
    };
  }

  async deleteSession(id: string) {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    if (this.currentSessionId === id) {
      this.currentSessionId = this.sessions.length > 0 ? this.sessions[0].id : null;
    }
    await this.persist();
    this.notify();
  }

  async sendMessage(text: string, trip?: TripContextParam | null): Promise<void> {
    const session = this.getCurrentSession();
    if (!session) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    session.messages.push({
      id: makeId(),
      sender: 'user',
      text: trimmed,
      time: nowTime(),
    });

    const firstUser = session.messages.find((m) => m.sender === 'user');
    if (session.title === 'New Chat' && firstUser) {
      session.title = trimmed.length > 28 ? `${trimmed.slice(0, 28)}…` : trimmed;
    }
    session.updatedAt = Date.now();
    this.notify();
    await this.persist();

    const reply = await generateReply(
      session.messages.map(({ sender, text: msgText }) => ({ sender, text: msgText })),
      trip ?? undefined
    );

    const current = this.getCurrentSession();
    if (current && current.id === session.id) {
      current.messages.push({
        id: makeId(),
        sender: 'ai',
        text: reply.text,
        tools: reply.tools.length > 0 ? reply.tools : undefined,
        time: nowTime(),
      });
      current.updatedAt = Date.now();
      this.notify();
      await this.persist();
    }
  }

  private async persist() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.sessions));
    } catch (e) {
      console.warn('AiChatService persist error:', e);
    }
  }
}
