import { EmailClassification } from "../types/email-meta.type";

const LABEL_MAP: Record<string, string> = {
  'financial': 'Financial',
  'non-financial:personal': 'Personal',
  'non-financial:appointments': 'Appointment',
  'non-financial:government': 'Government',
  'non-financial:other': 'Other',
};

export function resolveLabelFromClassification(classification: EmailClassification): string {
  if (classification.category.type === 'financial') {
    return LABEL_MAP['financial'];
  }
  return LABEL_MAP[`non-financial:${classification.category.subType}`];
}