"use client";

/**
 * Asset-free WebAudio sound kit. Everything is synthesized — no files, no
 * network. Muted until `setMuted(false)`; browsers require a user gesture
 * before audio can start, so `unlock()` is wired to the first pointer event.
 */
export type SfxName = "click" | "pop" | "whoosh" | "zap" | "win" | "tick" | "error" | "deal";

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = true;
  private unlocked = false;

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  unlock(): void {
    if (this.unlocked) return;
    const ctx = this.ensure();
    if (!ctx) return;
    void ctx.resume().catch(() => undefined);
    this.unlocked = true;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!muted) this.unlock();
  }

  isMuted(): boolean {
    return this.muted;
  }

  private tone(
    freq: number,
    opts: {
      type?: OscillatorType;
      at?: number;
      duration?: number;
      gain?: number;
      glideTo?: number;
    } = {}
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const { type = "sine", at = 0, duration = 0.12, gain = 0.22, glideTo } = opts;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + duration);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private noise(opts: { at?: number; duration?: number; gain?: number; from?: number; to?: number } = {}): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const { at = 0, duration = 0.25, gain = 0.18, from = 400, to = 4000 } = opts;
    const t0 = ctx.currentTime + at;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + duration);
    filter.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.05);
  }

  play(name: SfxName): void {
    if (this.muted) return;
    try {
      switch (name) {
        case "click":
          this.tone(720, { type: "square", duration: 0.06, gain: 0.12 });
          break;
        case "pop":
          this.tone(330, { type: "sine", duration: 0.14, gain: 0.28, glideTo: 660 });
          break;
        case "whoosh":
          this.noise({ duration: 0.3, from: 300, to: 2600, gain: 0.14 });
          break;
        case "deal":
          this.noise({ duration: 0.12, from: 1200, to: 3600, gain: 0.1 });
          this.tone(520, { type: "triangle", duration: 0.07, gain: 0.1, at: 0.02 });
          break;
        case "zap":
          this.tone(1500, { type: "sawtooth", duration: 0.28, gain: 0.24, glideTo: 90 });
          this.noise({ duration: 0.2, from: 5000, to: 500, gain: 0.14 });
          break;
        case "tick":
          this.tone(1100, { type: "square", duration: 0.035, gain: 0.08 });
          break;
        case "error":
          this.tone(220, { type: "square", duration: 0.16, gain: 0.16, glideTo: 140 });
          break;
        case "win":
          [523, 659, 784, 1047].forEach((f, i) =>
            this.tone(f, { type: "triangle", at: i * 0.11, duration: 0.24, gain: 0.22 })
          );
          this.tone(1319, { type: "triangle", at: 0.44, duration: 0.5, gain: 0.2 });
          this.noise({ at: 0.44, duration: 0.5, from: 800, to: 6000, gain: 0.07 });
          break;
      }
    } catch {
      // audio is never allowed to break the game
    }
  }
}

export const sfx = new SfxEngine();

if (typeof window !== "undefined") {
  const unlock = () => sfx.unlock();
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
}
