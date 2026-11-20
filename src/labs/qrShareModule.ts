import QRCode from 'qrcode';
import { normalizeShareUrl } from '../logic/chemistryModel';

export class QrSharePanel {
  private canvas: HTMLCanvasElement;
  private urlInput: HTMLInputElement;
  private statusEl: HTMLElement;
  private copyBtn: HTMLButtonElement;
  private resetUrlBtn: HTMLButtonElement;
  private downloadBtn: HTMLButtonElement;
  private defaultUrl: string;
  private currentUrl: string;
  private copyTimer: number | null = null;

  constructor(elements: {
    canvas: HTMLCanvasElement;
    urlInput: HTMLInputElement;
    statusEl: HTMLElement;
    copyBtn: HTMLButtonElement;
    resetUrlBtn: HTMLButtonElement;
    downloadBtn: HTMLButtonElement;
    initialUrl?: string;
  }) {
    this.canvas = elements.canvas;
    this.urlInput = elements.urlInput;
    this.statusEl = elements.statusEl;
    this.copyBtn = elements.copyBtn;
    this.resetUrlBtn = elements.resetUrlBtn;
    this.downloadBtn = elements.downloadBtn;

    this.defaultUrl = normalizeShareUrl(
      elements.initialUrl ?? window.location.href,
      window.location.origin,
    );
    this.currentUrl = this.defaultUrl;
    this.urlInput.value = this.currentUrl;

    this.bindEvents();
    void this.renderQr(this.currentUrl);
  }

  private bindEvents(): void {
    this.urlInput.addEventListener('input', () => {
      const normalized = normalizeShareUrl(this.urlInput.value, this.defaultUrl);
      this.currentUrl = normalized;
      void this.renderQr(normalized);
    });

    this.resetUrlBtn.addEventListener('click', () => {
      this.currentUrl = this.defaultUrl;
      this.urlInput.value = this.defaultUrl;
      this.setStatus('รีเซ็ตเป็น URL ปัจจุบันแล้ว');
      void this.renderQr(this.currentUrl);
    });

    this.copyBtn.addEventListener('click', () => {
      void this.copyUrl();
    });

    this.downloadBtn.addEventListener('click', () => {
      this.downloadPng();
    });
  }

  public async renderQr(url: string): Promise<void> {
    try {
      await QRCode.toCanvas(this.canvas, url, {
        width: 196,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      this.canvas.dataset.qrUrl = url;
    } catch (err) {
      console.error('QR Code generation failed:', err);
      this.setStatus('ไม่สามารถสร้าง QR Code จาก URL นี้ได้');
    }
  }

  private async copyUrl(): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.currentUrl);
      } else {
        this.urlInput.select();
        document.execCommand('copy');
      }
      this.setStatus('คัดลอกลิงก์แล้ว ✓');
    } catch {
      this.setStatus('กรุณาคัดลอกลิงก์จากช่องข้อความด้านบน');
    }
  }

  private downloadPng(): void {
    try {
      const dataUrl = this.canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'chemistry-poe-qr.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
      this.setStatus('ดาวน์โหลดภาพ QR Code แล้ว');
    } catch (err) {
      console.error('QR PNG export failed:', err);
      this.setStatus('ไม่สามารถบันทึกภาพ QR Code ได้');
    }
  }

  private setStatus(msg: string): void {
    this.statusEl.textContent = msg;
    this.statusEl.hidden = false;
    if (this.copyTimer !== null) {
      window.clearTimeout(this.copyTimer);
    }
    this.copyTimer = window.setTimeout(() => {
      this.statusEl.hidden = true;
    }, 3000);
  }
}
