import { LightningElement } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import importBillingSchedules from '@salesforce/apex/PITS_BillingScheduleImportController.importBillingSchedules';
import XLSX_LIB from '@salesforce/resourceUrl/PITS_SheetJS';

const MAX_FILE_SIZE = 5242880; // 5MB in bytes

// Template data for downloadable sample files
const TEMPLATE_HEADERS = ['Company Name', 'Project Name', 'Employee Name', 'Month', 'Start Date', 'End Date', 'Hours', 'Bill Rate', 'Record Type'];
const TEMPLATE_ROWS = [
    ['CompanyOnePlus', 'AI implementation',     'John Doe',   'Jan', '2026-01-01', '2026-01-31', 160, 150.00,    'Hourly'],
    ['CompanyOnePlus', 'SAP Implementation 1',  'Jane Smith', 'Jan', '2026-01-01', '2026-01-31', 1,   12500.00,  'Monthly_Fixed_Priced'],
    ['Dynava',         'ExampleOne',             'John Doe',   'Feb', '2026-02-01', '2026-02-28', 144, 150.00,   'Hourly']
];

export default class PitsBillingScheduleImporter extends LightningElement {
    // File state
    fileName = '';
    fileSize = '';
    fileContent = '';
    
    // UI state
    isProcessing = false;
    showResults = false;
    
    // Results
    totalRows = 0;
    createdCount = 0;
    updatedCount = 0;
    failedCount = 0;
    errors = [];
    isAsync = false;
    showExampleModal = false;

    xlsxLibraryLoaded = false;

    connectedCallback() {
        loadScript(this, XLSX_LIB + '/build/xlsx.full.min.js')
            .then(() => {
                this.xlsxLibraryLoaded = true;
            })
            .catch(error => {
                console.error('SheetJS library failed to load:', error);
                this.showToast('Warning', 'Excel support unavailable. Only CSV files can be processed.', 'warning');
            });
    }

    // Computed properties
    get disableImport() {
        return !this.fileContent || this.isProcessing;
    }

    get disableReset() {
        return this.isProcessing;
    }

    get hasSuccesses() {
        return this.createdCount > 0 || this.updatedCount > 0;
    }

    get hasErrors() {
        return this.errors && this.errors.length > 0;
    }

    get successMessage() {
        let msg = '';
        if (this.createdCount > 0) {
            msg += `✓ ${this.createdCount} billing schedule${this.createdCount !== 1 ? 's' : ''} created`;
        }
        if (this.updatedCount > 0) {
            if (msg) msg += ' | ';
            msg += `✓ ${this.updatedCount} billing schedule${this.updatedCount !== 1 ? 's' : ''} updated`;
        }
        return msg;
    }

    get errorSectionLabel() {
        return `Errors (${this.failedCount})`;
    }

    /**
     * Handle file upload — supports CSV and Excel (.xlsx / .xls)
     */
    handleFileUpload(event) {
        const file = event.target.files[0];

        if (!file) return;

        const isCSV   = file.name.toLowerCase().endsWith('.csv');
        const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

        if (!isCSV && !isExcel) {
            this.showToast('Invalid File', 'Please select a valid file (.csv, .xlsx or .xls)', 'error');
            return;
        }

        if (isExcel && !this.xlsxLibraryLoaded) {
            this.showToast('Error', 'Excel library is still loading. Please wait a moment and try again, or use a CSV file.', 'error');
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            this.showToast(
                'File Too Large',
                `File size exceeds 5MB limit. Current size: ${this.formatFileSize(file.size)}`,
                'error'
            );
            return;
        }

        this.fileName = file.name;
        this.fileSize = this.formatFileSize(file.size);

        const reader = new FileReader();

        if (isCSV) {
            reader.onload = () => {
                this.fileContent = reader.result;
            };
            reader.onerror = () => {
                this.showToast('Error', 'Failed to read CSV file', 'error');
            };
            reader.readAsText(file);
        } else {
            // Excel: read as ArrayBuffer and convert to CSV via SheetJS
            reader.onload = (e) => {
                try {
                    // eslint-disable-next-line no-undef
                    const XLSX = window.XLSX;
                    const data     = new Uint8Array(e.target.result);
                    // cellDates:true so Date cells become JS Date objects
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const sheet    = workbook.Sheets[workbook.SheetNames[0]];

                    // Convert to array of arrays keeping raw values
                    const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

                    // Normalize Date objects to YYYY-MM-DD strings
                    const normalizedRows = jsonRows.map(row =>
                        row.map(cell => {
                            if (cell instanceof Date) {
                                const y = cell.getFullYear();
                                const m = String(cell.getMonth() + 1).padStart(2, '0');
                                const d = String(cell.getDate()).padStart(2, '0');
                                return `${y}-${m}-${d}`;
                            }
                            return cell;
                        })
                    );

                    // Rebuild as CSV string
                    this.fileContent = normalizedRows
                        .map(row => row.map(cell => {
                            const str = String(cell);
                            return str.includes(',') || str.includes('"') || str.includes('\n')
                                ? `"${str.replace(/"/g, '""')}"`
                                : str;
                        }).join(','))
                        .join('\n');

                } catch (err) {
                    this.showToast('Error', 'Failed to parse Excel file: ' + err.message, 'error');
                }
            };
            reader.onerror = () => {
                this.showToast('Error', 'Failed to read Excel file', 'error');
            };
            reader.readAsArrayBuffer(file);
        }
    }

