import { z } from 'zod';

import { isValidPhoneNumber } from 'libphonenumber-js';

import disposableDomains from 'disposable-email-domains';

const FAKE_DOMAINS = [
  'test.com', 'example.com', 'fake.com', 'demo.com', 'sample.com', 
  'mailinator.com', 'yopmail.com', 'guerrillamail.com', '10minutemail.com',
  'tempmail.com', 'throwawaymail.com', 'temp-mail.org', 'fake-mail.com',
  '123.com', 'abc.com', 'xyz.com', 'domain.com', 'email.com', 'asdf.com',
  'qwer.com', 'zxcv.com', 'fakemail.net', 'spam.com', 'nobody.com'
];

export const projectMilestoneInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, { message: 'Milestone title is required.' }),
  description: z.string().optional().nullable(),
  amount: z.coerce.number().positive({ message: 'Milestone amount must be greater than 0.' }),
  percentage: z.union([z.string(), z.number()]).optional().nullable(),
  due_date: z.string().optional().nullable(),
  linked_stage: z.string().optional().nullable(),
  is_activation_gate: z.boolean().default(false),
});

export type ProjectMilestoneInput = z.infer<typeof projectMilestoneInputSchema>;

export const baseProjectSchema = z.object({
  name: z.string().min(3, { message: 'Project name must be at least 3 characters.' }),
  client_name: z.string().min(2, { message: 'Client name must be at least 2 characters.' }),
  gst_number: z.string().optional(),
  phone: z.string().refine((val) => {
    try {
      return isValidPhoneNumber(val);
    } catch {
      return false;
    }
  }, { message: 'Please enter a valid phone number.' }),
  email: z.union([
    z.literal(''),
    z.string().trim().email({ message: 'Please enter a valid email address.' }).refine((val) => {
      const domain = val.split('@')[1];
      if (!domain) return true;
      const lowerDomain = domain.toLowerCase();
      if (FAKE_DOMAINS.includes(lowerDomain)) return false;
      // Check against standard disposable list
      return !disposableDomains.includes(lowerDomain);
    }, { message: 'Please provide a valid, non-temporary business or personal email.' })
  ]).optional(),
  client_contact: z.string().optional(),
  client_address: z.string().min(10, { message: 'Full address is required.' }),
  state_code: z.string().min(2).max(2, { message: 'State code must be exactly 2 letters (e.g., TX, NY).' }).toUpperCase(),
  site_coordinates: z.string().optional(),
  site_type: z.enum(['residential', 'commercial', 'industrial', 'infrastructure', 'agricultural', 'government', 'semi_government', 'semi-government', 'other']),
  survey_requirements: z.string().min(10, { message: 'Please provide more details on requirements.' }),
  services: z.array(z.string()).min(1, { message: 'Select at least one service.' }),
  amount: z.coerce.number().min(0, { message: 'Project amount must be 0 or greater.' }).default(0),
  bank_account_id: z.string().optional().nullable(),
  payment_method: z.string().optional().nullable(),
  gst_type: z.enum(['no_gst', 'cgst_sgst_2_5', 'cgst_sgst_5', 'igst_5']).default('no_gst'),
  gst_rate: z.coerce.number().min(0).default(0),
  base_amount: z.coerce.number().min(0).optional(),
  gst_amount: z.coerce.number().min(0).optional(),
  milestones: z.array(projectMilestoneInputSchema).optional().default([]),
  target_completion_date: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const date = new Date(val);
        return !isNaN(date.getTime()) && date >= new Date(new Date().setHours(0, 0, 0, 0));
      },
      {
        message: 'Target completion date must be a valid today or future date.',
      }
    ),
});

export const createProjectSchema = baseProjectSchema.refine((data) => {
  const base = Number(data.amount || 0);
  const gstRate = data.gst_rate || (data.gst_type === 'cgst_sgst_2_5' || data.gst_type === 'igst_5' ? 5 : data.gst_type === 'cgst_sgst_5' ? 10 : 0);
  const totalContract = base + Math.round((base * gstRate) / 100);

  if (base > 0 && data.milestones && data.milestones.length > 0) {
    const sum = data.milestones.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
    return Math.abs(sum - totalContract) <= 1 || Math.abs(sum - base) <= 1;
  }
  return true;
}, {
  message: 'Sum of milestone amounts must match the total contract amount.',
  path: ['milestones']
});

export const updateProjectSchema = baseProjectSchema.partial().extend({
  status: z.enum(['lead_created', 'payment_pending', 'payment_done', 'ready_for_dispatch', 'project_created', 'data_collection', 'prototype', 'review', 'field_work', 'data_sync', 'final_review', 'completed']).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
