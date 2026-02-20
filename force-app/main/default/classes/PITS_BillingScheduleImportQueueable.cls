/**
 * Queueable class for asynchronous processing of large CSV imports
 * Use this for files with 500+ rows to avoid governor limits
 */
public class PITS_BillingScheduleImportQueueable implements Queueable {
    
    private String csvContent;
    private Id projectId;
    private Id userId;
    
    public PITS_BillingScheduleImportQueueable(String csvContent, Id projectId, Id userId) {
        this.csvContent = csvContent;
        this.projectId = projectId;
        this.userId = userId;
    }
    
    public void execute(QueueableContext context) {
        try {
            // Call the main import method
            PITS_BillingScheduleImportResult result = PITS_BillingScheduleImportController.importBillingSchedules(
                csvContent, 
                projectId
            );
            
            // Send email notification to user
            sendResultEmail(result);
            
        } catch (Exception e) {
            // Send error email
            sendErrorEmail(e);
        }
    }
    
    /**
     * Send success/failure email to user
     */
    private void sendResultEmail(PITS_BillingScheduleImportResult result) {
        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setTargetObjectId(userId);
        email.setSaveAsActivity(false);
        email.setSubject('Billing Schedule Import - ' + (result.isSuccess ? 'Completed' : 'Completed with Errors'));
        
        String body = 'Your Billing Schedule import has completed.\n\n';
        body += 'Results:\n';
        body += '- Total Rows: ' + result.totalRows + '\n';
        body += '- Successful: ' + result.successCount + '\n';
        body += '- Created: ' + result.createdCount + '\n';
        body += '- Updated: ' + result.updatedCount + '\n';
        body += '- Failed: ' + result.failedCount + '\n\n';
        
        if (!result.errors.isEmpty()) {
            body += 'Errors:\n';
            for (PITS_BillingScheduleImportResult.ErrorDetail error : result.errors) {
                body += '- Row ' + error.rowNumber + ': ' + error.errorMessage + '\n';
            }
        }
        
        email.setPlainTextBody(body);
        
        try {
            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ email });
        } catch (Exception e) {
            System.debug('Failed to send email: ' + e.getMessage());
        }
    }
    
    /**
     * Send error email if import fails completely
     */
    private void sendErrorEmail(Exception e) {
        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setTargetObjectId(userId);
        email.setSaveAsActivity(false);
        email.setSubject('Billing Schedule Import - Failed');
        
        String body = 'Your Billing Schedule import has failed.\n\n';
        body += 'Error: ' + e.getMessage() + '\n\n';
        body += 'Stack Trace:\n' + e.getStackTraceString();
        
        email.setPlainTextBody(body);
        
        try {
            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ email });
        } catch (Exception emailEx) {
            System.debug('Failed to send error email: ' + emailEx.getMessage());
        }
    }
}
