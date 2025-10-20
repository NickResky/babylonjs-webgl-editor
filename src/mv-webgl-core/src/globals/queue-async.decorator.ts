

/**
 * Method decorator
 * Queues method calls, and nests promises
 * If promise is pending, all subsequent requests will be ignored but last one.
 */
export function QueueAsync() {
    let currentPromise: Promise<any> = null;
    let currentArgs: any = null;
    let nextArgs: any = null;

    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const original = descriptor.value;

        const next = function (...args) {
            currentArgs = args;
            return original.apply(this, args).then(
                p => {
                    const shouldSkip = JSON.stringify(currentArgs) === JSON.stringify(nextArgs);
                    const args = nextArgs;
                    nextArgs = null;

                    if (!!args && !shouldSkip)
                        return next.apply(this, args);

                    currentPromise = null;
                    return p;
                }
            );
        }

        descriptor.value = function (...args: any[]) {
            if (!!currentPromise) {
                nextArgs = args;
                return currentPromise
            }

            currentPromise = next.apply(this, args);

            return currentPromise;
        };

        return descriptor;
    };
}
