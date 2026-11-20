import {
  computeMacroHeights,
  createMungBeanBatch,
  createPingPongBatch,
  DEFAULT_MACRO_CONFIG,
  MacroHeightMetrics,
  MacroParticle,
  MacroSimConfig,
  stepMacroSimulation,
} from '../logic/macroParticles';

export interface MacroBoxCallbacks {
  onMetricsUpdate?: (metrics: MacroHeightMetrics) => void;
}

export class MacroBoxRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: MacroBoxCallbacks;
  private config: MacroSimConfig = { ...DEFAULT_MACRO_CONFIG };
  private particles: MacroParticle[] = [];
  private nextId = 1;
  private rafId: number | null = null;
  private lastTime = 0;
  private activeFrames = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, callbacks: MacroBoxCallbacks = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Cannot initialize 2D context for macro analogy box');
    }
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.resize();
  }

  public resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(300, Math.round(rect.width || 440));
    const h = Math.max(320, Math.round(rect.height || 360));
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.config.width = w;
    this.config.height = h;
    this.draw();
  }

  public addPingPongBalls(): void {
    const existingEthanol = this.particles.filter((p) => p.kind === 'ethanol').length;
    if (existingEthanol >= 42) return;
    const batch = createPingPongBatch(this.nextId, 20, this.config);
    this.nextId += batch.length;
    this.particles.push(...batch);
    this.activeFrames = 260;
    this.startLoop();
  }

  public addMungBeans(): void {
    const existingWater = this.particles.filter((p) => p.kind === 'water').length;
    if (existingWater >= 180) return;
    const batch = createMungBeanBatch(this.nextId, 88, this.config);
    this.nextId += batch.length;
    this.particles.push(...batch);
    this.activeFrames = 300;
    this.startLoop();
  }

  public shake(): void {
    if (this.particles.length === 0) return;
    for (const p of this.particles) {
      p.vx += (Math.random() - 0.5) * 140;
      p.vy -= 110 + Math.random() * 90;
    }
    this.activeFrames = 220;
    this.startLoop();
  }

  public reset(): void {
    this.particles = [];
    this.nextId = 1;
    this.activeFrames = 0;
    this.stopLoop();
    this.callbacks.onMetricsUpdate?.(computeMacroHeights(this.particles, this.config));
    this.draw();
  }

  private startLoop(): void {
    if (this.rafId !== null || this.disposed) return;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      if (this.disposed) return;
      const dt = Math.min((now - this.lastTime) / 1000, 0.033);
      this.lastTime = now;

      stepMacroSimulation(this.particles, this.config, dt);
      this.activeFrames--;
      const metrics = computeMacroHeights(this.particles, this.config);
      this.callbacks.onMetricsUpdate?.(metrics);
      this.draw(metrics);

      const kinetic = this.particles.reduce(
        (sum, p) => sum + Math.abs(p.vx) + Math.abs(p.vy),
        0,
      );
      if (this.activeFrames > 0 && (kinetic > 8 || this.activeFrames > 200)) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public draw(metrics?: MacroHeightMetrics): void {
    const w = this.config.width;
    const h = this.config.height;
    const ctx = this.ctx;
    const m = metrics ?? computeMacroHeights(this.particles, this.config);

    ctx.clearRect(0, 0, w, h);

    // Background container interior
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, w, h);

    // Subtle measurement grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let y = h - 6; y > 20; y -= 40) {
      ctx.beginPath();
      ctx.moveTo(6, y);
      ctx.lineTo(w - 6, y);
      ctx.stroke();
    }

    // Draw particles (ping-pong orange spheres first, then mung beans)
    for (const p of this.particles) {
      if (p.kind !== 'ethanol') continue;
      const grad = ctx.createRadialGradient(
        p.x - p.radius * 0.32,
        p.y - p.radius * 0.32,
        p.radius * 0.15,
        p.x,
        p.y,
        p.radius,
      );
      grad.addColorStop(0, '#fde68a');
      grad.addColorStop(0.5, '#f59e0b');
      grad.addColorStop(1, '#b45309');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(254, 243, 199, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (const p of this.particles) {
      if (p.kind !== 'water') continue;
      const grad = ctx.createRadialGradient(
        p.x - p.radius * 0.3,
        p.y - p.radius * 0.3,
        1,
        p.x,
        p.y,
        p.radius,
      );
      grad.addColorStop(0, '#a7f3d0');
      grad.addColorStop(0.55, '#10b981');
      grad.addColorStop(1, '#047857');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Empty hint if no particles yet
    if (this.particles.length === 0) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
      ctx.font = '500 14px "IBM Plex Sans Thai", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('กดปุ่ม "เทลูกปิงปอง" ด้านบนเพื่อเริ่มต้น', w / 2, h / 2 - 8);
      ctx.font = '400 12px "IBM Plex Sans Thai", sans-serif';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
      ctx.fillText('จากนั้นเทเมล็ดถั่วเขียวเพื่อสังเกตการแทรกเข้าช่องว่าง', w / 2, h / 2 + 16);
    }

    // Draw level indicators when both types exist
    const floorY = h - 6;
    if (m.actualFillHeight > 0) {
      const actualY = Math.max(18, floorY - m.actualFillHeight);
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(6, actualY);
      ctx.lineTo(w - 6, actualY);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(12, actualY - 22, 178, 19);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 11px "IBM Plex Sans Thai", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`ระดับความสูงจริง: ${m.actualFillHeight} px`, 16, actualY - 9);
    }

    if (m.ethanolCount > 0 && m.waterCount > 0 && m.savedHeight > 0) {
      const sumY = Math.max(14, floorY - m.separateSumHeight);
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(6, sumY);
      ctx.lineTo(w - 6, sumY);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(w - 208, sumY + 4, 196, 19);
      ctx.fillStyle = '#fbbf24';
      ctx.font = '600 11px "IBM Plex Sans Thai", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`ผลรวมหากไม่แทรกช่องว่าง: ${m.separateSumHeight} px`, w - 16, sumY + 17);
    }

    // Container frame walls (open top)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(4, 12);
    ctx.lineTo(4, h - 4);
    ctx.lineTo(w - 4, h - 4);
    ctx.lineTo(w - 4, 12);
    ctx.stroke();
  }

  public dispose(): void {
    this.disposed = true;
    this.stopLoop();
  }
}
