import {
  canAccessTab,
  computeLabVolumes,
  createInitialLessonState,
  gradeQuiz,
  PoeLessonState,
  PREDICTION_OPTIONS,
  PredictionChoice,
  QUIZ_QUESTIONS,
  submitPrediction,
  TabId,
} from './logic/chemistryModel';
import { CylinderLabRenderer } from './labs/cylinderLab';
import { MacroBoxRenderer } from './labs/macroBoxLab';
import { QrSharePanel } from './labs/qrShareModule';
import { VolumeHistogramChart } from './labs/volumeHistogram';
import { getAllMoleculeScenes, MoleculeSceneSpec } from './logic/molecularData';
import { MolecularViewerGrid } from './viewers/molecular3d';

class ChemistryPoeApp {
  private root: HTMLElement;
  private state: PoeLessonState;
  private cylinderLab: CylinderLabRenderer | null = null;
  private macroLab: MacroBoxRenderer | null = null;
  private volumeHistogram: VolumeHistogramChart | null = null;
  private qrShare: QrSharePanel | null = null;
  private molecularGrid: MolecularViewerGrid | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = createInitialLessonState();

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      this.state.tab2Unlocked = true;
      this.state.predictionChoice = 'less';
      this.state.predictionReason = 'ทดสอบโหมดเริ่มต้นอัตโนมัติ';
      this.state.activeTab = 'observe';
    }

    this.renderShell();
    this.bindEvents();
    this.initCanvases();
    this.syncUI();
  }

  private renderShell(): void {
    const moleculeScenes = getAllMoleculeScenes();
    const sceneCaptions: Record<MoleculeSceneSpec['id'], string> = {
      water_before:
        'โมเลกุล H₂O มีขนาดเล็ก อยู่กันค่อนข้างชิดด้วยช่องว่างขนาดเล็ก',
      ethanol_before:
        'โมเลกุล C₂H₅OH มีสายโซ่คาร์บอนใหญ่และเกะกะ ทำให้มีช่องว่างระหว่างโมเลกุลกว้าง',
      compare_pair:
        'แสดงโครงสร้าง ball-and-stick ซ้อนขอบเขตทรงกลมโปร่งแสงเพื่อเทียบขนาดจริง',
      hbond_after:
        'หมู่ -OH ของแอลกอฮอล์หันเข้าหา O ของน้ำ เกิดพันธะไฮโดรเจน (เส้นประสีเหลือง) ดึงให้ชิดกัน',
    };

    this.root.innerHTML = `
      <div class="app-shell">
        <header class="topbar">
          <div class="topbar-inner">
            <div class="brand-mark">
              <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M9 3h6M10 3v5l-4.5 9.2A2 2 0 0 0 7.3 20h9.4a2 2 0 0 0 1.8-2.8L14 8V3" />
                <path d="M7.5 14h9" />
              </svg>
              <span>เคมี ม.5 · ไขปริศนาปริมาตรที่หายไป</span>
            </div>

            <nav class="poe-nav" role="tablist" aria-label="ขั้นตอนการเรียนรู้ POE">
              <button type="button" role="tab" class="poe-tab" data-tab="predict" id="tab-btn-predict" aria-selected="true">
                1. ขั้นทำนาย
              </button>
              <button type="button" role="tab" class="poe-tab" data-tab="observe" id="tab-btn-observe" aria-selected="false">
                2. ขั้นสังเกต
              </button>
              <button type="button" role="tab" class="poe-tab" data-tab="explain" id="tab-btn-explain" aria-selected="false">
                3. ขั้นอธิบาย
              </button>
              <button type="button" role="tab" class="poe-tab" data-tab="evaluate" id="tab-btn-evaluate" aria-selected="false">
                4. ขั้นประเมิน
              </button>
            </nav>

            <button type="button" class="topbar-action" id="btn-global-reset">
              รีเซ็ตบทเรียน
            </button>
          </div>
        </header>

        <main class="main-content">
          <!-- TAB 1: PREDICT -->
          <section class="tab-panel" id="panel-predict" role="tabpanel" aria-labelledby="tab-btn-predict">
            <div class="section-header">
              <p class="section-kicker">ขั้นตอนที่ 1 จาก 4 · Predict</p>
              <h1 class="section-title">ขั้นทำนาย: เกิดอะไรขึ้นเมื่อผสมน้ำกับเอทิลแอลกอฮอล์ 95%?</h1>
              <p class="section-subtitle">
                กำหนดสมมติฐานก่อนลงมือทดลองในห้องปฏิบัติการเสมือนจริง
              </p>
            </div>

            <div class="card">
              <div class="card-subtle">
                <strong>สถานการณ์ทดลอง:</strong>
                ตวง<strong>น้ำดื่ม (หยดสีผสมอาหารสีฟ้า)</strong> ปริมาตร <span class="mono">12.0 mL</span>
                ผสมกับ<strong>เอทิลแอลกอฮอล์ 95%</strong> ปริมาตร <span class="mono">12.0 mL</span>
                ลงในกระบอกตวงขนาด <span class="mono">25 mL</span> แล้วผสมให้เข้ากันเบาๆ
                นักเรียนคิดว่า <strong>ปริมาตรรวมสุดท้าย</strong> จะเป็นอย่างไร?
              </div>

              <div class="predict-grid" id="prediction-choices">
                ${PREDICTION_OPTIONS.map(
                  (opt, idx) => `
                  <button
                    type="button"
                    class="vote-card"
                    data-choice="${opt.id}"
                    aria-pressed="false"
                  >
                    <span class="vote-card-index">ตัวเลือกที่ ${idx + 1}</span>
                    <span class="vote-card-title">${opt.title}</span>
                    <span class="vote-card-desc">${opt.subtitle}</span>
                  </button>
                `,
                ).join('')}
              </div>

              <div>
                <label class="field-label" for="prediction-reason">
                  เหตุผลประกอบสมมติฐานของฉัน
                </label>
                <textarea
                  id="prediction-reason"
                  class="reason-textarea"
                  placeholder="พิมพ์เหตุผลทางวิทยาศาสตร์ที่สนับสนุนคำทำนายของนักเรียน เช่น ขนาดของโมเลกุล หรือแรงดึงดูดระหว่างโมเลกุล..."
                ></textarea>
              </div>

              <div id="predict-error" class="form-error" hidden></div>

              <div style="margin-top: 18px; display: flex; justify-content: flex-end;">
                <button type="button" class="btn-primary" id="btn-save-prediction">
                  บันทึกคำทำนายและไปขั้นทดลอง
                </button>
              </div>
            </div>
          </section>

          <!-- TAB 2: OBSERVE (VIRTUAL LAB) -->
          <section class="tab-panel" id="panel-observe" role="tabpanel" aria-labelledby="tab-btn-observe">
            <div class="section-header">
              <p class="section-kicker">ขั้นตอนที่ 2 จาก 4 · Observe</p>
              <h1 class="section-title">ขั้นสังเกตและทดลองจำลอง: กระบอกตวง 25 mL</h1>
              <p class="section-subtitle">
                สังเกตระดับส่วนโค้งเว้า (Meniscus) ในระดับสายตาจากแว่นขยาย และเปรียบเทียบกับกรณีควบคุม
              </p>
            </div>

            <div class="two-col-lab">
              <div class="card">
                <div class="canvas-stage">
                  <canvas id="cylinder-canvas" data-testid="cylinder-canvas"></canvas>
                </div>
              </div>

              <div class="controls-stack">
                <div class="card">
                  <h2 style="margin: 0 0 12px; font-size: 1.1rem;">แผงควบคุมการทดลอง</h2>

                  <div class="action-row" style="margin-bottom: 14px;">
                    <button type="button" class="btn-primary" id="btn-measure-water">
                      ตวงน้ำ 12.0 mL
                    </button>
                    <button type="button" class="btn-amber" id="btn-add-second" disabled>
                      เติมเอทิลแอลกอฮอล์ 95% 12.0 mL
                    </button>
                    <button type="button" class="btn-secondary" id="btn-reset-cylinder">
                      ล้างกระบอกตวง
                    </button>
                  </div>

                  <div class="toggle-row">
                    <div>
                      <div class="toggle-label-title">เปรียบเทียบกรณีควบคุม: น้ำ 12.0 mL + น้ำ 12.0 mL</div>
                      <div class="toggle-label-sub">
                        สลับเพื่อทดสอบการผสมสารชนิดเดียวกันว่าได้ปริมาตรรวมเท่าใด
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked="false"
                      aria-label="เปรียบเทียบกรณีควบคุม: น้ำ 12.0 mL + น้ำ 12.0 mL"
                      class="switch-btn"
                      id="toggle-control-mode"
                    >
                      <span class="switch-thumb"></span>
                    </button>
                  </div>
                </div>

                <div class="card">
                  <h2 style="margin: 0 0 12px; font-size: 1.1rem;">สรุปผลการวัดปริมาตร</h2>
                  <div class="metrics-grid">
                    <div class="metric-box">
                      <div class="metric-label">ปริมาตรตามทฤษฎี</div>
                      <div class="metric-value mono" id="readout-theoretical">0.0 mL</div>
                    </div>
                    <div class="metric-box">
                      <div class="metric-label">ปริมาตรจริงที่วัดได้</div>
                      <div class="metric-value mono is-cyan" id="readout-actual">0.0 mL</div>
                    </div>
                    <div class="metric-box">
                      <div class="metric-label">การหดตัวของปริมาตร</div>
                      <div class="metric-value mono is-amber" id="readout-contraction">0.0 mL</div>
                    </div>
                  </div>

                  <div id="lab-status-note" class="card-subtle" style="margin-top: 14px;">
                    ขั้นตอนที่ 1: กดปุ่ม <strong>"ตวงน้ำ 12.0 mL"</strong> เพื่อเริ่มการทดลอง
                  </div>

                  <div id="prediction-recall" class="card-subtle" style="margin-top: 12px; font-size: 0.92rem;"></div>

                  <div style="margin-top: 16px; display: flex; justify-content: flex-end;">
                    <button type="button" class="btn-primary" id="btn-goto-explain">
                      ไปขั้นอธิบายด้วยแบบจำลอง
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="card histogram-card">
              <div class="histogram-header">
                <div>
                  <h2 style="margin: 0 0 4px; font-size: 1.12rem;">
                    แผนภูมิฮิสโทแกรมเปรียบเทียบปริมาตรก่อนและหลังผสม (D3.js)
                  </h2>
                  <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
                    เปรียบเทียบปริมาตรสารตั้งต้น ผลรวมตามทฤษฎี (<span class="mono">24.0 mL</span>) และปริมาตรจริงหลังผสม (ชี้ที่แท่งกราฟเพื่อดูรายละเอียด)
                  </p>
                </div>
              </div>
              <div
                class="d3-histogram-host"
                id="volume-histogram-host"
                data-testid="volume-histogram-host"
              ></div>
            </div>
          </section>

          <!-- TAB 3: EXPLAIN (MACRO + 3D MICRO MODELS) -->
          <section class="tab-panel" id="panel-explain" role="tabpanel" aria-labelledby="tab-btn-explain">
            <div class="section-header">
              <p class="section-kicker">ขั้นตอนที่ 3 จาก 4 · Explain</p>
              <h1 class="section-title">ขั้นอธิบายด้วยแบบจำลองระดับมหภาคและโมเลกุล 3 มิติ</h1>
              <p class="section-subtitle">
                เชื่อมโยงแบบจำลองอุปมาอุปไมยสู่โครงสร้างโมเลกุล 3 มิติและพันธะไฮโดรเจน
              </p>
            </div>

            <div class="explain-stack">
              <!-- PART A: MACRO ANALOGY -->
              <div class="card">
                <h2 style="margin: 0 0 6px; font-size: 1.18rem;">
                  ส่วนที่ 1: แบบจำลองอุปมาอุปไมย (Macro-analogy)
                </h2>
                <p style="margin: 0 0 14px; color: var(--text-secondary); font-size: 0.95rem;">
                  ทดลองเทอนุภาคขนาดใหญ่และขนาดเล็กรวมกัน เพื่อสังเกตว่าเหตุใดระดับความสูงรวมจึงน้อยกว่าผลบวกเมื่อแยกกันอยู่
                </p>

                <div class="two-col-lab">
                  <div class="canvas-stage">
                    <canvas id="macro-canvas" data-testid="macro-canvas"></canvas>
                  </div>

                  <div class="controls-stack">
                    <div class="action-row">
                      <button type="button" class="btn-amber" id="btn-pour-pingpong">
                        เทลูกปิงปอง (แทนโมเลกุลแอลกอฮอล์ขนาดใหญ่)
                      </button>
                      <button type="button" class="btn-primary" id="btn-pour-mungbean">
                        เทเมล็ดถั่วเขียว (แทนโมเลกุลน้ำขนาดเล็ก)
                      </button>
                    </div>
                    <div class="action-row">
                      <button type="button" class="btn-secondary" id="btn-shake-macro">
                        เขย่าเบาๆ ให้แทรกช่องว่าง
                      </button>
                      <button type="button" class="btn-secondary" id="btn-reset-macro">
                        เทใหม่ (รีเซ็ต)
                      </button>
                    </div>

                    <div class="metrics-grid">
                      <div class="metric-box">
                        <div class="metric-label">ลูกปิงปอง (แอลกอฮอล์)</div>
                        <div class="metric-value mono is-amber" id="macro-count-big">0 ลูก</div>
                      </div>
                      <div class="metric-box">
                        <div class="metric-label">เมล็ดถั่วเขียว (น้ำ)</div>
                        <div class="metric-value mono is-emerald" id="macro-count-small">0 เมล็ด</div>
                      </div>
                      <div class="metric-box">
                        <div class="metric-label">ระดับที่ยุบลง (แทรกช่องว่าง)</div>
                        <div class="metric-value mono is-cyan" id="macro-saved-height">0 px</div>
                      </div>
                    </div>

                    <div class="card-subtle" style="font-size: 0.92rem; color: var(--text-secondary);">
                      <strong>ข้อสังเกตสำคัญ:</strong> เมล็ดถั่วเขียวขนาดเล็กไม่ได้เพิ่มความสูงเต็มชั้นเหมือนตอนวางแยกกัน แต่ไหลแทรกเข้าไปเติมเต็ม<strong>ช่องว่าง (Interstitial Spaces)</strong> ระหว่างลูกปิงปองสีส้ม ทำให้ระดับความสูงรวมลดลงอย่างชัดเจน
                    </div>
                  </div>
                </div>
              </div>

              <!-- PART B: 3D MOLECULAR VIEWER -->
              <div class="card">
                <div class="molecular-header-bar">
                  <div>
                    <h2 style="margin: 0 0 4px; font-size: 1.18rem;">
                      ส่วนที่ 2: แบบจำลองโมเลกุล 3 มิติ (หมุน-ซูมได้อิสระ)
                    </h2>
                    <div class="atom-legend">
                      <span class="legend-item">
                        <span class="legend-swatch" style="background-color: #ef4444;"></span>
                        O (ออกซิเจน) = สีแดง
                      </span>
                      <span class="legend-item">
                        <span class="legend-swatch" style="background-color: #94a3b8;"></span>
                        C (คาร์บอน) = สีเทา
                      </span>
                      <span class="legend-item">
                        <span class="legend-swatch" style="background-color: #f8fafc;"></span>
                        H (ไฮโดรเจน) = สีขาว
                      </span>
                      <span class="legend-item">
                        <span class="legend-dash"></span>
                        พันธะไฮโดรเจน (H-bond)
                      </span>
                    </div>
                  </div>
                  <button type="button" class="btn-secondary" id="btn-reset-3d-views">
                    รีเซ็ตมุมมอง 3 มิติ
                  </button>
                </div>

                <div class="molecular-grid" id="molecular-grid" data-renderer="pending">
                  ${moleculeScenes
                    .map(
                      (scene) => `
                    <article class="viewport-card">
                      <h3 class="viewport-title">${scene.title}</h3>
                      <div
                        class="mol-canvas-host"
                        id="mol-host-${scene.id}"
                        data-testid="mol-host-${scene.id}"
                      ></div>
                      <p class="viewport-caption">${sceneCaptions[scene.id]}</p>
                    </article>
                  `,
                    )
                    .join('')}
                </div>
              </div>

              <!-- CONCEPTUAL CALLOUTS -->
              <div class="callouts-grid">
                <article class="callout-card">
                  <div class="callout-number">แนวคิดที่ 1</div>
                  <h3 class="callout-title">ขนาดโมเลกุลและช่องว่าง</h3>
                  <p class="callout-body">
                    โมเลกุล <span class="mono">C₂H₅OH</span> มีขนาดใหญ่และมีหมู่เอทิลเกะกะกว่า <span class="mono">H₂O</span> มาก ทำให้ระหว่างโมเลกุลแอลกอฮอล์มีช่องว่างขนาดใหญ่ เมื่อผสมกัน โมเลกุลน้ำขนาดเล็กจึงแทรกเข้าสู่ช่องว่างเหล่านี้ได้
                  </p>
                </article>
                <article class="callout-card">
                  <div class="callout-number">แนวคิดที่ 2</div>
                  <h3 class="callout-title">พันธะไฮโดรเจนระหว่างหมู่ -OH</h3>
                  <p class="callout-body">
                    ทั้งน้ำและเอทิลแอลกอฮอล์ต่างมีหมู่ไฮดรอกซิล (<span class="mono">-OH</span>) จึงเกิด<strong>พันธะไฮโดรเจน</strong>ระหว่างกันอย่างแข็งแรง ดึงดูดให้โมเลกุลทั้งสองชนิดเข้าใกล้กันมากกว่าเดิม
                  </p>
                </article>
                <article class="callout-card">
                  <div class="callout-number">แนวคิดที่ 3</div>
                  <h3 class="callout-title">ผลต่อความหนาแน่นและการเตรียมสารละลาย % v/v</h3>
                  <p class="callout-body">
                    เมื่อ <span class="mono">V</span> รวมลดลง แต่มวล <span class="mono">m</span> คงที่ ความหนาแน่น <span class="mono">D = m/V</span> จึงสูงกว่าค่าเฉลี่ยเชิงเส้น และในการเตรียมสารละลาย <span class="mono">% v/v</span> ต้องปรับปริมาตรให้ครบด้วยน้ำในขวดวัดปริมาตร ไม่ใช่นำปริมาตรมาบวกกันตรงๆ
                  </p>
                </article>
              </div>

              <div style="display: flex; justify-content: flex-end;">
                <button type="button" class="btn-primary" id="btn-goto-evaluate">
                  ไปขั้นประเมินและท้าทายความคิด
                </button>
              </div>
            </div>
          </section>

          <!-- TAB 4: EVALUATE -->
          <section class="tab-panel" id="panel-evaluate" role="tabpanel" aria-labelledby="tab-btn-evaluate">
            <div class="section-header">
              <p class="section-kicker">ขั้นตอนที่ 4 จาก 4 · Evaluate</p>
              <h1 class="section-title">ขั้นประเมินและท้าทายความคิด</h1>
              <p class="section-subtitle">
                ตอบคำถามทั้ง 3 ข้อเพื่อตรวจสอบความเข้าใจ พร้อมรับคำอธิบายทันทีหลังเลือกคำตอบ
              </p>
            </div>

            <div class="quiz-list" id="quiz-container">
              ${QUIZ_QUESTIONS.map(
                (q) => `
                <article class="quiz-card" data-question-id="${q.id}">
                  <h2 class="quiz-prompt">ข้อที่ ${q.number}. ${q.prompt}</h2>
                  <div class="quiz-choices">
                    ${q.choices
                      .map(
                        (c) => `
                      <button
                        type="button"
                        class="quiz-choice-btn"
                        data-qid="${q.id}"
                        data-cid="${c.id}"
                      >
                        <span class="mono" style="font-weight: 700;">${c.id.toUpperCase()}.</span>
                        <span>${c.label}</span>
                      </button>
                    `,
                      )
                      .join('')}
                  </div>
                  <div class="quiz-feedback" id="feedback-${q.id}" hidden></div>
                </article>
              `,
              ).join('')}
            </div>

            <div class="score-summary" id="quiz-summary" hidden>
              <div>
                <div style="font-size: 0.9rem; color: var(--text-muted);">สรุปผลการประเมินความเข้าใจ</div>
                <div style="font-size: 1.45rem; font-weight: 700;" class="tabular-nums" id="quiz-score-text">
                  คะแนนรวม 0 / 3 ข้อ
                </div>
                <div style="font-size: 0.94rem; color: var(--text-secondary);" id="quiz-score-message"></div>
              </div>
              <button type="button" class="btn-primary" id="btn-quiz-reset">
                รีเซ็ตบทเรียน
              </button>
            </div>

            <div class="card qr-share-card" id="qr-share-section">
              <div class="qr-share-layout">
                <div class="qr-box">
                  <canvas
                    id="qr-code-canvas"
                    data-testid="qr-code-canvas"
                    aria-label="QR Code สำหรับเปิดบทเรียนบนสมาร์ตโฟน"
                  ></canvas>
                </div>

                <div class="qr-details">
                  <h2 style="margin: 0 0 6px; font-size: 1.15rem;">
                    แชร์บทเรียนให้นักเรียนสแกนเปิดบนสมาร์ตโฟน (QR Code)
                  </h2>
                  <p style="margin: 0 0 14px; color: var(--text-secondary); font-size: 0.94rem;">
                    นักเรียนสามารถใช้กล้องมือถือสแกน QR Code ด้านข้างเพื่อเปิดใช้งานห้องทดลองจำลองนี้บนอุปกรณ์ของตนเองได้ทันที หรืออาจารย์สามารถวางลิงก์ Shared URL ที่ต้องการสร้าง QR Code ใหม่ได้
                  </p>

                  <label class="field-label" for="qr-url-input" style="font-size: 0.9rem;">
                    ลิงก์ URL ของเว็บไซต์บทเรียน
                  </label>
                  <div class="qr-input-row">
                    <input
                      type="url"
                      id="qr-url-input"
                      class="qr-url-input mono"
                      placeholder="https://..."
                    />
                    <button type="button" class="btn-secondary" id="btn-qr-reset-url">
                      ใช้ URL ปัจจุบัน
                    </button>
                  </div>

                  <div class="action-row" style="margin-top: 12px;">
                    <button type="button" class="btn-primary" id="btn-qr-copy">
                      คัดลอกลิงก์
                    </button>
                    <button type="button" class="btn-amber" id="btn-qr-download">
                      ดาวน์โหลด QR Code (PNG)
                    </button>
                  </div>

                  <div class="qr-status-msg" id="qr-status-msg" hidden></div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    `;
  }

  private initCanvases(): void {
    const cylinderCanvas = this.root.querySelector<HTMLCanvasElement>('#cylinder-canvas');
    if (cylinderCanvas) {
      this.cylinderLab = new CylinderLabRenderer(cylinderCanvas, {
        onLiveVolumeChange: (ml) => {
          const actualEl = this.root.querySelector('#readout-actual');
          if (actualEl) actualEl.textContent = `${ml.toFixed(1)} mL`;
          if (this.state.labStep === 'mixing') {
            this.volumeHistogram?.update(
              this.state.labStep,
              this.state.isControlMode,
              ml,
              false,
            );
          }
        },
        onPhaseSettled: () => {
          if (this.state.labStep === 'mixing') {
            this.state.labStep = 'settled';
            this.syncLabReadouts();
          }
        },
      });
    }

    const histogramHost = this.root.querySelector<HTMLElement>('#volume-histogram-host');
    if (histogramHost) {
      this.volumeHistogram = new VolumeHistogramChart(histogramHost);
    }

    const macroCanvas = this.root.querySelector<HTMLCanvasElement>('#macro-canvas');
    if (macroCanvas) {
      this.macroLab = new MacroBoxRenderer(macroCanvas, {
        onMetricsUpdate: (m) => {
          const bigEl = this.root.querySelector('#macro-count-big');
          const smallEl = this.root.querySelector('#macro-count-small');
          const savedEl = this.root.querySelector('#macro-saved-height');
          if (bigEl) bigEl.textContent = `${m.ethanolCount} ลูก`;
          if (smallEl) smallEl.textContent = `${m.waterCount} เมล็ด`;
          if (savedEl) savedEl.textContent = `${m.savedHeight} px`;
        },
      });
    }

    const containers = new Map<MoleculeSceneSpec['id'], HTMLElement>();
    for (const scene of getAllMoleculeScenes()) {
      const host = this.root.querySelector<HTMLElement>(`#mol-host-${scene.id}`);
      if (host) containers.set(scene.id, host);
    }

    this.molecularGrid = new MolecularViewerGrid(containers, (backend) => {
      const gridEl = this.root.querySelector<HTMLElement>('#molecular-grid');
      if (gridEl) gridEl.dataset.renderer = backend;
    });

    const qrCanvas = this.root.querySelector<HTMLCanvasElement>('#qr-code-canvas');
    const qrUrlInput = this.root.querySelector<HTMLInputElement>('#qr-url-input');
    const qrStatusEl = this.root.querySelector<HTMLElement>('#qr-status-msg');
    const qrCopyBtn = this.root.querySelector<HTMLButtonElement>('#btn-qr-copy');
    const qrResetBtn = this.root.querySelector<HTMLButtonElement>('#btn-qr-reset-url');
    const qrDownloadBtn = this.root.querySelector<HTMLButtonElement>('#btn-qr-download');
    if (qrCanvas && qrUrlInput && qrStatusEl && qrCopyBtn && qrResetBtn && qrDownloadBtn) {
      this.qrShare = new QrSharePanel({
        canvas: qrCanvas,
        urlInput: qrUrlInput,
        statusEl: qrStatusEl,
        copyBtn: qrCopyBtn,
        resetUrlBtn: qrResetBtn,
        downloadBtn: qrDownloadBtn,
      });
    }

    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    this.cylinderLab?.resize();
    this.volumeHistogram?.resize();
    this.macroLab?.resize();
    if (this.state.activeTab === 'explain') {
      this.molecularGrid?.resizeAll();
    }
  };

  private bindEvents(): void {
    // Top navigation tabs
    this.root.querySelectorAll<HTMLButtonElement>('.poe-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as TabId;
        if (!canAccessTab(this.state, tab)) return;
        this.switchTab(tab);
      });
    });

    // Global reset & Quiz reset
    this.root.querySelector('#btn-global-reset')?.addEventListener('click', () => {
      this.resetLesson();
    });
    this.root.querySelector('#btn-quiz-reset')?.addEventListener('click', () => {
      this.resetLesson();
    });

    // Tab 1: Prediction voting cards
    this.root.querySelectorAll<HTMLButtonElement>('.vote-card').forEach((card) => {
      card.addEventListener('click', () => {
        this.state.predictionChoice = card.dataset.choice as PredictionChoice;
        const errEl = this.root.querySelector<HTMLElement>('#predict-error');
        if (errEl) errEl.hidden = true;
        this.syncPredictionCards();
      });
    });

    this.root
      .querySelector<HTMLTextAreaElement>('#prediction-reason')
      ?.addEventListener('input', (e) => {
        this.state.predictionReason = (e.target as HTMLTextAreaElement).value;
        const errEl = this.root.querySelector<HTMLElement>('#predict-error');
        if (errEl) errEl.hidden = true;
      });

    this.root.querySelector('#btn-save-prediction')?.addEventListener('click', () => {
      const reasonInput = this.root.querySelector<HTMLTextAreaElement>('#prediction-reason');
      const reasonText = reasonInput?.value ?? this.state.predictionReason;
      const result = submitPrediction(this.state, this.state.predictionChoice, reasonText);
      const errEl = this.root.querySelector<HTMLElement>('#predict-error');

      if (!result.ok) {
        if (errEl) {
          errEl.textContent = result.error ?? 'กรุณากรอกข้อมูลให้ครบถ้วน';
          errEl.hidden = false;
        }
        return;
      }

      if (errEl) errEl.hidden = true;
      this.state = result.nextState;
      this.syncUI();
      this.cylinderLab?.resize();
    });

    // Tab 2: Virtual Lab controls
    this.root.querySelector('#btn-measure-water')?.addEventListener('click', () => {
      this.state.labStep = 'water_added';
      this.cylinderLab?.setState('water_added', this.state.isControlMode);
      this.syncLabReadouts();
    });

    this.root.querySelector('#btn-add-second')?.addEventListener('click', () => {
      if (this.state.labStep !== 'water_added') return;
      this.state.labStep = 'mixing';
      this.cylinderLab?.setState('mixing', this.state.isControlMode);
      this.syncLabReadouts();
    });

    this.root.querySelector('#btn-reset-cylinder')?.addEventListener('click', () => {
      this.state.labStep = 'empty';
      this.cylinderLab?.setState('empty', this.state.isControlMode, true);
      this.syncLabReadouts();
    });

    this.root.querySelector('#toggle-control-mode')?.addEventListener('click', () => {
      this.state.isControlMode = !this.state.isControlMode;
      // If already mixed/settled, replay smoothly or reset to water_added so student sees the difference
      if (this.state.labStep === 'settled' || this.state.labStep === 'mixing') {
        this.state.labStep = 'mixing';
        this.cylinderLab?.setState('mixing', this.state.isControlMode);
      } else {
        this.cylinderLab?.setState(this.state.labStep, this.state.isControlMode, true);
      }
      this.syncLabReadouts();
    });

    this.root.querySelector('#btn-goto-explain')?.addEventListener('click', () => {
      this.switchTab('explain');
    });

    // Tab 3: Macro analogy & 3D viewers
    this.root.querySelector('#btn-pour-pingpong')?.addEventListener('click', () => {
      this.macroLab?.addPingPongBalls();
    });
    this.root.querySelector('#btn-pour-mungbean')?.addEventListener('click', () => {
      this.macroLab?.addMungBeans();
    });
    this.root.querySelector('#btn-shake-macro')?.addEventListener('click', () => {
      this.macroLab?.shake();
    });
    this.root.querySelector('#btn-reset-macro')?.addEventListener('click', () => {
      this.macroLab?.reset();
    });
    this.root.querySelector('#btn-reset-3d-views')?.addEventListener('click', () => {
      this.molecularGrid?.resetAllViews();
    });
    this.root.querySelector('#btn-goto-evaluate')?.addEventListener('click', () => {
      this.switchTab('evaluate');
    });

    // Tab 4: Quiz choices
    this.root.querySelectorAll<HTMLButtonElement>('.quiz-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        const cid = btn.dataset.cid;
        if (!qid || !cid) return;
        this.state.quizAnswers[qid] = cid;
        this.syncQuiz();
      });
    });
  }

  private switchTab(tab: TabId): void {
    if (!canAccessTab(this.state, tab)) return;
    this.state.activeTab = tab;
    this.syncUI();

    if (tab === 'observe') {
      requestAnimationFrame(() => {
        this.cylinderLab?.resize();
        this.volumeHistogram?.resize();
      });
    } else if (tab === 'explain') {
      requestAnimationFrame(() => {
        this.macroLab?.resize();
        void this.molecularGrid?.ensureInitialized();
      });
    }
  }

  private resetLesson(): void {
    this.state = createInitialLessonState();
    const reasonInput = this.root.querySelector<HTMLTextAreaElement>('#prediction-reason');
    if (reasonInput) reasonInput.value = '';
    const errEl = this.root.querySelector<HTMLElement>('#predict-error');
    if (errEl) errEl.hidden = true;
    this.cylinderLab?.setState('empty', false, true);
    this.macroLab?.reset();
    this.syncUI();
  }

  private syncUI(): void {
    document.body.dataset.activeTab = this.state.activeTab;
    document.body.dataset.tab2Unlocked = String(this.state.tab2Unlocked);

    // Sync nav tabs
    this.root.querySelectorAll<HTMLButtonElement>('.poe-tab').forEach((btn) => {
      const tab = btn.dataset.tab as TabId;
      const accessible = canAccessTab(this.state, tab);
      const isActive = this.state.activeTab === tab;
      btn.disabled = !accessible;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });

    // Sync panels
    const tabs: TabId[] = ['predict', 'observe', 'explain', 'evaluate'];
    for (const tab of tabs) {
      const panel = this.root.querySelector<HTMLElement>(`#panel-${tab}`);
      if (panel) {
        panel.classList.toggle('is-active', this.state.activeTab === tab);
      }
    }

    this.syncPredictionCards();
    this.syncLabReadouts();
    this.syncQuiz();
  }

  private syncPredictionCards(): void {
    this.root.querySelectorAll<HTMLButtonElement>('.vote-card').forEach((card) => {
      const selected = card.dataset.choice === this.state.predictionChoice;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
  }

  private syncLabReadouts(): void {
    const vol = computeLabVolumes(this.state.labStep, this.state.isControlMode);

    const theoEl = this.root.querySelector('#readout-theoretical');
    const actualEl = this.root.querySelector('#readout-actual');
    const contractEl = this.root.querySelector('#readout-contraction');

    if (theoEl) theoEl.textContent = `${vol.theoreticalMl.toFixed(1)} mL`;
    if (actualEl && this.state.labStep !== 'mixing') {
      actualEl.textContent = `${vol.actualMl.toFixed(1)} mL`;
    }
    if (contractEl) {
      if (this.state.labStep === 'settled') {
        contractEl.textContent =
          vol.contractionMl < 0
            ? `${vol.contractionMl.toFixed(1)} mL`
            : '0.0 mL';
      } else {
        contractEl.textContent = '0.0 mL';
      }
    }

    const btnMeasure = this.root.querySelector<HTMLButtonElement>('#btn-measure-water');
    const btnSecond = this.root.querySelector<HTMLButtonElement>('#btn-add-second');
    const toggleBtn = this.root.querySelector<HTMLButtonElement>('#toggle-control-mode');

    if (btnMeasure) {
      btnMeasure.disabled = this.state.labStep !== 'empty';
    }
    if (btnSecond) {
      btnSecond.disabled = this.state.labStep !== 'water_added';
      btnSecond.textContent = this.state.isControlMode
        ? 'เติมน้ำดื่มเพิ่ม 12.0 mL (กรณีควบคุม)'
        : 'เติมเอทิลแอลกอฮอล์ 95% 12.0 mL';
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-checked', String(this.state.isControlMode));
    }

    const noteEl = this.root.querySelector('#lab-status-note');
    if (noteEl) {
      if (this.state.labStep === 'empty') {
        noteEl.innerHTML =
          'ขั้นตอนที่ 1: กดปุ่ม <strong>"ตวงน้ำ 12.0 mL"</strong> เพื่อเริ่มตวงน้ำดื่มลงในกระบอกตวง';
      } else if (this.state.labStep === 'water_added') {
        noteEl.innerHTML = this.state.isControlMode
          ? 'ตวงน้ำ 12.0 mL แล้ว · กด <strong>"เติมน้ำดื่มเพิ่ม 12.0 mL"</strong> เพื่อทดสอบกรณีควบคุม'
          : 'ตวงน้ำ 12.0 mL แล้ว · กด <strong>"เติมเอทิลแอลกอฮอล์ 95% 12.0 mL"</strong> แล้วสังเกตระดับส่วนโค้งเว้า';
      } else if (this.state.labStep === 'mixing') {
        noteEl.innerHTML = this.state.isControlMode
          ? 'กำลังเติมน้ำและสังเกตการรวมตัวของสารชนิดเดียวกัน...'
          : 'กำลังผสมและกลับกระบอกตวงเบาๆ สังเกตฟองอากาศและระดับปริมาตรที่ค่อยๆ ยุบตัวลง...';
      } else {
        noteEl.innerHTML = this.state.isControlMode
          ? '<strong>ผลกรณีควบคุม:</strong> น้ำ 12.0 mL + น้ำ 12.0 mL ได้ปริมาตรรวม <strong>24.0 mL พอดี</strong> (ไม่เกิดการหดตัวของปริมาตร)'
          : '<strong>ผลสังเกตสำคัญ:</strong> ปริมาตรรวมหลังผสมได้ <strong>23.1 mL</strong> น้อยกว่าค่าทฤษฎี 24.0 mL อยู่ <strong>0.9 mL</strong>!';
      }
    }

    const recallEl = this.root.querySelector('#prediction-recall');
    if (recallEl) {
      const opt = PREDICTION_OPTIONS.find((o) => o.id === this.state.predictionChoice);
      if (opt) {
        recallEl.innerHTML = `<strong>คำทำนายที่บันทึกไว้:</strong> ${opt.title} · <em>"${escapeHtml(this.state.predictionReason)}"</em>`;
      } else {
        recallEl.textContent = 'ยังไม่ได้บันทึกคำทำนาย';
      }
    }

    this.volumeHistogram?.update(
      this.state.labStep,
      this.state.isControlMode,
      undefined,
      this.state.labStep !== 'mixing',
    );
  }

  private syncQuiz(): void {
    for (const q of QUIZ_QUESTIONS) {
      const selected = this.state.quizAnswers[q.id];
      const buttons = this.root.querySelectorAll<HTMLButtonElement>(
        `.quiz-choice-btn[data-qid="${q.id}"]`,
      );
      buttons.forEach((btn) => {
        const cid = btn.dataset.cid;
        btn.classList.remove('is-correct', 'is-wrong');
        if (selected) {
          if (cid === q.correctChoiceId) {
            btn.classList.add('is-correct');
          } else if (cid === selected) {
            btn.classList.add('is-wrong');
          }
        }
      });

      const fb = this.root.querySelector<HTMLElement>(`#feedback-${q.id}`);
      if (fb) {
        if (!selected) {
          fb.hidden = true;
        } else {
          const isCorrect = selected === q.correctChoiceId;
          fb.hidden = false;
          fb.className = `quiz-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`;
          fb.innerHTML = `<strong>${isCorrect ? '✓ ถูกต้อง' : '✕ ยังไม่ถูกต้อง'}:</strong> ${
            isCorrect ? q.explanationCorrect : q.explanationIncorrect
          }`;
        }
      }
    }

    const grade = gradeQuiz(this.state.quizAnswers);
    const summaryEl = this.root.querySelector<HTMLElement>('#quiz-summary');
    const scoreTextEl = this.root.querySelector('#quiz-score-text');
    const scoreMsgEl = this.root.querySelector('#quiz-score-message');

    if (summaryEl) {
      summaryEl.hidden = !grade.isComplete;
    }
    if (scoreTextEl) {
      scoreTextEl.textContent = `คะแนนรวม ${grade.correctCount} / ${grade.totalCount} ข้อ`;
    }
    if (scoreMsgEl) {
      scoreMsgEl.textContent =
        grade.correctCount === grade.totalCount
          ? 'ยอดเยี่ยม! นักเรียนเข้าใจความสัมพันธ์ระหว่างขนาดโมเลกุล ช่องว่าง และพันธะไฮโดรเจนอย่างครบถ้วน'
          : 'ลองทบทวนคำอธิบายในข้อที่ยังไม่ถูก หรือกลับไปสังเกตแบบจำลองในขั้นที่ 3 อีกครั้งได้นะ';
    }
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    new ChemistryPoeApp(root);
  }
});
