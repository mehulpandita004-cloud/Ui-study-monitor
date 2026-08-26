// ==========================================
// Lighting & Image Quality Analyzer
// Distinguishes poor lighting from absence
// ==========================================

export interface LightingMetrics {
  lightingScore: number; // 0 to 100%
  condition: 'good' | 'low' | 'high_glare';
  averageLuminance: number; // 0 to 255
}

export function analyzeFrameLighting(
  videoElement: HTMLVideoElement,
  tempCanvas: HTMLCanvasElement
): LightingMetrics {
  try {
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return { lightingScore: 75, condition: 'good', averageLuminance: 120 };
    }

    const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return { lightingScore: 75, condition: 'good', averageLuminance: 120 };
    }

    // Downscale for fast luminosity sampling (e.g. 64x48)
    tempCanvas.width = 64;
    tempCanvas.height = 48;
    ctx.drawImage(videoElement, 0, 0, 64, 48);

    const imgData = ctx.getImageData(0, 0, 64, 48);
    const data = imgData.data;
    let totalLuminance = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Perceived luminance formula (ITU-R BT.601)
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      totalLuminance += lum;
    }

    const avgLum = Math.round(totalLuminance / pixelCount);

    let condition: 'good' | 'low' | 'high_glare' = 'good';
    let score = 90;

    if (avgLum < 35) {
      condition = 'low';
      score = Math.round((avgLum / 35) * 50);
    } else if (avgLum > 220) {
      condition = 'high_glare';
      score = Math.max(30, Math.round(100 - ((avgLum - 220) / 35) * 50));
    } else {
      condition = 'good';
      // Optimal range ~70 to 180
      score = Math.min(100, Math.max(60, 100 - Math.abs(avgLum - 120) / 2));
    }

    return {
      lightingScore: score,
      condition,
      averageLuminance: avgLum,
    };
  } catch (err) {
    return { lightingScore: 75, condition: 'good', averageLuminance: 120 };
  }
}
