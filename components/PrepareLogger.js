import { Directory, File, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';

/**
 * PrepareLogger - Logs getBackFillDetails API calls from the Prepare component.
 * Captures order/container pairs (up to 4), HTTP status code, and any error message.
 * Creates daily log files that rotate at midnight.
 */
class PrepareLogger {
  constructor() {
    this.logDirectory = new Directory(Paths.document, 'logs');
    this.currentLogFile = null;
    this.currentDate = null;
    this.initializeLogger();
  }

  async initializeLogger() {
    try {
      if (!this.logDirectory.exists) {
        this.logDirectory.create();
      }
      await this.checkAndRotateLog();
    } catch (error) {
      console.error('Error initializing PrepareLogger:', error);
    }
  }

  getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }

  getLogFilename(date) {
    return new File(this.logDirectory, `prepare_log_${date}.txt`);
  }

  async checkAndRotateLog() {
    const today = this.getCurrentDate();

    if (this.currentDate !== today) {
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const files = this.logDirectory.list();
        for (const file of files) {
          if (file instanceof File && file.name.startsWith('prepare_log_') &&
              !file.name.includes(today) && !file.name.includes(yesterdayStr)) {
            file.delete();
          }
        }
      } catch (error) {
        console.error('Error deleting old prepare logs:', error);
      }

      this.currentDate = today;
      this.currentLogFile = this.getLogFilename(today);
      await this.createLogFile();
    } else if (!this.currentLogFile) {
      this.currentLogFile = this.getLogFilename(today);
      await this.createLogFile();
    }
  }

  async createLogFile() {
    const headers = [
      'Timestamp',
      'Employee ID',
      'Employee Name',
      'Order 1',
      'Container 1',
      'Order 2',
      'Container 2',
      'Order 3',
      'Container 3',
      'Order 4',
      'Container 4',
      'HTTP Status',
      'Error'
    ].join('\t');

    const separator = '='.repeat(180);
    const content = `${separator}\nPrepare - getBackFillDetails Log - ${this.currentDate}\n${separator}\n${headers}\n${separator}\n`;

    try {
      if (!this.currentLogFile.exists) {
        this.currentLogFile.create();
        this.currentLogFile.write(content);
      }
    } catch (error) {
      console.error('Error creating prepare log file:', error);
    }
  }

  getTimestamp() {
    return new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  /**
   * Truncate an error message to a single line (max 80 chars).
   */
  truncateError(msg) {
    if (!msg) return '';
    const oneLine = String(msg).split('\n')[0].trim();
    return oneLine.length > 80 ? oneLine.slice(0, 77) + '...' : oneLine;
  }

  /**
   * Log a getBackFillDetails call.
   * @param {Object} data
   * @param {string}   data.employeeId      - Employee badge/ID
   * @param {string}   data.employeeName    - Employee display name
   * @param {string[]} data.orders          - Array of order IDs (1-4)
   * @param {string[]} data.containers      - Parallel array of container barcodes (1-4)
   * @param {number}   data.httpStatus      - HTTP response status code (0 if network error)
   * @param {string}   [data.errorMessage]  - Error or failure reason if applicable
   */
  async logPrepareRequest(data) {
    try {
      await this.checkAndRotateLog();

      const {
        employeeId = 'N/A',
        employeeName = 'Unknown',
        orders = [],
        containers = [],
        httpStatus = 0,
        errorMessage = ''
      } = data;

      // Pad out to 4 slots
      const o = [...orders, '', '', '', ''].slice(0, 4);
      const c = [...containers, '', '', '', ''].slice(0, 4);

      const logEntry = [
        this.getTimestamp(),
        employeeId,
        employeeName,
        o[0], c[0],
        o[1], c[1],
        o[2], c[2],
        o[3], c[3],
        httpStatus || 'N/A',
        this.truncateError(errorMessage)
      ].join('\t');

      const currentContent = await this.currentLogFile.text();
      this.currentLogFile.write(currentContent + `${logEntry}\n`);

      return { success: true };
    } catch (error) {
      console.error('Error logging prepare request:', error);
      return { success: false, error: error.message };
    }
  }

  async readCurrentLog() {
    try {
      await this.checkAndRotateLog();
      const content = await this.currentLogFile.text();
      return { success: true, content };
    } catch (error) {
      console.error('Error reading prepare log file:', error);
      return { success: false, error: error.message };
    }
  }

  async shareLogFile() {
    try {
      await this.checkAndRotateLog();
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Sharing not available on this device' };
      }
      await Sharing.shareAsync(this.currentLogFile.uri, {
        mimeType: 'text/plain',
        dialogTitle: `Share Prepare Log - ${this.currentDate}`
      });
      return { success: true };
    } catch (error) {
      console.error('Error sharing prepare log file:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new PrepareLogger();
