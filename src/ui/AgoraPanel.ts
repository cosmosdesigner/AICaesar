import type { AgoraSummary } from '../game/AgoraSummary';

export class AgoraPanel {
  private readonly element = document.createElement('section');
  private readonly status = document.createElement('p');
  private readonly objective = document.createElement('p');
  private readonly issue = document.createElement('p');
  private readonly action = document.createElement('p');
  private readonly resources = document.createElement('p');
  private readonly timing = document.createElement('p');

  constructor(host: HTMLElement) {
    this.element.className = 'agora-panel';
    this.element.setAttribute('aria-label', 'Agora');

    const title = document.createElement('h2');
    title.textContent = 'Agora';
    this.status.setAttribute('role', 'status');
    this.element.append(title, this.status, this.objective, this.issue, this.action, this.resources, this.timing);
    host.append(this.element);
  }

  update(summary: AgoraSummary): void {
    this.setMessage(this.status, summary.status, 'Estado');
    this.objective.className = 'agora-objective';
    this.objective.textContent = summary.objective === undefined
      ? 'Objetivo: nenhum objetivo disponível.'
      : `Objetivo: ${summary.objective.label} — ${summary.objective.progress}`;
    this.setMessage(this.issue, summary.issue, 'Problema');
    this.action.className = 'agora-action';
    this.action.textContent = `Ação sugerida: ${summary.action.label}${summary.action.estimatedCost === 0 ? '' : ` (${summary.action.estimatedCost})`}.`;
    this.resources.className = 'agora-resources';
    this.resources.textContent = `Recursos: ${summary.resources.money} dinheiro · ${summary.resources.population} população.`;
    this.setMessage(this.timing, summary.timing, 'Risco temporal');
  }

  destroy(): void {
    this.element.remove();
  }

  private setMessage(element: HTMLElement, message: AgoraSummary['status'], label: string): void {
    element.className = `agora-${message.tone}`;
    element.textContent = `${label}: ${message.text}`;
  }
}
