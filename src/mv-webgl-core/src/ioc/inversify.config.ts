import { Container } from 'inversify';

const myContainer = new Container({ defaultScope: 'Singleton' });

export { myContainer };
