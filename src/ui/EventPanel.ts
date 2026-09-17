import {
  canFulfillImperialRequest,
  getEventSummary,
  getImperialRequestSummary,
} from '../events/Events';
import type { CityState } from '../simulation/CityState';

export class EventPanel {
  private readonly element = document.createElement('section');
  private readonly events = document.createElement('ul');
  private readonly request = document.createElement('p');
  private readonly fulfil = document.createElement('button');
  private readonly messages = document.createElement('ul');
  private readonly status = document.createElement('p');

  constructor(
    host: HTMLElement,
    private readonly getCity: () => CityState,
    private readonly onFulfilRequest: () => boolean,
  ) {
    this.element.className = 'event-panel';
    this.element.setAttribute('aria-label', 'Events');

    const title = document.createElement('h2');
    title.textContent = 'Eventos';
    this.events.setAttribute('aria-label', 'Active events');
    this.request.className = 'imperial-request';
    this.fulfil.type = 'button';
    this.fulfil.textContent = 'Cumprir pedido';
    this.fulfil.title = 'Entregar a comida pedida e receber a recompensa imperial.';
    this.fulfil.addEventListener('click', () => {
      if (!canFulfillImperialRequest(this.getCity())) {
        this.status.textContent = 'Comida insuficiente para cumprir o pedido imperial.';
        this.update(this.getCity());
        return;
      }
      this.status.textContent = this.onFulfilRequest()
        ? 'Imperial request fulfilled.'
        : 'Imperial request could not be fulfilled.';
      this.update(this.getCity());
    });
    this.messages.setAttribute('aria-label', 'Recent event messages');
    this.status.className = 'event-status';
    this.status.setAttribute('role', 'status');

    const messagesTitle = document.createElement('h3');
    messagesTitle.textContent = 'Mensagens recentes';
    this.element.append(title, this.events, this.request, this.fulfil, this.status, messagesTitle, this.messages);
    host.append(this.element);
  }

  update(city: CityState): void {
    const eventSummaries = getEventSummary(city);
    this.events.replaceChildren();
    if (eventSummaries.length === 0) {
      const item = document.createElement('li');
      item.textContent = 'Não há eventos activos.';
      this.events.append(item);
    } else {
      for (const event of eventSummaries) {
        const item = document.createElement('li');
        const label = event.status === 'warning' ? 'Warning' : 'Active';
        item.textContent = `${label}: ${event.type} (${event.ticksRemaining} ticks)`
          + (event.targetBuildingId === undefined ? '' : ` — ${event.targetBuildingId}`);
        item.className = event.status === 'warning' ? 'event-warning' : 'event-active';
        this.events.append(item);
      }
    }

    const imperialRequest = getImperialRequestSummary(city);
    if (imperialRequest === undefined) {
      this.request.textContent = 'Não há pedidos imperiais.';
      this.fulfil.hidden = true;
      this.fulfil.disabled = true;
    } else {
      this.request.textContent = imperialRequest.status === 'pending'
        ? `Deliver ${imperialRequest.requestedFood} food by tick ${imperialRequest.dueTick}. `
          + `Reward: +${imperialRequest.rewardMoney} money. Failure: -${imperialRequest.failurePenalty} money. `
          + `Stock: ${imperialRequest.foodStock}.`
        : `Imperial request ${imperialRequest.status}.`;
      this.fulfil.hidden = imperialRequest.status !== 'pending';
      this.fulfil.disabled = !canFulfillImperialRequest(city);
    }

    this.messages.replaceChildren();
    const history = city.simulation.events?.history ?? [];
    if (history.length === 0) {
      const item = document.createElement('li');
      item.textContent = 'Ainda não há mensagens.';
      this.messages.append(item);
    } else {
      for (const message of history) {
        const item = document.createElement('li');
        item.textContent = `Tick ${message.tick}: ${message.message}`;
        this.messages.append(item);
      }
    }
  }

  destroy(): void {
    this.element.remove();
  }
}
