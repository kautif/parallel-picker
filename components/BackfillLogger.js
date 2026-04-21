import { Directory, File, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';

/**
 * BackfillLogger - Logs updateBackFillDetails (updateQty) and updateBackFillCompleted calls
 * from the Backfill component.
 *
 * updateQty log columns:
 *   Timestamp | Employee ID | Employee Name | Primary Location | Alt Location |
 *   Item (SKU) | Ordered Qty | Scanned Qty | Container | HTTP Status | Error
 *
 * updateBackFillCompleted log columns:
 *   Timestamp | Employee ID | Employee Name | HTTP Status | Error
 */
class BackfillLogger {
  constructor() {
    this.logDirectory = new Directory(Paths.document, 'logs');

    // Two separate log files per day
    this.qtyLogFile = null;
    this.completedLogFile = null;
    this.currentDate = null;

    this.initializeLogger();
  }

  async initializeLogger() {
    try {
      if (!this.logDirectory.exists) {
        this.logDirectory.create();
      }
      await this.checkAndRotateLogs();
    } catch (error) {
      console.error('Error initializing BackfillLogger:', error);
    }
  }

  getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }

  getQtyFilename(date) {
    return new File(this.logDirectory, `backfill_qty_log_${date}.txt`);
  }

  getCompletedFilename(date) {
    return new File(this.logDirectory, `backfill_completed_log_${date}.txt`);
  }

  async checkAndRotateLogs() {
    const today = this.getCurrentDate();

    if (this.currentDate !== today) {
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const files = this.logDirectory.list();
        for (const file of files) {
          if (file instanceof File &&
              (file.name.startsWith('backfill_qty_log_') || file.name.startsWith('backfill_completed_log_')) &&
              !file.name.includes(today) && !file.name.includes(yesterdayStr)) {
            file.delete();
          }
        }
      } catch (error) {
        console.error('Error deleting old backfill logs:', error);
      }

      this.currentDate = today;
      this.qtyLogFile = this.getQtyFilename(today);
      this.completedLogFile = this.getCompletedFilename(today);

      await this.createQtyLogFile();
      await this.createCompletedLogFile();
    } else {
      if (!this.qtyLogFile) {
        this.qtyLogFile = this.getQtyFilename(today);
        await this.createQtyLogFile();
      }
      if (!this.completedLogFile) {
        this.completedLogFile = this.getCompletedFilename(today);
        await this.createCompletedLogFile();
      }
    }
  }

  async createQtyLogFile() {
    const headers = [
      'Timestamp',
      'Employee ID',
      'Employee Name',
      'Primary Location',
      'Alt Location',
      'Item (SKU)',
      'Ordered Qty',
      'Scanned Qty',
      'Container',
      'HTTP Status',
      'Error'
    ].join('\t');

    const separator = '='.repeat(160);
    const content = `${separator}\nBackfill - updateBackFillDetails Log - ${this.currentDate}\n${separator}\n${headers}\n${separator}\n`;

    try {
      if (!this.qtyLogFile.exists) {
        this.qtyLogFile.create();
        this.qtyLogFile.write(content);
      }
    } catch (error) {
      console.error('Error creating backfill qty log file:', error);
    }
  }

  async createCompletedLogFile() {
    const headers = [
      'Timestamp',
      'Employee ID',
      'Employee Name',
      'HTTP Status',
      'Error'
    ].join('\t');

    const separator = '='.repeat(100);
    const content = `${separator}\nBackfill - updateBackFillCompleted Log - ${this.currentDate}\n${separator}\n${headers}\n${separator}\n`;

    try {
      if (!this.completedLogFile.exists) {
        this.completedLogFile.create();
        this.completedLogFile.write(content);
      }
    } catch (error) {
      console.error('Error creating backfill completed log file:', error);
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

  truncateError(msg) {
    if (!msg) return '';
    const oneLine = String(msg).split('\n')[0].trim();
    return oneLine.length > 80 ? oneLine.slice(0, 77) + '...' : oneLine;
  }

  /**
   * Log an updateBackFillDetails (updateQty) API call.
   * @param {Object} data
   * @param {string}   data.employeeId      - Employee badge/ID
   * @param {string}   data.employeeName    - Employee display name
   * @param {Array}    data.pickLocations   - Array of { pickLocation, qty } — index 0 = primary, 1 = alt
   * @param {string}   data.itemSku         - The SKU / gamacode of the item
   * @param {number}   data.orderedQty      - Ordered quantity for this item
   * @param {number}   data.scannedQty      - Total quantity scanned across locations
   * @param {string}   data.containerBarcode- Container barcode for this item
   * @param {number}   data.httpStatus      - HTTP response status code (0 if network error)
   * @param {string}   [data.errorMessage]  - API error/failure message if applicable
   */
  async logUpdateQty(data) {
    try {
      await this.checkAndRotateLogs();

      const {
        employeeId = 'N/A',
        employeeName = 'Unknown',
        pickLocations = [],
        itemSku = 'N/A',
        orderedQty = 0,
        scannedQty = 0,
        containerBarcode = 'N/A',
        httpStatus = 0,
        errorMessage = ''
      } = data;

      const primaryLoc = pickLocations[0]?.pickLocation || 'N/A';
      const altLoc = pickLocations[1]?.pickLocation || '';

      const logEntry = [
        this.getTimestamp(),
        employeeId,
        employeeName,
        primaryLoc,
        altLoc,
        itemSku,
        orderedQty,
        scannedQty,
        containerBarcode,
        httpStatus || 'N/A',
        this.truncateError(errorMessage)
      ].join('\t');

      const currentContent = await this.qtyLogFile.text();
      this.qtyLogFile.write(currentContent + `${logEntry}\n`);

      return { success: true };
    } catch (error) {
      console.error('Error logging backfill qty update:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log an updateBackFillCompleted API call.
   * @param {Object} data
   * @param {string}  data.employeeId     - Employee badge/ID
   * @param {string}  data.employeeName   - Employee display name
   * @param {number}  data.httpStatus     - HTTP response status code (0 if network error)
   * @param {string}  [data.errorMessage] - Error/failure message if applicable
   */
  async logUpdateCompleted(data) {
    try {
      await this.checkAndRotateLogs();

      const {
        employeeId = 'N/A',
        employeeName = 'Unknown',
        httpStatus = 0,
        errorMessage = ''
      } = data;

      const logEntry = [
        this.getTimestamp(),
        employeeId,
        employeeName,
        httpStatus || 'N/A',
        this.truncateError(errorMessage)
      ].join('\t');

      const currentContent = await this.completedLogFile.text();
      this.completedLogFile.write(currentContent + `${logEntry}\n`);

      return { success: true };
    } catch (error) {
      console.error('Error logging backfill completed:', error);
      return { success: false, error: error.message };
    }
  }

  async readQtyLog() {
    try {
      await this.checkAndRotateLogs();
      const content = await this.qtyLogFile.text();
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async readCompletedLog() {
    try {
      await this.checkAndRotateLogs();
      const content = await this.completedLogFile.text();
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async shareQtyLog() {
    try {
      await this.checkAndRotateLogs();
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) return { success: false, error: 'Sharing not available' };
      await Sharing.shareAsync(this.qtyLogFile.uri, {
        mimeType: 'text/plain',
        dialogTitle: `Share Backfill Qty Log - ${this.currentDate}`
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async shareCompletedLog() {
    try {
      await this.checkAndRotateLogs();
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) return { success: false, error: 'Sharing not available' };
      await Sharing.shareAsync(this.completedLogFile.uri, {
        mimeType: 'text/plain',
        dialogTitle: `Share Backfill Completed Log - ${this.currentDate}`
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default new BackfillLogger();
