import { EventDispatcherService } from './event-dispatcher.service';
import { MVEventTypes } from '../globals/mv-event-types';
import { CoreWraperElement } from '../models/CoreCanvasElement';

describe('Event Dispatcher Service', () => {
  let eventDispatcherServiceComponent!: EventDispatcherService;
  let mockHTMLContainer;
  beforeEach(() => {
    mockHTMLContainer = jasmine.createSpyObj<CoreWraperElement>('CoreWraperElement', ['dispatchEvent']);
    eventDispatcherServiceComponent = new EventDispatcherService(mockHTMLContainer);
  });
  [
    [MVEventTypes.onActionItemClick],
    [MVEventTypes.onProductConfigurationApplied],
    [MVEventTypes.onEnvironmentConfigurationApplied],
    [MVEventTypes.onEnvironmentLoaded],
    [MVEventTypes.onProductLoaded],
    [MVEventTypes.onEngineReady],
  ].forEach(([customEvent]) => {
    it(`should call a dispatch event ${customEvent}`, () => {
      mockHTMLContainer.dispatchEvent.and.callFake(() => {
        return true;
      });
      eventDispatcherServiceComponent.publish(customEvent);
      expect(mockHTMLContainer.dispatchEvent).toHaveBeenCalled();
      expect(mockHTMLContainer.dispatchEvent).toHaveBeenCalledWith(new CustomEvent(customEvent, { detail: null }));
    });
  });
});
