import { Header } from "@/components/layout/header";
import RoleBasedAppointmentRouter from "@/components/appointments/role-based-router";
import { DoctorList } from "@/components/doctors/doctor-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Plus, Users, Clock, User, X, Check, ChevronsUpDown, Phone, Mail, FileText, MapPin, Filter, FilterX, CreditCard } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { format, isBefore, startOfDay, addMonths, isAfter } from "date-fns";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { isDoctorLike } from "@/lib/role-utils";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

type BookingServiceInfo = {
  name: string;
  price?: string;
  amount?: string;
  currency?: string;
  code?: string;
  color?: string;
};

const formatDecimalString = (value?: number | string | null): string => {
  if (value === undefined || value === null || value === "") {
    return "0.00";
  }
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || Number.isNaN(numeric)) {
    return "0.00";
  }
  return numeric.toFixed(2);
};

const buildInvoiceDefaults = (appointment: any, serviceInfo: BookingServiceInfo | null) => {
  const referenceDate = appointment?.scheduledAt ? new Date(appointment.scheduledAt) : new Date();
  const serviceDate = referenceDate.toISOString().split("T")[0];
  const invoiceDate = new Date().toISOString().split("T")[0];
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const amount = serviceInfo?.amount || "50.00";
  const serviceDescription =
    serviceInfo?.name || appointment?.title || "General Consultation";
  const serviceCode = serviceInfo?.code || "CONS-001";

  return {
    serviceDate,
    invoiceDate,
    dueDate,
    serviceCode,
    serviceDescription,
    amount,
    insuranceProvider: "None (Patient Self-Pay)",
    notes: "",
    paymentMethod: "Online Payment",
  };
};

// Stripe Payment Form Component
function StripePaymentForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/calendar',
      },
      redirect: 'if_required',
    });

    if (error) {
      setPaymentError(error.message || 'Payment failed');
      setIsProcessing(false);
    } else {
      toast({
        title: "Payment Successful",
        description: "Your appointment has been booked and paid.",
      });
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {paymentError && (
        <div className="text-red-600 text-sm">{paymentError}</div>
      )}
      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="bg-green-600 hover:bg-green-700"
        >
          {isProcessing ? "Processing..." : "Pay Now"}
        </Button>
      </div>
    </form>
  );
}

function getTenantSubdomain(): string {
  return localStorage.getItem('user_subdomain') || 'demo';
}

// Medical Specialties Data Structure - same as user-management.tsx
const medicalSpecialties = {
  "General & Primary Care": {
    "General Practitioner (GP) / Family Physician": ["Common illnesses", "Preventive care"],
    "Internal Medicine Specialist": ["Adult health", "Chronic diseases (diabetes, hypertension)"]
  },
  "Surgical Specialties": {
    "General Surgeon": [
      "Abdominal Surgery",
      "Hernia Repair", 
      "Gallbladder & Appendix Surgery",
      "Colorectal Surgery",
      "Breast Surgery",
      "Endocrine Surgery (thyroid, parathyroid, adrenal)",
      "Trauma & Emergency Surgery"
    ],
    "Orthopedic Surgeon": [
      "Joint Replacement (hip, knee, shoulder)",
      "Spine Surgery",
      "Sports Orthopedics (ACL tears, ligament reconstruction)",
      "Pediatric Orthopedics",
      "Arthroscopy (keyhole joint surgery)",
      "Trauma & Fracture Care"
    ],
    "Neurosurgeon": [
      "Brain Tumor Surgery",
      "Spinal Surgery", 
      "Cerebrovascular Surgery (stroke, aneurysm)",
      "Pediatric Neurosurgery",
      "Functional Neurosurgery (Parkinson's, epilepsy, DBS)",
      "Trauma Neurosurgery"
    ],
    "Cardiothoracic Surgeon": [
      "Cardiac Surgery – Bypass, valve replacement",
      "Thoracic Surgery – Lungs, esophagus, chest tumors", 
      "Congenital Heart Surgery – Pediatric heart defects",
      "Heart & Lung Transplants",
      "Minimally Invasive / Robotic Heart Surgery"
    ],
    "Plastic & Reconstructive Surgeon": [
      "Cosmetic Surgery (nose job, facelift, liposuction)",
      "Reconstructive Surgery (after cancer, trauma)",
      "Burn Surgery",
      "Craniofacial Surgery (cleft lip/palate, facial bones)",
      "Hand Surgery"
    ],
    "ENT Surgeon (Otolaryngologist)": [
      "Otology (ear surgeries, cochlear implants)",
      "Rhinology (sinus, deviated septum)",
      "Laryngology (voice box, throat)",
      "Head & Neck Surgery (thyroid, tumors)",
      "Pediatric ENT (tonsils, adenoids, ear tubes)",
      "Facial Plastic Surgery (nose/ear correction)"
    ],
    "Urological Surgeon": [
      "Endourology (kidney stones, minimally invasive)",
      "Uro-Oncology (prostate, bladder, kidney cancer)",
      "Pediatric Urology",
      "Male Infertility & Andrology",
      "Renal Transplant Surgery",
      "Neurourology (bladder control disorders)"
    ]
  },
  "Heart & Circulation": {
    "Cardiologist": ["Heart diseases", "ECG", "Angiography"],
    "Vascular Surgeon": ["Arteries", "Veins", "Blood vessels"]
  },
  "Women's Health": {
    "Gynecologist": ["Female reproductive system"],
    "Obstetrician": ["Pregnancy & childbirth"],
    "Fertility Specialist (IVF Expert)": ["Infertility treatment"]
  },
  "Children's Health": {
    "Pediatrician": ["General child health"],
    "Pediatric Surgeon": ["Infant & child surgeries"],
    "Neonatologist": ["Newborn intensive care"]
  },
  "Brain & Nervous System": {
    "Neurologist": ["Stroke", "Epilepsy", "Parkinson's"],
    "Psychiatrist": ["Mental health (depression, anxiety)"],
    "Psychologist (Clinical)": ["Therapy & counseling"]
  },
  "Skin, Hair & Appearance": {
    "Dermatologist": ["Skin", "Hair", "Nails"],
    "Cosmetologist": ["Non-surgical cosmetic treatments"],
    "Aesthetic / Cosmetic Surgeon": ["Surgical enhancements"]
  },
  "Eye & Vision": {
    "Ophthalmologist": ["Cataracts", "Glaucoma", "Surgeries"],
    "Optometrist": ["Vision correction (glasses, lenses)"]
  },
  "Teeth & Mouth": {
    "Dentist (General)": ["Oral health", "Fillings"],
    "Orthodontist": ["Braces", "Alignment"],
    "Oral & Maxillofacial Surgeon": ["Jaw surgery", "Implants"],
    "Periodontist": ["Gum disease specialist"],
    "Endodontist": ["Root canal specialist"]
  },
  "Digestive System": {
    "Gastroenterologist": ["Stomach", "Intestines"],
    "Hepatologist": ["Liver specialist"],
    "Colorectal Surgeon": ["Colon", "Rectum", "Anus"]
  },
  "Kidneys & Urinary Tract": {
    "Nephrologist": ["Kidney diseases", "Dialysis"],
    "Urologist": ["Kidney diseases", "Bladder disorders", "General urological care"]
  },
  "Respiratory System": {
    "Pulmonologist": ["Asthma", "COPD", "Tuberculosis"],
    "Thoracic Surgeon": ["Lung surgeries"]
  },
  "Cancer": {
    "Oncologist": ["Medical cancer specialist"],
    "Radiation Oncologist": ["Radiation therapy"],
    "Surgical Oncologist": ["Cancer surgeries"]
  },
  "Endocrine & Hormones": {
    "Endocrinologist": ["Diabetes", "Thyroid", "Hormones"]
  },
  "Muscles & Joints": {
    "Rheumatologist": ["Arthritis", "Autoimmune"],
    "Sports Medicine Specialist": ["Athlete injuries"]
  },
  "Blood & Immunity": {
    "Hematologist": ["Blood diseases (anemia, leukemia)"],
    "Immunologist / Allergist": ["Immune & allergy disorders"]
  },
  "Others": {
    "Geriatrician": ["Elderly care"],
    "Pathologist": ["Lab & diagnostic testing"],
    "Radiologist": ["Imaging (X-ray, CT, MRI)"],
    "Anesthesiologist": ["Pain & anesthesia"],
    "Emergency Medicine Specialist": ["Accidents", "Trauma"],
    "Occupational Medicine Specialist": ["Workplace health"]
  }
};

// Medical Specialty Categories for filtering
const medicalSpecialtyCategories = [
  "General & Primary Care",
  "Surgical Specialties",
  "Heart & Circulation",
  "Women's Health",
  "Children's Health",
  "Brain & Nervous System",
  "Skin, Hair & Appearance",
  "Eye & Vision",
  "Teeth & Mouth",
  "Digestive System",
  "Kidneys & Urinary Tract",
  "Respiratory System",
  "Cancer",
  "Endocrine & Hormones",
  "Muscles & Joints",
  "Blood & Immunity",
  "Others"
];

// Lab Technician Subcategories
const labTechnicianSubcategories = [
  "Phlebotomy Technician",
  "Medical Laboratory Technician (MLT)",
  "Clinical Chemistry Technician",
  "Hematology Technician",
  "Microbiology Technician",
  "Pathology Technician",
  "Histology Technician",
  "Cytology Technician",
  "Immunology Technician",
  "Molecular Biology Technician",
  "Serology Technician",
  "Toxicology Technician",
  "Biochemistry Technician",
  "Blood Bank Technician",
  "Urinalysis Technician",
  "Lab Information Technician (LIS)",
  "Forensic Lab Technician",
  "Environmental Lab Technician",
  "Quality Control Lab Technician",
  "Research Lab Technician"
];

// Aesthetician Subcategories
const aestheticianSubcategories = [
  "Medical Aesthetician",
  "Clinical Aesthetician",
  "Spa Aesthetician",
  "Laser Technician",
  "Paramedical Aesthetician",
  "Oncology Aesthetician",
  "Acne Specialist",
  "Anti-Aging Aesthetician",
  "Cosmetic Tattoo Technician",
  "Chemical Peel Specialist",
  "Microneedling Specialist",
  "Hydrafacial Specialist",
  "Body Contouring Specialist",
  "Eyebrow & Eyelash Technician",
  "Waxing / Hair Removal Specialist",
  "Makeup Artist (Certified Aesthetician)",
  "Dermaplaning Specialist",
  "Aesthetic Trainer / Educator",
  "Natural / Organic Aesthetician"
];

// Optician Subcategories
const opticianSubcategories = [
  "Dispensing Optician",
  "Contact Lens Optician",
  "Pediatric Optician",
  "Low Vision Optician",
  "Ophthalmic Optician",
  "Retail/Store Optician",
  "Technical/Manufacturing Optician",
  "Refractive Surgery Optician",
  "Frame Stylist/Optical Consultant",
  "Clinical Optician",
  "Mobile/Field Optician"
];

// Paramedic Subcategories
const paramedicSubcategories = [
  "Emergency Medical Technician (EMT)",
  "Advanced EMT (AEMT)",
  "Critical Care Paramedic",
  "Flight Paramedic",
  "Tactical Paramedic",
  "Community Paramedic",
  "Rescue Paramedic",
  "Industrial/Occupational Paramedic",
  "Firefighter Paramedic",
  "Event Paramedic",
  "Pediatric Paramedic",
  "Geriatric Paramedic",
  "Ambulance Paramedic",
  "Disaster Response Paramedic",
  "Remote Area Paramedic",
  "Paramedic Instructor",
  "Telemedicine Paramedic",
  "Sports Paramedic"
];

// Physiotherapist Subcategories
const physiotherapistSubcategories = [
  "Orthopedic Physiotherapist",
  "Sports Physiotherapist",
  "Neurological Physiotherapist",
  "Pediatric Physiotherapist",
  "Geriatric Physiotherapist",
  "Cardiopulmonary Physiotherapist",
  "Musculoskeletal Physiotherapist",
  "Women's Health Physiotherapist",
  "Vestibular Rehabilitation Physiotherapist",
  "Oncology Physiotherapist",
  "Hand Therapy Physiotherapist",
  "Aquatic Physiotherapist"
];

// Pharmacist Subcategories
const pharmacistSubcategories = [
  "Clinical Pharmacist",
  "Hospital Pharmacist",
  "Retail/Community Pharmacist",
  "Industrial Pharmacist",
  "Regulatory Affairs Pharmacist",
  "Compounding Pharmacist",
  "Oncology Pharmacist",
  "Geriatric Pharmacist",
  "Pediatric Pharmacist",
  "Ambulatory Care Pharmacist",
  "Nuclear Pharmacist",
  "Infectious Disease Pharmacist",
  "Pharmacovigilance Pharmacist",
  "Academic/Research Pharmacist",
  "Home Health Pharmacist",
  "Military Pharmacist",
  "Cardiology Pharmacist",
  "Psychiatric Pharmacist",
  "Emergency Medicine Pharmacist",
  "Telepharmacist"
];

export default function CalendarPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useRolePermissions();
  const isDoctor = isDoctorLike(user?.role);
  const isPatient = user?.role === "patient";
  const { data: treatmentsList = [], isLoading: isTreatmentsLoading } = useQuery({
    queryKey: ["/api/pricing/treatments"],
    staleTime: 60000,
    enabled: isDoctor || isPatient,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/pricing/treatments");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: consultationServices = [], isLoading: isConsultationsLoading } = useQuery({
    queryKey: ["/api/pricing/doctors-fees"],
    staleTime: 60000,
    enabled: isDoctor || isPatient,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/pricing/doctors-fees");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const treatmentsMap = useMemo(() => {
    const map = new Map<number, any>();
    treatmentsList.forEach((treatment: any) => {
      if (treatment?.id) {
        map.set(treatment.id, treatment);
      }
    });
    return map;
  }, [treatmentsList]);

  const consultationMap = useMemo(() => {
    const map = new Map<number, any>();
    consultationServices.forEach((service: any) => {
      if (service?.id) {
        map.set(service.id, service);
      }
    });
    return map;
  }, [consultationServices]);

const getBookingServiceInfo = (appointment: any): BookingServiceInfo | null => {
    if (!appointment) return null;
    if (appointment.appointmentType === "treatment" && appointment.treatmentId) {
      const treatment = treatmentsMap.get(appointment.treatmentId);
      if (!treatment) return null;
      const amount = formatDecimalString(treatment.basePrice);
      const priceLabel = treatment.currency ? `${treatment.currency} ${amount}` : amount;
      const code =
        treatment.metadata?.serviceCode ||
        treatment.metadata?.code ||
        `TRT-${String(treatment.id ?? 0).padStart(3, "0")}`;
      return {
        name: treatment.name || "Treatment",
        price: priceLabel,
        amount,
        currency: treatment.currency,
        code,
        color: treatment.colorCode || "#10B981",
      };
    }
    if (appointment.appointmentType === "consultation" && appointment.consultationId) {
      const service = consultationMap.get(appointment.consultationId);
      if (!service) return null;
      const amount = formatDecimalString(service.basePrice);
      const priceLabel = service.currency ? `${service.currency} ${amount}` : amount;
      const code =
        service.serviceCode ||
        `CONS-${String(service.id ?? 0).padStart(3, "0")}`;
      return {
        name: service.serviceName || "Consultation",
        price: priceLabel,
        amount,
        currency: service.currency,
        code,
        color: service.colorCode || "#6366F1",
      };
    }
    return null;
  };

