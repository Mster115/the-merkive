"use client";

/**
 * Background Music (BGM) Manager.
 * Handles continuous ambient audio playback with playlist rotation, random initial track,
 * automatic track switching on finish, and browser autoplay policy unlock handling.
 */

export const DEFAULT_BGM_TRACKS = [
  "/audio/merkive-lobby-1.mp3",
  "/audio/merkive-lobby-2.mp3",
];

export class BgmEngine {
  private tracks: string[];
  private currentIndex: number = -1;
  private audioElement: HTMLAudioElement | null = null;
  private muted = true;
  private volume = 0.25;
  private unlocked = false;
  private pendingPlay = false;
  private listeners: Set<(muted: boolean) => void> = new Set();

  constructor(tracks: string[] = DEFAULT_BGM_TRACKS) {
    this.tracks = [...tracks];
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === "undefined" || typeof Audio === "undefined") return null;
    if (!this.audioElement) {
      try {
        this.audioElement = new Audio();
        this.audioElement.volume = this.volume;
        this.audioElement.preload = "auto";

        this.audioElement.addEventListener("ended", () => {
          this.nextTrack();
        });
      } catch {
        return null;
      }
    }
    return this.audioElement;
  }

  /** Pick a random initial track index from available tracks. */
  public selectInitialTrack(rng: () => number = Math.random): number {
    if (this.tracks.length === 0) return -1;
    return Math.floor(rng() * this.tracks.length);
  }

  /** Calculate next track index in playlist rotation. */
  public getNextTrackIndex(current: number): number {
    if (this.tracks.length === 0) return -1;
    if (current < 0 || current >= this.tracks.length) return 0;
    return (current + 1) % this.tracks.length;
  }

  public setPlaylist(tracks: string[]): void {
    const wasPlaying = !this.muted && this.audioElement && !this.audioElement.paused;
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.tracks = [...tracks];
    this.currentIndex = -1;
    if (wasPlaying && this.tracks.length > 0) {
      this.play();
    }
  }

  public getPlaylist(): string[] {
    return [...this.tracks];
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    this.notifyListeners();

    if (muted) {
      if (this.audioElement) {
        this.audioElement.pause();
      }
    } else {
      this.play();
    }
  }

  public toggleMute(): boolean {
    const next = !this.muted;
    this.setMuted(next);
    return next;
  }

  public subscribe(listener: (muted: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.muted);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  public play(): void {
    if (typeof window === "undefined" || this.tracks.length === 0) return;
    if (this.muted) return;

    const audio = this.ensureAudio();
    if (!audio) return;

    if (this.currentIndex === -1) {
      this.currentIndex = this.selectInitialTrack();
      const track = this.tracks[this.currentIndex];
      if (track) audio.src = track;
    }

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.unlocked = true;
          this.pendingPlay = false;
        })
        .catch(() => {
          // Playback blocked by browser autoplay policy until user gesture
          this.pendingPlay = true;
          this.setupUnlockOnUserGesture();
        });
    }
  }

  public pause(): void {
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  public nextTrack(): void {
    if (typeof window === "undefined" || this.tracks.length === 0) return;
    const audio = this.ensureAudio();
    if (!audio) return;

    if (this.currentIndex === -1) {
      this.currentIndex = this.selectInitialTrack();
    } else {
      this.currentIndex = this.getNextTrackIndex(this.currentIndex);
    }

    const track = this.tracks[this.currentIndex];
    if (track) audio.src = track;
    if (!this.muted) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          this.pendingPlay = true;
          this.setupUnlockOnUserGesture();
        });
      }
    }
  }

  public getCurrentTrack(): string | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.tracks.length) {
      return this.tracks[this.currentIndex] ?? null;
    }
    return null;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audioElement) {
      this.audioElement.volume = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public unlock(): void {
    if (this.unlocked && !this.pendingPlay) return;
    if (!this.muted) {
      this.play();
    }
  }

  private setupUnlockOnUserGesture(): void {
    if (typeof window === "undefined") return;
    const handleGesture = () => {
      window.removeEventListener("pointerdown", handleGesture);
      window.removeEventListener("keydown", handleGesture);
      window.removeEventListener("click", handleGesture);
      if (!this.muted) {
        this.play();
      }
    };
    window.addEventListener("pointerdown", handleGesture, { once: true, passive: true });
    window.addEventListener("keydown", handleGesture, { once: true });
    window.addEventListener("click", handleGesture, { once: true });
  }
}

export const bgm = new BgmEngine();

if (typeof window !== "undefined") {
  const unlock = () => bgm.unlock();
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
}
