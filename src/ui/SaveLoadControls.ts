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
    title.textContent = 'Guardar localmente';
    this.save.type = 'button';
    this.save.textContent = 'Guardar';
    this.save.title = 'Guardar a cidade actual neste browser.';
    this.save.addEventListener('click', this.handleSave);
    this.load.type = 'button';
    this.load.textContent = 'Carregar';
    this.load.title = 'Carregar a cidade guardada neste browser.';
    this.load.addEventListener('click', this.handleLoad);
    this.status.className = 'save-load-status';
    this.status.setAttribute('role', 'status');
    this.status.textContent = 'Ainda não foi executada nenhuma acção de guardar ou carregar.';
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