    /**
     * Handle import action
     */
    async handleImport() {
        if (!this.fileContent) {
            this.showToast('No File', 'Please select a CSV file first', 'warning');
            return;
        }

        this.isProcessing = true;
        this.showResults = false;

        try {
            // Call Apex with null projectId (general import)
            const result = await importBillingSchedules({
                csvContent: this.fileContent,
                projectId: null
            });

            // Process results
            this.processResults(result);

            // Show success toast
            if (result.isAsync) {
                this.showToast(
                    'Processing',
                    'Large file is being processed in background. You will receive an email when complete.',
                    'info'
                );
            } else if (result.failedCount === 0) {
                this.showToast(
                    'Success',
                    `Import completed successfully! ${result.createdCount + result.updatedCount} records processed.`,
                    'success'
                );
            } else if (result.createdCount + result.updatedCount > 0) {
                this.showToast(
                    'Partial Success',
                    `${result.createdCount + result.updatedCount} records processed, ${result.failedCount} failed.`,
                    'warning'
                );
            } else {
                this.showToast(
                    'Import Failed',
                    'No records were imported. Please check the errors below.',
                    'error'
                );
            }

        } catch (error) {
            console.error('Import error:', error);
            this.showToast(
                'Error',
                this.getErrorMessage(error),
                'error'
            );
            this.showResults = false;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Process import results
     */
    processResults(result) {
        this.totalRows = result.totalRows || 0;
        this.createdCount = result.createdCount || 0;
        this.updatedCount = result.updatedCount || 0;
        this.failedCount = result.failedCount || 0;
        this.isAsync = result.isAsync || false;

        // Format errors
        if (result.errors && result.errors.length > 0) {
            this.errors = result.errors.map((error, index) => ({
                key: `error-${index}`,
                row: error.rowNumber || 'N/A',
                message: error.message || 'Unknown error'
            }));
        } else {
            this.errors = [];
        }

        this.showResults = true;
    }

    /**
     * Reset form
     */
    handleReset() {
        // Reset file input
        const fileInput = this.template.querySelector('lightning-input[type="file"]');
        if (fileInput) {
            fileInput.value = '';
        }

        // Reset state
        this.fileName = '';
        this.fileSize = '';
        this.fileContent = '';
        this.showResults = false;
        this.errors = [];
        this.totalRows = 0;
        this.createdCount = 0;
        this.updatedCount = 0;
        this.failedCount = 0;
        this.isAsync = false;
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Extract error message
     */
    getErrorMessage(error) {
        if (error.body) {
            if (error.body.message) {
                return error.body.message;
            }
            if (error.body.pageErrors && error.body.pageErrors.length > 0) {
                return error.body.pageErrors[0].message;
            }
        }
        return error.message || 'An unknown error occurred';
    }

    /**
     * Download a CSV template file
     * Uses data: URI to avoid Salesforce CSP restrictions on Blob/createObjectURL
     */
    handleDownloadCSV() {
        const rows = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS];
        const csvContent = rows.map(row => row.join(',')).join('\n');
        const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'Billing_Schedule_Global_Template.csv');
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Download an Excel (.xlsx) template file
     */
    handleDownloadExcel() {
        if (!this.xlsxLibraryLoaded) {
            this.showToast('Error', 'Excel library is not loaded. Please use CSV download instead.', 'error');
            return;
        }
        try {
            // eslint-disable-next-line no-undef
            const XLSX = window.XLSX;
            const wsData    = [TEMPLATE_HEADERS, ...TEMPLATE_ROWS];
            const worksheet = XLSX.utils.aoa_to_sheet(wsData);
            const workbook  = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Billing Schedules');
            XLSX.writeFile(workbook, 'Billing_Schedule_Global_Template.xlsx');
        } catch (err) {
            this.showToast('Error', 'Failed to generate Excel file: ' + err.message, 'error');
        }
    }

    /**
     * Open example modal
     */
    handleOpenExample() {
        this.showExampleModal = true;
    }

    /**
     * Close example modal
     */
    handleCloseExample() {
        this.showExampleModal = false;
    }

    /**
     * Show toast notification
     */
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant
            })
        );
    }
}
