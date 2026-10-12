"""
Synthesises the launch video's soundtrack from scratch: an original 120 BPM
track in A minor and a sound-effects layer timed to the video. Nothing is
sampled, so there is no third-party audio to license.

    python3 scripts/make-soundtrack.py

Writes public/audio/music.mp3 and public/audio/sfx.mp3 (needs numpy and ffmpeg).
Frame numbers below are video frames at 30 fps; keep them in step with
src/LaunchVideo.tsx and the scenes if the timing changes.
"""

import os
import subprocess
import wave

import numpy as np

SR = 44100
FPS = 30
LENGTH = 41.0  # the video is 1227 frames, 40.9 s
N = int(SR * LENGTH)
BEAT = 0.5  # 120 BPM
GRID = 0.3  # first beat; puts downbeats on the reveal (3.3 s) and the dashboard (6.3 s)
rng = np.random.default_rng(7)

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "audio")


def f(frame):
    return frame / FPS


def beat(i):
    return GRID + i * BEAT


def note(name):
    """'A1' → Hz."""
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3, "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    pitch, octave = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[pitch] + (octave - 4) * 12) / 12)


def tt(seconds):
    return np.arange(int(seconds * SR)) / SR


class Track:
    def __init__(self):
        self.buf = np.zeros((2, N))

    def add(self, sig, at, gain=1.0, pan=0.0):
        """Mixes a mono or stereo signal in at `at` seconds. pan -1 left … 1 right."""
        start = int(at * SR)
        if start >= N:
            return
        if sig.ndim == 1:
            left, right = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)
            sig = np.stack([sig * left * 1.414, sig * right * 1.414])
        end = min(N, start + sig.shape[1])
        if start < 0:
            sig = sig[:, -start:]
            start = 0
        self.buf[:, start:end] += sig[:, : end - start] * gain


def saw(freq, t, harmonics=10, rolloff=1.4, detune=0.0):
    out = np.zeros_like(t)
    for h in range(1, harmonics + 1):
        if freq * h > SR / 2.2:
            break
        out += np.sin(2 * np.pi * freq * (1 + detune) * h * t + h) / h**rolloff
    return out


def band(sig, lo, hi):
    spec = np.fft.rfft(sig)
    fr = np.fft.rfftfreq(len(sig), 1 / SR)
    spec[(fr < lo) | (fr > hi)] = 0
    return np.fft.irfft(spec, len(sig))


def noise(seconds):
    return rng.standard_normal(int(seconds * SR))


def env_ad(t, attack, decay_rate):
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t * decay_rate)


# ---------- instruments ----------


def kick(gain=1.0):
    t = tt(0.5)
    freq = 45 + 110 * np.exp(-t * 28)
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 7)
    click = band(noise(0.5), 1500, 8000) * np.exp(-t * 300) * 0.3
    return (body + click) * gain


def clap():
    t = tt(0.3)
    n = band(noise(0.3), 900, 5000)
    e = np.zeros_like(t)
    for d in (0, 0.012, 0.024):
        td = np.clip(t - d, 0, None)
        e += (t >= d) * np.exp(-td * 60) * 0.6
    e += np.exp(-t * 18) * 0.5
    return n * e * 0.5


def hat(open_=False):
    t = tt(0.35 if open_ else 0.08)
    n = band(noise(len(t) / SR), 7000, 16000)
    return n * np.exp(-t * (14 if open_ else 70)) * 0.35


def bass(freq, seconds=0.25):
    t = tt(seconds)
    sig = saw(freq, t, harmonics=7, rolloff=1.7) + 0.6 * np.sin(2 * np.pi * freq / 2 * t)
    pump = (1 - np.exp(-t * 40)) * np.exp(-t * 4)
    return sig * pump * 0.55


def pad(freqs, seconds, attack=0.6, release=0.8):
    t = tt(seconds + release)
    left = np.zeros_like(t)
    right = np.zeros_like(t)
    for fr in freqs:
        left += saw(fr, t, 9, 1.8, -0.004) + saw(fr, t, 9, 1.8, 0.003)
        right += saw(fr, t, 9, 1.8, 0.004) + saw(fr, t, 9, 1.8, -0.002)
    e = np.minimum(1, t / attack) * np.clip((seconds + release - t) / release, 0, 1)
    lfo = 0.85 + 0.15 * np.sin(2 * np.pi * 0.25 * t)
    return np.stack([left, right]) * e * lfo * 0.09 / len(freqs)


