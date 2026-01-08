import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Header } from "@/components/layout/header";
import { PatientList } from "@/components/patients/patient-list";
import { PatientModal } from "@/components/patients/patient-modal";
import ConsultationNotes from "@/components/medical/consultation-notes";
import PatientFamilyHistory from "@/components/patients/patient-family-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useRolePermissions } from "@/hooks/use-role-permissions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserPlus, ArrowLeft, FileText, Calendar, User, X, LayoutGrid, List, Mail } from "lucide-react";

// Helper function to get the correct tenant subdomain
function getTenantSubdomain(): string {
  // PRIORITY 1: Check for user's stored subdomain (from their organization)
  const storedSubdomain = localStorage.getItem('user_subdomain');
  if (storedSubdomain) {
    return storedSubdomain;
  }
  
  // PRIORITY 2: Check for subdomain query parameter (for development)
  const urlParams = new URLSearchParams(window.location.search);
  const subdomainParam = urlParams.get('subdomain');
  if (subdomainParam) {
    return subdomainParam;
  }
  
  const hostname = window.location.hostname;
  
  // PRIORITY 3: For development/replit environments, use 'demo'
  if (hostname.includes('.replit.app') || hostname.includes('localhost') || hostname.includes('replit.dev') || hostname.includes('127.0.0.1')) {
    return 'demo';
  }
  
  // PRIORITY 4: For production environments, extract subdomain from hostname
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts[0] || 'demo';
  }
  
  // PRIORITY 5: Fallback to 'demo'
  return 'demo';
}

