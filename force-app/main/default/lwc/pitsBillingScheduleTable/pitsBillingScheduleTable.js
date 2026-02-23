import { LightningElement, api, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getBillingSchedules from '@salesforce/apex/PITS_BillingScheduleTableController.getBillingSchedules';
import updateBillingSchedules from '@salesforce/apex/PITS_BillingScheduleTableController.updateBillingSchedules';
import deleteBillingSchedule from '@salesforce/apex/PITS_BillingScheduleTableController.deleteBillingSchedule';

const COLUMNS = [
    {
        label: 'Name',
        fieldName: 'NameUrl',
        type: 'url',
        editable: false,
        sortable: true,
        typeAttributes: {
            label: { fieldName: 'Name' },
            target: '_blank'
        }
    },
    {
        label: 'Employee',
        fieldName: 'EmployeeUrl',
        type: 'url',
        editable: false,
        sortable: true,
        typeAttributes: {
            label: { fieldName: 'EmployeeName' },
            target: '_blank'
        }
    },
    {
        label: 'Account',
        fieldName: 'AccountUrl',
        type: 'url',
        editable: false,
        sortable: true,
        typeAttributes: {
            label: { fieldName: 'AccountName' },
            target: '_blank'
        }
    },
    {
        label: 'Month Number',
        fieldName: 'Month_Number__c',
        type: 'number',
        editable: false,
        sortable: true,
        cellAttributes: { alignment: 'left' }
    },
    {
        label: 'Start Date',
        fieldName: 'Start_Date__c',
        type: 'date',
        editable: true,
        sortable: true
    },
    {
        label: 'End Date',
        fieldName: 'End_Date__c',
        type: 'date',
        editable: true,
        sortable: true
    },
    {
        label: 'Quantity',
        fieldName: 'Quantity__c',
        type: 'number',
        editable: true,
        sortable: true,
        cellAttributes: { alignment: 'left' }
    },
    {
        label: 'Bill Rate',
        fieldName: 'Employee_Bill_Rate__c',
        type: 'currency',
        editable: true,
        sortable: true,
        typeAttributes: {
            currencyCode: 'USD',
            step: '0.01'
        }
    },
    {
        label: 'Amount',
        fieldName: 'Amount__c',
        type: 'currency',
        editable: false,
        sortable: true,
        typeAttributes: {
            currencyCode: 'USD'
        }
    },
    {
        label: 'Record Type',
        fieldName: 'RecordTypeName',
        type: 'text',
        editable: false,
        sortable: true
    },
    {
        type: 'action',
        typeAttributes: {
            rowActions: [
                { label: 'Delete', name: 'delete' }
            ]
        }
    }
];

export default class PitsBillingScheduleTable extends LightningElement {
    @api recordId; // Project_Contract__c record ID
    @track billingSchedules = [];
    @track draftValues = [];
    @track error;
    @track isLoading = false;

    columns = COLUMNS;
    wiredBillingSchedulesResult;

    @wire(getBillingSchedules, { recordId: '$recordId' })
    wiredBillingSchedules(result) {
        this.wiredBillingSchedulesResult = result;
        const { data, error } = result;

        if (data) {
            // Transform data to include related field names and URLs
            let transformedData = data.map(record => ({
                ...record,
                EmployeeName: record.Employee__r ? record.Employee__r.Name : '',
                AccountName: record.Account__r ? record.Account__r.Name : '',
                RecordTypeName: record.RecordType ? record.RecordType.Name : '',
                NameUrl: `/${record.Id}`,
                EmployeeUrl: record.Employee__c ? `/${record.Employee__c}` : null,
                AccountUrl: record.Account__c ? `/${record.Account__c}` : null
            }));

            // Sort by Month_Number__c
            transformedData.sort((a, b) => {
                const monthsA = a.Month_Number__c || 0;
                const monthsB = b.Month_Number__c || 0;
                return monthsA - monthsB;
            });

            this.billingSchedules = transformedData;
            this.error = undefined;
        } else if (error) {
            this.error = error.body?.message || 'Unknown error occurred';
            this.billingSchedules = [];
        }
    }

    get hasRecords() {
        return this.billingSchedules && this.billingSchedules.length > 0;
    }

    handleSave(event) {
        this.isLoading = true;
        const updatedFields = event.detail.draftValues;

        // Prepare records for update
        const recordsToUpdate = updatedFields.map(draft => {
            const fields = { ...draft };
            fields.Id = draft.Id;
            return fields;
        });

        // Call Apex to update records
        updateBillingSchedules({ records: recordsToUpdate })
            .then(() => {
                this.showToast('Success', 'Billing Schedules updated successfully', 'success');
                this.draftValues = [];
                return refreshApex(this.wiredBillingSchedulesResult);
            })
            .catch(error => {
                this.showToast('Error', error.body?.message || 'Error updating records', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleRowAction(event) {
        const actionName = event.detail.action.name;
        const row = event.detail.row;

        switch (actionName) {
            case 'delete':
                this.handleDelete(row.Id);
                break;
            default:
        }
    }

    handleDelete(recordId) {
        if (!confirm('Are you sure you want to delete this billing schedule?')) {
            return;
        }

        this.isLoading = true;
        deleteBillingSchedule({ recordId })
            .then(() => {
                this.showToast('Success', 'Billing Schedule deleted successfully', 'success');
                return refreshApex(this.wiredBillingSchedulesResult);
            })
            .catch(error => {
                this.showToast('Error', error.body?.message || 'Error deleting record', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleRefresh() {
        this.isLoading = true;
        return refreshApex(this.wiredBillingSchedulesResult)
            .then(() => {
                this.showToast('Success', 'Data refreshed', 'success');
            })
            .catch(error => {
                this.showToast('Error', 'Error refreshing data', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(event);
    }
}
