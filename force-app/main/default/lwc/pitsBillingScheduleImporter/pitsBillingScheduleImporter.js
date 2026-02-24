import { LightningElement } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import importBillingSchedules from '@salesforce/apex/PITS_BillingScheduleImportController.importBillingSchedules';

const MAX_FILE_SIZE = 5242880; // 5MB in bytes

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
     * Handle file upload
     */
    handleFileUpload(event) {
        const file = event.target.files[0];
        
        if (!file) {
            return;
        }

        // Validate file type
        if (!file.name.endsWith('.csv')) {
            this.showToast('Invalid File', 'Please select a CSV file', 'error');
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

        // Read file content
        const reader = new FileReader();
        reader.onload = () => {
            this.fileContent = reader.result;
        };
        reader.onerror = () => {
            this.showToast('Error', 'Failed to read file', 'error');
        };
        reader.readAsText(file);
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
