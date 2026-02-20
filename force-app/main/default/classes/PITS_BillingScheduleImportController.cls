/**
 * Controller for Billing Schedule CSV Import
 * Handles parsing, validation, lookup, and upsert of Billing Schedules
 */
public with sharing class PITS_BillingScheduleImportController {
    
    private static final String FIELD_SEPARATOR = ',';
    private static final Integer MAX_ROWS = 2000;
    
    /**
     * Main entry point for CSV import - General (from Tab)
     * @param csvContent - CSV file content as string
     * @param projectId - Optional: If called from record page, pre-filled
     * @return PITS_BillingScheduleImportResult with operation results
     */
    @AuraEnabled
    public static PITS_BillingScheduleImportResult importBillingSchedules(
        String csvContent, 
        Id projectId
    ) {
        PITS_BillingScheduleImportResult result = new PITS_BillingScheduleImportResult();
        
        try {
            // Parse CSV
            List<PITS_BillingScheduleImportWrapper> rows = parseCSV(csvContent, projectId);
            result.totalRows = rows.size();
            
            if (rows.isEmpty()) {
                throw new ImportException('No valid rows found in CSV');
            }
            
            if (rows.size() > MAX_ROWS) {
                throw new ImportException('CSV exceeds maximum of ' + MAX_ROWS + ' rows');
            }
            
            // Perform lookups
            performLookups(rows, projectId);
            
            // Separate valid and invalid rows
            List<PITS_BillingScheduleImportWrapper> validRows = new List<PITS_BillingScheduleImportWrapper>();
            for (PITS_BillingScheduleImportWrapper row : rows) {
                if (!row.isValid) {
                    result.failedCount++;
                    result.errors.add(new PITS_BillingScheduleImportResult.ErrorDetail(
                        row.rowNumber, 
                        row.errorMessage, 
                        formatRowData(row)
                    ));
                } else {
                    validRows.add(row);
                }
            }
            
            // Process valid rows
            if (!validRows.isEmpty()) {
                processImport(validRows, result);
            }
            
            // Build result message
            result.isSuccess = (result.failedCount == 0);
            result.message = buildResultMessage(result);
            
        } catch (Exception e) {
            result.isSuccess = false;
            result.message = 'Import failed: ' + e.getMessage();
            result.errors.add(new PITS_BillingScheduleImportResult.ErrorDetail(
                0, 
                e.getMessage() + ' | ' + e.getStackTraceString(), 
                ''
            ));
        }
        
        return result;
    }
    
    /**
     * Parse CSV content into wrapper objects
     */
    private static List<PITS_BillingScheduleImportWrapper> parseCSV(String csvContent, Id projectId) {
        List<PITS_BillingScheduleImportWrapper> rows = new List<PITS_BillingScheduleImportWrapper>();
        
        // Split into lines
        List<String> lines = csvContent.split('\n');
        if (lines.isEmpty()) {
            return rows;
        }
        
        // Parse header
        String headerLine = lines[0].trim();
        List<String> headers = parseCSVLine(headerLine);
        Map<String, Integer> headerMap = buildHeaderMap(headers);
        
        // Validate required headers
        Boolean isRecordLevel = (projectId != null);
        validateHeaders(headerMap, isRecordLevel);
        
        // Parse data rows
        for (Integer i = 1; i < lines.size(); i++) {
            String line = lines[i].trim();
            if (String.isBlank(line)) {
                continue; // Skip empty lines
            }
            
            try {
                PITS_BillingScheduleImportWrapper row = parseRow(line, headerMap, i + 1, projectId);
                rows.add(row);
            } catch (Exception e) {
                PITS_BillingScheduleImportWrapper errorRow = new PITS_BillingScheduleImportWrapper();
                errorRow.rowNumber = i + 1;
                errorRow.isValid = false;
                errorRow.errorMessage = 'Parse error: ' + e.getMessage();
                rows.add(errorRow);
            }
        }
        
        return rows;
    }
    
    /**
     * Parse a single CSV line handling quoted fields
     */
    private static List<String> parseCSVLine(String line) {
        List<String> fields = new List<String>();
        Boolean inQuotes = false;
        String currentField = '';
        
        for (Integer i = 0; i < line.length(); i++) {
            String c = line.substring(i, i + 1);
            
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                fields.add(currentField.trim());
                currentField = '';
            } else {
                currentField += c;
            }
        }
        fields.add(currentField.trim());
        
        return fields;
    }
    
    /**
     * Build header map for column index lookup
     */
    private static Map<String, Integer> buildHeaderMap(List<String> headers) {
        Map<String, Integer> headerMap = new Map<String, Integer>();
        for (Integer i = 0; i < headers.size(); i++) {
            String header = headers[i].trim().toLowerCase();
            headerMap.put(header, i);
        }
        return headerMap;
    }
    
    /**
     * Validate required headers exist
     */
    private static void validateHeaders(Map<String, Integer> headerMap, Boolean isRecordLevel) {
        List<String> requiredHeaders = new List<String>{
            'employee name', 'month', 'start date', 'end date', 'hours', 'bill rate', 'record type'
        };
        
        if (!isRecordLevel) {
            requiredHeaders.add('company name');
            requiredHeaders.add('project name');
        }
        
        List<String> missingHeaders = new List<String>();
        for (String required : requiredHeaders) {
            if (!headerMap.containsKey(required)) {
                missingHeaders.add(required);
            }
        }
        
        if (!missingHeaders.isEmpty()) {
            throw new ImportException('Missing required headers: ' + String.join(missingHeaders, ', '));
        }
    }
    
    /**
     * Parse a single row into wrapper object
     */
    private static PITS_BillingScheduleImportWrapper parseRow(
        String line, 
        Map<String, Integer> headerMap, 
        Integer rowNumber,
        Id projectId
    ) {
        List<String> fields = parseCSVLine(line);
        PITS_BillingScheduleImportWrapper row = new PITS_BillingScheduleImportWrapper();
        row.rowNumber = rowNumber;
        
        try {
            Boolean isRecordLevel = (projectId != null);
            
            if (!isRecordLevel) {
                row.companyName = getField(fields, headerMap, 'company name');
                row.projectName = getField(fields, headerMap, 'project name');
            } else {
                row.projectId = projectId;
            }
            
            row.employeeName = getField(fields, headerMap, 'employee name');
            row.month = getField(fields, headerMap, 'month');
            row.startDate = Date.valueOf(getField(fields, headerMap, 'start date'));
            row.endDate = Date.valueOf(getField(fields, headerMap, 'end date'));
            row.hours = Decimal.valueOf(getField(fields, headerMap, 'hours'));
            row.billRate = Decimal.valueOf(getField(fields, headerMap, 'bill rate'));
            row.recordTypeName = getField(fields, headerMap, 'record type');
            
            // Validate data
            validateRow(row);
            
        } catch (Exception e) {
            row.isValid = false;
            row.errorMessage = e.getMessage();
        }
        
        return row;
    }
    
    /**
     * Get field value from parsed line
     */
    private static String getField(List<String> fields, Map<String, Integer> headerMap, String fieldName) {
        Integer index = headerMap.get(fieldName.toLowerCase());
        if (index == null || index >= fields.size()) {
            throw new ImportException('Field "' + fieldName + '" not found');
        }
        return fields[index].trim();
    }
    
    /**
     * Validate row data
     */
    private static void validateRow(PITS_BillingScheduleImportWrapper row) {
        List<String> errors = new List<String>();
        
        if (String.isBlank(row.employeeName)) {
            errors.add('Employee Name is required');
        }
        if (String.isBlank(row.month)) {
            errors.add('Month is required');
        }
        if (row.startDate == null) {
            errors.add('Start Date is required');
        }
        if (row.endDate == null) {
            errors.add('End Date is required');
        }
        if (row.startDate != null && row.endDate != null && row.startDate > row.endDate) {
            errors.add('Start Date must be before End Date');
        }
        if (row.hours == null || row.hours <= 0) {
            errors.add('Hours must be greater than 0');
        }
        if (row.billRate == null || row.billRate <= 0) {
            errors.add('Bill Rate must be greater than 0');
        }
        
        if (!errors.isEmpty()) {
            row.isValid = false;
            row.errorMessage = String.join(errors, '; ');
        }
    }
    
    /**
     * Perform all necessary lookups
     */
    private static void performLookups(List<PITS_BillingScheduleImportWrapper> rows, Id projectId) {
        // Collect unique names
        Set<String> companyNames = new Set<String>();
        Set<String> projectNames = new Set<String>();
        Set<String> employeeNames = new Set<String>();
        Set<String> recordTypeNames = new Set<String>();
        
        for (PITS_BillingScheduleImportWrapper row : rows) {
            if (!row.isValid) continue;
            
            if (projectId == null && String.isNotBlank(row.companyName)) {
                companyNames.add(row.companyName);
            }
            if (projectId == null && String.isNotBlank(row.projectName)) {
                projectNames.add(row.projectName);
            }
            if (String.isNotBlank(row.employeeName)) {
                employeeNames.add(row.employeeName);
            }
            if (String.isNotBlank(row.recordTypeName)) {
                recordTypeNames.add(row.recordTypeName);
            }
        }
        
        // Perform lookups
        Map<String, Id> accountMap = lookupAccounts(companyNames);
        Map<String, Id> projectMap = lookupProjects(projectNames);
        Map<String, Id> employeeMap = lookupEmployees(employeeNames);
        Map<String, Id> recordTypeMap = lookupRecordTypes(recordTypeNames, 'Billing_Schedule__c');
        
        // Assign IDs to rows
        for (PITS_BillingScheduleImportWrapper row : rows) {
            if (!row.isValid) continue;
            
            if (projectId == null) {
                row.accountId = accountMap.get(row.companyName);
                row.projectId = projectMap.get(row.projectName);
                
                if (row.accountId == null) {
                    row.isValid = false;
                    row.errorMessage = 'Account "' + row.companyName + '" not found';
                    continue;
                }
                if (row.projectId == null) {
                    row.isValid = false;
                    row.errorMessage = 'Project "' + row.projectName + '" not found';
                    continue;
                }
            }
            
            row.employeeId = employeeMap.get(row.employeeName);
            row.recordTypeId = recordTypeMap.get(row.recordTypeName);
            
            if (row.employeeId == null) {
                row.isValid = false;
                row.errorMessage = 'Employee "' + row.employeeName + '" not found';
                continue;
            }
            if (row.recordTypeId == null) {
                row.isValid = false;
                row.errorMessage = 'Record Type "' + row.recordTypeName + '" not found';
                continue;
            }
        }
    }
    
    /**
     * Lookup Accounts by Name
     */
    private static Map<String, Id> lookupAccounts(Set<String> names) {
        Map<String, Id> resultMap = new Map<String, Id>();
        if (names.isEmpty()) return resultMap;
        
        for (Account acc : [
            SELECT Id, Name 
            FROM Account 
            WHERE Name IN :names 
            WITH SECURITY_ENFORCED
        ]) {
            resultMap.put(acc.Name, acc.Id);
        }
        
        return resultMap;
    }
    
    /**
     * Lookup Projects by Name
     */
    private static Map<String, Id> lookupProjects(Set<String> names) {
        Map<String, Id> resultMap = new Map<String, Id>();
        if (names.isEmpty()) return resultMap;
        
        for (Project_Contract__c proj : [
            SELECT Id, Name 
            FROM Project_Contract__c 
            WHERE Name IN :names 
            WITH SECURITY_ENFORCED
        ]) {
            resultMap.put(proj.Name, proj.Id);
        }
        
        return resultMap;
    }
    
    /**
     * Lookup Employees (Contacts) by full name
     */
    private static Map<String, Id> lookupEmployees(Set<String> names) {
        Map<String, Id> resultMap = new Map<String, Id>();
        if (names.isEmpty()) return resultMap;
        
        // Parse first and last names
        Map<String, String> firstNameMap = new Map<String, String>();
        Map<String, String> lastNameMap = new Map<String, String>();
        
        for (String fullName : names) {
            List<String> nameParts = fullName.split(' ');
            if (nameParts.size() >= 2) {
                String firstName = nameParts[0];
                String lastName = nameParts[nameParts.size() - 1];
                firstNameMap.put(fullName, firstName);
                lastNameMap.put(fullName, lastName);
            }
        }
        
        for (Contact con : [
            SELECT Id, FirstName, LastName, Name 
            FROM Contact 
            WHERE RecordType.DeveloperName = 'Employee'
            WITH SECURITY_ENFORCED
            LIMIT 50000
        ]) {
            String fullName = con.FirstName + ' ' + con.LastName;
            if (names.contains(fullName)) {
                resultMap.put(fullName, con.Id);
            }
        }
        
        return resultMap;
    }
    
    /**
     * Lookup Record Types by Developer Name
     */
    private static Map<String, Id> lookupRecordTypes(Set<String> names, String objectType) {
        Map<String, Id> resultMap = new Map<String, Id>();
        if (names.isEmpty()) return resultMap;
        
        for (RecordType rt : [
            SELECT Id, DeveloperName 
            FROM RecordType 
            WHERE SObjectType = :objectType 
            AND DeveloperName IN :names
        ]) {
            resultMap.put(rt.DeveloperName, rt.Id);
        }
        
        return resultMap;
    }
    
    /**
     * Process import - create/update Project Members and Billing Schedules
     */
    private static void processImport(
        List<PITS_BillingScheduleImportWrapper> rows, 
        PITS_BillingScheduleImportResult result
    ) {
        // Step 1: Ensure Project Members exist
        ensureProjectMembers(rows);
        
        // Step 2: Upsert Billing Schedules
        upsertBillingSchedules(rows, result);
    }
    
    /**
     * Ensure Project Members exist (create if not)
     */
    private static void ensureProjectMembers(List<PITS_BillingScheduleImportWrapper> rows) {
        // Collect unique Employee-Project combinations
        Map<String, Project_Member__c> memberMap = new Map<String, Project_Member__c>();
        Set<Id> projectIds = new Set<Id>();
        Set<Id> employeeIds = new Set<Id>();
        
        for (PITS_BillingScheduleImportWrapper row : rows) {
            String key = row.employeeId + '_' + row.projectId;
            if (!memberMap.containsKey(key)) {
                memberMap.put(key, new Project_Member__c(
                    Employee__c = row.employeeId,
                    Project_Contract__c = row.projectId
                ));
                projectIds.add(row.projectId);
                employeeIds.add(row.employeeId);
            }
        }
        
        // Query existing Project Members
        Set<String> existingKeys = new Set<String>();
        for (Project_Member__c pm : [
            SELECT Employee__c, Project_Contract__c
            FROM Project_Member__c
            WHERE Employee__c IN :employeeIds
            AND Project_Contract__c IN :projectIds
            WITH SECURITY_ENFORCED
        ]) {
            String key = pm.Employee__c + '_' + pm.Project_Contract__c;
            existingKeys.add(key);
        }
        
        // Insert only new Project Members
        List<Project_Member__c> toInsert = new List<Project_Member__c>();
        for (String key : memberMap.keySet()) {
            if (!existingKeys.contains(key)) {
                toInsert.add(memberMap.get(key));
            }
        }
        
        if (!toInsert.isEmpty()) {
            insert toInsert;
        }
    }
    
    /**
     * Upsert Billing Schedules based on Employee + Project + Month
     */
    private static void upsertBillingSchedules(
        List<PITS_BillingScheduleImportWrapper> rows,
        PITS_BillingScheduleImportResult result
    ) {
        // Query existing Billing Schedules
        Set<Id> projectIds = new Set<Id>();
        Set<Id> employeeIds = new Set<Id>();
        
        for (PITS_BillingScheduleImportWrapper row : rows) {
            projectIds.add(row.projectId);
            employeeIds.add(row.employeeId);
        }
        
        Map<String, Billing_Schedule__c> existingMap = new Map<String, Billing_Schedule__c>();
        for (Billing_Schedule__c bs : [
            SELECT Id, Employee__c, Project_Contract__c, Month__c
            FROM Billing_Schedule__c
            WHERE Project_Contract__c IN :projectIds
            AND Employee__c IN :employeeIds
            WITH SECURITY_ENFORCED
        ]) {
            String key = bs.Employee__c + '_' + bs.Project_Contract__c + '_' + bs.Month__c;
            existingMap.put(key, bs);
        }
        
        // Build upsert list
        List<Billing_Schedule__c> toUpsert = new List<Billing_Schedule__c>();
        
        for (PITS_BillingScheduleImportWrapper row : rows) {
            String key = row.employeeId + '_' + row.projectId + '_' + row.month;
            Billing_Schedule__c bs;
            
            if (existingMap.containsKey(key)) {
                // UPDATE existing
                bs = existingMap.get(key);
                result.updatedCount++;
            } else {
                // INSERT new
                bs = new Billing_Schedule__c();
                bs.Employee__c = row.employeeId;
                bs.Project_Contract__c = row.projectId;
                bs.Account__c = row.accountId;
                bs.Month__c = row.month;
                result.createdCount++;
            }
            
            // Set/Update fields
            bs.Start_Date__c = row.startDate;
            bs.End_Date__c = row.endDate;
            bs.Hours__c = row.hours;
            bs.Employee_Bill_Rate__c = row.billRate;
            bs.RecordTypeId = row.recordTypeId;
            bs.Quantity__c = row.hours; // Based on hours
            
            toUpsert.add(bs);
        }
        
        // Perform upsert
        if (!toUpsert.isEmpty()) {
            Database.UpsertResult[] upsertResults = Database.upsert(toUpsert, false);
            
            // Process results
            for (Integer i = 0; i < upsertResults.size(); i++) {
                if (!upsertResults[i].isSuccess()) {
                    result.failedCount++;
                    String errorMsg = '';
                    for (Database.Error err : upsertResults[i].getErrors()) {
                        errorMsg += err.getMessage() + '; ';
                    }
                    result.errors.add(new PITS_BillingScheduleImportResult.ErrorDetail(
                        rows[i].rowNumber,
                        errorMsg,
                        formatRowData(rows[i])
                    ));
                } else {
                    result.successCount++;
                }
            }
        }
    }
    
    /**
     * Format row data for error reporting
     */
    private static String formatRowData(PITS_BillingScheduleImportWrapper row) {
        return String.format(
            'Employee: {0}, Project: {1}, Month: {2}',
            new List<String>{ row.employeeName, row.projectName, row.month }
        );
    }
    
    /**
     * Build result message
     */
    private static String buildResultMessage(PITS_BillingScheduleImportResult result) {
        return String.format(
            'Import completed: {0} total rows, {1} succeeded ({2} created, {3} updated), {4} failed',
            new List<String>{
                String.valueOf(result.totalRows),
                String.valueOf(result.successCount),
                String.valueOf(result.createdCount),
                String.valueOf(result.updatedCount),
                String.valueOf(result.failedCount)
            }
        );
    }
    
    /**
     * Custom exception for import errors
     */
    public class ImportException extends Exception {}
}