def pluck(freq):
    t = tt(0.35)
    sig = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(4 * np.pi * freq * t) + 0.12 * np.sin(6 * np.pi * freq * t)
    return sig * env_ad(t, 0.002, 11) * 0.22


def bell(freq, seconds=2.0):
    t = tt(seconds)
    sig = sum(a * np.sin(2 * np.pi * freq * r * t) * np.exp(-t * d) for r, a, d in ((1, 1, 2.2), (2.76, 0.45, 4), (5.4, 0.25, 7), (8.9, 0.1, 10)))
    return sig * np.minimum(1, t / 0.003) * 0.22


def impact(gain=1.0, length=2.5):
    t = tt(length)
    freq = 32 + 70 * np.exp(-t * 9)
    boom = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 2.2)
    crash = band(noise(length), 3000, 15000) * np.exp(-t * 3.5) * 0.35
    thump = band(noise(length), 80, 600) * np.exp(-t * 25) * 0.8
    return (boom + crash + thump) * gain


def riser(seconds):
    t = tt(seconds)
    p = t / seconds
    n = band(noise(seconds), 1500, 12000) * p**2.5 * 0.5
    sweep = np.sin(2 * np.pi * np.cumsum(220 * 8**p) / SR) * p**2 * 0.18
    return n + sweep


def thump(freq=110):
    t = tt(0.35)
    fr = freq * 0.4 + freq * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 12) + band(noise(0.35), 2000, 8000) * np.exp(-t * 80) * 0.25


# ---------- sfx ----------


def whoosh(seconds=0.6):
    t = tt(seconds)
    p = t / seconds
    e = np.sin(np.pi * p**0.7) ** 2
    n = band(noise(seconds), 400, 7000) * e * 0.5
    stereo = np.stack([n * (1 - p), n * p]) * 1.4
    return stereo


def click():
    t = tt(0.06)
    return (np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 120) + band(noise(0.06), 3000, 12000) * np.exp(-t * 400)) * 0.5


def tick(freq):
    t = tt(0.12)
    fr = freq * (1 + 0.5 * np.minimum(1, t / 0.03))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env_ad(t, 0.002, 30) * 0.45


def pop():
    t = tt(0.12)
    fr = 380 + 700 * np.minimum(1, t / 0.06)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env_ad(t, 0.003, 28) * 0.4


def key():
    t = tt(0.1)
    return (band(noise(0.1), 1500, 9000) * np.exp(-t * 160) + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 50) * 0.6) * 0.6


# ---------- arrangement ----------

AM = ["A3", "C4", "E4"]
F_ = ["F3", "A3", "C4"]
C_ = ["C4", "E4", "G4"]
G_ = ["G3", "B3", "D4"]
CHORDS = {"Am": (AM, "A1"), "F": (F_, "F1"), "C": (C_, "C2"), "G": (G_, "G1")}

music = Track()

# Hook (0–3.3 s): drone, a thump per struck-out tool, a hit on "Too many tools.", riser.
t = tt(3.4)
drone = (np.sin(2 * np.pi * note("A1") * t) + 0.5 * np.sin(2 * np.pi * note("A2") * t)) * np.minimum(1, t / 1.5) * 0.25
music.add(drone, 0)
for i, frame in enumerate((4, 14, 24, 34, 44)):
    music.add(thump(90 + i * 12), f(frame), 0.7)
music.add(impact(0.8, 1.2), f(64))
music.add(riser(1.1), beat(6) - 1.1, 0.8)

# Reveal (3.3–6.3 s): drop, chime on the burst, half-time kick, clap roll into the groove.
music.add(impact(1.0), beat(6))
music.add(pad([note(n) for n in AM], 3.0, attack=0.3), beat(6))
for i, n in enumerate(("A5", "E6", "A6", "C7")):
    music.add(bell(note(n)), f(120) + i * 0.09, 0.8, pan=-0.5 + i * 0.33)
for b in range(8, 12, 2):
    music.add(kick(0.8), beat(b))
for i, d in enumerate(np.cumsum([0.25, 0.25, 0.125, 0.125, 0.125, 0.125, 0.0625, 0.0625, 0.0625, 0.0625])):
    music.add(clap(), beat(10) + d - 0.25, 0.25 + i * 0.05)
music.add(riser(1.0), beat(12) - 1.0, 0.6)

ARP = [0, 1, 2, 1, 0, 2, 1, 2]


