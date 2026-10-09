import { Component, ElementRef, effect, input, OnDestroy, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
Chart.defaults.color = '#5f6577';

/** Thin wrapper around Chart.js: re-renders whenever the configuration input changes. */
@Component({
  selector: 'app-chart',
  template: `<div class="wrap" [style.height.px]="height()"><canvas #canvas [attr.aria-label]="label()" role="img"></canvas></div>`,
  styles: `.wrap { position: relative; width: 100%; }`,
})
export class ChartComponent implements OnDestroy {
  readonly config = input.required<ChartConfiguration>();
  readonly height = input(260);
  readonly label = input('Chart');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  constructor() {
    effect(() => {
      const config = this.config();
      this.chart?.destroy();
      this.chart = new Chart(this.canvas().nativeElement, {
        ...config,
        options: { responsive: true, maintainAspectRatio: false, ...config.options },
      });
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}

/** Shared series colours (colour-blind friendly, distinguishable in print). */
export const SERIES_COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626'];
