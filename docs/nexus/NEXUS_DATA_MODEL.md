# NEXUS DATA MODEL

Nexus is a business operating system. The database can be complex, but the user experience must stay simple enough for a fifth grader.

## Core Principle

Users think in outcomes. Nexus thinks in systems.

A user should say:

- Someone called
- I need a quote
- This needs service
- Start this project
- What needs attention today?

Nexus translates that into the right objects, relationships, records, and next actions.

## Six First-Class Nexus Objects

### 1. Organization

Organizations are the hierarchy backbone.

Examples:

- Gate Guard corporate
- Master agent
- Master dealer
- Dealer
- Customer organization
- Partner organization

Primary table:

- organizations

Related tables:

- profiles
- user_permissions
- sales_reps
- commission_config
- dealer_scorecards

### 2. Person

People should not be trapped inside a lead, opportunity, job, or project. One person can relate to many records in different roles.

Examples:

- Property manager
- Regional manager
- Corporate contact
- Billing contact
- Decision maker
- Technician
- Sales rep
- Dealer contact

Primary tables:

- contacts
- profiles
- technicians
- sales_reps

Related tables:

- contact_properties
- opportunity_contacts
- work_order_crew

### 3. Site / Property

Sites and properties are where work, revenue, assets, service, and customers converge.

Primary tables:

- properties
- sites

Related tables:

- devices
- site_assets
- site_asset_terminals
- site_events
- residents
- surveys
- work_orders
- quotes
- contracts
- invoices

Design rule: Nexus should become increasingly site-centric over time.

### 4. Opportunity

Opportunities are the revenue engine. They may originate from a lead, show lead, campaign, referral, dealer, or direct outreach.

Primary tables:

- leads
- show_leads
- opportunities

Related tables:

- companies
- contacts
- properties
- sites
- quotes
- contracts
- activities
- crm_activities
- todos
- attachments
- surveys
- document_signatures

Design rule: a lead should be worked, qualified, converted to an opportunity, and carried into quote, contract, project, site, job, and customer operations.

### 5. Project

Projects are a core Nexus object and must be added as a universal work container.

A project is not merely a task board. A project is a business outcome container.

A project can represent:

- Multifamily install
- Expansion
- Dealer onboarding
- Customer rollout
- Marketing campaign
- EOS rock
- Product launch
- Internal corporate initiative
- Complex service effort

A project can contain:

- Tasks
- People
- Files
- Photos
- Drawings
- Surveys
- Quotes
- Contracts
- Work orders
- Calendar events
- Emails
- Approvals
- Revenue
- Expenses
- Status
- Blockers

Design rule: Projects should feel more powerful than Monday.com or Smartsheet, but much easier. The user should see what we are trying to finish, what is next, who owns it, what is blocked, and what is due today.

Future primary tables to add:

- projects
- project_tasks
- project_members
- project_links
- project_files
- project_updates
- project_milestones

### 6. Operation

Operations are the execution layer after or alongside sales.

Primary tables:

- work_orders
- wo_requests
- field_tickets
- surveys
- site_assets
- inventory_items
- work_order_parts
- work_order_time_entries

Related tables:

- technicians
- sites
- properties
- quotes
- contracts
- invoices
- attachments
- todos

Design rule: the user should not need to know whether something is a work order, field ticket, survey, or asset issue. Nexus should ask simple questions and route the work correctly.

## Knowledge Assets

Nexus must surface knowledge inside the workflow instead of hiding it in separate modules.

Important knowledge sources:

- survey images
- document templates
- manuals
- product manuals
- manual chunks
- KB articles
- attachments

Primary tables:

- surveys
- attachments
- document_templates
- products
- manual_chunks
- kb_articles

Design rule: a user working an opportunity, project, job, or site should automatically see relevant templates, photos, manuals, and documents.

## Money Objects

Money is part of operations, not a disconnected accounting module.

Primary tables:

- quotes
- quote_line_items
- contracts
- invoices
- invoice_line_items
- commission_payouts
- rep_commissions
- dealer_add_ons

Nexus should answer: what money is expected, what is contracted, what has been invoiced, what has been collected, and who gets paid?

## Canonical Sales And Delivery Path

Lead
-> Opportunity
-> Quote
-> Contract
-> Customer / Site
-> Project
-> Work Orders
-> Invoice

The project object may begin at many points, including an opportunity, a job, an EOS rock, a marketing campaign, or an internal initiative.
