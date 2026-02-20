/**
 * Wrapper class for CSV row data
 */
public class PITS_BillingScheduleImportWrapper {
    
    @AuraEnabled public String companyName { get; set; }
    @AuraEnabled public String projectName { get; set; }
    @AuraEnabled public String employeeName { get; set; }
    @AuraEnabled public String month { get; set; }
    @AuraEnabled public Date startDate { get; set; }
    @AuraEnabled public Date endDate { get; set; }
    @AuraEnabled public Decimal hours { get; set; }
    @AuraEnabled public Decimal billRate { get; set; }
    @AuraEnabled public String recordTypeName { get; set; }
    @AuraEnabled public Integer rowNumber { get; set; }
    
    // Resolved IDs (after lookup)
    @AuraEnabled public Id accountId { get; set; }
    @AuraEnabled public Id projectId { get; set; }
    @AuraEnabled public Id employeeId { get; set; }
    @AuraEnabled public Id recordTypeId { get; set; }
    
    // Validation
    @AuraEnabled public Boolean isValid { get; set; }
    @AuraEnabled public String errorMessage { get; set; }
    
    public PITS_BillingScheduleImportWrapper() {
        this.isValid = true;
        this.errorMessage = '';
    }
}
