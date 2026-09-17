export interface SaveLoadControlResult {
  readonly ok: boolean;
  readonly message: string;
}

export class SaveLoadControls {
  private readonly element = document.createElement('section');
  private readonly save = document.createElement('button');
  private readonly load = document.createElement('button');
  private readonly status = document.createElement('p');

  constructor(
    host: HTMLElement,
    private readonly onSave: () => SaveLoadControlResult,
    private readonly onLoad: () => SaveLoadControlResult,
  ) {
    this.element.className = 'save-load-controls';
    this.element.setAttribute('aria-label', 'Local save controls');

    const title = document.createElement('h2');
    title.textContent = 'Local save';
    this.save.type = 'button';
    this.save.textContent = 'Save';
    this.save.title = 'Save the current city in this browser.';
    this.save.addEventListener('click', this.handleSave);
    this.load.type = 'button';
    this.load.textContent = 'Load';
    this.load.title = 'Load the city saved in this browser.';
    this.load.addEventListener('click', this.handleLoad);
    this.status.className = 'save-load-status';
    this.status.setAttribute('role', 'status');
    this.status.textContent = 'No local save action yet.';
    this.element.append(title, this.save, this.load, this.status);
    host.append(this.element);
  }

  destroy(): void {
    this.save.removeEventListener('click', this.handleSave);
    this.load.removeEventListener('click', this.handleLoad);
    this.element.remove();
  }

  private readonly handleSave = (): void => {
    this.status.textContent = this.onSave().message;
  };

  private readonly handleLoad = (): void => {
    this.status.textContent = this.onLoad().message;
  };
}
