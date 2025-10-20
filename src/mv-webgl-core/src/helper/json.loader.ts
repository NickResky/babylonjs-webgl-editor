import { MVLogger } from '../logging';

/**
 * Load Json with type
 * @param url -
 *
 */
async function _loadJsonWithType<T>(url: string): Promise<T> {
  return fetch(url)
    .then(p => p.json() as Promise<T>)
    .catch(err => {
      MVLogger.error(`Failed to load ${url}`, err);
      return Promise.resolve(null);
    });
}

/**
 * load json from url
 */
export const loadJson = <T>(url: string): Promise<T> => {
  return _loadJsonWithType(url);
} 
