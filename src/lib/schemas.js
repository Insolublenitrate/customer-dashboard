import { z } from 'zod'

// One schema per entity, shared by the form that collects it and the route
// that stores it. Before this, every POST handler repeated `body.x || null`,
// which silently turned a typo'd number into NULL instead of rejecting it.
//
// HTML inputs always hand back strings, so these coerce: an empty field
// becomes null, a numeric field becomes a number, and anything that cannot be
// a number is an error rather than a quiet null.

const trimmed = z.string().trim()

const optionalText = trimmed
  .transform((v) => v || null)
  .nullish()
  .transform((v) => v ?? null)

// The message goes on z.string() as well as .min(1) so a field that is absent
// entirely reads the same as one left blank, rather than "expected string,
// received undefined".
const requiredText = (label) =>
  z.string(`${label} is required`).trim().min(1, `${label} is required`)

const optionalNumber = z
  .union([z.number(), trimmed])
  .nullish()
  .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), 'Must be a number')

const requiredNumber = (label) =>
  z
    .union([z.number(), trimmed])
    .transform((v) => (v === '' ? NaN : Number(v)))
    .refine((v) => Number.isFinite(v), `${label} must be a number`)

const optionalId = z
  .union([z.number(), trimmed])
  .nullish()
  .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0), 'Invalid selection')

const requiredId = (label) =>
  z
    .union([z.number(), trimmed])
    .transform((v) => (v === '' ? NaN : Number(v)))
    .refine((v) => Number.isInteger(v) && v > 0, `${label} is required`)

// Dates arrive as YYYY-MM-DD from date inputs. Reject anything that is not a
// real calendar date rather than letting Postgres raise it later.
const optionalDate = trimmed
  .nullish()
  .transform((v) => (v === '' || v === null || v === undefined ? null : v))
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), 'Not a valid date')

const enumOf = (values, fallback) =>
  z
    .string()
    .nullish()
    .transform((v) => (values.includes(v) ? v : fallback))

import {
  PROJECT_STATUSES, MACHINE_STATUSES, PO_DIRECTIONS, PO_STATUSES,
  SOURCING_STAGES, CONSUMPTION_LOG_TYPES, ACTION_ITEM_STATUSES,
} from './constants.js'

