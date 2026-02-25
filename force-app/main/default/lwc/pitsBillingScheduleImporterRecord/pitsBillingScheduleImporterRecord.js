import { LightningElement, api, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import importBillingSchedules from '@salesforce/apex/PITS_BillingScheduleImportController.importBillingSchedules';
import XLSX_LIB from '@salesforce/resourceUrl/PITS_SheetJS';

// Template data for downloadable sample files
const TEMPLATE_HEADERS = ['Employee Name', 'Month', 'Start Date', 'End Date', 'Hours', 'Bill Rate', 'Record Type'];
const TEMPLATE_ROWS = [
    ['John Doe', 'Jan', '2026-01-01', '2026-01-31', 160, 150.00, 'Hourly'],
    ['Jane Smith', 'Jan', '2026-01-01', '2026-01-31', 1, 12500.00, 'Monthly_Fixed_Priced'],
    ['John Doe', 'Feb', '2026-02-01', '2026-02-28', 144, 150.00, 'Hourly']
];

export default class PitsBillingScheduleImporterRecord extends LightningElement {
    @api recordId; // Project_Contract__c ID from record page

    xlsxLibraryLoaded = false;

    @track fileName = '';
    @track fileSize = '';
    @track fileContent = '';
    @track isProcessing = false;
    @track showResults = false;
    
    // Result data
    @track totalRows = 0;
    @track createdCount = 0;
    @track updatedCount = 0;
    @track failedCount = 0;
    @track successCount = 0;
    @track errors = [];
    @track resultMessage = '';
    @track isSuccess = false;
    @track showExampleModal = false;

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

    get hasErrors() {
        return this.errors && this.errors.length > 0;
    }

    get errorSectionLabel() {
        return `Errors (${this.failedCount})`;
    }

    get resultBoxClass() {
        if (this.isSuccess) {
            return 'slds-box slds-theme_success slds-var-p-around_medium';
        } else if (this.failedCount > 0 && this.successCount > 0) {
            return 'slds-box slds-theme_warning slds-var-p-around_medium';
        } else {
            return 'slds-box slds-theme_error slds-var-p-around_medium';
        }
    }

    get resultIcon() {
        if (this.isSuccess) {
            return 'utility:success';
        } else if (this.failedCount > 0 && this.successCount > 0) {
            return 'utility:warning';
        } else {
            return 'utility:error';
        }
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
            this.showToast('Error', 'Please select a valid file (.csv, .xlsx or .xls)', 'error');
            return;
        }

        if (isExcel && !this.xlsxLibraryLoaded) {
            this.showToast('Error', 'Excel library is still loading. Please wait a moment and try again, or use a CSV file.', 'error');
            return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showToast('Error', 'File size exceeds 5MB limit', 'error');
            return;
        }

        this.fileName = file.name;
        this.fileSize = this.formatFileSize(file.size);

        const reader = new FileReader();

        if (isCSV) {
            reader.onload = (e) => {
                this.fileContent = e.target.result;
            };
            reader.onerror = () => {
                this.showToast('Error', 'Failed to read CSV file', 'error');
                this.handleClear();
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

                    // Convert to JSON (array of arrays) keeping raw values
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
                            // Quote cells that contain commas, quotes or newlines
                            return str.includes(',') || str.includes('"') || str.includes('\n')
                                ? `"${str.replace(/"/g, '""')}"`
                                : str;
                        }).join(','))
                        .join('\n');

                } catch (err) {
                    this.showToast('Error', 'Failed to parse Excel file: ' + err.message, 'error');
                    this.handleClear();
                }
            };
            reader.onerror = () => {
                this.showToast('Error', 'Failed to read Excel file', 'error');
                this.handleClear();
            };
            reader.readAsArrayBuffer(file);
        }
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Clear file selection
     */
    handleClear() {
        this.fileName = '';
        this.fileSize = '';
        this.fileContent = '';
        this.showResults = false;
        
        // Reset file input
        const fileInput = this.template.querySelector('lightning-input[type="file"]');
        if (fileInput) {
            fileInput.value = '';
        }
    }

    /**
     * Handle import action
     */
    async handleImport() {
        if (!this.fileContent) {
            this.showToast('Error', 'Please select a file first', 'error');
            return;
        }

        if (!this.recordId) {
            this.showToast('Error', 'Project/Contract ID is missing', 'error');
            return;
        }

        this.isProcessing = true;
        this.showResults = false;

        try {
            const result = await importBillingSchedules({
                csvContent: this.fileContent,
                projectId: this.recordId
            });

            // Store results
            this.totalRows = result.totalRows || 0;
            this.createdCount = result.createdCount || 0;
            this.updatedCount = result.updatedCount || 0;
            this.failedCount = result.failedCount || 0;
            this.successCount = result.successCount || 0;
            this.errors = result.errors || [];
            this.resultMessage = result.message || '';
            this.isSuccess = result.isSuccess || false;

            // Show results
            this.showResults = true;

            // Show toast
            if (this.isSuccess) {
                this.showToast(
                    'Success', 
                    `Import completed successfully! Created: ${this.createdCount}, Updated: ${this.updatedCount}`, 
                    'success'
                );
            } else if (this.failedCount > 0 && this.successCount > 0) {
                this.showToast(
                    'Warning', 
                    `Import completed with errors. ${this.successCount} succeeded, ${this.failedCount} failed`, 
                    'warning'
                );
            } else {
                this.showToast(
                    'Error', 
                    `Import failed. Please check the error details below.`, 
                    'error'
                );
            }

            // Dispatch event to refresh related lists
            this.dispatchEvent(new CustomEvent('importcomplete', {
                detail: { success: this.isSuccess },
                bubbles: true,
                composed: true
            }));

        } catch (error) {
            console.error('Import error:', error);
            this.showToast(
                'Error',
                error.body?.message || error.message || 'An unexpected error occurred',
                'error'
            );
            
            // Show error in results
            this.totalRows = 0;
            this.failedCount = 1;
            this.successCount = 0;
            this.errors = [{
                rowNumber: 0,
                errorMessage: error.body?.message || error.message || 'Unknown error',
                rowData: ''
            }];
            this.resultMessage = 'Import failed';
            this.isSuccess = false;
            this.showResults = true;

        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Reset for new import
     */
    handleReset() {
        this.handleClear();
        this.totalRows = 0;
        this.createdCount = 0;
        this.updatedCount = 0;
        this.failedCount = 0;
        this.successCount = 0;
        this.errors = [];
        this.resultMessage = '';
        this.isSuccess = false;
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
        link.setAttribute('download', 'Billing_Schedule_Template.csv');
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
            XLSX.writeFile(workbook, 'Billing_Schedule_Template.xlsx');
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
     * Show toast message
     */
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant,
            mode: variant === 'error' ? 'sticky' : 'dismissable'
        });
        this.dispatchEvent(event);
    }
}
