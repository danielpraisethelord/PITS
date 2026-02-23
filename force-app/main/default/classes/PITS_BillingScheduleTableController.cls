/**
 * Controller for BillingScheduleTable LWC
 * Handles retrieval and update of Billing Schedule records
 */
public with sharing class PITS_BillingScheduleTableController {
    
    /**
     * Retrieves Billing Schedules related to a Project Contract
     * @param recordId - The Id of the Project_Contract__c record
     * @return List of Billing_Schedule__c records with related fields
     */
    @AuraEnabled(cacheable=true)
    public static List<Billing_Schedule__c> getBillingSchedules(Id recordId) {
        try {
            return [
                SELECT 
                    Id,
                    Name,
                    Employee__c,
                    Employee__r.Name,
                    Account__c,
                    Account__r.Name,
                    Start_Date__c,
                    End_Date__c,
                    Hours__c,
                    Months__c,
                    Month_Number__c,
                    Quantity__c,
                    Employee_Bill_Rate__c,
                    Amount__c,
                    Project_Billing__c,
                    RecordType.Name
                FROM Billing_Schedule__c
                WHERE Project_Contract__c = :recordId
                WITH SECURITY_ENFORCED
                ORDER BY Month_Number__c ASC NULLS LAST, Start_Date__c ASC, Name ASC
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving Billing Schedules: ' + e.getMessage());
        }
    }
    
    /**
     * Updates Billing Schedule records with bulk support
     * @param records - List of Billing_Schedule__c records to update
     * @return Success message
     */
    @AuraEnabled
    public static String updateBillingSchedules(List<Billing_Schedule__c> records) {
        try {
            if (records == null || records.isEmpty()) {
                throw new AuraHandledException('No records to update');
            }
            
            // Security check - strip inaccessible fields
            SObjectAccessDecision decision = Security.stripInaccessible(
                AccessType.UPDATABLE,
                records
            );
            
            // Bulk update
            update decision.getRecords();
            
            return 'Successfully updated ' + records.size() + ' record(s)';
            
        } catch (DmlException e) {
            throw new AuraHandledException('Error updating records: ' + e.getDmlMessage(0));
        } catch (Exception e) {
            throw new AuraHandledException('Error updating Billing Schedules: ' + e.getMessage());
        }
    }
    
    /**
     * Deletes a Billing Schedule record
     * @param recordId - The Id of the record to delete
     * @return Success message
     */
    @AuraEnabled
    public static String deleteBillingSchedule(Id recordId) {
        try {
            if (recordId == null) {
                throw new AuraHandledException('Record ID is required');
            }
            
            Billing_Schedule__c record = [
                SELECT Id 
                FROM Billing_Schedule__c 
                WHERE Id = :recordId 
                WITH SECURITY_ENFORCED
                LIMIT 1
            ];
            
            delete record;
            
            return 'Record deleted successfully';
            
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting record: ' + e.getMessage());
        }
    }
}
