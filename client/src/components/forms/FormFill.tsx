import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CheckCircle } from "lucide-react";

interface ClinicHeaderData {
  logoBase64?: string | null;
  clinicName: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface ClinicFooterData {
  footerText: string;
}

interface FormFillProps {
  token?: string;
  header?: ClinicHeaderData | null;
  footer?: ClinicFooterData | null;
  onSubmitSuccess?: () => void;
  className?: string;
  showClinicHeader?: boolean;
  showClinicFooter?: boolean;
}

const formTypesWithOptions = new Set(["checkbox", "radio", "select"]);

const getTokenFromQuery = () => {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("token") ?? "";
};

export function FormFill({
  token: explicitToken,
  header,
  footer,
  onSubmitSuccess,
  className,
  showClinicHeader = true,
  showClinicFooter = true,
}: FormFillProps) {
  const { toast } = useToast();
  const token = useMemo(() => explicitToken || getTokenFromQuery(), [explicitToken]);

  const { data, isLoading } = useQuery({
    queryKey: ["formShare", token],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/forms/share/${token}`);
      if (!response.ok) {
        throw new Error("Unable to load form");
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  const { control, register, handleSubmit, reset } = useForm<Record<string, any>>({
    defaultValues: {},
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAlreadySubmitted, setShowAlreadySubmitted] = useState(false);

  useEffect(() => {
    if (data?.form) {
      const defaults: Record<string, any> = {};
      data.form.sections.forEach((section: any) => {
        section.fields.forEach((field: any) => {
          defaults[field.id] = field.type === "checkbox" ? [] : "";
        });
      });
      reset(defaults);
    }
  }, [data, reset]);

  useEffect(() => {
    if (data?.share?.status === "submitted") {
      setShowAlreadySubmitted(true);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (answers: { fieldId: number; value: any }[]) => {
      const response = await apiRequest("POST", `/api/forms/share/${token}/responses`, {
        answers,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Failed to submit form");
      }
      return response.json();
    },
    onSuccess() {
      toast({
        title: "Form submitted",
        description: "We created a secured PDF and notified the care team.",
      });
      setShowSuccessModal(true);
      onSubmitSuccess?.();
    },
    onError(error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("already submitted")
      ) {
        setShowAlreadySubmitted(true);
        return;
      }
      window.location.href = "https://app.curaemr.ai/";
    },
  });

  const onSubmit = async (values: Record<string, any>) => {
    if (!data?.form) return;
    const answers = data.form.sections.flatMap((section: any) =>
      section.fields.map((field: any) => ({
        fieldId: field.id,
        value: values[field.id],
      })),
    );
    await mutation.mutateAsync(answers);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading form…</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please wait while we verify the link.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data?.form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Form unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <p>This link is invalid or expired.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
        <h3 className="mt-4 text-lg font-semibold text-slate-900">
          Form submitted
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          We created a secured PDF and notified the care team.
        </p>
        <button
          type="button"
          className="mt-6 inline-flex min-w-[120px] items-center justify-center rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          onClick={() => {
            window.location.href = "https://app.curaemr.ai/";
          }}
        >
          OK
        </button>
      </div>
        </div>
      )}
      {showAlreadySubmitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="mx-4 max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
            <CheckCircle className="mx-auto h-12 w-12 text-slate-900" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              Form already submitted
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Form is already filled and sent to Cura HealthCare.
            </p>
            <button
              type="button"
              className="mt-6 inline-flex min-w-[140px] items-center justify-center rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              onClick={() => {
                window.location.href = "https://app.curaemr.ai/";
              }}
            >
              Go to Cura HealthCare
            </button>
          </div>
        </div>
      )}
      <Card className={cn("space-y-4", className)}>
      <CardHeader>
        <CardTitle>{data.form.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{data.form.description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {showClinicHeader && header && (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-4">
              {header.logoBase64 && (
                <img src={header.logoBase64} alt="Clinic logo" className="h-16 w-auto object-contain" />
              )}
              <div>
                <p className="text-lg font-semibold">{header.clinicName}</p>
                <p className="text-xs text-muted-foreground">
                  {header.address}
                  {(header.address && (header.phone || header.email)) && " · "}
                  {header.phone && `Phone: ${header.phone}`}
                  {header.phone && header.email && " · "}
                  {header.email && `Email: ${header.email}`}
                </p>
              </div>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {data.form.sections.map((section: any) => (
            <div key={section.id} className="space-y-4">
              <h3 className="text-lg font-semibold">{section.title}</h3>
              {section.fields.map((field: any) => (
                <div key={field.id} className="space-y-2">
                  <Label className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {(() => {
                    switch (field.fieldType) {
                      case "textarea":
                        return (
                          <Textarea
                            {...register(field.id, { required: field.required })}
                            placeholder={field.placeholder}
                          />
                        );
                      case "number":
                        return (
                          <Input
                            type="number"
                            {...register(field.id, { required: field.required })}
                            placeholder={field.placeholder}
                          />
                        );
                      case "email":
                        return (
                          <Input
                            type="email"
                            {...register(field.id, { required: field.required })}
                            placeholder={field.placeholder}
                          />
                        );
                      case "date":
                        return (
                          <Input
                            type="date"
                            {...register(field.id, { required: field.required })}
                          />
                        );
                      case "checkbox":
                        return (
                          <Controller
                            control={control}
                            name={field.id}
                            rules={{ required: field.required }}
                            defaultValue={[]}
                            render={({ field: controllerField }) => (
                              <div className="space-y-2">
                                {field.fieldOptions?.map((option: string) => (
                                  <Checkbox
                                    key={option}
                                    checked={controllerField.value?.includes(option)}
                                    onCheckedChange={(checked) => {
                                      const next = controllerField.value ?? [];
                                      const exists = next.includes(option);
                                      if (checked && !exists) {
                                        controllerField.onChange([...next, option]);
                                      } else if (!checked && exists) {
                                        controllerField.onChange(next.filter((item) => item !== option));
                                      }
                                    }}
                                  >
                                    {option}
                                  </Checkbox>
                                ))}
                              </div>
                            )}
                          />
                        );
                      case "radio":
                        return (
                          <div className="space-y-2">
                            {field.fieldOptions?.map((option: string) => (
                              <label
                                key={option}
                                className={cn(
                                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                                  "border-border hover:border-primary",
                                )}
                              >
                                <input
                                  type="radio"
                                  value={option}
                                  {...register(field.id, { required: field.required })}
                                  className="accent-primary"
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        );
                      default:
                        return (
                          <Input
                            {...register(field.id, { required: field.required })}
                            placeholder={field.placeholder}
                          />
                        );
                    }
                  })()}
                </div>
              ))}
            </div>
          ))}
          {showClinicFooter && footer && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
              {footer.footerText}
            </div>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Submitting…" : "Submit form"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
    </>
  );
}

