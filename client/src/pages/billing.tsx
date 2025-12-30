import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import { isDoctorLike } from "@/lib/role-utils";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import jsPDF from "jspdf";
import autoTable from 'jspdf-autotable';
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { 
  Receipt, 
  Plus, 
  Search, 
  DollarSign,
  PoundSterling, 
  CreditCard, 
  FileText, 
  Calendar,
  CalendarDays,
  User,
  Download,
  Eye,
  Send,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  BarChart3,
  TrendingUp,
  Filter,
  PieChart,
  FileBarChart,
  Target,
  Edit,
  LayoutGrid,
  List
} from "lucide-react";
import { SearchComboBox } from "@/components/SearchComboBox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";

interface Invoice {
  id: number;
  organizationId: number;
  invoiceNumber?: string;
  patientId: string;
  patientName: string;
  dateOfService: string;
  invoiceDate: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  totalAmount: number;
  paidAmount: number;
  items: Array<{
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  insurance?: {
    provider: string;
    claimNumber: string;
    status: 'pending' | 'approved' | 'denied' | 'partially_paid';
    paidAmount: number;
  };
  payments: Array<{
    id: string;
    amount: number;
    method: 'cash' | 'card' | 'bank_transfer' | 'insurance';
    date: string;
    reference?: string;
  }>;
}

const DOCTOR_SERVICE_OPTIONS = [
  { value: "General Consultation", description: "Standard visit for diagnosis or follow-up" },
  { value: "Specialist Consultation", description: "Visit with a specialist doctor (e.g., Cardiologist)" },
  { value: "Follow-up Visit", description: "Follow-up within a certain time period" },
  { value: "Teleconsultation", description: "Online or phone consultation" },
  { value: "Emergency Visit", description: "Immediate or off-hours consultation" },
  { value: "Home Visit", description: "Doctor visits patient's home" },
  { value: "Procedure Consultation", description: "Pre- or post-surgery consultation" }
];

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrator" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "receptionist", label: "Receptionist" }
];

const LAB_TEST_OPTIONS = [
  "Complete Blood Count (CBC)",
  "Basic Metabolic Panel (BMP) / Chem-7",
  "Comprehensive Metabolic Panel (CMP)",
  "Lipid Profile (Cholesterol, LDL, HDL, Triglycerides)",
  "Thyroid Function Tests (TSH, Free T4, Free T3)",
  "Liver Function Tests (AST, ALT, ALP, Bilirubin)",
  "Kidney Function Tests (Creatinine, BUN, eGFR)",
  "Electrolytes (Sodium, Potassium, Chloride, Bicarbonate)",
  "Blood Glucose (Fasting / Random / Postprandial)",
  "Hemoglobin A1C (HbA1c)",
  "C-Reactive Protein (CRP)",
  "Erythrocyte Sedimentation Rate (ESR)",
  "Coagulation Tests (PT, PTT, INR)",
  "Urinalysis (UA)",
  "Albumin / Total Protein",
  "Iron Studies (Serum Iron, TIBC, Ferritin)",
  "Vitamin D",
  "Vitamin B12 / Folate",
  "Hormone Panels (e.g., LH, FSH, Testosterone, Estrogen)",
  "Prostate-Specific Antigen (PSA)",
  "Thyroid Antibodies (e.g. Anti-TPO, Anti-TG)",
  "Creatine Kinase (CK)",
  "Cardiac Biomarkers (Troponin, CK-MB, BNP)",
  "Electrolyte Panel",
  "Uric Acid",
  "Lipase / Amylase (Pancreatic enzymes)",
  "Hepatitis B / C Serologies",
  "HIV Antibody / Viral Load",
  "HCG (Pregnancy / Quantitative)",
  "Autoimmune Panels (ANA, ENA, Rheumatoid Factor)",
  "Tumor Markers (e.g. CA-125, CEA, AFP)",
  "Blood Culture & Sensitivity",
  "Stool Culture / Ova & Parasites",
  "Sputum Culture",
  "Viral Panels / PCR Tests (e.g. COVID-19, Influenza)",
  "Hormonal tests (Cortisol, ACTH)"
];

const IMAGING_TYPE_OPTIONS = [
  "X-ray (Radiography)",
  "CT (Computed Tomography)",
  "MRI (Magnetic Resonance Imaging)",
  "Ultrasound (Sonography)",
  "Mammography",
  "Fluoroscopy",
  "PET (Positron Emission Tomography)",
  "SPECT (Single Photon Emission CT)",
  "Nuclear Medicine Scans",
  "DEXA (Bone Densitometry)",
  "Angiography",
  "Interventional Radiology (IR)"
];

function PricingManagementDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = useRolePermissions();
  const [pricingTab, setPricingTab] = useState("doctors");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [multipleServices, setMultipleServices] = useState<any[]>([
    { serviceName: "", serviceCode: "", category: "", basePrice: "" }
  ]);
  const [showServiceSuggestions, setShowServiceSuggestions] = useState(false);
  const [showRoleSuggestions, setShowRoleSuggestions] = useState(false);
  const [showDoctorSuggestions, setShowDoctorSuggestions] = useState(false);
  const [showLabTestSuggestions, setShowLabTestSuggestions] = useState(false);
  const [showLabRoleSuggestions, setShowLabRoleSuggestions] = useState(false);
  const [showLabDoctorSuggestions, setShowLabDoctorSuggestions] = useState(false);
  const [showImagingTypeSuggestions, setShowImagingTypeSuggestions] = useState(false);
  const [labTestFilter, setLabTestFilter] = useState("");
  const [labDoctorFilter, setLabDoctorFilter] = useState("");
  const [doctorFeeServiceFilter, setDoctorFeeServiceFilter] = useState("");
  const [doctorFeeDoctorFilter, setDoctorFeeDoctorFilter] = useState("");
  const [defaultTestsAdded, setDefaultTestsAdded] = useState(false);
  const [isAddingDefaultTests, setIsAddingDefaultTests] = useState(false);
  const [isAddingDefaultImaging, setIsAddingDefaultImaging] = useState(false);
  const [showImagingExistsModal, setShowImagingExistsModal] = useState(false);
  const [showTestsExistsModal, setShowTestsExistsModal] = useState(false);
  
  // Validation error states
  const [doctorRoleError, setDoctorRoleError] = useState("");
  const [doctorNameError, setDoctorNameError] = useState("");
  const [labTestError, setLabTestError] = useState("");
  const [imagingError, setImagingError] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    select: (data: any) => data || []
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["/api/roles"],
    select: (data: any) => data || []
  });

  const filteredUsers = users.filter((user: any) => {
    if (!formData.doctorRole) return true;
    return user.role === formData.doctorRole;
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('#serviceName') && !target.closest('.service-suggestions')) {
        setShowServiceSuggestions(false);
      }
      if (!target.closest('#doctorRole') && !target.closest('.role-suggestions')) {
        setShowRoleSuggestions(false);
      }
      if (!target.closest('#doctorName') && !target.closest('.doctor-suggestions')) {
        setShowDoctorSuggestions(false);
      }
      if (!target.closest('#testName') && !target.closest('.lab-test-suggestions')) {
        setShowLabTestSuggestions(false);
      }
      if (!target.closest('#labDoctorRole') && !target.closest('.lab-role-suggestions')) {
        setShowLabRoleSuggestions(false);
      }
      if (!target.closest('#labDoctorName') && !target.closest('.lab-doctor-suggestions')) {
        setShowLabDoctorSuggestions(false);
      }
      if (!target.closest('#imagingType') && !target.closest('.imaging-type-suggestions')) {
        setShowImagingTypeSuggestions(false);
      }
    };
    
    if (showServiceSuggestions || showRoleSuggestions || showDoctorSuggestions || 
        showLabTestSuggestions || showLabRoleSuggestions || showLabDoctorSuggestions || showImagingTypeSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showServiceSuggestions, showRoleSuggestions, showDoctorSuggestions, showLabTestSuggestions, showLabRoleSuggestions, showLabDoctorSuggestions, showImagingTypeSuggestions]);

  const getApiPath = (tab: string) => {
    const pathMap: Record<string, string> = {
      "doctors": "doctors-fees",
      "lab-tests": "lab-tests",
      "imaging": "imaging"
    };
    return pathMap[tab] || tab;
  };

  const { data: doctorsFees = [], isLoading: loadingDoctors } = useQuery({
    queryKey: ["/api/pricing/doctors-fees"],
    enabled: pricingTab === "doctors"
  });

  const { data: labTests = [], isLoading: loadingLabs } = useQuery({
    queryKey: ["/api/pricing/lab-tests"],
    enabled: pricingTab === "lab-tests"
  });

  const { data: imaging = [], isLoading: loadingImaging } = useQuery({
    queryKey: ["/api/pricing/imaging"],
    enabled: pricingTab === "imaging"
  });

  const generateImagingCode = (imagingType: string) => {
    const codeMap: Record<string, string> = {
      "X-ray (Radiography)": "XRAY",
      "CT (Computed Tomography)": "CT",
      "MRI (Magnetic Resonance Imaging)": "MRI",
      "Ultrasound (Sonography)": "US",
      "Mammography": "MAMMO",
      "Fluoroscopy": "FLUORO",
      "PET (Positron Emission Tomography)": "PET",
      "SPECT (Single Photon Emission CT)": "SPECT",
      "Nuclear Medicine Scans": "NM",
      "DEXA (Bone Densitometry)": "DEXA",
      "Angiography": "ANGIO",
      "Interventional Radiology (IR)": "IR"
    };
    
    const prefix = codeMap[imagingType] || "IMG";
    const timestamp = Date.now().toString().slice(-4);
    return `${prefix}${timestamp}`;
  };

  const handleDelete = async (type: string, id: number) => {
    try {
      const apiPath = getApiPath(type);
      await apiRequest('DELETE', `/api/pricing/${apiPath}/${id}`, {});
      queryClient.invalidateQueries({ queryKey: [`/api/pricing/${apiPath}`] });
      toast({ title: "Success", description: "Pricing entry deleted successfully" });
    } catch (error: any) {
      let errorMessage = "Failed to delete pricing entry";
      
      if (error.message && typeof error.message === 'string') {
        if (error.message.includes("not found")) {
          errorMessage = "Pricing entry not found";
        } else if (error.message.includes("404")) {
          errorMessage = "Pricing entry not found in the database";
        } else if (!error.message.includes("{") && !error.message.includes(":")) {
          errorMessage = error.message;
        }
      }
      
      toast({ 
        title: "Delete Failed", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  };

  const addDefaultLabTests = async () => {
    setIsAddingDefaultTests(true);
    try {
      const defaultTests = [
        { testName: "Complete Blood Count (CBC)", code: "CBC001", category: "Hematology", basePrice: 55.00 },
        { testName: "Basic Metabolic Panel (BMP) / Chem-7", code: "BMP001", category: "Chemistry", basePrice: 5.00 },
        { testName: "Comprehensive Metabolic Panel (CMP)", code: "CMP001", category: "Chemistry", basePrice: 5.00 },
        { testName: "Lipid Profile (Cholesterol, LDL, HDL, Triglycerides)", code: "LP001", category: "Chemistry", basePrice: 5.00 },
        { testName: "Thyroid Function Tests (TSH, Free T4, Free T3)", code: "TFT001", category: "Endocrinology", basePrice: 5.00 },
        { testName: "Liver Function Tests (AST, ALT, ALP, Bilirubin)", code: "LFT001", category: "Chemistry", basePrice: 5.00 },
        { testName: "Kidney Function Tests (Creatinine, BUN, eGFR)", code: "KFT001", category: "Chemistry", basePrice: 342.00 },
        { testName: "Electrolytes (Sodium, Potassium, Chloride, Bicarbonate)", code: "E001", category: "Chemistry", basePrice: 223.00 },
        { testName: "Blood Glucose (Fasting / Random / Postprandial)", code: "BG001", category: "Chemistry", basePrice: 23234.00 },
        { testName: "Hemoglobin A1C (HbA1c)", code: "HA001", category: "Chemistry", basePrice: 44223.00 },
        { testName: "C-Reactive Protein (CRP)", code: "CRP001", category: "Immunology", basePrice: 4234.00 },
        { testName: "Erythrocyte Sedimentation Rate (ESR)", code: "ESR001", category: "Hematology", basePrice: 234.00 },
        { testName: "Coagulation Tests (PT, PTT, INR)", code: "CT001", category: "Hematology", basePrice: 44.00 },
        { testName: "Urinalysis (UA)", code: "UA001", category: "Urinalysis", basePrice: 3.00 },
        { testName: "Albumin / Total Protein", code: "ATP001", category: "Chemistry", basePrice: 4.00 },
        { testName: "Iron Studies (Serum Iron, TIBC, Ferritin)", code: "IS001", category: "Hematology", basePrice: 32.03 },
        { testName: "Vitamin D", code: "VD001", category: "Chemistry", basePrice: 3.00 },
        { testName: "Vitamin B12 / Folate", code: "VBF001", category: "Chemistry", basePrice: 3.00 },
        { testName: "Hormone Panels (e.g., LH, FSH, Testosterone, Estrogen)", code: "HP001", category: "Endocrinology", basePrice: 4.00 },
        { testName: "Prostate-Specific Antigen (PSA)", code: "PSA001", category: "Oncology", basePrice: 4.00 },
        { testName: "Thyroid Antibodies (e.g. Anti-TPO, Anti-TG)", code: "TA001", category: "Immunology", basePrice: 55.00 },
        { testName: "Creatine Kinase (CK)", code: "CK001", category: "Chemistry", basePrice: 155.00 },
        { testName: "Cardiac Biomarkers (Troponin, CK-MB, BNP)", code: "CB001", category: "Cardiology", basePrice: 1.00 },
        { testName: "Electrolyte Panel", code: "EP001", category: "Chemistry", basePrice: 55.00 },
        { testName: "Uric Acid", code: "UA002", category: "Chemistry", basePrice: 55.00 },
        { testName: "Lipase / Amylase (Pancreatic enzymes)", code: "LA001", category: "Chemistry", basePrice: 66.00 },
        { testName: "Hepatitis B / C Serologies", code: "HBC001", category: "Serology", basePrice: 77.00 },
        { testName: "HIV Antibody / Viral Load", code: "HIV001", category: "Serology", basePrice: 88.00 },
        { testName: "HCG (Pregnancy / Quantitative)", code: "HCG001", category: "Endocrinology", basePrice: 99.00 },
        { testName: "Autoimmune Panels (ANA, ENA, Rheumatoid Factor)", code: "AP001", category: "Immunology", basePrice: 54.50 },
        { testName: "Tumor Markers (e.g. CA-125, CEA, AFP)", code: "TM001", category: "Oncology", basePrice: 24.95 },
        { testName: "Blood Culture & Sensitivity", code: "BCS001", category: "Microbiology", basePrice: 2.00 },
        { testName: "Stool Culture / Ova & Parasites", code: "SCOP001", category: "Microbiology", basePrice: 2.00 },
        { testName: "Sputum Culture", code: "SC001", category: "Microbiology", basePrice: 2.00 },
        { testName: "Viral Panels / PCR Tests (e.g. COVID-19, Influenza)", code: "VP001", category: "Microbiology", basePrice: 2.00 },
        { testName: "Hormonal tests (Cortisol, ACTH)", code: "HT001", category: "Endocrinology", basePrice: 20.00 }
      ];

      // Fetch existing lab tests to check for duplicates
      const response = await fetch('/api/pricing/lab-tests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo'
        }
      });
      const existingTests = await response.json();

      let successCount = 0;
      let alreadyExistsCount = 0;

      for (const test of defaultTests) {
        // Check if test with same code already exists
        const exists = existingTests.some((existing: any) => existing.testCode === test.code);
        
        if (exists) {
          alreadyExistsCount++;
          continue;
        }

        try {
          await apiRequest('POST', '/api/pricing/lab-tests', {
            testName: test.testName,
            testCode: test.code,
            category: test.category,
            basePrice: test.basePrice,
            isActive: true,
            version: 1
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to add test ${test.testName}:`, error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/pricing/lab-tests'] });

      if (alreadyExistsCount > 0 && successCount === 0) {
        setShowTestsExistsModal(true);
      } else if (successCount > 0) {
        toast({ 
          title: "Success", 
          description: `Added ${successCount} default lab tests${alreadyExistsCount > 0 ? ` (${alreadyExistsCount} already existed)` : ''}` 
        });
      }
    } catch (error: any) {
      let errorMessage = "Failed to add default tests";
      
      if (error.message && typeof error.message === 'string') {
        if (error.message.includes("not found")) {
          errorMessage = "Lab tests pricing configuration not found";
        } else if (error.message.includes("404")) {
          errorMessage = "Unable to connect to the pricing service";
        } else if (error.message.includes("duplicate") || error.message.includes("already exists")) {
          errorMessage = "Some tests already exist in the database";
        } else if (!error.message.includes("{") && !error.message.includes(":")) {
          errorMessage = error.message;
        }
      }
      
      toast({ 
        title: "Failed to Add Tests", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsAddingDefaultTests(false);
    }
  };

  const addDefaultImaging = async () => {
    setIsAddingDefaultImaging(true);
    try {
      const defaultImaging = [
        { imagingType: "X-ray (Radiography)", code: "XRAY7672", basePrice: 50.00 },
        { imagingType: "CT (Computed Tomography)", code: "CT7672", basePrice: 54.00 },
        { imagingType: "MRI (Magnetic Resonance Imaging)", code: "MRI7672", basePrice: 43.00 },
        { imagingType: "Ultrasound (Sonography)", code: "US7672", basePrice: 39.00 },
        { imagingType: "Mammography", code: "MAMMO7672", basePrice: 34.00 },
        { imagingType: "Fluoroscopy", code: "FLUORO7672", basePrice: 23.00 },
        { imagingType: "PET (Positron Emission Tomography)", code: "PET0792", basePrice: 1.00 },
        { imagingType: "SPECT (Single Photon Emission CT)", code: "SPECT0792", basePrice: 1.00 },
        { imagingType: "Nuclear Medicine Scans", code: "NM0792", basePrice: 1.00 },
        { imagingType: "DEXA (Bone Densitometry)", code: "DEXA0792", basePrice: 11.00 },
        { imagingType: "Angiography", code: "ANGIO0792", basePrice: 1.00 },
        { imagingType: "Interventional Radiology (IR)", code: "IR0792", basePrice: 1.00 },
        { imagingType: "Fluoroscopy", code: "FLUORO0792", basePrice: 1.00 },
        { imagingType: "Mammography", code: "MAMMO0792", basePrice: 1.00 },
        { imagingType: "Ultrasound (Sonography)", code: "US0792", basePrice: 1.00 },
        { imagingType: "MRI (Magnetic Resonance Imaging)", code: "MRI0792", basePrice: 1.00 },
        { imagingType: "CT (Computed Tomography)", code: "CT0792", basePrice: 1.00 },
        { imagingType: "X-ray (Radiography)", code: "XRAY0792", basePrice: 1.00 }
      ];

      // Fetch existing imaging to check for duplicates
      const response = await fetch('/api/pricing/imaging', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'demo'
        }
      });
      const existingImaging = await response.json();

      let successCount = 0;
      let alreadyExistsCount = 0;

      for (const img of defaultImaging) {
        // Check if imaging with same code already exists
        const exists = existingImaging.some((existing: any) => existing.imagingCode === img.code);
        
        if (exists) {
          alreadyExistsCount++;
          continue;
        }

        try {
          await apiRequest('POST', '/api/pricing/imaging', {
            imagingType: img.imagingType,
            imagingCode: img.code,
            modality: '',
            bodyPart: '',
            basePrice: img.basePrice,
            isActive: true,
            version: 1
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to add imaging ${img.imagingType}:`, error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/pricing/imaging'] });

      if (alreadyExistsCount > 0 && successCount === 0) {
        setShowImagingExistsModal(true);
      } else if (successCount > 0) {
        toast({ 
          title: "Success", 
          description: `Added ${successCount} default imaging services${alreadyExistsCount > 0 ? ` (${alreadyExistsCount} already existed)` : ''}` 
        });
      }
    } catch (error: any) {
      let errorMessage = "Failed to add default imaging services";
      
      if (error.message && typeof error.message === 'string') {
        if (error.message.includes("not found")) {
          errorMessage = "Imaging pricing configuration not found";
        } else if (error.message.includes("404")) {
          errorMessage = "Unable to connect to the imaging pricing service";
        } else if (error.message.includes("duplicate") || error.message.includes("already exists")) {
          errorMessage = "Some imaging services already exist in the database";
        } else if (!error.message.includes("{") && !error.message.includes(":")) {
          errorMessage = error.message;
        }
      }
      
      toast({ 
        title: "Failed to Add Imaging", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsAddingDefaultImaging(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const apiPath = getApiPath(pricingTab);
      
      // Handle multiple services for doctors fees, lab tests, and imaging when not editing
      if ((pricingTab === "doctors" || pricingTab === "lab-tests" || pricingTab === "imaging") && !editingItem) {
        // Validation for doctors fees
        if (pricingTab === "doctors") {
          // Reset errors first
          setDoctorRoleError("");
          setDoctorNameError("");
          
          let hasError = false;
          
          if (!formData.doctorRole) {
            setDoctorRoleError("Please select a role");
            hasError = true;
          }
          
          if (!formData.doctorName) {
            setDoctorNameError("Please select a name");
            hasError = true;
          }
          
          if (hasError) {
            setIsSaving(false);
            return;
          }
          
          // Check for duplicate (doctorRole + doctorId combination)
          if (formData.doctorId) {
            try {
              const checkResponse = await apiRequest('GET', `/api/pricing/doctors-fees/check-duplicate?doctorRole=${encodeURIComponent(formData.doctorRole)}&doctorId=${formData.doctorId}`, undefined);
              const checkData = await checkResponse.json();
              
              if (checkData.exists) {
                toast({
                  title: "Duplicate Entry",
                  description: "Price already exists in the database",
                  variant: "destructive"
                });
                setIsSaving(false);
                return;
              }
            } catch (error: any) {
              console.error("Error checking for duplicate:", error);
            }
          }
        }
        
        const validServices = multipleServices.filter(
          service => service.serviceName && service.basePrice
        );
        
        if (validServices.length === 0) {
          if (pricingTab === "lab-tests") {
            setLabTestError("Please add at least one test with name and price");
          } else if (pricingTab === "imaging") {
            setImagingError("Please add at least one imaging service with name and price");
          } else if (pricingTab === "doctors") {
            // For doctors, still use toast as it doesn't have dedicated error state
            toast({
              title: "Error",
              description: "Please add at least one service with name and price",
              variant: "destructive"
            });
          }
          setIsSaving(false);
          return;
        }
        
        // Clear validation errors if validation passes
        if (pricingTab === "lab-tests") {
          setLabTestError("");
        } else if (pricingTab === "imaging") {
          setImagingError("");
        }
        
        // Create all services/tests/imaging
        for (const service of validServices) {
          let payload: any = {};
          
          if (pricingTab === "doctors") {
            payload = {
              serviceName: service.serviceName,
              serviceCode: service.serviceCode,
              category: service.category,
              doctorId: formData.doctorId,
              doctorName: formData.doctorName,
              doctorRole: formData.doctorRole,
              basePrice: parseFloat(service.basePrice) || 0,
              isActive: true,
              currency: "GBP",
              version: 1
            };
          } else if (pricingTab === "lab-tests") {
            payload = {
              testName: service.serviceName,
              testCode: service.serviceCode,
              category: service.category,
              basePrice: parseFloat(service.basePrice) || 0,
              isActive: true,
              currency: "GBP",
              version: 1
            };
          } else if (pricingTab === "imaging") {
            payload = {
              imagingType: service.serviceName,
              imagingCode: service.serviceCode,
              modality: service.category,
              basePrice: parseFloat(service.basePrice) || 0,
              isActive: true,
              currency: "GBP",
              version: 1
            };
          }
          
          await apiRequest('POST', `/api/pricing/${apiPath}`, payload);
        }
        
        queryClient.invalidateQueries({ queryKey: [`/api/pricing/${apiPath}`] });
        toast({
          title: pricingTab === "doctors" 
            ? "Doctor Fee Added"
            : pricingTab === "lab-tests"
            ? "Lab Test Added"
            : "Imaging Service Added",
          description: pricingTab === "doctors" 
            ? `${validServices.length} service(s) created successfully`
            : pricingTab === "lab-tests"
            ? `${validServices.length} test(s) created successfully`
            : `${validServices.length} imaging service(s) created successfully`
        });
        setShowAddDialog(false);
        setMultipleServices([{ serviceName: "", serviceCode: "", category: "", basePrice: "" }]);
        setFormData({});
      } else {
        // Original single save logic for editing or other tabs
        const endpoint = editingItem 
          ? `/api/pricing/${apiPath}/${editingItem.id}`
          : `/api/pricing/${apiPath}`;
        const method = editingItem ? 'PATCH' : 'POST';
        
        // Build payload based on pricing tab
        let payload: any = {};
        
        if (pricingTab === "doctors") {
          payload = {
            serviceName: formData.serviceName,
            serviceCode: formData.serviceCode,
            category: formData.category,
            doctorId: formData.doctorId,
            doctorName: formData.doctorName,
            doctorRole: formData.doctorRole,
            basePrice: parseFloat(formData.basePrice) || 0,
            currency: formData.currency || "GBP",
            isActive: formData.isActive !== undefined ? formData.isActive : true
          };
        } else if (pricingTab === "lab-tests") {
          payload = {
            testName: formData.testName,
            testCode: formData.testCode,
            category: formData.category,
            basePrice: parseFloat(formData.basePrice) || 0,
            currency: formData.currency || "USD",
            isActive: formData.isActive !== undefined ? formData.isActive : true
          };
        } else if (pricingTab === "imaging") {
          payload = {
            imagingType: formData.imagingType,
            imagingCode: formData.imagingCode,
            modality: formData.modality,
            bodyPart: formData.bodyPart,
            basePrice: parseFloat(formData.basePrice) || 0,
            currency: formData.currency || "USD",
            isActive: formData.isActive !== undefined ? formData.isActive : true
          };
        } else {
          payload = {
            ...formData,
            basePrice: parseFloat(formData.basePrice) || 0
          };
        }
        
        await apiRequest(method, endpoint, payload);

        queryClient.invalidateQueries({ queryKey: [`/api/pricing/${apiPath}`] });
        toast({ 
          title: "Success", 
          description: editingItem ? "Pricing updated successfully" : "Pricing created successfully" 
        });
        setShowAddDialog(false);
        setEditingItem(null);
        setFormData({});
      }
    } catch (error: any) {
      let errorMessage = "Failed to save pricing";
      
      if (error.message && typeof error.message === 'string') {
        if (error.message.includes("not found")) {
          errorMessage = "Pricing configuration not found";
        } else if (error.message.includes("404")) {
          errorMessage = "Unable to connect to the pricing service";
        } else if (error.message.includes("duplicate") || error.message.includes("already exists")) {
          errorMessage = "This pricing entry already exists";
        } else if (error.message.includes("validation")) {
          errorMessage = "Please check your input and try again";
        } else if (!error.message.includes("{") && !error.message.includes(":")) {
          errorMessage = error.message;
        }
      }
      
      toast({ 
        title: "Failed to Save", 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openAddDialog = () => {
    setFormData({
      isActive: true,
      currency: "GBP",
      version: 1
    });
    
    // Close all dropdowns
    setShowRoleSuggestions(false);
    setShowDoctorSuggestions(false);
    setShowServiceSuggestions(false);
    setShowLabTestSuggestions(false);
    setShowLabRoleSuggestions(false);
    setShowLabDoctorSuggestions(false);
    setShowImagingTypeSuggestions(false);
    
    // Reset validation errors
    setDoctorRoleError("");
    setDoctorNameError("");
    setLabTestError("");
    setImagingError("");
    
    // Pre-populate with predefined services for doctors fees
    if (pricingTab === "doctors") {
      const predefinedServices = [
        { serviceName: "General Consultation", serviceCode: "GC001", category: "Standard visit for diagnosis or follow-up", basePrice: "50" },
        { serviceName: "Specialist Consultation", serviceCode: "SC001", category: "Visit with a specialist doctor (e.g., Cardiologist)", basePrice: "120" },
        { serviceName: "Follow-up Visit", serviceCode: "FV001", category: "Follow-up within a certain time period", basePrice: "30" },
        { serviceName: "Teleconsultation", serviceCode: "TC001", category: "Online or phone consultation", basePrice: "40" },
        { serviceName: "Emergency Visit", serviceCode: "EV001", category: "Immediate or off-hours consultation", basePrice: "150" },
        { serviceName: "Home Visit", serviceCode: "HV001", category: "Doctor visits patient's home", basePrice: "100" },
        { serviceName: "Procedure Consultation", serviceCode: "PC001", category: "Pre- or post-surgery consultation", basePrice: "" }
      ];
      setMultipleServices(predefinedServices);
    } else if (pricingTab === "imaging") {
      // Start with one blank row for custom imaging
      setMultipleServices([{ serviceName: "", serviceCode: "", category: "", basePrice: "" }]);
    } else if (pricingTab === "lab-tests") {
      // Start with one blank row for custom tests
      setMultipleServices([{ serviceName: "", serviceCode: "", category: "", basePrice: "" }]);
    } else {
      setMultipleServices([{ serviceName: "", serviceCode: "", category: "", basePrice: "" }]);
    }
    
    setEditingItem(null);
    setShowAddDialog(true);
  };

  const openEditDialog = (item: any) => {
    setFormData(item);
    setEditingItem(item);
    setShowAddDialog(true);
  };

  return (
    <Tabs value={pricingTab} onValueChange={setPricingTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="doctors" data-testid="tab-doctors-pricing">Doctors Fees</TabsTrigger>
        <TabsTrigger value="lab-tests" data-testid="tab-lab-tests-pricing">Lab Tests</TabsTrigger>
        <TabsTrigger value="imaging" data-testid="tab-imaging-pricing">Imaging</TabsTrigger>
      </TabsList>

      <TabsContent value="doctors" className="space-y-4 mt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Doctors Fee Pricing</h3>
          <Button size="sm" onClick={openAddDialog} data-testid="button-add-doctor-fee">
            <Plus className="h-4 w-4 mr-2" />
            Add Doctor Fee
          </Button>
        </div>
        
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Label htmlFor="filter-service-name">Filter by Service Name</Label>
            <Input
              id="filter-service-name"
              placeholder="Search service name..."
              value={doctorFeeServiceFilter}
              onChange={(e) => setDoctorFeeServiceFilter(e.target.value)}
              data-testid="input-filter-service-name"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="filter-fee-doctor-name">Filter by Doctor Name</Label>
            <Input
              id="filter-fee-doctor-name"
              placeholder="Search doctor name..."
              value={doctorFeeDoctorFilter}
              onChange={(e) => setDoctorFeeDoctorFilter(e.target.value)}
              data-testid="input-filter-fee-doctor-name"
            />
          </div>
          {(doctorFeeServiceFilter || doctorFeeDoctorFilter) && (
            <div className="flex items-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setDoctorFeeServiceFilter("");
                  setDoctorFeeDoctorFilter("");
                }}
                data-testid="button-clear-fee-filters"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
        
        {loadingDoctors ? (
          <div className="text-center py-8">Loading...</div>
        ) : doctorsFees.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No doctor fees configured yet. Click "Add Doctor Fee" to get started.</p>
          </div>
        ) : (() => {
          const filteredFees = doctorsFees.filter((fee: any) => {
            const matchServiceName = !doctorFeeServiceFilter || 
              fee.serviceName?.toLowerCase().includes(doctorFeeServiceFilter.toLowerCase());
            const matchDoctorName = !doctorFeeDoctorFilter || 
              fee.doctorName?.toLowerCase().includes(doctorFeeDoctorFilter.toLowerCase());
            return matchServiceName && matchDoctorName;
          });

          return filteredFees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No doctor fees match your filters. Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-800">
                    <th className="text-left p-3">Service Name</th>
                    <th className="text-left p-3">Doctor Name</th>
                    <th className="text-left p-3">Code</th>
                    <th className="text-left p-3">Category</th>
                    <th className="text-left p-3">Price</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Version</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFees.map((fee: any) => (
                    <tr key={fee.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800" data-testid={`row-doctor-fee-${fee.id}`}>
                      <td className="p-3 font-medium">{fee.serviceName}</td>
                      <td className="p-3">{fee.doctorName || '-'}</td>
                      <td className="p-3">{fee.serviceCode || '-'}</td>
                      <td className="p-3">{fee.category || '-'}</td>
                      <td className="p-3 font-semibold">{fee.currency} {fee.basePrice}</td>
                      <td className="p-3">
                        <Badge variant={fee.isActive ? "default" : "secondary"}>
                          {fee.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-3">v{fee.version}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {canEdit('billing') && (
                            <Button size="sm" variant="outline" onClick={() => openEditDialog(fee)} data-testid={`button-edit-${fee.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete('billing') && (
                            <Button size="sm" variant="outline" onClick={() => handleDelete("doctors-fees", fee.id)} data-testid={`button-delete-${fee.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </TabsContent>

      <TabsContent value="lab-tests" className="space-y-4 mt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Lab Test Pricing</h3>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={addDefaultLabTests} 
              disabled={defaultTestsAdded || isAddingDefaultTests}
              data-testid="button-default-tests"
            >
              {isAddingDefaultTests ? "Adding..." : "Default Tests"}
            </Button>
            {canCreate('billing') && (
              <Button size="sm" onClick={openAddDialog} data-testid="button-add-lab-test">
                <Plus className="h-4 w-4 mr-2" />
                Add Lab Test
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Label htmlFor="filter-test-name">Filter by Test Name</Label>
            <Input
              id="filter-test-name"
              placeholder="Search test name..."
              value={labTestFilter}
              onChange={(e) => setLabTestFilter(e.target.value)}
              data-testid="input-filter-test-name"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="filter-doctor-name">Filter by Doctor Name</Label>
            <Input
              id="filter-doctor-name"
              placeholder="Search doctor name..."
              value={labDoctorFilter}
              onChange={(e) => setLabDoctorFilter(e.target.value)}
              data-testid="input-filter-doctor-name"
            />
          </div>
          {(labTestFilter || labDoctorFilter) && (
            <div className="flex items-end">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setLabTestFilter("");
                  setLabDoctorFilter("");
                }}
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
        
        {loadingLabs ? (
          <div className="text-center py-8">Loading...</div>
        ) : labTests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No lab test pricing configured yet. Click "Add Lab Test" to get started.</p>
          </div>
        ) : (() => {
          const filteredTests = labTests.filter((test: any) => {
            const matchTestName = !labTestFilter || 
              test.testName?.toLowerCase().includes(labTestFilter.toLowerCase());
            const matchDoctorName = !labDoctorFilter || 
              test.doctorName?.toLowerCase().includes(labDoctorFilter.toLowerCase());
            return matchTestName && matchDoctorName;
          });

          return filteredTests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No lab tests match your filters. Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-800">
                    <th className="text-left p-3">Test Name</th>
                    <th className="text-left p-3">Code</th>
                    <th className="text-left p-3">Category</th>
                    <th className="text-left p-3">Price</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Version</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTests.map((test: any) => (
                    <tr key={test.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800" data-testid={`row-lab-test-${test.id}`}>
                      <td className="p-3 font-medium">{test.testName}</td>
                      <td className="p-3">{test.testCode || '-'}</td>
                      <td className="p-3">{test.category || '-'}</td>
                      <td className="p-3 font-semibold">{test.currency} {test.basePrice}</td>
                      <td className="p-3">
                        <Badge variant={test.isActive ? "default" : "secondary"}>
                          {test.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-3">v{test.version}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {canEdit('billing') && (
                            <Button size="sm" variant="outline" onClick={() => openEditDialog(test)} data-testid={`button-edit-${test.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete('billing') && (
                            <Button size="sm" variant="outline" onClick={() => handleDelete("lab-tests", test.id)} data-testid={`button-delete-${test.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </TabsContent>

      <TabsContent value="imaging" className="space-y-4 mt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Imaging Pricing</h3>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={addDefaultImaging} 
              disabled={isAddingDefaultImaging}
              data-testid="button-default-imaging"
            >
              {isAddingDefaultImaging ? "Adding..." : "Default Imaging"}
            </Button>
            {canCreate('billing') && (
              <Button size="sm" onClick={openAddDialog} data-testid="button-add-imaging">
                <Plus className="h-4 w-4 mr-2" />
                Add Imaging Service
              </Button>
            )}
          </div>
        </div>
        
        {loadingImaging ? (
          <div className="text-center py-8">Loading...</div>
        ) : imaging.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No imaging pricing configured yet. Click "Add Imaging Service" to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 dark:bg-gray-800">
                  <th className="text-left p-3">Imaging Type</th>
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Modality</th>
                  <th className="text-left p-3">Body Part</th>
                  <th className="text-left p-3">Price</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Version</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {imaging.map((img: any) => (
                  <tr key={img.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800" data-testid={`row-imaging-${img.id}`}>
                    <td className="p-3 font-medium">{img.imagingType}</td>
                    <td className="p-3">{img.imagingCode || '-'}</td>
                    <td className="p-3">{img.modality || '-'}</td>
                    <td className="p-3">{img.bodyPart || '-'}</td>
                    <td className="p-3 font-semibold">{img.currency} {img.basePrice}</td>
                    <td className="p-3">
                      <Badge variant={img.isActive ? "default" : "secondary"}>
                        {img.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="p-3">v{img.version}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        {canEdit('billing') && (
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(img)} data-testid={`button-edit-${img.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete('billing') && (
                          <Button size="sm" variant="outline" onClick={() => handleDelete("imaging", img.id)} data-testid={`button-delete-${img.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit" : "Add"} {pricingTab === "doctors" ? "Doctor Fee" : pricingTab === "lab-tests" ? "Lab Test" : "Imaging Service"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {pricingTab === "doctors" && !editingItem && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2 relative">
                    <Label htmlFor="bulkDoctorRole">Role <span className="text-red-500">*</span></Label>
                    <Input
                      id="bulkDoctorRole"
                      value={formData.doctorRole || ""}
                      onChange={(e) => {
                        setFormData({ ...formData, doctorRole: e.target.value, doctorName: "", doctorId: null });
                        setShowRoleSuggestions(true);
                        setDoctorRoleError(""); // Clear error on change
                      }}
                      onFocus={() => setShowRoleSuggestions(true)}
                      placeholder="Select role"
                      autoComplete="off"
                      required
                      data-testid="input-bulk-role"
                    />
                    {showRoleSuggestions && (
                      <div className="role-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                        {roles
                          .filter((role: any) => 
                            role.name !== 'patient' && 
                            role.name !== 'admin' &&
                            (!formData.doctorRole || 
                            role.displayName.toLowerCase().includes(formData.doctorRole.toLowerCase()) ||
                            role.name.toLowerCase().includes(formData.doctorRole.toLowerCase()))
                          )
                          .map((role: any, index: number) => (
                            <div
                              key={index}
                              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                              onClick={() => {
                                setFormData({ ...formData, doctorRole: role.name, doctorName: "", doctorId: null });
                                setShowRoleSuggestions(false);
                              }}
                            >
                              <div className="font-medium text-sm">{role.displayName}</div>
                            </div>
                          ))}
                        {roles.filter((role: any) => 
                          role.name !== 'patient' && 
                          role.name !== 'admin' &&
                          (!formData.doctorRole || 
                          role.displayName.toLowerCase().includes(formData.doctorRole.toLowerCase()) ||
                          role.name.toLowerCase().includes(formData.doctorRole.toLowerCase()))
                        ).length === 0 && formData.doctorRole && (
                          <div className="px-4 py-3 text-sm text-gray-500">
                            No roles found. You can enter a custom role name.
                          </div>
                        )}
                      </div>
                    )}
                    {doctorRoleError && (
                      <p className="text-sm text-red-500 mt-1">{doctorRoleError}</p>
                    )}
                  </div>

                  <div className="grid gap-2 relative">
                    <Label htmlFor="bulkDoctorName">Select Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="bulkDoctorName"
                      value={formData.doctorName || ""}
                      onChange={(e) => {
                        setFormData({ ...formData, doctorName: e.target.value });
                        setShowDoctorSuggestions(true);
                        setDoctorNameError(""); // Clear error on change
                      }}
                      onFocus={() => setShowDoctorSuggestions(true)}
                      placeholder="Select or enter name"
                      autoComplete="off"
                      required
                      data-testid="input-bulk-name"
                    />
                    {showDoctorSuggestions && (
                      <div className="doctor-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                        {filteredUsers
                          .filter((user: any) => {
                            const fullName = `${user.firstName} ${user.lastName}`;
                            return !formData.doctorName || 
                              fullName.toLowerCase().includes(formData.doctorName.toLowerCase());
                          })
                          .map((user: any, index: number) => (
                            <div
                              key={index}
                              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                              onClick={() => {
                                const fullName = `${user.firstName} ${user.lastName}`;
                                setFormData({ 
                                  ...formData, 
                                  doctorName: fullName,
                                  doctorId: user.id,
                                  doctorRole: formData.doctorRole || user.role
                                });
                                setShowDoctorSuggestions(false);
                              }}
                            >
                              <div className="font-medium text-sm">{user.firstName} {user.lastName}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{user.role}</div>
                            </div>
                          ))}
                        {filteredUsers.filter((user: any) => {
                          const fullName = `${user.firstName} ${user.lastName}`;
                          return !formData.doctorName || 
                            fullName.toLowerCase().includes(formData.doctorName.toLowerCase());
                        }).length === 0 && (
                          <div className="px-4 py-3 text-sm text-gray-500">
                            No users found. {formData.doctorRole && `Try changing the role filter.`}
                          </div>
                        )}
                      </div>
                    )}
                    {doctorNameError && (
                      <p className="text-sm text-red-500 mt-1">{doctorNameError}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Services</Label>
                  <div className="border rounded-md overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="text-left p-2 text-sm font-medium">Service Name *</th>
                          <th className="text-left p-2 text-sm font-medium">Service Code</th>
                          <th className="text-left p-2 text-sm font-medium">Category</th>
                          <th className="text-left p-2 text-sm font-medium">Base Price (£) *</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {multipleServices.map((service, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">
                              <Input
                                value={service.serviceName}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].serviceName = e.target.value;
                                  
                                  // Auto-generate service code from service name
                                  const words = e.target.value.trim().split(/\s+/);
                                  const initials = words.map(word => word.charAt(0).toUpperCase()).join('');
                                  if (initials) {
                                    updated[index].serviceCode = `${initials}001`;
                                  }
                                  
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., General Consultation"
                                data-testid={`input-service-name-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={service.serviceCode}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].serviceCode = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., GC001"
                                data-testid={`input-service-code-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={service.category}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].category = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., Diagnostic"
                                data-testid={`input-category-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={service.basePrice}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].basePrice = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="0.00"
                                data-testid={`input-base-price-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              {multipleServices.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updated = multipleServices.filter((_, i) => i !== index);
                                    setMultipleServices(updated);
                                  }}
                                  data-testid={`button-remove-service-${index}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMultipleServices([
                        ...multipleServices,
                        { serviceName: "", serviceCode: "", category: "", basePrice: "" }
                      ]);
                    }}
                    className="w-full"
                    data-testid="button-add-more-service"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add More Service
                  </Button>
                </div>
              </>
            )}

            {pricingTab === "doctors" && editingItem && (
              <>
                <div className="grid gap-2 relative">
                  <Label htmlFor="serviceName">Service Name *</Label>
                  <Input
                    id="serviceName"
                    value={formData.serviceName || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, serviceName: e.target.value });
                      setShowServiceSuggestions(true);
                    }}
                    onFocus={() => setShowServiceSuggestions(true)}
                    placeholder="e.g., General Consultation"
                    autoComplete="off"
                  />
                  {showServiceSuggestions && (
                    <div className="service-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                      {DOCTOR_SERVICE_OPTIONS
                        .filter(option => 
                          !formData.serviceName || 
                          option.value.toLowerCase().includes(formData.serviceName.toLowerCase()) ||
                          option.description.toLowerCase().includes(formData.serviceName.toLowerCase())
                        )
                        .map((option, index) => (
                          <div
                            key={index}
                            className="px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                            onClick={() => {
                              setFormData({ ...formData, serviceName: option.value });
                              setShowServiceSuggestions(false);
                            }}
                          >
                            <div className="font-medium text-sm">{option.value}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{option.description}</div>
                          </div>
                        ))}
                      {DOCTOR_SERVICE_OPTIONS.filter(option => 
                        !formData.serviceName || 
                        option.value.toLowerCase().includes(formData.serviceName.toLowerCase()) ||
                        option.description.toLowerCase().includes(formData.serviceName.toLowerCase())
                      ).length === 0 && formData.serviceName && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No matches found. You can enter a custom service name.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-2 relative">
                  <Label htmlFor="doctorRole">Role</Label>
                  <Input
                    id="doctorRole"
                    value={formData.doctorRole || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, doctorRole: e.target.value, doctorName: "", doctorId: null });
                      setShowRoleSuggestions(true);
                    }}
                    onFocus={() => setShowRoleSuggestions(true)}
                    placeholder="Select role (optional)"
                    autoComplete="off"
                  />
                  {showRoleSuggestions && (
                    <div className="role-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                      {roles
                        .filter((role: any) => 
                          role.name !== 'patient' && 
                          role.name !== 'admin' &&
                          (!formData.doctorRole || 
                          role.displayName.toLowerCase().includes(formData.doctorRole.toLowerCase()) ||
                          role.name.toLowerCase().includes(formData.doctorRole.toLowerCase()))
                        )
                        .map((role: any, index: number) => (
                          <div
                            key={index}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => {
                              setFormData({ ...formData, doctorRole: role.name, doctorName: "", doctorId: null });
                              setShowRoleSuggestions(false);
                            }}
                          >
                            <div className="font-medium text-sm">{role.displayName}</div>
                          </div>
                        ))}
                      {roles.filter((role: any) => 
                        role.name !== 'patient' && 
                        role.name !== 'admin' &&
                        (!formData.doctorRole || 
                        role.displayName.toLowerCase().includes(formData.doctorRole.toLowerCase()) ||
                        role.name.toLowerCase().includes(formData.doctorRole.toLowerCase()))
                      ).length === 0 && formData.doctorRole && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No roles found. You can enter a custom role name.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-2 relative">
                  <Label htmlFor="doctorName">Select Name</Label>
                  <Input
                    id="doctorName"
                    value={formData.doctorName || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, doctorName: e.target.value });
                      setShowDoctorSuggestions(true);
                    }}
                    onFocus={() => setShowDoctorSuggestions(true)}
                    placeholder="Select or enter name (optional)"
                    autoComplete="off"
                  />
                  {showDoctorSuggestions && (
                    <div className="doctor-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                      {filteredUsers
                        .filter((user: any) => {
                          const fullName = `${user.firstName} ${user.lastName}`;
                          return !formData.doctorName || 
                            fullName.toLowerCase().includes(formData.doctorName.toLowerCase());
                        })
                        .map((user: any, index: number) => (
                          <div
                            key={index}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => {
                              const fullName = `${user.firstName} ${user.lastName}`;
                              setFormData({ 
                                ...formData, 
                                doctorName: fullName,
                                doctorId: user.id,
                                doctorRole: formData.doctorRole || user.role
                              });
                              setShowDoctorSuggestions(false);
                            }}
                          >
                            <div className="font-medium text-sm">{user.firstName} {user.lastName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{user.role}</div>
                          </div>
                        ))}
                      {filteredUsers.filter((user: any) => {
                        const fullName = `${user.firstName} ${user.lastName}`;
                        return !formData.doctorName || 
                          fullName.toLowerCase().includes(formData.doctorName.toLowerCase());
                      }).length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No users found. {formData.doctorRole && `Try changing the role filter.`}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="serviceCode">Service Code</Label>
                  <Input
                    id="serviceCode"
                    value={formData.serviceCode || ""}
                    onChange={(e) => setFormData({ ...formData, serviceCode: e.target.value })}
                    placeholder="e.g., GC001"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category || ""}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Consultation"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={formData.currency || "GBP"}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      placeholder="GBP"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="basePrice">Price *</Label>
                    <Input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      value={formData.basePrice || ""}
                      onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </>
            )}

            {pricingTab === "lab-tests" && !editingItem && (
              <>
                {/* Existing Tests in Database (Read-only) */}
                {labTests.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Existing Tests in Database</Label>
                    <div className="border rounded-md overflow-hidden max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                      <table className="w-full">
                        <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                          <tr>
                            <th className="text-left p-2 text-sm font-medium">Test Type</th>
                            <th className="text-left p-2 text-sm font-medium">Code</th>
                            <th className="text-left p-2 text-sm font-medium">Category</th>
                            <th className="text-left p-2 text-sm font-medium">Price (£)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {labTests.map((test: any) => (
                            <tr key={test.id} className="border-t">
                              <td className="p-2 text-sm">{test.testName}</td>
                              <td className="p-2 text-sm">{test.testCode || '-'}</td>
                              <td className="p-2 text-sm">{test.category || '-'}</td>
                              <td className="p-2 text-sm">{test.basePrice}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Add Custom Tests (Editable) */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Add Custom Tests</Label>
                  <div className="border rounded-md overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="text-left p-2 text-sm font-medium">Test Type *</th>
                          <th className="text-left p-2 text-sm font-medium">Code</th>
                          <th className="text-left p-2 text-sm font-medium">Category</th>
                          <th className="text-left p-2 text-sm font-medium">Price (£) *</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {multipleServices.map((service, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">
                              <Input
                                value={service.serviceName}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].serviceName = e.target.value;
                                  
                                  const words = e.target.value.trim().split(/\s+/);
                                  const initials = words.map(word => word.charAt(0).toUpperCase()).join('');
                                  if (initials) {
                                    updated[index].serviceCode = `${initials}001`;
                                  }
                                  
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., Complete Blood Count"
                                data-testid={`input-test-name-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={service.serviceCode}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].serviceCode = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., CBC001"
                                data-testid={`input-test-code-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={service.category}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].category = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., Hematology"
                                data-testid={`input-test-category-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={service.basePrice}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].basePrice = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="0.00"
                                data-testid={`input-test-price-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              {multipleServices.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updated = multipleServices.filter((_, i) => i !== index);
                                    setMultipleServices(updated);
                                  }}
                                  data-testid={`button-remove-test-${index}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMultipleServices([
                        ...multipleServices,
                        { serviceName: "", serviceCode: "", category: "", basePrice: "" }
                      ]);
                    }}
                    className="w-full"
                    data-testid="button-add-more-test"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add More Test
                  </Button>
                  {labTestError && (
                    <p className="text-sm text-red-500 mt-2">{labTestError}</p>
                  )}
                </div>
              </>
            )}

            {pricingTab === "lab-tests" && editingItem && (
              <>
                <div className="grid gap-2 relative">
                  <Label htmlFor="testName">Test Name *</Label>
                  <Input
                    id="testName"
                    value={formData.testName || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, testName: e.target.value });
                      setShowLabTestSuggestions(true);
                    }}
                    onFocus={() => setShowLabTestSuggestions(true)}
                    placeholder="e.g., Complete Blood Count"
                    autoComplete="off"
                  />
                  {showLabTestSuggestions && (
                    <div className="lab-test-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                      {LAB_TEST_OPTIONS
                        .filter(option => 
                          !formData.testName || 
                          option.toLowerCase().includes(formData.testName.toLowerCase())
                        )
                        .map((option, index) => (
                          <div
                            key={index}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                            onClick={() => {
                              setFormData({ ...formData, testName: option });
                              setShowLabTestSuggestions(false);
                            }}
                          >
                            <div className="font-medium text-sm">{option}</div>
                          </div>
                        ))}
                      {LAB_TEST_OPTIONS.filter(option => 
                        !formData.testName || 
                        option.toLowerCase().includes(formData.testName.toLowerCase())
                      ).length === 0 && formData.testName && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No matches found. You can enter a custom test name.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="testCode">Test Code</Label>
                  <Input
                    id="testCode"
                    value={formData.testCode || ""}
                    onChange={(e) => setFormData({ ...formData, testCode: e.target.value })}
                    placeholder="e.g., CBC001"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category || ""}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Hematology"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={formData.currency || "USD"}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      placeholder="USD"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="basePrice">Price *</Label>
                    <Input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      value={formData.basePrice || ""}
                      onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </>
            )}

            {pricingTab === "imaging" && !editingItem && (
              <>
                {/* Existing Imaging in Database (Read-only) */}
                {imaging.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Existing Imaging in Database</Label>
                    <div className="border rounded-md overflow-hidden max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                      <table className="w-full">
                        <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                          <tr>
                            <th className="text-left p-2 text-sm font-medium">Imaging Type</th>
                            <th className="text-left p-2 text-sm font-medium">Code</th>
                            <th className="text-left p-2 text-sm font-medium">Price (£)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {imaging.map((img: any) => (
                            <tr key={img.id} className="border-t">
                              <td className="p-2 text-sm">{img.imagingType}</td>
                              <td className="p-2 text-sm">{img.imagingCode || '-'}</td>
                              <td className="p-2 text-sm">{img.basePrice}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Add Custom Imaging (Editable) */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Add Custom Imaging</Label>
                  <div className="border rounded-md overflow-hidden max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                        <tr>
                          <th className="text-left p-2 text-sm font-medium">Imaging Type *</th>
                          <th className="text-left p-2 text-sm font-medium">Code</th>
                          <th className="text-left p-2 text-sm font-medium">Price (£) *</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {multipleServices.map((service, index) => (
                          <tr key={index} className="border-t">
                            <td className="p-2">
                              <Input
                                value={service.serviceName}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].serviceName = e.target.value;
                                  
                                  // Auto-generate code from imaging type
                                  if (e.target.value) {
                                    updated[index].serviceCode = generateImagingCode(e.target.value);
                                  }
                                  
                                  setMultipleServices(updated);
                                  // Clear error when user starts typing
                                  if (imagingError) setImagingError("");
                                }}
                                placeholder="e.g., CT Scan"
                                data-testid={`input-imaging-type-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                value={service.serviceCode}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].serviceCode = e.target.value;
                                  setMultipleServices(updated);
                                }}
                                placeholder="e.g., CT001"
                                data-testid={`input-imaging-code-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={service.basePrice}
                                onChange={(e) => {
                                  const updated = [...multipleServices];
                                  updated[index].basePrice = e.target.value;
                                  setMultipleServices(updated);
                                  // Clear error when user starts typing
                                  if (imagingError) setImagingError("");
                                }}
                                placeholder="0.00"
                                data-testid={`input-imaging-price-${index}`}
                              />
                            </td>
                            <td className="p-2">
                              {multipleServices.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const updated = multipleServices.filter((_, i) => i !== index);
                                    setMultipleServices(updated);
                                  }}
                                  data-testid={`button-remove-imaging-${index}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMultipleServices([
                        ...multipleServices,
                        { serviceName: "", serviceCode: "", category: "", basePrice: "" }
                      ]);
                    }}
                    className="w-full"
                    data-testid="button-add-more-imaging"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add More Imaging Service
                  </Button>
                  {imagingError && (
                    <p className="text-sm text-red-500 mt-2">{imagingError}</p>
                  )}
                </div>
              </>
            )}

            {pricingTab === "imaging" && editingItem && (
              <>
                <div className="grid gap-2 relative">
                  <Label htmlFor="imagingType">Imaging Type *</Label>
                  <Input
                    id="imagingType"
                    value={formData.imagingType || ""}
                    onChange={(e) => {
                      setFormData({ ...formData, imagingType: e.target.value });
                      setShowImagingTypeSuggestions(true);
                    }}
                    onFocus={() => setShowImagingTypeSuggestions(true)}
                    placeholder="Select or type imaging type"
                    autoComplete="off"
                  />
                  {showImagingTypeSuggestions && (
                    <div className="imaging-type-suggestions absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                      {IMAGING_TYPE_OPTIONS
                        .filter(option => 
                          !formData.imagingType || 
                          option.toLowerCase().includes(formData.imagingType.toLowerCase())
                        )
                        .map((option, index) => (
                          <div
                            key={index}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                            onClick={() => {
                              const generatedCode = generateImagingCode(option);
                              setFormData({ 
                                ...formData, 
                                imagingType: option,
                                imagingCode: generatedCode
                              });
                              setShowImagingTypeSuggestions(false);
                            }}
                          >
                            <div className="font-medium text-sm">{option}</div>
                          </div>
                        ))}
                      {IMAGING_TYPE_OPTIONS.filter(option => 
                        !formData.imagingType || 
                        option.toLowerCase().includes(formData.imagingType.toLowerCase())
                      ).length === 0 && formData.imagingType && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No matches found. You can enter a custom imaging type.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="imagingCode">Imaging Code (Auto-generated)</Label>
                  <Input
                    id="imagingCode"
                    value={formData.imagingCode || ""}
                    onChange={(e) => setFormData({ ...formData, imagingCode: e.target.value })}
                    placeholder="Auto-generated when selecting type"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="modality">Modality</Label>
                    <Input
                      id="modality"
                      value={formData.modality || ""}
                      onChange={(e) => setFormData({ ...formData, modality: e.target.value })}
                      placeholder="e.g., CT"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bodyPart">Body Part</Label>
                    <Input
                      id="bodyPart"
                      value={formData.bodyPart || ""}
                      onChange={(e) => setFormData({ ...formData, bodyPart: e.target.value })}
                      placeholder="e.g., Head"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      value={formData.currency || "USD"}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      placeholder="USD"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="basePrice">Price *</Label>
                    <Input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      value={formData.basePrice || ""}
                      onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </>
            )}

         

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={formData.isActive || false}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lab Tests Already Exists Modal */}
      <Dialog open={showTestsExistsModal} onOpenChange={setShowTestsExistsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tests Already Exist</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700 dark:text-gray-300">
              All default lab tests already exist in the database. No new tests were added.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTestsExistsModal(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Imaging Already Exists Modal */}
      <Dialog open={showImagingExistsModal} onOpenChange={setShowImagingExistsModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imaging Already Exists</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700 dark:text-gray-300">
              All default imaging services already exist in the database. No new imaging was added.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowImagingExistsModal(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

export default function BillingPage() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useRolePermissions();
  const isDoctor = isDoctorLike(user?.role);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string>("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState("");
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadedInvoiceNumber, setDownloadedInvoiceNumber] = useState("");
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [editedStatus, setEditedStatus] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [showSendSuccessModal, setShowSendSuccessModal] = useState(false);
  const [sentInvoiceInfo, setSentInvoiceInfo] = useState({ invoiceNumber: "", recipient: "" });
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
  const [deletedInvoiceNumber, setDeletedInvoiceNumber] = useState("");
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [invoiceToPay, setInvoiceToPay] = useState<Invoice | null>(null);
  const [isListView, setIsListView] = useState(true);
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState<
    "Cash" | "Online Payment" | "Insurance"
  >("Online Payment");
  const [invoiceStatus, setInvoiceStatus] = useState<"pending" | "paid" | "partial">("pending");
  const [insuranceDetails, setInsuranceDetails] = useState({
    provider: "",
    planType: "",
    policyNumber: "",
    memberNumber: "",
    memberName: "",
    contact: "",
  });
  const [insuranceForm, setInsuranceForm] = useState({
    provider: "",
    planType: "",
    policyNumber: "",
    memberNumber: "",
    memberName: "",
    contact: "",
  });
  const [showInsuranceInfoDialog, setShowInsuranceInfoDialog] = useState(false);
  const [insuranceDialogPromptedFor, setInsuranceDialogPromptedFor] = useState<string | null>(null);

  const insuranceProviders = [
    "NHS (National Health Service)",
    "Bupa",
    "AXA PPP Healthcare",
    "Vitality Health",
    "Aviva Health",
    "Simply Health",
    "WPA",
    "Benenden Health",
    "Healix Health Services",
    "Sovereign Health Care",
    "Exeter Friendly Society",
    "Self-Pay",
    "Other",
  ];

  const insurancePlanTypes = ["Individual", "Family", "Corporate", "Group", "Private"];

  const getPatientInsuranceInfo = (patientId?: string) => {
    if (!patientId || !patients) return null;
    const patient = patients.find((p: any) => p.patientId === patientId);
    if (!patient) return null;
    const info = patient.insuranceInfo || {};
    const provider = info.provider || patient.insuranceProvider || patient.insurance || "";
    if (!provider) return null;
    const memberName =
      info.memberName || `${patient.firstName || ""} ${patient.lastName || ""}`.trim();
    const contact = info.contact || patient.phone || patient.mobile || patient.contact || "";
    return {
      provider,
      planType: info.planType || "",
      policyNumber: info.policyNumber || patient.insuranceNumber || "",
      memberNumber: info.memberNumber || "",
      memberName,
      contact,
    };
  };

  const openInsuranceDialog = (prefill?: (typeof insuranceDetails)) => {
    setInsuranceForm({
      provider: prefill?.provider || insuranceDetails.provider,
      planType: prefill?.planType || insuranceDetails.planType,
      policyNumber: prefill?.policyNumber || insuranceDetails.policyNumber,
      memberNumber: prefill?.memberNumber || insuranceDetails.memberNumber,
      memberName: prefill?.memberName || insuranceDetails.memberName,
      contact: prefill?.contact || insuranceDetails.contact,
    });
    setShowInsuranceInfoDialog(true);
  };
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  const handleInvoicePaymentMethodChange = (newMethod: "Cash" | "Online Payment" | "Insurance") => {
    setInvoicePaymentMethod(newMethod);
    if (newMethod === "Cash") {
      setInvoiceStatus("paid");
    } else if (newMethod === "Online Payment") {
      setInvoiceStatus("pending");
    } else {
      setInvoiceStatus("pending");
    }
  };

  const handlePaymentSuccess = async (paidInvoice: Invoice) => {
    try {
      await apiRequest("PATCH", `/api/billing/invoices/${paidInvoice.id}`, { status: "paid" });
      toast({
        title: "Payment Successful",
        description: `Invoice ${paidInvoice.invoiceNumber} marked as paid.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      queryClient.refetchQueries({ queryKey: ["/api/billing/invoices"] });
    } catch (error) {
      console.error("Failed to update invoice status after payment:", error);
    }
  };
  
  // Date filter states
  const [serviceDateFrom, setServiceDateFrom] = useState("");
  
  // Payment method filter for doctors
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  
  // Insurance provider filter for doctors
  const [insuranceProviderFilter, setInsuranceProviderFilter] = useState<string>("all");
  
  // Universal search for doctors
  const [universalSearch, setUniversalSearch] = useState("");
  
  // Invoice ID filter
  const [invoiceIdFilter, setInvoiceIdFilter] = useState("all");
  
  // Custom Reports filters
  const [reportDateRange, setReportDateRange] = useState("this-month");
  const [reportInsuranceType, setReportInsuranceType] = useState("all");
  const [reportRole, setReportRole] = useState("all");
  const [reportUserName, setReportUserName] = useState("all");
  const [reportGenerated, setReportGenerated] = useState(false);
  const [displayedReportData, setDisplayedReportData] = useState<any>(null);
  
  // Searchable dropdown states
  const [insuranceSearchOpen, setInsuranceSearchOpen] = useState(false);
  const [roleSearchOpen, setRoleSearchOpen] = useState(false);
  const [nameSearchOpen, setNameSearchOpen] = useState(false);
  const [invoiceSearchOpen, setInvoiceSearchOpen] = useState(false);
  const [insuranceSearch, setInsuranceSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState("invoices");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isInvoiceSaved, setIsInvoiceSaved] = useState(false);
  const [clinicHeader, setClinicHeader] = useState<any>(null);
  const [clinicFooter, setClinicFooter] = useState<any>(null);
  const [savedInvoiceIds, setSavedInvoiceIds] = useState<Set<number>>(new Set());
  
  // Insurance claims workflow states
  const [showSubmitClaimDialog, setShowSubmitClaimDialog] = useState(false);
  const [showRecordPaymentDialog, setShowRecordPaymentDialog] = useState(false);
  const [selectedClaimInvoice, setSelectedClaimInvoice] = useState<Invoice | null>(null);
  const [claimFormData, setClaimFormData] = useState({
    provider: '',
    claimNumber: '',
  });
  const [paymentFormData, setPaymentFormData] = useState({
    amountPaid: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentReference: '',
    notes: '',
  });
  
  // Check if user is admin or patient
  const isAdmin = user?.role === 'admin';
  const isPatient = user?.role === 'patient';
  const canShowNewInvoiceButton = isAdmin || user?.role === 'doctor' || user?.role === 'nurse';

  // Fetch clinic headers and footers
  useEffect(() => {
    const fetchClinicBranding = async () => {
      try {
        const [headerResponse, footerResponse] = await Promise.all([
          apiRequest('GET', '/api/clinic-headers', undefined),
          apiRequest('GET', '/api/clinic-footers', undefined)
        ]);
        
        const headerData = await headerResponse.json();
        const footerData = await footerResponse.json();
        
        console.log('📋 Clinic Header Data:', headerData);
        console.log('📋 Clinic Footer Data:', footerData);
        
        setClinicHeader(headerData);
        setClinicFooter(footerData);
      } catch (error) {
        console.error('Failed to fetch clinic branding:', error);
      }
    };
    
    fetchClinicBranding();
  }, []);

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setEditedStatus(invoice.status);
    setIsEditingStatus(false);
    setIsInvoiceSaved(false);
  };

  const handleUpdateStatus = async () => {
    if (!selectedInvoice || !editedStatus) return;
    
    try {
      await apiRequest('PATCH', `/api/billing/invoices/${selectedInvoice.id}`, {
        status: editedStatus
      });
      
      // If status is changed to "paid", create a payment record
      if (editedStatus === 'paid' && selectedInvoice.status !== 'paid') {
        await apiRequest('POST', '/api/billing/payments', {
          organizationId: selectedInvoice.organizationId,
          invoiceId: selectedInvoice.id,
          patientId: selectedInvoice.patientId,
          amount: typeof selectedInvoice.totalAmount === 'string' ? parseFloat(selectedInvoice.totalAmount) : selectedInvoice.totalAmount,
          currency: 'GBP',
          paymentMethod: 'manual',
          paymentProvider: 'manual',
          paymentStatus: 'completed',
          paymentDate: new Date().toISOString(),
          transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
        
        // Refresh payments list
        queryClient.invalidateQueries({ queryKey: ["/api/billing/payments"] });
      }
      
      // Update the local state
      setSelectedInvoice({ ...selectedInvoice, status: editedStatus as any });
      setIsEditingStatus(false);
      
      // Refresh the invoices list
      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      queryClient.refetchQueries({ queryKey: ["/api/billing/invoices"] });
      
      toast({
        title: "Status Updated",
        description: `Invoice status updated to ${editedStatus}`,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update invoice status",
        variant: "destructive"
      });
    }
  };

  const handleInlineStatusUpdate = async (invoiceId: string, newStatus: string) => {
    setUpdatingStatusId(invoiceId);
    
    try {
      await apiRequest('PATCH', `/api/billing/invoices/${invoiceId}`, {
        status: newStatus
      });
      
      // Show success modal
      setShowStatusUpdateModal(true);
      
      // Refresh the invoices list
      await queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      await queryClient.refetchQueries({ queryKey: ["/api/billing/invoices"] });
      
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update invoice status",
        variant: "destructive"
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleCreateInvoice = async () => {
    setIsCreatingInvoice(true);
    setPatientError("");
    setServiceError("");
    setTotalAmountError("");
    setNhsNumberError("");

    if (!selectedPatient || selectedPatient === 'loading' || selectedPatient === 'no-patients') {
      setPatientError('Please select a patient to bill');
      setIsCreatingInvoice(false);
      return;
    }

    if (!firstServiceCode.trim() || !firstServiceDesc.trim()) {
      setServiceError('Please enter both a service code and description');
      setIsCreatingInvoice(false);
      return;
    }

    const qty = parseInt(firstServiceQty || '0', 10);
    const unitPrice = parseFloat(firstServiceAmount || '0');
    const total = parseFloat(totalAmount || '0');

    if (isNaN(qty) || qty <= 0 || isNaN(unitPrice) || unitPrice <= 0) {
      setServiceError('Quantity and amount must be numbers greater than zero');
      setIsCreatingInvoice(false);
      return;
    }

    if (isNaN(total) || total <= 0) {
      setTotalAmountError('Total amount must be greater than zero');
      setIsCreatingInvoice(false);
      return;
    }

    if (invoicePaymentMethod === "Insurance" && !insuranceDetails.provider.trim()) {
      toast({
        title: "Missing Insurance Provider",
        description: "Add the insurance provider details before creating the invoice.",
        variant: "destructive"
      });
      openInsuranceDialog();
      setIsCreatingInvoice(false);
      return;
    }

    const resolvedInsuranceProvider =
      invoicePaymentMethod === "Insurance"
        ? insuranceDetails.provider || insuranceProvider
        : insuranceProvider;

    const insuranceSummaryParts: string[] = [];

    if (invoicePaymentMethod === "Insurance") {
      if (insuranceDetails.provider) {
        insuranceSummaryParts.push(`Provider: ${insuranceDetails.provider}`);
      }
      if (insuranceDetails.planType) {
        insuranceSummaryParts.push(`Plan: ${insuranceDetails.planType}`);
      }
      if (insuranceDetails.policyNumber) {
        insuranceSummaryParts.push(`Policy: ${insuranceDetails.policyNumber}`);
      }
      if (insuranceDetails.memberNumber) {
        insuranceSummaryParts.push(`Member #: ${insuranceDetails.memberNumber}`);
      }
      if (insuranceDetails.memberName) {
        insuranceSummaryParts.push(`Member: ${insuranceDetails.memberName}`);
      }
      if (insuranceDetails.contact) {
        insuranceSummaryParts.push(`Contact: ${insuranceDetails.contact}`);
      }
    }

    const insuranceSummary = insuranceSummaryParts.join(' | ');

    const invoicePayload = {
      patientId: selectedPatient,
      serviceDate,
      invoiceDate,
      dueDate,
      totalAmount: totalAmount || '0',
      paidAmount: invoicePaymentMethod === "Cash" ? totalAmount || '0' : '0',
      status: invoiceStatus,
      paymentMethod: invoicePaymentMethod,
      insuranceProvider: resolvedInsuranceProvider,
      nhsNumber: nhsNumber.trim() || undefined,
      firstServiceCode,
      firstServiceDesc,
      firstServiceQty,
      firstServiceAmount,
      notes: [notes, insuranceSummary].filter(Boolean).join(' | ')
    };

    try {
      const response = await apiRequest('POST', '/api/billing/invoices', invoicePayload);
      const responseBody = await response.json();
      if (!response.ok) {
        throw new Error(responseBody?.error || 'Failed to create invoice');
      }
      const createdInvoice = responseBody as Invoice;

      setShowNewInvoice(false);
      setSelectedPatient("");
      setServiceDate(new Date().toISOString().split('T')[0]);
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      setTotalAmount("");
      setInsuranceProvider("");
      setNhsNumber("");
      setFirstServiceCode("");
      setFirstServiceDesc("");
      setFirstServiceQty("");
      setFirstServiceAmount("");
      setNotes("");
      setInvoicePaymentMethod("Online Payment");
      setInvoiceStatus("pending");
      setInsuranceDetails({
        provider: "",
        planType: "",
        policyNumber: "",
        memberNumber: "",
        memberName: "",
        contact: "",
      });
      setInsuranceDialogPromptedFor(null);

      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });

      if (invoicePaymentMethod === "Online Payment") {
        setInvoiceToPay(createdInvoice);
        setShowPaymentModal(true);
      } else {
        setCreatedInvoiceNumber(createdInvoice.invoiceNumber || "");
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error('Invoice creation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unable to create invoice. Please try again.';
      toast({
        title: "Invoice Creation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleInsuranceDialogSave = () => {
    setInsuranceDetails(insuranceForm);
    setShowInsuranceInfoDialog(false);
    setInsuranceDialogPromptedFor(null);

    if (selectedPatient && patients) {
      queryClient.setQueryData(["/api/patients"], (oldData: any) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map((patient: any) =>
          patient.patientId === selectedPatient
            ? {
                ...patient,
                insuranceInfo: {
                  ...(patient.insuranceInfo || {}),
                  provider: insuranceForm.provider,
                  planType: insuranceForm.planType,
                  policyNumber: insuranceForm.policyNumber,
                  memberNumber: insuranceForm.memberNumber,
                  memberName: insuranceForm.memberName,
                  contact: insuranceForm.contact,
                },
                insuranceProvider: insuranceForm.provider,
                insuranceNumber: insuranceForm.policyNumber,
              }
            : patient
        );
      });
    }
  };

  const handlePayNow = (invoice: Invoice) => {
    setInvoiceToPay(invoice);
    setShowPaymentModal(true);
  };

  // Insurance claims handlers
  const handleSubmitClaim = (invoice: Invoice) => {
    setSelectedClaimInvoice(invoice);
    setClaimFormData({
      provider: invoice.insurance?.provider || '',
      claimNumber: invoice.insurance?.claimNumber || '',
    });
    setShowSubmitClaimDialog(true);
  };

  const handleRecordPayment = (invoice: Invoice) => {
    setSelectedClaimInvoice(invoice);
    setPaymentFormData({
      amountPaid: '',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentReference: '',
      notes: '',
    });
    setShowRecordPaymentDialog(true);
  };

  const submitInsuranceClaim = async () => {
    if (!selectedClaimInvoice) return;

    try {
      await apiRequest('POST', '/api/insurance/submit-claim', {
        invoiceId: selectedClaimInvoice.id,
        provider: claimFormData.provider,
        claimNumber: claimFormData.claimNumber,
      });

      toast({
        title: "Success",
        description: "Insurance claim submitted successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      setShowSubmitClaimDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit insurance claim",
        variant: "destructive",
      });
    }
  };

  const recordInsurancePayment = async () => {
    if (!selectedClaimInvoice || !paymentFormData.amountPaid) return;

    try {
      await apiRequest('POST', '/api/insurance/record-payment', {
        invoiceId: selectedClaimInvoice.id,
        claimNumber: selectedClaimInvoice.insurance?.claimNumber || '',
        amountPaid: parseFloat(paymentFormData.amountPaid),
        paymentDate: paymentFormData.paymentDate,
        insuranceProvider: selectedClaimInvoice.insurance?.provider || '',
        paymentReference: paymentFormData.paymentReference,
        notes: paymentFormData.notes,
      });

      toast({
        title: "Success",
        description: "Insurance payment recorded successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      setShowRecordPaymentDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record insurance payment",
        variant: "destructive",
      });
    }
  };

  const handleSaveInvoice = async (invoiceId: string) => {
    console.log('💾 Save Invoice button clicked for invoice:', invoiceId);
    
    const invoice = Array.isArray(invoices) ? invoices.find((inv: any) => inv.id === Number(invoiceId)) : null;
    
    if (!invoice) {
      console.error('❌ Invoice not found:', invoiceId);
      toast({
        title: "Error",
        description: "Invoice not found",
        variant: "destructive"
      });
      return;
    }

    try {
      // Helper to safely convert to number and format
      const toNum = (val: any) => typeof val === 'string' ? parseFloat(val) : val;

      // Create PDF document
      console.log('📄 Creating PDF document for save...');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;

      // Function to add header to page
      const addHeader = () => {
        // Purple header background
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        // Clinic name
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(clinicHeader?.clinicName || 'nhjn', margin, 18);
        
        // Tagline
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(clinicHeader?.tagline || 'Excellence in Healthcare', margin, 28);
        
        // INVOICE text on right
        doc.setFontSize(32);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE', pageWidth - margin - 55, 28);
      };

      // Function to add footer to page
      const addFooter = (pageNum: number) => {
        const footerY = pageHeight - 20;
        doc.setFillColor(248, 250, 252);
        doc.rect(0, footerY - 5, pageWidth, 25, 'F');
        doc.setDrawColor(229, 231, 235);
        doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
        doc.setTextColor(107, 114, 128);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const footerText = clinicFooter?.footerText || 'Thank you for choosing Cura Medical Practice for your healthcare needs.';
        doc.text(footerText, pageWidth / 2, footerY + 2, { align: 'center' });
        doc.text('© 2025 Cura Software Limited - Powered by Halo Group & Averox Technologies', pageWidth / 2, footerY + 8, { align: 'center' });
        doc.text(`Page ${pageNum}`, pageWidth - margin, footerY + 2, { align: 'right' });
      };

      // Start PDF content
      addHeader();
      
      let yPosition = 50;

      // Bill To and Invoice Details section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('BILL TO', margin, yPosition);
      doc.text('INVOICE DETAILS', pageWidth / 2 + 10, yPosition);
      
      yPosition += 7;
      doc.setFont('helvetica', 'normal');
      doc.text(invoice.patientName, margin, yPosition);
      doc.text(`Invoice Number: ${invoice.invoiceNumber || invoice.id}`, pageWidth / 2 + 10, yPosition);
      
      yPosition += 5;
      doc.setFontSize(9);
      doc.text(`Patient ID: ${invoice.patientId}`, margin, yPosition);
      doc.text(`Invoice Date: ${format(new Date(invoice.invoiceDate), 'dd/MM/yyyy')}`, pageWidth / 2 + 10, yPosition);
      
      yPosition += 5;
      doc.text(`Due Date: ${format(new Date(invoice.dueDate), 'dd/MM/yyyy')}`, pageWidth / 2 + 10, yPosition);

      yPosition += 10;

      // Services table header
      doc.setFillColor(79, 70, 229);
      doc.rect(margin, yPosition, contentWidth, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      yPosition += 6;
      doc.text('Service Description', margin + 2, yPosition);
      doc.text('Qty', pageWidth - margin - 80, yPosition, { align: 'right' });
      doc.text('Rate', pageWidth - margin - 50, yPosition, { align: 'right' });
      doc.text('Amount', pageWidth - margin - 2, yPosition, { align: 'right' });

      yPosition += 5;

      // Services table rows
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      let rowCount = 0;
      invoice.items.forEach((item: any) => {
        if (yPosition > pageHeight - 50) {
          addFooter(1);
          doc.addPage();
          addHeader();
          yPosition = 50;
        }

        if (rowCount % 2 === 0) {
          doc.setFillColor(249, 250, 251);
          doc.rect(margin, yPosition - 4, contentWidth, 10, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.text(item.description, margin + 2, yPosition);
        yPosition += 4;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text('Professional medical consultation', margin + 2, yPosition);
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        yPosition -= 2;
        doc.text(item.quantity.toString(), pageWidth - margin - 80, yPosition, { align: 'right' });
        doc.text(`£${toNum(item.unitPrice || item.amount / (item.quantity || 1)).toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
        doc.text(`£${toNum(item.total || item.amount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
        
        yPosition += 8;
        rowCount++;
      });

      yPosition += 5;

      // Totals section
      const totalsX = pageWidth - margin - 60;
      doc.setFont('helvetica', 'normal');
      doc.text('Subtotal:', totalsX, yPosition);
      doc.text(`£${toNum(invoice.totalAmount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
      
      yPosition += 6;
      doc.text('VAT (0%):', totalsX, yPosition);
      doc.text('£0.00', pageWidth - margin - 2, yPosition, { align: 'right' });
      
      yPosition += 6;
      doc.setDrawColor(79, 70, 229);
      doc.setLineWidth(0.5);
      doc.line(totalsX - 5, yPosition, pageWidth - margin, yPosition);
      
      yPosition += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Total Amount:', totalsX, yPosition);
      doc.text(`£${toNum(invoice.totalAmount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });

      if (toNum(invoice.paidAmount) > 0) {
        yPosition += 8;
        doc.setFontSize(9);
        doc.setTextColor(5, 150, 105);
        doc.text('Amount Paid:', totalsX, yPosition);
        doc.text(`-£${toNum(invoice.paidAmount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
        
        yPosition += 8;
        const balanceDue = toNum(invoice.totalAmount) - toNum(invoice.paidAmount);
        doc.setTextColor(balanceDue === 0 ? 5 : 220, balanceDue === 0 ? 150 : 38, balanceDue === 0 ? 105 : 38);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('Balance Due:', totalsX, yPosition);
        doc.text(`£${balanceDue.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
      }

      addFooter(1);

      // Get PDF as base64
      console.log('📤 Converting PDF to base64...');
      const pdfData = doc.output('datauristring').split(',')[1];
      
      // Send to backend
      console.log('📡 Sending PDF to server...');
      const result = await apiRequest('POST', '/api/billing/save-invoice-pdf', {
        invoiceNumber: invoice.invoiceNumber || invoice.id.toString(),
        patientId: invoice.patientId,
        pdfData
      });

      console.log('✅ Invoice saved successfully:', result);

      setIsInvoiceSaved(true);
      setSavedInvoiceIds(prev => new Set(prev).add(Number(invoiceId)));

      toast({
        title: "Success",
        description: `Invoice saved successfully`,
      });

    } catch (error) {
      console.error('❌ Failed to save invoice:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save invoice. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadInvoice = (invoiceId: string) => {
    console.log('🔽 Download button clicked for invoice:', invoiceId);
    
    const invoice = Array.isArray(invoices) ? invoices.find((inv: any) => inv.id === Number(invoiceId)) : null;
    
    if (!invoice) {
      console.error('❌ Invoice not found:', invoiceId);
      toast({
        title: "Error",
        description: "Invoice not found",
        variant: "destructive"
      });
      return;
    }

    console.log('✅ Invoice found:', invoice);

    try {
      // Helper to safely convert to number and format
      const toNum = (val: any) => typeof val === 'string' ? parseFloat(val) : val;

      // Create new PDF document
      console.log('📄 Creating PDF document...');
      const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;

    // Function to add header to page
    const addHeader = () => {
      // Purple header background
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      // Clinic name
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(clinicHeader?.clinicName || 'nhjn', margin, 18);
      
      // Tagline
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(clinicHeader?.tagline || 'Excellence in Healthcare', margin, 28);
      
      // INVOICE text on right
      doc.setFontSize(32);
      doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', pageWidth - margin - 55, 28);
    };

    // Function to add footer to page
    const addFooter = (pageNum: number) => {
      const footerY = pageHeight - 20;
      
      // Footer background
      doc.setFillColor(248, 250, 252);
      doc.rect(0, footerY - 5, pageWidth, 25, 'F');
      
      // Footer line
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
      
      // Footer text
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const footerText = clinicFooter?.footerText || 'Thank you for choosing Cura Medical Practice for your healthcare needs.';
      doc.text(footerText, pageWidth / 2, footerY + 2, { align: 'center' });
      doc.text('© 2025 Cura Software Limited - Powered by Halo Group & Averox Technologies', pageWidth / 2, footerY + 8, { align: 'center' });
      
      // Page number
      doc.text(`Page ${pageNum}`, pageWidth - margin, footerY + 2, { align: 'right' });
    };

    // Start PDF content
    addHeader();
    
    let yPosition = 50;

    // Bill To and Invoice Details section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO', margin, yPosition);
    doc.text('INVOICE DETAILS', pageWidth / 2 + 10, yPosition);
    
    yPosition += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.patientName, margin, yPosition);
    doc.text(`Invoice Number: ${invoice.id}`, pageWidth / 2 + 10, yPosition);
    
    yPosition += 5;
    doc.setFontSize(9);
    doc.text(`Patient ID: ${invoice.patientId}`, margin, yPosition);
    doc.text(`Invoice Date: ${format(new Date(invoice.invoiceDate), 'dd/MM/yyyy')}`, pageWidth / 2 + 10, yPosition);
    
    yPosition += 5;
    doc.text(`Due Date: ${format(new Date(invoice.dueDate), 'dd/MM/yyyy')}`, pageWidth / 2 + 10, yPosition);
    
    yPosition += 5;
    doc.text(`Payment Terms: Net 30`, pageWidth / 2 + 10, yPosition);

    yPosition += 10;

    // Payment Information box
    doc.setFillColor(219, 234, 254);
    doc.roundedRect(margin, yPosition, contentWidth, 12, 2, 2, 'F');
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    yPosition += 5;
    doc.text('Payment Information', margin + 3, yPosition);
    yPosition += 4;
    doc.setFont('helvetica', 'normal');
    doc.text('Multiple payment options available: Credit Card, Bank Transfer, PayPal, or Cash', margin + 3, yPosition);

    yPosition += 12;

    // Services table header
    doc.setFillColor(79, 70, 229);
    doc.rect(margin, yPosition, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    yPosition += 6;
    doc.text('Service Description', margin + 2, yPosition);
    doc.text('Qty', pageWidth - margin - 80, yPosition, { align: 'right' });
    doc.text('Rate', pageWidth - margin - 50, yPosition, { align: 'right' });
    doc.text('Amount', pageWidth - margin - 2, yPosition, { align: 'right' });

    yPosition += 5;

    // Services table rows
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    let rowCount = 0;
    invoice.items.forEach((item: any) => {
      if (yPosition > pageHeight - 50) {
        addFooter(1);
        doc.addPage();
        addHeader();
        yPosition = 50;
      }

      // Alternate row background
      if (rowCount % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(margin, yPosition - 4, contentWidth, 10, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.text(item.description, margin + 2, yPosition);
      yPosition += 4;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text('Professional medical consultation', margin + 2, yPosition);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      yPosition -= 2;
      doc.text(item.quantity.toString(), pageWidth - margin - 80, yPosition, { align: 'right' });
      doc.text(`£${toNum(item.unitPrice || item.amount / (item.quantity || 1)).toFixed(2)}`, pageWidth - margin - 50, yPosition, { align: 'right' });
      doc.text(`£${toNum(item.total || item.amount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
      
      yPosition += 8;
      rowCount++;
    });

    yPosition += 5;

    // Totals section
    const totalsX = pageWidth - margin - 60;
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', totalsX, yPosition);
    doc.text(`£${toNum(invoice.totalAmount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
    
    yPosition += 6;
    doc.text('VAT (0%):', totalsX, yPosition);
    doc.text('£0.00', pageWidth - margin - 2, yPosition, { align: 'right' });
    
    yPosition += 6;
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.line(totalsX - 5, yPosition, pageWidth - margin, yPosition);
    
    yPosition += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Total Amount:', totalsX, yPosition);
    doc.text(`£${toNum(invoice.totalAmount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });

    if (toNum(invoice.paidAmount) > 0) {
      yPosition += 8;
      doc.setFontSize(9);
      doc.setTextColor(5, 150, 105);
      doc.text('Amount Paid:', totalsX, yPosition);
      doc.text(`-£${toNum(invoice.paidAmount).toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
      
      yPosition += 8;
      const balanceDue = toNum(invoice.totalAmount) - toNum(invoice.paidAmount);
      doc.setTextColor(balanceDue === 0 ? 5 : 220, balanceDue === 0 ? 150 : 38, balanceDue === 0 ? 105 : 38);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Balance Due:', totalsX, yPosition);
      doc.text(`£${balanceDue.toFixed(2)}`, pageWidth - margin - 2, yPosition, { align: 'right' });
    }

      // Add footer to first (and possibly only) page
      addFooter(1);

      // Save the PDF
      console.log('💾 Saving PDF...');
      doc.save(`invoice-${invoice.invoiceNumber || invoice.id}.pdf`);
      
      console.log('✅ PDF download triggered successfully');
      
      // Show download success modal
      setDownloadedInvoiceNumber(invoice.invoiceNumber || invoiceId);
      setShowDownloadModal(true);
      
    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      toast({
        title: "Download Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDownloadPDF = async (invoice: any) => {
    try {
      const organizationId = user?.organizationId;
      const patientId = invoice.patientId;
      const invoiceNumber = invoice.invoiceNumber;
      
      const pdfPath = `/uploads/Invoices/${organizationId}/${patientId}/${invoiceNumber}.pdf`;
      
      const response = await fetch(pdfPath);
      
      if (!response.ok) {
        throw new Error('PDF file not found on server');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Invoice PDF downloaded successfully",
      });
    } catch (error) {
      console.error('❌ Failed to download PDF:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download invoice PDF. Please save the invoice first.",
        variant: "destructive"
      });
    }
  };

  const [sendInvoiceDialog, setSendInvoiceDialog] = useState(false);
  const [invoiceToSend, setInvoiceToSend] = useState<Invoice | null>(null);
  const [sendMethod, setSendMethod] = useState("email");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  // New invoice form state
  const [selectedPatient, setSelectedPatient] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [firstServiceCode, setFirstServiceCode] = useState("");
  const [firstServiceDesc, setFirstServiceDesc] = useState("");
  const [firstServiceQty, setFirstServiceQty] = useState("");
  const [firstServiceAmount, setFirstServiceAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [nhsNumber, setNhsNumber] = useState("");
  
  // Validation error states
  const [patientError, setPatientError] = useState("");
  const [serviceError, setServiceError] = useState("");
  const [totalAmountError, setTotalAmountError] = useState("");
  const [nhsNumberError, setNhsNumberError] = useState("");

  const handleSendInvoice = (invoiceId: string | number) => {
    const normalizedInvoiceId = typeof invoiceId === 'number' ? invoiceId : Number(invoiceId);
    const invoice = Array.isArray(invoices) ? invoices.find((inv: any) => inv.id === normalizedInvoiceId) : null;
    if (invoice) {
      setInvoiceToSend(invoice);
      setRecipientEmail(`${invoice.patientName.toLowerCase().replace(' ', '.')}@email.com`);
      setRecipientPhone(`+44 7${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`);
      setRecipientName(invoice.patientName);
      setRecipientAddress(`${Math.floor(Math.random() * 999) + 1} High Street\nLondon\nSW1A 1AA`);
      const totalAmt = typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount) : invoice.totalAmount;
      setCustomMessage(`Dear ${invoice.patientName},\n\nPlease find your invoice for services rendered on ${format(new Date(invoice.dateOfService), 'MMM d, yyyy')}.\n\nTotal Amount: £${totalAmt.toFixed(2)}\nDue Date: ${format(new Date(invoice.dueDate), 'MMM d, yyyy')}\n\nThank you for choosing our healthcare services.`);
      setSendInvoiceDialog(true);
    }
  };

  const confirmSendInvoice = async () => {
    if (!invoiceToSend) return;
    
    try {
      // First, save the PDF if sending via email (so we can attach it)
      if (sendMethod === 'email') {
        console.log('📄 Generating PDF for email attachment...');
        await handleSaveInvoice(invoiceToSend.id.toString());
      }
      
      // Now send the invoice (PDF will be attached automatically by backend)
      await apiRequest('POST', '/api/billing/send-invoice', {
        invoiceId: invoiceToSend.id,
        sendMethod,
        recipientEmail: sendMethod === 'email' ? recipientEmail : undefined,
        recipientPhone: sendMethod === 'sms' ? recipientPhone : undefined,
        recipientName: sendMethod === 'print' ? recipientName : undefined,
        recipientAddress: sendMethod === 'print' ? recipientAddress : undefined,
        customMessage
      });
      
      // Set the success modal info
      setSentInvoiceInfo({
        invoiceNumber: invoiceToSend.invoiceNumber || invoiceToSend.id.toString(),
        recipient: sendMethod === 'email' ? recipientEmail : sendMethod === 'sms' ? recipientPhone : recipientName
      });
      
      // Close send dialog and show success modal
      setSendInvoiceDialog(false);
      setShowSendSuccessModal(true);
      
      // Clear all form fields
      setInvoiceToSend(null);
      setRecipientEmail("");
      setRecipientPhone("");
      setRecipientName("");
      setRecipientAddress("");
      setCustomMessage("");
    } catch (error) {
      toast({
        title: "Failed to Send Invoice",
        description: "There was an error sending the invoice. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    const invoice = Array.isArray(invoices) ? invoices.find((inv: any) => inv.id === invoiceId) : null;
    if (invoice) {
      setInvoiceToDelete(invoice);
      setShowDeleteModal(true);
    }
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    
    try {
      // Call API to delete the invoice
      await apiRequest('DELETE', `/api/billing/invoices/${invoiceToDelete.id}`, {});
      
      // Set deleted invoice info for success modal
      setDeletedInvoiceNumber(invoiceToDelete.invoiceNumber || invoiceToDelete.id.toString());
      
      // Close delete confirmation modal
      setShowDeleteModal(false);
      
      // Show success modal
      setShowDeleteSuccessModal(true);
      
      // Clear the invoice to delete
      setInvoiceToDelete(null);
      
      // Refresh invoices list - use correct query keys
      queryClient.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
      queryClient.refetchQueries({ queryKey: ["/api/billing/invoices"] });
      queryClient.refetchQueries({ queryKey: ["/api/billing"] });
    } catch (error) {
      toast({
        title: "Failed to Delete Invoice",
        description: "There was an error deleting the invoice. Please try again.",
        variant: "destructive"
      });
      setShowDeleteModal(false);
      setInvoiceToDelete(null);
    }
  };

  // Fetch regular invoices for non-doctor roles
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/billing/invoices", statusFilter],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const url = statusFilter && statusFilter !== 'all' 
        ? `/api/billing/invoices?status=${statusFilter}`
        : '/api/billing/invoices';
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch invoices');
      return response.json();
    },
    enabled: user?.role !== 'doctor',
  });

  // Fetch doctor-specific invoices with table joins
  const { data: doctorInvoices, isLoading: doctorInvoicesLoading } = useQuery({
    queryKey: ["/api/billing/doctor-invoices"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/billing/doctor-invoices', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch doctor invoices');
      return response.json();
    },
    enabled: user?.role === 'doctor',
  });

  // Doctor invoice category tab state
  const [doctorInvoiceTab, setDoctorInvoiceTab] = useState<'overall' | 'appointments' | 'labResults' | 'imaging'>('overall');

  // Get the appropriate invoices based on user role
  const displayInvoices = user?.role === 'doctor' && doctorInvoices 
    ? (doctorInvoiceTab === 'overall' ? doctorInvoices.overall :
       doctorInvoiceTab === 'appointments' ? doctorInvoices.appointments :
       doctorInvoiceTab === 'labResults' ? doctorInvoices.labResults :
       doctorInvoices.imaging)
    : invoices;

  const isLoadingInvoices = user?.role === 'doctor' ? doctorInvoicesLoading : invoicesLoading;

  // Fetch patients for new invoice dropdown
  const { data: patients, isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/patients', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch patients');
      return response.json();
    }
  });

  // Get the current patient's patientId if user is a patient
  const currentPatient = isPatient && patients ? patients.find((p: any) => p.userId === user?.id) : null;
  const currentPatientId = currentPatient?.patientId;

  // Fetch payments for Payment History tab
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/billing/payments"],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const subdomain = localStorage.getItem('user_subdomain') || 'demo';
      const response = await fetch('/api/billing/payments', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Subdomain': subdomain
        }
      });
      if (!response.ok) throw new Error('Failed to fetch payments');
      return response.json();
    },
    enabled: isAdmin,
  });

  // Fetch doctors fees for Revenue Breakdown
  const { data: doctorsFees = [] } = useQuery({
    queryKey: ["/api/pricing/doctors-fees"],
    enabled: isAdmin && activeTab === "custom-reports"
  });
  
  // Fetch users and roles for Custom Reports filters
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: isAdmin && activeTab === "custom-reports",
    select: (data: any) => data || []
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["/api/roles"],
    enabled: isAdmin && activeTab === "custom-reports",
    select: (data: any) => data || []
  });

  // Auto-populate NHS number when patient is selected
  useEffect(() => {
    if (selectedPatient && patients && patients.length > 0) {
      const selected = patients.find((p: any) => p.patientId === selectedPatient);
      if (selected && selected.nhsNumber) {
        setNhsNumber(selected.nhsNumber);
      } else {
        // Clear NHS number if patient has none or selection is invalid
        setNhsNumber("");
      }
    } else {
      // Clear NHS number when selection is cleared
      setNhsNumber("");
    }
  }, [selectedPatient, patients]);

  useEffect(() => {
    if (invoicePaymentMethod !== "Insurance") {
      setInsuranceDialogPromptedFor(null);
      return;
    }

    if (!selectedPatient) {
      return;
    }

    const patientInsurance = getPatientInsuranceInfo(selectedPatient);

    if (patientInsurance) {
      setInsuranceDetails((prev) => ({
        ...prev,
        ...patientInsurance,
      }));
      setInsuranceDialogPromptedFor(null);
      return;
    }

    if (!insuranceDetails.provider && insuranceDialogPromptedFor !== selectedPatient) {
      openInsuranceDialog({
        provider: "",
        planType: "",
        policyNumber: "",
        memberNumber: "",
        memberName: "",
        contact: "",
      });
      setInsuranceDialogPromptedFor(selectedPatient);
    }
  }, [invoicePaymentMethod, selectedPatient, patients, insuranceDetails.provider, insuranceDialogPromptedFor]);

  const filteredInvoices = Array.isArray(displayInvoices) ? displayInvoices.filter((invoice: any) => {
    // Filter by patient ID if user is a patient
    if (isPatient && currentPatientId) {
      if (invoice.patientId !== currentPatientId) {
        return false;
      }
    }
    
    // For doctors: Universal search across all invoice fields
    if (user?.role === 'doctor' && universalSearch) {
      const searchLower = universalSearch.toLowerCase();
      const matchesUniversalSearch = 
        invoice.patientName?.toLowerCase().includes(searchLower) ||
        String(invoice.id).toLowerCase().includes(searchLower) ||
        String(invoice.invoiceNumber || '').toLowerCase().includes(searchLower) ||
        String(invoice.patientId).toLowerCase().includes(searchLower) ||
        invoice.status?.toLowerCase().includes(searchLower) ||
        String(invoice.totalAmount).includes(searchLower) ||
        String(invoice.paidAmount).includes(searchLower) ||
        invoice.paymentMethod?.toLowerCase().includes(searchLower) ||
        invoice.insurance?.provider?.toLowerCase().includes(searchLower) ||
        invoice.insurance?.claimNumber?.toLowerCase().includes(searchLower) ||
        format(new Date(invoice.dateOfService), 'MMM d, yyyy').toLowerCase().includes(searchLower) ||
        format(new Date(invoice.dueDate), 'MMM d, yyyy').toLowerCase().includes(searchLower);
      
      if (!matchesUniversalSearch) return false;
    }
    
    // For non-doctors: Standard search by Invoice ID, Patient ID, or Patient Name
    const matchesSearch = !searchQuery || 
      invoice.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(invoice.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(invoice.patientId).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    
    // Filter by Service Date range - compare date only (ignore time)
    const invoiceServiceDate = new Date(invoice.dateOfService);
    const invoiceDateStr = invoiceServiceDate.toISOString().split('T')[0]; // Get YYYY-MM-DD
    const matchesServiceDateFrom = !serviceDateFrom || invoiceDateStr >= serviceDateFrom;
    
    // Filter by payment method for doctors
    const matchesPaymentMethod = paymentMethodFilter === "all" || 
      invoice.paymentMethod === paymentMethodFilter;
    
    // Filter by insurance provider for doctors
    const matchesInsuranceProvider = insuranceProviderFilter === "all" || 
      invoice.insurance?.provider === insuranceProviderFilter;
    
    // Filter by invoice ID
    const matchesInvoiceId = invoiceIdFilter === "all" || 
      String(invoice.invoiceNumber || invoice.id) === invoiceIdFilter;
    
    return matchesSearch && matchesStatus && matchesServiceDateFrom && matchesPaymentMethod && matchesInsuranceProvider && matchesInvoiceId;
  }) : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInsuranceStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'denied': return 'bg-red-100 text-red-800';
      case 'partially_paid': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const getTotalRevenue = () => {
    return Array.isArray(payments) ? payments.reduce((sum: number, payment: any) => {
      const amount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount;
      return sum + amount;
    }, 0) : 0;
  };

  const getOutstandingAmount = () => {
    // Calculate total from invoices table
    const totalInvoices = Array.isArray(invoices) ? invoices.reduce((sum: number, invoice: any) => {
      const amount = typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount) : invoice.totalAmount;
      return sum + amount;
    }, 0) : 0;
    
    // Calculate total from payments table
    const totalPayments = Array.isArray(payments) ? payments.reduce((sum: number, payment: any) => {
      const amount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount;
      return sum + amount;
    }, 0) : 0;
    
    // Outstanding = Invoices - Payments
    return totalInvoices - totalPayments;
  };

  // Calculate Revenue Breakdown from real data
  const getRevenueBreakdown = () => {
    if (!Array.isArray(invoices) || !Array.isArray(doctorsFees)) {
      return [];
    }

    // Get date range based on reportDateRange filter
    const currentDate = new Date();
    let startDate = new Date();
    let endDate = new Date();
    
    switch (reportDateRange) {
      case 'today':
        startDate = new Date(currentDate.setHours(0, 0, 0, 0));
        endDate = new Date(currentDate.setHours(23, 59, 59, 999));
        break;
      case 'this-week':
        const day = currentDate.getDay();
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - day);
        endDate = new Date();
        break;
      case 'this-month':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        break;
      case 'last-month':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
        break;
      case 'this-quarter':
        const quarter = Math.floor(currentDate.getMonth() / 3);
        startDate = new Date(currentDate.getFullYear(), quarter * 3, 1);
        endDate = new Date(currentDate.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'this-year':
        startDate = new Date(currentDate.getFullYear(), 0, 1);
        endDate = new Date(currentDate.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    }
    
    const filteredInvoices = invoices.filter((invoice: any) => {
      const invoiceDate = new Date(invoice.dateOfService);
      
      // Date range filter
      const matchesDateRange = invoiceDate >= startDate && invoiceDate <= endDate;
      
      // Insurance type filter
      const matchesInsurance = reportInsuranceType === 'all' || 
        invoice.insurance?.provider === reportInsuranceType ||
        (reportInsuranceType === 'Self-Pay' && (!invoice.insurance || !invoice.insurance.provider));
      
      // Role filter - find user ID from invoices (providerId or userId)
      let matchesRole = reportRole === 'all';
      if (reportRole !== 'all' && users && users.length > 0) {
        const invoiceUser = users.find((u: any) => 
          u.id === invoice.providerId || u.id === invoice.userId
        );
        matchesRole = invoiceUser?.role === reportRole;
      }
      
      // User name filter
      const matchesUser = reportUserName === 'all' || 
        invoice.providerId === parseInt(reportUserName) ||
        invoice.userId === parseInt(reportUserName);
      
      return matchesDateRange && matchesInsurance && matchesRole && matchesUser;
    });

    // Group invoices by service name from doctors fee table
    const serviceMap: Record<string, any> = {};

    filteredInvoices.forEach((invoice: any) => {
      // Try to match invoice service with doctors fee by service name or service type
      const matchingFee = doctorsFees.find((fee: any) => 
        fee.serviceName === invoice.serviceType || 
        fee.serviceName === invoice.serviceId
      );

      const serviceName = matchingFee?.serviceName || invoice.serviceType || 'Other Services';
      
      if (!serviceMap[serviceName]) {
        serviceMap[serviceName] = {
          serviceName,
          procedures: 0,
          revenue: 0,
          insurance: 0,
          selfPay: 0,
          totalAmount: 0,
          paidAmount: 0
        };
      }

      const amount = typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount) : invoice.totalAmount;
      const paid = typeof invoice.paidAmount === 'string' ? parseFloat(invoice.paidAmount) : invoice.paidAmount;
      
      serviceMap[serviceName].procedures += 1;
      serviceMap[serviceName].revenue += amount;
      serviceMap[serviceName].totalAmount += amount;
      serviceMap[serviceName].paidAmount += paid;

      // If insurance provider exists, count as insurance, otherwise self-pay
      if (invoice.insuranceProvider && invoice.insuranceProvider !== 'self-pay') {
        serviceMap[serviceName].insurance += amount;
      } else {
        serviceMap[serviceName].selfPay += amount;
      }
    });

    // Convert to array and calculate collection rate
    const breakdown = Object.values(serviceMap).map((service: any) => ({
      ...service,
      collectionRate: service.totalAmount > 0 
        ? Math.round((service.paidAmount / service.totalAmount) * 100)
        : 0
    }));

    // Calculate totals
    const totals = breakdown.reduce((acc, service) => ({
      serviceName: 'Total',
      procedures: acc.procedures + service.procedures,
      revenue: acc.revenue + service.revenue,
      insurance: acc.insurance + service.insurance,
      selfPay: acc.selfPay + service.selfPay,
      totalAmount: acc.totalAmount + service.totalAmount,
      paidAmount: acc.paidAmount + service.paidAmount,
      collectionRate: 0
    }), {
      serviceName: 'Total',
      procedures: 0,
      revenue: 0,
      insurance: 0,
      selfPay: 0,
      totalAmount: 0,
      paidAmount: 0,
      collectionRate: 0
    });

    totals.collectionRate = totals.totalAmount > 0 
      ? Math.round((totals.paidAmount / totals.totalAmount) * 100)
      : 0;

    return [...breakdown, totals];
  };

  // Export Revenue Breakdown as CSV
  const exportRevenueCSV = () => {
    const data = getRevenueBreakdown();
    
    if (data.length === 0) {
      toast({
        title: "No Data",
        description: "No revenue data available to export.",
        variant: "destructive"
      });
      return;
    }

    // Create CSV content
    const headers = ['Service Type', 'Procedures', 'Revenue', 'Insurance', 'Self-Pay', 'Collection Rate'];
    const csvContent = [
      headers.join(','),
      ...data.map(row => [
        `"${row.serviceName}"`,
        row.procedures,
        row.revenue.toFixed(2),
        row.insurance.toFixed(2),
        row.selfPay.toFixed(2),
        `${row.collectionRate}%`
      ].join(','))
    ].join('\n');

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `revenue-breakdown-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV Exported",
      description: "Revenue breakdown has been exported successfully.",
    });
  };

  // Build comprehensive report dataset with patient and insurance data
  const buildReportDataset = () => {
    // Get filtered invoices
    const currentDate = new Date();
    let startDate: Date, endDate: Date;
    
    switch(reportDateRange) {
      case 'this-week':
        const dayOfWeek = currentDate.getDay();
        startDate = new Date(currentDate);
        startDate.setDate(currentDate.getDate() - dayOfWeek);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'this-month':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        break;
      case 'this-quarter':
        const quarter = Math.floor(currentDate.getMonth() / 3);
        startDate = new Date(currentDate.getFullYear(), quarter * 3, 1);
        endDate = new Date(currentDate.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'this-year':
        startDate = new Date(currentDate.getFullYear(), 0, 1);
        endDate = new Date(currentDate.getFullYear(), 11, 31);
        break;
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    }
    
    // Create patient lookup map for insurance data
    const patientMap = new Map();
    if (patients && patients.length > 0) {
      patients.forEach((patient: any) => {
        patientMap.set(patient.patientId, {
          name: `${patient.firstName} ${patient.lastName}`,
          insurance: patient.insuranceProvider || 'Self-Pay',
          insuranceNumber: patient.insuranceNumber || 'N/A',
          phone: patient.phoneNumber || 'N/A',
          email: patient.email || 'N/A'
        });
      });
    }
    
    // Filter invoices based on all criteria
    const filteredInvoices = invoices.filter((invoice: any) => {
      const invoiceDate = new Date(invoice.dateOfService);
      const matchesDateRange = invoiceDate >= startDate && invoiceDate <= endDate;
      
      // Insurance type filter - check both invoice insurance and patient insurance
      let matchesInsurance = reportInsuranceType === 'all';
      if (reportInsuranceType !== 'all') {
        const patientInfo = patientMap.get(invoice.patientId);
        const invoiceInsurance = invoice.insurance?.provider || invoice.insuranceProvider;
        const patientInsurance = patientInfo?.insurance;
        
        if (reportInsuranceType === 'Self-Pay') {
          matchesInsurance = (!invoiceInsurance || invoiceInsurance === 'self-pay' || invoiceInsurance === 'Self-Pay') &&
                            (!patientInsurance || patientInsurance === 'Self-Pay');
        } else {
          matchesInsurance = invoiceInsurance === reportInsuranceType || patientInsurance === reportInsuranceType;
        }
      }
      
      // Role filter
      let matchesRole = reportRole === 'all';
      if (reportRole !== 'all' && users && users.length > 0) {
        const invoiceUser = users.find((u: any) => u.id === invoice.providerId || u.id === invoice.userId);
        matchesRole = invoiceUser?.role === reportRole;
      }
      
      // User name filter
      const matchesUser = reportUserName === 'all' || 
        invoice.providerId === parseInt(reportUserName) ||
        invoice.userId === parseInt(reportUserName);
      
      return matchesDateRange && matchesInsurance && matchesRole && matchesUser;
    });
    
    // Get patient information if specific patient selected
    let selectedPatientInfo = null;
    if (reportUserName !== 'all' && reportRole === 'patient') {
      const selectedUser = users.find((u: any) => String(u.id) === reportUserName);
      if (selectedUser && filteredInvoices.length > 0) {
        const patientId = filteredInvoices[0].patientId;
        const patientData = patientMap.get(patientId);
        selectedPatientInfo = {
          name: `${selectedUser.firstName} ${selectedUser.lastName}`,
          patientId: patientId,
          insurance: patientData?.insurance || 'Self-Pay',
          insuranceNumber: patientData?.insuranceNumber || 'N/A',
          phone: patientData?.phone || 'N/A',
          email: patientData?.email || selectedUser.email || 'N/A'
        };
      }
    }
    
    // Group invoices by service type with detailed information
    const invoicesByService: Record<string, any> = {};
    
    filteredInvoices.forEach((invoice: any) => {
      const matchingFee = doctorsFees.find((fee: any) => 
        fee.serviceName === invoice.serviceType || fee.serviceName === invoice.serviceId
      );
      const serviceName = matchingFee?.serviceName || invoice.serviceType || 'Other Services';
      
      if (!invoicesByService[serviceName]) {
        invoicesByService[serviceName] = {
          serviceName,
          procedures: 0,
          revenue: 0,
          insurance: 0,
          selfPay: 0,
          totalAmount: 0,
          paidAmount: 0,
          invoices: []
        };
      }
      
      const amount = typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount) : invoice.totalAmount;
      const paid = typeof invoice.paidAmount === 'string' ? parseFloat(invoice.paidAmount) : invoice.paidAmount;
      const patientInfo = patientMap.get(invoice.patientId);
      
      invoicesByService[serviceName].procedures += 1;
      invoicesByService[serviceName].revenue += amount;
      invoicesByService[serviceName].totalAmount += amount;
      invoicesByService[serviceName].paidAmount += paid;
      
      if (invoice.insuranceProvider && invoice.insuranceProvider !== 'self-pay') {
        invoicesByService[serviceName].insurance += amount;
      } else {
        invoicesByService[serviceName].selfPay += amount;
      }
      
      // Add detailed invoice info
      invoicesByService[serviceName].invoices.push({
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.dateOfService,
        patientName: invoice.patientName,
        patientInsurance: patientInfo?.insurance || 'Self-Pay',
        amount: amount,
        paid: paid,
        status: invoice.status
      });
    });
    
    return {
      patientInfo: selectedPatientInfo,
      invoicesByService,
      dateRange: { start: startDate, end: endDate },
      filters: {
        insuranceType: reportInsuranceType,
        role: reportRole,
        userName: reportUserName
      }
    };
  };

  // Export Revenue Breakdown as PDF with Professional Layout
  const exportRevenuePDF = () => {
    const reportData = buildReportDataset();
    const data = getRevenueBreakdown();
    
    if (data.length === 0) {
      toast({
        title: "No Data",
        description: "No revenue data available to export.",
        variant: "destructive"
      });
      return;
    }

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Cura Brand Colors
    const primaryColor = '#4A7DFF'; // Bluewave
    const accentColor = '#6CFFEB'; // Mint Drift
    const darkGray = '#1F2937';
    const lightGray = '#F3F4F6';
    
    // Helper function to add page footer
    const addFooter = (pageNum: number) => {
      const footerY = pageHeight - 15;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, 14, footerY);
      pdf.text(`Page ${pageNum}`, pageWidth - 30, footerY);
      pdf.text('Cura EMR - Confidential', pageWidth / 2, footerY, { align: 'center' });
    };
    
    let currentPage = 1;
    let yPos = 15;
    
    // ===== HEADER SECTION WITH BRANDING =====
    // Blue header band
    pdf.setFillColor(74, 125, 255); // Primary color
    pdf.rect(0, 0, pageWidth, 35, 'F');
    
    // Company name and report title
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CURA EMR', 14, 15);
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Custom Revenue Report', 14, 25);
    
    // Report date on right side of header
    pdf.setFontSize(10);
    pdf.text(`Report Period`, pageWidth - 14, 15, { align: 'right' });
    pdf.text(`${format(reportData.dateRange.start, 'MMM d, yyyy')} - ${format(reportData.dateRange.end, 'MMM d, yyyy')}`, pageWidth - 14, 22, { align: 'right' });
    
    // Reset text color
    pdf.setTextColor(0, 0, 0);
    yPos = 45;
    
    // ===== EXECUTIVE SUMMARY SECTION =====
    // Calculate summary metrics
    const totalRow = data.find(row => row.serviceName === 'Total');
    const totalRevenue = totalRow ? totalRow.revenue : 0;
    const totalInsurance = totalRow ? totalRow.insurance : 0;
    const totalSelfPay = totalRow ? totalRow.selfPay : 0;
    const avgCollectionRate = totalRow ? totalRow.collectionRate : 0;
    const totalProcedures = totalRow ? totalRow.procedures : 0;
    
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(31, 41, 55);
    pdf.text('EXECUTIVE SUMMARY', 14, yPos);
    yPos += 8;
    
    // Summary boxes
    const boxWidth = (pageWidth - 40) / 4;
    const boxHeight = 22;
    const boxY = yPos;
    
    // Box 1: Total Revenue
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(14, boxY, boxWidth, boxHeight, 2, 2, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Total Revenue', 14 + boxWidth/2, boxY + 6, { align: 'center' });
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(74, 125, 255);
    pdf.text(`£${totalRevenue.toFixed(2)}`, 14 + boxWidth/2, boxY + 15, { align: 'center' });
    
    // Box 2: Procedures
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(14 + boxWidth + 3, boxY, boxWidth, boxHeight, 2, 2, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Total Procedures', 14 + boxWidth*1.5 + 3, boxY + 6, { align: 'center' });
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(74, 125, 255);
    pdf.text(String(totalProcedures), 14 + boxWidth*1.5 + 3, boxY + 15, { align: 'center' });
    
    // Box 3: Insurance Revenue
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(14 + boxWidth*2 + 6, boxY, boxWidth, boxHeight, 2, 2, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Insurance', 14 + boxWidth*2.5 + 6, boxY + 6, { align: 'center' });
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(108, 255, 235);
    pdf.text(`£${totalInsurance.toFixed(2)}`, 14 + boxWidth*2.5 + 6, boxY + 15, { align: 'center' });
    
    // Box 4: Collection Rate
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(14 + boxWidth*3 + 9, boxY, boxWidth, boxHeight, 2, 2, 'F');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Collection Rate', 14 + boxWidth*3.5 + 9, boxY + 6, { align: 'center' });
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(67, 160, 71);
    pdf.text(`${avgCollectionRate}%`, 14 + boxWidth*3.5 + 9, boxY + 15, { align: 'center' });
    
    yPos = boxY + boxHeight + 15;
    
    // ===== PATIENT INFORMATION SECTION =====
    if (reportData.patientInfo) {
      pdf.setFillColor(239, 246, 255);
      pdf.roundedRect(14, yPos, pageWidth - 28, 35, 2, 2, 'F');
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 41, 55);
      pdf.text('PATIENT INFORMATION', 20, yPos + 8);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);
      
      const col1X = 20;
      const col2X = pageWidth / 2 + 10;
      let infoY = yPos + 16;
      
      pdf.setFont('helvetica', 'bold');
      pdf.text('Name:', col1X, infoY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportData.patientInfo.name, col1X + 25, infoY);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text('Patient ID:', col2X, infoY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportData.patientInfo.patientId, col2X + 25, infoY);
      
      infoY += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Insurance:', col1X, infoY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportData.patientInfo.insurance, col1X + 25, infoY);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text('Policy #:', col2X, infoY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportData.patientInfo.insuranceNumber, col2X + 25, infoY);
      
      infoY += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Phone:', col1X, infoY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportData.patientInfo.phone, col1X + 25, infoY);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text('Email:', col2X, infoY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(reportData.patientInfo.email, col2X + 25, infoY);
      
      yPos += 45;
    }
    
    // ===== APPLIED FILTERS SECTION =====
    const hasFilters = reportInsuranceType !== 'all' || reportRole !== 'all' || (reportUserName !== 'all' && !reportData.patientInfo);
    if (hasFilters) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 41, 55);
      pdf.text('Applied Filters:', 14, yPos);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 60, 60);
      let filterText = [];
      if (reportInsuranceType !== 'all') filterText.push(`Insurance: ${reportInsuranceType}`);
      if (reportRole !== 'all') filterText.push(`Role: ${reportRole}`);
      if (reportUserName !== 'all' && !reportData.patientInfo) {
        const userName = users.find((u: any) => String(u.id) === reportUserName);
        if (userName) filterText.push(`User: ${userName.firstName} ${userName.lastName}`);
      }
      pdf.text(filterText.join(' • '), 14, yPos + 6);
      yPos += 15;
    }
    
    // ===== REVENUE BREAKDOWN TABLE =====
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(31, 41, 55);
    pdf.text('REVENUE BREAKDOWN BY SERVICE TYPE', 14, yPos);
    yPos += 5;
    
    // Prepare table data
    const tableData = data.map(row => [
      row.serviceName,
      String(row.procedures),
      `£${row.revenue.toFixed(2)}`,
      `£${row.insurance.toFixed(2)}`,
      `£${row.selfPay.toFixed(2)}`,
      `${row.collectionRate}%`
    ]);
    
    // Use autoTable for professional table layout
    autoTable(pdf, {
      startY: yPos,
      head: [['Service Type', 'Count', 'Total Revenue', 'Insurance', 'Self-Pay', 'Collection Rate']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [74, 125, 255],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [31, 41, 55]
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 28 },
        3: { halign: 'right', cellWidth: 28 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'center', cellWidth: 24 }
      },
      didParseCell: function(data) {
        // Bold and highlight the Total row
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [229, 231, 235];
          data.cell.styles.textColor = [31, 41, 55];
        }
      },
      margin: { left: 14, right: 14 },
      didDrawPage: function(data) {
        addFooter(currentPage);
        currentPage++;
      }
    });
    
    // Add footer to first page if table didn't span multiple pages
    if (currentPage === 1) {
      addFooter(1);
    }
    
    // Save the PDF
    const fileName = reportData.patientInfo 
      ? `patient-report-${reportData.patientInfo.patientId}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
      : `revenue-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    pdf.save(fileName);

    toast({
      title: "Report Generated",
      description: "Professional revenue report has been downloaded successfully.",
    });
  };

  if (invoicesLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <Header 
        title="Billing & Payments" 
        subtitle="Manage invoices, payments, and insurance claims"
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
            {/* Quick Stats - Admin Only */}
            {isAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Revenue</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(getTotalRevenue())}</p>
                      </div>
                      <PoundSterling className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Outstanding</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(getOutstandingAmount())}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Overdue Invoices</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">2</p>
                      </div>
                      <Clock className="h-8 w-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">This Month</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">24</p>
                      </div>
                      <CalendarDays className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Patient View: Direct Invoice List */}
            {!isAdmin ? (
              <div className="space-y-4">
                {/* Filters and Actions */}
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {user?.role === 'doctor' ? (
                            <SearchComboBox
                              value={universalSearch}
                              onValueChange={setUniversalSearch}
                              placeholder="Search all invoice fields..."
                              className="w-80"
                              testId="input-universal-search"
                            />
                          ) : (
                            <SearchComboBox
                              value={searchQuery}
                              onValueChange={setSearchQuery}
                              placeholder="Search by Invoice ID, Patient ID or Name..."
                              className="w-80"
                              testId="input-search-invoices"
                            />
                          )}
                          
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-40" data-testid="select-status-filter">
                              <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Status</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>

                          <Popover open={invoiceSearchOpen} onOpenChange={setInvoiceSearchOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={invoiceSearchOpen}
                                className="w-64 justify-between"
                                data-testid="select-invoice-filter"
                              >
                                {invoiceIdFilter === "all" 
                                  ? "Filter by Invoice Number..." 
                                  : displayInvoices?.find((inv: any) => 
                                      String(inv.invoiceNumber || inv.id) === invoiceIdFilter
                                    )?.invoiceNumber || invoiceIdFilter
                                }
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-0">
                              <Command>
                                <CommandInput 
                                  placeholder="Search invoice number..." 
                                  value={invoiceSearch}
                                  onValueChange={setInvoiceSearch}
                                />
                                <CommandEmpty>No invoice found.</CommandEmpty>
                                <CommandGroup className="max-h-64 overflow-auto">
                                  <CommandItem
                                    value="all"
                                    onSelect={() => {
                                      setInvoiceIdFilter("all");
                                      setInvoiceSearchOpen(false);
                                      setInvoiceSearch("");
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        invoiceIdFilter === "all" ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    All Invoices
                                  </CommandItem>
                                  {Array.isArray(displayInvoices) && displayInvoices
                                    .filter((inv: any) => {
                                      const invoiceNumber = inv.invoiceNumber || `INV-${inv.id}`;
                                      return invoiceNumber.toLowerCase().includes(invoiceSearch.toLowerCase());
                                    })
                                    .map((inv: any) => {
                                      const invoiceNumber = inv.invoiceNumber || `INV-${inv.id}`;
                                      const invoiceValue = String(inv.invoiceNumber || inv.id);
                                      return (
                                        <CommandItem
                                          key={inv.id}
                                          value={invoiceNumber}
                                          onSelect={() => {
                                            setInvoiceIdFilter(invoiceValue);
                                            setInvoiceSearchOpen(false);
                                            setInvoiceSearch("");
                                          }}
                                        >
                                          <Check
                                            className={`mr-2 h-4 w-4 ${
                                              invoiceIdFilter === invoiceValue ? "opacity-100" : "opacity-0"
                                            }`}
                                          />
                                          {invoiceNumber}
                                        </CommandItem>
                                      );
                                    })
                                  }
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>

                          {canShowNewInvoiceButton && (
                            <Button onClick={() => setShowNewInvoice(true)} className="ml-auto flex items-center gap-2">
                              <Plus className="h-4 w-4" />
                              New Invoice
                            </Button>
                          )}

                          {user?.role === 'doctor' && (
                            <>
                              <Select value={insuranceProviderFilter} onValueChange={setInsuranceProviderFilter}>
                                <SelectTrigger className="w-52" data-testid="select-insurance-provider-filter">
                                  <SelectValue placeholder="Insurance Provider" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">None (Patient Self-Pay)</SelectItem>
                                  <SelectItem value="NHS">NHS (National Health Service)</SelectItem>
                                  <SelectItem value="Bupa">Bupa</SelectItem>
                                  <SelectItem value="AXA PPP Healthcare">AXA PPP Healthcare</SelectItem>
                                  <SelectItem value="Vitality Health">Vitality Health</SelectItem>
                                  <SelectItem value="Aviva Health">Aviva Health</SelectItem>
                                  <SelectItem value="Simply Health">Simply Health</SelectItem>
                                  <SelectItem value="WPA">WPA</SelectItem>
                                  <SelectItem value="Benenden Health">Benenden Health</SelectItem>
                                  <SelectItem value="Healix Health Services">Healix Health Services</SelectItem>
                                  <SelectItem value="Sovereign Health Care">Sovereign Health Care</SelectItem>
                                  <SelectItem value="Exeter Friendly Society">Exeter Friendly Society</SelectItem>
                                  <SelectItem value="Self-Pay">Self-Pay</SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                              </Select>

                              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                                <SelectTrigger className="w-48" data-testid="select-payment-method-filter">
                                  <SelectValue placeholder="Select payment method" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Payment Methods</SelectItem>
                                  <SelectItem value="Cash">Cash</SelectItem>
                                  <SelectItem value="Debit Card">Debit Card</SelectItem>
                                  <SelectItem value="Credit Card">Credit Card</SelectItem>
                                  <SelectItem value="Insurance">Insurance</SelectItem>
                                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                  <SelectItem value="Check">Check</SelectItem>
                                  <SelectItem value="Online Payment">Online Payment</SelectItem>
                                </SelectContent>
                              </Select>
                            </>
                          )}

                          <div className="flex flex-col gap-1">
                            <Label htmlFor="service-date-from" className="text-xs text-gray-600 dark:text-gray-400">Service Date From</Label>
                            <Input
                              id="service-date-from"
                              type="date"
                              value={serviceDateFrom}
                              onChange={(e) => setServiceDateFrom(e.target.value)}
                              className="h-9 text-sm w-44"
                              data-testid="input-service-date-from"
                            />
                          </div>

                          {(serviceDateFrom || invoiceIdFilter !== "all" || (user?.role === 'doctor' && (insuranceProviderFilter !== 'all' || paymentMethodFilter !== 'all' || universalSearch))) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setServiceDateFrom("");
                                setInvoiceIdFilter("all");
                                if (user?.role === 'doctor') {
                                  setInsuranceProviderFilter('all');
                                  setPaymentMethodFilter('all');
                                  setUniversalSearch('');
                                }
                              }}
                              data-testid="button-clear-filters"
                              className="mt-5"
                            >
                              <Filter className="h-4 w-4 mr-2" />
                              Clear
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Label htmlFor="list-view-toggle" className="text-sm font-medium text-gray-700 dark:text-gray-300">List View</Label>
                          <Switch 
                            id="list-view-toggle"
                            checked={isListView} 
                            onCheckedChange={setIsListView}
                            data-testid="switch-list-view"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Doctor-specific category tabs (for non-admin doctors) */}
                {user?.role === 'doctor' && (
                  <Card>
                    <CardContent className="p-4">
                      <Tabs value={doctorInvoiceTab} onValueChange={(value) => setDoctorInvoiceTab(value as any)} className="w-full">
                        <TabsList className="grid w-full grid-cols-4 gap-1">
                          <TabsTrigger value="overall" data-testid="tab-doctor-overall">
                            Overall
                            {doctorInvoices && (
                              <Badge variant="secondary" className="ml-2">
                                {doctorInvoices.overall?.length || 0}
                              </Badge>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="appointments" data-testid="tab-doctor-appointments">
                            Appointments
                            {doctorInvoices && (
                              <Badge variant="secondary" className="ml-2">
                                {doctorInvoices.appointments?.length || 0}
                              </Badge>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="labResults" data-testid="tab-doctor-lab-results">
                            Lab Results
                            {doctorInvoices && (
                              <Badge variant="secondary" className="ml-2">
                                {doctorInvoices.labResults?.length || 0}
                              </Badge>
                            )}
                          </TabsTrigger>
                          <TabsTrigger value="imaging" data-testid="tab-doctor-imaging">
                            Imaging
                            {doctorInvoices && (
                              <Badge variant="secondary" className="ml-2">
                                {doctorInvoices.imaging?.length || 0}
                              </Badge>
                            )}
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </CardContent>
                  </Card>
                )}

                {/* Invoices List */}
                {isListView ? (
                  /* List View - Table Format */
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Invoice No.</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Patient Name</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Payment Method</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Service Type</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Service ID</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Service Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Outstanding</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredInvoices.map((invoice) => (
                              <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-slate-800" data-testid={`invoice-row-${invoice.id}`}>
                                <td 
                                  className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:text-primary hover:underline" 
                                  onClick={() => {
                                    const invoiceNum = invoice.invoiceNumber || invoice.id;
                                    
                                    if (user?.role === 'doctor') {
                                      setUniversalSearch(String(invoiceNum));
                                    } else {
                                      setSearchQuery(String(invoiceNum));
                                    }
                                  }}
                                  title="Click to search this invoice"
                                  data-testid="button-invoice-number-list"
                                >
                                  {invoice.invoiceNumber || invoice.id}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">{invoice.patientName}</td>
                                <td className="px-4 py-4 text-sm">
                                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                    {invoice.paymentMethod || 'N/A'}
                                  </Badge>
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                                  {invoice.serviceType || invoice.serviceName || invoice.items?.[0]?.description || '-'}
                                </td>
                                <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">{invoice.serviceId || '-'}</td>
                                <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">{format(new Date(invoice.dateOfService), 'MMM d, yyyy')}</td>
                                <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">{format(new Date(invoice.dueDate), 'MMM d, yyyy')}</td>
                                <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(invoice.totalAmount)}</td>
                                <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(invoice.totalAmount - invoice.paidAmount)}</td>
                                <td className="px-4 py-4 text-sm">
                                  {user?.role === 'patient' ? (
                                    <Badge className={`${getStatusColor(invoice.status)}`}>
                                      {invoice.status}
                                    </Badge>
                                  ) : (
                                    <Select 
                                      value={invoice.status} 
                                      onValueChange={(value) => handleInlineStatusUpdate(invoice.id, value)}
                                      disabled={updatingStatusId === invoice.id}
                                    >
                                      <SelectTrigger className={`w-32 h-8 text-xs ${getStatusColor(invoice.status)}`}>
                                        <SelectValue>{invoice.status}</SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="sent">Sent</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="overdue">Overdue</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                </td>
                                <td className="px-4 py-4 text-sm">
                                  <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(invoice)} data-testid="button-view-invoice" title="View">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    {savedInvoiceIds.has(invoice.id) && (
                                      <>
                                        <Button variant="ghost" size="sm" onClick={() => handleDownloadInvoice(invoice.id.toString())} data-testid="button-download-invoice" title="Download">
                                          <Download className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleSendInvoice(invoice.id)} data-testid="button-send-invoice" title="Send">
                                          <Send className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    {!isAdmin && invoice.status !== 'draft' && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                                      <Button 
                                        variant="default" 
                                        size="sm" 
                                        onClick={() => handlePayNow(invoice)}
                                        data-testid="button-pay-now"
                                        style={{ 
                                          backgroundColor: '#4A7DFF',
                                          color: 'white'
                                        }}
                                        title="Pay Now"
                                      >
                                        <CreditCard className="h-4 w-4 mr-1" />
                                        Pay
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  /* Grid View - Card Format */
                  <div className="space-y-4">
                    {filteredInvoices.map((invoice) => (
                      <Card key={invoice.id} className="hover:shadow-md transition-shadow" data-testid={`invoice-card-${invoice.id}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{invoice.patientName}</h3>
                                {user?.role === 'patient' ? (
                                  <Badge className={`${getStatusColor(invoice.status)} px-3 py-1`}>
                                    {invoice.status}
                                  </Badge>
                                ) : (
                                  <Select 
                                    value={invoice.status} 
                                    onValueChange={(value) => handleInlineStatusUpdate(invoice.id, value)}
                                    disabled={updatingStatusId === invoice.id}
                                  >
                                    <SelectTrigger className={`w-32 h-7 text-xs ${getStatusColor(invoice.status)}`}>
                                      <SelectValue>{invoice.status}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="draft">Draft</SelectItem>
                                      <SelectItem value="sent">Sent</SelectItem>
                                      <SelectItem value="paid">Paid</SelectItem>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="overdue">Overdue</SelectItem>
                                      <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                                {invoice.status === 'overdue' && (
                                  <Badge className="bg-red-100 text-red-800">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Overdue
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                                <div>
                                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Invoice Details</h4>
                                  <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                                    <div>
                                      <strong>Invoice:</strong>{' '}
                                      <button
                                        type="button"
                                        className="font-medium cursor-pointer hover:text-primary hover:underline inline-block"
                                        onClick={() => {
                                          const invoiceNum = invoice.invoiceNumber || invoice.id;
                                          
                                          if (user?.role === 'doctor') {
                                            setUniversalSearch(String(invoiceNum));
                                          } else {
                                            setSearchQuery(String(invoiceNum));
                                          }
                                        }}
                                        title="Click to search this invoice"
                                        data-testid="button-invoice-number-grid"
                                      >
                                        {invoice.invoiceNumber || invoice.id}
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <strong>Payment Method:</strong>
                                      <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                        {invoice.paymentMethod || 'N/A'}
                                      </Badge>
                                    </div>
                                    <div><strong>Service Date:</strong> {format(new Date(invoice.dateOfService), 'MMM d, yyyy')}</div>
                                    <div><strong>Due Date:</strong> {format(new Date(invoice.dueDate), 'MMM d, yyyy')}</div>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Amount</h4>
                                  <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                                    <div><strong>Total:</strong> {formatCurrency(invoice.totalAmount)}</div>
                                    <div><strong>Paid:</strong> {formatCurrency(invoice.paidAmount)}</div>
                                    <div><strong>Outstanding:</strong> {formatCurrency(invoice.totalAmount - invoice.paidAmount)}</div>
                                  </div>
                                </div>
                                
                                {invoice.insurance && (
                                  <div>
                                    <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Insurance</h4>
                                    <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                                      <div><strong>Provider:</strong> {invoice.insurance.provider}</div>
                                      <div><strong>Claim:</strong> {invoice.insurance.claimNumber}</div>
                                      <div className="flex items-center gap-2">
                                        <strong>Status:</strong>
                                        <Badge className={getInsuranceStatusColor(invoice.insurance.status)}>
                                          {invoice.insurance.status}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                                <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Services</h4>
                                <div className="space-y-1">
                                  {invoice.items.slice(0, 2).map((item: any, index: number) => (
                                    <div key={index} className="flex justify-between text-sm text-gray-900 dark:text-gray-100">
                                      <span>{item.description}</span>
                                      <span>{formatCurrency(item.total || item.amount || item.unitPrice || 0)}</span>
                                    </div>
                                  ))}
                                  {invoice.items.length > 2 && (
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      +{invoice.items.length - 2} more items
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 ml-4">
                              <Button variant="outline" size="sm" onClick={() => handleViewInvoice(invoice)} data-testid="button-view-invoice">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {savedInvoiceIds.has(invoice.id) && (
                                <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice(invoice.id.toString())} data-testid="button-download-invoice">
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                              {!isAdmin && invoice.status !== 'draft' && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                                <Button 
                                  variant="default" 
                                  size="sm" 
                                  onClick={() => handlePayNow(invoice)}
                                  data-testid="button-pay-now"
                                  style={{ 
                                    backgroundColor: '#4A7DFF',
                                    color: 'white',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '0.5rem 1rem',
                                    minWidth: '100px'
                                  }}
                                >
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Pay Now
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {filteredInvoices.length === 0 && (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400" data-testid="no-invoices-message">
                    <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No invoices found</h3>
                    <p className="text-gray-600 dark:text-gray-300">Try adjusting your search terms or filters</p>
                  </div>
                )}
              </div>
            ) : (
              /* Admin View: Tabs Navigation */
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 lg:grid-cols-6 gap-1">
                  <TabsTrigger value="invoices">Invoices</TabsTrigger>
                  <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
                  <TabsTrigger value="payment-history">Payment History</TabsTrigger>
                  <TabsTrigger value="insurance-claims">Insurance Claims</TabsTrigger>
                  <TabsTrigger value="custom-reports">Custom Reports</TabsTrigger>
                  {isAdmin && <TabsTrigger value="pricing-management">Pricing Management</TabsTrigger>}
                </TabsList>

                <TabsContent value="invoices" className="space-y-4 mt-6">
                  {/* Filters and Actions */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <SearchComboBox
                              value={searchQuery}
                              onValueChange={setSearchQuery}
                              placeholder="Search by Invoice ID, Patient ID or Name..."
                              className="w-80"
                              testId="input-search-invoices-doctor-fees"
                            />
                            
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Filter by status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="overdue">Overdue</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>

                            {user?.role === 'doctor' && (
                              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                                <SelectTrigger className="w-52">
                                  <SelectValue placeholder="Filter by payment method" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Payment Methods</SelectItem>
                                  <SelectItem value="None (Patient Self-Pay)">None (Patient Self-Pay)</SelectItem>
                                  <SelectItem value="NHS (National Health Service)">NHS (National Health Service)</SelectItem>
                                  <SelectItem value="Bupa">Bupa</SelectItem>
                                  <SelectItem value="AXA PPP Healthcare">AXA PPP Healthcare</SelectItem>
                                  <SelectItem value="Vitality Health">Vitality Health</SelectItem>
                                  <SelectItem value="Aviva Health">Aviva Health</SelectItem>
                                  <SelectItem value="Simply Health">Simply Health</SelectItem>
                                  <SelectItem value="WPA">WPA</SelectItem>
                                  <SelectItem value="Benenden Health">Benenden Health</SelectItem>
                                  <SelectItem value="Healix Health Services">Healix Health Services</SelectItem>
                                  <SelectItem value="Sovereign Health Care">Sovereign Health Care</SelectItem>
                                  <SelectItem value="Exeter Friendly Society">Exeter Friendly Society</SelectItem>
                                  <SelectItem value="Self-Pay">Self-Pay</SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            )}

                            <div className="flex flex-col gap-1">
                              <Label htmlFor="admin-service-date-from" className="text-xs text-gray-600 dark:text-gray-400">Service Date From</Label>
                              <Input
                                id="admin-service-date-from"
                                type="date"
                                value={serviceDateFrom}
                                onChange={(e) => setServiceDateFrom(e.target.value)}
                                className="h-9 text-sm w-44"
                                data-testid="input-admin-service-date-from"
                              />
                            </div>

                            {serviceDateFrom && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setServiceDateFrom("")}
                                data-testid="button-admin-clear-filters"
                                className="mt-5"
                              >
                                <Filter className="h-4 w-4 mr-2" />
                                Clear
                              </Button>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Label htmlFor="admin-list-view-toggle" className="text-sm font-medium text-gray-700 dark:text-gray-300">List View</Label>
                              <Switch 
                                id="admin-list-view-toggle"
                                checked={isListView} 
                                onCheckedChange={setIsListView}
                                data-testid="switch-admin-list-view"
                              />
                            </div>
                            <div className="ml-auto">
                              {canShowNewInvoiceButton && (
                                <Button onClick={() => setShowNewInvoice(true)}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  New Invoice
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Doctor-specific category tabs */}
                  {user?.role === 'doctor' && (
                    <Card>
                      <CardContent className="p-4">
                        <Tabs value={doctorInvoiceTab} onValueChange={(value) => setDoctorInvoiceTab(value as any)} className="w-full">
                          <TabsList className="grid w-full grid-cols-4 gap-1">
                            <TabsTrigger value="overall" data-testid="tab-doctor-overall">
                              Overall
                              {doctorInvoices && (
                                <Badge variant="secondary" className="ml-2">
                                  {doctorInvoices.overall?.length || 0}
                                </Badge>
                              )}
                            </TabsTrigger>
                            <TabsTrigger value="appointments" data-testid="tab-doctor-appointments">
                              Appointments
                              {doctorInvoices && (
                                <Badge variant="secondary" className="ml-2">
                                  {doctorInvoices.appointments?.length || 0}
                                </Badge>
                              )}
                            </TabsTrigger>
                            <TabsTrigger value="labResults" data-testid="tab-doctor-lab-results">
                              Lab Results
                              {doctorInvoices && (
                                <Badge variant="secondary" className="ml-2">
                                  {doctorInvoices.labResults?.length || 0}
                                </Badge>
                              )}
                            </TabsTrigger>
                            <TabsTrigger value="imaging" data-testid="tab-doctor-imaging">
                              Imaging
                              {doctorInvoices && (
                                <Badge variant="secondary" className="ml-2">
                                  {doctorInvoices.imaging?.length || 0}
                                </Badge>
                              )}
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </CardContent>
                    </Card>
                  )}

                  {/* Invoices List */}
                  {isListView ? (
                    /* List View - Table Format */
                    <Card>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Invoice No.</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Patient Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Payment Method</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Service Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Outstanding</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700">
                              {filteredInvoices.map((invoice) => (
                                <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-slate-800" data-testid={`invoice-row-${invoice.id}`}>
                                  <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{invoice.invoiceNumber || invoice.id}</td>
                                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">{invoice.patientName}</td>
                                  <td className="px-4 py-4 text-sm">
                                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                      {invoice.paymentMethod || 'N/A'}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">{format(new Date(invoice.dateOfService), 'MMM d, yyyy')}</td>
                                  <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">{format(new Date(invoice.dueDate), 'MMM d, yyyy')}</td>
                                  <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(invoice.totalAmount)}</td>
                                  <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(invoice.totalAmount - invoice.paidAmount)}</td>
                                  <td className="px-4 py-4 text-sm">
                                    {isAdmin ? (
                                      <Select 
                                        value={invoice.status} 
                                        onValueChange={(value) => handleInlineStatusUpdate(invoice.id, value)}
                                        disabled={updatingStatusId === invoice.id}
                                      >
                                        <SelectTrigger className={`w-32 h-8 text-xs ${getStatusColor(invoice.status)}`}>
                                          <SelectValue>{invoice.status}</SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="draft">Draft</SelectItem>
                                          <SelectItem value="sent">Sent</SelectItem>
                                          <SelectItem value="paid">Paid</SelectItem>
                                          <SelectItem value="pending">Pending</SelectItem>
                                          <SelectItem value="overdue">Overdue</SelectItem>
                                          <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Badge className={`${getStatusColor(invoice.status)}`}>
                                        {invoice.status}
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="px-4 py-4 text-sm">
                                    <div className="flex items-center gap-2">
                                      <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(invoice)} title="View">
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      {savedInvoiceIds.has(invoice.id) && (
                                        <>
                                          <Button variant="ghost" size="sm" onClick={() => handleDownloadInvoice(invoice.id.toString())} title="Download">
                                            <Download className="h-4 w-4" />
                                          </Button>
                                          <Button variant="ghost" size="sm" onClick={() => handleSendInvoice(invoice.id)} title="Send">
                                            <Send className="h-4 w-4" />
                                          </Button>
                                        </>
                                      )}
                                      {canDelete('billing') && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => handleDeleteInvoice(invoice.id)}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                          title="Delete"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    /* Grid View - Card Format */
                    <div className="space-y-4">
                      {filteredInvoices.map((invoice) => (
                        <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{invoice.patientName}</h3>
                                  {isAdmin ? (
                                    <Select 
                                      value={invoice.status} 
                                      onValueChange={(value) => handleInlineStatusUpdate(invoice.id, value)}
                                      disabled={updatingStatusId === invoice.id}
                                    >
                                      <SelectTrigger className={`w-32 h-7 text-xs ${getStatusColor(invoice.status)}`}>
                                        <SelectValue>{invoice.status}</SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="sent">Sent</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="overdue">Overdue</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Badge className={getStatusColor(invoice.status)}>
                                      {invoice.status}
                                    </Badge>
                                  )}
                                  {invoice.status === 'overdue' && (
                                    <Badge className="bg-red-100 text-red-800">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Overdue
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                                  <div>
                                    <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Invoice Details</h4>
                                    <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                                      <div><strong>Invoice:</strong> {invoice.invoiceNumber || invoice.id}</div>
                                      <div className="flex items-center gap-2">
                                        <strong>Payment Method:</strong>
                                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700">
                                          {invoice.paymentMethod || 'N/A'}
                                        </Badge>
                                      </div>
                                      <div><strong>Service Date:</strong> {format(new Date(invoice.dateOfService), 'MMM d, yyyy')}</div>
                                      <div><strong>Due Date:</strong> {format(new Date(invoice.dueDate), 'MMM d, yyyy')}</div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Amount</h4>
                                    <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                                      <div><strong>Total:</strong> {formatCurrency(invoice.totalAmount)}</div>
                                      <div><strong>Paid:</strong> {formatCurrency(invoice.paidAmount)}</div>
                                      <div><strong>Outstanding:</strong> {formatCurrency(invoice.totalAmount - invoice.paidAmount)}</div>
                                    </div>
                                  </div>
                                  
                                  {invoice.insurance && (
                                    <div>
                                      <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Insurance</h4>
                                      <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                                        <div><strong>Provider:</strong> {invoice.insurance.provider}</div>
                                        <div><strong>Claim:</strong> {invoice.insurance.claimNumber}</div>
                                        <div className="flex items-center gap-2">
                                          <strong>Status:</strong>
                                          <Badge className={getInsuranceStatusColor(invoice.insurance.status)}>
                                            {invoice.insurance.status}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 mb-2">Services</h4>
                                  <div className="space-y-1">
                                    {invoice.items.slice(0, 2).map((item: any, index: number) => (
                                      <div key={index} className="flex justify-between text-sm text-gray-900 dark:text-gray-100">
                                        <span>{item.description}</span>
                                        <span>{formatCurrency(item.total || item.amount || item.unitPrice || 0)}</span>
                                      </div>
                                    ))}
                                    {invoice.items.length > 2 && (
                                      <div className="text-sm text-gray-500 dark:text-gray-400">
                                        +{invoice.items.length - 2} more items
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 ml-4">
                                <Button variant="outline" size="sm" onClick={() => handleViewInvoice(invoice)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {savedInvoiceIds.has(invoice.id) && (
                                  <>
                                    <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice(invoice.id.toString())}>
                                      <Download className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => handleSendInvoice(invoice.id)}>
                                      <Send className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                {canDelete('billing') && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handleDeleteInvoice(invoice.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

            {filteredInvoices.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
                <p className="text-gray-600 dark:text-gray-300">Try adjusting your search terms or filters</p>
              </div>
            )}
              </TabsContent>

              <TabsContent value="outstanding" className="space-y-4 mt-6">
                {/* Outstanding Invoices Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Outstanding Invoices</CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      All invoices with status except paid
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Invoice No.</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Patient Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Service Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Total</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Outstanding</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {Array.isArray(invoices) && invoices.filter(invoice => {
                            // Filter for patients - only show their own invoices
                            if (isPatient && currentPatientId && invoice.patientId !== currentPatientId) {
                              return false;
                            }
                            return invoice.status !== 'paid';
                          }).map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-slate-800" data-testid={`outstanding-invoice-row-${invoice.id}`}>
                              <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{invoice.id}</td>
                              <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">{invoice.patientName}</td>
                              <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">{format(new Date(invoice.dateOfService), 'MMM d, yyyy')}</td>
                              <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">{format(new Date(invoice.dueDate), 'MMM d, yyyy')}</td>
                              <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(invoice.totalAmount)}</td>
                              <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(invoice.totalAmount - invoice.paidAmount)}</td>
                              <td className="px-4 py-4 text-sm">
                                <Badge className={`${getStatusColor(invoice.status)}`}>
                                  {invoice.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewInvoice(invoice)}
                                    data-testid={`button-view-outstanding-${invoice.id}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownloadPDF(invoice)}
                                    data-testid={`button-download-outstanding-${invoice.id}`}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {Array.isArray(invoices) && invoices.filter(invoice => invoice.status !== 'paid').length === 0 && (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No outstanding invoices</h3>
                        <p className="text-gray-600 dark:text-gray-300">All invoices have been paid</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payment-history" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Payment History</CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      A summary of all payments made — whether from patients or insurance — across all invoices
                    </p>
                  </CardHeader>
                  <CardContent>
                    {paymentsLoading ? (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p className="text-sm">Loading payments...</p>
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-gray-50 dark:bg-gray-800">
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Invoice</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Payer</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Date</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Method</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Amount</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.isArray(payments) && payments.length > 0 ? (
                              payments
                                .filter((payment: any) => {
                                  // Filter for patients - only show payments for their own invoices
                                  if (isPatient && currentPatientId) {
                                    return payment.invoice?.patientId === currentPatientId;
                                  }
                                  return true;
                                })
                                .map((payment: any) => {
                                // Get patient name from joined invoice data or metadata
                                let patientName = payment.invoice?.patientName || payment.metadata?.patientName;
                                
                                if (!patientName) {
                                  const patient = patients?.find((p: any) => p.patientId === payment.patientId);
                                  patientName = patient ? `${patient.firstName} ${patient.lastName}` : payment.patientId;
                                }
                                
                                // Use joined invoice data
                                const invoice = payment.invoice;
                                const invoiceNumber = invoice?.invoiceNumber || payment.invoiceId;
                                
                                return (
                                  <tr key={payment.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                      {invoiceNumber}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                      {patientName}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                      {format(new Date(payment.paymentDate), 'MMM d, yyyy')}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 capitalize">
                                      {payment.paymentMethod === 'cash' ? 'Cash' : payment.paymentMethod === 'debit_card' ? 'Debit Card' : payment.paymentMethod.replace('_', ' ')}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                                      £{(typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                      <span className={`inline-flex items-center gap-1 ${
                                        payment.paymentStatus === 'completed' ? 'text-green-700 dark:text-green-400' : 
                                        payment.paymentStatus === 'pending' ? 'text-yellow-700 dark:text-yellow-400' : 
                                        'text-red-700 dark:text-red-400'
                                      }`}>
                                        <span className={payment.paymentStatus === 'completed' ? 'text-green-600' : payment.paymentStatus === 'pending' ? 'text-yellow-600' : 'text-red-600'}>
                                          {payment.paymentStatus === 'completed' ? '✓' : payment.paymentStatus === 'pending' ? '⏱' : '✗'}
                                        </span> 
                                        {payment.paymentStatus === 'completed' ? 'Successful' : payment.paymentStatus === 'pending' ? 'Pending' : 'Failed'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {invoice ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => handleViewInvoice(invoice)} 
                                            data-testid="button-view-invoice-from-payment"
                                            title="View Invoice"
                                          >
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => {
                                              handleViewInvoice(invoice);
                                              setTimeout(() => {
                                                const printBtn = document.querySelector('[data-testid="button-download-invoice"]') as HTMLButtonElement;
                                                if (printBtn) printBtn.click();
                                              }, 500);
                                            }}
                                            data-testid="button-download-invoice-from-payment"
                                            title="Download Invoice"
                                          >
                                            <Download className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-gray-400">N/A</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                  <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                  <p className="text-sm">No payment history available</p>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Invoices</CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Self-Pay Invoices (None or Patient Self-Pay)
                    </p>
                  </CardHeader>
                  <CardContent>
                    {invoicesLoading ? (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p className="text-sm">Loading invoices...</p>
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b bg-gray-50 dark:bg-gray-800">
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Invoice #</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Patient</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Service Date</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Due Date</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Total Amount</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const selfPayInvoices = Array.isArray(invoices) ? invoices.filter((inv: any) => {
                                // Filter for patients - only show their own invoices
                                if (isPatient && currentPatientId && inv.patientId !== currentPatientId) {
                                  return false;
                                }
                                
                                if (!inv.insurance || inv.insurance === null || inv.insurance === '' || inv.insurance === 'none') {
                                  return true;
                                }
                                
                                const provider = typeof inv.insurance === 'object' ? inv.insurance.provider : inv.insurance;
                                const providerLower = String(provider).toLowerCase();
                                
                                return providerLower === 'none' || providerLower === 'self-pay';
                              }) : [];
                              
                              return selfPayInvoices.length > 0 ? (
                                selfPayInvoices.map((invoice: any) => {
                                  const totalAmount = typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount) : invoice.totalAmount;
                                  
                                  return (
                                    <tr key={invoice.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {invoice.invoiceNumber || invoice.id}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                        {invoice.patientName || invoice.patientId}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                        {format(new Date(invoice.dateOfService), 'MMM d, yyyy')}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                        {format(new Date(invoice.dueDate), 'MMM d, yyyy')}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                                        £{totalAmount.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 capitalize">
                                        {invoice.paymentMethod || 'N/A'}
                                      </td>
                                      <td className="px-4 py-3 text-sm">
                                        <Badge className={`${getStatusColor(invoice.status)}`}>
                                          {invoice.status}
                                        </Badge>
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => handleViewInvoice(invoice)} 
                                          data-testid={`button-view-invoice-${invoice.id}`}
                                          title="View Invoice"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                    <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                    <p className="text-sm">No self-pay invoices available</p>
                                  </td>
                                </tr>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="insurance-claims" className="space-y-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      🛡️ Insurance Claims Management
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Submit claims, track payments, and manage insurance-related invoices
                    </p>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const insuranceClaims = Array.isArray(invoices) ? invoices.filter((inv: any) => {
                        if (isPatient && currentPatientId && inv.patientId !== currentPatientId) {
                          return false;
                        }
                        return inv.invoiceType === 'insurance_claim' || inv.insurance;
                      }) : [];

                      const totalBilled = insuranceClaims.reduce((sum, inv: any) => 
                        sum + (typeof inv.totalAmount === 'string' ? parseFloat(inv.totalAmount) : inv.totalAmount || 0), 0);
                      const totalPaid = insuranceClaims.reduce((sum, inv: any) => 
                        sum + (inv.insurance?.paidAmount || 0), 0);
                      const totalPending = totalBilled - totalPaid;

                      return (
                        <>
                          {/* Summary Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <Card>
                              <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Billed</p>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">£{totalBilled.toFixed(2)}</p>
                                  </div>
                                  <Calendar className="h-8 w-8 text-blue-500" />
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Paid</p>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">£{totalPaid.toFixed(2)}</p>
                                  </div>
                                  <CheckCircle className="h-8 w-8 text-green-500" />
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardContent className="pt-6">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Pending</p>
                                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">£{totalPending.toFixed(2)}</p>
                                  </div>
                                  <Clock className="h-8 w-8 text-orange-500" />
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Insurance Claims Table */}
                          <div className="rounded-md border">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b bg-gray-50 dark:bg-gray-800">
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Invoice</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Patient</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Provider</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Claim #</th>
                                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Billed</th>
                                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Paid</th>
                                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Balance</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {insuranceClaims.length > 0 ? insuranceClaims.map((invoice: any) => {
                                  const totalAmount = typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount) : invoice.totalAmount || 0;
                                  const paidAmount = invoice.insurance?.paidAmount || 0;
                                  const balance = totalAmount - paidAmount;

                                  return (
                                    <tr key={invoice.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {invoice.invoiceNumber || invoice.id}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                        {invoice.patientName}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                                        {invoice.insurance?.provider || '—'}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 font-mono">
                                        {invoice.insurance?.claimNumber || '—'}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 text-right font-medium">
                                        £{totalAmount.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400 text-right font-medium">
                                        £{paidAmount.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-orange-600 dark:text-orange-400 text-right font-medium">
                                        £{balance.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-3 text-sm">
                                        {invoice.insurance?.status === 'approved' ? (
                                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                                            ✅ Approved
                                          </Badge>
                                        ) : invoice.insurance?.status === 'denied' ? (
                                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                                            ❌ Denied
                                          </Badge>
                                        ) : invoice.insurance?.status === 'partially_paid' ? (
                                          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
                                            ⚠️ Partial
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                            ⏱ Pending
                                          </Badge>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-sm">
                                        <div className="flex gap-2">
                                          {!invoice.insurance && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleSubmitClaim(invoice)}
                                              data-testid={`button-submit-claim-${invoice.id}`}
                                            >
                                              Submit Claim
                                            </Button>
                                          )}
                                          {invoice.insurance && balance > 0 && (
                                            <Button
                                              size="sm"
                                              onClick={() => handleRecordPayment(invoice)}
                                              data-testid={`button-record-payment-${invoice.id}`}
                                            >
                                              Record Payment
                                            </Button>
                                          )}
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleViewInvoice(invoice)}
                                            data-testid={`button-view-${invoice.id}`}
                                          >
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }) : (
                                  <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                      <p className="text-sm font-medium">No insurance claims found</p>
                                      <p className="text-xs mt-1">Insurance claims will appear here when invoices are billed to insurance providers</p>
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Custom Reports Tab */}
              {isAdmin && (
                <TabsContent value="custom-reports" className="space-y-4 mt-6">
                  {/* Report Filters */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Report Filters
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                          <Label>Date Range</Label>
                          <Select value={reportDateRange} onValueChange={setReportDateRange}>
                            <SelectTrigger data-testid="select-report-date-range">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="today">Today</SelectItem>
                              <SelectItem value="this-week">This Week</SelectItem>
                              <SelectItem value="this-month">This Month</SelectItem>
                              <SelectItem value="last-month">Last Month</SelectItem>
                              <SelectItem value="this-quarter">This Quarter</SelectItem>
                              <SelectItem value="this-year">This Year</SelectItem>
                              <SelectItem value="custom">Custom Range</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Insurance Type</Label>
                          <Popover open={insuranceSearchOpen} onOpenChange={setInsuranceSearchOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={insuranceSearchOpen}
                                className="w-full justify-between"
                                data-testid="select-report-insurance-type"
                              >
                                {reportInsuranceType === "all" ? "All Insurance" : reportInsuranceType}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput placeholder="Search insurance..." />
                                <CommandEmpty>No insurance provider found.</CommandEmpty>
                                <CommandGroup className="max-h-64 overflow-auto">
                                  <CommandItem
                                    value="all"
                                    onSelect={() => {
                                      setReportInsuranceType("all");
                                      setInsuranceSearchOpen(false);
                                    }}
                                  >
                                    <Check className={reportInsuranceType === "all" ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                                    All Insurance
                                  </CommandItem>
                                  {["NHS (National Health Service)", "Bupa", "AXA PPP Healthcare", "Vitality Health", "Aviva Health", "Simply Health", "WPA", "Benenden Health", "Healix Health Services", "Sovereign Health Care", "Exeter Friendly Society", "Self-Pay", "Other"].map((provider) => (
                                    <CommandItem
                                      key={provider}
                                      value={provider}
                                      onSelect={() => {
                                        setReportInsuranceType(provider);
                                        setInsuranceSearchOpen(false);
                                      }}
                                    >
                                      <Check className={reportInsuranceType === provider ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                                      {provider}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>Select Role</Label>
                          <Popover open={roleSearchOpen} onOpenChange={setRoleSearchOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={roleSearchOpen}
                                className="w-full justify-between"
                                data-testid="select-report-role"
                              >
                                {reportRole === "all" ? "All Roles" : reportRole}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput placeholder="Search role..." />
                                <CommandEmpty>No role found.</CommandEmpty>
                                <CommandGroup className="max-h-64 overflow-auto">
                                  <CommandItem
                                    value="all"
                                    onSelect={() => {
                                      setReportRole("all");
                                      setReportUserName("all");
                                      setRoleSearchOpen(false);
                                    }}
                                  >
                                    <Check className={reportRole === "all" ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                                    All Roles
                                  </CommandItem>
                                  {roles.map((role: any) => (
                                    <CommandItem
                                      key={role.id}
                                      value={role.name}
                                      onSelect={() => {
                                        setReportRole(role.name);
                                        setReportUserName("all");
                                        setRoleSearchOpen(false);
                                      }}
                                    >
                                      <Check className={reportRole === role.name ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                                      {role.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label>Select Name</Label>
                          <Popover open={nameSearchOpen} onOpenChange={setNameSearchOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={nameSearchOpen}
                                className="w-full justify-between"
                                data-testid="select-report-user-name"
                              >
                                {reportUserName === "all" ? "All Names" : users.find((u: any) => String(u.id) === reportUserName)?.firstName + " " + users.find((u: any) => String(u.id) === reportUserName)?.lastName || "Select name"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                              <Command>
                                <CommandInput placeholder="Search name..." />
                                <CommandEmpty>No user found.</CommandEmpty>
                                <CommandGroup className="max-h-64 overflow-auto">
                                  <CommandItem
                                    value="all"
                                    onSelect={() => {
                                      setReportUserName("all");
                                      setNameSearchOpen(false);
                                    }}
                                  >
                                    <Check className={reportUserName === "all" ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                                    All Names
                                  </CommandItem>
                                  {users
                                    .filter((user: any) => reportRole === "all" || user.role === reportRole)
                                    .map((user: any) => (
                                      <CommandItem
                                        key={user.id}
                                        value={`${user.firstName} ${user.lastName}`}
                                        onSelect={() => {
                                          setReportUserName(String(user.id));
                                          setNameSearchOpen(false);
                                        }}
                                      >
                                        <Check className={reportUserName === String(user.id) ? "mr-2 h-4 w-4 opacity-100" : "mr-2 h-4 w-4 opacity-0"} />
                                        {user.firstName} {user.lastName}
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex items-end">
                          <Button 
                            className="w-full" 
                            onClick={async () => {
                              try {
                                const params = new URLSearchParams({
                                  dateRange: reportDateRange,
                                  insuranceType: reportInsuranceType,
                                  role: reportRole,
                                  userName: reportUserName
                                });
                                
                                const response = await fetch(`/api/reports/revenue-breakdown?${params}`, {
                                  headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                                    'X-Tenant-Subdomain': localStorage.getItem('user_subdomain') || 'cura'
                                  }
                                });
                                
                                if (response.ok) {
                                  const data = await response.json();
                                  setDisplayedReportData(data);
                                  setReportGenerated(true);
                                } else {
                                  toast({
                                    title: "Error",
                                    description: "Failed to generate report",
                                    variant: "destructive"
                                  });
                                }
                              } catch (error) {
                                console.error("Report generation error:", error);
                                toast({
                                  title: "Error",
                                  description: "Failed to generate report",
                                  variant: "destructive"
                                });
                              }
                            }}
                            data-testid="button-generate-report"
                          >
                            <FileBarChart className="h-4 w-4 mr-2" />
                            Generate Report
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Generated Report Display */}
                  {reportGenerated && displayedReportData && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <FileBarChart className="h-5 w-5" />
                            Generated Report
                          </CardTitle>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={exportRevenueCSV}
                              data-testid="button-download-csv"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download CSV
                            </Button>
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={exportRevenuePDF}
                              data-testid="button-download-pdf"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download PDF
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setReportGenerated(false);
                                setDisplayedReportData(null);
                              }}
                              data-testid="button-close-report"
                            >
                              Close
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Report Header */}
                        <div className="border-b pb-4">
                          <h3 className="text-lg font-semibold mb-2">Custom Revenue Report</h3>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            <p><strong>Period:</strong> {format(displayedReportData.dateRange.start, 'MMM d, yyyy')} - {format(displayedReportData.dateRange.end, 'MMM d, yyyy')}</p>
                            <p><strong>Generated:</strong> {format(new Date(), 'MMM d, yyyy HH:mm')}</p>
                          </div>
                        </div>

                        {/* Patient Information (if specific patient selected) */}
                        {displayedReportData.patientInfo && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                            <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                              <User className="h-5 w-5" />
                              Patient Information
                            </h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div><strong>Name:</strong> {displayedReportData.patientInfo.name}</div>
                              <div><strong>Patient ID:</strong> {displayedReportData.patientInfo.patientId}</div>
                              <div><strong>Insurance Provider:</strong> {displayedReportData.patientInfo.insurance}</div>
                              <div><strong>Insurance Number:</strong> {displayedReportData.patientInfo.insuranceNumber}</div>
                              <div><strong>Phone:</strong> {displayedReportData.patientInfo.phone}</div>
                              <div><strong>Email:</strong> {displayedReportData.patientInfo.email}</div>
                            </div>
                          </div>
                        )}

                        {/* Applied Filters */}
                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                          <h4 className="font-semibold mb-2">Applied Filters</h4>
                          <div className="text-sm space-y-1">
                            <p><strong>Date Range:</strong> {reportDateRange.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                            {displayedReportData.filters.insuranceType !== 'all' && (
                              <p><strong>Insurance Type:</strong> {displayedReportData.filters.insuranceType}</p>
                            )}
                            {displayedReportData.filters.role !== 'all' && (
                              <p><strong>Role:</strong> {displayedReportData.filters.role}</p>
                            )}
                            {displayedReportData.filters.userName !== 'all' && !displayedReportData.patientInfo && (
                              <p><strong>User:</strong> {users.find((u: any) => String(u.id) === displayedReportData.filters.userName)?.firstName} {users.find((u: any) => String(u.id) === displayedReportData.filters.userName)?.lastName}</p>
                            )}
                          </div>
                        </div>

                        {/* Revenue Breakdown Table */}
                        <div>
                          <h4 className="font-semibold text-lg mb-3">Revenue Breakdown by Service Type</h4>
                          <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-gray-50 dark:bg-gray-800">
                                  <th className="text-left p-3">Service Type</th>
                                  <th className="text-left p-3">Procedures</th>
                                  <th className="text-left p-3">Revenue</th>
                                  <th className="text-left p-3">Insurance</th>
                                  <th className="text-left p-3">Self-Pay</th>
                                  <th className="text-left p-3">Collection Rate</th>
                                </tr>
                              </thead>
                              <tbody>
                                {displayedReportData.breakdown && displayedReportData.breakdown.length > 0 ? (
                                  displayedReportData.breakdown.map((item: any, index: number) => (
                                    <tr 
                                      key={index} 
                                      className={`border-b ${item.serviceName === 'Total' ? 'bg-gray-50 dark:bg-gray-800 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                                    >
                                      <td className="p-3 font-medium">{item.serviceName}</td>
                                      <td className="p-3">{item.procedures}</td>
                                      <td className="p-3 font-semibold">{formatCurrency(item.revenue)}</td>
                                      <td className="p-3">{formatCurrency(item.insurance)}</td>
                                      <td className="p-3">{formatCurrency(item.selfPay)}</td>
                                      <td className="p-3">
                                        <Badge className={`${
                                          item.collectionRate >= 90 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                                          item.collectionRate >= 75 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                                          'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                        }`}>
                                          {item.collectionRate}%
                                        </Badge>
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                      No data available for the selected filters
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}

              {/* Pricing Management Tab */}
              {isAdmin && (
                <TabsContent value="pricing-management" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PoundSterling className="h-5 w-5" />
                        Pricing Management
                      </CardTitle>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Manage pricing for doctors, lab tests, and imaging services with version history tracking
                      </p>
                    </CardHeader>
                    <CardContent>
                      <PricingManagementDashboard />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
            )}

          {false && isAdmin && (
            <div className="space-y-6">
              {/* Report Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport('revenue')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Revenue Report</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Monthly and yearly revenue analysis</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Last updated: {format(new Date(), 'MMM d, yyyy')}
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport('outstanding')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Outstanding Invoices</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Unpaid and overdue invoices</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  </div>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Total: {formatCurrency(getOutstandingAmount())}
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport('insurance')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Insurance Analytics</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Claims processing and reimbursements</p>
                    </div>
                    <PieChart className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Active claims: 12
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport('aging')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Aging Report</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Accounts receivable by age</p>
                    </div>
                    <Clock className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    30+ days: £1,250
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport('provider')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Provider Performance</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Revenue by healthcare provider</p>
                    </div>
                    <User className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    5 providers tracked
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedReport('procedures')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Procedure Analysis</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Most profitable procedures and services</p>
                    </div>
                    <Target className="h-8 w-8 text-teal-600" />
                  </div>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Top CPT: 99213
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Quick Financial Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{formatCurrency(getTotalRevenue())}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Total Revenue</div>
                    <div className="text-xs text-green-600 mt-1">+12% vs last month</div>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(getOutstandingAmount())}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Outstanding</div>
                    <div className="text-xs text-red-600 mt-1">2 overdue invoices</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">92%</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Collection Rate</div>
                    <div className="text-xs text-green-600 mt-1">Above industry avg</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">18 days</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Avg Collection Time</div>
                    <div className="text-xs text-orange-600 mt-1">Industry: 25 days</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
            )}
        </div>
      </div>

      {/* New Invoice Dialog */}
      <Dialog open={showNewInvoice} onOpenChange={setShowNewInvoice}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="patient">Patient</Label>
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger>
                    <SelectValue placeholder={patientsLoading ? "Loading patients..." : "Select patient"} />
                  </SelectTrigger>
                  <SelectContent>
                    {patientsLoading ? (
                      <SelectItem value="loading" disabled>Loading...</SelectItem>
                    ) : patients && patients.length > 0 ? (
                      (() => {
                        // Deduplicate patients by unique name combination
                        const uniquePatients = patients.filter((patient: any, index: number, array: any[]) => 
                          array.findIndex((p: any) => 
                            `${p.firstName} ${p.lastName}` === `${patient.firstName} ${patient.lastName}`
                          ) === index
                        );
                        return uniquePatients.map((patient: any) => (
                          <SelectItem key={patient.id} value={patient.patientId}>
                            {patient.patientId} - {patient.firstName} {patient.lastName}
                          </SelectItem>
                        ));
                      })()
                    ) : (
                      <SelectItem value="no-patients" disabled>No patients found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {patientError && (
                  <p className="text-sm text-red-600 mt-1">{patientError}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="service-date">Service Date</Label>
                <Input 
                  id="service-date" 
                  type="date" 
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                />
              </div>
            </div>

            {/* Doctor Name Field */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="doctor-name">Doctor</Label>
                {isDoctor ? (
                  <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 flex items-center text-sm">
                    {user?.firstName} {user?.lastName}
                  </div>
                ) : (
                  <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 dark:bg-gray-800 flex items-center text-sm">
                    {user?.firstName} {user?.lastName}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="invoice-date">Invoice Date</Label>
                <Input 
                  id="invoice-date" 
                  type="date" 
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div>
                <Label htmlFor="due-date">Due Date</Label>
                <Input 
                  id="due-date" 
                  type="date" 
                  defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div>
              <Label>Services & Procedures</Label>
              <div className="border rounded-md p-4 space-y-3">
                <div className="grid grid-cols-4 gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                  <span>Code</span>
                  <span>Description</span>
                  <span>Qty</span>
                  <span>Amount</span>
                </div>
                
                <div className="grid grid-cols-4 gap-2">
                  <Input placeholder="Enter CPT Code" value={firstServiceCode} onChange={(e) => setFirstServiceCode(e.target.value)} />
                  <Input placeholder="Enter Description" value={firstServiceDesc} onChange={(e) => setFirstServiceDesc(e.target.value)} />
                  <Input placeholder="Qty" value={firstServiceQty} onChange={(e) => setFirstServiceQty(e.target.value)} />
                  <Input placeholder="Amount" value={firstServiceAmount} onChange={(e) => setFirstServiceAmount(e.target.value)} />
                </div>
                
                <div className="grid grid-cols-4 gap-2">
                  <Input placeholder="CPT Code" />
                  <Input placeholder="Description" />
                  <Input placeholder="1" />
                  <Input placeholder="0.00" />
                </div>
              </div>
              {serviceError && (
                <p className="text-sm text-red-600 mt-1">{serviceError}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Payment Method</Label>
                <Select value={invoicePaymentMethod} onValueChange={(value) => handleInvoicePaymentMethodChange(value as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Online Payment">Online Payment</SelectItem>
                    <SelectItem value="Insurance">Insurance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="total">Total Amount</Label>
                <Input 
                  id="total" 
                  placeholder="Enter amount (e.g., 150.00)" 
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                />
                {totalAmountError && (
                  <p className="text-sm text-red-600 mt-1">{totalAmountError}</p>
                )}
              </div>
            </div>

            {invoicePaymentMethod === "Insurance" && (
              <div className="border border-blue-200 dark:border-blue-900/50 rounded-lg bg-blue-50 dark:bg-blue-900/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-800 dark:text-blue-200">Insurance Details</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openInsuranceDialog()}
                  >
                    {insuranceDetails.provider ? "Update" : "Add Insurance Info"}
                  </Button>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {insuranceDetails.provider
                      ? `Provider: ${insuranceDetails.provider}`
                      : "No insurance provider recorded yet."}
                  </p>
                  {insuranceDetails.planType && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Plan Type: {insuranceDetails.planType}
                    </p>
                  )}
                  {insuranceDetails.policyNumber && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Policy #: {insuranceDetails.policyNumber}
                    </p>
                  )}
                  {insuranceDetails.memberNumber && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Member #: {insuranceDetails.memberNumber}
                    </p>
                  )}
                  {insuranceDetails.memberName && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Member: {insuranceDetails.memberName}
                    </p>
                  )}
                  {insuranceDetails.contact && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Contact: {insuranceDetails.contact}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-900 dark:text-white">Insurance Status</Label>
                  <Select
                    value={invoiceStatus}
                    onValueChange={(value) => setInvoiceStatus(value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partial">Partial Paid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Label className="font-semibold">Invoice Type:</Label>
                <Badge 
                  className={
                    insuranceProvider && insuranceProvider !== '' && insuranceProvider !== 'none' 
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400" 
                      : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                  }
                >
                  {insuranceProvider && insuranceProvider !== '' && insuranceProvider !== 'none' 
                    ? "Insurance Claim" 
                    : "Payment (Self-Pay)"}
                </Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {insuranceProvider && insuranceProvider !== '' && insuranceProvider !== 'none' 
                  ? "This invoice will be billed to the insurance provider" 
                  : "This invoice will be paid directly by the patient"}
              </p>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea 
                id="notes" 
                placeholder="Additional notes or instructions..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowNewInvoice(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInvoice} disabled={isCreatingInvoice} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isCreatingInvoice ? "Processing..." : "Review & Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details - {selectedInvoice?.id}</DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Patient Information</h3>
                  <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                    <div><strong>Name:</strong> {selectedInvoice.patientName}</div>
                    <div><strong>Patient ID:</strong> {selectedInvoice.patientId}</div>
                    <div><strong>Service Date:</strong> {format(new Date(selectedInvoice.dateOfService), 'MMM d, yyyy')}</div>
                    <div><strong>Invoice Date:</strong> {format(new Date(selectedInvoice.invoiceDate), 'MMM d, yyyy')}</div>
                    <div><strong>Due Date:</strong> {format(new Date(selectedInvoice.dueDate), 'MMM d, yyyy')}</div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Billing Summary</h3>
                  <div className="space-y-1 text-sm text-gray-900 dark:text-gray-100">
                    <div><strong>Invoice ID:</strong> {selectedInvoice.invoiceNumber || selectedInvoice.id}</div>
                    <div className="flex items-center gap-2">
                      <strong>Status:</strong> 
                      {isEditingStatus ? (
                        <div className="flex items-center gap-2">
                          <Select value={editedStatus} onValueChange={setEditedStatus}>
                            <SelectTrigger className="w-[150px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                              <SelectItem value="draft">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" onClick={handleUpdateStatus}>Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setIsEditingStatus(false)}>Cancel</Button>
                        </div>
                      ) : (
                        <Badge className={`${selectedInvoice.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 
                          selectedInvoice.status === 'overdue' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' : 
                          selectedInvoice.status === 'sent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' : 
                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                          {selectedInvoice.status}
                        </Badge>
                      )}
                    </div>
                    <div><strong>Total Amount:</strong> £{parseFloat(selectedInvoice.totalAmount.toString()).toFixed(2)}</div>
                    <div><strong>Paid Amount:</strong> £{parseFloat(selectedInvoice.paidAmount.toString()).toFixed(2)}</div>
                    <div><strong>Outstanding:</strong> £{(parseFloat(selectedInvoice.totalAmount.toString()) - parseFloat(selectedInvoice.paidAmount.toString())).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Services & Procedures */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Services & Procedures</h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left p-3 text-gray-900 dark:text-gray-100">Code</th>
                        <th className="text-left p-3 text-gray-900 dark:text-gray-100">Description</th>
                        <th className="text-right p-3 text-gray-900 dark:text-gray-100">Unit Price</th>
                        <th className="text-right p-3 text-gray-900 dark:text-gray-100">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items.map((item, index) => (
                        <tr key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                          <td className="p-3 font-mono text-gray-900 dark:text-gray-100">{item.code}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-100">{item.description}</td>
                          <td className="p-3 text-right text-gray-900 dark:text-gray-100">£{Number(item.unitPrice || item.total || item.amount || 0).toFixed(2)}</td>
                          <td className="p-3 text-right font-semibold text-gray-900 dark:text-gray-100">£{Number(item.total || item.amount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Insurance Information */}
              {selectedInvoice.insurance && (
                <div>
                  <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Insurance Information</h3>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-900 dark:text-gray-100">
                      <div>
                        <div><strong>Provider:</strong> {selectedInvoice.insurance.provider}</div>
                        <div><strong>Claim Number:</strong> {selectedInvoice.insurance.claimNumber}</div>
                      </div>
                      <div>
                        <div><strong>Status:</strong> 
                          <Badge className={`ml-2 ${selectedInvoice.insurance.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 
                            selectedInvoice.insurance.status === 'denied' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' : 
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'}`}>
                            {selectedInvoice.insurance.status}
                          </Badge>
                        </div>
                        <div><strong>Insurance Paid:</strong> £{(typeof selectedInvoice.insurance.paidAmount === 'string' ? parseFloat(selectedInvoice.insurance.paidAmount) : selectedInvoice.insurance.paidAmount).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment History */}
              <div>
                <h3 className="font-semibold text-lg mb-3 text-gray-900 dark:text-gray-100">Payment History</h3>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {(typeof selectedInvoice.paidAmount === 'string' ? parseFloat(selectedInvoice.paidAmount) : selectedInvoice.paidAmount) > 0 ? (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-gray-900 dark:text-gray-100">
                      Payment of £{(typeof selectedInvoice.paidAmount === 'string' ? parseFloat(selectedInvoice.paidAmount) : selectedInvoice.paidAmount).toFixed(2)} received on {format(new Date(selectedInvoice.invoiceDate), 'MMM d, yyyy')}
                    </div>
                  ) : (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-gray-100">
                      No payments received yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
              Close
            </Button>
            <Button variant="default" onClick={() => {
              if (selectedInvoice) {
                handleSaveInvoice(selectedInvoice.id.toString());
              }
            }} data-testid="button-save-invoice">
              <Download className="h-4 w-4 mr-2" />
              Save Invoice
            </Button>
            {isInvoiceSaved && (
              <>
                <Button onClick={() => {
                  if (selectedInvoice) {
                    handleDownloadInvoice(selectedInvoice.id.toString());
                  }
                }} data-testid="button-download-pdf">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                <Button onClick={() => {
                  if (selectedInvoice) {
                    handleSendInvoice(selectedInvoice.id);
                  }
                }} data-testid="button-send-invoice">
                  <Send className="h-4 w-4 mr-2" />
                  Send Invoice
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Invoice Dialog */}
      <Dialog open={sendInvoiceDialog} onOpenChange={setSendInvoiceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
          </DialogHeader>
          
          {invoiceToSend && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm">
                  <div><strong>Invoice:</strong> {invoiceToSend.id}</div>
                  <div><strong>Patient:</strong> {invoiceToSend.patientName}</div>
                  <div><strong>Amount:</strong> £{(typeof invoiceToSend.totalAmount === 'string' ? parseFloat(invoiceToSend.totalAmount) : invoiceToSend.totalAmount).toFixed(2)}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="sendMethod">Send Method</Label>
                  <Select value={sendMethod} onValueChange={setSendMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="print">Print & Mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {sendMethod === "email" && (
                  <div>
                    <Label htmlFor="recipientEmail">Recipient Email</Label>
                    <Input
                      id="recipientEmail"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="patient@email.com"
                    />
                  </div>
                )}

                {sendMethod === "sms" && (
                  <div>
                    <Label htmlFor="recipientPhone">Recipient Phone</Label>
                    <Input
                      id="recipientPhone"
                      type="tel"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="+44 7XXX XXXXXX"
                    />
                  </div>
                )}

                {sendMethod === "print" && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="recipientName">Recipient Name</Label>
                      <Input
                        id="recipientName"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="recipientAddress">Mailing Address</Label>
                      <Textarea
                        id="recipientAddress"
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        placeholder="Street address, City, Postal code"
                        rows={3}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="customMessage">Message (Optional)</Label>
                  <Textarea
                    id="customMessage"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Add a personal message..."
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendInvoiceDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmSendInvoice} 
              disabled={
                (sendMethod === "email" && !recipientEmail) ||
                (sendMethod === "sms" && !recipientPhone) ||
                (sendMethod === "print" && (!recipientName || !recipientAddress))
              }
            >
              <Send className="h-4 w-4 mr-2" />
              Send Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-500" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Invoice Created Successfully!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              Invoice <span className="font-semibold text-foreground">{createdInvoiceNumber}</span> has been created successfully!
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowSuccessModal(false)} className="w-full sm:w-auto">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download Success Modal */}
      <Dialog open={showDownloadModal} onOpenChange={setShowDownloadModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Download className="h-10 w-10 text-blue-600 dark:text-blue-500" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Invoice Downloaded Successfully!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              Invoice <span className="font-semibold text-foreground">{downloadedInvoiceNumber}</span> downloaded successfully!
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowDownloadModal(false)} className="w-full sm:w-auto">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              Are you sure you want to delete invoice {invoiceToDelete?.id} for {invoiceToDelete?.patientName}?
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteInvoice}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Invoice Success Modal */}
      <Dialog open={showSendSuccessModal} onOpenChange={setShowSendSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Send className="h-10 w-10 text-blue-600 dark:text-blue-500" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Invoice Sent Successfully!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              Invoice <span className="font-semibold text-foreground">{sentInvoiceInfo.invoiceNumber}</span> sent to <span className="font-semibold text-foreground">{sentInvoiceInfo.recipient}</span>
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowSendSuccessModal(false)} className="w-full sm:w-auto">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Invoice Success Modal */}
      <Dialog open={showDeleteSuccessModal} onOpenChange={setShowDeleteSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-500" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Invoice Deleted Successfully!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              Invoice <span className="font-semibold text-foreground">{deletedInvoiceNumber}</span> has been successfully deleted
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowDeleteSuccessModal(false)} className="w-full sm:w-auto">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Success Modal */}
      <Dialog open={showStatusUpdateModal} onOpenChange={setShowStatusUpdateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-500" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Status Updated Successfully!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              Invoice status updated successfully!
            </p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowStatusUpdateModal(false)} className="w-full sm:w-auto">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      {invoiceToPay && (
        <PaymentModal
          invoice={invoiceToPay}
          open={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setInvoiceToPay(null);
          }}
          onSuccess={async () => {
            if (invoiceToPay) {
              await handlePaymentSuccess(invoiceToPay);
            }
            setShowPaymentModal(false);
            setInvoiceToPay(null);
          }}
        />
      )}

      <Dialog open={showInsuranceInfoDialog} onOpenChange={setShowInsuranceInfoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Health Insurance Information</DialogTitle>
            <DialogDescription>Please confirm or add the patient’s insurance data.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm">Insurance Provider</Label>
              <Select value={insuranceForm.provider} onValueChange={(value) => setInsuranceForm({ ...insuranceForm, provider: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select insurance provider..." />
                </SelectTrigger>
                <SelectContent>
                  {insuranceProviders.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                      {provider}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Plan Type</Label>
              <Select value={insuranceForm.planType} onValueChange={(value) => setInsuranceForm({ ...insuranceForm, planType: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan type" />
                </SelectTrigger>
                <SelectContent>
                  {insurancePlanTypes.map((plan) => (
                    <SelectItem key={plan} value={plan}>
                      {plan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Policy Number</Label>
                <Input
                  placeholder="Enter policy number"
                  value={insuranceForm.policyNumber}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, policyNumber: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">Member Number</Label>
                <Input
                  placeholder="Enter member number"
                  value={insuranceForm.memberNumber}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, memberNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Member Name</Label>
                <Input
                  placeholder="Enter member name"
                  value={insuranceForm.memberName}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, memberName: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-sm">Contact</Label>
                <Input
                  placeholder="Optional contact details"
                  value={insuranceForm.contact}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, contact: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">NHS Number</Label>
              <Input
                placeholder="Enter NHS number (optional)"
                value={nhsNumber}
                onChange={(e) => setNhsNumber(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="space-x-2">
            <Button variant="outline" onClick={() => setShowInsuranceInfoDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsuranceDialogSave}>
              Save Insurance Info
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Insurance Claim Dialog */}
      <Dialog open={showSubmitClaimDialog} onOpenChange={setShowSubmitClaimDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Insurance Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="insurance-provider">Insurance Provider</Label>
              <Input
                id="insurance-provider"
                value={claimFormData.provider}
                onChange={(e) => setClaimFormData({ ...claimFormData, provider: e.target.value })}
                placeholder="Enter insurance provider name"
                data-testid="input-insurance-provider"
              />
            </div>
            <div>
              <Label htmlFor="claim-number">Claim Number / Reference</Label>
              <Input
                id="claim-number"
                value={claimFormData.claimNumber}
                onChange={(e) => setClaimFormData({ ...claimFormData, claimNumber: e.target.value })}
                placeholder="Enter claim number"
                data-testid="input-claim-number"
              />
            </div>
            {selectedClaimInvoice && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Invoice Details</h4>
                <div className="text-sm space-y-1">
                  <p><strong>Invoice:</strong> {selectedClaimInvoice.invoiceNumber}</p>
                  <p><strong>Patient:</strong> {selectedClaimInvoice.patientName}</p>
                  <p><strong>Amount:</strong> £{(typeof selectedClaimInvoice.totalAmount === 'string' ? parseFloat(selectedClaimInvoice.totalAmount) : selectedClaimInvoice.totalAmount).toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitClaimDialog(false)}>
              Cancel
            </Button>
            <Button onClick={submitInsuranceClaim} data-testid="button-submit-claim-confirm">
              Submit Claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Insurance Payment Dialog */}
      <Dialog open={showRecordPaymentDialog} onOpenChange={setShowRecordPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Insurance Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedClaimInvoice && (
              <>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Claim Information</h4>
                  <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                    <p><strong>Invoice:</strong> {selectedClaimInvoice.invoiceNumber}</p>
                    <p><strong>Patient:</strong> {selectedClaimInvoice.patientName}</p>
                    <p><strong>Insurance:</strong> {selectedClaimInvoice.insurance?.provider}</p>
                    <p><strong>Claim #:</strong> {selectedClaimInvoice.insurance?.claimNumber}</p>
                    <p><strong>Total Billed:</strong> £{(typeof selectedClaimInvoice.totalAmount === 'string' ? parseFloat(selectedClaimInvoice.totalAmount) : selectedClaimInvoice.totalAmount).toFixed(2)}</p>
                    <p><strong>Previously Paid:</strong> £{(selectedClaimInvoice.insurance?.paidAmount || 0).toFixed(2)}</p>
                    <p className="text-orange-600 dark:text-orange-400"><strong>Outstanding:</strong> £{((typeof selectedClaimInvoice.totalAmount === 'string' ? parseFloat(selectedClaimInvoice.totalAmount) : selectedClaimInvoice.totalAmount) - (selectedClaimInvoice.insurance?.paidAmount || 0)).toFixed(2)}</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="amount-paid">Amount Paid by Insurance</Label>
                  <Input
                    id="amount-paid"
                    type="number"
                    step="0.01"
                    value={paymentFormData.amountPaid}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, amountPaid: e.target.value })}
                    placeholder="0.00"
                    data-testid="input-amount-paid"
                  />
                </div>
                <div>
                  <Label htmlFor="payment-date">Payment Date</Label>
                  <Input
                    id="payment-date"
                    type="date"
                    value={paymentFormData.paymentDate}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentDate: e.target.value })}
                    data-testid="input-payment-date"
                  />
                </div>
                <div>
                  <Label htmlFor="payment-reference">Payment Reference (Optional)</Label>
                  <Input
                    id="payment-reference"
                    value={paymentFormData.paymentReference}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentReference: e.target.value })}
                    placeholder="EOB number, check number, etc."
                    data-testid="input-payment-reference"
                  />
                </div>
                <div>
                  <Label htmlFor="payment-notes">Notes (Optional)</Label>
                  <Textarea
                    id="payment-notes"
                    value={paymentFormData.notes}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                    placeholder="Add any additional notes..."
                    rows={3}
                    data-testid="textarea-payment-notes"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordPaymentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={recordInsurancePayment} data-testid="button-record-payment-confirm">
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Payment Modal Component with Stripe
function PaymentModal({ invoice, open, onClose, onSuccess }: {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pay Invoice {invoice.patientId}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Patient:</span>
              <span className="font-medium">{invoice.patientName}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Amount:</span>
              <span className="font-bold text-lg">${typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount).toFixed(2) : invoice.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Due Date:</span>
              <span className="text-sm">{format(new Date(invoice.dueDate), 'MMM dd, yyyy')}</span>
            </div>
          </div>

          <StripePaymentForm invoice={invoice} onSuccess={onSuccess} onCancel={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Initialize Stripe only if public key is available
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

// Stripe Payment Form Component
function StripePaymentForm({ invoice, onSuccess, onCancel }: {
  invoice: Invoice;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Create payment intent when component mounts
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        setLoading(true);
        const res = await apiRequest('POST', '/api/billing/create-payment-intent', {
          invoiceId: invoice.id
        });
        
        // Ensure response is JSON
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Invalid response format from server');
        }
        
        const data = await res.json();
        
        if (data?.clientSecret) {
          setClientSecret(data.clientSecret);
        } else if (data?.error) {
          setError(data.error);
          toast({
            title: "Payment Error",
            description: data.error,
            variant: "destructive"
          });
        } else {
          setError('Failed to initialize payment');
          toast({
            title: "Payment Error",
            description: "Failed to initialize payment. Please try again.",
            variant: "destructive"
          });
        }
      } catch (err: any) {
        console.error('Error creating payment intent:', err);
        
        // Extract user-friendly error message
        let errorMessage = 'Failed to initialize payment. Please try again.';
        
        if (err?.message) {
          // Check if error message is JSON string
          try {
            const parsed = JSON.parse(err.message);
            if (parsed?.error) {
              errorMessage = parsed.error;
            } else {
              errorMessage = err.message;
            }
          } catch {
            // Not JSON, use message as is
            errorMessage = err.message;
          }
        } else if (typeof err === 'string') {
          errorMessage = err;
        }
        
        // Make error messages more user-friendly
        if (errorMessage.includes('stripe is not defined')) {
          errorMessage = 'Payment system is not configured. Please contact support.';
        } else if (errorMessage.includes('STRIPE_SECRET_KEY')) {
          errorMessage = 'Payment system is not configured. Please contact support.';
        } else if (errorMessage.includes('500')) {
          errorMessage = 'Server error occurred. Please try again or contact support.';
        }
        
        setError(errorMessage);
        toast({
          title: "Payment Error",
          description: errorMessage,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [invoice.id, invoice.totalAmount, toast]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bluewave mx-auto mb-4"></div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Initializing payment...</p>
      </div>
    );
  }

  if (error || !clientSecret) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-sm text-red-600 dark:text-red-400">{error || 'Failed to initialize payment'}</p>
        <Button variant="outline" onClick={onCancel} className="mt-4">Close</Button>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-sm text-gray-600 dark:text-gray-400">Payment processing is not configured. Please contact support.</p>
        <Button variant="outline" onClick={onCancel} className="mt-4">Close</Button>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm invoice={invoice} onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
}

// Payment Form Component (inside Elements)
function PaymentForm({ invoice, onSuccess, onCancel }: {
  invoice: Invoice;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message || "An error occurred during payment",
          variant: "destructive"
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Process the payment on our backend
        const res = await apiRequest('POST', '/api/billing/process-payment', {
          invoiceId: invoice.id,
          paymentIntentId: paymentIntent.id
        });

        // Ensure response is JSON
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Invalid response format from server');
        }

        const result = await res.json();
        
        if (result.success) {
          toast({
            title: "Payment Successful",
            description: "Your payment has been processed successfully!",
          });
          
          onSuccess();
        } else {
          const errorMessage = result.error || 'Payment processing failed';
          toast({
            title: "Payment Failed",
            description: errorMessage,
            variant: "destructive"
          });
          throw new Error(errorMessage);
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      toast({
        title: "Payment Failed",
        description: "An error occurred while processing your payment",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <PaymentElement />
      </div>
      
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 bg-black hover:bg-black/90 text-white"
        >
          {isProcessing ? 'Processing...' : `Pay $${typeof invoice.totalAmount === 'string' ? parseFloat(invoice.totalAmount).toFixed(2) : invoice.totalAmount.toFixed(2)}`}
        </Button>
      </div>
    </form>
  );
}