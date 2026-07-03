const Sound = (function() {
    let ctx = null;
    let unlocked = false;

    function init() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        unlocked = true;
    }

    function playTone(freq, type, duration, vol = 0.1, slideFreq = null) {
        if (!ctx || !unlocked) return;
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            if (slideFreq) {
                osc.frequency.exponentialRampToValueAtTime(slideFreq, ctx.currentTime + duration);
            }
            
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch(e) {}
    }

    function playNoise(duration, vol = 0.1) {
        if (!ctx || !unlocked) return;
        try {
            const bufferSize = ctx.sampleRate * duration;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2000, ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + duration);

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            
            noise.start();
        } catch(e) {}
    }

    return {
        init,
        spin: () => playTone(400, 'sine', 0.1, 0.02, 200),
        chance: () => playTone(800, 'square', 0.3, 0.05, 1200),
        reach: () => {
            playTone(400, 'sawtooth', 0.5, 0.05, 600);
            setTimeout(() => playTone(600, 'sawtooth', 0.5, 0.05, 400), 500);
        },
        red: () => {
            playTone(600, 'square', 0.2, 0.1, 1000);
            setTimeout(() => playTone(800, 'square', 0.4, 0.1, 400), 200);
        },
        gold: () => {
            playTone(1000, 'sawtooth', 0.3, 0.1, 1500);
            setTimeout(() => playTone(1200, 'sawtooth', 0.5, 0.1, 800), 300);
        },
        awaken: () => {
            playNoise(2.0, 0.5); // 爆発音
            playTone(150, 'square', 2.0, 0.2, 50); // 重低音
        },
        kyuin: () => {
            playTone(1500, 'sine', 0.3, 0.2, 3000);
            setTimeout(() => playTone(1500, 'sine', 0.3, 0.2, 3000), 150);
            setTimeout(() => playTone(1500, 'sine', 0.3, 0.2, 3000), 300);
        },
        rushHit: () => {
            playNoise(1.0, 0.4);
            setTimeout(() => Sound.kyuin(), 200);
        },
        fanfare: () => {
            const playChord = (f1, f2, f3, time, dur) => {
                setTimeout(() => {
                    playTone(f1, 'square', dur, 0.05);
                    playTone(f2, 'square', dur, 0.05);
                    playTone(f3, 'square', dur, 0.05);
                }, time);
            };
            playChord(523.25, 659.25, 783.99, 0, 0.2); // C
            playChord(523.25, 659.25, 783.99, 200, 0.2); // C
            playChord(587.33, 698.46, 880.00, 400, 0.2); // Dm
            playChord(659.25, 830.61, 987.77, 600, 0.6); // Em
            playChord(698.46, 880.00, 1046.50, 1200, 0.8); // F
        }
    };
})();
