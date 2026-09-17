export class CameraControls {
  private readonly element = document.createElement('section');

  constructor(
    host: HTMLElement,
    onZoomIn: () => void,
    onZoomOut: () => void,
    onCenterMap: () => void,
  ) {
    this.element.className = 'camera-controls';
    this.element.setAttribute('aria-label', 'Map navigation');

    const title = document.createElement('h2');
    title.textContent = 'Navegação do mapa';

    const controls = document.createElement('div');
    controls.className = 'camera-control-buttons';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Camera controls');
    controls.append(
      this.createButton('Zoom in', 'Zoom in around the map center.', onZoomIn),
      this.createButton('Zoom out', 'Zoom out around the map center.', onZoomOut),
      this.createButton('Center map', 'Center and fit the full city in the viewport.', onCenterMap),
    );

    const panHelp = document.createElement('p');
    panHelp.textContent = 'Mover: arrastar com botão do meio ou Espaço + botão esquerdo';
    const zoomHelp = document.createElement('p');
    zoomHelp.textContent = 'Zoom: roda do rato ou controlos';

    this.element.append(title, controls, panHelp, zoomHelp);
    host.append(this.element);
  }

  destroy(): void {
    this.element.remove();
  }

  private createButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = title;
    button.addEventListener('click', onClick);
    return button;
  }
}
