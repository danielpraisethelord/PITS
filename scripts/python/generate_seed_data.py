"""
Script to generate seed data for PITS Salesforce project
Generates:
- 300 Account records (Companies)
- 1000 Contact records (Employees)
"""

import csv
import random
from datetime import datetime

# Spanish company names components
COMPANY_PREFIXES = [
    "Tech", "Digital", "Innovate", "Smart", "Global", "Future", "Advanced", "Cloud",
    "Data", "Cyber", "Net", "Web", "Mobile", "Software", "System", "Info", "Mega",
    "Ultra", "Prime", "Elite", "Pro", "Expert", "Master", "Alpha", "Beta", "Delta"
]

COMPANY_TYPES = [
    "Solutions", "Systems", "Technologies", "Consulting", "Services", "Group", 
    "Corporation", "Industries", "Enterprises", "Labs", "Studios", "Partners",
    "Innovations", "Dynamics", "Digital", "Works", "Tech", "Development"
]

COMPANY_SUFFIXES = ["S.A.", "S.L.", "Inc.", "Ltd.", "Corp.", "Group", ""]

# Spanish first names
FIRST_NAMES = [
    "Juan", "María", "Carlos", "Ana", "Luis", "Carmen", "José", "Isabel", "Miguel", "Laura",
    "Pablo", "Sara", "Alberto", "Sofía", "Daniel", "Elena", "Javier", "Raquel", "Francisco", "Beatriz",
    "Antonio", "Patricia", "Manuel", "Cristina", "David", "Marta", "Pedro", "Lucía", "Ángel", "Rosa",
    "Fernando", "Teresa", "Sergio", "Pilar", "Jorge", "Mercedes", "Rafael", "Dolores", "Alejandro", "Inmaculada",
    "Ramón", "Concepción", "Andrés", "Josefa", "Enrique", "Antonia", "Tomás", "Francisca", "Jesús", "Isabel",
    "Diego", "Silvia", "Rubén", "Nuria", "Álvaro", "Rocío", "Iván", "Amparo", "Óscar", "Montserrat",
    "Víctor", "Consuelo", "Adrián", "Remedios", "Raúl", "Encarnación", "Gonzalo", "Manuela", "Marcos", "Juana",
    "Rodrigo", "Victoria", "Guillermo", "Emilia", "Ignacio", "Marina", "Samuel", "Lidia", "Rubén", "Susana",
    "Hugo", "Miriam", "Martín", "Lorena", "Lucas", "Natalia", "Mateo", "Eva", "Leo", "Clara",
    "Gabriel", "Irene", "Nicolás", "Andrea", "Sebastián", "Julia", "Matías", "Alba", "Adam", "Paula"
]

LAST_NAMES = [
    "García", "Rodríguez", "López", "Martínez", "González", "Fernández", "Sánchez", "Pérez", "Ruiz", "Díaz",
    "Moreno", "Jiménez", "Álvarez", "Romero", "Torres", "Navarro", "Ramírez", "Gil", "Serrano", "Blanco",
    "Molina", "Castro", "Ortiz", "Rubio", "Marín", "Suárez", "Iglesias", "Delgado", "Ortega", "Mora",
    "Herrera", "Vega", "Reyes", "Medina", "Cortés", "Méndez", "Aguilar", "Santos", "Pascual", "Ramos",
    "Lozano", "Cruz", "Benítez", "Cabrera", "Vargas", "Campos", "León", "Cano", "Prieto", "Vázquez"
]

# Job titles and roles
JOB_TITLES = [
    "Senior Developer", "Junior Developer", "Frontend Developer", "Backend Developer", "Full Stack Developer",
    "Tech Lead", "Software Architect", "DevOps Engineer", "Cloud Engineer", "Data Engineer",
    "Project Manager", "Scrum Master", "Product Owner", "Business Analyst", "QA Engineer",
    "QA Tester", "UX Designer", "UI Designer", "Security Engineer", "Database Admin",
    "Mobile Developer", "iOS Developer", "Android Developer", "Data Scientist", "ML Engineer"
]

DEPARTMENTS = ["Engineering", "Quality Assurance", "Design", "Product", "Data", "Security", "Business"]

ROLES = [
    "Full Stack Developer", "Frontend Developer", "Backend Developer", "Tech Lead", "Software Architect",
    "DevOps", "Cloud Specialist", "Data Engineer", "Project Manager", "Scrum Master",
    "Product Owner", "Business Analyst", "QA Tester", "UX/UI Designer", "Security Specialist",
    "DBA", "Mobile Developer", "Data Scientist", "ML Engineer"
]