export default function Patients() {
  const { user } = useAuth();
  const { canCreate, canEdit, canDelete } = useRolePermissions();
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const params = useParams();
  const [, setLocation] = useLocation();
  const patientId = params.id ? parseInt(params.id) : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for patient data
  const [patient, setPatient] = useState<any>(null);
  const [patientLoading, setPatientLoading] = useState(false);
  const [anatomicalFiles, setAnatomicalFiles] = useState<
    Array<{ filename: string; url: string; uploadedAt: string; size: number }>
  >([]);
  const [anatomicalFilesLoading, setAnatomicalFilesLoading] = useState(false);
  const [anatomicalFilesError, setAnatomicalFilesError] = useState("");
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  
  // State for gender filter ("all" shows both, "Male" shows males, "Female" shows females)
  const [genderFilter, setGenderFilter] = useState<"all" | "Male" | "Female">("all");
  
  // State for view mode (true = List view, false = Grid view)
  const [isListView, setIsListView] = useState(false);
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch specific patient data if viewing records
  useEffect(() => {
    const fetchPatient = async () => {
      if (!patientId) return;
      
      try {
        setPatientLoading(true);
        console.log(`Fetching patient ${patientId} data...`);
        
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = {
          'X-Tenant-Subdomain': getTenantSubdomain()
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`/api/patients/${patientId}`, {
          headers,
          credentials: 'include'
        });
        
        console.log("Patient response status:", response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Fetched patient data:", data);
        setPatient(data);
      } catch (err) {
        console.error("Error fetching patient:", err);
        setPatient(null);
      } finally {
        setPatientLoading(false);
      }
    };

    fetchPatient();
  }, [patientId]);

  useEffect(() => {
    if (patient) {
      setSelectedPatient(patient);
    }
  }, [patient]);

  const fetchAnatomicalFiles = useCallback(async () => {
    if (!patientId) {
      setAnatomicalFiles([]);
      return;
    }

    setAnatomicalFilesLoading(true);
    setAnatomicalFilesError("");

    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "X-Tenant-Subdomain": getTenantSubdomain(),
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/anatomical-analysis/files/${patientId}`, {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setAnatomicalFiles(data.files ?? []);
    } catch (error) {
      console.error("Error fetching anatomical analysis files:", error);
      setAnatomicalFiles([]);
      setAnatomicalFilesError("Failed to load anatomical analysis files.");
    } finally {
      setAnatomicalFilesLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchAnatomicalFiles();
  }, [fetchAnatomicalFiles]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ patientId?: number }>;
      const detailPatientId = customEvent.detail?.patientId;
      if (detailPatientId && patientId === detailPatientId) {
        fetchAnatomicalFiles();
      }
    };
    window.addEventListener("anatomicalFilesUpdated", handler);
    return () => {
      window.removeEventListener("anatomicalFilesUpdated", handler);
    };
  }, [fetchAnatomicalFiles, patientId]);

  const deleteAnatomicalFile = useCallback(
    async (filename: string) => {
      if (!patientId) return false;
      setDeletingFile(filename);
      try {
        const token = localStorage.getItem("auth_token");
        const headers: Record<string, string> = {
          "X-Tenant-Subdomain": getTenantSubdomain(),
          "Content-Type": "application/json",
        };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        const response = await fetch(`/api/anatomical-analysis/files/${patientId}`, {
          method: "DELETE",
          headers,
          credentials: "include",
          body: JSON.stringify({ filename }),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        await fetchAnatomicalFiles();
        return true;
      } catch (error) {
        console.error("Error deleting anatomical file:", error);
        return false;
      } finally {
        setDeletingFile(null);
      }
    },
    [patientId, fetchAnatomicalFiles],
  );

  // Function to handle flag deletion
  const handleFlagDelete = async (flagIndex: number) => {
    if (!patient) return;
    
    try {
      const updatedFlags = patient.flags.filter((_: any, index: number) => index !== flagIndex);
      
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'X-Tenant-Subdomain': getTenantSubdomain(),
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/patients/${patient.id}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({ flags: updatedFlags })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      // Update local state
      const updatedPatient = { ...patient, flags: updatedFlags };
      setPatient(updatedPatient);
      setSelectedPatient(updatedPatient);
    } catch (err) {
      console.error("Error deleting flag:", err);
    }
  };

  // Show loading state while fetching patient data
  if (patientId && patientLoading) {
    return (
      <>
        <Header 
          title="Loading Patient Records..." 
          subtitle="Please wait while we fetch the patient information."
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-blue mx-auto mb-4"></div>
            <p className="text-gray-600">Loading patient data...</p>
          </div>
        </div>
      </>
    );
  }

  // If viewing specific patient records
  if (patientId && patient) {
    return (
      <>
        <Header 
          title={`Medical Records - ${patient.firstName} ${patient.lastName}`} 
          subtitle="Complete medical history and consultation notes."
        />
        
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => setLocation('/patients')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Patients
              </Button>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {patient.firstName} {patient.lastName} - Medical Records
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  Patient ID: {patient.patientId} • Age: {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Patient Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Patient Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-white">Contact Information</p>
                  <p className="text-sm text-gray-600 dark:text-neutral-300">{patient.phone}</p>
                  <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-neutral-300">
                    <Mail className="h-4 w-4 text-gray-500 dark:text-neutral-400" />
                    <span>{patient.email}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-white">Address</p>
                  <p className="text-sm text-gray-600 dark:text-neutral-300">
                    {patient.address?.street}, {patient.address?.city} {patient.address?.postcode}
                  </p>
                </div>
                {patient.medicalHistory?.chronicConditions && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-white">Chronic Conditions</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {patient.medicalHistory.chronicConditions.map((condition: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {condition}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {/* Extract allergies from both medicalHistory and flags */}
                {(() => {
                  const allergies = patient.medicalHistory?.allergies || [];
                  const flagAllergies = patient.flags?.filter((flag: string) => 
                    flag.includes(':') && flag.split(':')[2]
                  ).map((flag: string) => flag.split(':')[2]) || [];
                  const allAllergies = [...allergies, ...flagAllergies].filter(Boolean);
                  
                  return allAllergies.length > 0 ? (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-white">Allergies</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {allAllergies.map((allergy: string, index: number) => (
                          <Badge key={index} variant="destructive" className="text-xs">
                            {allergy}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-white">Allergies</p>
                      <p className="text-sm text-gray-500 dark:text-neutral-400">No known allergies</p>
                    </div>
                  );
                })()}
                
                {/* Display patient flags */}
                {patient.flags && patient.flags.length > 0 && (
                  <TooltipProvider>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {patient.flags.map((flag: string, index: number) => {
                        const flagParts = flag.split(':');
                        const [category, , reason] = flagParts;
                        const getFlagTypeDisplay = (type: string) => {
                          const flagTypes: Record<string, string> = {
                            'medical_alert': '🚩 Medical Alert',
                            'allergy_warning': '🚩 Allergy Warning', 
                            'medication_interaction': '🚩 Medication Interaction',
                            'high_risk': '🚩 High Risk',
                            'special_needs': '🚩 Special Needs',
                            'insurance_issue': '🚩 Insurance Issue',
                            'payment_overdue': '🚩 Payment Overdue',
                            'follow_up_required': '🚩 Follow-up Required'
                          };
                          return flagTypes[type] || `🚩 ${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
                        };
                        return (
                          <Tooltip key={index}>
                            <TooltipTrigger asChild>
                              <div className="relative group">
                                <Badge variant="outline" className="text-xs pr-6 cursor-pointer">
                                  {getFlagTypeDisplay(category)}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900 rounded-r-md"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFlagDelete(index);
                                    }}
                                  >
                                    <X className="h-2 w-2 text-red-500" />
                                  </Button>
                                </Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Reason for Flag: {reason || 'No reason specified'}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </TooltipProvider>
                )}
              </CardContent>
            </Card>

            {/* Medical Records */}
            <div className="lg:col-span-2">
              <ConsultationNotes 
                key={patient.id}
                patientId={patient.id} 
                patientName={`${patient.firstName} ${patient.lastName}`}
                patientNumber={patient.patientId}
              />
            </div>
          </div>

          <div className="mt-6">
            <PatientFamilyHistory 
              key={patient.id}
              patient={patient} 
              onUpdate={(updates) => {
                const updatedPatient = { ...patient, ...updates };
                setPatient(updatedPatient);
                setSelectedPatient(updatedPatient);
              }}
              anatomicalFiles={anatomicalFiles}
              anatomicalFilesLoading={anatomicalFilesLoading}
              anatomicalFilesError={anatomicalFilesError}
              onDeleteAnatomicalFile={deleteAnatomicalFile}
            />
          </div>
        </div>
      </>
    );
  }

  // Default patients list view
  return (
    <>
      <Header 
        title="Patients" 
        subtitle="Manage patient records and medical information."
      />
      
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Patients</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">
                  Gender:
                </span>
                <Select
                  value={genderFilter}
                  onValueChange={(value: "all" | "Male" | "Female") => setGenderFilter(value)}
                >
                  <SelectTrigger className="h-8 w-28" data-testid="select-gender-filter">
                    <User className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600 dark:text-neutral-300">
                  {isListView ? "List View" : "Grid View"}
                </span>
                <Switch
                  checked={isListView}
                  onCheckedChange={setIsListView}
                  className="h-4 w-8"
                  data-testid="toggle-view-mode"
                />
              </div>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">
              View and manage patient information securely.
            </p>
          </div>
          {canCreate('patients') && (
            <Button 
              onClick={() => setShowPatientModal(true)}
              className="text-white"
              style={{ backgroundColor: '#4A7DFF' }}
              data-testid="button-add-patient"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Patient
            </Button>
          )}
        </div>

        <PatientList 
          genderFilter={genderFilter === "all" ? null : genderFilter} 
          viewMode={isListView ? "list" : "grid"}
          canEditPatient={canEdit('patients')}
          canDeletePatient={canDelete('patients')}
        />
      </div>

      <PatientModal 
        open={showPatientModal}
        onOpenChange={setShowPatientModal}
      />

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-green-600">Success</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-gray-700">{successMessage}</p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => {
                setShowSuccessModal(false);
                setSuccessMessage("");
              }}
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
