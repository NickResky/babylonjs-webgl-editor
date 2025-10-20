import { Observable as BabylonObservable } from 'babylonjs';
import { Subject, Observable, iif, of } from 'rxjs';
import { take, switchMap, catchError, tap } from 'rxjs/operators';

/**
 * Converts BabylonObservable to RxJS Observable
 * @param obs - Observable
 * @param mask - Mask
 * @param insertFirst - Insert first
 * @param scope - Scope
 * @param unregisterOnFirstCall - Unregister on first call
 *
 */
export function fromBabylonObservable<T>(
  obs: BabylonObservable<T>,
  mask?: number,
  insertFirst?: boolean,
  scope?: any,
  unregisterOnFirstCall?: boolean,
): Observable<T> {
  const subject = new Subject<T>();
  const callback = (eventData: T): void => subject.next(eventData);

  setTimeout(() => {
    obs.add(callback, mask, insertFirst, scope, unregisterOnFirstCall);
  }, 0);

  return subject.pipe(
    switchMap((p: T) => iif(() => !!unregisterOnFirstCall, of(p).pipe(take(1)), of(p))),
    tap(
      /* eslint-disable-next-line */
      (p: T) => {},
      () => {
        obs.removeCallback(callback);
      },
      () => {
        obs.removeCallback(callback);
      },
    ),
  );
}
