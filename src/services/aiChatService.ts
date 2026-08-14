// AI Chat Service - session history persisted to AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

export interface AiChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AiChatMessage[];
}

const STORAGE_KEY = '@barkadash_ai_chat_sessions';

const nowTime = () =>
  new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const makeId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const welcomeMessage = (): AiChatMessage => ({
  id: makeId(),
  sender: 'ai',
  text: "Mabuhay! I'm Navi, your barkada trip navigator. Ask me about spots, food, budgets, or how to plan your barkada trip.",
  time: nowTime(),
});

const respondTo = (prompt: string): string => {
  const p = prompt.toLowerCase();
  if (/(food|eat|dinner|lunch|restaurant|cafe|kainan)/.test(p)) {
    return "For a barkada meal, I'd suggest a shared-plate spot — try a local grill or a 'dampa' style seafood place where everyone can pick their own. For El Nido, beachside buffets near the cove are great for groups of 5+.";
  }
  if (/(beach|island|lagoon|tour|island hopping)/.test(p)) {
    return 'El Nido island hopping is the move! Tour A covers Big Lagoon, Secret Lagoon, and Shimizu Island — start early (before 8am) to beat the crowds. Budget around ₱1,200–₱2,000 per head including eco-tour fee.';
  }
  if (/(budget|money|cost|price|peso|₱|mahal|mura)/.test(p)) {
    return 'Here’s a rough barkada budget per head for a 3-day El Nido trip: island hopping ₱2,000, food ₱1,500, tricycle transfers ₱400, and lodging ₱3,000/night. Total ≈ ₱12,000. Split everything via the Expense Ledger to keep it transparent!';
  }
  if (/(plan|itinerary|day 1|schedule|what to do)/.test(p)) {
    return "Here's a quick 3-day flow: Day 1 – Town + Nacpan Beach sunset. Day 2 – Island Hopping Tour A. Day 3 – Las Cabanas cliff jump + lazy beach day. Want me to break a specific day into a timeline?";
  }
  if (/(hello|hi|hey|kamusta|mabuhay)/.test(p)) {
    return "Kumusta! Ready to plan something fun? Ask me about spots, food, or budgets — or tap a quick prompt below.";
  }
  if (/(thank|salamat|thanks)/.test(p)) {
    return "Walang anuman! Say the word when you need more trip ideas. 🏝️";
  }
  return "Great question! For your barkada, I'd consider the vibe you're after — chill vs. adventure. Tell me a bit more (budget, number of people, or a specific spot) and I'll tailor a plan for you.";
};

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

  async sendMessage(text: string): Promise<void> {
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

    setTimeout(async () => {
      const current = this.getCurrentSession();
      if (current && current.id === session.id) {
        current.messages.push({
          id: makeId(),
          sender: 'ai',
          text: respondTo(trimmed),
          time: nowTime(),
        });
        current.updatedAt = Date.now();
        this.notify();
        await this.persist();
      }
    }, 800);
  }

  private async persist() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.sessions));
    } catch (e) {
      console.warn('AiChatService persist error:', e);
    }
  }
}
