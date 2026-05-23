/* ===================================================
   ANTIGRAVITY MICROBE NINJA - AUDIO ENGINE
   Procedural Sound Synthesis via Web Audio API
   Semua suara dihasilkan secara sintetis (tanpa file audio)
   =================================================== */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.isInitialized = false;
        this.isMusicPlaying = false;
        this.musicNodes = [];

        // Volume default
        this.masterVolume = 0.7;
        this.musicVolume = 0.35;
        this.sfxVolume = 0.6;
    }

    /**
     * Inisialisasi AudioContext — HARUS dipanggil dari event user (click/touch)
     * karena browser memblokir autoplay audio.
     */
    init() {
        if (this.isInitialized) return;

        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            // Routing: SFX/Music → Master → Destination
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.masterVolume;
            this.masterGain.connect(this.ctx.destination);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = this.musicVolume;
            this.musicGain.connect(this.masterGain);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = this.sfxVolume;
            this.sfxGain.connect(this.masterGain);

            this.isInitialized = true;
        } catch (e) {
            console.warn('Web Audio API tidak tersedia:', e);
        }
    }

    /**
     * Resume AudioContext jika dalam keadaan suspended (kebijakan autoplay browser)
     */
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // ============================================================
    //  UTILITAS GENERATOR SUARA
    // ============================================================

    /**
     * Membuat buffer noise putih (white noise) untuk efek perkusi/desisan
     */
    createNoiseBuffer(duration = 1) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    /**
     * Membuat konvolusi reverb sederhana dari impulse sintetis
     */
    createReverbImpulse(duration = 1.5, decay = 3) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.ctx.createBuffer(2, length, sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        return buffer;
    }

    /**
     * Utilitas: mainkan nada pendek dengan envelope ADSR sederhana
     */
    playTone(freq, type = 'sine', duration = 0.3, volume = 0.3, delay = 0, destination = null) {
        if (!this.isInitialized) return;
        const t = this.ctx.currentTime + delay;
        const dest = destination || this.sfxGain;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);

        // Envelope: Attack → Sustain → Release
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume, t + 0.01);
        gain.gain.setValueAtTime(volume, t + duration * 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(t);
        osc.stop(t + duration + 0.05);
    }

    // ============================================================
    //  BACKGROUND MUSIC — Dark Ambient Synth Loop
    // ============================================================

    startMusic() {
        if (!this.isInitialized || this.isMusicPlaying) return;
        this.isMusicPlaying = true;
        this._playMusicLoop();
    }

    _playMusicLoop() {
        if (!this.isMusicPlaying || !this.isInitialized) return;

        const t = this.ctx.currentTime;

        // ---- Layer 1: Deep Sub Bass Drone (kunci C minor gelap) ----
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        const bassFilter = this.ctx.createBiquadFilter();

        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(55, t); // A1
        bassOsc.frequency.setValueAtTime(55, t + 4);
        bassOsc.frequency.linearRampToValueAtTime(51.91, t + 5); // Ab1
        bassOsc.frequency.setValueAtTime(51.91, t + 8);
        bassOsc.frequency.linearRampToValueAtTime(49, t + 9); // G1
        bassOsc.frequency.setValueAtTime(49, t + 12);
        bassOsc.frequency.linearRampToValueAtTime(55, t + 13);

        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(120, t);
        bassFilter.frequency.linearRampToValueAtTime(200, t + 8);
        bassFilter.frequency.linearRampToValueAtTime(120, t + 16);
        bassFilter.Q.value = 5;

        bassGain.gain.setValueAtTime(0, t);
        bassGain.gain.linearRampToValueAtTime(0.35, t + 2);
        bassGain.gain.setValueAtTime(0.35, t + 14);
        bassGain.gain.linearRampToValueAtTime(0, t + 16);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.musicGain);

        bassOsc.start(t);
        bassOsc.stop(t + 16.5);

        // ---- Layer 2: Eerie Pad (Sustained Chord) ----
        const padNotes = [130.81, 155.56, 196.00]; // C3, Eb3, G3 (Cm chord)
        padNotes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            // Slow detune untuk efek organik
            osc.detune.setValueAtTime(0, t);
            osc.detune.linearRampToValueAtTime(8 * (idx + 1), t + 8);
            osc.detune.linearRampToValueAtTime(-5 * (idx + 1), t + 16);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400 + idx * 100, t);
            filter.frequency.linearRampToValueAtTime(800 + idx * 150, t + 8);
            filter.frequency.linearRampToValueAtTime(400 + idx * 100, t + 16);

            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.08, t + 3);
            gain.gain.setValueAtTime(0.08, t + 13);
            gain.gain.linearRampToValueAtTime(0, t + 16);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);

            osc.start(t);
            osc.stop(t + 16.5);
            this.musicNodes.push(osc);
        });

        // ---- Layer 3: Pulsing Heartbeat Sub ----
        const pulseInterval = 1.2; // detik per detak
        for (let i = 0; i < 13; i++) {
            const pt = t + i * pulseInterval + 0.5;
            const pulseOsc = this.ctx.createOscillator();
            const pulseGain = this.ctx.createGain();

            pulseOsc.type = 'sine';
            pulseOsc.frequency.setValueAtTime(40, pt);
            pulseOsc.frequency.exponentialRampToValueAtTime(30, pt + 0.3);

            pulseGain.gain.setValueAtTime(0, pt);
            pulseGain.gain.linearRampToValueAtTime(0.15, pt + 0.02);
            pulseGain.gain.exponentialRampToValueAtTime(0.001, pt + 0.5);

            pulseOsc.connect(pulseGain);
            pulseGain.connect(this.musicGain);

            pulseOsc.start(pt);
            pulseOsc.stop(pt + 0.6);
        }

        // ---- Layer 4: High Shimmer / Sci-fi Sparkle ----
        const shimmerNotes = [1046.5, 1318.5, 1568.0, 1760.0]; // C6, E6, G6, A6
        for (let i = 0; i < 6; i++) {
            const st = t + 2 + i * 2.4;
            const freq = shimmerNotes[Math.floor(Math.random() * shimmerNotes.length)];
            const shimOsc = this.ctx.createOscillator();
            const shimGain = this.ctx.createGain();

            shimOsc.type = 'sine';
            shimOsc.frequency.setValueAtTime(freq, st);
            shimOsc.frequency.linearRampToValueAtTime(freq * 1.01, st + 1);

            shimGain.gain.setValueAtTime(0, st);
            shimGain.gain.linearRampToValueAtTime(0.03, st + 0.1);
            shimGain.gain.exponentialRampToValueAtTime(0.001, st + 1.8);

            shimOsc.connect(shimGain);
            shimGain.connect(this.musicGain);

            shimOsc.start(st);
            shimOsc.stop(st + 2);
        }

        this.musicNodes.push(bassOsc);

        // Loop setiap 16 detik
        this._musicTimeout = setTimeout(() => {
            this._playMusicLoop();
        }, 15800);
    }

    stopMusic() {
        this.isMusicPlaying = false;
        if (this._musicTimeout) {
            clearTimeout(this._musicTimeout);
            this._musicTimeout = null;
        }
        // Fade out music gain
        if (this.musicGain && this.isInitialized) {
            const t = this.ctx.currentTime;
            this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
            this.musicGain.gain.linearRampToValueAtTime(0, t + 1);
            setTimeout(() => {
                this.musicGain.gain.value = this.musicVolume;
                this.musicNodes.forEach(n => {
                    try { n.stop(); } catch (e) { /* already stopped */ }
                });
                this.musicNodes = [];
            }, 1200);
        }
    }

    /**
     * Mengatur volume musik latar (0.0 - 1.0) secara dinamis
     */
    setMusicVolume(val) {
        this.musicVolume = val;
        if (this.isInitialized && this.musicGain) {
            const t = this.ctx.currentTime;
            this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, t);
            this.musicGain.gain.linearRampToValueAtTime(val, t + 0.05);
        }
    }

    /**
     * Mengatur volume efek suara (0.0 - 1.0) secara dinamis
     */
    setSfxVolume(val) {
        this.sfxVolume = val;
        if (this.isInitialized && this.sfxGain) {
            const t = this.ctx.currentTime;
            this.sfxGain.gain.setValueAtTime(this.sfxGain.gain.value, t);
            this.sfxGain.gain.linearRampToValueAtTime(val, t + 0.05);
        }
    }

    // ============================================================
    //  SOUND EFFECTS
    // ============================================================

    /**
     * SFX: Tebasan Benar — Bio-splat memuaskan + nada sukses pendek
     * @param {string} side - 'left' atau 'right' untuk variasi pitch
     */
    playSliceCorrect(side = 'left') {
        if (!this.isInitialized) return;
        const t = this.ctx.currentTime;
        const baseFreq = side === 'left' ? 880 : 740;

        // -- Komponen 1: Swoosh noise (desisan cepat) --
        const noiseBuffer = this.createNoiseBuffer(0.15);
        const noiseSrc = this.ctx.createBufferSource();
        const noiseGain = this.ctx.createGain();
        const noiseFilter = this.ctx.createBiquadFilter();

        noiseSrc.buffer = noiseBuffer;
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(3000, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(800, t + 0.12);
        noiseFilter.Q.value = 1.5;

        noiseGain.gain.setValueAtTime(0.4, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        noiseSrc.start(t);
        noiseSrc.stop(t + 0.2);

        // -- Komponen 2: Wet Splat (low freq thump) --
        const splatOsc = this.ctx.createOscillator();
        const splatGain = this.ctx.createGain();

        splatOsc.type = 'sine';
        splatOsc.frequency.setValueAtTime(200, t);
        splatOsc.frequency.exponentialRampToValueAtTime(60, t + 0.15);

        splatGain.gain.setValueAtTime(0.35, t);
        splatGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        splatOsc.connect(splatGain);
        splatGain.connect(this.sfxGain);

        splatOsc.start(t);
        splatOsc.stop(t + 0.25);

        // -- Komponen 3: Nada sukses pendek (chime) --
        this.playTone(baseFreq, 'sine', 0.15, 0.2, 0.02);
        this.playTone(baseFreq * 1.5, 'sine', 0.12, 0.12, 0.06);
    }

    /**
     * SFX: Tebasan Salah / Bom — Alarm buzz distorsi gelap
     */
    playSliceBomb() {
        if (!this.isInitialized) return;
        const t = this.ctx.currentTime;

        // -- Komponen 1: Buzz rendah kasar --
        const buzzOsc = this.ctx.createOscillator();
        const buzzGain = this.ctx.createGain();
        const distortion = this.ctx.createWaveShaper();

        buzzOsc.type = 'sawtooth';
        buzzOsc.frequency.setValueAtTime(90, t);
        buzzOsc.frequency.linearRampToValueAtTime(60, t + 0.5);

        // Waveshaper distortion curve
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i / 128) - 1;
            curve[i] = (Math.PI + 50) * x / (Math.PI + 50 * Math.abs(x));
        }
        distortion.curve = curve;
        distortion.oversample = '2x';

        buzzGain.gain.setValueAtTime(0.3, t);
        buzzGain.gain.linearRampToValueAtTime(0.25, t + 0.2);
        buzzGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

        buzzOsc.connect(distortion);
        distortion.connect(buzzGain);
        buzzGain.connect(this.sfxGain);

        buzzOsc.start(t);
        buzzOsc.stop(t + 0.65);

        // -- Komponen 2: Alarm cepat (beep-beep tinggi) --
        for (let i = 0; i < 3; i++) {
            this.playTone(440, 'square', 0.08, 0.18, i * 0.12);
        }

        // -- Komponen 3: Impact noise --
        const noiseBuffer = this.createNoiseBuffer(0.3);
        const noiseSrc = this.ctx.createBufferSource();
        const noiseGain = this.ctx.createGain();
        const noiseFilter = this.ctx.createBiquadFilter();

        noiseSrc.buffer = noiseBuffer;
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1200, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(200, t + 0.3);

        noiseGain.gain.setValueAtTime(0.35, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        noiseSrc.start(t);
        noiseSrc.stop(t + 0.4);
    }

    /**
     * SFX: Level Up — Ascending arpeggio neon futuristik
     */
    playLevelUp() {
        if (!this.isInitialized) return;

        // Arpeggio Cm naik: C4, Eb4, G4, C5, Eb5
        const notes = [261.63, 311.13, 392.00, 523.25, 622.25];
        notes.forEach((freq, i) => {
            this.playTone(freq, 'sine', 0.25, 0.2, i * 0.08);
            this.playTone(freq * 2, 'sine', 0.18, 0.07, i * 0.08 + 0.02);
        });

        // Shimmer tail
        const t = this.ctx.currentTime + 0.5;
        const shimOsc = this.ctx.createOscillator();
        const shimGain = this.ctx.createGain();

        shimOsc.type = 'sine';
        shimOsc.frequency.setValueAtTime(1244.5, t); // Eb6
        shimOsc.frequency.linearRampToValueAtTime(1318.5, t + 0.8);

        shimGain.gain.setValueAtTime(0.08, t);
        shimGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);

        shimOsc.connect(shimGain);
        shimGain.connect(this.sfxGain);

        shimOsc.start(t);
        shimOsc.stop(t + 1.1);
    }

    /**
     * SFX: Game Over — Descending dark tones + distorted rumble
     */
    playGameOver() {
        if (!this.isInitialized) return;
        const t = this.ctx.currentTime;

        // Descending minor arpeggio: Eb4, C4, Ab3, Eb3
        const notes = [311.13, 261.63, 207.65, 155.56];
        notes.forEach((freq, i) => {
            this.playTone(freq, 'sawtooth', 0.5, 0.15, i * 0.2);
        });

        // Deep rumble bass
        const rumbOsc = this.ctx.createOscillator();
        const rumbGain = this.ctx.createGain();
        const rumbFilter = this.ctx.createBiquadFilter();

        rumbOsc.type = 'sawtooth';
        rumbOsc.frequency.setValueAtTime(80, t + 0.3);
        rumbOsc.frequency.exponentialRampToValueAtTime(25, t + 2.5);

        rumbFilter.type = 'lowpass';
        rumbFilter.frequency.value = 150;
        rumbFilter.Q.value = 8;

        rumbGain.gain.setValueAtTime(0, t + 0.3);
        rumbGain.gain.linearRampToValueAtTime(0.3, t + 0.5);
        rumbGain.gain.exponentialRampToValueAtTime(0.001, t + 2.8);

        rumbOsc.connect(rumbFilter);
        rumbFilter.connect(rumbGain);
        rumbGain.connect(this.sfxGain);

        rumbOsc.start(t + 0.3);
        rumbOsc.stop(t + 3);

        // Static noise fade
        const noiseBuffer = this.createNoiseBuffer(2);
        const noiseSrc = this.ctx.createBufferSource();
        const noiseGain = this.ctx.createGain();
        const noiseFilter = this.ctx.createBiquadFilter();

        noiseSrc.buffer = noiseBuffer;
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 800;
        noiseFilter.Q.value = 0.5;

        noiseGain.gain.setValueAtTime(0, t + 0.5);
        noiseGain.gain.linearRampToValueAtTime(0.1, t + 1);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);

        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        noiseSrc.start(t + 0.5);
        noiseSrc.stop(t + 2.8);
    }

    /**
     * SFX: Game Start — Sci-fi boot-up / power-on sequence
     */
    playGameStart() {
        if (!this.isInitialized) return;
        const t = this.ctx.currentTime;

        // Boot-up sweep: noise naik
        const noiseBuffer = this.createNoiseBuffer(1);
        const noiseSrc = this.ctx.createBufferSource();
        const noiseGain = this.ctx.createGain();
        const noiseFilter = this.ctx.createBiquadFilter();

        noiseSrc.buffer = noiseBuffer;
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(200, t);
        noiseFilter.frequency.exponentialRampToValueAtTime(4000, t + 0.6);
        noiseFilter.frequency.exponentialRampToValueAtTime(800, t + 1.0);
        noiseFilter.Q.value = 2;

        noiseGain.gain.setValueAtTime(0.15, t);
        noiseGain.gain.linearRampToValueAtTime(0.25, t + 0.3);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);

        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        noiseSrc.start(t);
        noiseSrc.stop(t + 1.1);

        // Power-on chord: C5 + G5 + C6
        const startNotes = [523.25, 783.99, 1046.5];
        startNotes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + 0.2);

            gain.gain.setValueAtTime(0, t + 0.2);
            gain.gain.linearRampToValueAtTime(0.15 - i * 0.03, t + 0.3);
            gain.gain.setValueAtTime(0.15 - i * 0.03, t + 0.7);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(t + 0.2);
            osc.stop(t + 1.4);
        });

        // Sub kick
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();

        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(150, t + 0.15);
        kickOsc.frequency.exponentialRampToValueAtTime(40, t + 0.5);

        kickGain.gain.setValueAtTime(0.35, t + 0.15);
        kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

        kickOsc.connect(kickGain);
        kickGain.connect(this.sfxGain);

        kickOsc.start(t + 0.15);
        kickOsc.stop(t + 0.6);
    }

    /**
     * SFX: Tombol Hover — Click subtle
     */
    playButtonHover() {
        if (!this.isInitialized) return;
        this.playTone(1200, 'sine', 0.06, 0.08);
    }

    /**
     * SFX: Tombol Klik — Tekan pendek tegas
     */
    playButtonClick() {
        if (!this.isInitialized) return;
        this.playTone(800, 'sine', 0.05, 0.15);
        this.playTone(1200, 'sine', 0.08, 0.1, 0.03);
    }
}

// Singleton global
const audioEngine = new AudioEngine();
