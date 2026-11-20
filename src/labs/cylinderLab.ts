import { LabStep } from '../logic/chemistryModel';

interface Bubble {
  xNorm: number;
  yMl: number;
  r: number;
  speed: number;
  alpha: number;
}

export interface CylinderLabCallbacks {
  onPhaseSettled?: () => void;
  onLiveVolumeChange?: (displayedMl: number) => void;
}

export class CylinderLabRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: CylinderLabCallbacks;

  private step: LabStep = 'empty';
  private isControlMode = false;
  private displayedMl = 0;
  private targetMl = 0;
  private mixProgress = 0; // 0..1 during mixing
  private pourAlpha = 0;
  private pourColor = '#38bdf8';
  private rafId: number | null = null;
  private lastTime = 0;
  private bubbles: Bubble[] = [];
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, callbacks: CylinderLabCallbacks = {}) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Cannot initialize 2D context for graduated cylinder');
    }
    this.ctx = context;
    this.callbacks = callbacks;
    this.resize();
  }

  public resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(320, Math.round(rect.width || 560));
    const h = Math.max(420, Math.round(rect.height || 520));
    if (this.canvas.width !== w * dpr || this.canvas.height !== h * dpr) {
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  public setState(step: LabStep, isControlMode: boolean, immediate = false): void {
    this.step = step;
    this.isControlMode = isControlMode;

    if (step === 'empty') {
      this.displayedMl = 0;
      this.targetMl = 0;
      this.mixProgress = 0;
      this.pourAlpha = 0;
      this.bubbles = [];
      this.stopLoop();
      this.callbacks.onLiveVolumeChange?.(0);
      this.draw();
      return;
    }

    if (step === 'water_added') {
      this.targetMl = 12.0;
      this.pourColor = '#38bdf8';
      if (immediate) {
        this.displayedMl = 12.0;
        this.pourAlpha = 0;
        this.stopLoop();
        this.callbacks.onLiveVolumeChange?.(12.0);
        this.draw();
      } else {
        this.pourAlpha = 1;
        this.spawnBubbles(8, 12.0);
        this.startLoop();
      }
      return;
    }

    if (step === 'mixing') {
      this.displayedMl = 12.0;
      this.targetMl = isControlMode ? 24.0 : 23.1;
      this.mixProgress = 0;
      this.pourAlpha = 1;
      this.pourColor = isControlMode ? '#38bdf8' : '#fbbf24';
      this.spawnBubbles(isControlMode ? 12 : 26, 23.5);
      if (immediate) {
        this.step = 'settled';
        this.displayedMl = this.targetMl;
        this.mixProgress = 1;
        this.pourAlpha = 0;
        this.bubbles = [];
        this.stopLoop();
        this.callbacks.onLiveVolumeChange?.(this.displayedMl);
        this.draw();
      } else {
        this.startLoop();
      }
      return;
    }

    if (step === 'settled') {
      this.targetMl = isControlMode ? 24.0 : 23.1;
      this.displayedMl = this.targetMl;
      this.mixProgress = 1;
      this.pourAlpha = 0;
      this.bubbles = [];
      this.stopLoop();
      this.callbacks.onLiveVolumeChange?.(this.displayedMl);
      this.draw();
    }
  }

  private spawnBubbles(count: number, maxMl: number): void {
    this.bubbles = [];
    for (let i = 0; i < count; i++) {
      this.bubbles.push({
        xNorm: 0.14 + Math.random() * 0.72,
        yMl: 2 + Math.random() * Math.max(4, maxMl - 3),
        r: 1.4 + Math.random() * 2.5,
        speed: 3.5 + Math.random() * 4.5,
        alpha: 0.45 + Math.random() * 0.45,
      });
    }
  }

  private startLoop(): void {
    if (this.rafId !== null || this.disposed) return;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      if (this.disposed) return;
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      const active = this.advance(dt);
      this.draw();
      if (active) {
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

  private advance(dt: number): boolean {
    if (this.step === 'water_added') {
      const diff = 12.0 - this.displayedMl;
      if (Math.abs(diff) > 0.04) {
        this.displayedMl += Math.min(diff, dt * 14);
        this.pourAlpha = Math.max(0, Math.min(1, diff / 2));
        this.updateBubbles(dt, this.displayedMl);
        this.callbacks.onLiveVolumeChange?.(this.displayedMl);
        return true;
      }
      this.displayedMl = 12.0;
      this.pourAlpha = 0;
      this.bubbles = [];
      this.callbacks.onLiveVolumeChange?.(12.0);
      this.callbacks.onPhaseSettled?.();
      return false;
    }

    if (this.step === 'mixing') {
      this.mixProgress = Math.min(1, this.mixProgress + dt / 2.2);
      if (this.isControlMode) {
        // Pour smoothly from 12.0 to 24.0
        const t = easeOutCubic(this.mixProgress);
        this.displayedMl = 12.0 + 12.0 * t;
        this.pourAlpha = this.mixProgress < 0.55 ? 1 - this.mixProgress / 0.55 : 0;
      } else {
        // Phase 1 (0..0.42): rises to 24.0 mL while pouring ethanol
        // Phase 2 (0.42..1.0): inversion mixing contraction down from 24.0 to 23.1 mL
        if (this.mixProgress < 0.42) {
          const p = easeOutCubic(this.mixProgress / 0.42);
          this.displayedMl = 12.0 + 12.0 * p;
          this.pourAlpha = 1 - (this.mixProgress / 0.42) * 0.65;
        } else {
          const p = easeInOutQuad((this.mixProgress - 0.42) / 0.58);
          this.displayedMl = 24.0 - 0.9 * p;
          this.pourAlpha = 0;
        }
      }

      this.updateBubbles(dt, this.displayedMl);
      this.callbacks.onLiveVolumeChange?.(this.displayedMl);

      if (this.mixProgress >= 1) {
        this.step = 'settled';
        this.displayedMl = this.isControlMode ? 24.0 : 23.1;
        this.pourAlpha = 0;
        this.bubbles = [];
        this.callbacks.onLiveVolumeChange?.(this.displayedMl);
        this.callbacks.onPhaseSettled?.();
        return false;
      }
      return true;
    }

    return false;
  }

  private updateBubbles(dt: number, maxMl: number): void {
    for (const b of this.bubbles) {
      b.yMl += b.speed * dt;
      if (b.yMl >= maxMl - 0.3) {
        b.yMl = 1.0 + Math.random() * Math.max(2, maxMl * 0.4);
      }
    }
  }

  public draw(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, rect.width || 560);
    const h = Math.max(420, rect.height || 520);
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // Subtle lab grid backdrop
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 24; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 24; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();

    // Cylinder geometry positioned slightly left so the Meniscus Magnifier sits cleanly on the right
    const isNarrow = w < 460;
    const cylWidth = isNarrow ? 94 : 116;
    const cylLeft = isNarrow ? Math.round(w * 0.14) : Math.round(w * 0.16);
    const cylRight = cylLeft + cylWidth;
    const cylTop = 44;
    const cylBottom = h - 48;
    const cylHeight = cylBottom - cylTop;
    const scaleTopY = cylTop + 34; // 25.0 mL line
    const scaleBottomY = cylBottom - 18; // 0.0 mL line

    const mlToY = (ml: number): number => {
      const clamped = Math.max(0, Math.min(26, ml));
      return scaleBottomY - (clamped / 25) * (scaleBottomY - scaleTopY);
    };

    // Draw pedestal shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
    ctx.beginPath();
    ctx.ellipse(
      cylLeft + cylWidth / 2,
      cylBottom + 18,
      cylWidth * 0.85,
      9,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Draw liquid column inside cylinder
    if (this.displayedMl > 0.01) {
      const topY = mlToY(this.displayedMl);
      const meniscusDip = 5.5;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cylLeft + 4, scaleBottomY + 12);
      ctx.lineTo(cylLeft + 4, topY - meniscusDip);
      ctx.quadraticCurveTo(
        cylLeft + cylWidth / 2,
        topY + meniscusDip,
        cylRight - 4,
        topY - meniscusDip,
      );
      ctx.lineTo(cylRight - 4, scaleBottomY + 12);
      ctx.closePath();

      const liqGrad = ctx.createLinearGradient(cylLeft, topY, cylRight, scaleBottomY);
      if (this.step === 'water_added') {
        liqGrad.addColorStop(0, 'rgba(56, 189, 248, 0.72)');
        liqGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.78)');
        liqGrad.addColorStop(1, 'rgba(2, 132, 199, 0.88)');
      } else if (this.isControlMode) {
        liqGrad.addColorStop(0, 'rgba(56, 189, 248, 0.75)');
        liqGrad.addColorStop(1, 'rgba(3, 105, 161, 0.90)');
      } else {
        // Water (blue-dyed) + ethanol gradient blending
        const blend = this.step === 'settled' ? 1 : this.mixProgress;
        liqGrad.addColorStop(0, blend > 0.7 ? 'rgba(56, 189, 248, 0.62)' : 'rgba(251, 191, 36, 0.55)');
        liqGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.72)');
        liqGrad.addColorStop(1, 'rgba(2, 132, 199, 0.88)');
      }
      ctx.fillStyle = liqGrad;
      ctx.fill();

      // Highlight the upper meniscus rim
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cylLeft + 4, topY - meniscusDip);
      ctx.quadraticCurveTo(
        cylLeft + cylWidth / 2,
        topY + meniscusDip,
        cylRight - 4,
        topY - meniscusDip,
      );
      ctx.stroke();

      // Draw gentle bubbles while mixing/pouring
      for (const b of this.bubbles) {
        const bx = cylLeft + 8 + b.xNorm * (cylWidth - 16);
        const by = mlToY(b.yMl);
        if (by > topY + 2 && by < scaleBottomY + 6) {
          ctx.fillStyle = `rgba(224, 242, 254, ${b.alpha})`;
          ctx.beginPath();
          ctx.arc(bx, by, b.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Draw pouring stream if pouring
    if (this.pourAlpha > 0.02) {
      ctx.save();
      const targetTopY = mlToY(this.displayedMl);
      const streamGrad = ctx.createLinearGradient(0, 0, 0, targetTopY);
      streamGrad.addColorStop(0, `${this.pourColor}cc`);
      streamGrad.addColorStop(1, `${this.pourColor}33`);
      ctx.strokeStyle = streamGrad;
      ctx.lineWidth = 5 * this.pourAlpha;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cylLeft + cylWidth * 0.5, 4);
      ctx.lineTo(cylLeft + cylWidth * 0.5, Math.max(20, targetTopY));
      ctx.stroke();
      ctx.restore();
    }

    // Highlight the missing 0.9 mL contraction band when settled in ethanol mode
    if (this.step === 'settled' && !this.isControlMode) {
      const y24 = mlToY(24.0);
      const y231 = mlToY(23.1);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
      ctx.fillRect(cylLeft + 3, y24, cylWidth - 6, y231 - y24);

      // Dashed amber reference at 24.0 mL
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cylLeft - 14, y24);
      ctx.lineTo(cylRight + 10, y24);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#fbbf24';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('24.0', cylLeft - 18, y24 + 4);
      ctx.font = '600 11px "IBM Plex Sans Thai", sans-serif';
      ctx.fillText('(-0.9 mL)', cylLeft - 18, y231 + 14);
    }

    // Draw graduated cylinder glass body
    ctx.save();
    // Base flange
    const baseGrad = ctx.createLinearGradient(cylLeft - 22, 0, cylRight + 22, 0);
    baseGrad.addColorStop(0, 'rgba(51, 65, 85, 0.85)');
    baseGrad.addColorStop(0.5, 'rgba(148, 163, 184, 0.55)');
    baseGrad.addColorStop(1, 'rgba(51, 65, 85, 0.85)');
    ctx.fillStyle = baseGrad;
    roundRect(ctx, cylLeft - 22, cylBottom + 4, cylWidth + 44, 15, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Cylinder walls + top lip
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cylLeft - 5, cylTop - 6);
    ctx.quadraticCurveTo(cylLeft, cylTop, cylLeft, cylTop + 10);
    ctx.lineTo(cylLeft, cylBottom + 4);
    ctx.lineTo(cylRight, cylBottom + 4);
    ctx.lineTo(cylRight, cylTop + 10);
    ctx.quadraticCurveTo(cylRight, cylTop, cylRight + 7, cylTop - 6);
    ctx.stroke();

    // Subtle glass vertical highlight
    const glassShine = ctx.createLinearGradient(cylLeft, 0, cylRight, 0);
    glassShine.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
    glassShine.addColorStop(0.18, 'rgba(255, 255, 255, 0.03)');
    glassShine.addColorStop(0.85, 'rgba(255, 255, 255, 0.01)');
    glassShine.addColorStop(1, 'rgba(255, 255, 255, 0.11)');
    ctx.fillStyle = glassShine;
    ctx.fillRect(cylLeft + 2, cylTop + 6, cylWidth - 4, cylHeight - 4);

    // Graduation ticks every 0.5 mL
    for (let v = 0; v <= 25; v += 0.5) {
      const y = mlToY(v);
      const isMajor = Math.abs(v % 5) < 0.01;
      const isOne = !isMajor && Math.abs(v % 1) < 0.01;
      const tickLen = isMajor ? 28 : isOne ? 16 : 9;

      ctx.strokeStyle = isMajor
        ? 'rgba(248, 250, 252, 0.9)'
        : isOne
          ? 'rgba(203, 213, 225, 0.7)'
          : 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = isMajor ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(cylLeft + 4, y);
      ctx.lineTo(cylLeft + 4 + tickLen, y);
      ctx.stroke();

      if (isMajor && v > 0) {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.92)';
        ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(String(v), cylLeft + 36, y + 3.5);
      }
    }

    // Cylinder label at top right
    ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('25 mL ±0.2', cylRight - 6, cylTop + 18);
    ctx.restore();

    // Draw Meniscus Magnifier (Zoomed Loupe) on the right side
    this.drawMeniscusMagnifier(
      ctx,
      w,
      h,
      cylRight,
      mlToY(this.displayedMl),
      isNarrow,
    );
  }

  private drawMeniscusMagnifier(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cylRight: number,
    targetY: number,
    isNarrow: boolean,
  ): void {
    const loupeRadius = isNarrow ? 74 : 94;
    const loupeX = Math.min(w - loupeRadius - 18, cylRight + loupeRadius + (isNarrow ? 34 : 76));
    const loupeY = Math.max(loupeRadius + 46, Math.min(h - loupeRadius - 56, targetY));

    // Leader line from meniscus level on main cylinder to magnifier center
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(cylRight + 4, targetY);
    ctx.lineTo(loupeX - loupeRadius - 4, loupeY);
    ctx.stroke();
    ctx.restore();

    // Outer title above magnifier
    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 12px "IBM Plex Sans Thai", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('แว่นขยายอ่านส่วนโค้งเว้า', loupeX, loupeY - loupeRadius - 22);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 11px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText('(ระดับสายตา · Eye Level)', loupeX, loupeY - loupeRadius - 7);
    ctx.restore();

    // Circular magnifier clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0b1220';
    ctx.fill();
    ctx.clip();

    // Magnified scale centered around displayedMl (span = ±1.4 mL)
    const centerMl = Math.max(0.8, this.displayedMl);
    const pxPerMl = (loupeRadius * 2) / 2.8;
    const zoomToY = (ml: number): number => loupeY - (ml - centerMl) * pxPerMl;

    // Liquid inside zoomed view (with concave meniscus bottom touching displayedMl!)
    if (this.displayedMl > 0.01) {
      const bottomMeniscusY = zoomToY(this.displayedMl);
      const wallLiftPx = 18;
      ctx.beginPath();
      ctx.moveTo(loupeX - loupeRadius, loupeY + loupeRadius);
      ctx.lineTo(loupeX - loupeRadius, bottomMeniscusY - wallLiftPx);
      ctx.quadraticCurveTo(
        loupeX,
        bottomMeniscusY + wallLiftPx,
        loupeX + loupeRadius,
        bottomMeniscusY - wallLiftPx,
      );
      ctx.lineTo(loupeX + loupeRadius, loupeY + loupeRadius);
      ctx.closePath();
      const zoomGrad = ctx.createLinearGradient(0, bottomMeniscusY - wallLiftPx, 0, loupeY + loupeRadius);
      zoomGrad.addColorStop(0, 'rgba(56, 189, 248, 0.42)');
      zoomGrad.addColorStop(1, 'rgba(2, 132, 199, 0.82)');
      ctx.fillStyle = zoomGrad;
      ctx.fill();

      // Meniscus curve rim
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(loupeX - loupeRadius, bottomMeniscusY - wallLiftPx);
      ctx.quadraticCurveTo(
        loupeX,
        bottomMeniscusY + wallLiftPx,
        loupeX + loupeRadius,
        bottomMeniscusY - wallLiftPx,
      );
      ctx.stroke();
    }

    // Missing 0.9 mL highlight band inside zoom when settled in ethanol mode
    if (this.step === 'settled' && !this.isControlMode) {
      const y24z = zoomToY(24.0);
      const y231z = zoomToY(23.1);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
      ctx.fillRect(loupeX - loupeRadius, y24z, loupeRadius * 2, y231z - y24z);

      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(loupeX - loupeRadius, y24z);
      ctx.lineTo(loupeX + loupeRadius, y24z);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#fbbf24';
      ctx.font = '600 10px "IBM Plex Sans Thai", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('ทฤษฎี 24.0 mL', loupeX + loupeRadius - 10, y24z - 4);
    }

    // Magnified graduation ticks (every 0.1 mL, labeled every 0.5 mL)
    const minTick = Math.max(0, Math.floor((centerMl - 1.5) * 10) / 10);
    const maxTick = Math.min(25, Math.ceil((centerMl + 1.5) * 10) / 10);
    for (let m = minTick; m <= maxTick + 0.001; m += 0.1) {
      const val = Math.round(m * 10) / 10;
      const y = zoomToY(val);
      const isWhole = Math.abs(val % 1) < 0.01;
      const isHalf = !isWhole && Math.abs((val * 2) % 1) < 0.01;
      const len = isWhole ? 44 : isHalf ? 30 : 14;

      ctx.strokeStyle = isWhole
        ? 'rgba(248, 250, 252, 0.9)'
        : isHalf
          ? 'rgba(203, 213, 225, 0.72)'
          : 'rgba(148, 163, 184, 0.38)';
      ctx.lineWidth = isWhole ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(loupeX - loupeRadius + 8, y);
      ctx.lineTo(loupeX - loupeRadius + 8 + len, y);
      ctx.stroke();

      if (isWhole || isHalf) {
        const label = val.toFixed(1);
        const labelX = loupeX - loupeRadius + 14 + len;
        ctx.fillStyle = 'rgba(11, 18, 32, 0.82)';
        roundRect(ctx, labelX - 3, y - 7, 34, 14, 3);
        ctx.fill();
        ctx.fillStyle = isWhole ? '#f8fafc' : '#cbd5e1';
        ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(label, labelX, y + 3.5);
      }
    }

    // Eye-level sight line touching the exact bottom of the meniscus
    if (this.displayedMl > 0.01) {
      const readingY = zoomToY(this.displayedMl);
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(loupeX - loupeRadius, readingY);
      ctx.lineTo(loupeX + loupeRadius, readingY);
      ctx.stroke();
      ctx.restore();

      // Small focal dot at meniscus bottom
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(loupeX, readingY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Magnifier glass bezel ring
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(loupeX, loupeY, loupeRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Digital readout badge right beneath the loupe
    const badgeY = loupeY + loupeRadius + 24;
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, loupeX - 72, badgeY - 16, 144, 32, 8);
    ctx.fill();
    ctx.strokeStyle = this.step === 'settled' && !this.isControlMode ? '#fbbf24' : '#334155';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 14px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`อ่านได้ ${this.displayedMl.toFixed(1)} mL`, loupeX, badgeY + 5);

    if (this.step === 'settled' && !this.isControlMode) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '600 12px "IBM Plex Sans Thai", sans-serif';
      ctx.fillText('ปริมาตรหายไป 0.9 mL!', loupeX, badgeY + 34);
    } else if (this.step === 'settled' && this.isControlMode) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 12px "IBM Plex Sans Thai", sans-serif';
      ctx.fillText('กรณีควบคุม: 24.0 mL พอดี', loupeX, badgeY + 34);
    }
    ctx.restore();
  }

  public dispose(): void {
    this.disposed = true;
    this.stopLoop();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
