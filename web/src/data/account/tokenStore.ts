import { KeyStoreUnavailable, type KeyStore, type StoredSession } from "./keyStore";

/**
 * The signed-in session. The token is held in memory and written to IndexedDB (so a reload stays
 * signed in), sent as a Bearer header, and cleared on a 401. It is never put in localStorage or a URL.
 */
export class TokenStore {
  private session: StoredSession | null = null;
  private listeners = new Set<() => void>();
  private generation = 0;

  constructor(private readonly keys: KeyStore) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSession = (): StoredSession | null => this.session;
  /** Changes whenever this tab's identity is set or cleared, including a cross-tab sign-out. */
  getGeneration = (): number => this.generation;

  /** The token to send, if any. */
  token = (): string | null => this.session?.token ?? null;

  /** Reads the saved session on start-up. A session past its expiry is dropped. */
  async load(now = Date.now()): Promise<StoredSession | null> {
    const generation = this.generation;
    let saved: StoredSession | null;
    try {
      saved = await this.keys.loadSession();
    } catch (error) {
      if (generation !== this.generation) return this.session;
      if (error instanceof KeyStoreUnavailable) throw error;
      saved = null;
    }
    // A sign-out or successful sign-in while storage was reading owns the newer identity.
    if (generation !== this.generation) return this.session;
    if (saved && new Date(saved.expiresAt).getTime() <= now) {
      const clearingGeneration = this.generation + 1;
      await this.clear();
      if (clearingGeneration !== this.generation) return this.session;
      saved = null;
    }
    this.session = saved;
    this.emit();
    return saved;
  }

  async set(session: StoredSession): Promise<void> {
    this.generation += 1;
    this.session = session;
    this.emit();
    try {
      await this.keys.saveSession(session);
    } catch {
      // Still signed in for this visit; a reload will ask again.
    }
  }

  async update(patch: Partial<StoredSession>): Promise<void> {
    if (this.session) await this.set({ ...this.session, ...patch });
  }

  async clear(): Promise<void> {
    this.generation += 1;
    this.session = null;
    this.emit();
    try {
      await this.keys.clearSession();
    } catch {
      // Nothing else to do: memory is already clear.
    }
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
