import { Directory, File, Paths } from 'expo-file-system/next';

/**
 * MergeLogger - Logs the three key API calls in the Merge component:
 *   1. getMergedBackfills  — HTTP status, error, order IDs + containers returned
 *   2. updateMergedItem    — scanned SKU, mergedQty, scannedQty, orderId, container, dest container
 *   3. updateMergeStatus   — order numbers, HTTP status, error
 *
 * All logs rotate daily (one file per log type per day).
 */
class MergeLogger {
  constructor() {
    this.logDirectory = new Directory(Paths.document, 'logs');

    this.getMergedFile = null;
    this.updateItemFile = null;
    this.mergeStatusFile = null;
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
      console.error('Error initializing MergeLogger:', error);
    }
  }

  getCurrentDate() {
    return new Date().toISOString().split('T')[0];
  }

  _filename(prefix, date) {
    return new File(this.logDirectory, `${prefix}_${date}.txt`);
  }

  async checkAndRotateLogs() {
    const today = this.getCurrentDate();

    if (this.currentDate !== today) {
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const prefixes = ['merge_get_log', 'merge_item_log', 'merge_status_log'];
        const files = this.logDirectory.list();
        for (const file of files) {
          if (file instanceof File &&
              prefixes.some(p => file.name.startsWith(p)) &&
              !file.name.includes(today) && !file.name.includes(yesterdayStr)) {
            file.delete();
          }
        }
      } catch (error) {
        console.error('Error deleting old merge logs:', error);
      }

      this.currentDate = today;
      this.getMergedFile = this._filename('merge_get_log', today);
      this.updateItemFile = this._filename('merge_item_log', today);
      this.mergeStatusFile = this._filename('merge_status_log', today);

      await this._createGetMergedFile();
      await this._createUpdateItemFile();
      await this._createMergeStatusFile();
    } else {
      if (!this.getMergedFile) {
        this.getMergedFile = this._filename('merge_get_log', today);
        await this._createGetMergedFile();
      }
      if (!this.updateItemFile) {
        this.updateItemFile = this._filename('merge_item_log', today);
        await this._createUpdateItemFile();
      }
      if (!this.mergeStatusFile) {
        this.mergeStatusFile = this._filename('merge_status_log', today);
        await this._createMergeStatusFile();
      }
    }
  }

  async _createGetMergedFile() {
    const headers = [
      'Timestamp',
      'Employee ID',
      'Employee Name',
      'HTTP Status',
      'Order IDs Returned',
      'Containers Returned',
      'Error'
    ].join('\t');

    const sep = '='.repeat(150);
    const content = `${sep}\nMerge - getMergedBackfills Log - ${this.currentDate}\n${sep}\n${headers}\n${sep}\n`;

    try {
      if (!this.getMergedFile.exists) {
        this.getMergedFile.create();
        this.getMergedFile.write(content);
      }
    } catch (e) {
      console.error('Error creating merge get log:', e);
    }
  }

  async _createUpdateItemFile() {
    const headers = [
      'Timestamp',
      'Employee ID',
      'Employee Name',
      'Scanned SKU',
      'Merged Qty',
      'Scanned Qty',
      'Order ID',
      'Order Container',
      'Dest Container',
      'HTTP Status',
      'Error'
    ].join('\t');

    const sep = '='.repeat(160);
    const content = `${sep}\nMerge - updateMergedItem Log - ${this.currentDate}\n${sep}\n${headers}\n${sep}\n`;

    try {
      if (!this.updateItemFile.exists) {
        this.updateItemFile.create();
        this.updateItemFile.write(content);
      }
    } catch (e) {
      console.error('Error creating merge item log:', e);
    }
  }

  async _createMergeStatusFile() {
    const headers = [
      'Timestamp',
      'Employee ID',
      'Employee Name',
      'Order Numbers',
      'HTTP Status',
      'Error'
    ].join('\t');

    const sep = '='.repeat(130);
    const content = `${sep}\nMerge - updateMergeStatus Log - ${this.currentDate}\n${sep}\n${headers}\n${sep}\n`;

    try {
      if (!this.mergeStatusFile.exists) {
        this.mergeStatusFile.create();
        this.mergeStatusFile.write(content);
      }
    } catch (e) {
      console.error('Error creating merge status log:', e);
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
   * Log a getMergedBackfills API call.
   * @param {Object}   data
   * @param {string}   data.employeeId        - Employee badge/ID
   * @param {string}   data.employeeName      - Employee display name
   * @param {number}   data.httpStatus        - HTTP status code (0 if network error)
   * @param {string[]} [data.orderIds]        - Order IDs returned from the API
   * @param {string[]} [data.containers]      - Container barcodes corresponding to those orders
   * @param {string}   [data.errorMessage]    - Error/failure message if applicable
   */
  async logGetMergedBackfills(data) {
    try {
      await this.checkAndRotateLogs();

      const {
        employeeId = 'N/A',
        employeeName = 'Unknown',
        httpStatus = 0,
        orderIds = [],
        containers = [],
        errorMessage = ''
      } = data;

      const logEntry = [
        this.getTimestamp(),
        employeeId,
        employeeName,
        httpStatus || 'N/A',
        orderIds.join(', ') || 'N/A',
        containers.join(', ') || 'N/A',
        this.truncateError(errorMessage)
      ].join('\t');

      const currentContent = await this.getMergedFile.text();
      this.getMergedFile.write(currentContent + `${logEntry}\n`);

      return { success: true };
    } catch (error) {
      console.error('Error logging getMergedBackfills:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log an updateMergedItem API call.
   * @param {Object}  data
   * @param {string}  data.employeeId       - Employee badge/ID
   * @param {string}  data.employeeName     - Employee display name
   * @param {string}  data.scannedSku       - The SKU that was scanned
   * @param {number}  data.mergedQty        - mergedQty sent to the API
   * @param {number}  data.scannedQty       - scannedQty (expected total) for the item
   * @param {string}  data.orderId          - Order ID this item belongs to
   * @param {string}  data.orderContainer   - The order's container barcode
   * @param {string}  data.destContainer    - Destination container barcode scanned by user
   * @param {number}  data.httpStatus       - HTTP status code (0 if network error)
   * @param {string}  [data.errorMessage]   - Error/failure message if applicable
   */
  async logUpdateMergedItem(data) {
    try {
      await this.checkAndRotateLogs();

      const {
        employeeId = 'N/A',
        employeeName = 'Unknown',
        scannedSku = 'N/A',
        mergedQty = 0,
        scannedQty = 0,
        orderId = 'N/A',
        orderContainer = 'N/A',
        destContainer = 'N/A',
        httpStatus = 0,
        errorMessage = ''
      } = data;

      const logEntry = [
        this.getTimestamp(),
        employeeId,
        employeeName,
        scannedSku,
        mergedQty,
        scannedQty,
        orderId,
        orderContainer,
        destContainer,
        httpStatus || 'N/A',
        this.truncateError(errorMessage)
      ].join('\t');

      const currentContent = await this.updateItemFile.text();
      this.updateItemFile.write(currentContent + `${logEntry}\n`);

      return { success: true };
    } catch (error) {
      console.error('Error logging updateMergedItem:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Log an updateMergeStatus (UpdateMergeCompleted) API call.
   * @param {Object}   data
   * @param {string}   data.employeeId       - Employee badge/ID
   * @param {string}   data.employeeName     - Employee display name
   * @param {string[]} data.orderNumbers     - Array of order numbers being marked complete
   * @param {number}   data.httpStatus       - HTTP status code (0 if network error)
   * @param {string}   [data.errorMessage]   - Error/failure message if applicable
   */
  async logUpdateMergeStatus(data) {
    try {
      await this.checkAndRotateLogs();

      const {
        employeeId = 'N/A',
        employeeName = 'Unknown',
        orderNumbers = [],
        httpStatus = 0,
        errorMessage = ''
      } = data;

      const logEntry = [
        this.getTimestamp(),
        employeeId,
        employeeName,
        orderNumbers.join(', ') || 'N/A',
        httpStatus || 'N/A',
        this.truncateError(errorMessage)
      ].join('\t');

      const currentContent = await this.mergeStatusFile.text();
      this.mergeStatusFile.write(currentContent + `${logEntry}\n`);

      return { success: true };
    } catch (error) {
      console.error('Error logging updateMergeStatus:', error);
      return { success: false, error: error.message };
    }
  }

  async readGetMergedLog() {
    try {
      await this.checkAndRotateLogs();
      const content = await this.getMergedFile.text();
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async readUpdateItemLog() {
    try {
      await this.checkAndRotateLogs();
      const content = await this.updateItemFile.text();
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async readMergeStatusLog() {
    try {
      await this.checkAndRotateLogs();
      const content = await this.mergeStatusFile.text();
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default new MergeLogger();