def groove(start_beat, chords, arp=True, hats=True, beats=8):
    """`beats` beats (two bars) per chord name in `chords`."""
    b = start_beat
    for name in chords:
        tones, root = CHORDS[name]
        music.add(pad([note(n) for n in tones] + [note(tones[0][:-1] + "5")], beats * BEAT), beat(b))
        for k in range(beats):
            music.add(kick(), beat(b + k))
            if k % 2 == 1:
                music.add(clap(), beat(b + k), 0.9)
            if hats:
                music.add(hat(open_=True), beat(b + k) + BEAT / 2, 0.8, pan=0.25)
                music.add(hat(), beat(b + k) + BEAT / 4, 0.5, pan=-0.3)
                music.add(hat(), beat(b + k) + 3 * BEAT / 4, 0.5, pan=-0.3)
            for e in range(2):
                bf = note(root) * (2 if (k * 2 + e) % 4 == 3 else 1)
                music.add(bass(bf, 0.24), beat(b + k) + e * BEAT / 2)
            if arp:
                for s in range(4):
                    i = (k * 4 + s) % len(ARP)
                    octave = 2 if (k * 4 + s) % 16 >= 8 else 1
                    music.add(pluck(note(tones[ARP[i]]) * octave * 2), beat(b + k) + s * BEAT / 4, 0.9, pan=0.35 if s % 2 else -0.35)
        b += beats


# Groove from the dashboard (beat 12, 6.3 s) into the search scene (30.3 s).
groove(12, ["Am", "F"], arp=False)
groove(28, ["C", "G", "Am", "F"])

# Break as the search palette opens (30.3–32.3 s): pad only, a riser into the wall.
music.add(pad([note(n) for n in G_], 2.0, attack=0.2), beat(60))
music.add(riser(2.0), beat(64) - 2.0, 0.9)
for b in range(60, 64):
    music.add(hat(), beat(b) + BEAT / 2, 0.4)

# Wall drop (32.3 s) and the last run.
music.add(impact(0.9), beat(64))
groove(64, ["Am"], beats=7)
music.add(riser(0.9), beat(71) - 0.4, 0.7)

# Outro (35.8 s): final hit, a long chord and chimes, fading to the end.
music.add(impact(1.1, 4.0), beat(71))
music.add(pad([note(n) for n in AM] + [note("A4"), note("E5")], 3.5, attack=0.05, release=1.5), beat(71), 1.3)
music.add(bass(note("A1"), 3.0) * np.exp(-tt(3.0) * 0.6), beat(71))
for i, n in enumerate(("E5", "A5", "C6", "E6", "A6")):
    music.add(bell(note(n), 3.0), f(1072 + 16) + i * 0.12, 0.7, pan=-0.6 + i * 0.3)

# ---------- sound effects ----------

sfx = Track()
for frame, length in ((100, 10), (189, 16), (348, 16), (478, 20), (607, 16), (769, 18), (883, 16), (962, 16), (1072, 20)):
    sfx.add(whoosh(0.55), f(frame + length / 2) - 0.38, 0.8)
sfx.add(bell(note("E6"), 1.0), f(189 + 88), 0.35)  # ring on the open-invoices figure
for frame in (189 + 92, 189 + 142, 348 + 106, 478 + 74, 607 + 120):
    sfx.add(pop(), f(frame), 0.8)  # chips
sfx.add(click(), f(348 + 72))  # grabbing the deal
sfx.add(thump(160), f(348 + 104), 0.5)  # dropping it
for i, frame in enumerate((478 + 46, 478 + 55, 478 + 64)):
    sfx.add(tick(900 + i * 220), f(frame))  # tasks ticked
sfx.add(whoosh(0.5), f(478 + 80), 0.5)  # card flip
sfx.add(click(), f(607 + 110))  # Record payment
sfx.add(impact(0.9, 1.2), f(607 + 116))  # PAID stamp
sfx.add(key(), f(883 + 14))
sfx.add(key(), f(883 + 18))


def write(track, name, peak):
    buf = np.tanh(track.buf * 1.2) / np.tanh(1.2)
    fade = int(1.5 * SR)
    buf[:, -fade:] *= np.linspace(1, 0, fade) ** 2
    buf *= peak / max(1e-9, np.abs(buf).max())
    pcm = (buf.T * 32767).astype("<i2")
    os.makedirs(OUT, exist_ok=True)
    wav = os.path.join(OUT, name + ".wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-b:a", "192k", os.path.join(OUT, name + ".mp3")], check=True)
    os.remove(wav)


write(music, "music", 0.89)
write(sfx, "sfx", 0.8)
print("wrote", os.path.abspath(OUT))
