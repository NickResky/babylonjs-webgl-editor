import { injectable, inject } from 'inversify';
import { TYPES } from '../ioc/types';
import { MVEventTypes } from '../globals/mv-event-types';
import { CoreWraperElement } from '../models/CoreCanvasElement';

@injectable()
export class EventDispatcherService {
  /**
   * Create EventDispatcherService
   * @param _htmlContainer -
   */
  constructor(@inject(TYPES.CoreWraperElement) private _htmlContainer: CoreWraperElement) {}
  /**
   * Publish an event to the given topic (similar to dispatchEvent).
   *
   * @param eventName - the eventName to publish to
   * @param args - eventData the data to send
   */
  public publish(eventName: MVEventTypes, ...args: any[]): void {
    const event = new CustomEvent(eventName, { detail: args });
    this._htmlContainer.dispatchEvent(event);
  }
}
