# NEXUS OBJECT RELATIONSHIPS

## Purpose

This document defines how the core Nexus objects should connect so future development does not drift into disconnected modules.

Nexus should feel simple, but the relationship layer underneath can be deep.

## Core Relationship Principle

People, sites, opportunities, projects, and operations should be connected through reusable relationships instead of duplicated inside each module.

A person should not be recreated for every lead.
A property should not be recreated for every quote.
A project should not be isolated from its opportunity, site, work orders, files, and invoices.

## Canonical Sales Path

Lead
-> Opportunity
-> Quote
-> Contract
-> Customer / Site
-> Project
-> Work Orders
-> Invoice

This is the default path, but Nexus should support entry at any point.

Examples:

- A lead can start from a phone call, form, show lead, referral, ARIA search, campaign, or dealer.
- An opportunity can start without a formal lead.
- A project can start from an opportunity, contract, internal initiative, EOS rock, service issue, or marketing campaign.
- A work order can start from a site, project, customer request, inspection, or emergency.

## Lead Relationships

A lead should connect to:

- Organization / dealer
- Assigned rep
- Contact
- Company
- Property / site when known
- Activities
- Todos
- Attachments
- Survey records
- Related opportunity after conversion

Primary tables:

- leads
- show_leads
- contacts
- companies
- properties
- activities
- crm_activities
- todos
- attachments
- opportunities

## Opportunity Relationships

An opportunity should connect to:

- Lead or show lead source
- Contact
- Company
- Property / site
- Rep / owner
- Quotes
- Contracts
- Activities
- Todos
- Attachments
- Surveys
- Project after conversion or approval
- Stage history

Primary tables:

- opportunities
- opportunity_contacts
- opportunity_stage_history
- quotes
- contracts
- activities
- crm_activities
- todos
- attachments
- surveys

## Project Relationships

Projects must become the universal work container.

A project should connect to:

- Organization
- Site / property
- Opportunity
- Quote
- Contract
- Customer
- Work orders
- Tasks
- People / members
- Files
- Survey images
- Drawings
- Calendar events
- Emails
- Invoices
- Project updates
- Blockers

Future tables:

- projects
- project_tasks
- project_members
- project_links
- project_files
- project_updates
- project_milestones

Project links should support many linked object types, including:

- lead
- opportunity
- quote
- contract
- customer
- site
- property
- work_order
- survey
- invoice
- eos_rock
- campaign
- internal_initiative

## Site / Property Relationships

A site or property should connect to:

- Organization / customer
- Contacts
- Company
- Opportunities
- Quotes
- Contracts
- Projects
- Work orders
- Surveys
- Assets
- Devices
- Residents
- Invoices
- Events
- Permits
- Files

Primary tables:

- properties
- sites
- contact_properties
- company_properties
- devices
- site_assets
- site_events
- residents
- permits

## Person Relationships

A person should connect to many objects in roles.

Common roles:

- Primary contact
- Decision maker
- Property manager
- Regional manager
- Corporate contact
- Billing contact
- Site contact
- Technician
- Sales rep
- Dealer contact
- Customer contact

Primary current tables:

- contacts
- profiles
- technicians
- sales_reps
- contact_properties
- opportunity_contacts
- work_order_crew

Future relationship direction:

A universal relationship table may be needed:

entity_people
- id
- entity_type
- entity_id
- person_type
- person_id
- role
- is_primary
- created_at

## Operation Relationships

Operations should connect to:

- Site
- Property
- Customer
- Project
- Work order
- Technician
- Assets
- Parts
- Field ticket
- Survey
- Invoice
- Attachments
- Todos

Primary tables:

- work_orders
- wo_requests
- field_tickets
- work_order_crew
- work_order_parts
- work_order_time_entries
- site_assets
- inventory_items

## Knowledge Relationships

Knowledge assets should surface automatically inside the relevant workflow.

Knowledge assets include:

- Survey images
- Attachments
- Document templates
- Product manuals
- Manual chunks
- KB articles
- Drawings
- Photos

Primary tables:

- surveys
- attachments
- document_templates
- products
- manual_chunks
- kb_articles

Design rule:

A user should not search for knowledge in a separate module. Nexus should surface relevant knowledge based on the lead, opportunity, project, site, job, or product being worked.

## Duplicate Prevention Rule

Before creating any major object, Nexus should check for existing records.

Check before creating:

- Contact
- Company
- Property
- Site
- Lead
- Opportunity
- Customer
- Project
- Work order

The user should be asked in simple language:

"I found something that may already be this. Should I use it or create a new one?"

## Conversion Rules

Lead -> Opportunity
- Carry contact, company, property, notes, source, activities, and attachments.

Opportunity -> Project
- Carry contacts, site/property, quote, contract, survey, tasks, files, and expected revenue.

Opportunity -> Customer / Site
- Create or link customer and site records.

Project -> Work Orders
- Create work orders from project scope, phases, or tasks.

Quote -> Contract
- Carry accepted pricing, scope, terms, and signatory data.

Contract -> Invoice
- Carry billing terms, MRR, setup amounts, phases, and client organization.
