import { Container } from 'inversify';

const myContainer = new Container({ defaultScope: 'Singleton' });

/**
 * Creates an isolated container. Each Core instance needs its own container,
 * because Container.unbindAll() is asynchronous in inversify 7 and would leave
 * duplicate bindings behind when a container is reused synchronously.
 */
const createContainer = (): Container =>
    new Container({ defaultScope: 'Singleton' });

export { createContainer, myContainer };
