/**
 * Service for logging and throwing errors
 */
export abstract class MVLogger {

  public static showDebugLogs: boolean = false;

  /**
   * Log debug messages
   * @param message -
   */
  public static debug(message: string, ...obj: any): void {
    if (this.showDebugLogs) {
      console.log(`%c [DEBUG] `, this.logStyle('linen'), `${message}`, ...obj);
    }
  }

  /**
   * Log informational messages
   * @param message -
   */
  public static info(message: string, ...obj: any): void {
    console.log(`%c [INFO] `, this.logStyle('lightgreen'), `${message}`, ...obj);
  }

  /**
   * Log potentially harmful events
   * @param message -
   * @param obj -
   */
  public static warn(message: string, ...obj: any): void {
    console.warn(`[WARN] ${message}`, ...obj);
  }

  /**
   * Log error events that might still allow the application to continue running
   * @param  message -
   * @param obj -
   */
  public static error(message: string, ...obj: any): void {
    console.error(`[ERROR] ${message}`, ...obj);
  }

  /**
   * Log and throw an error that will lead the application to abort/freeze/discontinue
   * @param  message -
   * @param details -
   */
  public static fatal(error: string, details?: string): void {
    throw new Error(`[FATAL ERROR] ${error}. ${details ? '(' + details + ')' : ''}`);
  }

  /**
   * Get log style
   * @param background - Background color
   * @param color - font color
   */
  private static logStyle(background: string = 'white', color: string = 'black'): string {
    return 'background:' + background + '; color: ' + color;
  }
}