const getAppointmentTypeLabel = (appointment: any): string => {
  if (!appointment) return "Consultation";
  const rawType = (appointment.appointmentType || appointment.type || "consultation").toLowerCase();
  if (rawType === "treatment") return "Treatment";
  if (rawType === "consultation") return "Consultation";
  return rawType.charAt(0).toUpperCase() + rawType.slice(1);
};
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedSubSpecialty, setSelectedSubSpecialty] = useState("");
  const [filteredDoctors, setFilteredDoctors] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [specialtyComboboxOpen, setSpecialtyComboboxOpen] = useState(false);
  const [patientComboboxOpen, setPatientComboboxOpen] = useState(false);
  
  // New state for role-based provider selection
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [openRoleCombo, setOpenRoleCombo] = useState(false);
  const [openProviderCombo, setOpenProviderCombo] = useState(false);
  const [selectedMedicalSpecialty, setSelectedMedicalSpecialty] = useState<string>("");
  
  const resetDoctorAppointmentServiceSelection = () => {
    setDoctorAppointmentType("");
    setDoctorAppointmentSelectedTreatment(null);
    setDoctorAppointmentSelectedConsultation(null);
    setDoctorAppointmentTypeError("");
    setDoctorTreatmentSelectionError("");
    setDoctorConsultationSelectionError("");
  };

  // Validation error states for patient booking
  const [roleError, setRoleError] = useState<string>("");
  const [providerError, setProviderError] = useState<string>("");
  
  // Filter functionality state
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterSpecialty, setFilterSpecialty] = useState("");
  const [filterSubSpecialty, setFilterSubSpecialty] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [filteredAppointments, setFilteredAppointments] = useState<any[]>([]);
  
  // Role-based filter state for admin users
  const [filterRole, setFilterRole] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterAppointmentId, setFilterAppointmentId] = useState("");
  const [appointmentIdPopoverOpen, setAppointmentIdPopoverOpen] = useState(false);
  
  // Staff filter visibility state
  const [showStaffFilter, setShowStaffFilter] = useState(false);
  const [staffFilterRole, setStaffFilterRole] = useState("");
  const [staffFilterSearch, setStaffFilterSearch] = useState("");
  const [staffFilterSpecialty, setStaffFilterSpecialty] = useState("");
  
  // Doctor's patient search state
  const [doctorPatientSearch, setDoctorPatientSearch] = useState("");
  
  // Calendar view state
  const [calendarView, setCalendarView] = useState<"month" | "week" | "day">("month");
  const [bookingForm, setBookingForm] = useState({
    patientId: "",
    title: "",
    description: "",
    scheduledAt: "",
    duration: "30",
    type: "consultation",
    location: "",
    isVirtual: false
  });
  const [doctorAppointmentType, setDoctorAppointmentType] = useState<"consultation" | "treatment" | "">("");
  const [doctorAppointmentSelectedTreatment, setDoctorAppointmentSelectedTreatment] = useState<any>(null);
  const [doctorAppointmentSelectedConsultation, setDoctorAppointmentSelectedConsultation] = useState<any>(null);
  const [doctorAppointmentTypeError, setDoctorAppointmentTypeError] = useState<string>("");
  const [doctorTreatmentSelectionError, setDoctorTreatmentSelectionError] = useState<string>("");
  const [doctorConsultationSelectionError, setDoctorConsultationSelectionError] = useState<string>("");
  const [openDoctorAppointmentTypeCombo, setOpenDoctorAppointmentTypeCombo] = useState(false);
  const [openDoctorTreatmentCombo, setOpenDoctorTreatmentCombo] = useState(false);
  const [openDoctorConsultationCombo, setOpenDoctorConsultationCombo] = useState(false);
  
  // Confirmation modal states for patient users
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [pendingAppointmentData, setPendingAppointmentData] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showInsufficientTimeModal, setShowInsufficientTimeModal] = useState(false);
  const [insufficientTimeMessage, setInsufficientTimeMessage] = useState("");
  
  // Error modal state for booking errors
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [duplicateAppointmentDetails, setDuplicateAppointmentDetails] = useState("");
  const [showBookingErrorModal, setShowBookingErrorModal] = useState(false);
  const [bookingErrorMessage, setBookingErrorMessage] = useState("");
  
  // Invoice modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showInvoiceSummary, setShowInvoiceSummary] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string>("");
  const [createdInvoiceId, setCreatedInvoiceId] = useState<number | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    serviceDate: new Date().toISOString().split('T')[0],
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    serviceCode: "CONS-001",
    serviceDescription: "General Consultation",
    amount: "50.00",
    insuranceProvider: "None (Patient Self-Pay)",
    notes: "",
    paymentMethod: "Online Payment"
  });

  const bookingSummaryServiceInfo = useMemo(
    () => getBookingServiceInfo(pendingAppointmentData),
    [pendingAppointmentData, treatmentsMap, consultationMap],
  );
  
  const [location] = useLocation();
  const { toast} = useToast();
  const queryClient = useQueryClient();

  // Fetch patient records from patients table (not users table)
  const { data: patients = [], isLoading: patientsLoading } = useQuery<any[]>({
    queryKey: ["/api/patients"],
    retry: false,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Refetch when component mounts
    queryFn: async () => {
      console.log("📋 CALENDAR: Fetching patient records from patients table...");
      const response = await apiRequest('GET', '/api/patients');
      const data = await response.json();
      console.log("📋 CALENDAR: Patient records fetched. Count:", Array.isArray(data) ? data.length : 'Not an array!');
      console.log("📋 CALENDAR: Patient records data:", data);
      return Array.isArray(data) ? data : [];
    },
  });

  // Auto-populate patient when user is a patient - Match by email
  useEffect(() => {
    if (user?.role === 'patient' && patients.length > 0 && !bookingForm.patientId && showNewAppointmentModal) {
      console.log("🔍 CALENDAR: Looking for patient matching user:", { 
        userEmail: user.email, 
        userName: `${user.firstName} ${user.lastName}`,
        userId: user.id 
      });
      console.log("📋 CALENDAR: Available patients:", patients.map((p: any) => ({ 
        id: p.id,
        email: p.email, 
        name: `${p.firstName} ${p.lastName}` 
      })));
      
      // Match by email address
      const currentPatient = patients.find((patient: any) => 
        patient.email === user.email
      );
      
      if (currentPatient) {
        console.log("✅ CALENDAR: Found matching patient record:", currentPatient);
        // Use the patient RECORD ID
        setBookingForm(prev => ({ ...prev, patientId: currentPatient.id.toString() }));
        console.log("✅ CALENDAR: Set patientId to:", currentPatient.id.toString());
      } else {
        console.log("❌ CALENDAR: No matching patient found for email:", user.email);
      }
    }
  }, [user, patients, showNewAppointmentModal, bookingForm.patientId]);
  
  // Fetch medical staff with availability for appointment booking
  const { data: doctorsData, isLoading: isLoadingDoctors, error: doctorsError } = useQuery<any>({
    queryKey: ["/api/medical-staff"],
    retry: 3,
    staleTime: 0, // Force fresh requests
    gcTime: 0, // Don't cache failed results (previously cacheTime in v4)
    enabled: true, // Ensure query is enabled
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: false,
    queryFn: async () => {
      console.log('🔄 MEDICAL STAFF: Starting fetch for user:', user?.email, 'role:', user?.role);
      try {
        const response = await apiRequest('GET', '/api/medical-staff');
        console.log('🔄 MEDICAL STAFF: Response status:', response.status);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        console.log('📋 MEDICAL STAFF: Success response:', data);
        return data;
      } catch (error) {
        console.error('❌ MEDICAL STAFF: Fetch error:', error);
        throw error;
      }
    },
  });
  
  // Extract doctors from medical staff query - memoized to prevent infinite re-renders
  const allDoctors = useMemo(() => {
    console.log('🏥 Processing medical staff data:', doctorsData);
    console.log('🏥 Medical staff error:', doctorsError);
    console.log('🏥 Is loading medical staff:', isLoadingDoctors);
    
    const doctors = doctorsData?.staff || [];
    console.log('👨‍⚕️ Extracted doctors from medical staff query:', doctors.length, doctors);
    return doctors;
  }, [doctorsData, doctorsError, isLoadingDoctors]);
  
  // Fetch all users for role-based provider selection
  const { data: usersData = [], isLoading: usersLoading } = useQuery<any[]>({
    queryKey: ["/api/users"],
    staleTime: 300000, // 5 minutes cache
    retry: false,
    enabled: !!user,
  });

  // Fetch roles from roles table for role-based provider selection
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["/api/roles"],
    staleTime: 60000,
    enabled: !!user,
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/roles');
      return response.json();
    },
  });

  // Fetch all shifts for the selected provider to determine available dates
  const { data: allProviderShifts } = useQuery({
    queryKey: ["/api/shifts/provider", selectedProviderId],
    staleTime: 30000,
    enabled: !!selectedProviderId,
    retry: false, // Don't retry on 403
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/shifts?staffId=${selectedProviderId}`);
        if (!response.ok) {
          console.warn('Failed to fetch provider shifts:', response.status);
          return []; // Return empty array on error
        }
        const data = await response.json();
        return data;
      } catch (error) {
        console.warn('Error fetching provider shifts:', error);
        return []; // Return empty array on error
      }
    },
  });

  // Fetch shifts for the selected date and provider
  const { data: shiftsData } = useQuery({
    queryKey: ["/api/shifts", selectedProviderId, selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null],
    staleTime: 30000,
    enabled: !!selectedDate && !!selectedProviderId,
    retry: false, // Don't retry on 403
    queryFn: async () => {
      try {
        const dateStr = format(selectedDate!, 'yyyy-MM-dd');
        const response = await apiRequest('GET', `/api/shifts?date=${dateStr}&staffId=${selectedProviderId}`);
        if (!response.ok) {
          console.warn('Failed to fetch shifts for date:', response.status);
          return []; // Return empty array on error
        }
        const data = await response.json();
        return data;
      } catch (error) {
        console.warn('Error fetching shifts for date:', error);
        return []; // Return empty array on error
      }
    },
  });

  // Fetch default shifts for all users (to use as fallback when custom shifts don't exist)
  const { data: defaultShiftsData = [] } = useQuery({
    queryKey: ["/api/default-shifts", "forBooking"],
    staleTime: 60000,
    enabled: !!user, // Only fetch when user is authenticated
    retry: false,
    queryFn: async () => {
      try {
        console.log('[DEFAULT_SHIFTS] Fetching default shifts...');
        const response = await apiRequest('GET', '/api/default-shifts?forBooking=true');
        if (!response.ok) {
          console.warn('[DEFAULT_SHIFTS] Failed to fetch default shifts:', response.status);
          return [];
        }
        const data = await response.json();
        console.log('[DEFAULT_SHIFTS] Fetched default shifts:', data);
        return data;
      } catch (error) {
        console.warn('[DEFAULT_SHIFTS] Error fetching default shifts:', error);
        return [];
      }
    },
  });
  
  // Query for filtered appointments
  const { data: allAppointments = [] } = useQuery<any[]>({
    queryKey: ["/api/appointments"],
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false,
  });

  // Query to fetch ALL appointments for selected provider/date (for slot availability checking)
  // This bypasses patient filtering to show all booked slots
  const { data: providerAppointments = [] } = useQuery<any[]>({
    queryKey: ["/api/appointments", "provider", selectedProviderId, selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null],
    staleTime: 10000,
    enabled: !!selectedProviderId && !!selectedDate,
    retry: false,
    queryFn: async () => {
      if (!selectedProviderId || !selectedDate) return [];
      
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await apiRequest('GET', `/api/appointments?providerId=${selectedProviderId}&date=${dateStr}`);
      return response.json();
    },
  });

  // Helper function to convert 12-hour time to 24-hour format
  const timeSlotTo24Hour = (timeSlot: string): string => {
    const [time, period] = timeSlot.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let hour24 = hours;
    if (period === 'PM' && hours !== 12) hour24 = hours + 12;
    if (period === 'AM' && hours === 12) hour24 = 0;
    return `${hour24.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Get filtered users by selected role (exclude patient and admin)
  const filteredUsers = useMemo(() => {
    console.log('🔍 FILTERING USERS - selectedRole:', selectedRole, 'selectedMedicalSpecialty:', selectedMedicalSpecialty, 'usersData:', usersData);
    if (!selectedRole || !usersData || !Array.isArray(usersData)) {
      console.log('❌ No role or users data available');
      return [];
    }
    const filtered = usersData.filter((u: any) => {
      // Case-insensitive comparison to handle any uppercase/lowercase mismatches
      const roleMatches = u.role?.toLowerCase() === selectedRole.toLowerCase();
      
      // If medical specialty is selected, also filter by specialty
      if (selectedMedicalSpecialty && selectedMedicalSpecialty !== 'all') {
        const specialtyMatches = u.medicalSpecialtyCategory === selectedMedicalSpecialty;
        console.log(`User ${u.firstName} ${u.lastName} - role: "${u.role}" === "${selectedRole}": ${roleMatches}, specialty: "${u.medicalSpecialtyCategory}" === "${selectedMedicalSpecialty}": ${specialtyMatches}`);
        return roleMatches && specialtyMatches;
      }
      
      console.log(`User ${u.firstName} ${u.lastName} - role: "${u.role}" === "${selectedRole}": ${roleMatches}`);
      return roleMatches;
    });
    console.log('✅ Filtered users count:', filtered.length, filtered);
    return filtered;
  }, [selectedRole, selectedMedicalSpecialty, usersData]);

  // Get filtered users by filter role for admin filter panel
  const filteredUsersByFilterRole = useMemo(() => {
    if (!filterRole || !usersData || !Array.isArray(usersData)) {
      return [];
    }
    return usersData.filter((u: any) => u.role?.toLowerCase() === filterRole.toLowerCase());
  }, [filterRole, usersData]);

  // Compute unique appointment IDs for the filter dropdown (admin only)
  const uniqueAppointmentIds = useMemo(() => {
    if (!Array.isArray(allAppointments)) return [];
    const ids = allAppointments
      .map((apt: any) => apt.appointmentId)
      .filter((id: string | undefined) => id !== undefined && id !== null && id !== "");
    return Array.from(new Set(ids)).sort();
  }, [allAppointments]);

  // Get available roles from roles table (exclude patient)
  const availableRoles: Array<{ name: string; displayName: string }> = useMemo(() => {
    if (!rolesData || !Array.isArray(rolesData)) return [];
    return rolesData
      .filter((role: any) => {
        const roleName = role.name?.toLowerCase();
        // For patient users, exclude Administrator, Patient, admin, and patient roles
        if (user?.role === 'patient') {
          return roleName !== 'patient' && roleName !== 'admin' && roleName !== 'administrator';
        }
        // For other users, only exclude patient role
        return roleName !== 'patient';
      })
      .map((role: any) => ({ name: role.name, displayName: role.displayName }));
  }, [rolesData, user?.role]);

  // Get unique medical specialties from users with the selected role (for patient booking)
  const availableMedicalSpecialties = useMemo(() => {
    if (!usersData || !Array.isArray(usersData) || !selectedRole) return [];
    
    const roleFilteredUsers = usersData.filter((u: any) => 
      u.role?.toLowerCase() === selectedRole.toLowerCase()
    );
    
    const specialties = roleFilteredUsers
      .map((u: any) => u.medicalSpecialtyCategory)
      .filter((specialty: any) => specialty && specialty !== null && specialty !== '');
    
    const uniqueSpecialties = Array.from(new Set(specialties)) as string[];
    return uniqueSpecialties.sort();
  }, [usersData, selectedRole]);

  // Get unique medical specialties for staff filter sidebar
  const staffAvailableMedicalSpecialties = useMemo(() => {
    if (!usersData || !Array.isArray(usersData) || !staffFilterRole || staffFilterRole === 'all') return [];
    
    const roleFilteredUsers = usersData.filter((u: any) => 
      u.role?.toLowerCase() === staffFilterRole.toLowerCase()
    );
    
    const specialties = roleFilteredUsers
      .map((u: any) => u.medicalSpecialtyCategory)
      .filter((specialty: any) => specialty && specialty !== null && specialty !== '');
    
    const uniqueSpecialties = Array.from(new Set(specialties)) as string[];
    return uniqueSpecialties.sort();
  }, [usersData, staffFilterRole]);

  // Check if a date has shifts (custom or default)
  const hasShiftsOnDate = (date: Date): boolean => {
    if (!selectedProviderId) return false;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // Check for custom shifts first
    const hasCustomShift = allProviderShifts?.some((shift: any) => {
      // Robust date comparison - handle both ISO strings and Date objects
      const shiftDateStr = shift.date instanceof Date 
        ? format(shift.date, 'yyyy-MM-dd')
        : shift.date.substring(0, 10);
      return shiftDateStr === dateStr && shift.staffId.toString() === selectedProviderId;
    });
    
    if (hasCustomShift) return true;
    
    // Check for default shifts - if the day is a working day
    if (defaultShiftsData && defaultShiftsData.length > 0) {
      const defaultShift = defaultShiftsData.find((ds: any) => 
        ds.userId.toString() === selectedProviderId
      );
      
      if (defaultShift) {
        const dayOfWeek = format(date, 'EEEE');
        const workingDays = defaultShift.workingDays || [];
        return workingDays.includes(dayOfWeek);
      }
    }
    
    return false;
  };

  // Generate time slots based on shifts for the selected provider on the selected date
  // Uses two-tier system: custom shifts (staff_shifts) take priority, then default shifts (doctor_default_shifts)
  const timeSlots = useMemo(() => {
    if (!selectedProviderId || !selectedDate) {
      console.log('[TIME_SLOTS] Missing providerId or date');
      return [];
    }

    // TIER 1: Check for custom shifts in staff_shifts table for the selected date
    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    let providerShifts = shiftsData?.filter((shift: any) => {
      // Filter by staff ID
      if (shift.staffId.toString() !== selectedProviderId) return false;
      
      // Filter by selected date
      const shiftDateStr = shift.date instanceof Date 
        ? format(shift.date, 'yyyy-MM-dd')
        : shift.date.substring(0, 10);
      
      return shiftDateStr === selectedDateStr;
    }) || [];

    console.log(`[TIME_SLOTS] Provider ${selectedProviderId}, Date: ${format(selectedDate, 'yyyy-MM-dd EEEE')}`);
    console.log(`[TIME_SLOTS] Custom shifts found: ${providerShifts.length}`, providerShifts);

    // TIER 2: If no custom shifts found, use default shifts from doctor_default_shifts
    if (providerShifts.length === 0 && defaultShiftsData.length > 0) {
      console.log('[TIME_SLOTS] No custom shifts, checking default shifts...');
      console.log('[TIME_SLOTS] Available default shifts:', defaultShiftsData);
      
      const defaultShift = defaultShiftsData.find((ds: any) => 
        ds.userId.toString() === selectedProviderId
      );

      console.log('[TIME_SLOTS] Default shift for provider:', defaultShift);

      if (defaultShift) {
        // Check if the selected date's day of week is in the working days
        const dayOfWeek = format(selectedDate, 'EEEE'); // "Monday", "Tuesday", etc.
        const workingDays = defaultShift.workingDays || [];
        
        console.log(`[TIME_SLOTS] Day of week: ${dayOfWeek}, Working days:`, workingDays);
        console.log(`[TIME_SLOTS] Is working day: ${workingDays.includes(dayOfWeek)}`);
        
        if (workingDays.includes(dayOfWeek)) {
          // Create a virtual shift object matching the staff_shifts structure
          providerShifts = [{
            staffId: defaultShift.userId,
            startTime: defaultShift.startTime,
            endTime: defaultShift.endTime,
            date: selectedDate,
            isDefault: true // Flag to indicate this came from default shifts
          }];
          console.log('[TIME_SLOTS] Using default shift:', providerShifts[0]);
        } else {
          console.log('[TIME_SLOTS] Selected date is not a working day');
        }
      } else {
        console.log('[TIME_SLOTS] No default shift found for provider');
      }
    }

    if (!providerShifts || providerShifts.length === 0) {
      console.log('[TIME_SLOTS] No shifts available (custom or default)');
      return [];
    }

    console.log('[TIME_SLOTS] Final provider shifts to use:', providerShifts);

    const allSlots: string[] = [];

    // Generate time slots for each shift
    for (const shift of providerShifts) {
      const [startHour, startMinute] = shift.startTime.split(':').map(Number);
      const [endHour, endMinute] = shift.endTime.split(':').map(Number);

      let currentHour = startHour;
      let currentMinute = startMinute;

      // Generate 15-minute interval slots between start and end time
      while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
        const hour12 = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour;
        const period = currentHour < 12 ? 'AM' : 'PM';
        const timeString = `${hour12}:${currentMinute.toString().padStart(2, '0')} ${period}`;
        
        if (!allSlots.includes(timeString)) {
          allSlots.push(timeString);
        }

        currentMinute += 15;
        if (currentMinute >= 60) {
          currentMinute = 0;
          currentHour++;
        }
      }
    }

    // Sort slots chronologically
    allSlots.sort((a, b) => {
      const timeA = timeSlotTo24Hour(a);
      const timeB = timeSlotTo24Hour(b);
      return timeA.localeCompare(timeB);
    });

    // Filter out past time slots if the selected date is today
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    
    if (selectedDateStr === todayStr) {
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const filteredSlots = allSlots.filter(slot => {
        const slot24h = timeSlotTo24Hour(slot);
        return slot24h > currentTime;
      });
      
      console.log(`[TIME SLOTS] Filtered past time slots. Before: ${allSlots.length}, After: ${filteredSlots.length}`);
      return filteredSlots;
    }

    return allSlots;
  }, [selectedProviderId, selectedDate, shiftsData, defaultShiftsData]);

  // Check if a time slot is booked (only checks if the 15-min slot itself is occupied)
  // Duration overlap checking is handled separately in checkSufficientTime() when booking
  const isTimeSlotBooked = (timeSlot: string): boolean => {
    if (!selectedDate || !selectedProviderId) return false;

    // Use providerAppointments for slot checking (includes ALL appointments for this provider/date)
    // This ensures patient users see all booked slots, not just their own
    const appointmentsToCheck = providerAppointments.length > 0 ? providerAppointments : allAppointments;
    if (!appointmentsToCheck || appointmentsToCheck.length === 0) return false;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const slotTime24 = timeSlotTo24Hour(timeSlot);

    return appointmentsToCheck.some((apt: any) => {
      // Filter by provider ID first (handle both camelCase and snake_case)
      const aptProviderId = apt.providerId || apt.provider_id;
      if (aptProviderId?.toString() !== selectedProviderId) return false;

      // Handle both camelCase (scheduledAt) and snake_case (scheduled_at)
      const scheduledTime = apt.scheduledAt || apt.scheduled_at;
      if (!scheduledTime) return false;

      const aptDateStr = scheduledTime.substring(0, 10);
      if (aptDateStr !== dateStr) return false;

      // CANCELLED appointments are treated as available (not booked)
      if (apt.status === 'cancelled') return false;

      const aptTime = scheduledTime.substring(11, 16);
      if (!aptTime) return false;

      // Parse appointment time and duration
      const [aptHour, aptMinute] = aptTime.split(':').map(Number);
      const aptDuration = apt.duration || 30;

      // Calculate appointment end time
      let aptEndMinute = aptMinute + aptDuration;
      let aptEndHour = aptHour;
      if (aptEndMinute >= 60) {
        aptEndHour += Math.floor(aptEndMinute / 60);
        aptEndMinute = aptEndMinute % 60;
      }

      const aptStart24 = `${aptHour.toString().padStart(2, '0')}:${aptMinute.toString().padStart(2, '0')}`;
      const aptEnd24 = `${aptEndHour.toString().padStart(2, '0')}:${aptEndMinute.toString().padStart(2, '0')}`;

      // FIXED: Only check if THIS specific 15-minute slot falls within the appointment's time range
      // This ensures only the actual occupied slots are greyed out (4 slots for 60 min, not 5)
      // Example: 1:00 AM appointment for 60 min occupies 1:00, 1:15, 1:30, 1:45 (ends at 2:00)
      // 12:45 AM is NOT occupied, so it shows as available (green)
      // When user tries to book 12:45 for 60 min, checkSufficientTime() will validate overlap
      return (slotTime24 >= aptStart24 && slotTime24 < aptEnd24);
    });
  };

  // Check if sufficient consecutive time is available for the selected duration
  const checkSufficientTime = (startTimeSlot: string, durationMinutes: number): { available: boolean; availableMinutes: number } => {
    if (!selectedDate || !selectedProviderId) return { available: false, availableMinutes: 0 };

    const startTime24 = timeSlotTo24Hour(startTimeSlot);
    const [startHour, startMinute] = startTime24.split(':').map(Number);

    // Generate all 15-minute slots needed for the duration
    const slotsNeeded = Math.ceil(durationMinutes / 15);
    let availableMinutes = 0;
    
    for (let i = 0; i < slotsNeeded; i++) {
      let currentMinute = startMinute + (i * 15);
      let currentHour = startHour;
      
      if (currentMinute >= 60) {
        currentHour += Math.floor(currentMinute / 60);
        currentMinute = currentMinute % 60;
      }

      // Convert to 12-hour format to match timeSlots array
      const hour12 = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour;
      const period = currentHour < 12 ? 'AM' : 'PM';
      const timeSlotStr = `${hour12}:${currentMinute.toString().padStart(2, '0')} ${period}`;

      // Check if this slot exists and is not booked
      if (!timeSlots.includes(timeSlotStr) || isTimeSlotBooked(timeSlotStr)) {
        return { available: false, availableMinutes };
      }
      
      availableMinutes += 15;
    }

    return { available: true, availableMinutes };
  };
  
  // Function to apply filters
  const applyFilters = () => {
    // For admin users, use role-based filtering
    if (user?.role === 'admin') {
      if (!filterProvider && !filterDate && !filterAppointmentId) {
        setFilteredAppointments([]);
        return;
      }
      
      let filtered = [...allAppointments];
      
      // Filter by provider (role-based)
      if (filterProvider) {
        const selectedProviderId = parseInt(filterProvider);
        filtered = filtered.filter((appointment: any) => appointment.providerId === selectedProviderId);
      }
      
      // Filter by date - NO TIMEZONE CONVERSION
      if (filterDate) {
        const filterDateStr = format(filterDate, 'yyyy-MM-dd');
        filtered = filtered.filter((appointment: any) => {
          const scheduledTime = appointment.scheduledAt ?? appointment.scheduled_at;
          const appointmentDateStr = scheduledTime?.split('T')[0];
          return appointmentDateStr === filterDateStr;
        });
      }

      // Filter by appointment ID
      if (filterAppointmentId) {
        filtered = filtered.filter((appointment: any) => appointment.appointmentId === filterAppointmentId);
      }
      
      setFilteredAppointments(filtered);
    } else {
      // For non-admin users, use specialty-based filtering
      if (!filterDoctor && !filterDate) {
        setFilteredAppointments([]);
        return;
      }
      
      let filtered = [...allAppointments];
      
      // Filter by doctor
      if (filterDoctor) {
        const selectedDoctorId = parseInt(filterDoctor);
        filtered = filtered.filter((appointment: any) => appointment.providerId === selectedDoctorId);
      }
      
      // Filter by date - NO TIMEZONE CONVERSION
      if (filterDate) {
        const filterDateStr = format(filterDate, 'yyyy-MM-dd');
        filtered = filtered.filter((appointment: any) => {
          const scheduledTime = appointment.scheduledAt ?? appointment.scheduled_at;
          const appointmentDateStr = scheduledTime?.split('T')[0];
          return appointmentDateStr === filterDateStr;
        });
      }
      
      setFilteredAppointments(filtered);
    }
  };
  
  // Apply filters when filter values change
  useEffect(() => {
    if (showFilterPanel) {
      applyFilters();
    }
  }, [filterDoctor, filterProvider, filterDate, filterAppointmentId, allAppointments, showFilterPanel, user?.role]);
  
  // Filter doctors by specialty for filter panel - reactive to filter changes
  const filteredDoctorsBySpecialty = useMemo(() => {
    console.log('Filtering doctors - Specialty:', filterSpecialty, 'Sub-specialty:', filterSubSpecialty);
    console.log('All doctors:', allDoctors);
    
    if (!filterSpecialty && !filterSubSpecialty) {
      console.log('No filters, returning all doctors:', allDoctors.length);
      return allDoctors;
    }
    
    const filtered = allDoctors.filter((doctor: any) => {
      console.log(`Checking doctor: ${doctor.firstName} ${doctor.lastName}, category: ${doctor.medicalSpecialtyCategory}, subSpecialty: ${doctor.subSpecialty}`);
      
      if (filterSubSpecialty) {
        const matches = doctor.subSpecialty === filterSubSpecialty;
        console.log(`Sub-specialty filter: ${filterSubSpecialty} matches ${doctor.subSpecialty}:`, matches);
        return matches;
      } else if (filterSpecialty) {
        const matches = doctor.medicalSpecialtyCategory === filterSpecialty;
        console.log(`Specialty filter: ${filterSpecialty} matches ${doctor.medicalSpecialtyCategory}:`, matches);
        return matches;
      }
      return true;
    });
    
    console.log('Filtered doctors result:', filtered.length, filtered);
    return filtered;
  }, [allDoctors, filterSpecialty, filterSubSpecialty]);
  
  // Helper functions for specialty filtering - using consistent data from medicalSpecialties object
  const getUniqueSpecialties = (): string[] => {
    return Object.keys(medicalSpecialties);
  };
  
  const getSubSpecialties = (specialty?: string): string[] => {
    if (!specialty) {
      // If no specialty selected, return all sub-specialties
      const allSubSpecialties: string[] = [];
      Object.values(medicalSpecialties).forEach(specialtyData => {
        allSubSpecialties.push(...Object.keys(specialtyData));
      });
      return allSubSpecialties;
    }
    
    const specialtyData = medicalSpecialties[specialty as keyof typeof medicalSpecialties];
    return specialtyData ? Object.keys(specialtyData) : [];
  };
  
  const filterDoctorsBySpecialty = () => {
    if (!Array.isArray(allDoctors) || allDoctors.length === 0) {
      console.log('⚠️ No doctors available for filtering. Array check:', Array.isArray(allDoctors), 'Length:', allDoctors?.length);
      console.log('⚠️ Is loading doctors:', isLoadingDoctors, 'Doctors error:', doctorsError);
      setFilteredDoctors([]);
      return [];
    }
    
    console.log('Filtering doctors with specialty:', selectedSpecialty, 'sub-specialty:', selectedSubSpecialty);
    console.log('Available doctors:', allDoctors);
    
    // If no specialty is selected, show all active doctors
    if (!selectedSpecialty) {
      console.log('No specialty selected, showing all doctors:', allDoctors);
      const activeDoctors = allDoctors.filter((doctor: any) => doctor.isActive !== false);
      setFilteredDoctors(activeDoctors);
      return activeDoctors;
    }
    
    const filtered = allDoctors.filter((doctor: any) => {
      // Skip inactive doctors
      if (doctor.isActive === false) {
        return false;
      }
      
      const hasSpecialty = doctor.medicalSpecialtyCategory === selectedSpecialty;
      const hasSubSpecialty = !selectedSubSpecialty || doctor.subSpecialty === selectedSubSpecialty;
      
      console.log(`Checking ${doctor.firstName} ${doctor.lastName}:`, {
        specialty: doctor.medicalSpecialtyCategory,
        selectedSpecialty,
        hasSpecialty,
        subSpecialty: doctor.subSpecialty,
        selectedSubSpecialty,
        hasSubSpecialty,
        isActive: doctor.isActive
      });
      
      return hasSpecialty && hasSubSpecialty;
    });
    
    console.log('Filtered doctors:', filtered);
    setFilteredDoctors(filtered);
    return filtered;
  };
  
  // Predefined time slots from 9:00 AM to 5:00 PM in 30-minute intervals
  const PREDEFINED_TIME_SLOTS = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00'
  ];

  // Fetch appointments from database for selected date and doctor
  const fetchAppointmentsForDateAndDoctor = async (doctorId: number, date: Date): Promise<string[]> => {
    try {
      console.log(`[NEW_TIME_SLOTS] Fetching appointments for Doctor ID: ${doctorId}, Date: ${format(date, 'yyyy-MM-dd')}`);
      
      // Query database directly for appointments
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'X-Tenant-Subdomain': getTenantSubdomain()
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/appointments', {
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const appointments = await response.json();
      console.log(`[NEW_TIME_SLOTS] Fetched ${appointments.length} total appointments from database`);

      // Filter appointments for selected doctor and date
      const dateStr = format(date, 'yyyy-MM-dd');
      const doctorAppointments = appointments.filter((apt: any) => {
        const scheduledTime = apt.scheduledAt ?? apt.scheduled_at;
        if (!apt || !apt.providerId || !scheduledTime) {
          return false;
        }
        
        const matchesDoctor = Number(apt.providerId) === Number(doctorId);
        // Extract date directly from ISO string without timezone conversion
        // Format: "2025-09-16T09:00:00.000Z" -> extract "2025-09-16"
        const appointmentDateStr = scheduledTime.split('T')[0];
        const matchesDate = appointmentDateStr === dateStr;
        // IMPORTANT: Only include scheduled appointments - CANCELLED appointments are treated as available time slots
        const isNotCancelled = apt.status !== 'cancelled';
        
        return matchesDoctor && matchesDate && isNotCancelled;
      });

      console.log(`[NEW_TIME_SLOTS] Found ${doctorAppointments.length} appointments for doctor ${doctorId} on ${dateStr}`);

      // Extract booked time slots from scheduledAt field - NO TIMEZONE CONVERSION
      const bookedTimes = doctorAppointments.map((apt: any) => {
        const scheduledTime = apt.scheduledAt ?? apt.scheduled_at;
        // Extract time directly from ISO string without any timezone conversion
        // Format: "2025-09-16T09:00:00.000Z" -> extract "09:00" exactly as stored
        const timeSlot = scheduledTime.split('T')[1]?.substring(0, 5);
        console.log(`[NEW_TIME_SLOTS] [NO-CONVERSION] Exact time from database: ${timeSlot} (from ${scheduledTime})`);
        return timeSlot;
      }).filter(Boolean);

      console.log(`[NEW_TIME_SLOTS] Final booked time slots from database:`, bookedTimes);
      return bookedTimes;
      
    } catch (error) {
      console.error('[NEW_TIME_SLOTS] Error fetching appointments:', error);
      return [];
    }
  };

  // State to store time slot availability status
  const [timeSlotAvailability, setTimeSlotAvailability] = useState<Record<string, boolean>>({});
  const [timeSlotError, setTimeSlotError] = useState<string | null>(null);

  // Function to check all time slots availability
  const checkAllTimeSlots = async () => {
    if (!selectedDate || !selectedDoctor) {
      setTimeSlotAvailability({});
      setTimeSlotError(null);
      return;
    }

    console.log(`[NEW_TIME_SLOTS] Checking availability for doctor ${selectedDoctor.id} on ${format(selectedDate, 'yyyy-MM-dd')}`);
    setTimeSlotError(null);
    
    try {
      const bookedSlots = await fetchAppointmentsForDateAndDoctor(selectedDoctor.id, selectedDate);
      
      // Check if fetch was successful (not an empty array due to error)
      if (bookedSlots.length === 0) {
        // Verify this is actually "no appointments" vs fetch error by checking console logs
        console.log(`[NEW_TIME_SLOTS] No booked slots found - could be no appointments or fetch error`);
      }
      
      const availability: Record<string, boolean> = {};
      
      // Check each predefined time slot
      PREDEFINED_TIME_SLOTS.forEach(timeSlot => {
        // Check if slot is in the past (only for today's date and only for actual scheduling)
        const slotDateStr = format(selectedDate!, 'yyyy-MM-dd');
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        const isToday = slotDateStr === todayStr;
        
        // FIXED: Only block past times for today AND only if we're actually booking (not just viewing availability)
        // For testing/demo purposes, don't block past times to allow full time slot testing
        if (isToday && false) { // Disabled past time check for better UX - users can book any available slot
          const now = new Date();
          const [hours, minutes] = timeSlot.split(':').map(Number);
          const slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
          
          if (slotTime < now) {
            availability[timeSlot] = false; // Past time, blocked
            return; // Continue to next slot
          }
        }
        
        // Check if slot is booked in database
        const isBooked = bookedSlots.includes(timeSlot);
        availability[timeSlot] = !isBooked; // true = available (green), false = blocked (grey)
      });
      
      console.log(`[NEW_TIME_SLOTS] Time slot availability:`, availability);
      setTimeSlotAvailability(availability);
      
    } catch (error) {
      console.error('[NEW_TIME_SLOTS] Error checking time slot availability:', error);
      setTimeSlotError('Failed to load appointment availability. Please try again.');
      
      // Mark all slots as unavailable on error
      const errorAvailability: Record<string, boolean> = {};
      PREDEFINED_TIME_SLOTS.forEach(timeSlot => {
        errorAvailability[timeSlot] = false;
      });
      setTimeSlotAvailability(errorAvailability);
      
      toast({
        title: "Error Loading Time Slots",
        description: "Failed to check appointment availability. Please try refreshing.",
        variant: "destructive",
      });
    }
  };

  // Update filtered doctors when specialty/sub-specialty changes or when doctors data loads
  useEffect(() => {
    filterDoctorsBySpecialty();
  }, [selectedSpecialty, selectedSubSpecialty, allDoctors]);

  // Auto-update time slots when doctor or date changes
  useEffect(() => {
    // Clear selected time slot when doctor or date changes to force grid refresh
    if (selectedTimeSlot) {
      setSelectedTimeSlot("");
    }
    
    // Check availability for all time slots
    if (selectedDate && selectedDoctor) {
      console.log(`[NEW_TIME_SLOTS] Doctor or date changed, checking all time slots availability`);
      checkAllTimeSlots();
    } else {
      // Clear availability when no doctor or date selected
      setTimeSlotAvailability({});
    }
  }, [selectedDoctor, selectedDate]);
  
  // Check for patientId in URL params to auto-book appointment
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const patientId = urlParams.get('patientId');
    if (patientId) {
      setBookingForm(prev => ({ ...prev, patientId }));
    }
  }, [location]);

  // Auto-detect doctor when modal opens if user is a doctor
  useEffect(() => {
    if (showNewAppointmentModal && isDoctorLike(user?.role)) {
      console.log('🔍 DOCTOR AUTO-DETECT: Modal opened for doctor role');
      console.log('👤 DOCTOR AUTO-DETECT: Current user ID:', user.id);
      
      // Immediately set providerId from current user - don't wait for allDoctors to load
      // This ensures time slots display immediately
      setSelectedRole('doctor');
      setSelectedProviderId(user.id.toString());
      console.log('✅ DOCTOR AUTO-DETECT: Auto-populated role=doctor and providerId=' + user.id);
      
      // Set selectedDoctor if allDoctors is loaded
      if (allDoctors.length > 0) {
        console.log('📊 DOCTOR AUTO-DETECT: Total doctors fetched from users table:', allDoctors.length);
        console.log('📋 DOCTOR AUTO-DETECT: All doctors from users table (where role=doctor):', allDoctors.map((d: any) => ({ id: d.id, name: `${d.firstName} ${d.lastName}`, organizationId: d.organizationId })));
        
        const currentUserAsDoctor = allDoctors.find((doctor: any) => doctor.id === user.id);
        if (currentUserAsDoctor) {
          console.log('✅ DOCTOR AUTO-DETECT: Found current user in doctors list from users table:', {
            id: currentUserAsDoctor.id,
            name: `${currentUserAsDoctor.firstName} ${currentUserAsDoctor.lastName}`,
            email: currentUserAsDoctor.email,
            role: currentUserAsDoctor.role,
            organizationId: currentUserAsDoctor.organizationId,
            department: currentUserAsDoctor.department,
            specialty: currentUserAsDoctor.medicalSpecialtyCategory,
            subSpecialty: currentUserAsDoctor.subSpecialty
          });
          
          // Always set the doctor details when modal opens
          if (!selectedDoctor) {
            setSelectedDoctor(currentUserAsDoctor);
          }
        } else {
          console.log('❌ DOCTOR AUTO-DETECT: Current user not found in doctors list');
        }
      }
    }
  }, [showNewAppointmentModal, user, allDoctors]);

  // Auto-select current date and first available time slot for doctors
  useEffect(() => {
    if (showNewAppointmentModal && isDoctorLike(user?.role) && !selectedDate) {
      const today = new Date();
      setSelectedDate(today);
      console.log('📅 DOCTOR AUTO-SELECT: Set current date:', format(today, 'yyyy-MM-dd'));
    }
  }, [showNewAppointmentModal, user, selectedDate]);

  // Auto-select first available time slot when time slots are loaded for doctors
  useEffect(() => {
    if (showNewAppointmentModal && isDoctorLike(user?.role) && selectedDate && timeSlots.length > 0 && !selectedTimeSlot) {
      // Find first available (not booked) time slot
      const firstAvailableSlot = timeSlots.find(slot => !isTimeSlotBooked(slot));
      if (firstAvailableSlot) {
        setSelectedTimeSlot(firstAvailableSlot);
        console.log('⏰ DOCTOR AUTO-SELECT: Set first available time slot:', firstAvailableSlot);
      }
    }
  }, [showNewAppointmentModal, user, selectedDate, timeSlots, selectedTimeSlot, isTimeSlotBooked]);

  // Combined mutation to create both appointment and invoice
  const createAppointmentAndInvoiceMutation = useMutation({
    mutationFn: async ({ appointmentData, invoiceData }: { appointmentData: any; invoiceData: any }) => {
      // Create appointment first
      const appointmentResponse = await apiRequest("POST", "/api/appointments", {
        ...appointmentData,
        createdBy: user?.id
      });
      const appointment = await appointmentResponse.json();
      
      // Use appointment_id from the created appointment as serviceId in invoice
      const invoiceDataWithServiceId = {
        ...invoiceData,
        serviceId: appointment.appointmentId || appointment.appointment_id
      };
      
      // Create invoice with appointment_id as serviceId
      const invoiceResponse = await apiRequest("POST", "/api/invoices", invoiceDataWithServiceId);
      const invoice = await invoiceResponse.json();
      
      console.log("✅ Invoice created with serviceId:", invoiceDataWithServiceId.serviceId);
      
      // Auto-submit insurance claim if payment method is Insurance
      let insuranceClaim = null;
      let claimSubmissionFailed = false;
      if (invoiceData.paymentMethod === 'Insurance') {
        try {
          const claimNumber = `AUTO-${Date.now()}`;
          const claimResponse = await apiRequest('POST', '/api/insurance/submit-claim', {
            invoiceId: invoice.id,
            provider: invoiceData.insuranceProvider,
            claimNumber: claimNumber
          });
          insuranceClaim = await claimResponse.json();
          console.log("Insurance claim submitted automatically:", { 
            invoiceId: invoice.id, 
            provider: invoiceData.insuranceProvider, 
            claimNumber 
          });
        } catch (claimError) {
          console.error("Failed to auto-submit insurance claim:", claimError);
          claimSubmissionFailed = true;
        }
      }
      
      return { appointment, invoice, insuranceClaim, claimSubmissionFailed };
    },
    onSuccess: async ({ appointment, invoice, insuranceClaim, claimSubmissionFailed }) => {
      // Update calendar data with proper cache invalidation
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments", "patient-filtered"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments", "all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      
      // Invalidate specific appointment queries for the selected date
      if (selectedDate) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/appointments", format(selectedDate, 'yyyy-MM-dd')] 
        });
      }
      
      // Close invoice modals
      setShowInvoiceModal(false);
      setShowInvoiceSummary(false);
      setPendingAppointmentData(null);
      
      // Reset forms
      setShowNewAppointmentModal(false);
      setSelectedSpecialty("");
      setSelectedSubSpecialty("");
      setFilteredDoctors([]);
      setSelectedDoctor(null);
      setSelectedDate(undefined);
      setSelectedTimeSlot("");
      setSelectedRole("");
      setSelectedProviderId("");
      setSelectedDuration(30);
      setSelectedMedicalSpecialty("");
      setBookingForm({
        patientId: "",
        title: "",
        description: "",
        scheduledAt: "",
        duration: "30",
        type: "consultation",
        location: "",
        isVirtual: false
      });
      setDoctorAppointmentType("");
      setDoctorAppointmentSelectedTreatment(null);
      setDoctorAppointmentSelectedConsultation(null);
      setDoctorAppointmentTypeError("");
      setDoctorTreatmentSelectionError("");
      setDoctorConsultationSelectionError("");
      setInvoiceForm({
        serviceDate: new Date().toISOString().split('T')[0],
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        serviceCode: "CONS-001",
        serviceDescription: "General Consultation",
        amount: "50.00",
        insuranceProvider: "None (Patient Self-Pay)",
        notes: "",
        paymentMethod: "Online Payment"
      });
      
      // For Online Payment, create Stripe payment intent and redirect to payment
      try {
        const paymentIntentResponse = await apiRequest('POST', '/api/billing/create-payment-intent', {
          invoiceId: invoice.id,
          amount: parseFloat(invoice.totalAmount || invoice.subtotal || "50.00"),
          description: `Appointment booking - Invoice #${invoice.id}`
        });
        const paymentData = await paymentIntentResponse.json();
        
        if (paymentData.clientSecret) {
          setCreatedInvoiceId(invoice.id);
          setStripeClientSecret(paymentData.clientSecret);
        } else {
          // If payment intent creation fails, show success modal instead
          setShowSuccessModal(true);
          toast({
            title: "Appointment Booked",
            description: "Appointment created. Please complete payment from the billing section.",
          });
        }
      } catch (paymentError) {
        console.error("Failed to create payment intent:", paymentError);
        setShowSuccessModal(true);
        toast({
          title: "Appointment Booked",
          description: "Appointment created. Please complete payment from the billing section.",
        });
      }
    },
    onError: (error) => {
      console.error("Creation error:", error);
      let errorMessage = "Failed to create appointment and invoice. Please try again.";
      
      if (error.message && error.message.includes("Patient not found")) {
        errorMessage = "Patient not found. Please use a valid patient ID.";
      } else if (error.message && error.message.includes("already scheduled at this time")) {
        errorMessage = "This time slot is already booked. Please select a different time slot.";
      } else if (error.message && error.message.includes("Doctor is already scheduled")) {
        errorMessage = "The selected doctor is not available at this time. Please choose a different time slot.";
      }
      
      setBookingErrorMessage(errorMessage);
      setShowBookingErrorModal(true);
      setShowInvoiceModal(false);
      setShowInvoiceSummary(false);
      setShowConfirmationModal(false);
      setShowNewAppointmentModal(false);
    },
  });

  const createDoctorAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const response = await apiRequest("POST", "/api/appointments", {
        ...appointmentData,
        createdBy: user?.id,
      });
      return response.json();
    },
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments", "doctor", user?.id] });
      setShowSuccessModal(true);
      setShowNewAppointmentModal(false);
      setSelectedDoctor(null);
      setSelectedDate(undefined);
      setSelectedTimeSlot("");
      setBookingForm({
        patientId: "",
        title: "",
        description: "",
        scheduledAt: "",
        duration: "30",
        type: "consultation",
        location: "",
        isVirtual: false,
      });
      resetDoctorAppointmentServiceSelection();
      setSelectedRole("");
      setSelectedProviderId("");
      setSelectedDuration(30);
      setSelectedMedicalSpecialty("");
      setPendingAppointmentData(null);
      setShowConfirmationModal(false);
    },
    onError: (error: any) => {
      console.error("Doctor appointment error:", error);
      toast({
        title: "Booking Failed",
        description: "Failed to create appointment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleBookAppointment = () => {
    if (!selectedDoctor || !bookingForm.patientId || !bookingForm.scheduledAt) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Validate that the appointment time is not in the past
    const appointmentDateTime = new Date(bookingForm.scheduledAt);
    const now = new Date();
    
    if (appointmentDateTime < now) {
      toast({
        title: "Invalid Appointment Time",
        description: "Cannot schedule appointments in the past. Please select a current or future time slot.",
        variant: "destructive",
      });
      return;
    }

    // Handle both numeric and string patient IDs
    let patientId: string | number = bookingForm.patientId;
    
    // If it's a pure number, convert to integer
    if (/^\d+$/.test(bookingForm.patientId)) {
      patientId = parseInt(bookingForm.patientId);
    }

    // Check for duplicate appointments (same patient, same doctor, same date)
    if (allAppointments && selectedDate) {
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      const duplicateAppointment = allAppointments.find((apt: any) => {
        const aptDateStr = format(new Date(apt.scheduledAt), 'yyyy-MM-dd');
        return (
          apt.patientId.toString() === patientId.toString() &&
          apt.providerId.toString() === selectedDoctor.id.toString() &&
          aptDateStr === selectedDateStr &&
          apt.status !== 'cancelled' && // Don't count cancelled appointments as duplicates
          apt.status === 'scheduled' // Only count scheduled appointments as duplicates
        );
      });
      
      if (duplicateAppointment) {
        const doctorName = `${selectedDoctor.firstName} ${selectedDoctor.lastName}`;
        const formattedDate = format(selectedDate, 'MMMM do, yyyy');
        
        // Find patient name
        const patient = patients.find((p: any) => 
          p.userId === patientId.toString() || 
          p.id === patientId || 
          (p.patientId && p.patientId === patientId.toString()) ||
          p.id.toString() === patientId.toString()
        );
        const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'the patient';
        
        setDuplicateAppointmentDetails(`${patientName} on ${formattedDate}`);
        setShowDuplicateWarning(true);
        return;
      }
    }

    if (isDoctorLike(user?.role) || user?.role === "patient") {
      if (!doctorAppointmentType) {
        setDoctorAppointmentTypeError("Please select Appointment Type.");
        return;
      }
      if (doctorAppointmentType === "treatment" && !doctorAppointmentSelectedTreatment) {
        setDoctorTreatmentSelectionError("Please select a treatment.");
        return;
      }
      if (doctorAppointmentType === "consultation" && !doctorAppointmentSelectedConsultation) {
        setDoctorConsultationSelectionError("Please select a consultation.");
        return;
      }
    }

    // Prepare appointment data
    const normalizedDoctorAppointmentType = isDoctorLike(user?.role)
      ? doctorAppointmentType || "consultation"
      : bookingForm.type || "consultation";
    const treatmentId =
      normalizedDoctorAppointmentType === "treatment"
        ? doctorAppointmentSelectedTreatment?.id || null
        : null;
    const consultationId =
      normalizedDoctorAppointmentType === "consultation"
        ? doctorAppointmentSelectedConsultation?.id || null
        : null;

    const appointmentData = {
      ...bookingForm,
      patientId: patientId,
      providerId: selectedDoctor.id,
      title: bookingForm.title || `${bookingForm.type} with ${selectedDoctor.firstName} ${selectedDoctor.lastName}`,
      location: bookingForm.location || `${selectedDoctor.department} Department`,
      duration: parseInt(bookingForm.duration)
    };
    if (isDoctorLike(user?.role)) {
      appointmentData.appointmentType = normalizedDoctorAppointmentType;
      appointmentData.treatmentId = treatmentId;
      appointmentData.consultationId = consultationId;
    }

    // Find patient to get their name for the invoice
    const patient = patients.find((p: any) => 
      p.userId === patientId.toString() || 
      p.id === patientId || 
      (p.patientId && p.patientId === patientId.toString()) ||
      p.id.toString() === patientId.toString()
    );
    
    if (!patient) {
      toast({
        title: "Patient Not Found",
        description: "Could not find patient information. Please try again.",
        variant: "destructive",
      });
      return;
    }

    const patientName = `${patient.firstName} ${patient.lastName}`;
    const serviceInfo = getBookingServiceInfo(patientAppointmentData);
    const invoiceDefaults = buildInvoiceDefaults(patientAppointmentData, serviceInfo);
    
    // Create invoice data populated with selected service details
    const invoiceData = {
      patientId: patientId.toString(),
      patientName: patientName,
      nhsNumber: patient.nhsNumber || undefined,
      dateOfService: invoiceDefaults.serviceDate,
      invoiceDate: invoiceDefaults.invoiceDate,
      dueDate: invoiceDefaults.dueDate,
      status: "draft",
      invoiceType: "payment",
      paymentMethod: invoiceDefaults.paymentMethod,
      subtotal: invoiceDefaults.amount,
      tax: "0",
      discount: "0",
      totalAmount: invoiceDefaults.amount,
      paidAmount: invoiceDefaults.paymentMethod === "Cash" ? invoiceDefaults.amount : "0",
      items: [
        {
          code: invoiceDefaults.serviceCode,
          description: invoiceDefaults.serviceDescription,
          quantity: 1,
          unitPrice: parseFloat(invoiceDefaults.amount),
          total: parseFloat(invoiceDefaults.amount)
        }
      ],
      insuranceProvider: invoiceDefaults.insuranceProvider,
      notes: invoiceDefaults.notes
    };
    
    if (isDoctorLike(user?.role)) {
      createDoctorAppointmentMutation.mutate({
        ...appointmentData,
        referralType: doctorAppointmentType,
      });
      return;
    }

    // Automatically create both appointment and invoice
    createAppointmentAndInvoiceMutation.mutate({
      appointmentData,
      invoiceData
    });
  };

  return (
    <>
      <Header 
        title="Appointments" 
        subtitle="Schedule and manage patient appointments efficiently."
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
         
          
          </div>
          
          <div className="flex justify-between items-center">
            <div>   
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                Calendar & Scheduling
                {user?.role !== "patient" && !isDoctorLike(user?.role) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowFilterPanel(!showFilterPanel);
                      if (showFilterPanel) {
                        // Reset filter when closing
                        setFilterSpecialty("");
                        setFilterSubSpecialty("");
                        setFilterDoctor("");
                        setFilterRole("");
                        setFilterProvider("");
                        setFilterDate(undefined);
                        setFilterAppointmentId("");
                        setFilteredAppointments([]);
                      }
                    }}
                    className="ml-2"
                    data-testid="button-filter-appointments"
                  >
                    {showFilterPanel ? (
                      <FilterX className="h-4 w-4" />
                    ) : (
                      <Filter className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {showFilterPanel 
                  ? "Use filters to find specific appointments by doctor, specialty, or date."
                  : "View appointments, manage schedules, and book new consultations."
                }
              </p>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilterPanel && (
          <div className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filter Appointments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  {user?.role === 'admin' ? (
                    <>
                      {/* Select Role (Admin Only) */}
                      <div>
                        <Label>Select Role</Label>
                        <Select value={filterRole} onValueChange={(value) => {
                          setFilterRole(value);
                          setFilterProvider(""); // Reset provider when role changes
                        }}>
                          <SelectTrigger data-testid="select-filter-role">
                            <SelectValue placeholder="Select role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.map((role) => (
                              <SelectItem key={role.name} value={role.name}>
                                {role.displayName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Provider (Admin Only) */}
                      <div>
                        <Label>Provider</Label>
                        <Select value={filterProvider} onValueChange={setFilterProvider}>
                          <SelectTrigger data-testid="select-filter-provider">
                            <SelectValue placeholder="Select provider..." />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredUsersByFilterRole.map((user: any) => (
                              <SelectItem key={user.id} value={user.id.toString()}>
                                {user.firstName} {user.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Medical Specialty Category (Non-Admin) */}
                      <div className="pt-4">
                        <Label>Medical Specialty Category</Label>
                        <Select value={filterSpecialty} onValueChange={(value) => {
                          setFilterSpecialty(value);
                          setFilterSubSpecialty(""); // Reset sub-specialty when specialty changes
                          setFilterDoctor(""); // Reset doctor when specialty changes
                        }}>
                          <SelectTrigger data-testid="select-filter-specialty">
                            <SelectValue placeholder="Select category..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getUniqueSpecialties().map((specialty) => (
                              <SelectItem key={specialty} value={specialty}>
                                {specialty}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sub-Specialty (Non-Admin) */}
                      <div>
                        <Label>Sub-Specialty</Label>
                        <Select value={filterSubSpecialty} onValueChange={(value) => {
                          setFilterSubSpecialty(value);
                          setFilterDoctor(""); // Reset doctor when sub-specialty changes
                        }}>
                          <SelectTrigger data-testid="select-filter-subspecialty">
                            <SelectValue placeholder="Select sub-specialty..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getSubSpecialties(filterSpecialty).map((subSpecialty) => (
                              <SelectItem key={subSpecialty} value={subSpecialty}>
                                {subSpecialty}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Doctor (Non-Admin) */}
                      <div>
                        <Label>Doctor</Label>
                        <Select value={filterDoctor} onValueChange={setFilterDoctor}>
                          <SelectTrigger data-testid="select-filter-doctor">
                            <SelectValue placeholder="Select doctor..." />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredDoctorsBySpecialty.map((doctor: any) => (
                              <SelectItem key={doctor.id} value={doctor.id.toString()}>
                                Dr. {doctor.firstName} {doctor.lastName} - {doctor.specialization}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {/* Date (Both Admin and Non-Admin) */}
                  <div>
                    <Label>Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          data-testid="button-filter-date"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {filterDate ? format(filterDate, "PPP") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={filterDate}
                          onSelect={setFilterDate}
                          disabled={(date) => {
                            // Disable past dates
                            if (isBefore(date, startOfDay(new Date()))) return true;
                            // Disable dates beyond 3 months
                            if (isAfter(date, addMonths(new Date(), 3))) return true;
                            return false;
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Appointment ID (Admin Only) */}
                  {user?.role === 'admin' && uniqueAppointmentIds.length > 0 && (
                    <div>
                      <Label>Appointment ID</Label>
                      <Popover open={appointmentIdPopoverOpen} onOpenChange={setAppointmentIdPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={appointmentIdPopoverOpen}
                            className="w-full justify-between"
                            data-testid="filter-appointment-id"
                          >
                            {filterAppointmentId
                              ? filterAppointmentId
                              : "Select appointment ID..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search appointment ID..." />
                            <CommandList>
                              <CommandEmpty>No appointment ID found.</CommandEmpty>
                              <CommandGroup>
                                {uniqueAppointmentIds.map((id: string) => (
                                  <CommandItem
                                    key={id}
                                    value={id}
                                    onSelect={() => {
                                      setFilterAppointmentId(id);
                                      setAppointmentIdPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        filterAppointmentId === id ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    {id}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Conditional Content - Either Default Calendar or Filtered Appointments */}
        {showFilterPanel && ((user?.role === 'admin' ? (filterProvider || filterAppointmentId) : filterDoctor) || filterDate) ? (
          /* Filtered Appointments View */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Filtered Appointments ({filteredAppointments.length} found)
              </h4>
            </div>
            
            {filteredAppointments.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No appointments found
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    No appointments match your filter criteria. Try adjusting your filters.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredAppointments.map((appointment: any) => {
                  const doctor = allDoctors.find((d: any) => d.id === appointment.providerId);
                  const patient = patients.find((p: any) => p.id === appointment.patientId);
                  // Extract exact time and date from database without timezone conversion
                  const scheduledTime = appointment.scheduledAt ?? appointment.scheduled_at;
                  const appointmentDate = new Date(scheduledTime); // For date formatting only
                  const exactTime = scheduledTime?.split('T')[1]?.substring(0, 5); // Extract HH:mm from UTC
                  // Convert 24-hour to 12-hour format without timezone conversion
                  const formatExactTime = (time24: string) => {
                    const [hours, minutes] = time24.split(':');
                    const hour = parseInt(hours);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                    return `${hour12}:${minutes} ${ampm}`;
                  };
                  
                  return (
                    <Card key={appointment.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h5 className="font-semibold text-gray-900 dark:text-white">
                              {appointment.title || "Appointment"}
                            </h5>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              appointment.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                              appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                              appointment.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {appointment.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>Patient: {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              <span>Doctor: {doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Unknown'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>{format(appointmentDate, 'EEEE, MMMM dd, yyyy')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              <span>{exactTime ? formatExactTime(exactTime) : 'Time unavailable'} ({appointment.duration} mins)</span>
                            </div>
                            {appointment.location && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                <span>{appointment.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Default Calendar View */
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Calendar - 2 columns */}
            <div className="lg:col-span-2">
              <RoleBasedAppointmentRouter onNewAppointment={() => setShowNewAppointmentModal(true)} />
            </div>
            
            {/* Doctor List - 1 column */}
            <div>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-900 dark:text-white" />
                    {isDoctorLike(user?.role) ? "Available Patient" : "Available Staff"}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowStaffFilter(!showStaffFilter)}
                    className="h-6 w-6 p-0"
                  >
                    <Filter className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </Button>
                </div>
                
                {showStaffFilter && (
                  <div className="space-y-3 mb-4">
                    {isDoctorLike(user?.role) ? (
                      <div className="relative">
                        <Input
                          placeholder="Search patients by name, email, age, ID, NHS, phone, city, country..."
                          value={doctorPatientSearch}
                          onChange={(e) => setDoctorPatientSearch(e.target.value)}
                          className="pl-10"
                        />
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                    ) : (
                      <>
                        <Select 
                          value={staffFilterRole} 
                          onValueChange={(value) => {
                            setStaffFilterRole(value);
                            setStaffFilterSpecialty(""); // Reset specialty when role changes
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="All Roles" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            {rolesData && Array.isArray(rolesData) && rolesData
                              .filter((role: any) => role.name !== "patient" && role.name !== "admin")
                              .map((role: any) => (
                                <SelectItem key={role.id} value={role.name}>
                                  {role.displayName || role.name}
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                        
                        {['doctor', 'nurse', 'dentist', 'dental_nurse', 'phlebotomist'].includes(staffFilterRole) && (
                          <Select 
                            value={staffFilterSpecialty} 
                            onValueChange={setStaffFilterSpecialty}
                          >
                            <SelectTrigger className="w-full" data-testid="select-staff-medical-specialty">
                              <SelectValue placeholder="Medical Specialty Category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              {medicalSpecialtyCategories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {staffFilterRole === 'lab_technician' && (
                          <Select 
                            value={staffFilterSpecialty} 
                            onValueChange={setStaffFilterSpecialty}
                          >
                            <SelectTrigger className="w-full" data-testid="select-staff-lab-subcategory">
                              <SelectValue placeholder="Lab Technician Subcategory" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Subcategories</SelectItem>
                              {labTechnicianSubcategories.map((subcategory) => (
                                <SelectItem key={subcategory} value={subcategory}>
                                  {subcategory}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {staffFilterRole === 'aesthetician' && (
                          <Select 
                            value={staffFilterSpecialty} 
                            onValueChange={setStaffFilterSpecialty}
                          >
                            <SelectTrigger className="w-full" data-testid="select-staff-aesthetician-subcategory">
                              <SelectValue placeholder="Aesthetician Subcategory" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Subcategories</SelectItem>
                              {aestheticianSubcategories.map((subcategory) => (
                                <SelectItem key={subcategory} value={subcategory}>
                                  {subcategory}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {staffFilterRole === 'optician' && (
                          <Select 
                            value={staffFilterSpecialty} 
                            onValueChange={setStaffFilterSpecialty}
                          >
                            <SelectTrigger className="w-full" data-testid="select-staff-optician-subcategory">
                              <SelectValue placeholder="Optician Subcategory" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Subcategories</SelectItem>
                              {opticianSubcategories.map((subcategory) => (
                                <SelectItem key={subcategory} value={subcategory}>
                                  {subcategory}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {staffFilterRole === 'paramedic' && (
                          <Select 
                            value={staffFilterSpecialty} 
                            onValueChange={setStaffFilterSpecialty}
                          >
                            <SelectTrigger className="w-full" data-testid="select-staff-paramedic-subcategory">
                              <SelectValue placeholder="Paramedic Subcategory" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Subcategories</SelectItem>
                              {paramedicSubcategories.map((subcategory) => (
                                <SelectItem key={subcategory} value={subcategory}>
                                  {subcategory}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {staffFilterRole === 'physiotherapist' && (
                          <Select 
                            value={staffFilterSpecialty} 
                            onValueChange={setStaffFilterSpecialty}
                          >
                            <SelectTrigger className="w-full" data-testid="select-staff-physiotherapist-subcategory">
                              <SelectValue placeholder="Physiotherapist Subcategory" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Subcategories</SelectItem>
                              {physiotherapistSubcategories.map((subcategory) => (
                                <SelectItem key={subcategory} value={subcategory}>
                                  {subcategory}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        {staffFilterRole === 'pharmacist' && (
                          <Select 
                            value={staffFilterSpecialty} 
                            onValueChange={setStaffFilterSpecialty}
                          >
                            <SelectTrigger className="w-full" data-testid="select-staff-pharmacist-subcategory">
                              <SelectValue placeholder="Pharmacist Subcategory" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Subcategories</SelectItem>
                              {pharmacistSubcategories.map((subcategory) => (
                                <SelectItem key={subcategory} value={subcategory}>
                                  {subcategory}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        
                        <Input
                          placeholder="Search by name, email, specialization, department.."
                          value={staffFilterSearch}
                          onChange={(e) => setStaffFilterSearch(e.target.value)}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
              <DoctorList 
                onSelectDoctor={(doctor) => {
                  console.log("Setting selected doctor:", doctor);
                  setSelectedDoctor(doctor);
                }}
                showAppointmentButton={true}
                filterRole={staffFilterRole}
                filterSearch={staffFilterSearch}
                filterSpecialty={staffFilterSpecialty}
                patientSearch={doctorPatientSearch}
              />
            </div>
          </div>
        )}


        {/* New Appointment Modal */}
        {showNewAppointmentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Schedule New Appointment
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowNewAppointmentModal(false);
                      setSelectedSpecialty("");
                      setSelectedSubSpecialty("");
                      setFilteredDoctors([]);
                      setSelectedDoctor(null);
                      setSelectedDate(undefined);
                      setSelectedTimeSlot("");
                      setSelectedRole("");
                      setSelectedProviderId("");
                      setSelectedDuration(30);
                      setSelectedMedicalSpecialty("");
                    setDoctorAppointmentType("");
                    setDoctorAppointmentSelectedTreatment(null);
                    setDoctorAppointmentSelectedConsultation(null);
                    setDoctorAppointmentTypeError("");
                    setDoctorTreatmentSelectionError("");
                    setDoctorConsultationSelectionError("");
                    }}
                    data-testid="button-close-modal"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* For patient role - New UI Layout */}
                {user?.role === 'patient' ? (
                  <div className="space-y-6">
                    {/* Row 1: Select Role + Duration | Patient Information */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Column 1: Select Role and Duration */}
                      <div className="space-y-4">
                        {/* Select Role */}
                        <div>
                          <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                            Select Role
                          </Label>
                          <Popover open={openRoleCombo} onOpenChange={setOpenRoleCombo}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openRoleCombo}
                                className="w-full justify-between"
                                data-testid="select-role"
                              >
                                {selectedRole 
                                  ? availableRoles.find(r => r.name === selectedRole)?.displayName || selectedRole
                                  : "Select role..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput placeholder="Search role..." />
                                <CommandList>
                                  <CommandEmpty>No role found.</CommandEmpty>
                                  <CommandGroup>
                                    {availableRoles.map((role) => (
                                      <CommandItem
                                        key={role.name}
                                        value={role.name}
                                        onSelect={(currentValue) => {
                                          setSelectedRole(currentValue);
                                          setSelectedProviderId("");
                                          setSelectedMedicalSpecialty(""); // Reset specialty when role changes
                                          setRoleError(""); // Clear error on selection
                                          setOpenRoleCombo(false);
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${
                                            role.name === selectedRole ? "opacity-100" : "opacity-0"
                                          }`}
                                        />
                                        {role.displayName}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {roleError && (
                            <p className="text-red-600 text-sm mt-1">{roleError}</p>
                          )}
                        </div>

                        {/* Select Name */}
                        {selectedRole && (
                          <div>
                            <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                              Doctor Name
                            </Label>
                            <Popover open={openProviderCombo} onOpenChange={setOpenProviderCombo}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={openProviderCombo}
                                  className="w-full justify-between"
                                  data-testid="select-provider"
                                >
                                  {selectedProviderId 
                                    ? (() => {
                                        const provider = filteredUsers.find((u: any) => u.id.toString() === selectedProviderId);
                                        return provider ? `${provider.firstName} ${provider.lastName}` : "Select provider...";
                                      })()
                                    : "Select provider..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                <Command>
                                  <CommandInput placeholder="Search provider..." />
                                  <CommandList>
                                    <CommandEmpty>No provider found.</CommandEmpty>
                                    <CommandGroup>
                                      {filteredUsers.map((provider: any) => (
                                        <CommandItem
                                          key={provider.id}
                                          value={`${provider.firstName} ${provider.lastName}`}
                                          onSelect={() => {
                                            setSelectedProviderId(provider.id.toString());
                                            setProviderError(""); // Clear error on selection
                                            setOpenProviderCombo(false);
                                          }}
                                        >
                                          <Check
                                            className={`mr-2 h-4 w-4 ${
                                              provider.id.toString() === selectedProviderId ? "opacity-100" : "opacity-0"
                                            }`}
                                          />
                                          {provider.firstName} {provider.lastName}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            {providerError && (
                              <p className="text-red-600 text-sm mt-1">{providerError}</p>
                            )}
                          </div>
                        )}

                        {/* Select Duration */}
                        <div>
                          <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                            Select Duration
                          </Label>
                          <Select
                            value={selectedDuration.toString()}
                            onValueChange={(value) => setSelectedDuration(parseInt(value))}
                          >
                            <SelectTrigger className="w-full" data-testid="select-duration">
                              <SelectValue placeholder="Select duration..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15 minutes</SelectItem>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="60">60 minutes</SelectItem>
                              <SelectItem value="90">90 minutes</SelectItem>
                              <SelectItem value="120">120 minutes (2 hours)</SelectItem>
                              <SelectItem value="180">180 minutes (3 hours)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Column 2: Patient Information */}
                      {(bookingForm.patientId || user?.role === 'patient') && (
                        <div>
                          <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                            Patient Information
                          </Label>
                          {(() => {
                            const selectedPatient = user?.role === 'patient' 
                              ? patients.find((patient: any) => patient.email === user.email) || {
                                  id: user.id,
                                  firstName: user.firstName,
                                  lastName: user.lastName,
                                  email: user.email,
                                  phone: null,
                                  phoneNumber: null,
                                  patientId: null,
                                  dateOfBirth: null,
                                  nhsNumber: null,
                                  address: {}
                                }
                              : patients.find((patient: any) => 
                                  (patient.patientId || patient.id.toString()) === bookingForm.patientId
                                );
                            
                            if (!selectedPatient) return null;
                            
                            // Calculate age from date of birth
                            const age = selectedPatient.dateOfBirth 
                              ? new Date().getFullYear() - new Date(selectedPatient.dateOfBirth).getFullYear()
                              : null;
                            
                            // Get patient initials for avatar
                            const initials = `${selectedPatient.firstName?.[0] || ''}${selectedPatient.lastName?.[0] || ''}`.toUpperCase();
                            
                            return (
                              <Card className="mt-2">
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-4">
                                    {/* Patient Avatar */}
                                    <div className="flex-shrink-0">
                                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-lg" data-testid={`avatar-patient-${selectedPatient.id}`}>
                                        {initials}
                                      </div>
                                    </div>
                                    
                                    {/* Patient Details */}
                                    <div className="flex-1 space-y-3">
                                      {/* Name and Age/ID */}
                                      <div>
                                        <h3 className="font-semibold text-lg text-gray-900 dark:text-white" data-testid={`text-patient-name-${selectedPatient.id}`}>
                                          {selectedPatient.firstName} {selectedPatient.lastName}
                                        </h3>
                                        <p className="text-gray-600 dark:text-gray-400" data-testid={`text-patient-age-id-${selectedPatient.id}`}>
                                          {age && `Age ${age} • `}{selectedPatient.patientId || `P${selectedPatient.id.toString().padStart(6, '0')}`}
                                        </p>
                                      </div>
                                      
                                      {/* Contact Information */}
                                      <div className="space-y-2 text-sm">
                                        {(selectedPatient.phone || selectedPatient.phoneNumber) && (
                                          <div className="flex items-center gap-2" data-testid={`text-patient-phone-${selectedPatient.id}`}>
                                            <Phone className="h-4 w-4 text-gray-500" />
                                            <span className="text-gray-700 dark:text-gray-300">{selectedPatient.phone || selectedPatient.phoneNumber}</span>
                                          </div>
                                        )}
                                        
                                        {selectedPatient.email && (
                                          <div className="flex items-center gap-2" data-testid={`text-patient-email-${selectedPatient.id}`}>
                                            <Mail className="h-4 w-4 text-gray-500" />
                                            <span className="text-gray-700 dark:text-gray-300">{selectedPatient.email}</span>
                                          </div>
                                        )}
                                        
                                        {selectedPatient.nhsNumber && (
                                          <div className="flex items-center gap-2" data-testid={`text-patient-nhs-${selectedPatient.id}`}>
                                            <FileText className="h-4 w-4 text-gray-500" />
                                            <span className="text-gray-700 dark:text-gray-300">NHS: {selectedPatient.nhsNumber}</span>
                                          </div>
                                        )}
                                        
                                        {selectedPatient.address && (selectedPatient.address.city || selectedPatient.address.country) && (
                                          <div className="flex items-center gap-2" data-testid={`text-patient-address-${selectedPatient.id}`}>
                                            <MapPin className="h-4 w-4 text-gray-500" />
                                            <span className="text-gray-700 dark:text-gray-300">
                                              {[selectedPatient.address.city, selectedPatient.address.country].filter(Boolean).join(', ')}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Row 2: Appointment Type + Treatment/Consultation */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-900 dark:text-white">Appointment Type</Label>
                        <Popover open={openDoctorAppointmentTypeCombo} onOpenChange={setOpenDoctorAppointmentTypeCombo}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openDoctorAppointmentTypeCombo}
                              className="w-full justify-between mt-1"
                              data-testid="select-patient-appointment-type"
                            >
                              {doctorAppointmentType
                                ? doctorAppointmentType.charAt(0).toUpperCase() + doctorAppointmentType.slice(1)
                                : "Select an appointment type"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search appointment type..." />
                              <CommandList>
                                <CommandEmpty>No type found.</CommandEmpty>
                                <CommandGroup>
                                  {["consultation", "treatment"].map((type) => (
                                    <CommandItem
                                      key={type}
                                      value={type}
                                      onSelect={(value) => {
                                        const normalized = value as "consultation" | "treatment";
                                        setDoctorAppointmentType(normalized);
                                        setDoctorAppointmentSelectedTreatment(null);
                                        setDoctorAppointmentSelectedConsultation(null);
                                        setDoctorAppointmentTypeError("");
                                        setDoctorTreatmentSelectionError("");
                                        setDoctorConsultationSelectionError("");
                                        setOpenDoctorAppointmentTypeCombo(false);
                                      }}
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${
                                          doctorAppointmentType === type ? "opacity-100" : "opacity-0"
                                        }`}
                                      />
                                      {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {doctorAppointmentTypeError && (
                          <p className="text-red-500 text-xs mt-1">{doctorAppointmentTypeError}</p>
                        )}
                      </div>

                      <div>
                        {doctorAppointmentType === "treatment" && (
                          <>
                            <Label className="text-sm font-medium text-gray-900 dark:text-white">Select Treatment</Label>
                            <Popover open={openDoctorTreatmentCombo} onOpenChange={setOpenDoctorTreatmentCombo}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={openDoctorTreatmentCombo}
                                  className="w-full justify-between mt-1"
                                  data-testid="select-patient-treatment"
                                >
                                  {doctorAppointmentSelectedTreatment ? doctorAppointmentSelectedTreatment.name : "Select a treatment"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search treatments..." />
                                  <CommandList>
                                    <CommandEmpty>No treatments found.</CommandEmpty>
                                    <CommandGroup>
                                      {treatmentsList.map((treatment: any) => (
                                        <CommandItem
                                          key={treatment.id}
                                          value={treatment.id.toString()}
                                          onSelect={() => {
                                            setDoctorAppointmentSelectedTreatment(treatment);
                                            setDoctorTreatmentSelectionError("");
                                            setOpenDoctorTreatmentCombo(false);
                                          }}
                                        >
                                          <div className="flex items-center gap-2 w-full">
                                            <span
                                              className="inline-flex h-3 w-3 rounded-full border border-gray-300"
                                              style={{ backgroundColor: treatment.colorCode || "#D1D5DB" }}
                                            />
                                            <span className="flex-1 text-left">{treatment.name}</span>
                                            <span className="text-xs text-gray-500">
                                              {treatment.currency} {treatment.basePrice}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            {doctorAppointmentSelectedTreatment && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1 px-0 text-blue-600"
                                onClick={() => setDoctorAppointmentSelectedTreatment(null)}
                              >
                                Clear selection
                              </Button>
                            )}
                            {doctorTreatmentSelectionError && (
                              <p className="text-red-500 text-xs mt-1">{doctorTreatmentSelectionError}</p>
                            )}
                          </>
                        )}
                        {doctorAppointmentType === "consultation" && (
                          <>
                            <Label className="text-sm font-medium text-gray-900 dark:text-white">Select Consultation</Label>
                            <Popover open={openDoctorConsultationCombo} onOpenChange={setOpenDoctorConsultationCombo}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={openDoctorConsultationCombo}
                                  className="w-full justify-between mt-1"
                                  data-testid="select-patient-consultation"
                                >
                                  {doctorAppointmentSelectedConsultation ? doctorAppointmentSelectedConsultation.serviceName : "Select a consultation"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search consultation..." />
                                  <CommandList>
                                    <CommandEmpty>No consultations found.</CommandEmpty>
                                    <CommandGroup>
                                      {consultationServices.map((service: any) => (
                                        <CommandItem
                                          key={service.id}
                                          value={service.id.toString()}
                                          onSelect={() => {
                                            setDoctorAppointmentSelectedConsultation(service);
                                            setDoctorConsultationSelectionError("");
                                            setOpenDoctorConsultationCombo(false);
                                          }}
                                        >
                                          <div className="flex items-center gap-2 w-full">
                                            <span className="flex-1 text-left">{service.serviceName}</span>
                                            <span className="text-xs text-gray-500">
                                              {service.currency} {service.basePrice}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            {doctorAppointmentSelectedConsultation && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1 px-0 text-blue-600"
                                onClick={() => setDoctorAppointmentSelectedConsultation(null)}
                              >
                                Clear selection
                              </Button>
                            )}
                            {doctorConsultationSelectionError && (
                              <p className="text-red-500 text-xs mt-1">{doctorConsultationSelectionError}</p>
                            )}
                          </>
                        )}
                        {!doctorAppointmentType && (
                          <p className="text-xs text-gray-500 mt-2">
                            Select an appointment type to pick a treatment or consultation.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 3: Select Date | Select Time Slot */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Column 1: Select Date */}
                      <div>
                        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                          Select Date
                        </Label>
                        <CalendarComponent
                          mode="single"
                          selected={selectedDate}
                          onSelect={(date) => {
                            // Validate that role and provider are selected first
                            if (!selectedRole) {
                              setRoleError("please select Role first");
                              return;
                            }
                            if (!selectedProviderId) {
                              setProviderError("please select name first");
                              return;
                            }
                            // Clear errors and set date if validation passes
                            setRoleError("");
                            setProviderError("");
                            setSelectedDate(date);
                          }}
                          disabled={(date) => {
                            // Disable past dates (but allow today)
                            if (isBefore(startOfDay(date), startOfDay(new Date()))) return true;
                            
                            // Disable dates beyond 3 months
                            if (isAfter(date, addMonths(new Date(), 3))) return true;
                            
                            // Disable dates without shifts for selected provider
                            if (selectedProviderId && !hasShiftsOnDate(date)) {
                              return true;
                            }
                            
                            return false;
                          }}
                          className="rounded-md border"
                          data-testid="calendar-date-picker"
                        />
                      </div>

                      {/* Column 2: Select Time Slot */}
                      <div>
                        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-3 block">
                          Select Time Slot
                        </Label>
                        {selectedProviderId && selectedDate ? (
                          <div 
                            key={`${selectedProviderId}-${format(selectedDate, 'yyyy-MM-dd')}`}
                            className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto"
                          >
                            {timeSlots.length > 0 ? timeSlots.map((timeSlot) => {
                              const isBooked = isTimeSlotBooked(timeSlot);
                              const isSelected = selectedTimeSlot === timeSlot;
                              
                              return (
                                <Button
                                  key={timeSlot}
                                  type="button"
                                  variant={isSelected ? "default" : "outline"}
                                  size="sm"
                                  className={`
                                    ${!isBooked && !isSelected 
                                      ? "bg-green-500 hover:bg-green-600 text-white border-green-600" 
                                      : ""
                                    }
                                    ${isBooked 
                                      ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-50" 
                                      : ""
                                    }
                                    ${isSelected 
                                      ? "bg-blue-600 text-white" 
                                      : ""
                                    }
                                  `}
                                  onClick={() => {
                                    if (!isBooked) {
                                      setSelectedTimeSlot(timeSlot);
                                      // Update bookingForm with proper datetime format
                                      if (selectedDate) {
                                        const time24 = timeSlotTo24Hour(timeSlot);
                                        const dateTime = `${format(selectedDate, 'yyyy-MM-dd')}T${time24}:00`;
                                        setBookingForm(prev => ({ ...prev, scheduledAt: dateTime }));
                                      }
                                    }
                                  }}
                                  disabled={isBooked}
                                  data-testid={`time-slot-${timeSlot.replace(/[: ]/g, '-')}`}
                                >
                                  {timeSlot}
                                </Button>
                              );
                            }) : (
                              <div className="col-span-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                                <p className="text-sm text-gray-600">
                                  No available time slots for this date.
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                            <p className="text-sm text-gray-600">
                              Please select a provider and date to view available time slots.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : isDoctorLike(user?.role) ? (
                  /* For doctor role - New UI Layout */
                  <div className="space-y-6">
                    {/* Row 1: Select Patient + Patient Information | Select Duration + Doctor Details */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Column 1: Select Patient and Patient Information */}
                      <div className="space-y-4">
                        {/* Patient Selection */}
                        <div>
                          <Label className="text-sm font-medium text-gray-900 dark:text-white">
                            Select Patient
                          </Label>
                          <Popover open={patientComboboxOpen} onOpenChange={setPatientComboboxOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={patientComboboxOpen}
                                className="mt-2 w-full justify-between"
                                data-testid="trigger-patient-combobox"
                              >
                                {bookingForm.patientId 
                                  ? (() => {
                                      const selectedPatient = patients.find((patient: any) => {
                                        const pId = patient.patientId || patient.id.toString();
                                        return pId === bookingForm.patientId;
                                      });
                                      
                                      if (!selectedPatient) {
                                        return "Select patient...";
                                      }
                                      
                                      const displayName = `${selectedPatient.firstName} ${selectedPatient.lastName}`;
                                      const email = selectedPatient.email ? ` (${selectedPatient.email})` : '';
                                      return `${displayName}${email}`;
                                    })()
                                  : "Select patient..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput 
                                  placeholder="Search patients..." 
                                  data-testid="input-search-patient"
                                />
                                <CommandList>
                                  <CommandEmpty>No patient found.</CommandEmpty>
                                  <CommandGroup>
                                    {patients.map((patient: any) => {
                                      const patientValue = patient.patientId || patient.id.toString();
                                      const patientDisplayName = `${patient.firstName} ${patient.lastName}`;
                                      const patientEmail = patient.email ? ` (${patient.email})` : '';
                                      const patientWithEmail = `${patientDisplayName}${patientEmail}`;
                                      
                                      return (
                                        <CommandItem
                                          key={patient.id}
                                          value={patientWithEmail}
                                          onSelect={(currentValue) => {
                                            setBookingForm(prev => ({ ...prev, patientId: patientValue }));
                                            setPatientComboboxOpen(false);
                                          }}
                                          data-testid={`item-patient-${patient.id}`}
                                        >
                                          <Check
                                            className={`mr-2 h-4 w-4 ${
                                              patientValue === bookingForm.patientId ? "opacity-100" : "opacity-0"
                                            }`}
                                          />
                                          <div className="flex flex-col">
                                            <span className="font-medium">{patientDisplayName}</span>
                                            {patient.email && <span className="text-sm text-gray-600">{patient.email}</span>}
                                          </div>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        {/* Patient Information Card - Always visible */}
                        <div>
                          <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                            Patient Information
                          </Label>
                          {bookingForm.patientId ? (
                            (() => {
                              const selectedPatient = patients.find((patient: any) => 
                                (patient.patientId || patient.id.toString()) === bookingForm.patientId
                              );
                              
                              if (!selectedPatient) return null;
                              
                              // Calculate age from date of birth
                              const age = selectedPatient.dateOfBirth 
                                ? new Date().getFullYear() - new Date(selectedPatient.dateOfBirth).getFullYear()
                                : null;
                              
                              // Get patient initials for avatar
                              const initials = `${selectedPatient.firstName?.[0] || ''}${selectedPatient.lastName?.[0] || ''}`.toUpperCase();
                              
                              return (
                                <Card className="mt-2">
                                  <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                      {/* Patient Avatar */}
                                      <div className="flex-shrink-0">
                                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-lg" data-testid={`avatar-patient-${selectedPatient.id}`}>
                                          {initials}
                                        </div>
                                      </div>
                                      
                                      {/* Patient Details */}
                                      <div className="flex-1 space-y-3">
                                        {/* Name and Age/ID */}
                                        <div>
                                          <h3 className="font-semibold text-lg text-gray-900 dark:text-white" data-testid={`text-patient-name-${selectedPatient.id}`}>
                                            {selectedPatient.firstName} {selectedPatient.lastName}
                                          </h3>
                                          <p className="text-gray-600 dark:text-gray-400" data-testid={`text-patient-age-id-${selectedPatient.id}`}>
                                            {age && `Age ${age} • `}{selectedPatient.patientId || `P${selectedPatient.id.toString().padStart(6, '0')}`}
                                          </p>
                                        </div>
                                        
                                        {/* Contact Information */}
                                        <div className="space-y-2 text-sm">
                                          {(selectedPatient.phone || selectedPatient.phoneNumber) && (
                                            <div className="flex items-center gap-2" data-testid={`text-patient-phone-${selectedPatient.id}`}>
                                              <Phone className="h-4 w-4 text-gray-500" />
                                              <span className="text-gray-700 dark:text-gray-300">{selectedPatient.phone || selectedPatient.phoneNumber}</span>
                                            </div>
                                          )}
                                          
                                          {selectedPatient.email && (
                                            <div className="flex items-center gap-2" data-testid={`text-patient-email-${selectedPatient.id}`}>
                                              <Mail className="h-4 w-4 text-gray-500" />
                                              <span className="text-gray-700 dark:text-gray-300">{selectedPatient.email}</span>
                                            </div>
                                          )}
                                          
                                          {selectedPatient.nhsNumber && (
                                            <div className="flex items-center gap-2" data-testid={`text-patient-nhs-${selectedPatient.id}`}>
                                              <FileText className="h-4 w-4 text-gray-500" />
                                              <span className="text-gray-700 dark:text-gray-300">NHS: {selectedPatient.nhsNumber}</span>
                                            </div>
                                          )}
                                          
                                          {selectedPatient.address && (selectedPatient.address.city || selectedPatient.address.country) && (
                                            <div className="flex items-center gap-2" data-testid={`text-patient-address-${selectedPatient.id}`}>
                                              <MapPin className="h-4 w-4 text-gray-500" />
                                              <span className="text-gray-700 dark:text-gray-300">
                                                {[selectedPatient.address.city, selectedPatient.address.country].filter(Boolean).join(', ')}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })()
                          ) : (
                            <Card className="mt-2">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-center py-8">
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Please select a patient to view their information
                                  </p>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </div>

                      {/* Column 2: Select Duration and Doctor Details */}
                      <div className="space-y-4">
                        {/* Select Duration */}
                        <div>
                          <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                            Select Duration
                          </Label>
                          <Select
                            value={selectedDuration.toString()}
                            onValueChange={(value) => setSelectedDuration(parseInt(value))}
                          >
                            <SelectTrigger className="w-full" data-testid="select-duration-admin">
                              <SelectValue placeholder="Select duration..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="15">15 minutes</SelectItem>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="60">60 minutes</SelectItem>
                              <SelectItem value="90">90 minutes</SelectItem>
                          <SelectItem value="120">120 minutes (2 hours)</SelectItem>
                          <SelectItem value="180">180 minutes (3 hours)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Doctor Details */}
                        <div>
                          <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                            Doctor Details
                          </Label>
                          <Card className="mt-2">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-4">
                                {/* Doctor Avatar */}
                                <div className="flex-shrink-0">
                                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                                    {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()}
                                  </div>
                                </div>
                                
                                {/* Doctor Details */}
                                <div className="flex-1 space-y-3">
                                  {/* Name and Department */}
                                  <div>
                                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                                      Dr. {user.firstName} {user.lastName}
                                    </h3>
                                    {user.department && (
                                      <p className="text-gray-600 dark:text-gray-400">
                                        {user.department}
                                      </p>
                                    )}
                                  </div>
                                  
                                  {/* Additional Information */}
                                  <div className="space-y-2 text-sm">
                                    {((user as any).medicalSpecialtyCategory || (user as any).specialty) && (
                                      <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-gray-500" />
                                        <span className="text-gray-700 dark:text-gray-300">
                                          {(user as any).medicalSpecialtyCategory || (user as any).specialty}
                                          {(user as any).subSpecialty && ` - ${(user as any).subSpecialty}`}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {user.email && (
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-gray-500" />
                                        <span className="text-gray-700 dark:text-gray-300">{user.email}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Appointment Type + Treatment/Consultation */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-900 dark:text-white">Appointment Type</Label>
                        <Popover open={openDoctorAppointmentTypeCombo} onOpenChange={setOpenDoctorAppointmentTypeCombo}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openDoctorAppointmentTypeCombo}
                              className="w-full justify-between mt-1"
                              data-testid="select-doctor-appointment-type"
                            >
                              {doctorAppointmentType
                                ? doctorAppointmentType.charAt(0).toUpperCase() + doctorAppointmentType.slice(1)
                                : "Select an appointment type"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search appointment type..." />
                              <CommandList>
                                <CommandEmpty>No type found.</CommandEmpty>
                                <CommandGroup>
                                  {["consultation", "treatment"].map((type) => (
                                    <CommandItem
                                      key={type}
                                      value={type}
                                      onSelect={(value) => {
                                        const normalized = value as "consultation" | "treatment";
                                        setDoctorAppointmentType(normalized);
                                        setDoctorAppointmentSelectedTreatment(null);
                                        setDoctorAppointmentSelectedConsultation(null);
                                        setDoctorAppointmentTypeError("");
                                        setDoctorTreatmentSelectionError("");
                                        setDoctorConsultationSelectionError("");
                                        setOpenDoctorAppointmentTypeCombo(false);
                                      }}
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${
                                          doctorAppointmentType === type ? "opacity-100" : "opacity-0"
                                        }`}
                                      />
                                      {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {doctorAppointmentTypeError && (
                          <p className="text-red-500 text-xs mt-1">{doctorAppointmentTypeError}</p>
                        )}
                      </div>

                      <div>
                        {doctorAppointmentType === "treatment" && (
                          <>
                            <Label className="text-sm font-medium text-gray-900 dark:text-white">Select Treatment</Label>
                            <Popover open={openDoctorTreatmentCombo} onOpenChange={setOpenDoctorTreatmentCombo}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={openDoctorTreatmentCombo}
                                  className="w-full justify-between mt-1"
                                  data-testid="select-doctor-treatment"
                                >
                                  {doctorAppointmentSelectedTreatment ? doctorAppointmentSelectedTreatment.name : "Select a treatment"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search treatments..." />
                                  <CommandList>
                                    <CommandEmpty>No treatments found.</CommandEmpty>
                                    <CommandGroup>
                                      {treatmentsList.map((treatment: any) => (
                                        <CommandItem
                                          key={treatment.id}
                                          value={treatment.id.toString()}
                                          onSelect={() => {
                                            setDoctorAppointmentSelectedTreatment(treatment);
                                            setDoctorTreatmentSelectionError("");
                                            setOpenDoctorTreatmentCombo(false);
                                          }}
                                        >
                                          <div className="flex items-center gap-2 w-full">
                                            <span
                                              className="inline-flex h-3 w-3 rounded-full border border-gray-300"
                                              style={{ backgroundColor: treatment.colorCode || "#D1D5DB" }}
                                            />
                                            <span className="flex-1 text-left">{treatment.name}</span>
                                            <span className="text-xs text-gray-500">
                                              {treatment.currency} {treatment.basePrice}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            {doctorAppointmentSelectedTreatment && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1 px-0 text-blue-600"
                                onClick={() => setDoctorAppointmentSelectedTreatment(null)}
                              >
                                Clear selection
                              </Button>
                            )}
                            {doctorTreatmentSelectionError && (
                              <p className="text-red-500 text-xs mt-1">{doctorTreatmentSelectionError}</p>
                            )}
                          </>
                        )}
                        {doctorAppointmentType === "consultation" && (
                          <>
                            <Label className="text-sm font-medium text-gray-900 dark:text-white">Select Consultation</Label>
                            <Popover open={openDoctorConsultationCombo} onOpenChange={setOpenDoctorConsultationCombo}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={openDoctorConsultationCombo}
                                  className="w-full justify-between mt-1"
                                  data-testid="select-doctor-consultation"
                                >
                                  {doctorAppointmentSelectedConsultation ? doctorAppointmentSelectedConsultation.serviceName : "Select a consultation"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search consultation..." />
                                  <CommandList>
                                    <CommandEmpty>No consultations found.</CommandEmpty>
                                    <CommandGroup>
                                      {consultationServices.map((service: any) => (
                                        <CommandItem
                                          key={service.id}
                                          value={service.id.toString()}
                                          onSelect={() => {
                                            setDoctorAppointmentSelectedConsultation(service);
                                            setDoctorConsultationSelectionError("");
                                            setOpenDoctorConsultationCombo(false);
                                          }}
                                        >
                                          <div className="flex items-center gap-2 w-full">
                                            <span className="flex-1 text-left">{service.serviceName}</span>
                                            <span className="text-xs text-gray-500">
                                              {service.currency} {service.basePrice}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            {doctorAppointmentSelectedConsultation && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-1 px-0 text-blue-600"
                                onClick={() => setDoctorAppointmentSelectedConsultation(null)}
                              >
                                Clear selection
                              </Button>
                            )}
                            {doctorConsultationSelectionError && (
                              <p className="text-red-500 text-xs mt-1">{doctorConsultationSelectionError}</p>
                            )}
                          </>
                        )}
                        {!doctorAppointmentType && (
                          <p className="text-xs text-gray-500 mt-2">
                            Select an appointment type to pick a treatment or consultation.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Select Date | Select Time Slot */}
                    <div className="grid gap-6 lg:grid-cols-2">
                      {/* Column 1: Select Date */}
                      <div>
                        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                          Select Date
                        </Label>
                        <CalendarComponent
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          disabled={(date) => {
                            // Disable past dates (but allow today)
                            if (isBefore(startOfDay(date), startOfDay(new Date()))) return true;
                            
                            // Disable dates beyond 3 months
                            if (isAfter(date, addMonths(new Date(), 3))) return true;
                            
                            // Disable dates without shifts for selected provider
                            if (selectedProviderId && !hasShiftsOnDate(date)) {
                              return true;
                            }
                            
                            return false;
                          }}
                          className="rounded-md border"
                          data-testid="calendar-date-picker"
                        />
                      </div>

                      {/* Column 2: Select Time Slot */}
                      <div>
                        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-3 block">
                          Select Time Slot
                        </Label>
                        {selectedProviderId && selectedDate ? (
                          <div 
                            key={`${selectedProviderId}-${format(selectedDate, 'yyyy-MM-dd')}`}
                            className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto"
                          >
                            {timeSlots.length > 0 ? timeSlots.map((timeSlot) => {
                              const isBooked = isTimeSlotBooked(timeSlot);
                              const isSelected = selectedTimeSlot === timeSlot;
                              
                              return (
                                <Button
                                  key={timeSlot}
                                  type="button"
                                  variant={isSelected ? "default" : "outline"}
                                  size="sm"
                                  className={`
                                    ${!isBooked && !isSelected 
                                      ? "bg-green-500 hover:bg-green-600 text-white border-green-600" 
                                      : ""
                                    }
                                    ${isBooked 
                                      ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-50" 
                                      : ""
                                    }
                                    ${isSelected 
                                      ? "bg-blue-600 text-white" 
                                      : ""
                                    }
                                  `}
                                  onClick={() => {
                                    if (!isBooked) {
                                      setSelectedTimeSlot(timeSlot);
                                      // Update bookingForm with proper datetime format
                                      if (selectedDate) {
                                        const time24 = timeSlotTo24Hour(timeSlot);
                                        const dateTime = `${format(selectedDate, 'yyyy-MM-dd')}T${time24}:00`;
                                        setBookingForm(prev => ({ ...prev, scheduledAt: dateTime }));
                                      }
                                    }
                                  }}
                                  disabled={isBooked}
                                  data-testid={`time-slot-${timeSlot.replace(/[: ]/g, '-')}`}
                                >
                                  {timeSlot}
                                </Button>
                              );
                            }) : (
                              <div className="col-span-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                                <p className="text-sm text-gray-600">
                                  No available time slots for this date.
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                    <Card className="mt-2 min-h-[300px]">
                      <CardContent className="p-4 h-full flex items-center justify-center">
                        <div className="py-8 text-center">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Please select a provider and date to view available time slots.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* For non-patient, non-doctor roles (admin, etc.) - Keep original layout */
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Left Column - Patient Selection and Provider Selection */}
                    <div className="space-y-6">
                      {/* Patient Selection */}
                      <div>
                        <Label className="text-sm font-medium text-gray-900 dark:text-white">
                          Select Patient
                        </Label>
                        <Popover open={patientComboboxOpen} onOpenChange={setPatientComboboxOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={patientComboboxOpen}
                                className="mt-2 w-full justify-between"
                                data-testid="trigger-patient-combobox"
                              >
                                {bookingForm.patientId 
                                  ? (() => {
                                      const selectedPatient = patients.find((patient: any) => {
                                        const pId = patient.patientId || patient.id.toString();
                                        return pId === bookingForm.patientId;
                                      });
                                      
                                      if (!selectedPatient) {
                                        return "Select patient...";
                                      }
                                      
                                      const displayName = `${selectedPatient.firstName} ${selectedPatient.lastName}`;
                                      const email = selectedPatient.email ? ` (${selectedPatient.email})` : '';
                                      return `${displayName}${email}`;
                                    })()
                                  : "Select patient..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput 
                                  placeholder="Search patients..." 
                                  data-testid="input-search-patient"
                                />
                                <CommandList>
                                  <CommandEmpty>No patient found.</CommandEmpty>
                                  <CommandGroup>
                                    {patients.map((patient: any) => {
                                      const patientValue = patient.patientId || patient.id.toString();
                                      const patientDisplayName = `${patient.firstName} ${patient.lastName}`;
                                      const patientEmail = patient.email ? ` (${patient.email})` : '';
                                      const patientWithEmail = `${patientDisplayName}${patientEmail}`;
                                      
                                      return (
                                        <CommandItem
                                          key={patient.id}
                                          value={patientWithEmail}
                                          onSelect={(currentValue) => {
                                            setBookingForm(prev => ({ ...prev, patientId: patientValue }));
                                            setPatientComboboxOpen(false);
                                          }}
                                          data-testid={`item-patient-${patient.id}`}
                                        >
                                          <Check
                                            className={`mr-2 h-4 w-4 ${
                                              patientValue === bookingForm.patientId ? "opacity-100" : "opacity-0"
                                            }`}
                                          />
                                          <div className="flex flex-col">
                                            <span className="font-medium">{patientDisplayName}</span>
                                            {patient.email && <span className="text-sm text-gray-600">{patient.email}</span>}
                                          </div>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                      </div>

                      {/* Select Role */}
                      <div>
                        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                          Select Role
                        </Label>
                        <Popover open={openRoleCombo} onOpenChange={setOpenRoleCombo}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openRoleCombo}
                              className="w-full justify-between"
                              data-testid="select-role-admin"
                            >
                              {selectedRole 
                                ? availableRoles.find(r => r.name === selectedRole)?.displayName || selectedRole
                                : "Select role..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Search role..." />
                              <CommandList>
                                <CommandEmpty>No role found.</CommandEmpty>
                                <CommandGroup>
                                  {availableRoles.map((role) => (
                                    <CommandItem
                                      key={role.name}
                                      value={role.name}
                                      onSelect={(currentValue) => {
                                        setSelectedRole(currentValue);
                                        setSelectedProviderId("");
                                        setSelectedMedicalSpecialty(""); // Reset specialty when role changes
                                        setOpenRoleCombo(false);
                                      }}
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${
                                          role.name === selectedRole ? "opacity-100" : "opacity-0"
                                        }`}
                                      />
                                      {role.displayName}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Select Name (Provider) */}
                      {selectedRole && (
                        <div>
                          <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                            Select Name
                          </Label>
                          <Popover open={openProviderCombo} onOpenChange={setOpenProviderCombo}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openProviderCombo}
                                className="w-full justify-between"
                                data-testid="select-provider-admin"
                              >
                                {selectedProviderId 
                                  ? (() => {
                                      const provider = filteredUsers.find((u: any) => u.id.toString() === selectedProviderId);
                                      return provider ? `${provider.firstName} ${provider.lastName}` : "Select provider...";
                                    })()
                                  : "Select provider..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput placeholder="Search provider..." />
                                <CommandList>
                                  <CommandEmpty>No provider found.</CommandEmpty>
                                  <CommandGroup>
                                    {filteredUsers.map((provider: any) => (
                                      <CommandItem
                                        key={provider.id}
                                        value={`${provider.firstName} ${provider.lastName}`}
                                        onSelect={() => {
                                          setSelectedProviderId(provider.id.toString());
                                          setOpenProviderCombo(false);
                                          setProviderError("");
                                          // Auto-set current date when doctor is selected for patient bookings (only if no date selected yet)
                                          if (user?.role === 'patient' && !selectedDate) {
                                            setSelectedDate(new Date());
                                          }
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${
                                            provider.id.toString() === selectedProviderId ? "opacity-100" : "opacity-0"
                                          }`}
                                        />
                                        {provider.firstName} {provider.lastName}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}

                      {/* Select Duration */}
                      <div>
                        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                          Select Duration
                        </Label>
                        <Select
                          value={selectedDuration.toString()}
                          onValueChange={(value) => setSelectedDuration(parseInt(value))}
                        >
                          <SelectTrigger className="w-full" data-testid="select-duration-admin">
                            <SelectValue placeholder="Select duration..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">15 minutes</SelectItem>
                            <SelectItem value="30">30 minutes</SelectItem>
                            <SelectItem value="60">60 minutes</SelectItem>
                            <SelectItem value="90">90 minutes</SelectItem>
                            <SelectItem value="120">120 minutes (2 hours)</SelectItem>
                            <SelectItem value="180">180 minutes (3 hours)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Patient Information Card - Shows when patient is selected */}
                      {bookingForm.patientId && (
                        <div>
                          <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                            Patient Information
                          </Label>
                          {(() => {
                            const selectedPatient = patients.find((patient: any) => 
                              (patient.patientId || patient.id.toString()) === bookingForm.patientId
                            );
                            
                            if (!selectedPatient) return null;
                            
                            // Calculate age from date of birth
                            const age = selectedPatient.dateOfBirth 
                              ? new Date().getFullYear() - new Date(selectedPatient.dateOfBirth).getFullYear()
                              : null;
                            
                            // Get patient initials for avatar
                            const initials = `${selectedPatient.firstName?.[0] || ''}${selectedPatient.lastName?.[0] || ''}`.toUpperCase();
                            
                            return (
                              <Card className="mt-2">
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-4">
                                    {/* Patient Avatar */}
                                    <div className="flex-shrink-0">
                                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-lg" data-testid={`avatar-patient-${selectedPatient.id}`}>
                                        {initials}
                                      </div>
                                    </div>
                                    
                                    {/* Patient Details */}
                                    <div className="flex-1 space-y-3">
                                      {/* Name and Age/ID */}
                                      <div>
                                        <h3 className="font-semibold text-lg text-gray-900 dark:text-white" data-testid={`text-patient-name-${selectedPatient.id}`}>
                                          {selectedPatient.firstName} {selectedPatient.lastName}
                                        </h3>
                                        <p className="text-gray-600 dark:text-gray-400" data-testid={`text-patient-age-id-${selectedPatient.id}`}>
                                          {age && `Age ${age} • `}{selectedPatient.patientId || `P${selectedPatient.id.toString().padStart(6, '0')}`}
                                        </p>
                                      </div>
                                      
                                      {/* Contact Information */}
                                      <div className="space-y-2 text-sm">
                                        {(selectedPatient.phone || selectedPatient.phoneNumber) && (
                                          <div className="flex items-center gap-2" data-testid={`text-patient-phone-${selectedPatient.id}`}>
                                            <Phone className="h-4 w-4 text-gray-500" />
                                            <span className="text-gray-700 dark:text-gray-300">{selectedPatient.phone || selectedPatient.phoneNumber}</span>
                                          </div>
                                        )}
                                        
                                        {selectedPatient.email && (
                                          <div className="flex items-center gap-2" data-testid={`text-patient-email-${selectedPatient.id}`}>
                                            <Mail className="h-4 w-4 text-gray-500" />
                                            <span className="text-gray-700 dark:text-gray-300">{selectedPatient.email}</span>
                                          </div>
                                        )}
                                        
                                        {selectedPatient.nhsNumber && (
                                          <div className="flex items-center gap-2" data-testid={`text-patient-nhs-${selectedPatient.id}`}>
                                            <FileText className="h-4 w-4 text-gray-500" />
                                            <span className="text-gray-700 dark:text-gray-300">NHS: {selectedPatient.nhsNumber}</span>
                                          </div>
                                        )}
                                        
                                        {selectedPatient.address && (selectedPatient.address.city || selectedPatient.address.country) && (
                                          <div className="flex items-center gap-2" data-testid={`text-patient-address-${selectedPatient.id}`}>
                                            <MapPin className="h-4 w-4 text-gray-500" />
                                            <span className="text-gray-700 dark:text-gray-300">
                                              {[selectedPatient.address.city, selectedPatient.address.country].filter(Boolean).join(', ')}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Right Column - Calendar and Time Slots */}
                    <div className="space-y-6">
                      {/* Select Date */}
                      <div>
                        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                          Select Date
                        </Label>
                        <CalendarComponent
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          disabled={(date) => {
                            // Disable past dates (but allow today)
                            if (isBefore(startOfDay(date), startOfDay(new Date()))) return true;
                            
                            // Disable dates beyond 3 months
                            if (isAfter(date, addMonths(new Date(), 3))) return true;
                            
                            // Disable dates without shifts for selected provider
                            if (selectedProviderId && !hasShiftsOnDate(date)) {
                              return true;
                            }
                            
                            return false;
                          }}
                          className="rounded-md border"
                          data-testid="calendar-date-picker"
                        />
                      </div>

                      {/* Select Time Slot */}
                      <div>
                        <Label className="text-sm font-medium text-gray-900 dark:text-white mb-3 block">
                          Select Time Slot
                        </Label>
                        {selectedProviderId && selectedDate ? (
                          <div 
                            key={`${selectedProviderId}-${format(selectedDate, 'yyyy-MM-dd')}`}
                            className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto"
                          >
                            {timeSlots.length > 0 ? timeSlots.map((timeSlot) => {
                              const isBooked = isTimeSlotBooked(timeSlot);
                              const isSelected = selectedTimeSlot === timeSlot;
                              
                              return (
                                <Button
                                  key={timeSlot}
                                  type="button"
                                  variant={isSelected ? "default" : "outline"}
                                  size="sm"
                                  className={`
                                    ${!isBooked && !isSelected 
                                      ? "bg-green-500 hover:bg-green-600 text-white border-green-600" 
                                      : ""
                                    }
                                    ${isBooked 
                                      ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-50" 
                                      : ""
                                    }
                                    ${isSelected 
                                      ? "bg-blue-600 text-white" 
                                      : ""
                                    }
                                  `}
                                  onClick={() => {
                                    if (!isBooked) {
                                      setSelectedTimeSlot(timeSlot);
                                      // Update bookingForm with proper datetime format
                                      if (selectedDate) {
                                        const time24 = timeSlotTo24Hour(timeSlot);
                                        const dateTime = `${format(selectedDate, 'yyyy-MM-dd')}T${time24}:00`;
                                        setBookingForm(prev => ({ ...prev, scheduledAt: dateTime }));
                                      }
                                    }
                                  }}
                                  disabled={isBooked}
                                  data-testid={`time-slot-${timeSlot.replace(/[: ]/g, '-')}`}
                                >
                                  {timeSlot}
                                </Button>
                              );
                            }) : (
                              <div className="col-span-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                                <p className="text-sm text-gray-600">
                                  No available time slots for this date.
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                            <p className="text-sm text-gray-600">
                              Please select a provider and date to view available time slots.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}


                {/* Book Appointment Button */}
                {selectedProviderId && selectedDate && selectedTimeSlot && bookingForm.patientId && (
                  <div className="flex justify-end gap-2 mt-6 pt-6 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowNewAppointmentModal(false);
                        setSelectedSpecialty("");
                        setSelectedSubSpecialty("");
                        setFilteredDoctors([]);
                        setSelectedDoctor(null);
                        setSelectedDate(undefined);
                        setSelectedTimeSlot("");
                        setSelectedRole("");
                        setSelectedProviderId("");
                        setSelectedDuration(30);
                        setSelectedMedicalSpecialty("");
                        setDoctorAppointmentType("");
                        setDoctorAppointmentSelectedTreatment(null);
                        setDoctorAppointmentSelectedConsultation(null);
                        setDoctorAppointmentTypeError("");
                        setDoctorTreatmentSelectionError("");
                        setDoctorConsultationSelectionError("");
                      }}
                      data-testid="button-cancel-appointment"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        // Validate sufficient time is available for the selected duration
                        const { available, availableMinutes } = checkSufficientTime(selectedTimeSlot, selectedDuration);
                        
                        if (!available) {
                          setInsufficientTimeMessage(
                            `Only ${availableMinutes} minutes are available at ${selectedTimeSlot}. Please select another time slot.`
                          );
                          setShowInsufficientTimeModal(true);
                          return;
                        }

                        // Convert 12-hour time to 24-hour format and create datetime string directly
                        const time24 = timeSlotTo24Hour(selectedTimeSlot);
                        
                        // Format date as YYYY-MM-DD directly without timezone conversion
                        const dateStr = format(selectedDate!, 'yyyy-MM-dd');
                        
                        // Combine date and time directly without timezone conversion
                        const [hour, minute] = time24.split(':').map(Number);
                        const appointmentMoment = new Date(selectedDate);
                        appointmentMoment.setHours(hour, minute, 0, 0);
                        const appointmentDateTime = format(
                          appointmentMoment,
                          "yyyy-MM-dd'T'HH:mm:ssxxx",
                        );
                        
                        // Handle both numeric and string patient IDs
                        let patientId: string | number = bookingForm.patientId;
                        if (/^\d+$/.test(bookingForm.patientId)) {
                          patientId = parseInt(bookingForm.patientId);
                        }

                        // Get provider info
                        const provider = filteredUsers.find((u: any) => u.id.toString() === selectedProviderId);

                        const appointmentData = {
                          ...bookingForm,
                          patientId: patientId,
                          providerId: Number(selectedProviderId),
                          assignedRole: selectedRole,
                          title: bookingForm.title || `Appointment with ${provider?.firstName || ''} ${provider?.lastName || ''}`.trim(),
                          location: bookingForm.location || provider?.department || '',
                          duration: selectedDuration,
                          scheduledAt: appointmentDateTime
                        };

                        const normalizedPatientAppointmentType =
                          doctorAppointmentType || "consultation";
                        const patientTreatmentId =
                          normalizedPatientAppointmentType === "treatment"
                            ? doctorAppointmentSelectedTreatment?.id || null
                            : null;
                        const patientConsultationId =
                          normalizedPatientAppointmentType === "consultation"
                            ? doctorAppointmentSelectedConsultation?.id || null
                            : null;
                        const patientAppointmentData = {
                          ...appointmentData,
                          appointmentType: normalizedPatientAppointmentType,
                          treatmentId: patientTreatmentId,
                          consultationId: patientConsultationId,
                        };

                        // Check for duplicate appointments (same patient, same doctor, same date)
                        // Convert patientId to numeric ID for comparison
                        const selectedPatient = patients.find((p: any) => {
                          return p.id.toString() === bookingForm.patientId || p.patientId === bookingForm.patientId;
                        });
                        const numericPatientId = selectedPatient?.id;
                        
                        console.log('[DUPLICATE CHECK] bookingForm.patientId:', bookingForm.patientId);
                        console.log('[DUPLICATE CHECK] selectedPatient:', selectedPatient);
                        console.log('[DUPLICATE CHECK] numericPatientId:', numericPatientId);
                        console.log('[DUPLICATE CHECK] selectedProviderId:', selectedProviderId);
                        console.log('[DUPLICATE CHECK] selectedDate:', selectedDate);
                        console.log('[DUPLICATE CHECK] allAppointments:', allAppointments);
                        
                        if (allAppointments && selectedDate && numericPatientId) {
                          const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
                          console.log('[DUPLICATE CHECK] selectedDateStr:', selectedDateStr);
                          
                          const duplicateAppointment = allAppointments.find((apt: any) => {
                            const aptDateStr = format(new Date(apt.scheduledAt), 'yyyy-MM-dd');
                            // Database uses snake_case (patient_id, provider_id), also check camelCase for compatibility
                            const aptPatientId = apt.patient_id || apt.patientId;
                            const aptProviderId = apt.provider_id || apt.providerId;
                            
                            console.log('[DUPLICATE CHECK] Checking appointment:', apt.id, {
                              aptPatientId,
                              numericPatientId,
                              match1: aptPatientId === numericPatientId,
                              aptProviderId: aptProviderId?.toString(),
                              selectedProviderId,
                              match2: aptProviderId?.toString() === selectedProviderId,
                              aptDateStr,
                              selectedDateStr,
                              match3: aptDateStr === selectedDateStr,
                              status: apt.status,
                              notCancelled: apt.status !== 'cancelled'
                            });
                            
                            return (
                              aptPatientId === numericPatientId &&
                              aptProviderId?.toString() === selectedProviderId &&
                              aptDateStr === selectedDateStr &&
                              apt.status !== 'cancelled' // Don't count cancelled appointments as duplicates
                            );
                          });
                          
                          console.log('[DUPLICATE CHECK] Found duplicate:', duplicateAppointment);
                          
                          if (duplicateAppointment) {
                            // Find patient name
                            const patientName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : 'the patient';
                            const formattedDate = format(selectedDate, 'MMMM do, yyyy');
                            setDuplicateAppointmentDetails(`Patient ${patientName} already has an appointment with the same doctor on ${formattedDate}. Please select another time slot.`);
                            setShowDuplicateWarning(true);
                            return;
                          }
                          
                          // Doctor-only: Check for time slot conflicts (same patient, same time slot)
                          if (user?.role === 'doctor' && selectedTimeSlot) {
                            console.log('[TIME SLOT CHECK] Starting time slot conflict detection...');
                            console.log('[TIME SLOT CHECK] Selected time slot:', selectedTimeSlot);
                            
                            // Convert 12-hour time format to 24-hour format for comparison
                            const convertTo24Hour = (time12h: string): string => {
                              const [time, modifier] = time12h.split(' ');
                              let [hours, minutes] = time.split(':');
                              
                              if (hours === '12') {
                                hours = '00';
                              }
                              
                              if (modifier === 'PM') {
                                hours = String(parseInt(hours, 10) + 12);
                              }
                              
                              return `${hours.padStart(2, '0')}:${minutes}`;
                            };
                            
                            const selectedTime24h = selectedTimeSlot.includes('AM') || selectedTimeSlot.includes('PM') 
                              ? convertTo24Hour(selectedTimeSlot)
                              : selectedTimeSlot;
                            
                            console.log('[TIME SLOT CHECK] Converted selected time to 24h:', selectedTime24h);
                            
                            const conflictingAppointment = allAppointments.find((apt: any) => {
                              const aptPatientId = apt.patient_id || apt.patientId;
                              if (aptPatientId !== numericPatientId || apt.status === 'cancelled') {
                                return false;
                              }
                              
                              const aptDateStr = format(new Date(apt.scheduledAt), 'yyyy-MM-dd');
                              if (aptDateStr !== selectedDateStr) {
                                return false;
                              }
                              
                              // Extract time from appointment's scheduledAt
                              const aptTimeString = apt.scheduledAt.substring(11, 16); // Extract "HH:MM"
                              
                              console.log('[TIME SLOT CHECK] Comparing times - Appointment:', aptTimeString, 'vs Selected:', selectedTime24h);
                              
                              return aptTimeString === selectedTime24h;
                            });
                            
                            if (conflictingAppointment) {
                              console.log('[TIME SLOT CHECK] CONFLICT FOUND:', conflictingAppointment);
                              const aptProviderId = conflictingAppointment.provider_id || conflictingAppointment.providerId;
                              const conflictDoctor = filteredUsers.find((u: any) => u.id === aptProviderId);
                              const doctorFullName = conflictDoctor ? `${conflictDoctor.firstName} ${conflictDoctor.lastName}` : 'Unknown Doctor';
                              const patientName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : 'Patient';
                              const formattedDate = format(new Date(conflictingAppointment.scheduledAt), 'MMMM do, yyyy');
                              
                              // Extract time from scheduledAt string to avoid timezone conversion
                              const timeString = conflictingAppointment.scheduledAt.substring(11, 16); // Get "HH:MM"
                              const [hours24, minutes] = timeString.split(':');
                              const hours = parseInt(hours24, 10);
                              const ampm = hours >= 12 ? 'PM' : 'AM';
                              const hours12 = hours % 12 || 12;
                              const formattedTime = `${hours12}:${minutes} ${ampm}`;
                              
                              const duration = conflictingAppointment.duration || 30;
                              setDuplicateAppointmentDetails(`Patient ${patientName} already has an appointment with ${doctorFullName} on ${formattedDate}, at ${formattedTime} for ${duration} minutes. Please select another time slot.`);
                              setShowDuplicateWarning(true);
                              return;
                            } else {
                              console.log('[TIME SLOT CHECK] No conflict found');
                            }
                          }
                          
                          // Patient-only: Check for time slot conflicts (same patient, same time slot)
                          if (user?.role === 'patient' && selectedTimeSlot) {
                            console.log('[PATIENT TIME SLOT CHECK] Starting time slot conflict detection...');
                            console.log('[PATIENT TIME SLOT CHECK] Selected time slot:', selectedTimeSlot);
                            
                            // Convert 12-hour time format to 24-hour format for comparison
                            const convertTo24Hour = (time12h: string): string => {
                              const [time, modifier] = time12h.split(' ');
                              let [hours, minutes] = time.split(':');
                              
                              if (hours === '12') {
                                hours = '00';
                              }
                              
                              if (modifier === 'PM') {
                                hours = String(parseInt(hours, 10) + 12);
                              }
                              
                              return `${hours.padStart(2, '0')}:${minutes}`;
                            };
                            
                            const selectedTime24h = selectedTimeSlot.includes('AM') || selectedTimeSlot.includes('PM') 
                              ? convertTo24Hour(selectedTimeSlot)
                              : selectedTimeSlot;
                            
                            console.log('[PATIENT TIME SLOT CHECK] Converted selected time to 24h:', selectedTime24h);
                            
                            const conflictingAppointment = allAppointments.find((apt: any) => {
                              const aptPatientId = apt.patient_id || apt.patientId;
                              if (aptPatientId !== numericPatientId || apt.status === 'cancelled') {
                                return false;
                              }
                              
                              const aptDateStr = format(new Date(apt.scheduledAt), 'yyyy-MM-dd');
                              if (aptDateStr !== selectedDateStr) {
                                return false;
                              }
                              
                              // Extract time from appointment's scheduledAt
                              const aptTimeString = apt.scheduledAt.substring(11, 16); // Extract "HH:MM"
                              
                              console.log('[PATIENT TIME SLOT CHECK] Comparing times - Appointment:', aptTimeString, 'vs Selected:', selectedTime24h);
                              
                              return aptTimeString === selectedTime24h;
                            });
                            
                            if (conflictingAppointment) {
                              console.log('[PATIENT TIME SLOT CHECK] CONFLICT FOUND:', conflictingAppointment);
                              const aptProviderId = conflictingAppointment.provider_id || conflictingAppointment.providerId;
                              const conflictDoctor = filteredUsers.find((u: any) => u.id === aptProviderId);
                              const doctorFullName = conflictDoctor ? `${conflictDoctor.firstName} ${conflictDoctor.lastName}` : 'Unknown Doctor';
                              const patientName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : 'Patient';
                              const formattedDate = format(new Date(conflictingAppointment.scheduledAt), 'MMMM do, yyyy');
                              
                              // Extract time from scheduledAt string to avoid timezone conversion
                              const timeString = conflictingAppointment.scheduledAt.substring(11, 16); // Get "HH:MM"
                              const [hours24, minutes] = timeString.split(':');
                              const hours = parseInt(hours24, 10);
                              const ampm = hours >= 12 ? 'PM' : 'AM';
                              const hours12 = hours % 12 || 12;
                              const formattedTime = `${hours12}:${minutes} ${ampm}`;
                              
                              const duration = conflictingAppointment.duration || 30;
                              setDuplicateAppointmentDetails(`Patient: ${patientName} already has an appointment with ${doctorFullName} on ${formattedDate}, at ${formattedTime} for ${duration} minutes. Please select another time slot.`);
                              setShowDuplicateWarning(true);
                              return;
                            } else {
                              console.log('[PATIENT TIME SLOT CHECK] No conflict found');
                            }
                          }
                        } else {
                          console.log('[DUPLICATE CHECK] Skipped - missing data:', {
                            hasAllAppointments: !!allAppointments,
                            hasSelectedDate: !!selectedDate,
                            hasNumericPatientId: !!numericPatientId
                          });
                        }

                        // Close the booking modal first
                        setShowNewAppointmentModal(false);
                        setPendingAppointmentData(patientAppointmentData);
                        setShowInvoiceSummary(false);

                        if (isDoctorLike(user?.role)) {
                          setShowConfirmationModal(true);
                          return;
                        }

                        if (user?.role === "patient") {
                          setShowInvoiceModal(true);
                          setShowConfirmationModal(false);
                          return;
                        }

                        // For other users, show confirmation before invoicing
                        setShowConfirmationModal(true);
                      }}
                      data-testid="button-book-appointment"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Book Appointment
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal for All Users */}
        {showConfirmationModal && pendingAppointmentData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Booking Summary
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowConfirmationModal(false);
                      setPendingAppointmentData(null);
                    }}
                    data-testid="button-close-confirmation"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

        <p className="text-sm text-gray-600 mb-6">
          Review appointment details before confirming the booking.
        </p>

        {/* Patient Information */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Patient Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(() => {
                        // Find patient by ID - handle both numeric and string patient IDs
                        const patientId = pendingAppointmentData.patientId;
                        const patient = patients.find((p: any) => {
                          // Try exact ID match first
                          if (p.id === patientId || p.id.toString() === patientId.toString()) {
                            return true;
                          }
                          // Also check patientId field (like P000006)
                          if (p.patientId === patientId || p.patientId === patientId.toString()) {
                            return true;
                          }
                          return false;
                        });
                        
                        return patient ? (
                          <>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-gray-500" />
                              <span className="font-medium">Name:</span>
                              <span>{patient.firstName} {patient.lastName}</span>
                            </div>
                            {patient.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-gray-500" />
                                <span className="font-medium">Email:</span>
                                <span>{patient.email}</span>
                              </div>
                            )}
                            {patient.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-gray-500" />
                                <span className="font-medium">Phone:</span>
                                <span>{patient.phone}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-gray-500">Patient information not available</div>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>

                {/* Booking Summary */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Booking Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Provider</p>
                        <p className="font-medium">
                          {(() => {
                            const provider = filteredUsers.find((u: any) => u.id === pendingAppointmentData.providerId);
                            if (provider) {
                              return `${provider.firstName} ${provider.lastName}`;
                            }
                            if (user && pendingAppointmentData.providerId === user.id) {
                              return `${user.firstName} ${user.lastName}`;
                            }
                            return 'N/A';
                          })()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Date</p>
                        <p className="font-medium">
                          {selectedDate ? format(selectedDate, 'EEEE, MMMM dd, yyyy') : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Time</p>
                        <p className="font-medium">{selectedTimeSlot}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Duration</p>
                        <p className="font-medium">{selectedDuration} minutes</p>
                      </div>
                      {pendingAppointmentData.location && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500 mb-1">Location</p>
                          <p className="font-medium">{pendingAppointmentData.location}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-sm text-gray-500 mb-1">Appointment Type</p>
                        <p className="font-medium">
                          {getAppointmentTypeLabel(pendingAppointmentData)}
                        </p>
                      </div>
                      {bookingSummaryServiceInfo && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500 mb-1">Service</p>
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex h-3 w-3 rounded-full border border-gray-300"
                              style={{ backgroundColor: bookingSummaryServiceInfo.color }}
                            />
                            <span className="font-medium">
                              {bookingSummaryServiceInfo.name}
                              {bookingSummaryServiceInfo.price
                                ? ` • ${bookingSummaryServiceInfo.price}`
                                : ""}
                            </span>
                          </div>
                        </div>
                      )}
                      {pendingAppointmentData.title && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500 mb-1">Title</p>
                          <p className="font-medium">{pendingAppointmentData.title}</p>
                        </div>
                      )}
                      {pendingAppointmentData.description && (
                        <div className="col-span-2">
                          <p className="text-sm text-gray-500 mb-1">Description</p>
                          <p className="font-medium">{pendingAppointmentData.description}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowConfirmationModal(false);
                      setPendingAppointmentData(null);
                      setSelectedDoctor(null); // Clear selected doctor
                      setDoctorAppointmentType("");
                      setDoctorAppointmentSelectedTreatment(null);
                      setDoctorAppointmentSelectedConsultation(null);
                      setDoctorAppointmentTypeError("");
                      setDoctorTreatmentSelectionError("");
                      setDoctorConsultationSelectionError("");
                      setShowNewAppointmentModal(true); // Reopen the booking modal
                    }}
                    data-testid="button-go-back"
                  >
                    Go Back
                  </Button>
                  <Button
                    onClick={() => {
                      if (isDoctorLike(user?.role)) {
                        if (pendingAppointmentData) {
                          setShowConfirmationModal(false);
                          createDoctorAppointmentMutation.mutate(pendingAppointmentData);
                        }
                        return;
                      }

                      const serviceInfo = getBookingServiceInfo(pendingAppointmentData);
                      const invoiceDefaults = buildInvoiceDefaults(pendingAppointmentData, serviceInfo);
                      setInvoiceForm(invoiceDefaults);
                      
                      // Close confirmation modal and open invoice modal
                      setShowConfirmationModal(false);
                      setShowInvoiceModal(true);
                      setShowInvoiceSummary(false);
                    }}
                    data-testid="button-confirm-appointment"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {isDoctorLike(user?.role) ? "Confirm Booking" : "Confirm Appointment"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Insufficient Time Modal */}
        {showInsufficientTimeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-red-600 dark:text-red-400">
                    Insufficient Time Available
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInsufficientTimeModal(false)}
                    data-testid="button-close-insufficient-time"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  {insufficientTimeMessage}
                </p>
                <div className="flex justify-end">
                  <Button
                    onClick={() => setShowInsufficientTimeModal(false)}
                    data-testid="button-ok-insufficient-time"
                  >
                    OK
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Duplicate Appointment Warning Modal */}
        {showDuplicateWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-red-600 dark:text-red-400">
                    Duplicate Appointment
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDuplicateWarning(false)}
                    data-testid="button-close-duplicate-warning"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  You have already created an appointment. ({duplicateAppointmentDetails}) You can choose a different time for the appointment.
                </p>
                <div className="flex justify-end">
                  <Button
                    onClick={() => setShowDuplicateWarning(false)}
                    data-testid="button-ok-duplicate-warning"
                  >
                    OK
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal for All Users */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Appointment Successfully Created
                  </h2>
                  <p className="text-gray-600 mb-6">
                    The appointment has been successfully created and saved.
                  </p>
                  <Button
                    onClick={() => {
                      setShowSuccessModal(false);
                    }}
                    className="w-full"
                    data-testid="button-close-success"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Booking Error Modal */}
        {showBookingErrorModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                    <X className="h-8 w-8 text-red-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Booking Error
                  </h2>
                  <p className="text-gray-600 mb-6">
                    {bookingErrorMessage}
                  </p>
                  <Button
                    onClick={() => {
                      setShowBookingErrorModal(false);
                    }}
                    className="w-full"
                    variant="destructive"
                    data-testid="button-close-booking-error"
                  >
                    OK
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Creation Modal */}
        {showInvoiceModal && pendingAppointmentData && !showInvoiceSummary && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-blue-700 dark:text-blue-400">
                      Create New Invoice
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Invoice details for the appointment
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowInvoiceModal(false);
                      setPendingAppointmentData(null);
                      setShowNewAppointmentModal(true);
                    }}
                    data-testid="button-close-invoice"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* Patient and Doctor Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-900 dark:text-white">Patient</Label>
                      <Input
                        value={(() => {
                          // Match the same patient lookup pattern used in the appointment form
                          const patient = patients.find((p: any) => 
                            p.id === pendingAppointmentData.patientId || 
                            p.id.toString() === pendingAppointmentData.patientId?.toString() ||
                            p.patientId === pendingAppointmentData.patientId
                          );
                          return patient ? `${patient.firstName} ${patient.lastName}` : 'N/A';
                        })()}
                        disabled
                        className="mt-1 bg-gray-50 dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-900 dark:text-white">Service Date</Label>
                      <Input
                        type="date"
                        value={invoiceForm.serviceDate}
                        disabled
                        className="mt-1 bg-gray-50 dark:bg-gray-700"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-900 dark:text-white">Doctor</Label>
                    <Input
                      value={usersData?.find((u: any) => u.id === pendingAppointmentData.providerId)?.firstName + ' ' + usersData?.find((u: any) => u.id === pendingAppointmentData.providerId)?.lastName || 'N/A'}
                      disabled
                      className="mt-1 bg-gray-50 dark:bg-gray-700"
                    />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-900 dark:text-white">Invoice Date</Label>
                      <Input
                        type="date"
                        value={invoiceForm.invoiceDate}
                        disabled
                        className="mt-1 bg-gray-50 dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-900 dark:text-white">Due Date</Label>
                      <Input
                        type="date"
                        value={invoiceForm.dueDate}
                        disabled
                        className="mt-1 bg-gray-50 dark:bg-gray-700"
                      />
                    </div>
                  </div>

                  {/* Services & Procedures */}
                  <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                    <h5 className="font-semibold text-gray-900 dark:text-white mb-3">Services & Procedures</h5>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Code</Label>
                        <Input
                          value={invoiceForm.serviceCode}
                          disabled
                          className="mt-1 bg-gray-50 dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</Label>
                        <Input
                          value={invoiceForm.serviceDescription}
                          disabled
                          className="mt-1 bg-gray-50 dark:bg-gray-700"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Amount</Label>
                        <Input
                          value={invoiceForm.amount}
                          disabled
                          className="mt-1 bg-gray-50 dark:bg-gray-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Insurance Provider */}
                  <div>
                    <Label className="text-sm font-medium text-gray-900 dark:text-white">Insurance Provider</Label>
                    <Input
                      value={invoiceForm.insuranceProvider}
                      disabled
                      className="mt-1 bg-gray-50 dark:bg-gray-700"
                    />
                  </div>

                  {/* Total Amount */}
                  <div>
                    <Label className="text-sm font-medium text-gray-900 dark:text-white">Total Amount</Label>
                    <Input
                      value={invoiceForm.amount}
                      disabled
                      className="mt-1 bg-gray-50 dark:bg-gray-700 font-semibold"
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <Label className="text-sm font-medium text-gray-900 dark:text-white">Notes</Label>
                    <div className="mt-1 w-full min-h-[40px] px-3 py-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-gray-500">
                      {invoiceForm.notes || "No additional notes"}
                    </div>
                  </div>

                  {/* Payment Method - Fixed to Online Payment */}
                  <div>
                    <Label className="text-sm font-medium text-gray-900 dark:text-white">Payment Method</Label>
                    <Input
                      value="Online Payment"
                      disabled
                      className="mt-1 bg-gray-50 dark:bg-gray-700"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowInvoiceModal(false);
                        setPendingAppointmentData(null);
                        setShowNewAppointmentModal(true);
                      }}
                      data-testid="button-cancel-invoice"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        // Show summary view
                        setShowInvoiceSummary(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="button-review-invoice"
                    >
                      Review & Confirm
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Summary Modal */}
        {showInvoiceModal && showInvoiceSummary && pendingAppointmentData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                      Booking Summary
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Review appointment and invoice details before confirming
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowInvoiceSummary(false);
                    }}
                    data-testid="button-back-summary"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Appointment Summary */}
                  <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Appointment Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Patient</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {(() => {
                            const patient = patients.find((p: any) => 
                              p.id === pendingAppointmentData.patientId || 
                              p.id.toString() === pendingAppointmentData.patientId?.toString() ||
                              p.patientId === pendingAppointmentData.patientId
                            );
                            return patient ? `${patient.firstName} ${patient.lastName}` : 'N/A';
                          })()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Doctor</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {usersData?.find((u: any) => u.id === pendingAppointmentData.providerId)?.firstName} {usersData?.find((u: any) => u.id === pendingAppointmentData.providerId)?.lastName}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Date & Time</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {format(new Date(pendingAppointmentData.scheduledAt), 'PPp')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Duration</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {pendingAppointmentData.duration} minutes
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Type</p>
                        <p className="font-medium text-gray-900 dark:text-white capitalize">
                          {pendingAppointmentData.type}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Location</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {pendingAppointmentData.location}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Invoice Summary */}
                  <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Invoice Details
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Service</span>
                        <span className="font-medium text-gray-900 dark:text-white">{invoiceForm.serviceDescription}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Service Code</span>
                        <span className="font-medium text-gray-900 dark:text-white">{invoiceForm.serviceCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Invoice Date</span>
                        <span className="font-medium text-gray-900 dark:text-white">{format(new Date(invoiceForm.invoiceDate), 'PP')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Due Date</span>
                        <span className="font-medium text-gray-900 dark:text-white">{format(new Date(invoiceForm.dueDate), 'PP')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Payment Method</span>
                        <span className="font-medium text-gray-900 dark:text-white capitalize">{invoiceForm.paymentMethod}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Insurance Provider</span>
                        <span className="font-medium text-gray-900 dark:text-white">{invoiceForm.insuranceProvider}</span>
                      </div>
                      {invoiceForm.notes && (
                        <div>
                          <span className="text-gray-600 dark:text-gray-400 block mb-1">Notes</span>
                          <p className="text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-600 p-2 rounded">{invoiceForm.notes}</p>
                        </div>
                      )}
                      <div className="flex justify-between pt-3 border-t border-gray-300 dark:border-gray-600">
                        <span className="text-lg font-bold text-gray-900 dark:text-white">Total Amount</span>
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">£{invoiceForm.amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {invoiceForm.paymentMethod === "cash" ? "Paid" : "Draft"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowInvoiceSummary(false);
                      }}
                      data-testid="button-back-edit"
                    >
                      Back to Edit
                    </Button>
                    <Button
                      onClick={() => {
                        const patient = patients.find((p: any) => 
                          p.id === pendingAppointmentData.patientId || 
                          p.id.toString() === pendingAppointmentData.patientId?.toString() ||
                          p.patientId === pendingAppointmentData.patientId
                        );
                        
                        if (!patient) {
                          toast({
                            title: "Error",
                            description: "Patient information not found",
                            variant: "destructive",
                          });
                          return;
                        }

                        // Create invoice data
                        const amount = parseFloat(invoiceForm.amount);
                        const invoiceData = {
                          patientId: patient.patientId || patient.id.toString(),
                          patientName: `${patient.firstName} ${patient.lastName}`,
                          nhsNumber: patient.nhsNumber || "",
                          dateOfService: invoiceForm.serviceDate,
                          invoiceDate: invoiceForm.invoiceDate,
                          dueDate: invoiceForm.dueDate,
                          status: "sent",
                          invoiceType: "payment",
                          paymentMethod: invoiceForm.paymentMethod,
                          subtotal: invoiceForm.amount,
                          tax: "0",
                          discount: "0",
                          totalAmount: invoiceForm.amount,
                          paidAmount: invoiceForm.paymentMethod === "Cash" ? invoiceForm.amount : "0",
                          items: [{
                            code: invoiceForm.serviceCode,
                            description: invoiceForm.serviceDescription,
                            quantity: 1,
                            unitPrice: amount,
                            total: amount
                          }],
                          insuranceProvider: invoiceForm.insuranceProvider,
                          notes: invoiceForm.notes
                        };

                        // Create both appointment and invoice
                        createAppointmentAndInvoiceMutation.mutate({
                          appointmentData: pendingAppointmentData,
                          invoiceData
                        });
                      }}
                      disabled={createAppointmentAndInvoiceMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-confirm-booking"
                    >
                      {createAppointmentAndInvoiceMutation.isPending ? "Creating..." : "Confirm Booking"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stripe Payment Dialog */}
        <Dialog open={!!stripeClientSecret} onOpenChange={(open) => !open && setStripeClientSecret("")}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Complete Payment
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Please complete your payment to confirm your appointment booking.
              </p>
              {stripeClientSecret && (
                <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
                  <StripePaymentForm
                    onSuccess={async () => {
                      // Update invoice status to paid
                      if (createdInvoiceId) {
                        try {
                          await apiRequest('PATCH', `/api/billing/invoices/${createdInvoiceId}`, {
                            status: 'paid'
                          });
                          console.log("Invoice status updated to paid");
                        } catch (error) {
                          console.error("Failed to update invoice status:", error);
                        }
                      }
                      setStripeClientSecret("");
                      setCreatedInvoiceId(null);
                      setShowSuccessModal(true);
                    }}
                    onCancel={() => {
                      setStripeClientSecret("");
                      setCreatedInvoiceId(null);
                      toast({
                        title: "Payment Cancelled",
                        description: "Your appointment has been created. You can complete payment later from the billing section.",
                      });
                    }}
                  />
                </Elements>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}