'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectItem } from "@/components/ui/select";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Layers,
  Plus,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Globe,
  Settings,
  ShieldCheck,
  IndianRupee,
  Percent,
  Target,
  Trash2,
  Sparkles,
  Receipt,
  Coins,
  Calculator,
  X,
  Check,
} from 'lucide-react';
import { PremiumDatePicker } from '@/components/ui/PremiumDatePicker';
import { cn, numberToWords } from '@/lib/utils';
import { createProjectSchema, type CreateProjectInput } from '@/validations/project.schema';
import { createProjectAction } from '@/actions/project.actions';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@/hooks/useUser';

type ProjectFormValues = CreateProjectInput;

const STEPS = [
  { id: 1, title: 'Customer & Site', icon: Building2 },
  { id: 2, title: 'Survey Services', icon: Layers },
  { id: 3, title: 'Commercial & Tax', icon: IndianRupee },
  { id: 4, title: 'Milestones', icon: Target },
  { id: 5, title: 'Review & Create', icon: ShieldCheck },
];

import { SearchableSelect } from '@/components/ui/searchable-select';

const STATE_OPTIONS = [
  { value: 'AP', label: 'Andhra Pradesh' },
  { value: 'AR', label: 'Arunachal Pradesh' },
  { value: 'AS', label: 'Assam' },
  { value: 'BR', label: 'Bihar' },
  { value: 'CG', label: 'Chhattisgarh' },
  { value: 'GA', label: 'Goa' },
  { value: 'GJ', label: 'Gujarat' },
  { value: 'HR', label: 'Haryana' },
  { value: 'HP', label: 'Himachal Pradesh' },
  { value: 'JH', label: 'Jharkhand' },
  { value: 'KA', label: 'Karnataka' },
  { value: 'KL', label: 'Kerala' },
  { value: 'MP', label: 'Madhya Pradesh' },
  { value: 'MH', label: 'Maharashtra' },
  { value: 'MN', label: 'Manipur' },
  { value: 'ML', label: 'Meghalaya' },
  { value: 'MZ', label: 'Mizoram' },
  { value: 'NL', label: 'Nagaland' },
  { value: 'OR', label: 'Odisha' },
  { value: 'PB', label: 'Punjab' },
  { value: 'RJ', label: 'Rajasthan' },
  { value: 'SK', label: 'Sikkim' },
  { value: 'TN', label: 'Tamil Nadu' },
  { value: 'TG', label: 'Telangana' },
  { value: 'TR', label: 'Tripura' },
  { value: 'UP', label: 'Uttar Pradesh' },
  { value: 'UK', label: 'Uttarakhand' },
  { value: 'WB', label: 'West Bengal' },
  { value: 'AN', label: 'Andaman and Nicobar Islands' },
  { value: 'CH', label: 'Chandigarh' },
  { value: 'DN', label: 'Dadra and Nagar Haveli and Daman and Diu' },
  { value: 'DL', label: 'Delhi' },
  { value: 'JK', label: 'Jammu and Kashmir' },
  { value: 'LA', label: 'Ladakh' },
  { value: 'LD', label: 'Lakshadweep' },
  { value: 'PY', label: 'Puducherry' },
];

import { WORKFLOW_STAGES } from '@/components/modules/ProjectWorkflowTab';

export const WORKFLOW_STAGE_OPTIONS = [
  {
    value: 'none',
    label: '-- No linked stage --',
    step: '—',
    title: '-- No linked stage --',
    desc: 'Unrestricted (does not block progress)',
    role: null
  },
  ...WORKFLOW_STAGES.map((stg) => ({
    value: stg.statusKey,
    label: `${stg.id}. ${stg.label}`,
    step: String(stg.id).padStart(2, '0'),
    title: stg.label,
    desc: stg.description,
    role: stg.responsibleLabel,
  })),
];

const SERVICES_BY_CATEGORY: Record<string, string[]> = {
  "Accuracy & Survey Work": [
    "River Survey",
    "Nala",
    "MI Tank Survey",
    "Geo Tagging Survey",
    "Mines Survey"
  ],
  "Plot measurement": [
    "Forest measurement",

  ],
  "Bridge survey": [
    "New Bridge",
    "CD Work",
    "Box Culvert",
    "Slab Culvert",
    "Minor Bridge",
    "Major Bridge",
    "Existing Bridge"
  ],
  "Bandara": [
    "Bandara",
    "KT WEIR"
  ],
  "DAM/ Pazar Talav/ MI Tank": [
    "Dam & Mi Tank",
    "Pazar Talav",
    "1-FSL Line Marking",
    "2-L Section, Cross Section, Existing Line"
  ],
  "Canal Survey": [
    "Main Line",
    "DY",
    "Minor",
    "Sub Minor"
  ],
  "Pipeline Survey": [
    "Command area survey",
    "Existing PDN Survey",
    "New Alignment Survey",
    "Rising Main (command + area)"
  ],
  "Road Survey": [
    "Road survey Existing Road",
    "NH,SH",
    "MDR,ODR,VR",
    "Road Survey New alignment",
    "Hamp road survey"
  ]
};

const GST_RATE_OPTIONS = [
  {
    type: 'no_gst' as const,
    rate: 0,
    rateBadge: '0% GST',
    label: 'Exempt / Nil-Rated',
    description: 'No CGST or SGST applied',
    tag: 'Non-Taxable',
  },
  {
    type: 'cgst_sgst_2_5' as const,
    rate: 5,
    rateBadge: '5% Total',
    label: 'CGST + SGST (5%)',
    description: '2.5% CGST + 2.5% SGST',
    tag: 'Intra-State',
  },
  {
    type: 'igst_5' as const,
    rate: 5,
    rateBadge: '5% Total',
    label: 'IGST (5%)',
    description: '5.0% Integrated GST',
    tag: 'Inter-State',
  },
  {
    type: 'cgst_sgst_5' as const,
    rate: 10,
    rateBadge: '10% Total',
    label: 'CGST + SGST (10%)',
    description: '5.0% CGST + 5.0% SGST',
    tag: 'Special Slab',
  },
];

