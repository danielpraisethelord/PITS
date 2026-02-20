# PITS - Billing Schedule Import System

Sistema completo de importación y gestión de Billing Schedules para Salesforce, desarrollado para el proyecto PITS de La Salle.

## Tabla de Contenidos

- [Descripción General](#-descripción-general)
- [Componentes del Sistema](#-componentes-del-sistema)
- [Arquitectura](#-arquitectura)
- [Pre-requisitos](#-pre-requisitos)
- [Instalación y Deployment](#-instalación-y-deployment)
- [Configuración Post-Deployment](#-configuración-post-deployment)
- [Uso del Sistema](#-uso-del-sistema)
- [Formato de CSV](#-formato-de-csv)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Limitaciones Conocidas](#-limitaciones-conocidas)

---

## Descripción General

Este sistema permite importar Billing Schedules masivamente a través de archivos CSV, con dos modos de operación:

1. **Import General (Tab-level)**: Importa schedules especificando Company, Project, Employee y todos los detalles
2. **Import de Record Page**: Importa schedules para un proyecto específico, solo requiriendo Employee y detalles del schedule

### Características Principales

- ✅ Importación masiva vía CSV (hasta 2,000 registros)
- ✅ Lógica de **Upsert** inteligente basada en Employee + Project + Month
- ✅ Procesamiento asíncrono para archivos grandes (500+ filas)
- ✅ Validación de datos en múltiples niveles
- ✅ Manejo robusto de errores con reportes detallados
- ✅ UI moderna con Lightning Web Components
- ✅ Seguridad a nivel de campo y objeto (WITH SECURITY_ENFORCED)

---

## Componentes del Sistema

### Backend Apex Classes

| Clase | Líneas | Descripción |
|-------|--------|-------------|
| `PITS_BillingScheduleImportController.cls` | 607 | Controlador principal con lógica de parsing, validación y upsert |
| `PITS_BillingScheduleImportWrapper.cls` | ~50 | Wrapper para datos de cada fila del CSV |
| `PITS_BillingScheduleImportResult.cls` | ~80 | Estructura de resultados con contadores y errores |
| `PITS_BillingScheduleImportQueueable.cls` | ~100 | Procesamiento asíncrono para imports grandes |

### Frontend Lightning Web Components

| Componente | Archivos | Target | Descripción |
|------------|----------|--------|-------------|
| `pitsBillingScheduleImporter` | 4 | Tab | Import general con todos los campos |
| `pitsBillingScheduleImporterRecord` | 4 | Record Page | Import para un proyecto específico |
| `billingScheduleTable` | 4 | Record Page | Tabla con inline editing de schedules |

### Data Objects

- `Billing_Schedule__c` - Objeto custom principal
  - Nuevo campo: `Month__c` (Picklist: Jan-Dec)
  - RecordTypes: `Hourly`, `Monthly_Fixed_Priced`
- `Project_Contract__c` - Proyectos/Contratos
- `Project_Member__c` - Miembros del proyecto
- `Contact` - Empleados (RecordType: Employee)
- `Account` - Empresas/Compañías

---

## Arquitectura

### Flujo de Importación

```
CSV Upload → Validation → Parsing → Lookups → Upsert Logic
                                                    ↓
                                    [Employee + Project + Month exist?]
                                                    ↓
                                    YES → Update    NO → Create
                                                    ↓
                                        [Project Member exists?]
                                                    ↓
                                    NO → Create     YES → Skip
                                         (triggers Flow)     (avoids duplicate)
```

### Lógica de Upsert (Clave Única)

El sistema identifica registros duplicados usando la combinación:

```apex
Employee__c + Project_Contract__c + Month__c
```

**Comportamiento:**
- Si existe: **Actualiza** el Billing Schedule existente
- Si no existe: **Crea** nuevo Billing Schedule
- **Project_Member**: Solo se crea si no existe previamente

### Flow Automático

Existe un Flow: `PITS_Create_Billings_By_Project_Member` que auto-genera Billing Schedules cuando se crea un Project_Member. El sistema evita duplicados verificando existencia antes de crear.

---

## Pre-requisitos

### Objetos y Campos Requeridos

1. **Billing_Schedule__c** debe tener:
   - `Month__c` (Picklist con valores: January, February, March, April, May, June, July, August, September, October, November, December)
   - `Employee__c` (Lookup a Contact)
   - `Project_Contract__c` (Lookup a Project_Contract__c)
   - `Account__c` (Lookup a Account)
   - `Start_Date__c`, `End_Date__c` (Date)
   - `Hours__c`, `Employee_Bill_Rate__c`, `Amount__c` (Number)
   - RecordTypes: `Hourly`, `Monthly_Fixed_Priced`

2. **Contact** debe tener:
   - RecordType "Employee" (o similar para empleados)

3. **Account** (empresas) debe existir con nombres únicos

4. **Project_Contract__c** debe existir con nombres únicos

### Permisos Necesarios

El usuario que ejecuta el import necesita:
- Read/Create/Edit en `Billing_Schedule__c`
- Read en `Contact`, `Account`, `Project_Contract__c`, `Project_Member__c`
- Create en `Project_Member__c` (si no existen)

---

## Uso del Sistema

### Import General (desde Tab)

1. Navega al tab **Import Billing Schedules**
2. Prepara tu CSV con **todas estas columnas**:
   ```
   Company Name, Project Name, Employee Name, Month, Start Date, End Date, Hours, Bill Rate, Record Type
   ```
3. Click **Select CSV File** y elige tu archivo
4. Click **Import**
5. Revisa los resultados:
   - Verde: Creados
   - Amarillo: Actualizados
   - Rojo: Errores

### Import desde Record Page

1. Navega a un **Project/Contract** específico
2. Busca el componente **Import Billing Schedules** en la página
3. Prepara tu CSV con **solo estas columnas**:
   ```
   Employee Name, Month, Start Date, End Date, Hours, Bill Rate, Record Type
   ```
4. Click **Select CSV File** y elige tu archivo
5. Click **Import**

### Inline Editing (desde Record Page)

1. En la página del proyecto, busca la tabla **Billing Schedules**
2. Haz doble click en cualquier celda para editarla
3. Edita múltiples campos
4. Click **Save** para guardar todos los cambios
5. O click **Cancel** para descartar

---

## Formato de CSV

### CSV para Import General (Tab)

**Campos requeridos:**

| Campo | Tipo | Formato | Ejemplo | Notas |
|-------|------|---------|---------|-------|
| Company Name | Text | Nombre exacto | `CompanyOnePlus` | Debe existir en Account |
| Project Name | Text | Nombre exacto | `AI implementation` | Debe existir en Project_Contract__c |
| Employee Name | Text | FirstName LastName | `Ajay Haresnape` | Debe existir en Contact |
| Month | Picklist | Full name | `March` | Valores: January-December |
| Start Date | Date | YYYY-MM-DD | `2026-03-01` | ISO 8601 format |
| End Date | Date | YYYY-MM-DD | `2026-03-31` | ISO 8601 format |
| Hours | Number | Decimal | `30` | Horas por semana/mes |
| Bill Rate | Number | Decimal | `75.50` | Employee_Bill_Rate__c |
| Record Type | Text | Developer Name | `Hourly` | `Hourly` o `Monthly_Fixed_Priced` |

**Ejemplo completo:**

```csv
Company Name,Project Name,Employee Name,Month,Start Date,End Date,Hours,Bill Rate,Record Type
CompanyOnePlus,AI implementation,Ajay Haresnape,March,2026-03-01,2026-03-31,30,30,Hourly
CompanyOnePlus,AI implementation,Ajay Haresnape,April,2026-04-01,2026-04-30,30,30,Hourly
TechCorp,Mobile App,María García,January,2026-01-01,2026-01-31,40,85,Monthly_Fixed_Priced
```

### CSV para Import de Record Page

**Campos requeridos** (Company y Project están implícitos):

| Campo | Tipo | Formato | Ejemplo | Notas |
|-------|------|---------|---------|-------|
| Employee Name | Text | FirstName LastName | `Ajay Haresnape` | Debe existir en Contact |
| Month | Picklist | Full name | `March` | Valores: January-December |
| Start Date | Date | YYYY-MM-DD | `2026-03-01` | ISO 8601 format |
| End Date | Date | YYYY-MM-DD | `2026-03-31` | ISO 8601 format |
| Hours | Number | Decimal | `30` | Horas por semana/mes |
| Bill Rate | Number | Decimal | `75.50` | Employee_Bill_Rate__c |
| Record Type | Text | Developer Name | `Hourly` | `Hourly` o `Monthly_Fixed_Priced` |

**Ejemplo completo:**

```csv
Employee Name,Month,Start Date,End Date,Hours,Bill Rate,Record Type
Ajay Haresnape,March,2026-03-01,2026-03-31,30,30,Hourly
Ajay Haresnape,April,2026-04-01,2026-04-30,30,30,Hourly
María García,January,2026-01-01,2026-01-31,40,85,Monthly_Fixed_Priced
```

### Valores Válidos

**Month__c:**
```
January, February, March, April, May, June, July, August, September, October, November, December
```

**Record Type:**
```
Hourly
Monthly_Fixed_Priced
```

### Limitaciones

- **Max file size:** 5 MB
- **Max rows:** 2,000 por import
- **Encoding:** UTF-8 recomendado
- **Delimiter:** Coma (,)
- **Quoted fields:** Soportado para campos con comas

---

## Testing

### Pre-condiciones para Testing

1. **Datos base existentes:**
   ```sql
   -- Verificar que existen Accounts
   SELECT COUNT() FROM Account
   
   -- Verificar que existen Contacts (Employees)
   SELECT COUNT() FROM Contact WHERE RecordType.DeveloperName = 'Employee'
   
   -- Verificar que existen Projects
   SELECT COUNT() FROM Project_Contract__c
   ```

2. **Crear datos mínimos si no existen:**
   ```sql
   -- 1 Account
   INSERT Account (Name = 'Test Company')
   
   -- 1 Contact Employee
   INSERT Contact (FirstName = 'John', LastName = 'Doe', RecordTypeId = [Employee RT])
   
   -- 1 Project
   INSERT Project_Contract__c (Name = 'Test Project', Account__c = [Account Id])
   ```

### Test Case 1: Import General - Crear Nuevos

**CSV:**
```csv
Company Name,Project Name,Employee Name,Month,Start Date,End Date,Hours,Bill Rate,Record Type
Test Company,Test Project,John Doe,January,2026-01-01,2026-01-31,40,100,Hourly
Test Company,Test Project,John Doe,February,2026-02-01,2026-02-28,40,100,Hourly
```

**Resultado esperado:**
- 2 Billing Schedules creados
- 1 Project_Member creado (si no existía)
- Amount__c calculado automáticamente

**Verificación:**
```sql
SELECT Id, Name, Month__c, Employee_Bill_Rate__c, Amount__c 
FROM Billing_Schedule__c 
WHERE Project_Contract__r.Name = 'Test Project'
AND Employee__r.Name = 'John Doe'
ORDER BY Start_Date__c
```

### Test Case 2: Import Record Page - Upsert Existente

**Pre-condición:** Ejecuta Test Case 1 primero

**CSV:**
```csv
Employee Name,Month,Start Date,End Date,Hours,Bill Rate,Record Type
John Doe,January,2026-01-01,2026-01-31,35,120,Hourly
```

**Resultado esperado:**
- 0 creados
- 1 actualizado
- Hours cambia de 40 a 35
- Bill Rate cambia de 100 a 120
- Amount__c recalculado

**Verificación:**
```sql
SELECT Id, Hours__c, Employee_Bill_Rate__c, Amount__c 
FROM Billing_Schedule__c 
WHERE Project_Contract__r.Name = 'Test Project'
AND Employee__r.Name = 'John Doe'
AND Month__c = 'January'
```

### Test Case 3: Manejo de Errores

**CSV con errores intencionales:**
```csv
Company Name,Project Name,Employee Name,Month,Start Date,End Date,Hours,Bill Rate,Record Type
Fake Company,Test Project,John Doe,January,2026-01-01,2026-01-31,40,100,Hourly
Test Company,Fake Project,John Doe,February,2026-02-01,2026-02-28,40,100,Hourly
Test Company,Test Project,Fake Employee,March,2026-03-01,2026-03-31,40,100,Hourly
Test Company,Test Project,John Doe,InvalidMonth,2026-04-01,2026-04-30,40,100,Hourly
Test Company,Test Project,John Doe,May,2026-05-01,2026-05-31,40,100,FakeRecordType
```

**Resultado esperado:**
- 5 errores
- 0 creados
- Error messages específicos para cada fila:
  - Row 2: Company not found
  - Row 3: Project not found
  - Row 4: Employee not found
  - Row 5: Invalid Month value
  - Row 6: Invalid RecordType

### Test Case 4: Procesamiento Asíncrono

**Pre-condición:** Archivo con 550+ filas

**Resultado esperado:**
- Mensaje: "Processing in background. You will receive an email when complete."
- Queueable job encolado
- Email enviado al completar con resumen de resultados

**Verificación:**
```sql
-- Check async job status
SELECT Id, Status, ExtendedStatus, CompletedDate 
FROM AsyncApexJob 
WHERE ApexClass.Name = 'PITS_BillingScheduleImportQueueable'
ORDER BY CreatedDate DESC 
LIMIT 1
```

### Post-condiciones

Después de cada test:
1. Los registros están en la base de datos
2. No hay duplicados para la misma combinación Employee + Project + Month
3. Project_Members existen para todas las combinaciones Employee + Project
4. Todos los campos calculados (Amount__c) son correctos

---

## Troubleshooting

### Problema: "Month__c: bad value for restricted picklist field"

**Causa:** El valor del campo Month no está en el picklist o tiene typo.

**Solución:**
- Usa valores exactos: `January`, `February`, etc. (con mayúscula inicial)
- No uses: `Jan`, `enero`, `1`, etc.

### Problema: "Company 'X' not found"

**Causa:** El nombre del Account no existe o está mal escrito.

**Solución:**
```sql
-- Verificar nombres exactos de Accounts
SELECT Name FROM Account ORDER BY Name

-- Ajustar CSV con nombres exactos
```

### Problema: "Employee 'X Y' not found"

**Causa:** El Contact no existe o no tiene RecordType de Employee.

**Solución:**
```sql
-- Verificar Contacts con full name
SELECT FirstName, LastName, RecordType.Name 
FROM Contact 
WHERE RecordType.DeveloperName = 'Employee'
ORDER BY LastName

-- Formato en CSV: "FirstName LastName"
```

### Problema: Imports duplicando en lugar de actualizar

**Causa:** El campo Month__c está en NULL en registros existentes.

**Solución:**
```sql
-- Identificar registros sin Month
SELECT Id, Name, Start_Date__c 
FROM Billing_Schedule__c 
WHERE Month__c = NULL

-- Actualizar manualmente o vía Data Loader
UPDATE Billing_Schedule__c 
SET Month__c = 'March' 
WHERE Id IN (...)
```

### Problema: "Maximum row limit exceeded"

**Causa:** El CSV tiene más de 2,000 filas.

**Solución:**
- Divide el archivo en múltiples CSVs de máx 2,000 filas cada uno
- Importa uno por uno

### Problema: Procesamiento muy lento

**Causa:** Archivos grandes procesan síncronamente hasta 499 filas.

**Solución:**
- Para 500+ filas, el sistema automáticamente usa procesamiento asíncrono
- Espera el email de confirmación
- O reduce el threshold en el código:
```apex
// En PITS_BillingScheduleImportController.cls
private static final Integer ASYNC_THRESHOLD = 250; // Cambiar de 500 a 250
```

---

## Limitaciones Conocidas

### Limitaciones Funcionales

1. **Upsert requiere Month__c:** Sin este campo, no puede identificar duplicados correctamente
2. **Nombres exactos:** Los lookups son case-sensitive y requieren nombres exactos
3. **No crea Accounts/Contacts:** Solo busca existentes, no crea nuevos
4. **Max 2,000 rows:** Límite por transacción de Salesforce
5. **Single-threading:** Un import a la vez por usuario (procesamiento síncrono)

### Limitaciones de Governor Limits

| Recurso | Límite Sync | Límite Async |
|---------|-------------|--------------|
| DML Statements | 150 | 150 |
| DML Rows | 10,000 | 10,000 |
| SOQL Queries | 100 | 200 |
| Query Rows | 50,000 | 50,000 |
| CPU Time | 10,000ms | 60,000ms |

### Workarounds

**Para imports masivos (10,000+ schedules):**
1. Divide en archivos de 1,500 filas
2. Procesa con intervalos de 1-2 minutos entre imports
3. Considera usar Apex Batch para volúmenes extremos

---

### Queries Útiles

**Ver todos los Billing Schedules de un proyecto:**
```sql
SELECT Id, Name, Employee__r.Name, Month__c, 
       Start_Date__c, End_Date__c, Hours__c, 
       Employee_Bill_Rate__c, Amount__c,
       RecordType.Name
FROM Billing_Schedule__c
WHERE Project_Contract__c = 'a03fj00000h1bWDAAY'
ORDER BY Employee__r.Name, Start_Date__c
```

**Identificar duplicados potenciales:**
```sql
SELECT Employee__c, Project_Contract__c, Month__c, COUNT(Id) cnt
FROM Billing_Schedule__c
WHERE Month__c != NULL
GROUP BY Employee__c, Project_Contract__c, Month__c
HAVING COUNT(Id) > 1
```

**Ver Project Members:**
```sql
SELECT Id, Name, Employee__r.Name, Project__r.Name
FROM Project_Member__c
WHERE Project__c = 'a03fj00000h1bWDAAY'
```