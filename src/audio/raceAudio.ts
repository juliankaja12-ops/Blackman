import { ENGINE_ARCHITECTURES } from '../data/catalog';
import { EngineArchitecture } from '../types/game';

export class RaceAudioEngine {
  private ctx: AudioContext | null = null;
  private oscPrimary: OscillatorNode | null = null;
  private oscHarmonic: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private screechGain: GainNode | null = null;
  private screechFilter: BiquadFilterNode | null = null;
  private muted = false;
  private running = false;

  public start(arch: EngineArchitecture = 'V6_HYBRID') {
    if (this.running) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      const master = this.ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.22;
      master.connect(this.ctx.destination);

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 600;
      this.filter.Q.value = 2.4;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.08;
      this.filter.connect(this.engineGain);
      this.engineGain.connect(master);

      const spec = ENGINE_ARCHITECTURES[arch] ?? ENGINE_ARCHITECTURES.V6_HYBRID;
      const baseHz = spec.soundBaseHz;
      const isEv = spec.soundType === 'ev_whine';
      const isH2 = spec.soundType === 'h2_turbine';

      this.oscPrimary = this.ctx.createOscillator();
      this.oscPrimary.type = isEv ? 'sine' : isH2 ? 'triangle' : 'sawtooth';
      this.oscPrimary.frequency.value = baseHz;
      this.oscPrimary.connect(this.filter);

      this.oscHarmonic = this.ctx.createOscillator();
      this.oscHarmonic.type = isEv ? 'triangle' : 'sine';
      this.oscHarmonic.frequency.value = baseHz * (isEv ? 2.15 : 1.5);
      this.oscHarmonic.connect(this.filter);

      this.oscSub = this.ctx.createOscillator();
      this.oscSub.type = isEv ? 'sine' : 'sawtooth';
      this.oscSub.frequency.value = baseHz * (isEv ? 0.75 : 0.5);
      this.oscSub.connect(this.filter);

      // Tire screech white noise generator
      const bufferSize = this.ctx.sampleRate * 1.5;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      this.screechFilter = this.ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 1450;
      this.screechFilter.Q.value = 6;

      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0;
      whiteNoise.connect(this.screechFilter);
      this.screechFilter.connect(this.screechGain);
      this.screechGain.connect(master);

      this.oscPrimary.start();
      this.oscHarmonic.start();
      this.oscSub.start();
      whiteNoise.start();

      this.running = true;
    } catch {
      // Ignore if browser blocks audio before interaction
    }
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(mute ? 0 : 0.14, this.ctx.currentTime, 0.05);
    }
    if (this.screechGain && this.ctx && mute) {
      this.screechGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    }
  }

  public update(
    rpm: number,
    maxRpm: number,
    throttle: number,
    slipAmount: number,
    arch: EngineArchitecture,
    engineDamagePct: number,
    trackWetness = 0,
    speedMs = 0
  ) {
    if (!this.running || !this.ctx || this.muted) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    const now = this.ctx.currentTime;
    const spec = ENGINE_ARCHITECTURES[arch] ?? ENGINE_ARCHITECTURES.V6_HYBRID;
    const rpmRatio = Math.max(0.12, Math.min(1.08, rpm / Math.max(4000, maxRpm)));
    const isEv = spec.soundType === 'ev_whine';
    const isH2 = spec.soundType === 'h2_turbine';

    const jitter = engineDamagePct > 40 ? (Math.random() - 0.5) * (engineDamagePct * 0.28) : 0;
    const baseFreq = isEv
      ? spec.soundBaseHz * (0.45 + rpmRatio * 3.8 + Math.min(1.4, speedMs / 85)) + jitter
      : spec.soundBaseHz * (0.65 + rpmRatio * 2.55) + jitter;

    if (this.oscPrimary && this.oscHarmonic && this.oscSub) {
      const targetPrimaryType: OscillatorType = isEv ? 'sine' : isH2 ? 'triangle' : 'sawtooth';
      if (this.oscPrimary.type !== targetPrimaryType) this.oscPrimary.type = targetPrimaryType;
      const targetHarmonicType: OscillatorType = isEv ? 'triangle' : isH2 ? 'sine' : 'triangle';
      if (this.oscHarmonic.type !== targetHarmonicType) this.oscHarmonic.type = targetHarmonicType;

      this.oscPrimary.frequency.setTargetAtTime(baseFreq, now, 0.025);
      this.oscHarmonic.frequency.setTargetAtTime(
        baseFreq * (isEv ? 2.4 : arch === 'V10_NA' ? 2.0 : isH2 ? 1.8 : 1.5),
        now,
        0.025
      );
      this.oscSub.frequency.setTargetAtTime(baseFreq * (isEv ? 0.5 : 0.5), now, 0.025);
    }

    const cutoff = isEv ? 900 + rpmRatio * 2600 + throttle * 900 : 320 + rpmRatio * 1850 + throttle * 650;
    this.filter?.frequency.setTargetAtTime(cutoff, now, 0.03);
    const baseVol = isEv ? 0.03 + throttle * 0.095 + rpmRatio * 0.065 : 0.06 + throttle * 0.12 + rpmRatio * 0.05;
    this.engineGain?.gain.setTargetAtTime(baseVol, now, 0.04);

    const wetSprayFreq = trackWetness > 0.2 ? 950 : 1450;
    this.screechFilter?.frequency.setTargetAtTime(wetSprayFreq, now, 0.08);
    const wetHiss = trackWetness > 0.2 ? Math.min(0.09, trackWetness * (speedMs / 75) * 0.09) : 0;
    const screechVol = Math.max(wetHiss, Math.min(0.16, (slipAmount - 0.35) * 0.25));
    this.screechGain?.gain.setTargetAtTime(screechVol, now, 0.04);
  }

  public playImpact(severity: number) {
    if (!this.running || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.18);
    gain.gain.setValueAtTime(Math.min(0.35, 0.08 + severity * 0.28), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playFireExtinguish() {
    if (!this.running || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.45);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.45);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  public playSirenChirp() {
    if (!this.running || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.22);
    osc.frequency.linearRampToValueAtTime(660, now + 0.44);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.48);
  }

  public playPitWheelGun() {
    if (!this.running || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.14);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.18);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playPitComplete() {
    if (!this.running || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1174, now + 0.09);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  public playHeartbeatPain(intensity = 0.6) {
    if (!this.running || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const vol = Math.min(0.24, 0.08 + intensity * 0.16);
    for (const offset of [0, 0.19]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(62, now + offset);
      osc.frequency.exponentialRampToValueAtTime(34, now + offset + 0.14);
      gain.gain.setValueAtTime(vol * (offset === 0 ? 1 : 0.72), now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.17);
    }
  }

  public playMedicalTreat() {
    if (!this.running || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.setValueAtTime(988, now + 0.12);
    osc.frequency.setValueAtTime(1318, now + 0.24);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  public playMechanicWork() {
    if (!this.running || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    for (const offset of [0, 0.14]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280 + offset * 400, now + offset);
      osc.frequency.exponentialRampToValueAtTime(520, now + offset + 0.09);
      gain.gain.setValueAtTime(0.08, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.002, now + offset + 0.11);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.12);
    }
  }

  public playPaymentConfirm() {
    if (!this.running || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1046, now);
    osc.frequency.setValueAtTime(1568, now + 0.07);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  public stop() {
    if (!this.running) return;
    try {
      this.oscPrimary?.stop();
      this.oscHarmonic?.stop();
      this.oscSub?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
    this.running = false;
  }
}
