/**
 * Result wrapper for import operations
 */
public class PITS_BillingScheduleImportResult {
    
    @AuraEnabled public Integer totalRows { get; set; }
    @AuraEnabled public Integer successCount { get; set; }
    @AuraEnabled public Integer createdCount { get; set; }
    @AuraEnabled public Integer updatedCount { get; set; }
    @AuraEnabled public Integer failedCount { get; set; }
    @AuraEnabled public List<ErrorDetail> errors { get; set; }
    @AuraEnabled public Boolean isSuccess { get; set; }
    @AuraEnabled public String message { get; set; }
    
    public class ErrorDetail {
        @AuraEnabled public Integer rowNumber { get; set; }
        @AuraEnabled public String errorMessage { get; set; }
        @AuraEnabled public String rowData { get; set; }
        
        public ErrorDetail(Integer rowNum, String error, String data) {
            this.rowNumber = rowNum;
            this.errorMessage = error;
            this.rowData = data;
        }
    }
    
    public PITS_BillingScheduleImportResult() {
        this.totalRows = 0;
        this.successCount = 0;
        this.createdCount = 0;
        this.updatedCount = 0;
        this.failedCount = 0;
        this.errors = new List<ErrorDetail>();
        this.isSuccess = false;
        this.message = '';
    }
}
