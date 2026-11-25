#!/usr/bin/env python3
"""Writes the music of the hidden reel (0401/assets/loop.mp3): an original 8-bar chiptune loop,
synthesised here from scratch (pulse lead, arpeggio, bass, drums), 120 BPM, A minor, 16 seconds.

The file is 17 seconds long: the last second repeats the first, so the page can loop any
16-second window of it without a click, whatever padding the MP3 decoder adds at the start.
usage: python3 tools/build-reel-music.py      (needs NumPy and ffmpeg)
"""
import os, subprocess, tempfile, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR, BPM, BARS = 44100, 120, 8
BEAT = 60 / BPM
LOOP = BARS * 4 * BEAT
N = int(LOOP * SR)
buf = np.zeros(N * 3 + SR)      # three passes: the middle one carries the tails of the one before
rng = np.random.default_rng(401)

def hz(m): return 440 * 2 ** ((m - 69) / 12)
def t_of(dur): return np.arange(int(dur * SR)) / SR
def env(n, attack=0.004, release=0.03, decay=0.0, sustain=1.0):
    e = np.ones(n) * sustain
    a = max(1, int(attack * SR)); r = max(1, int(release * SR)); d = int(decay * SR)
    e[:a] = np.linspace(0, 1, a)
    if d: e[a:a + d] = np.linspace(1, sustain, d)[:max(0, min(d, n - a))]
    e[-r:] *= np.linspace(1, 0, r)
    return e
def pulse(freq, dur, duty=0.25, vibrato=0.0):
    t = t_of(dur); ph = (freq * t + vibrato * np.sin(2 * np.pi * 5.5 * t)) % 1
    return np.where(ph < duty, 1.0, -1.0)
def tri(freq, dur):
    t = t_of(dur); return 2 * np.abs(2 * ((freq * t) % 1) - 1) - 1
def put(sig, at, gain):
    for p in range(3):
        i = int((at + p * LOOP) * SR); buf[i:i + len(sig)] += sig * gain

# ---- drums
def kick():
    t = t_of(0.24); phase = 2 * np.pi * (46 * t + 115 * (1 - np.exp(-30 * t)) / 30)
    return np.sin(phase) * np.exp(-t * 13)
def snare():
    t = t_of(0.17); noise = np.diff(rng.standard_normal(len(t) + 1))
    return (noise * 0.55 + np.sin(2 * np.pi * 185 * t) * 0.5) * np.exp(-t * 24)
def hat(length=0.045):
    t = t_of(length); n = rng.standard_normal(len(t) + 2)
    return np.diff(n, 2) * 0.4 * np.exp(-t * 95)

# ---- the tune: one row per bar, eight 8th notes each (None = hold the note before)
ROOTS = [45, 41, 48, 43, 45, 41, 43, 40]                       # Am F C G | Am F G E
CHORDS = [[57, 60, 64, 69], [53, 57, 60, 65], [60, 64, 67, 72], [55, 59, 62, 67],
          [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67], [52, 56, 59, 64]]
LEAD = [[76, None, 69, 72, 76, None, 74, 72],
        [69, None, 72, None, 77, 76, 72, None],
        [79, None, 76, 79, None, 76, 74, 72],
        [74, None, 71, 74, 79, None, None, None],
        [76, None, 81, None, 79, 76, None, 72],
        [77, None, 81, None, 79, 77, 76, None],
        [74, 76, 79, None, 83, None, 79, None],
        [80, None, 76, None, 71, None, 76, 80]]
E8 = BEAT / 2
for bar in range(BARS):
    t0 = bar * 4 * BEAT
    for beat in range(4):
        put(kick(), t0 + beat * BEAT, 0.72)
        if beat % 2: put(snare(), t0 + beat * BEAT, 0.5)
        put(hat(), t0 + beat * BEAT + E8, 0.62)
        put(hat(0.03), t0 + beat * BEAT, 0.22)
    if bar == BARS - 1:                                          # a little fill before the loop comes round
        for k in range(4): put(snare(), t0 + 3 * BEAT + k * BEAT / 4, 0.28 + k * 0.07)
    # bass: eighths on the root, with the octave on the off-beats of 2 and 4
    for k in range(8):
        m = ROOTS[bar] + (12 if k in (3, 7) else 0)
        n = int(E8 * 0.86 * SR)
        sig = (tri(hz(m), E8 * 0.86) * 0.8 + pulse(hz(m), E8 * 0.86, 0.5) * 0.2) * env(n, 0.004, 0.04, 0.05, 0.75)
        put(sig, t0 + k * E8, 0.3)
    # arpeggio: sixteenths up and down the chord
    for k in range(16):
        m = CHORDS[bar][[0, 1, 2, 3, 2, 1][k % 6]] + 12
        n = int(BEAT / 4 * 0.9 * SR)
        put(tri(hz(m), BEAT / 4 * 0.9) * env(n, 0.003, 0.03, 0.03, 0.55), t0 + k * BEAT / 4, 0.11)
    # lead
    row = LEAD[bar]; k = 0
    while k < 8:
        if row[k] is None: k += 1; continue
        length = 1
        while k + length < 8 and row[k + length] is None: length += 1
        dur = length * E8 * 0.93; n = int(dur * SR)
        put(pulse(hz(row[k]), dur, 0.25, 0.004) * env(n, 0.006, 0.05, 0.06, 0.72), t0 + k * E8, 0.27)
        k += length

# soften the top end (the raw pulse waves are harsh), then a gentle limiter
spec = np.fft.rfft(buf); f = np.fft.rfftfreq(len(buf), 1 / SR)
spec *= 1 / (1 + (f / 9000) ** 4); spec[f < 28] = 0
buf = np.fft.irfft(spec, len(buf))
out = buf[N:N + N + SR]                                          # the middle pass plus one second of the next
out = np.tanh(out / np.abs(out).max() * 1.25) / np.tanh(1.25) * 0.86
seam = float(np.abs(out[:SR] - out[N:N + SR]).max())
print('duration %.2fs  peak %.2f  rms %.3f  largest difference between the first and the last second: %.1e' % (len(out) / SR, np.abs(out).max(), np.sqrt((out ** 2).mean()), seam))

with tempfile.TemporaryDirectory() as tmp:
    with wave.open(f'{tmp}/loop.wav', 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((out * 32767).astype('<i2').tobytes())
    os.makedirs(f'{ROOT}/0401/assets', exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{tmp}/loop.wav', '-ac', '1', '-b:a', '128k', '-map_metadata', '-1',
                    f'{ROOT}/0401/assets/loop.mp3'], check=True)
print('loop.mp3', os.path.getsize(f'{ROOT}/0401/assets/loop.mp3') // 1024, 'KB')
