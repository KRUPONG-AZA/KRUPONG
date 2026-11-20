export type ParticleKind = 'ethanol' | 'water';

export interface MacroParticle {
  id: number;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface MacroSimConfig {
  width: number;
  height: number;
  bigRadius: number;
  smallRadius: number;
}

export const DEFAULT_MACRO_CONFIG: MacroSimConfig = {
  width: 440,
  height: 360,
  bigRadius: 24,
  smallRadius: 6.5,
};

export interface MacroHeightMetrics {
  ethanolCount: number;
  waterCount: number;
  /** Hypothetical stacked height if particles sat in separate non-interpenetrating layers */
  separateSumHeight: number;
  /** Actual measured vertical fill height from the bottom of the container */
  actualFillHeight: number;
  /** Difference saved by filling interstitial spaces */
  savedHeight: number;
}

export function createPingPongBatch(
  startId: number,
  count: number,
  config: MacroSimConfig,
): MacroParticle[] {
  const particles: MacroParticle[] = [];
  const cols = Math.max(1, Math.floor((config.width - 24) / (config.bigRadius * 2.15)));
  const startX = (config.width - (cols - 1) * config.bigRadius * 2.15) / 2;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitter = ((i * 17) % 11) - 5;
    particles.push({
      id: startId + i,
      kind: 'ethanol',
      x: Math.min(
        config.width - config.bigRadius - 6,
        Math.max(config.bigRadius + 6, startX + col * config.bigRadius * 2.12 + jitter),
      ),
      y: 36 - row * config.bigRadius * 2.05,
      vx: (((i % 3) - 1) * 18),
      vy: 40 + row * 12,
      radius: config.bigRadius,
    });
  }
  return particles;
}

export function createMungBeanBatch(
  startId: number,
  count: number,
  config: MacroSimConfig,
): MacroParticle[] {
  const particles: MacroParticle[] = [];
  const margin = config.smallRadius + 10;
  const usableWidth = config.width - margin * 2;
  const cols = 16;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const offset = (row % 2) * (usableWidth / cols) * 0.45;
    particles.push({
      id: startId + i,
      kind: 'water',
      x: margin + (col / (cols - 1)) * usableWidth * 0.92 + offset * 0.3,
      y: 16 - row * (config.smallRadius * 2.2),
      vx: (((i * 7) % 13) - 6) * 4,
      vy: 70 + (row % 4) * 15,
      radius: config.smallRadius,
    });
  }
  return particles;
}

export function stepMacroSimulation(
  particles: MacroParticle[],
  config: MacroSimConfig,
  dt: number,
): void {
  const clampedDt = Math.min(dt, 0.033);
  const gravity = 760;
  const damping = 0.985;
  const bounce = 0.22;

  for (const p of particles) {
    p.vy += gravity * clampedDt;
    p.vx *= damping;
    p.vy *= damping;
    p.x += p.vx * clampedDt;
    p.y += p.vy * clampedDt;
  }

  // Pairwise elastic-damped circle resolution (3 solver passes for stable packing)
  const passes = 3;
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.radius + b.radius;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.001;
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          // Mass proportional to area (radius^2)
          const ma = a.radius * a.radius;
          const mb = b.radius * b.radius;
          const invMassSum = 1 / (ma + mb);
          const ratioA = mb * invMassSum;
          const ratioB = ma * invMassSum;

          a.x -= nx * overlap * ratioA;
          a.y -= ny * overlap * ratioA;
          b.x += nx * overlap * ratioB;
          b.y += ny * overlap * ratioB;

          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const velAlongNormal = rvx * nx + rvy * ny;
          if (velAlongNormal < 0) {
            const impulse = -(1 + bounce) * velAlongNormal;
            a.vx -= impulse * ratioA * nx;
            a.vy -= impulse * ratioA * ny;
            b.vx += impulse * ratioB * nx;
            b.vy += impulse * ratioB * ny;
          }
        }
      }

      // Container walls and floor
      const pad = 6;
      if (a.x - a.radius < pad) {
        a.x = pad + a.radius;
        a.vx = Math.abs(a.vx) * bounce;
      } else if (a.x + a.radius > config.width - pad) {
        a.x = config.width - pad - a.radius;
        a.vx = -Math.abs(a.vx) * bounce;
      }
      if (a.y + a.radius > config.height - pad) {
        a.y = config.height - pad - a.radius;
        a.vy = -Math.abs(a.vy) * bounce * 0.5;
        a.vx *= 0.92;
      }
    }
  }
}

export function computeMacroHeights(
  particles: MacroParticle[],
  config: MacroSimConfig,
): MacroHeightMetrics {
  const floorY = config.height - 6;
  const usableWidth = config.width - 12;
  let ethanolCount = 0;
  let waterCount = 0;
  let minTopY = floorY;
  let ethanolArea = 0;
  let waterArea = 0;

  for (const p of particles) {
    if (p.kind === 'ethanol') {
      ethanolCount++;
      ethanolArea += Math.PI * p.radius * p.radius;
    } else {
      waterCount++;
      waterArea += Math.PI * p.radius * p.radius;
    }
    const topY = p.y - p.radius;
    if (topY < minTopY && p.y > 10) {
      minTopY = topY;
    }
  }

  const actualFillHeight = particles.length > 0 ? Math.max(0, floorY - minTopY) : 0;
  // Separate packing efficiency (~78% for circles in 2D)
  const ethanolLayerH = ethanolCount > 0 ? (ethanolArea / 0.76) / usableWidth : 0;
  const waterLayerH = waterCount > 0 ? (waterArea / 0.8) / usableWidth : 0;
  const separateSumHeight =
    ethanolCount > 0 && waterCount > 0
      ? Math.max(actualFillHeight + 34, ethanolLayerH + waterLayerH)
      : actualFillHeight;

  return {
    ethanolCount,
    waterCount,
    separateSumHeight: Math.round(separateSumHeight),
    actualFillHeight: Math.round(actualFillHeight),
    savedHeight:
      ethanolCount > 0 && waterCount > 0
        ? Math.max(0, Math.round(separateSumHeight - actualFillHeight))
        : 0,
  };
}
