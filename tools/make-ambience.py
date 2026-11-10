"""Synthesises the quiet garden ambience that plays while the timer runs in the background
(assets/audio/garden-ambience.mp3, replacing the old 400 Hz keep-alive tone).

Run: python3 tools/make-ambience.py        (needs numpy, scipy and ffmpeg)

Soft wind in the leaves, a far-away bird now and then, and an occasional soft wind-chime note,
all very quiet. It is a seamless loop (the end is cross-faded into the start).
"""
import subprocess, sys
from pathlib import Path
import numpy as np
from scipy import signal

SR = 32000
LOOP = 96          # seconds
XF = 5             # cross-fade seconds
rng = np.random.default_rng(20261110)
N = (LOOP + XF) * SR
t = np.arange(N) / SR


def smooth_noise(freq, n=N, depth=1.0):
    """slowly wandering value in [0,1]"""
    pts = int(n / SR * freq) + 3
    v = rng.random(pts)
    x = np.interp(np.linspace(0, pts - 1, n), np.arange(pts), v)
    return 1 - depth + depth * x


def band(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lowp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x)


white = rng.standard_normal(N)
# wind: low rumble-free breathing band, slowly swelling
gust = smooth_noise(.11) ** 1.6 * smooth_noise(.037, depth=.5)
wind = band(white, 180, 900) * gust * 1.0
wind += band(rng.standard_normal(N), 900, 2200) * gust ** 2 * .35
# leaves: faint high rustle that follows the gusts
leaf_gate = np.clip(gust - .35, 0, 1) ** 1.5 * (0.5 + 0.5 * smooth_noise(.9))
leaves = band(rng.standard_normal(N), 3200, 7500) * leaf_gate * .10

mix = wind * .8 + leaves

def bell(freq, dur, tau, partials=((1, 1, 1), (2.32, .3, .5), (4.25, .16, .3))):
    n = int(dur * SR); tt = np.arange(n) / SR
    out = np.zeros(n)
    for r, a, d in partials:
        out += a * np.sin(2 * np.pi * freq * r * tt) * np.exp(-tt / (tau * d))
    return out * np.minimum(1, tt / .01)


def chirp_note(f0, f1, dur):
    n = int(dur * SR); tt = np.arange(n) / SR
    f = f0 + (f1 - f0) * (tt / dur) ** .8
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.sin(np.pi * np.minimum(1, tt / dur)) ** 1.5
    return np.sin(ph + .6 * np.sin(2 * np.pi * 38 * tt)) * env


def place(dst, src, at, gain):
    i = int(at * SR)
    if i < len(dst):
        j = min(len(dst), i + len(src)); dst[i:j] += src[: j - i] * gain

events = np.zeros(N)
# a far bird every 7-15 s: two to four soft notes
at = 3.0
while at < LOOP + XF - 2:
    base = rng.choice([2600, 3000, 3400, 3900])
    for k in range(rng.integers(2, 5)):
        place(events, chirp_note(base * (1 + .08 * k), base * (1.25 + .1 * k), .09 + .04 * rng.random()), at + k * .16, 1.0)
    at += rng.uniform(7, 15)
events = lowp(events, 4200) * .05
# a wind-chime note every 16-30 s, pentatonic, very soft
chime = np.zeros(N)
at = 9.0
scale = [1318.5, 1568.0, 1760.0, 2093.0, 2349.3]
while at < LOOP + XF - 4:
    place(chime, bell(rng.choice(scale), 4.0, 1.1), at, 1.0)
    at += rng.uniform(16, 30)
chime = chime * .035

# a touch of room on the events
def room(x, wet=.35):
    out = x.copy()
    for d, g in ((.047, .5), (.071, .35), (.113, .25)):
        k = int(d * SR); out[k:] += g * x[:-k]
    return out * (1 - wet) + lowp(out, 3500) * wet

mix = mix / (np.sqrt((mix ** 2).mean()) + 1e-9) * .0125   # ~ -38 dBFS rms bed
mix = mix + room(events) + room(chime, .5)

# seamless loop: blend the tail that runs past LOOP into the beginning
head = mix[: XF * SR]; tail = mix[LOOP * SR: (LOOP + XF) * SR]
fade = np.linspace(0, 1, XF * SR)
loop = mix[: LOOP * SR].copy()
loop[: XF * SR] = head * np.sqrt(fade) + tail * np.sqrt(1 - fade)
loop = signal.sosfilt(signal.butter(2, 60, btype="high", fs=SR, output="sos"), loop)
peak = np.abs(loop).max()
print(f"rms {np.sqrt((loop ** 2).mean()):.4f} ({20 * np.log10(np.sqrt((loop ** 2).mean())):.1f} dBFS), peak {peak:.3f}")
pcm = np.int16(np.clip(loop, -1, 1) * 32767)
out = Path(__file__).resolve().parent.parent / "assets/audio"
out.mkdir(parents=True, exist_ok=True)
wav = out / "_ambience.wav"
import wave
with wave.open(str(wav), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "56k", "-ac", "1", str(out / "garden-ambience.mp3")], check=True)
wav.unlink()
print("wrote", out / "garden-ambience.mp3", (out / "garden-ambience.mp3").stat().st_size // 1024, "KB")