LEVELS = ["Junior", "Mid-Level", "Senior"]
LANGUAGES = ["Spanish", "English", "French", "German", "Portuguese", "Italian"]

# Spanish cities
CITIES = [
    "Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Málaga", "Murcia", "Palma",
    "Las Palmas", "Bilbao", "Alicante", "Córdoba", "Valladolid", "Vigo", "Gijón"
]


def generate_company_name():
    """Generate a realistic company name"""
    prefix = random.choice(COMPANY_PREFIXES)
    company_type = random.choice(COMPANY_TYPES)
    suffix = random.choice(COMPANY_SUFFIXES)
    
    if suffix:
        return f"{prefix} {company_type} {suffix}"
    else:
        return f"{prefix} {company_type}"


def generate_accounts(count=300):
    """Generate Account CSV with specified count"""
    filename = "Account_Seed.csv"
    
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['Name', 'Phone', 'Website', 'BillingCity', 'BillingCountry', 'Industry', 'Type']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        
        industries = ["Technology", "Consulting", "Software", "IT Services", "Telecommunications", 
                     "Financial Services", "Healthcare", "Retail", "Manufacturing"]
        types = ["Customer", "Partner", "Prospect"]
        
        for i in range(1, count + 1):
            company_name = generate_company_name()
            phone = f"+34 9{random.randint(10000000, 99999999)}"
            website = f"www.{company_name.lower().replace(' ', '').replace('.', '')}.com"
            city = random.choice(CITIES)
            industry = random.choice(industries)
            account_type = random.choice(types)
            
            writer.writerow({
                'Name': company_name,
                'Phone': phone,
                'Website': website,
                'BillingCity': city,
                'BillingCountry': 'Spain',
                'Industry': industry,
                'Type': account_type
            })
    
    print(f"✓ Generated {filename} with {count} companies")
    return filename


def generate_contacts(count=1000):
    """Generate Contact CSV with specified count"""
    filename = "Contact_Seed.csv"
    
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = [
            'FirstName', 'LastName', 'Email', 'Phone', 'Title', 'Department',
            'Role__c', 'PITS_Hourly_rate__c', 'PITS_Hourly_Cost_to_Company__c',
            'PITS_Monthly_Rate__c', 'PITS_Monthly_Cost_to_Company__c',
            'Level__c', 'Languages__c', 'RecordType'
        ]
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        
        for i in range(1, count + 1):
            first_name = random.choice(FIRST_NAMES)
            last_name = random.choice(LAST_NAMES)
            email = f"{first_name.lower()}.{last_name.lower()}{i}@pitstech.com"
            phone = f"+34 6{random.randint(10000000, 99999999)}"
            title = random.choice(JOB_TITLES)
            department = random.choice(DEPARTMENTS)
            role = random.choice(ROLES)
            level = random.choice(LEVELS)
            
            # Calculate rates based on level
            if level == "Junior":
                hourly_rate = random.randint(35, 50)
            elif level == "Mid-Level":
                hourly_rate = random.randint(55, 75)
            else:  # Senior
                hourly_rate = random.randint(75, 100)
            
            hourly_cost = int(hourly_rate * 0.8)
            monthly_rate = hourly_rate * 160
            monthly_cost = hourly_cost * 160
            
            # Random languages (1-3)
            num_languages = random.randint(1, 3)
            languages = ";".join(random.sample(LANGUAGES, num_languages))
            
            writer.writerow({
                'FirstName': first_name,
                'LastName': last_name,
                'Email': email,
                'Phone': phone,
                'Title': title,
                'Department': department,
                'Role__c': role,
                'PITS_Hourly_rate__c': hourly_rate,
                'PITS_Hourly_Cost_to_Company__c': hourly_cost,
                'PITS_Monthly_Rate__c': monthly_rate,
                'PITS_Monthly_Cost_to_Company__c': monthly_cost,
                'Level__c': level,
                'Languages__c': languages,
                'RecordType': 'Employee'
            })
    
    print(f"✓ Generated {filename} with {count} employees")
    return filename


if __name__ == "__main__":
    print("=" * 60)
    print("PITS Data Seeder - Generating CSV files")
    print("=" * 60)
    
    # Generate data
    account_file = generate_accounts(300)
    contact_file = generate_contacts(1000)
    
    print("\n" + "=" * 60)
    print("✓ Data generation complete!")
    print("=" * 60)
    print(f"\nFiles created:")
    print(f"  1. {account_file} (300 companies)")
    print(f"  2. {contact_file} (1000 employees)")
    print("\nNext steps:")
    print("  1. Use Salesforce Inspector Reloaded to import these files")
    print("  2. Import Account_Seed.csv first")
    print("  3. Then import Contact_Seed.csv")
