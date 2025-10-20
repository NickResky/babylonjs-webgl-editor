import { Parser } from 'bowser';
import { injectable } from 'inversify';

@injectable()
export class PlatformService {
  private browser: Parser.Parser;
  
  constructor() {
    // this.browser = getParser(window.navigator.userAgent);
  }

  public get iOS(): boolean {
    const isIOS = this.browser.is('iOS');
    console.log(`[iOS] is iOS`)
    return isIOS;
  }

}