export function ProjectCreationWizard() {
  const { role } = useUser();
  const isSales = false; // Force indigo/blue theme for all roles as requested
  const c = {
    bg: 'bg-indigo-600',
    hoverBg: 'hover:bg-indigo-700',
    hoverBgLight: 'hover:bg-indigo-50 dark:hover:bg-indigo-500/10',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-500/20',
    bgLight: 'bg-indigo-50 dark:bg-indigo-500/10',
    shadow: 'shadow-indigo-550/20',
    shadowMd: 'shadow-indigo-500/10',
    stepActive: 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/30',
    focusWithin: 'group-focus-within:text-indigo-500',
    focusBorder: 'focus:border-indigo-500',
    focusRing: 'focus:ring-indigo-500/10',
    glow: 'bg-indigo-500/10',
    alertBg: 'bg-indigo-50/50 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/20',
    alertIconBg: 'bg-indigo-600',
  };

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [activeCategory, setActiveCategory] = useState<string>("Plot measurement");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [step]);

  const methods = useForm<ProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      client_name: '',
      gst_number: '',
      phone: '',
      email: '',
      client_address: '',
      state_code: 'MH',
      site_type: 'residential',
      survey_requirements: '',
      services: [],
      amount: 0,
      gst_type: 'no_gst',
      gst_rate: 0,
      milestones: [],
    },
    mode: 'onChange',
  });

  const { handleSubmit, formState: { errors }, watch, setValue, trigger } = methods;

  const selectedServices = watch('services') || [];

  const baseAmount = Number(watch('amount') || 0);
  const gstType = watch('gst_type') || 'no_gst';
  const gstRate = (gstType === 'cgst_sgst_2_5' || gstType === 'igst_5') ? 5 : gstType === 'cgst_sgst_5' ? 10 : 0;
  const calculatedGst = Math.round((baseAmount * gstRate) / 100);
  const totalContractValue = baseAmount + calculatedGst;

  const milestones = watch('milestones') || [];
  const milestoneSum = milestones.reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);
  const milestonePct = totalContractValue > 0 ? (milestoneSum / totalContractValue) * 100 : 0;
  const milestoneDiff = totalContractValue - milestoneSum;
  const isMilestonesBalanced = Math.abs(milestoneDiff) <= 1;

  // Auto-sync milestones to totalContractValue whenever contract value changes or when step changes
  useEffect(() => {
    if (totalContractValue <= 0) return;
    const current = watch('milestones') || [];
    if (current.length === 0) return;

    // Single milestone: if 100% or default advance milestone, keep amount synced with total contract value
    if (current.length === 1 && (!current[0].percentage || current[0].percentage === '100')) {
      if (Number(current[0].amount) !== totalContractValue || current[0].percentage !== '100') {
        setValue('milestones', [{
          ...current[0],
          percentage: '100',
          amount: totalContractValue,
        }], { shouldValidate: true });
      }
      return;
    }

    // Multiple milestones: if percentages sum to 100%, rebalance amounts proportionally to new total
    const totalPct = current.reduce((sum: number, m: any) => sum + (parseFloat(m.percentage) || 0), 0);
    const sumAmt = current.reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);
    if (Math.abs(totalPct - 100) <= 0.5 && Math.abs(sumAmt - totalContractValue) > 1) {
      let runningSum = 0;
      const updated = current.map((m: any, idx: number) => {
        const isLast = idx === current.length - 1;
        const pct = parseFloat(m.percentage) || 0;
        const amt = isLast
          ? Math.max(0, totalContractValue - runningSum)
          : Math.round(totalContractValue * (pct / 100));
        runningSum += amt;
        return { ...m, amount: amt };
      });
      setValue('milestones', updated, { shouldValidate: true });
    }
  }, [totalContractValue, step, setValue, watch]);

  const addMilestoneRow = () => {
    const current = watch('milestones') || [];
    const currentSum = current.reduce((sum: number, m: any) => sum + (Number(m.amount) || 0), 0);
    const remainingAmount = Math.max(0, totalContractValue - currentSum);
    const initialAmt = remainingAmount > 0 ? remainingAmount : 0;
    const initialPct = totalContractValue > 0 && initialAmt > 0
      ? ((initialAmt / totalContractValue) * 100).toFixed(1).replace(/\.0$/, '')
      : "";

    const newRow = {
      id: `temp-${Date.now()}-${current.length}`,
      title: current.length === 0 ? "Advance Payment" : `Milestone #${current.length + 1}`,
      amount: initialAmt,
      percentage: initialPct,
      due_date: watch('target_completion_date') || "",
      is_activation_gate: current.length === 0,
      linked_stage: current.length === 0 ? "data_collection" : "",
    };
    setValue('milestones', [...current, newRow], { shouldValidate: true });
  };

  const removeMilestoneRow = (index: number) => {
    const current = [...(watch('milestones') || [])];
    current.splice(index, 1);
    setValue('milestones', current, { shouldValidate: true });
  };

  const updateMilestoneRow = (index: number, field: string, value: any) => {
    const current = [...(watch('milestones') || [])];
    let m = { ...current[index], [field]: value };

    if (field === 'percentage' && totalContractValue > 0 && value !== "") {
      const pct = parseFloat(value);
      if (!isNaN(pct)) {
        m.amount = Math.round(totalContractValue * (pct / 100));
      }
    } else if (field === 'amount' && totalContractValue > 0 && value !== "") {
      const amt = parseFloat(value);
      if (!isNaN(amt)) {
        m.percentage = ((amt / totalContractValue) * 100).toFixed(1).replace(/\.0$/, '');
      }
    }

    current[index] = m;
    setValue('milestones', current, { shouldValidate: true });
  };

  const applyPreset = (preset: '100' | '50_50' | '40_40_20') => {
    if (totalContractValue <= 0) {
      toast.error("Please enter a base commercial amount first.");
      return;
    }

    const dueDate = watch('target_completion_date') || "";

    if (preset === '100') {
      setValue('milestones', [
        {
          id: `temp-${Date.now()}-0`,
          title: "Advance Payment",
          amount: totalContractValue,
          percentage: "100",
          due_date: dueDate,
          is_activation_gate: true,
          linked_stage: "data_collection"
        }
      ], { shouldValidate: true });
    } else if (preset === '50_50') {
      const half = Math.round(totalContractValue / 2);
      setValue('milestones', [
        {
          id: `temp-${Date.now()}-0`,
          title: "50% Mobilization Advance",
          amount: half,
          percentage: "50",
          due_date: "",
          is_activation_gate: true,
          linked_stage: "data_collection"
        },
        {
          id: `temp-${Date.now()}-1`,
          title: "50% Final Deliverables",
          amount: totalContractValue - half,
          percentage: "50",
          due_date: dueDate,
          is_activation_gate: false,
          linked_stage: "final_review"
        }
      ], { shouldValidate: true });
    } else if (preset === '40_40_20') {
      const p1 = Math.round(totalContractValue * 0.4);
      const p2 = Math.round(totalContractValue * 0.4);
      const p3 = totalContractValue - p1 - p2;
      setValue('milestones', [
        {
          id: `temp-${Date.now()}-0`,
          title: "40% Advance Payment",
          amount: p1,
          percentage: "40",
          due_date: "",
          is_activation_gate: true,
          linked_stage: "data_collection"
        },
        {
          id: `temp-${Date.now()}-1`,
          title: "40% Survey Completion",
          amount: p2,
          percentage: "40",
          due_date: "",
          is_activation_gate: false,
          linked_stage: "field_work"
        },
        {
          id: `temp-${Date.now()}-2`,
          title: "20% Final Sign-off",
          amount: p3,
          percentage: "20",
          due_date: dueDate,
          is_activation_gate: false,
          linked_stage: "final_review"
        }
      ], { shouldValidate: true });
    }
  };

  const handleNext = async () => {
    let fieldsToValidate: (keyof ProjectFormValues)[] = [];
    if (step === 1) {
      fieldsToValidate = ['name', 'client_name', 'phone', 'email', 'client_address', 'state_code', 'site_type', 'survey_requirements'];
    } else if (step === 2) {
      fieldsToValidate = ['services'];
    } else if (step === 3) {
      fieldsToValidate = ['amount', 'gst_type'];
    } else if (step === 4) {
      let ms = watch('milestones') || [];
      // Safety auto-balance single 100% milestone before validating
      if (ms.length === 1 && (!ms[0].percentage || ms[0].percentage === '100') && totalContractValue > 0 && Math.abs(Number(ms[0].amount) - totalContractValue) > 1) {
        ms = [{
          ...ms[0],
          percentage: '100',
          amount: totalContractValue,
        }];
        setValue('milestones', ms, { shouldValidate: true });
      }
      if (ms.length > 0) {
        for (let i = 0; i < ms.length; i++) {
          if (!ms[i].title?.trim()) {
            toast.error(`Milestone #${i + 1} requires a title.`);
            return;
          }
          if (Number(ms[i].amount) <= 0) {
            toast.error(`Milestone "${ms[i].title}" amount must be greater than 0.`);
            return;
          }
        }
        const total = totalContractValue;
        const sum = ms.reduce((acc: number, m: any) => acc + (Number(m.amount) || 0), 0);
        if (total > 0 && Math.abs(sum - total) > 1) {
          toast.error(`Total milestone amount (₹${Math.round(sum).toLocaleString('en-IN')}) must equal the contract value (₹${Math.round(total).toLocaleString('en-IN')}).`);
          return;
        }
      }
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => setStep((s) => s - 1);

  const resetFormState = () => {
    methods.reset({
      name: '',
      client_name: '',
      gst_number: '',
      phone: '',
      email: '',
      client_address: '',
      state_code: 'MH',
      site_type: 'residential',
      survey_requirements: '',
      services: [],
      amount: 0,
      gst_type: 'no_gst',
      gst_rate: 0,
      milestones: [],
    });
  };

  const onSubmit = async (data: ProjectFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await createProjectAction(data);
      if (!result) return; // Action was intercepted (e.g., session expired -> redirect to login)

      if (result.success) {
        toast.success('Project Created Successfully', {
          description: 'The new project record and survey workflow have been initialized.',
        });
        setOpen(false);
        setStep(1);
        resetFormState();
      } else {
        toast.error('Unable to Create Project', {
          description: result.error || 'The system was unable to save the new project.',
        });
      }
    } catch (err) {
      toast.error('System Failure', {
        description: 'Failed to communicate with the server database.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) {
        setStep(1);
        resetFormState();
      }
    }}>
      <DialogTrigger asChild>
        <button
          id="btn-establish-project"
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 text-white rounded-2xl font-medium  tracking-wider text-sm transition-all shadow-lg active:scale-95 group",
            c.bg, c.hoverBg, c.shadow
          )}
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
          Add Project
        </button>
      </DialogTrigger>

      <DialogContent className="w-[96vw] max-w-7xl h-[92vh] max-h-[980px] !p-0 !overflow-hidden !border-none !bg-transparent !shadow-none sm:!rounded-none [&>button]:hidden">
        <div className="w-full h-full flex bg-white/95 dark:bg-[#0c101f]/95 backdrop-blur-2xl rounded-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden relative shadow-2xl font-sans">

          {/* ── Left Sidebar Flow ── */}
          <div className="w-80 lg:w-96 bg-slate-50/50 dark:bg-[#080b14]/50 border-r border-slate-200/80 dark:border-white/5 flex flex-col justify-between p-8 lg:p-10 shrink-0 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className={cn("absolute -top-24 -left-24 w-48 h-48 blur-[60px] rounded-full pointer-events-none", c.glow)} />
            <div className={cn("absolute -bottom-24 -right-24 w-48 h-48 blur-[60px] rounded-full pointer-events-none", c.glow)} />

            <div className="space-y-10 relative z-10">
              {/* Header Title */}
              <div className="space-y-4">
                <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border w-max", c.bgLight, c.border)}>
                  <Building2 className={cn("w-4 h-4", c.text)} />
                  <span className={cn("text-sm font-medium uppercase tracking-widest", c.text)}>Setup Wizard</span>
                </div>
                <h4 className="text-3xl font-medium text-slate-800 dark:text-white tracking-tight leading-tight">New Project</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Setup customer details, site category, and required field services.</p>
              </div>

              {/* Steps Progress List */}
              <div className="space-y-6">
                {STEPS.map((s) => {
                  const isActive = step === s.id;
                  const isCompleted = step > s.id;
                  return (
                    <div key={s.id} className="flex items-start gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center font-medium text-sm transition-all duration-300 border shrink-0",
                        isActive ? c.stepActive :
                          isCompleted ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-indigo-500/20" :
                            "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500"
                      )}>
                        {isCompleted ? <CheckCircle2 className="w-5 h-5 text-white" /> : <span>0{s.id}</span>}
                      </div>
                      <div className="pt-0.5">
                        <p className={cn(
                          "text-sm font-medium uppercase tracking-widest leading-none mb-1.5",
                          isActive ? c.text : isCompleted ? "text-emerald-500 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                        )}>Step {s.id}</p>
                        <p className={cn("text-base font-medium transition-colors", isActive ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400")}>{s.title}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>


          </div>

          {/* ── Right Content Area ── */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white/50 dark:bg-[#0c101f]/50">

            {/* Form Fields */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 custom-scrollbar">
              <FormProvider {...methods}>
                <form
                  id="wizard-form"
                  onSubmit={handleSubmit(onSubmit)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                      e.preventDefault();
                    }
                  }}
                  className="w-full max-w-4xl mx-auto space-y-8"
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-8"
                    >
                      {/* Step Header */}
                      <div className="flex items-end justify-between">
                        <div className="space-y-1">
                          <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full uppercase tracking-wider", c.bgLight, c.text)}>
                            Step {step} of {STEPS.length}
                          </span>
                          <h3 className="text-3xl font-medium text-slate-800 dark:text-white tracking-tight pt-2 leading-none">
                            {STEPS.find((s: any) => s.id === step)?.title}
                          </h3>
                        </div>
                        {step === 2 && (
                          <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full shrink-0 mb-1", c.bgLight, c.text)}>
                            {selectedServices.length} Selected
                          </span>
                        )}
                        {step === 4 && (
                          <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full shrink-0 mb-1", c.bgLight, c.text)}>
                            {(watch('milestones') || []).length} Milestones
                          </span>
                        )}
                      </div>

                      {/* STEP 1: Customer & Site Details */}
                      {step === 1 && (
                        <div className="space-y-6">

                          {/* Project Name & Client Entity */}

                          <div className="space-y-2">
                            <label htmlFor="input-name" className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 block px-1">
                              Project Name
                            </label>
                            <div className="relative group">
                              <Building2 className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors z-10 shrink-0", c.focusWithin)} />
                              <input
                                id="input-name"
                                {...methods.register('name')}
                                placeholder="e.g. Pune Highway Survey"
                                className={cn("glass-input h-14 !pl-12 font-medium text-sm placeholder:font-normal placeholder:text-slate-400/70", c.focusBorder, c.focusRing)}
                              />
                            </div>
                            {errors.name && <p className="text-xs font-medium text-rose-500 uppercase tracking-wide px-1">{errors.name.message}</p>}
                          </div>




                          {/* GST Number */}
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label htmlFor="input-client" className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 block px-1">
                                Client / Company Name
                              </label>
                              <div className="relative group">
                                <Globe className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors z-10 shrink-0", c.focusWithin)} />
                                <input
                                  id="input-client"
                                  {...methods.register('client_name')}
                                  placeholder="Individual or Company"
                                  className={cn("glass-input h-14 !pl-12 font-medium text-sm placeholder:font-normal placeholder:text-slate-400/70", c.focusBorder, c.focusRing)}
                                />
                              </div>
                              {errors.client_name && <p className="text-xs font-medium text-rose-500 uppercase tracking-wide px-1">{errors.client_name.message}</p>}
                            </div>
                            <div className="space-y-2">
                              <label htmlFor="input-gst" className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 block px-1">
                                GST Number (Optional)
                              </label>
                              <div className="relative group">
                                <Building2 className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors z-10 shrink-0", c.focusWithin)} />
                                <input
                                  id="input-gst"
                                  {...methods.register('gst_number')}
                                  placeholder="e.g. 27AAAAA0000A1Z5"
                                  className={cn("glass-input h-14 !pl-12 font-medium text-sm placeholder:font-normal placeholder:text-slate-400/70 uppercase", c.focusBorder, c.focusRing)}
                                />
                              </div>
                              {errors.gst_number && <p className="text-xs font-medium text-rose-500 uppercase tracking-wide px-1">{errors.gst_number.message}</p>}
                            </div>
                          </div>

                          {/* Contact Phone & Email */}
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label htmlFor="input-phone" className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 block px-1">
                                Primary Contact (Phone)
                              </label>
                              <div className={cn("relative group phone-input-container glass-input h-14 !p-0 flex items-center transition-all focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10 dark:focus-within:ring-indigo-500/5")}>
                                <Phone className={cn("absolute left-4 w-4 h-4 text-slate-400 transition-colors z-10 shrink-0 group-focus-within:text-indigo-500")} />
                                <Controller
                                  name="phone"
                                  control={methods.control}
                                  render={({ field }) => (
                                    <PhoneInput
                                      {...field}
                                      id="input-phone"
                                      placeholder="+91 98765 43210"
                                      defaultCountry="IN"
                                      international
                                      countryCallingCodeEditable={false}
                                      limitMaxLength={true}
                                      maxLength={15}
                                      className="w-full h-full font-medium text-sm"
                                    />
                                  )}
                                />
                                <style jsx global>{`
                                   .phone-input-container .PhoneInput {
                                     display: flex;
                                     align-items: center;
                                     width: 100%;
                                     height: 100%;
                                   }
                                   .phone-input-container .PhoneInputInput {
                                     background: transparent;
                                     border: none;
                                     outline: none;
                                     font-weight: 500;
                                     font-size: 0.875rem;
                                     color: inherit;
                                     width: 100%;
                                     height: 100%;
                                     padding-right: 1rem;
                                   }
                                   .phone-input-container .PhoneInputInput::placeholder {
                                     font-weight: 400;
                                     color: rgb(148 163 184 / 0.7);
                                   }
                                   .phone-input-container .PhoneInputCountry {
                                     margin-left: 2.75rem;
                                     margin-right: 0.5rem;
                                   }
                                   .phone-input-container .PhoneInputCountryIcon {
                                     display: none !important;
                                   }
                                 `}</style>
                              </div>
                              {errors.phone && <p className="text-xs font-medium text-rose-500 uppercase tracking-wide px-1">{errors.phone.message}</p>}
                            </div>

                            <div className="space-y-2">
                              <label htmlFor="input-email" className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 block px-1">
                                Email Address
                              </label>
                              <div className="relative group">
                                <Mail className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-colors z-10 shrink-0", c.focusWithin)} />
                                <input
                                  id="input-email"
                                  {...methods.register('email')}
                                  placeholder="client@example.com"
                                  className={cn("glass-input h-14 !pl-12 font-medium text-sm placeholder:font-normal placeholder:text-slate-400/70", c.focusBorder, c.focusRing)}
                                />
                              </div>
                              {errors.email && <p className="text-xs font-medium text-rose-500 uppercase tracking-wide px-1">{errors.email.message}</p>}
                            </div>
                          </div>

                          {/* Site Typology & State Code */}
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label htmlFor="input-site-type" className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 block px-1">
                                Site Typology
                              </label>
                              <Controller
                                name="site_type"
                                control={methods.control}
                                render={({ field }) => (
                                  <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    buttonClassName={cn("glass-input h-14 w-full font-medium text-sm text-slate-800 dark:text-white", c.focusBorder, c.focusRing)}
                                  >
                                    <SelectItem value="residential">Residential Site Selection</SelectItem>
                                    <SelectItem value="commercial">Commercial Development Site</SelectItem>
                                    <SelectItem value="industrial">Industrial Complex Site</SelectItem>
                                    <SelectItem value="infrastructure">Infrastructure Route / Utility Site</SelectItem>
                                    <SelectItem value="other">Other / Custom Survey Land</SelectItem>
                                  </Select>
                                )}
                              />
                              {errors.site_type && <p className="text-xs font-medium text-rose-500 uppercase tracking-wide px-1">{errors.site_type.message}</p>}
                            </div>

                            <div className="space-y-2">
                              <label htmlFor="input-state" className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 block px-1">
                                State Code
                              </label>
                              <div className="relative group">
                                <Controller
                                  name="state_code"
                                  control={methods.control}
                                  render={({ field }) => (
                                    <SearchableSelect
                                      value={field.value}
                                      onValueChange={field.onChange}
                                      options={STATE_OPTIONS}
                                      placeholder="Select state..."
                                      searchPlaceholder="Search state..."
                                      buttonClassName={cn("glass-input h-14 w-full font-medium text-sm text-slate-800 dark:text-white", c.focusBorder, c.focusRing)}
                                    />
                                  )}
                                />
                              </div>
                              {errors.state_code && <p className="text-xs font-medium text-rose-500 uppercase tracking-wide px-1">{errors.state_code.message}</p>}
                            </div>
                          </div>

                          {/* Site/Office Address */}
                          <div className="space-y-2">
                            <label htmlFor="textarea-address" className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 block px-1">
                              Site Address
                            </label>
                            <div className="relative group">
                              <MapPin className={cn("absolute left-4 top-5 w-4 h-4 text-slate-400 transition-colors z-10 shrink-0", c.focusWithin)} />
                              <textarea
                                id="textarea-address"
                                {...methods.register('client_address')}
                                placeholder="Enter the complete site location address..."
                                className={cn("glass-input min-h-[90px] py-4 !pl-12 resize-none font-medium text-sm leading-relaxed placeholder:font-normal placeholder:text-slate-400/70", c.focusBorder, c.focusRing)}
                              />
                            </div>
                            {errors.client_address && <p className="text-xs font-medium text-rose-500 uppercase tracking-wide px-1">{errors.client_address.message}</p>}
                          </div>

                          {/* Technical Scope Requirements */}
                          <div className="space-y-2">
                            <label htmlFor="textarea-reqs" className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 block px-1">
                              Technical Scope Requirements
                            </label>
                            <textarea
                              id="textarea-reqs"
                              {...methods.register('survey_requirements')}
                              rows={4}
                              placeholder="Detail critical survey requirements, specific limits, or land conditions..."
                              className={cn("glass-input py-4 px-5 min-h-[100px] text-sm leading-relaxed resize-none font-medium placeholder:font-normal placeholder:text-slate-400/70", c.focusBorder, c.focusRing)}
                            />
                            {errors.survey_requirements && <p className="text-xs font-medium text-rose-500 uppercase tracking-wide px-1">{errors.survey_requirements.message}</p>}
                          </div>

                        </div>
                      )}

                      {/* STEP 2: Survey Services Selection */}
                      {step === 2 && (
                        <div className="space-y-6">
                          {/* Two Column Layout: Categories Left, Sub-categories Right */}
                          <div className="flex gap-6 min-h-[460px] h-[52vh] max-h-[600px] items-stretch">
                            {/* Categories List (Left) */}
                            <div className="w-56 overflow-y-auto space-y-1.5 pr-2 border-r border-slate-200 dark:border-white/5 custom-scrollbar shrink-0">
                              {Object.keys(SERVICES_BY_CATEGORY).map((cat) => {
                                const isCurrent = activeCategory === cat;
                                const countInCat = SERVICES_BY_CATEGORY[cat].filter((s: any) => selectedServices.includes(s)).length;
                                return (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setActiveCategory(cat)}
                                    className={cn(
                                      "w-full text-left px-4 py-3.5 rounded-xl text-xs font-medium tracking-tight transition-all flex items-center justify-between group",
                                      isCurrent
                                        ? cn(c.bg, "text-white shadow-md", c.shadowMd)
                                        : "hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-450"
                                    )}
                                  >
                                    <span className="truncate pr-1">{cat}</span>
                                    {countInCat > 0 && (
                                      <span className={cn(
                                        "text-xs font-medium px-2 py-0.5 rounded-full shrink-0",
                                        isCurrent ? "bg-white text-indigo-600" : cn(c.bgLight, c.text)
                                      )}>
                                        {countInCat}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Sub-categories Grid (Right) */}
                            <div className="flex-1 overflow-y-auto pl-2 pr-1 custom-scrollbar space-y-4">
                              <h4 className="text-xs font-medium uppercase tracking-widest text-slate-400">
                                {activeCategory} Services
                              </h4>

                              <div className="grid grid-cols-1 gap-3">
                                {SERVICES_BY_CATEGORY[activeCategory].map((subCat) => {
                                  const isSelected = selectedServices.includes(subCat);
                                  return (
                                    <button
                                      key={subCat}
                                      type="button"
                                      onClick={() => {
                                        const current = selectedServices;
                                        const next = current.includes(subCat)
                                          ? current.filter((s: any) => s !== subCat)
                                          : [...current, subCat];
                                        setValue('services', next, { shouldValidate: true });
                                      }}
                                      className={cn(
                                        "w-full flex items-center justify-between p-4 rounded-xl border text-xs font-medium text-left transition-all duration-200 group relative",
                                        isSelected
                                          ? cn(c.bg, "border-transparent text-white shadow-md", c.shadowMd)
                                          : cn("bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-350", "hover:border-indigo-500/40")
                                      )}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className={cn(
                                          "w-7 h-7 rounded-lg flex items-center justify-center border transition-all shrink-0",
                                          isSelected ? "bg-white/20 border-white/30" : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                                        )}>
                                          <Settings className={cn("w-3.5 h-3.5", isSelected && "animate-spin-slow")} />
                                        </div>
                                        <span className="tracking-tight leading-snug">{subCat}</span>
                                      </div>

                                      <div className={cn(
                                        "w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0",
                                        isSelected
                                          ? "bg-white border-white text-indigo-600 scale-105"
                                          : "border-slate-300 dark:border-white/20 group-hover:scale-105"
                                      )}>
                                        {isSelected && <CheckCircle2 className={cn("w-3.5 h-3.5 fill-white", c.text)} />}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {errors.services && <p className="text-xs font-medium text-rose-500 uppercase tracking-wide px-1">{errors.services.message}</p>}
                        </div>
                      )}

                      {/* STEP 3: Commercial & Tax */}
                      {step === 3 && (
                        <div className="space-y-6">

                          {/* Commercial Amount & Payment Setup Card */}
                          <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-900/50 backdrop-blur-xl p-6 sm:p-7 shadow-sm space-y-6">

                            {/* Ambient background glow decoration */}
                            <div className="pointer-events-none absolute -top-24 -right-24 w-60 h-60 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl" />
                            <div className="pointer-events-none absolute -bottom-24 -left-24 w-60 h-60 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl" />

                            {/* Header: Title with styled icon and active summary badge */}
                            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200/60 dark:border-white/5">
                              <div className="flex items-center gap-3.5">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 ring-4 ring-indigo-500/10 shrink-0">
                                  <IndianRupee className="w-5 h-5 stroke-[2.2]" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                                      Commercial & Tax Details
                                    </h4>
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40">
                                      Step 3 of 5
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Configure base project value and applicable GST tax slab
                                  </p>
                                </div>
                              </div>

                              {totalContractValue > 0 && (
                                <div className="flex items-center gap-2 self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 shadow-2xs">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400">Total Contract:</span>
                                  <span className="text-sm font-bold nums">₹{totalContractValue.toLocaleString('en-IN')}</span>
                                </div>
                              )}
                            </div>

                            {/* Section 1: Base Commercial Amount */}
                            <div className="relative z-10 space-y-2.5">
                              <div className="flex items-center justify-between px-1">
                                <label htmlFor="input-amount" className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                  <Coins className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>Base Commercial Amount</span>
                                  <span className="text-rose-500">*</span>
                                </label>
                                {baseAmount > 0 && (
                                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic max-w-[280px] truncate text-right">
                                    {numberToWords(baseAmount)}
                                  </span>
                                )}
                              </div>

                              <div className="relative group">
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-indigo-600 dark:text-indigo-400 font-bold text-sm pointer-events-none select-none transition-colors group-focus-within:bg-indigo-600 group-focus-within:text-white shadow-2xs">
                                  <span className="text-base leading-none">₹</span>
                                  <span className="text-[10px] font-bold tracking-widest uppercase opacity-80">INR</span>
                                </div>

                                <input
                                  id="input-amount"
                                  type="number"
                                  min="0"
                                  step="100"
                                  value={watch('amount') ? watch('amount') : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                                    setValue('amount', val, { shouldValidate: true });
                                  }}
                                  placeholder="0"
                                  className={cn(
                                    "glass-input no-spin h-14 !pl-24 !pr-10 font-bold text-xl text-slate-900 dark:text-white placeholder:font-normal placeholder:text-slate-400/60 nums tracking-tight transition-all",
                                    "border-slate-200/90 dark:border-white/10 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15 dark:focus:ring-indigo-500/10 shadow-2xs"
                                  )}
                                />

                                {baseAmount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setValue('amount', 0, { shouldValidate: true })}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
                                    title="Clear amount"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>

                              {/* Quick Add Chips */}
                              <div className="flex flex-wrap items-center gap-1.5 px-1 pt-0.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
                                  <Sparkles className="w-3 h-3 text-indigo-500" /> Quick Add:
                                </span>
                                {[
                                  { label: '+ ₹5,000', add: 5000 },
                                  { label: '+ ₹10,000', add: 10000 },
                                  { label: '+ ₹25,000', add: 25000 },
                                  { label: '+ ₹50,000', add: 50000 },
                                  { label: '+ ₹1,00,000', add: 100000 },
                                ].map((preset) => (
                                  <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => {
                                      const current = Number(watch('amount') || 0);
                                      setValue('amount', current + preset.add, { shouldValidate: true });
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/80 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-800/60 transition active:scale-95 shadow-2xs"
                                  >
                                    {preset.label}
                                  </button>
                                ))}
                              </div>

                              {errors.amount && (
                                <p className="text-xs font-medium text-rose-500 uppercase tracking-wide px-1">
                                  {errors.amount.message}
                                </p>
                              )}
                            </div>

                            {/* Section 2: GST Rate Bracket Cards */}
                            <div className="relative z-10 space-y-2.5 pt-2 border-t border-slate-200/60 dark:border-white/5">
                              <div className="flex items-center justify-between px-1">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                  <Percent className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>GST Rate Bracket</span>
                                  <span className="text-rose-500">*</span>
                                </label>
                                <span className="text-[11px] text-slate-400">
                                  Choose applicable tax classification
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {GST_RATE_OPTIONS.map((opt) => {
                                  const isSelected = gstType === opt.type;
                                  return (
                                    <button
                                      key={opt.type}
                                      type="button"
                                      role="radio"
                                      aria-checked={isSelected}
                                      onClick={() => {
                                        setValue('gst_type', opt.type, { shouldValidate: true });
                                        setValue('gst_rate', opt.rate, { shouldValidate: true });
                                      }}
                                      className={cn(
                                        "relative flex flex-col justify-between p-3.5 rounded-2xl border text-left transition-all duration-200 outline-none group cursor-pointer",
                                        isSelected
                                          ? "bg-gradient-to-br from-indigo-50/90 to-purple-50/40 dark:from-indigo-950/50 dark:to-purple-950/20 border-indigo-500/80 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-md shadow-indigo-500/10"
                                          : "bg-white/70 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50/60 dark:hover:bg-white/[0.04]"
                                      )}
                                    >
                                      <div className="flex items-center justify-between gap-2 w-full mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div
                                            className={cn(
                                              "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all",
                                              isSelected
                                                ? "border-indigo-600 dark:border-indigo-400 bg-indigo-600 dark:bg-indigo-400"
                                                : "border-slate-300 dark:border-white/20 group-hover:border-slate-400"
                                            )}
                                          >
                                            {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                          </div>
                                          <span
                                            className={cn(
                                              "text-xs font-bold tracking-tight truncate transition-colors",
                                              isSelected ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"
                                            )}
                                          >
                                            {opt.label}
                                          </span>
                                        </div>

                                        <span
                                          className={cn(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 transition-colors",
                                            isSelected
                                              ? "bg-indigo-600 text-white shadow-2xs"
                                              : "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                                          )}
                                        >
                                          {opt.rateBadge}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between w-full pt-1.5 border-t border-slate-100 dark:border-white/5">
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                          {opt.description}
                                        </span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 shrink-0 ml-2">
                                          {opt.tag}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Section 3: Live Tax Calculation & Total Valuation Card */}
                            <div className="relative z-10 pt-2 border-t border-slate-200/60 dark:border-white/5">
                              {baseAmount > 0 ? (
                                <div className="rounded-2xl border border-slate-200/90 dark:border-white/10 bg-gradient-to-b from-white to-slate-50/70 dark:from-slate-900/60 dark:to-slate-950/80 shadow-md shadow-slate-900/5 overflow-hidden transition-all">

                                  {/* Summary Header */}
                                  <div className="px-5 py-3 bg-slate-100/70 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Receipt className="w-4 h-4 text-indigo-500" />
                                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                        Commercial Valuation Summary
                                      </span>
                                    </div>
                                    <span className={cn(
                                      "text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border",
                                      gstType === 'no_gst'
                                        ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40"
                                        : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40"
                                    )}>
                                      {gstType === 'no_gst' ? '✓ GST Exempt' : `${gstRate}% GST Active`}
                                    </span>
                                  </div>

                                  {/* Itemized Lines */}
                                  <div className="p-5 space-y-3">
                                    {/* Base Commercial Value */}
                                    <div className="flex items-center justify-between text-xs py-0.5">
                                      <div className="space-y-0.5">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">Base Commercial Value</span>
                                        <p className="text-[11px] text-slate-400">Agreed project fee before taxes</p>
                                      </div>
                                      <span className="font-bold text-sm text-slate-900 dark:text-white nums">
                                        ₹{baseAmount.toLocaleString('en-IN')}
                                      </span>
                                    </div>

                                    <div className="h-px bg-slate-200/70 dark:bg-white/5" />

                                    {/* Tax Breakdown */}
                                    {gstType === 'cgst_sgst_2_5' && (
                                      <div className="space-y-2 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-100/80 dark:border-indigo-900/30">
                                        <div className="flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
                                          <span className="flex items-center gap-1.5 font-medium">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            Central GST (CGST @ 2.5%)
                                          </span>
                                          <span className="font-bold nums text-indigo-600 dark:text-indigo-400">
                                            + ₹{Math.round(baseAmount * 0.025).toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
                                          <span className="flex items-center gap-1.5 font-medium">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            State GST (SGST @ 2.5%)
                                          </span>
                                          <span className="font-bold nums text-indigo-600 dark:text-indigo-400">
                                            + ₹{Math.round(baseAmount * 0.025).toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {gstType === 'igst_5' && (
                                      <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-100/80 dark:border-indigo-900/30">
                                        <div className="flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
                                          <span className="flex items-center gap-1.5 font-medium">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            Integrated GST (IGST @ 5.0%)
                                          </span>
                                          <span className="font-bold nums text-indigo-600 dark:text-indigo-400">
                                            + ₹{Math.round(baseAmount * 0.05).toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {gstType === 'cgst_sgst_5' && (
                                      <div className="space-y-2 bg-indigo-50/40 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-100/80 dark:border-indigo-900/30">
                                        <div className="flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
                                          <span className="flex items-center gap-1.5 font-medium">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            Central GST (CGST @ 5.0%)
                                          </span>
                                          <span className="font-bold nums text-indigo-600 dark:text-indigo-400">
                                            + ₹{Math.round(baseAmount * 0.05).toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200">
                                          <span className="flex items-center gap-1.5 font-medium">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            State GST (SGST @ 5.0%)
                                          </span>
                                          <span className="font-bold nums text-indigo-600 dark:text-indigo-400">
                                            + ₹{Math.round(baseAmount * 0.05).toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {(!gstType || gstType === 'no_gst') && (
                                      <div className="flex items-center justify-between text-xs py-1 px-3 bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-100/80 dark:border-emerald-900/30">
                                        <div className="space-y-0.5">
                                          <span className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
                                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                            Tax Status: Exempt
                                          </span>
                                          <p className="text-[11px] text-slate-400">No GST applicable (Nil-rated / unregistered client)</p>
                                        </div>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400 nums">
                                          ₹0 (0%)
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Hero Grand Total Banner */}
                                  <div className="p-5 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-indigo-500/10 dark:from-emerald-950/40 dark:via-slate-900 dark:to-indigo-950/40 border-t border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                                          Total Agreed Contract Value
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium italic">
                                        {numberToWords(totalContractValue)}
                                      </p>
                                    </div>

                                    <div className="text-left sm:text-right">
                                      <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 nums tracking-tight">
                                        ₹{totalContractValue.toLocaleString('en-IN')}
                                      </div>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Final Payable Total
                                      </span>
                                    </div>
                                  </div>

                                </div>
                              ) : (
                                <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200/80 dark:border-white/10 text-center bg-slate-50/50 dark:bg-white/[0.01] space-y-2">
                                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 mx-auto flex items-center justify-center">
                                    <Calculator className="w-5 h-5" />
                                  </div>
                                  <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Ready for Pricing Calculation
                                  </h5>
                                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                    Enter the base commercial amount above to see instant tax calculations and the total contract value.
                                  </p>
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                      )}

                      {/* STEP 4: Payment Milestones */}
                      {step === 4 && (
                        <div className="space-y-6">
                          {/* Top Summary Card */}
                          <div className="glass-card bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/10 rounded-2xl p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Contract Value</p>
                                <p className="text-xl font-bold text-slate-900 dark:text-white">
                                  ₹{totalContractValue.toLocaleString('en-IN')}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 text-xs font-medium">
                                <div>
                                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Allocated</span>
                                  <span className={cn("font-bold text-sm", isMilestonesBalanced ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                                    ₹{Math.round(milestoneSum).toLocaleString('en-IN')} ({milestonePct.toFixed(0)}%)
                                  </span>
                                </div>
                                <div className="border-l border-slate-200 dark:border-white/10 pl-4">
                                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Remaining</span>
                                  <span className={cn("font-bold text-sm", isMilestonesBalanced ? "text-emerald-600 dark:text-emerald-400" : milestoneDiff < 0 ? "text-rose-500" : "text-slate-700 dark:text-slate-300")}>
                                    ₹{Math.round(Math.abs(milestoneDiff)).toLocaleString('en-IN')} {milestoneDiff < 0 ? 'over' : ''}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-2 w-full bg-slate-200/80 dark:bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full transition-all duration-300 rounded-full",
                                  isMilestonesBalanced ? "bg-emerald-500" : milestoneSum > totalContractValue ? "bg-rose-500" : "bg-indigo-600"
                                )}
                                style={{ width: `${Math.min(100, Math.max(0, milestonePct))}%` }}
                              />
                            </div>

                            {/* Preset Buttons Bar */}
                            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/60 dark:border-white/5">
                              <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                Presets:
                              </span>
                              <button
                                type="button"
                                onClick={() => applyPreset('100')}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition"
                              >
                                100% Advance
                              </button>
                              <button
                                type="button"
                                onClick={() => applyPreset('50_50')}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition"
                              >
                                50% - 50%
                              </button>
                              <button
                                type="button"
                                onClick={() => applyPreset('40_40_20')}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition"
                              >
                                40% - 40% - 20%
                              </button>
                              <button
                                type="button"
                                onClick={addMilestoneRow}
                                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center gap-1.5 shadow-sm"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add Milestone
                              </button>
                            </div>
                          </div>

                          {/* Milestone Rows */}
                          {milestones.length === 0 ? (
                            <div className="text-center py-10 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01]">
                              <Target className="w-10 h-10 text-indigo-500 mx-auto mb-2 opacity-80" />
                              <h4 className="text-sm font-bold text-slate-800 dark:text-white">Single 100% Advance Payment (Default)</h4>
                              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                                No custom milestones configured. The full contract value of ₹{totalContractValue.toLocaleString('en-IN')} will be created as a single advance payment milestone.
                              </p>
                              <div className="mt-4 flex justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={addMilestoneRow}
                                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Add Custom Milestones
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3.5">
                              {milestones.map((m: any, idx: number) => (
                                <div
                                  key={m.id || idx}
                                  className="p-5 rounded-2xl bg-white dark:bg-[#151923] border border-slate-200 dark:border-white/10 shadow-sm relative group space-y-3.5"
                                >
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                        <Target className="w-3.5 h-3.5" />
                                        Milestone #{idx + 1}
                                      </span>
                                      {(() => {
                                        const stage = WORKFLOW_STAGE_OPTIONS.find((s) => s.value === m.linked_stage);
                                        if (!stage || stage.value === 'none') return null;
                                        return (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-500/30">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            Unlocks Stage {stage.step}: {stage.title}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeMilestoneRow(idx)}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                                      title="Remove Milestone"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <div>
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                      Milestone Title
                                    </label>
                                    <input
                                      type="text"
                                      value={m.title || ''}
                                      onChange={(e) => updateMilestoneRow(idx, 'title', e.target.value)}
                                      placeholder="e.g. 50% Mobilization Advance"
                                      className="glass-input h-10 font-medium text-xs text-slate-800 dark:text-white"
                                    />
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                        Percentage (%)
                                      </label>
                                      <div className="relative">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          value={m.percentage ?? ''}
                                          onChange={(e) => updateMilestoneRow(idx, 'percentage', e.target.value)}
                                          placeholder="%"
                                          className="glass-input h-10 pr-7 font-semibold text-xs text-slate-800 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">%</span>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                        Amount (₹)
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">₹</span>
                                        <input
                                          type="number"
                                          min="0"
                                          value={m.amount || ''}
                                          onChange={(e) => updateMilestoneRow(idx, 'amount', e.target.value)}
                                          placeholder="Amount"
                                          className="glass-input h-10 !pl-7 font-semibold text-xs text-slate-800 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                        Due Date
                                      </label>
                                      <PremiumDatePicker
                                        value={m.due_date?.split('T')[0] || ''}
                                        onChange={(date) => updateMilestoneRow(idx, 'due_date', date)}
                                        side="left"
                                        triggerClassName="h-10 rounded-xl bg-slate-50 dark:bg-white/5 text-xs font-medium"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                        Linked Workflow Stage
                                      </label>
                                      <Select
                                        value={m.linked_stage || 'none'}
                                        onValueChange={(val) => updateMilestoneRow(idx, 'linked_stage', val === 'none' ? null : val)}
                                        placeholder="-- No linked stage --"
                                        buttonClassName="glass-input h-10 text-xs text-slate-800 dark:text-white font-medium"
                                        dropdownClassName="min-w-[340px]"
                                      >
                                        {WORKFLOW_STAGE_OPTIONS.map((stg) => (
                                          <SelectItem
                                            key={stg.value}
                                            value={stg.value}
                                            label={stg.value === 'none' ? '-- No linked stage --' : `${stg.step}. ${stg.title}`}
                                            className="py-2.5"
                                          >
                                            {stg.value === 'none' ? (
                                              <div className="py-0.5">
                                                <span className="text-xs text-slate-400 dark:text-slate-500 font-normal italic block">
                                                  -- No linked stage --
                                                </span>
                                                <span className="text-[10px] text-slate-400/80 dark:text-slate-500 block">
                                                  Unrestricted (does not block progress)
                                                </span>
                                              </div>
                                            ) : (
                                              <div className="flex items-start gap-2.5 w-full py-0.5">
                                                <span className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-500/30 mt-0.5">
                                                  {stg.step}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center justify-between gap-1.5">
                                                    <span className="font-semibold text-xs text-slate-800 dark:text-white">
                                                      {stg.title}
                                                    </span>
                                                    {stg.role && (
                                                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 shrink-0">
                                                        {stg.role}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5 truncate">
                                                    {stg.desc}
                                                  </p>
                                                </div>
                                              </div>
                                            )}
                                          </SelectItem>
                                        ))}
                                      </Select>
                                    </div>

                                    <div className="flex items-center gap-2 sm:pt-5">
                                      <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(m.is_activation_gate)}
                                          onChange={(e) => updateMilestoneRow(idx, 'is_activation_gate', e.target.checked)}
                                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-white/20"
                                        />
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                          Activation Gate (Required before Engineering)
                                        </span>
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* STEP 5: Review & Create */}
                      {step === 5 && (
                        <div className="space-y-6">

                          {/* Premium Recap Card */}
                          <div className="glass-card bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/10 rounded-2xl p-8 space-y-6 relative overflow-hidden shadow-xl">
                            <div className={cn("absolute top-0 right-0 w-48 h-48 blur-[80px] rounded-full pointer-events-none", c.glow)} />

                            <div className="border-b border-slate-200/60 dark:border-white/5 pb-5">
                              <p className={cn("text-xs font-medium uppercase tracking-widest mb-1", c.text)}>Project Name</p>
                              <h4 className="text-2xl font-medium tracking-tight text-slate-800 dark:text-white break-words">{watch('name')}</h4>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-slate-600 dark:text-slate-300">
                              <div className="space-y-1 min-w-0">
                                <p className="text-xs font-medium text-slate-400 dark:text-slate-550 uppercase tracking-widest">Client Name</p>
                                <p className="text-sm font-medium text-slate-800 dark:text-white break-words">{watch('client_name')}</p>
                              </div>

                              {watch('gst_number') && (
                                <div className="space-y-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-400 dark:text-slate-550 uppercase tracking-widest">GST Number</p>
                                  <p className="text-sm font-medium text-slate-800 dark:text-white uppercase break-all">{watch('gst_number')}</p>
                                </div>
                              )}

                              <div className="space-y-1 min-w-0">
                                <p className="text-xs font-medium text-slate-400 dark:text-slate-550 uppercase tracking-widest">Contact Phone</p>
                                <p className="text-sm font-medium text-slate-800 dark:text-white">{watch('phone')}</p>
                              </div>

                              <div className="space-y-1 min-w-0">
                                <p className="text-xs font-medium text-slate-400 dark:text-slate-550 uppercase tracking-widest">Email Address</p>
                                <p className="text-sm font-medium text-slate-800 dark:text-white break-all" title={watch('email')}>{watch('email') || 'Not provided'}</p>
                              </div>

                              <div className="space-y-1 min-w-0">
                                <p className="text-xs font-medium text-slate-400 dark:text-slate-550 uppercase tracking-widest">Site Type</p>
                                <p className="text-sm font-medium text-slate-800 dark:text-white capitalize">{watch('site_type')}</p>
                              </div>

                              <div className="space-y-1 min-w-0">
                                <p className="text-xs font-medium text-slate-400 dark:text-slate-550 uppercase tracking-widest">Base Value</p>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                  ₹{Number(watch('amount') || 0).toLocaleString('en-IN')}
                                </p>
                              </div>

                              <div className="space-y-1 min-w-0">
                                <p className="text-xs font-medium text-slate-400 dark:text-slate-550 uppercase tracking-widest">GST Type</p>
                                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                                  {watch('gst_type') === 'cgst_sgst_2_5'
                                    ? '2.5% CGST + 2.5% SGST (5%)'
                                    : watch('gst_type') === 'igst_5'
                                      ? '5% IGST (5%)'
                                      : watch('gst_type') === 'cgst_sgst_5'
                                        ? '5% CGST + 5% SGST (10%)'
                                        : 'No CGST / SGST (Exempt)'}
                                </p>
                              </div>

                              <div className="space-y-1 min-w-0">
                                <p className="text-xs font-medium text-slate-400 dark:text-slate-550 uppercase tracking-widest">Total Contract Value</p>
                                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                                  ₹{totalContractValue.toLocaleString('en-IN')}
                                </p>
                              </div>

                            </div>

                            <div className="border-t border-slate-200/60 dark:border-white/5 pt-4 space-y-1">
                              <p className="text-xs font-medium text-slate-400 dark:text-slate-550 uppercase tracking-widest">Site Location Address</p>
                              <p className="text-xs font-semibold leading-relaxed text-slate-700 dark:text-slate-200 break-words">{watch('client_address')}</p>
                            </div>

                            <div className="border-t border-slate-200/60 dark:border-white/5 pt-4 space-y-2">
                              <p className="text-xs font-medium text-slate-400 dark:text-slate-555 uppercase tracking-widest">Selected Services ({selectedServices.length})</p>
                              <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto custom-scrollbar">
                                {selectedServices.map((srv) => (
                                  <span key={srv} className="text-xs font-medium bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-1 rounded-lg text-slate-850 dark:text-white">
                                    {srv}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Milestones Schedule Summary */}
                            <div className="border-t border-slate-200/60 dark:border-white/5 pt-4 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-slate-400 dark:text-slate-550 uppercase tracking-widest flex items-center gap-1.5">
                                  <Target className="w-3.5 h-3.5 text-indigo-500" />
                                  Milestones Schedule ({milestones.length > 0 ? milestones.length : 1})
                                </p>
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  ₹{totalContractValue.toLocaleString('en-IN')} Total
                                </span>
                              </div>

                              {milestones.length === 0 ? (
                                <div className="p-3.5 rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs">
                                  <div>
                                    <p className="font-semibold text-slate-800 dark:text-white">Advance Payment (100% Default)</p>
                                    <p className="text-[11px] text-slate-400">Full contract amount on project activation</p>
                                  </div>
                                  <span className="font-bold text-slate-800 dark:text-white">
                                    ₹{totalContractValue.toLocaleString('en-IN')}
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                  {milestones.map((m: any, i: number) => (
                                    <div key={m.id || i} className="p-3 rounded-xl bg-slate-100/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs">
                                      <div className="min-w-0 pr-2">
                                        <p className="font-semibold text-slate-800 dark:text-white truncate">
                                          {i + 1}. {m.title || 'Untitled'}
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                          {m.due_date ? `Due: ${new Date(m.due_date).toLocaleDateString('en-IN')}` : 'No due date'}
                                          {(() => {
                                            const stg = WORKFLOW_STAGE_OPTIONS.find((s) => s.value === m.linked_stage);
                                            if (stg && stg.value !== 'none') {
                                              return ` • Unlocks: Stage ${stg.step} (${stg.title})`;
                                            }
                                            return m.linked_stage ? ` • ${m.linked_stage.replace('_', ' ')}` : '';
                                          })()}
                                          {m.is_activation_gate ? ' • Activation Gate' : ''}
                                        </p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <span className="font-bold text-slate-800 dark:text-white block">
                                          ₹{Number(m.amount || 0).toLocaleString('en-IN')}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium">
                                          {m.percentage ? `${m.percentage}%` : ''}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className={cn("p-6 rounded-2xl border flex items-center justify-between group overflow-hidden relative", c.alertBg)}>
                            <div className="flex items-center gap-4 relative z-10">
                              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white", c.alertIconBg)}>
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-900 dark:text-white">Everything is Set</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Please review all values. Clicking below will initialize the project record and its commercial milestone schedule.</p>
                              </div>
                            </div>
                          </div>

                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </form>
              </FormProvider>
            </div>

            {/* ── Bottom Navigation Action Bar ── */}
            <div className="h-20 px-8 border-t border-slate-200 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-white/[0.01] backdrop-blur-xl shrink-0">
              <button
                key="btn-wizard-back"
                type="button"
                id="btn-wizard-back"
                onClick={step === 1 ? () => setOpen(false) : handleBack}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all outline-none"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {step === 1 ? 'Cancel' : 'Back'}
              </button>

              {step < 5 ? (
                <button
                  key="btn-wizard-next"
                  type="button"
                  id="btn-wizard-next"
                  onClick={handleNext}
                  className={cn(
                    "flex items-center gap-3 px-8 py-3 text-white rounded-xl text-xs font-medium uppercase tracking-wider hover:shadow-lg active:scale-[0.97] transition-all group outline-none",
                    c.bg, c.hoverBg, c.shadow
                  )}
                >
                  Continue
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ) : (
                <button
                  key="btn-wizard-submit"
                  type="submit"
                  form="wizard-form"
                  id="btn-wizard-submit"
                  disabled={isSubmitting}
                  className={cn(
                    "flex items-center gap-3 px-8 py-3 text-white rounded-xl text-xs font-medium   tracking-wider disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition-all group outline-none",
                    c.bg, c.hoverBg, c.shadow
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Project
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
