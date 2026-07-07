import type { EmsQiField, EmsQiFieldOption, EmsQiSection } from "@/lib/ems-qi-types";

const YES_NO_OPTIONS: EmsQiFieldOption[] = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
];

const SCORED_YES_NO_OPTIONS: EmsQiFieldOption[] = [
  { label: "Yes", value: "yes", score: 1 },
  { label: "No", value: "no", score: 0 },
];

const SCORED_YES_NO_NA_OPTIONS: EmsQiFieldOption[] = [
  { label: "Yes", value: "yes", score: 1 },
  { label: "No", value: "no", score: 0 },
  { label: "N/A", value: "na", score: 0 },
];

/**
 * Edit this file to add/remove EMS QA/QI questions and fields.
 * Scored questions use type "scored_select" with score on each option.
 */
export const EMS_QI_FORM_SECTIONS: EmsQiSection[] = [
  {
    id: "call-info",
    title: "Call Information",
    description: "Basic call identifiers. Add or rename fields here as needed.",
    fields: [
      {
        id: "call_date",
        label: "Call Date",
        type: "date",
        required: true,
      },
      {
        id: "call_number",
        label: "Call Number",
        type: "text",
        placeholder: "e.g. 26-1234567",
        hint: "e.g. 26-1234567",
      },
      {
        id: "lead_provider",
        label: "Lead Provider",
        type: "text",
        placeholder: "Name",
      },
      {
        id: "lead_provider_certification",
        label: "Lead Provider Certification",
        type: "select",
        displayAs: "dropdown",
        options: [
          { label: "EMT", value: "emt" },
          { label: "AEMT", value: "aemt" },
          { label: "Paramedic", value: "paramedic" },
          { label: "CCT", value: "cct" },
        ],
      },
      {
        id: "call_type",
        label: "Call Type",
        type: "select",
        displayAs: "dropdown",
        options: [
          { label: "Medical", value: "medical" },
          { label: "Trauma", value: "trauma" },
          { label: "NET/Interfacility", value: "net_interfacility" },
        ],
      },
    ],
  },
  {
    id: "documentation-checklist",
    title: "Documentation Checklist",
    description: "Yes/no documentation criteria for the EMS call review.",
    fields: [
      {
        id: "chief_complaint_documented",
        label: "Chief complaint documented",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_OPTIONS,
      },
      {
        id: "baseline_vitals_documented",
        label: "Baseline vitals documented",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_OPTIONS,
      },
      {
        id: "patient_treatments_response_documented",
        label: "Patient treatments/Response documented",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_OPTIONS,
      },
      {
        id: "physical_exam_documented_per_cc",
        label: "Physical exam documented per c/c",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_OPTIONS,
      },
      {
        id: "narrative_present_and_structured",
        label: "Narrative present and structured",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_OPTIONS,
      },
      {
        id: "all_times_documented_appropriately",
        label: "All times documented appropriately",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_OPTIONS,
      },
    ],
  },
  {
    id: "chief-complaint-applicable",
    title: "If applicable to the chief complaint, symptoms or presentation",
    description: "Mark N/A when the item does not apply to this call.",
    fields: [
      {
        id: "blood_glucose_documented",
        label: "Blood glucose documented",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
      {
        id: "last_known_well_documented",
        label: "Last known well documented",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
      {
        id: "twelve_lead_documented",
        label: "12 lead documented",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
      {
        id: "aspirin_administered_under_10_min",
        label: "Aspirin administered <10 min",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
      {
        id: "vitals_before_and_after_treatment",
        label: "Vitals before and after treatment",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
      {
        id: "hold_restraint_type_documented_with_rationale",
        label: "Hold/restraint type documented with rationale",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
    ],
  },
  {
    id: "time-critical-calls",
    title: "Time Critical Calls",
    description: "Mark N/A when the item does not apply to this call.",
    fields: [
      {
        id: "scene_time_under_10_min",
        label: "Scene time <10 min",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
      {
        id: "scene_delay_time_documented",
        label: "Scene delay time documented",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
      {
        id: "appropriate_alert_called_to_facility",
        label: "Appropriate alert called to facility (Stroke, STEMI, Sepsis, Trauma)",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
      {
        id: "report_completed_within_3_hours",
        label: "Report completed within 3 hours",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
    ],
  },
  {
    id: "als-documentation",
    title: "ALS Documentation",
    description: "Mark N/A when the item does not apply to this call.",
    fields: [
      {
        id: "iv_io_access_documented",
        label: "IV/IO access documented",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
      {
        id: "medication_documented_and_appropriate",
        label: "Medication documented and appropriate (route, dose, etc)",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
      {
        id: "all_procedures_within_scope",
        label: "All procedures within scope",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
      {
        id: "ecg_capnography_import_attempted",
        label: "ECG/Capnography import attempted",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
    ],
  },
  {
    id: "advanced-airway",
    title: "Advanced Airway",
    description: "Complete only when an advanced airway was placed.",
    gate: {
      fieldId: "advanced_airway_placed",
      requiredValue: "yes",
    },
    fields: [
      {
        id: "advanced_airway_placed",
        label: "Was an advanced airway placed?",
        type: "select",
        required: true,
        options: YES_NO_OPTIONS,
      },
      {
        id: "airway_monitoring_appropriate",
        label: "Airway monitoring appropriate",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
      {
        id: "placement_confirmation_reconfirmation_documented",
        label: "Placement confirmation & reconfirmation documented",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
      {
        id: "sedation_given_before_paralytic",
        label: "Sedation given before paralytic",
        type: "scored_select",
        required: true,
        options: SCORED_YES_NO_NA_OPTIONS,
      },
    ],
  },
  {
    id: "comments",
    title: "Comments",
    description: "Narrative feedback included in the export summary.",
    fields: [
      {
        id: "strengths",
        label: "Strengths",
        type: "textarea",
        placeholder: "What went well?",
        includeInSummary: true,
      },
      {
        id: "opportunities",
        label: "Opportunities for Improvement",
        type: "textarea",
        placeholder: "Areas to address",
        includeInSummary: true,
      },
      {
        id: "additional_notes",
        label: "Additional Notes",
        type: "textarea",
        includeInSummary: true,
      },
    ],
  },
];

export const EMS_QI_FORM_VERSION = "1";

export function isEmsQiSectionExpanded(section: EmsQiSection, answers: Record<string, string>): boolean {
  if (!section.gate) return true;
  return answers[section.gate.fieldId] === section.gate.requiredValue;
}

export function isEmsQiFieldActive(
  section: EmsQiSection,
  field: EmsQiField,
  answers: Record<string, string>
): boolean {
  if (!section.gate || field.id === section.gate.fieldId) return true;
  return isEmsQiSectionExpanded(section, answers);
}
