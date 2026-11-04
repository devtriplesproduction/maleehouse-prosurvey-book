'use client';

import React, { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createLeadSchema, type CreateLeadInput } from '../validations';
import { createProjectAction } from '@/actions/project.actions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Phone, 
  MapPin, 
  Tag, 
  Calendar,
  ClipboardList,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FormSelect } from '@/components/ui/FormSelect';

const STEPS = [
  { id: 1, title: 'Client Info', icon: User },
  { id: 2, title: 'Requirements', icon: ClipboardList },
  { id: 3, title: 'Review & Save', icon: CheckCircle2 },
];

export function CreateLeadModal() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      client_name: '',
      company_name: '',
      phone: '',
      whatsapp: '',
      email: '',
      address: '',
      city: '',
      state: '',
      lead_source: '',
      priority: 'Medium',
      project_type: '',
      site_address: '',
      survey_type: '',
      plot_area: '',
      deadline: '',
      project_notes: '',
      special_instructions: '',
    },
    mode: 'onTouched',
  });

  const { handleSubmit, trigger, watch, formState: { errors } } = methods;

  const handleNext = async () => {
    let fieldsToValidate: (keyof CreateLeadInput)[] = [];
    if (step === 1) {
      fieldsToValidate = ['client_name', 'phone', 'address', 'city', 'state'];
    } else if (step === 2) {
      fieldsToValidate = ['project_type', 'site_address', 'survey_type'];
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const onSubmit = async (data: CreateLeadInput) => {
    setIsSubmitting(true);
    try {
      const projectPayload = {
        name: `${data.client_name} - ${data.project_type}`,
        client_name: data.client_name,
        client_contact: `Phone: ${data.phone}${data.email ? `, Email: ${data.email}` : ''}${data.whatsapp ? `, WA: ${data.whatsapp}` : ''}`,
        client_address: `${data.address}, ${data.city}, ${data.state}`,
        site_type: 'other' as any,
        survey_requirements: `Type: ${data.survey_type}\nArea: ${data.plot_area}\nNotes: ${data.project_notes}\nInstructions: ${data.special_instructions}`,
        services: [data.survey_type],
        target_completion_date: data.deadline,
      };

      const result = await createProjectAction(projectPayload as any);
      
      if (result.success) {
        toast({
          title: "Lead Captured Successfully",
          description: `A new lead has been registered for ${data.client_name}.`,
          variant: "success",
        });
        setOpen(false);
      } else {
        toast({
          title: "Capture Failed",
          description: result.error || 'Failed to save lead info.',
          variant: "error",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-500/30 transition-all hover:-translate-y-0.5 active:translate-y-0 group">
          <Plus className="w-5 h-5" />
          Capture New Lead
          <ArrowRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-all" />
        </button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-white/20 p-0 overflow-hidden rounded-[2.5rem] shadow-2xl">
        <DialogHeader className="p-10 pb-6 bg-gradient-to-br from-indigo-500/5 to-purple-500/5">
          <div className="flex items-center justify-between mb-10">
            <div>
              <DialogTitle className="text-3xl font-black tracking-tighter">Lead Intake System</DialogTitle>
              <p className="text-slate-500 font-medium">Capture comprehensive prospect data and project requirements.</p>
            </div>
            <div className="flex items-center gap-2 bg-white/50 dark:bg-black/20 px-4 py-2 rounded-2xl border border-white/20">
              <span className="text-xs font-black uppercase tracking-widest text-indigo-550">Step {step} of 3</span>
            </div>
          </div>

          <div className="relative flex justify-between px-10">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-white/5 -translate-y-1/2" />
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isActive = step >= s.id;
              const isCurrent = step === s.id;
              return (
                <div key={s.id} className="relative z-10 flex flex-col items-center gap-3">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 border-2",
                    isActive ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-500/40" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-400",
                    isCurrent && "ring-8 ring-indigo-500/10 scale-110"
                  )}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", isActive ? "text-indigo-600" : "text-slate-400")}>
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="p-10 pt-6">
          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="min-h-[450px] flex flex-col justify-between">
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {step === 1 && (
                  <div className="grid grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="space-y-6">
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <User className="w-4 h-4 text-indigo-500" /> Client Identity
                      </h3>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Client Name *</label>
                          <input {...methods.register('client_name')} className="glass-input focus:border-indigo-500 focus:ring-indigo-500/10" placeholder="e.g. Rahul Sharma" />
                          {errors.client_name && <p className="text-[10px] text-rose-500 font-bold mt-1 ml-1">{errors.client_name.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Company Name</label>
                          <input {...methods.register('company_name')} className="glass-input focus:border-indigo-500 focus:ring-indigo-500/10" placeholder="Optional" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-indigo-500" /> Contact Matrix
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Phone Number *</label>
                          <input {...methods.register('phone')} className="glass-input focus:border-indigo-500 focus:ring-indigo-500/10" placeholder="+91 ..." />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">WhatsApp</label>
                          <input {...methods.register('whatsapp')} className="glass-input focus:border-indigo-500 focus:ring-indigo-500/10" placeholder="Same as phone?" />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
                          <input {...methods.register('email')} className="glass-input focus:border-indigo-500 focus:ring-indigo-500/10" placeholder="client@example.com" />
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 space-y-6">
                      <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-indigo-500" /> Geographic Data
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-3 space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Billing/Home Address *</label>
                          <input {...methods.register('address')} className="glass-input focus:border-indigo-500 focus:ring-indigo-500/10" placeholder="Street, Area, etc." />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">City *</label>
                          <input {...methods.register('city')} className="glass-input focus:border-indigo-500 focus:ring-indigo-500/10" placeholder="City" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">State *</label>
                          <input {...methods.register('state')} className="glass-input focus:border-indigo-500 focus:ring-indigo-500/10" placeholder="State" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Lead Source</label>
                          <FormSelect 
                            name="lead_source"
                            control={methods.control}
                            placeholder="Select Source"
                            options={[
                              { value: "Referral", label: "Referral" },
                              { value: "Google Search", label: "Google Search" },
                              { value: "Social Media", label: "Social Media" },
                              { value: "Existing Client", label: "Existing Client" },
                              { value: "Other", label: "Other" },
                            ]}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                          <Tag className="w-4 h-4 text-indigo-500" /> Project Metadata
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Project Type *</label>
                            <FormSelect 
                              name="project_type"
                              control={methods.control}
                              placeholder="Select Project Type"
                              options={[
                                { value: "Residential", label: "Residential" },
                                { value: "Commercial", label: "Commercial" },
                                { value: "Industrial", label: "Industrial" },
                                { value: "Public Infrastructure", label: "Public Infrastructure" },
                                { value: "Government", label: "Government" },
                                { value: "Semi-Government", label: "Semi-Government" },
                              ]}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Survey Type *</label>
                            <input {...methods.register('survey_type')} className="glass-input focus:border-indigo-500 focus:ring-indigo-500/10" placeholder="e.g. Boundary, Topography" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Plot Area</label>
                              <input {...methods.register('plot_area')} className="glass-input focus:border-indigo-500 focus:ring-indigo-500/10" placeholder="Sq. Ft / Acres" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Deadline</label>
                              <div className="relative group">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors z-10" />
                                <input 
                                  type="date" 
                                  {...methods.register('deadline')} 
                                  className="glass-input !pl-10 cursor-pointer focus:border-indigo-500 focus:ring-indigo-500/10" 
                                />
                              </div>
                              {errors.deadline && <p className="text-[10px] text-rose-500 font-bold mt-1 ml-1">{errors.deadline.message}</p>}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-indigo-500" /> Site Logistics
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Exact Site Address *</label>
                            <textarea {...methods.register('site_address')} className="glass-input h-24 resize-none focus:border-indigo-500 focus:ring-indigo-500/10" placeholder="Where is the survey located?" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Special Instructions</label>
                            <textarea {...methods.register('special_instructions')} className="glass-input h-24 resize-none focus:border-indigo-500 focus:ring-indigo-500/10" placeholder="Any specific requirements or hazards?" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-indigo-500/5 rounded-[2rem] border border-indigo-500/10 p-8 space-y-6">
                      <div className="flex justify-between items-center border-b border-indigo-500/10 pb-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Prospect</p>
                          <h4 className="text-2xl font-black">{watch('client_name')}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Priority</p>
                          <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-black border border-amber-500/20 uppercase tracking-widest">
                            {watch('priority')}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Project Objective</p>
                            <p className="font-bold text-slate-700 dark:text-slate-300">{watch('project_type')} - {watch('survey_type')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Contact</p>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{watch('phone')} | {watch('email') || 'No email'}</p>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Site Location</p>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 line-clamp-2">{watch('site_address')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Timeline</p>
                            <p className="text-sm font-bold text-indigo-550">{watch('deadline') || 'TBD'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-amber-500/5 rounded-3xl border border-amber-500/10 flex items-start gap-4">
                      <ClipboardList className="w-6 h-6 text-amber-500 shrink-0" />
                      <div>
                        <h5 className="font-bold text-amber-600">Requirement Checklist</h5>
                        <p className="text-xs text-amber-600/70 mb-4">Initial data points required for conversion.</p>
                        <div className="flex flex-wrap gap-3">
                          <span className="px-3 py-1.5 rounded-xl bg-white/50 dark:bg-black/20 border border-white/20 text-[10px] font-black uppercase tracking-widest text-slate-500">Contact Verified</span>
                          <span className="px-3 py-1.5 rounded-xl bg-white/50 dark:bg-black/20 border border-white/20 text-[10px] font-black uppercase tracking-widest text-slate-500">Location Pinned</span>
                          <span className="px-3 py-1.5 rounded-xl bg-white/50 dark:bg-black/20 border border-white/20 text-[10px] font-black uppercase tracking-widest text-slate-500">Scope Defined</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-10 border-t border-slate-200 dark:border-white/5">
                <button
                  type="button"
                  onClick={step === 1 ? () => setOpen(false) : handleBack}
                  className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {step === 1 ? 'Cancel' : 'Prev Step'}
                </button>
                
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex items-center gap-2 px-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:opacity-90 transition-all active:scale-95"
                  >
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-500/40 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Finalize & Capture
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </FormProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
}