export const LoginSchema = z.object({
  email: requiredText('Email').refine(
    (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
    'That does not look like an email address'
  ),
  password: requiredText('Password'),
})

export const FacilitySchema = z.object({
  name: requiredText('Facility name'),
  is_mother_location: z.coerce.boolean().nullish().transform((v) => !!v),
  address: optionalText,
  city: optionalText,
  state: optionalText,
  zip: optionalText,
  region: optionalText,
  regulatory_notes: optionalText,
  status: enumOf(['active', 'inactive'], 'active'),
})

export const ContactSchema = z.object({
  facility_id: requiredId('Facility'),
  name: requiredText('Contact name'),
  title: optionalText,
  email: optionalText.refine(
    (v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
    'Not a valid email address'
  ),
  phone: optionalText,
  is_primary: z.coerce.boolean().nullish().transform((v) => !!v),
  notes: optionalText,
})

export const ProjectSchema = z.object({
  facility_id: requiredId('Facility'),
  title: requiredText('Project title'),
  spec_summary: optionalText,
  status: enumOf(PROJECT_STATUSES, 'discovery'),
  quote_value: optionalNumber,
  target_date: optionalDate,
})

export const ProductSchema = z.object({
  name: requiredText('Product name'),
  sku: optionalText,
  unit: trimmed.nullish().transform((v) => v || 'gallon'),
  unit_price: optionalNumber,
  supplier_name: optionalText,
  reorder_lead_time_days: optionalNumber.transform((v) => (v === null ? 14 : v)),
})

export const MachineModelSchema = z.object({
  name: requiredText('Model name'),
  tank_capacity: requiredNumber('Tank capacity').refine((v) => v > 0, 'Tank capacity must be above zero'),
  fill_frequency_per_week: optionalNumber.refine(
    (v) => v === null || v >= 0,
    'Fills per week cannot be negative'
  ),
  notes: optionalText,
})

export const MachineSchema = z.object({
  facility_id: requiredId('Facility'),
  machine_model_id: optionalId,
  sourcing_order_id: optionalId,
  project_id: optionalId,
  default_product_id: optionalId,
  serial_number: optionalText,
  model: optionalText,
  install_date: optionalDate,
  status: enumOf(MACHINE_STATUSES, 'active'),
  tank_capacity: optionalNumber.refine((v) => v === null || v > 0, 'Tank capacity must be above zero'),
  fill_frequency_per_week: optionalNumber.refine((v) => v === null || v >= 0, 'Fills per week cannot be negative'),
  notes: optionalText,
})

export const ActionItemSchema = z.object({
  facility_id: optionalId,
  project_id: optionalId,
  communication_id: optionalId,
  description: requiredText('Description'),
  owner: optionalText,
  due_date: optionalDate,
  status: enumOf(ACTION_ITEM_STATUSES, 'open'),
})

// The create route insists on a facility; editing an existing item does not
// move it, so the base schema leaves the field optional.
export const ActionItemCreateSchema = ActionItemSchema.extend({
  facility_id: requiredId('Facility'),
})

export const ConsumptionLogSchema = z.object({
  product_id: requiredId('Product'),
  machine_id: optionalId,
  type: enumOf(CONSUMPTION_LOG_TYPES, 'usage'),
  quantity: requiredNumber('Quantity'),
  // Only used when this log creates the facility's first stock row for the
  // product; an existing row keeps the unit it already has.
  unit: optionalText,
  logged_at: optionalDate,
  notes: optionalText,
})

const PurchaseOrderItemSchema = z.object({
  product_id: optionalId,
  description: optionalText,
  quantity: optionalNumber.transform((v) => (v === null ? 1 : v)),
  unit_price: optionalNumber,
})

export const PurchaseOrderSchema = z
  .object({
    direction: enumOf(PO_DIRECTIONS, 'incoming'),
    facility_id: optionalId,
    supplier_name: optionalText,
    status: enumOf(PO_STATUSES, 'draft'),
    po_number: optionalText,
    expected_date: optionalDate,
    total_value: optionalNumber,
    notes: optionalText,
    items: z.array(PurchaseOrderItemSchema).nullish().transform((v) => v ?? []),
  })
  // Which party the order names depends on its direction, so the check has to
  // run after both fields are known.
  .refine((o) => o.direction !== 'incoming' || o.facility_id !== null, {
    message: 'Pick the facility this order is going to',
    path: ['facility_id'],
  })
  .refine((o) => o.direction !== 'outgoing' || !!o.supplier_name, {
    message: 'Name the supplier this order is coming from',
    path: ['supplier_name'],
  })

export const SourcingOrderSchema = z.object({
  project_id: optionalId,
  facility_id: optionalId,
  machine_model_id: optionalId,
  supplier_name: requiredText('Supplier name'),
  supplier_country: optionalText,
  quantity: optionalNumber
    .transform((v) => (v === null ? 1 : v))
    .refine((v) => Number.isInteger(v) && v > 0, 'Quantity must be a whole number above zero'),
  stage: enumOf(SOURCING_STAGES, 'order_placed'),
  order_date: optionalDate,
  deposit_amount: optionalNumber,
  deposit_paid_date: optionalDate,
  total_cost: optionalNumber,
  expected_ship_date: optionalDate,
  actual_ship_date: optionalDate,
  expected_arrival_date: optionalDate,
  actual_arrival_date: optionalDate,
  container_number: optionalText,
  vessel_name: optionalText,
  carrier: optionalText,
  port_of_origin: optionalText,
  port_of_destination: optionalText,
  tracking_url: optionalText,
  notes: optionalText,
})

// ---------------------------------------------------------------------------
// Update variants. An edit never moves a record to a different parent — the
// PUT statements do not touch those columns — so the parent FK is dropped
// rather than demanded from a form that has no field for it.

export const ContactUpdateSchema = ContactSchema.omit({ facility_id: true })
export const ProjectUpdateSchema = ProjectSchema.omit({ facility_id: true })
export const MachineUpdateSchema = MachineSchema.omit({ facility_id: true, project_id: true })

// Spelled out rather than derived: the purchase-order PUT edits none of the
// fields the direction rule is about, so carrying that rule over would demand
// a facility the edit form never shows.
export const PurchaseOrderUpdateSchema = z.object({
  status: enumOf(PO_STATUSES, 'draft'),
  po_number: optionalText,
  expected_date: optionalDate,
  total_value: optionalNumber,
  notes: optionalText,
  items: z.array(PurchaseOrderItemSchema).nullish().transform((v) => v ?? []),
})

export const StockThresholdSchema = z.object({
  product_id: requiredId('Product'),
  reorder_threshold: requiredNumber('Reorder threshold').refine((v) => v >= 0, 'Reorder threshold cannot be negative'),
  unit: trimmed.nullish().transform((v) => v || 'gallon'),
})

export const CommunicationReassignSchema = z.object({
  facility_id: requiredId('Facility'),
})

// Turns a failed parse into the shape every route returns on bad input.
export function validationError(result) {
  const first = result.error.issues[0]
  return {
    error: first?.message || 'Invalid input',
    field: first?.path?.join('.') || null,
    issues: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
  }
}
