const WAV_HEADER_SIZE = 44;

function ensureArrayBufferView(input: Uint8Array | ArrayBuffer) {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

export function bytesToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function concatUint8Arrays(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export function resamplePcm16(input: Int16Array, fromRate: number, toRate: number) {
  if (fromRate === toRate) {
    return new Int16Array(input);
  }

  const ratio = fromRate / toRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const sourceIndex = i * ratio;
    const lower = Math.floor(sourceIndex);
    const upper = Math.min(input.length - 1, lower + 1);
    const weight = sourceIndex - lower;
    const sample = input[lower] * (1 - weight) + input[upper] * weight;
    output[i] = clampToInt16(sample);
  }

  return output;
}

export function encodePcm16Wav(samples: Int16Array, sampleRate: number) {
  const buffer = new ArrayBuffer(WAV_HEADER_SIZE + samples.length * 2);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  writeAscii(bytes, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(bytes, 8, "WAVE");
  writeAscii(bytes, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(bytes, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(WAV_HEADER_SIZE + i * 2, samples[i], true);
  }

  return bytes;
}

export function decodeWav(input: Uint8Array | ArrayBuffer) {
  const bytes = ensureArrayBufferView(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (readAscii(bytes, 0, 4) !== "RIFF" || readAscii(bytes, 8, 4) !== "WAVE") {
    throw new Error("Unsupported WAV format");
  }

  let offset = 12;
  let format = 1;
  let channels = 1;
  let sampleRate = 8000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    offset += 8;

    if (chunkId === "fmt ") {
      format = view.getUint16(offset, true);
      channels = view.getUint16(offset + 2, true);
      sampleRate = view.getUint32(offset + 4, true);
      bitsPerSample = view.getUint16(offset + 14, true);
    } else if (chunkId === "data") {
      dataOffset = offset;
      dataSize = chunkSize;
      break;
    }

    offset += chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0) {
    throw new Error("WAV data chunk missing");
  }

  const frameCount = dataSize / (bitsPerSample / 8) / channels;
  const mono = new Int16Array(frameCount);

  if (format === 1 && bitsPerSample === 16) {
    for (let frame = 0; frame < frameCount; frame++) {
      let mixed = 0;
      for (let channel = 0; channel < channels; channel++) {
        const sampleOffset = dataOffset + (frame * channels + channel) * 2;
        mixed += view.getInt16(sampleOffset, true);
      }
      mono[frame] = clampToInt16(mixed / channels);
    }
  } else if (format === 3 && bitsPerSample === 32) {
    for (let frame = 0; frame < frameCount; frame++) {
      let mixed = 0;
      for (let channel = 0; channel < channels; channel++) {
        const sampleOffset = dataOffset + (frame * channels + channel) * 4;
        mixed += view.getFloat32(sampleOffset, true);
      }
      mono[frame] = clampToInt16((mixed / channels) * 32767);
    }
  } else {
    throw new Error(`Unsupported WAV encoding (${format}/${bitsPerSample})`);
  }

  return { sampleRate, samples: mono };
}

export function encodeMuLaw(sample: number) {
  const MULAW_MAX = 0x1fff;
  const BIAS = 0x84;

  let pcm = clampToInt16(sample);
  let mask = 0xff;

  if (pcm < 0) {
    pcm = -pcm;
    mask = 0x7f;
  }

  pcm = Math.min(pcm + BIAS, MULAW_MAX);

  let segment = 7;
  for (let value = pcm >> 7; value > 0; value >>= 1) {
    segment--;
  }

  const mantissa = (pcm >> (segment + 3)) & 0x0f;
  const muLaw = ~(segment << 4 | mantissa);
  return (muLaw & mask) & 0xff;
}

export function decodeMuLaw(byte: number) {
  const BIAS = 0x84;
  const muLaw = ~byte & 0xff;
  const sign = muLaw & 0x80 ? -1 : 1;
  const exponent = (muLaw >> 4) & 0x07;
  const mantissa = muLaw & 0x0f;
  const magnitude = ((mantissa << 3) + BIAS) << exponent;
  return sign * (magnitude - BIAS);
}

export function pcm16ToMuLaw(samples: Int16Array) {
  const encoded = new Uint8Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    encoded[i] = encodeMuLaw(samples[i]);
  }
  return encoded;
}

export function muLawToPcm16(bytes: Uint8Array) {
  const decoded = new Int16Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    decoded[i] = decodeMuLaw(bytes[i]);
  }
  return decoded;
}

export function wavBase64ToMulawBase64(wavBase64: string) {
  const { sampleRate, samples } = decodeWav(base64ToBytes(wavBase64));
  const resampled = resamplePcm16(samples, sampleRate, 8000);
  return bytesToBase64(pcm16ToMuLaw(resampled));
}

export function mulawBase64ToWavBase64(mulawBase64: string, outputRate = 24000) {
  const pcm = muLawToPcm16(base64ToBytes(mulawBase64));
  const resampled = resamplePcm16(pcm, 8000, outputRate);
  return bytesToBase64(encodePcm16Wav(resampled, outputRate));
}

export function estimateMuLawEnergy(bytes: Uint8Array) {
  if (bytes.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < bytes.length; i++) {
    total += Math.abs(decodeMuLaw(bytes[i]));
  }
  return total / bytes.length;
}

function clampToInt16(value: number) {
  return Math.max(-32768, Math.min(32767, Math.round(value)));
}

function writeAscii(target: Uint8Array, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    target[offset + i] = value.charCodeAt(i);
  }
}

function readAscii(source: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...source.subarray(offset, offset + length));
}
