import * as d3 from 'd3';
import {
  buildVolumeHistogramBins,
  HistogramBin,
  LabStep,
} from '../logic/chemistryModel';

export class VolumeHistogramChart {
  private container: HTMLElement;
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private plotGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private tooltip: HTMLDivElement;

  private lastStep: LabStep = 'empty';
  private lastControl = false;
  private lastLiveMl: number | undefined;

  private readonly margin = { top: 28, right: 24, bottom: 52, left: 56 };

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.innerHTML = '';

    this.svg = d3
      .select(this.container)
      .append('svg')
      .attr('class', 'd3-histogram-svg')
      .attr('role', 'img')
      .attr('aria-label', 'แผนภูมิฮิสโทแกรมเปรียบเทียบปริมาตรก่อนและหลังผสมสาร');

    this.plotGroup = this.svg
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'd3-tooltip';
    this.tooltip.hidden = true;
    this.container.appendChild(this.tooltip);

    this.update('empty', false);
  }

  public resize(): void {
    this.update(this.lastStep, this.lastControl, this.lastLiveMl, false);
  }

  public update(
    step: LabStep,
    isControlMode: boolean,
    liveActualMl?: number,
    animate = true,
  ): void {
    this.lastStep = step;
    this.lastControl = isControlMode;
    this.lastLiveMl = liveActualMl;

    const bins = buildVolumeHistogramBins(step, isControlMode, liveActualMl);
    const totalW = Math.max(300, this.container.clientWidth || 720);
    const totalH = 268;
    const innerW = Math.max(180, totalW - this.margin.left - this.margin.right);
    const innerH = totalH - this.margin.top - this.margin.bottom;

    this.svg.attr('viewBox', `0 0 ${totalW} ${totalH}`);
    this.svg.attr('width', totalW);
    this.svg.attr('height', totalH);

    const x = d3
      .scaleBand<string>()
      .domain(bins.map((b) => b.id))
      .range([0, innerW])
      .padding(0.32);

    const y = d3.scaleLinear().domain([0, 26]).range([innerH, 0]);

    // Horizontal gridlines
    const gridData = [0, 5, 10, 15, 20, 25];
    const gridSel = this.plotGroup
      .selectAll<SVGLineElement, number>('line.d3-grid-line')
      .data(gridData);

    gridSel
      .join('line')
      .attr('class', 'd3-grid-line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', 'rgba(148, 163, 184, 0.14)')
      .attr('stroke-width', 1);

    const compactLabels: Record<HistogramBin['id'], string> = {
      water: 'น้ำ 1',
      second: isControlMode ? 'น้ำ 2' : 'แอลกอฮอล์',
      theoretical: 'ทฤษฎี',
      actual: 'วัดจริง',
    };

    // Axes
    let xAxisG = this.plotGroup.select<SVGGElement>('g.d3-x-axis');
    if (xAxisG.empty()) {
      xAxisG = this.plotGroup.append('g').attr('class', 'd3-x-axis');
    }
    xAxisG
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickFormat((id) => {
            if (totalW < 520) {
              return compactLabels[id as HistogramBin['id']] ?? String(id);
            }
            const found = bins.find((b) => b.id === id);
            return found ? found.shortLabel : String(id);
          })
          .tickSizeOuter(0),
      );
    xAxisG.selectAll('path, line').attr('stroke', '#475569');
    xAxisG
      .selectAll('text')
      .attr('fill', '#cbd5e1')
      .style('font-size', totalW < 520 ? '11px' : '12.5px')
      .style('font-family', '"IBM Plex Sans Thai", sans-serif')
      .style('font-weight', '600');

    let yAxisG = this.plotGroup.select<SVGGElement>('g.d3-y-axis');
    if (yAxisG.empty()) {
      yAxisG = this.plotGroup.append('g').attr('class', 'd3-y-axis');
    }
    yAxisG.call(
      d3
        .axisLeft(y)
        .tickValues([0, 5, 10, 15, 20, 25])
        .tickFormat((d) => `${d}`)
        .tickSizeOuter(0),
    );
    yAxisG.selectAll('path, line').attr('stroke', '#475569');
    yAxisG
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .style('font-size', '11px')
      .style('font-family', '"IBM Plex Mono", monospace');

    // Y-axis unit label
    let yLabel = this.plotGroup.select<SVGTextElement>('text.d3-y-label');
    if (yLabel.empty()) {
      yLabel = this.plotGroup
        .append('text')
        .attr('class', 'd3-y-label')
        .attr('x', -this.margin.left + 8)
        .attr('y', -12)
        .attr('fill', '#94a3b8')
        .style('font-size', '11.5px')
        .style('font-weight', '600')
        .style('font-family', '"IBM Plex Sans Thai", sans-serif');
    }
    yLabel.text('ปริมาตร (mL)');

    // Histogram bars
    const bars = this.plotGroup
      .selectAll<SVGRectElement, HistogramBin>('rect.d3-bar')
      .data(bins, (d) => d.id);

    const barsEnter = bars
      .enter()
      .append('rect')
      .attr('class', 'd3-bar')
      .attr('x', (d) => x(d.id) ?? 0)
      .attr('width', x.bandwidth())
      .attr('y', innerH)
      .attr('height', 0)
      .attr('rx', 5)
      .style('cursor', 'pointer');

    const allBars = barsEnter.merge(bars);
    allBars
      .on('mouseenter', (event: MouseEvent, d: HistogramBin) => {
        this.showTooltip(event, d);
      })
      .on('mousemove', (event: MouseEvent, d: HistogramBin) => {
        this.showTooltip(event, d);
      })
      .on('mouseleave', () => {
        this.tooltip.hidden = true;
      });

    if (animate) {
      allBars
        .transition()
        .duration(180)
        .ease(d3.easeCubicOut)
        .attr('x', (d) => x(d.id) ?? 0)
        .attr('width', x.bandwidth())
        .attr('y', (d) => y(d.volumeMl))
        .attr('height', (d) => Math.max(0, innerH - y(d.volumeMl)))
        .attr('fill', (d) => d.fill)
        .attr('stroke', (d) => d.stroke)
        .attr('stroke-width', 1.6)
        .attr('stroke-dasharray', (d) => (d.isDashed ? '5,4' : 'none'));
    } else {
      allBars
        .attr('x', (d) => x(d.id) ?? 0)
        .attr('width', x.bandwidth())
        .attr('y', (d) => y(d.volumeMl))
        .attr('height', (d) => Math.max(0, innerH - y(d.volumeMl)))
        .attr('fill', (d) => d.fill)
        .attr('stroke', (d) => d.stroke)
        .attr('stroke-width', 1.6)
        .attr('stroke-dasharray', (d) => (d.isDashed ? '5,4' : 'none'));
    }

    // Numeric value labels (put 23.1 mL inside top of bar when contraction callout sits above)
    const isContractedSettled = step === 'settled' && !isControlMode;
    const labels = this.plotGroup
      .selectAll<SVGTextElement, HistogramBin>('text.d3-bar-value')
      .data(bins, (d) => d.id);

    const labelsEnter = labels
      .enter()
      .append('text')
      .attr('class', 'd3-bar-value')
      .attr('text-anchor', 'middle')
      .style('font-size', totalW < 520 ? '11px' : '12px')
      .style('font-weight', '700')
      .style('font-family', '"IBM Plex Mono", monospace')
      .style('font-variant-numeric', 'tabular-nums')
      .style('pointer-events', 'none');

    labelsEnter
      .merge(labels)
      .attr('x', (d) => (x(d.id) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => {
        if (d.id === 'actual' && isContractedSettled) {
          return y(d.volumeMl) + 22;
        }
        return Math.max(10, y(d.volumeMl) - 7);
      })
      .attr('fill', (d) =>
        d.id === 'actual' && isContractedSettled ? '#0b1220' : '#f8fafc',
      )
      .text((d) => `${d.volumeMl.toFixed(1)} mL`);

    // Contraction gap callout overlay on the "actual" bar when settled in ethanol mode
    let diffGroup = this.plotGroup.select<SVGGElement>('g.d3-diff-callout');
    if (diffGroup.empty()) {
      diffGroup = this.plotGroup.append('g').attr('class', 'd3-diff-callout');
    }
    diffGroup.selectAll('*').remove();

    if (step === 'settled' && !isControlMode) {
      const actualX = x('actual') ?? 0;
      const theoX = x('theoretical') ?? 0;
      const bw = x.bandwidth();
      const y24 = y(24.0);
      const y231 = y(23.1);

      // Highlight missing 0.9 mL ghost cap above the 23.1 mL bar
      diffGroup
        .append('rect')
        .attr('x', actualX)
        .attr('y', y24)
        .attr('width', bw)
        .attr('height', Math.max(4, y231 - y24))
        .attr('fill', 'rgba(251, 191, 36, 0.18)')
        .attr('stroke', '#fbbf24')
        .attr('stroke-width', 1.4)
        .attr('stroke-dasharray', '4,3')
        .attr('rx', 3);

      // Dashed reference line bridging Theoretical (24.0) to Actual (23.1)
      diffGroup
        .append('line')
        .attr('x1', theoX)
        .attr('x2', actualX + bw)
        .attr('y1', y24)
        .attr('y2', y24)
        .attr('stroke', '#fbbf24')
        .attr('stroke-width', 1.4)
        .attr('stroke-dasharray', '5,4');

      diffGroup
        .append('text')
        .attr('x', actualX + bw / 2)
        .attr('y', Math.max(12, y24 - 8))
        .attr('text-anchor', 'middle')
        .attr('fill', '#fbbf24')
        .style('font-size', '11.5px')
        .style('font-weight', '700')
        .style('font-family', '"IBM Plex Sans Thai", sans-serif')
        .text('หายไป -0.9 mL');
    }
  }

  private showTooltip(event: MouseEvent, bin: HistogramBin): void {
    const rect = this.container.getBoundingClientRect();
    const relX = event.clientX - rect.left;
    const relY = event.clientY - rect.top;

    this.tooltip.hidden = false;
    this.tooltip.innerHTML = `
      <div class="d3-tooltip-title">${bin.label}</div>
      <div class="d3-tooltip-val mono">${bin.volumeMl.toFixed(1)} mL</div>
      <div class="d3-tooltip-note">${bin.note}</div>
    `;

    const left = Math.min(Math.max(12, relX + 12), Math.max(12, rect.width - 230));
    const top = Math.max(8, relY - 64);
    this.tooltip.style.transform = `translate(${left}px, ${top}px)`;
  }

  public dispose(): void {
    this.container.innerHTML = '';
  }
}
