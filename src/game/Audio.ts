// Web Audio 합성 효과음 (외부 파일 없음)
export type Sfx = 'pop' | 'throw' | 'boom' | 'freeze' | 'shot' | 'zap' | 'coin' | 'leak' | 'place' | 'upgrade' | 'wave' | 'win' | 'lose' | 'click' | 'boss';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<Sfx, number>();
  muted = false;

  unlock(): void {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.5;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hiss(dur: number, vol: number, freq: number, type: BiquadFilterType = 'lowpass', delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur);
  }

  play(s: Sfx, pitch = 1): void {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    const minGap = s === 'pop' ? 28 : s === 'throw' || s === 'shot' ? 45 : 60;
    if (now - (this.last.get(s) ?? 0) < minGap) return;
    this.last.set(s, now);
    switch (s) {
      case 'pop': this.tone(520 * pitch, 0.09, 'sine', 0.22, 180 * pitch); break;
      case 'throw': this.hiss(0.08, 0.08, 2400, 'bandpass'); break;
      case 'boom': this.hiss(0.45, 0.5, 600); this.tone(90, 0.35, 'sine', 0.4, 40); break;
      case 'freeze': this.tone(1800, 0.3, 'triangle', 0.08, 2600); this.hiss(0.3, 0.08, 5000, 'highpass'); break;
      case 'shot': this.hiss(0.12, 0.3, 1800); this.tone(200, 0.1, 'square', 0.08, 80); break;
      case 'zap': this.tone(900, 0.12, 'sawtooth', 0.08, 300); break;
      case 'coin': this.tone(990, 0.08, 'square', 0.08); this.tone(1320, 0.14, 'square', 0.08, undefined, 0.07); break;
      case 'leak': this.tone(160, 0.3, 'sawtooth', 0.15, 70); break;
      case 'place': this.tone(330, 0.08, 'triangle', 0.2); this.tone(495, 0.12, 'triangle', 0.18, undefined, 0.06); break;
      case 'upgrade': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.15, undefined, i * 0.06)); break;
      case 'wave': this.tone(440, 0.15, 'triangle', 0.15); this.tone(660, 0.2, 'triangle', 0.15, undefined, 0.12); break;
      case 'boss': this.tone(110, 0.8, 'sawtooth', 0.18, 70); this.tone(165, 0.8, 'sawtooth', 0.1, 100); break;
      case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.18, undefined, i * 0.11)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.12, undefined, i * 0.18)); break;
      case 'click': this.tone(700, 0.04, 'square', 0.06); break;
    }
  }
}
