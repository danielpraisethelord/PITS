import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import importBillingSchedules from '@salesforce/apex/PITS_BillingScheduleImportController.importBillingSchedules';

export default class PitsBillingScheduleImporterRecord extends LightningElement {
    @api recordId; // Project_Contract__c ID from record page
    
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
     * Handle file upload
     */
    handleFileUpload(event) {
        const file = event.target.files[0];
        
        if (!file) {
            return;
        }

        // Validate file type
        if (!file.name.endsWith('.csv')) {
            this.showToast('Error', 'Please select a CSV file', 'error');
            return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            this.showToast('Error', 'File size exceeds 5MB limit', 'error');
            return;
        }

        this.fileName = file.name;
        this.fileSize = this.formatFileSize(file.size);

        // Read file content
        const reader = new FileReader();
        reader.onload = (e) => {
            this.fileContent = e.target.result;
        };
        reader.onerror = () => {
            this.showToast('Error', 'Failed to read file', 'error');
            this.handleClear();
        };
        reader.readAsText(file);
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
