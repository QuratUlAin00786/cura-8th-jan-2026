import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Video,
  Plus,
  FileText,
  Edit,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle,
} from "lucide-react";
import { format, isSameDay, isToday, isFuture, isPast } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const statusColors = {
  scheduled: "#4A7DFF",
  completed: "#6CFFEB",
  cancelled: "#162B61",
  no_show: "#9B9EAF",
};

export default function PatientAppointments({
  onNewAppointment,
}: {
  onNewAppointment?: () => void;
}) {
  const [selectedFilter, setSelectedFilter] = useState<
    "all" | "upcoming" | "past"
  >("all");
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [deletingAppointmentId, setDeletingAppointmentId] = useState<
    number | null
  >(null);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<
    number | null
  >(null);
  const [bookedTimeSlots, setBookedTimeSlots] = useState<string[]>([]);

  // Patient filter states
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [dateTimeFilter, setDateTimeFilter] = useState<string>("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper function to normalize status values for case-insensitive filtering
  const normalizeStatus = (s?: string) => (s || '').toLowerCase().replace(/\s+/g, '_');

  // Fetch patients to find the current user's patient record
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/patients"],
    staleTime: 60000,
    retry: false,
    enabled: !!user,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/patients");
      const data = await response.json();
      return data;
    },
  });

  // Fetch appointments for this patient - backend automatically filters for patient role
  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery({
    queryKey: [
      "/api/appointments",
      user?.role === "patient" ? "patient-filtered" : "all",
    ],
    staleTime: 30000,
    refetchInterval: 60000,
    enabled: !!user,
    queryFn: async () => {
      // For patient users, the backend automatically filters by patient ID
      // No need to pass patientId explicitly as backend uses the authenticated user's patient record
      const response = await apiRequest("GET", "/api/appointments");
      const data = await response.json();
      return data;
    },
  });

  const { data: treatmentsList = [] } = useQuery({
    queryKey: ["/api/pricing/treatments"],
    staleTime: 300000,
    enabled: !!user,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/pricing/treatments");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: consultationServices = [] } = useQuery({
    queryKey: ["/api/pricing/doctors-fees"],
    staleTime: 300000,
    enabled: !!user,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/pricing/doctors-fees");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const treatmentsMap = React.useMemo(() => {
    const map = new Map<number, any>();
    treatmentsList.forEach((treatment: any) => {
      if (treatment?.id) {
        map.set(treatment.id, treatment);
      }
    });
    return map;
  }, [treatmentsList]);

  const consultationMap = React.useMemo(() => {
    const map = new Map<number, any>();
    consultationServices.forEach((service: any) => {
      if (service?.id) {
        map.set(service.id, service);
      }
    });
    return map;
  }, [consultationServices]);

  const getAppointmentServiceInfo = (appointment: any) => {
    if (!appointment) return null;
    const treatmentId = appointment.treatmentId ?? appointment.treatment_id;
    const consultationId = appointment.consultationId ?? appointment.consultation_id;
    const type = appointment.appointmentType || appointment.type;
    if (treatmentId) {
      const treatment = treatmentsMap.get(treatmentId);
      return {
        name: treatment?.name || "Treatment",
        color: treatment?.colorCode || "#10B981",
        type: type || "treatment",
      };
    }
    if (consultationId) {
      const service = consultationMap.get(consultationId);
      return {
        name: service?.serviceName || "Consultation",
        color: service?.colorCode || "#6366F1",
        type: type || "consultation",
      };
    }
    if (type) {
      return {
        name: type.charAt(0).toUpperCase() + type.slice(1),
        color: "#6B7280",
        type,
      };
    }
    return null;
  };

  // Fetch doctors for doctor specialty data (faster than medical-staff)
  const { data: doctorsData, isLoading: doctorsLoading } = useQuery({
    queryKey: ["/api/doctors"],
    staleTime: 300000, // 5 minutes cache for better performance
    retry: false,
    enabled: !!user,
  });

  // Fetch users to display appointment creator information AND for role-based filtering
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/users"],
    staleTime: 300000, // 5 minutes cache
    retry: false,
    enabled: !!user, // Fetch for all users to filter by creator role
    queryFn: async () => {
      console.log('🔍 FETCHING /api/users for role filtering');
      const response = await apiRequest('GET', '/api/users');
      const data = await response.json();
      console.log('✅ USERS DATA FETCHED:', data?.length, 'users');
      return data;
    },
  });

  // Fetch roles from roles table for role filter
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["/api/roles"],
    staleTime: 300000,
    retry: false,
    enabled: !!user && user.role === 'patient',
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/roles');
      return response.json();
    },
  });

  // Combined loading state
  const isLoading =
    patientsLoading ||
    appointmentsLoading ||
    doctorsLoading ||
    usersLoading ||
    rolesLoading;

  // Find the patient record for the logged-in user
  const currentPatient = React.useMemo(() => {
    if (
      !user ||
      user.role !== "patient" ||
      !patientsData ||
      !Array.isArray(patientsData)
    ) {
      console.log("🔍 PATIENT-APPOINTMENTS: Patient lookup failed", {
        hasUser: !!user,
        userRole: user?.role,
        hasPatientsData: !!patientsData,
        patientsDataType: Array.isArray(patientsData)
          ? "array"
          : typeof patientsData,
      });
      return null;
    }

    console.log("🔍 PATIENT-APPOINTMENTS: Looking for patient matching user:", {
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`,
      userId: user.id,
    });
    console.log(
      "📋 PATIENT-APPOINTMENTS: Available patients:",
      patientsData.map((p) => ({
        id: p.id,
        email: p.email,
        name: `${p.firstName} ${p.lastName}`,
      })),
    );

    // Match by userId field (primary method)
    const foundPatient = patientsData.find(
      (patient: any) => patient.userId === user.id
    );

    if (foundPatient) {
      console.log(
        "✅ PATIENT-APPOINTMENTS: Found matching patient:",
        foundPatient,
      );
    } else {
      console.log("❌ PATIENT-APPOINTMENTS: No matching patient found");
    }

    return foundPatient;
  }, [user, patientsData]);

  // Filter appointments to show all appointments created by any role
  // filtered by patient_id and organization_id (matching subdomain)
  const appointments = React.useMemo(() => {
    // If we're loading or no data, return empty array
    if (!appointmentsData) return [];
    
    // Show all appointments from all roles (no role-based filtering)
    let filtered = appointmentsData;
    
    // For patient role users, filter by matching patientId with currentPatient.id
    if (user?.role === 'patient' && currentPatient) {
      filtered = filtered.filter((apt: any) => apt.patientId === currentPatient.id);
    }
    
    // Appointments are already filtered by organizationId at the backend level via tenant middleware
    // This ensures only appointments from the active user's organization (matching subdomain) are shown
    return filtered;
  }, [appointmentsData, user?.role, currentPatient]);

  const getDoctorSpecialtyData = (providerId: number) => {
    const doctorsResponse = doctorsData as any;
    if (!doctorsResponse?.doctors || !Array.isArray(doctorsResponse.doctors))
      return { name: "", category: "", subSpecialty: "" };
    const provider = doctorsResponse.doctors.find(
      (u: any) => u.id === providerId,
    );
    return provider
      ? {
          name: `${provider.firstName} ${provider.lastName}`,
          category: provider.medicalSpecialtyCategory || "",
          subSpecialty: provider.subSpecialty || "",
        }
      : { name: "", category: "", subSpecialty: "" };
  };

  // Get creator name from created_by field
  const getCreatorName = (createdBy: number | null | undefined) => {
    if (!createdBy || !usersData || !Array.isArray(usersData)) {
      return null;
    }
    const creator = usersData.find((u: any) => u.id === createdBy);
    if (!creator) return null;
    
    // Handle missing first or last names gracefully
    const firstName = creator.firstName || '';
    const lastName = creator.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    // Format role for display (capitalize first letter of each word, replace underscores with spaces)
    const role = creator.role || '';
    const formattedRole = role
      .split('_')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return fullName ? `${fullName} (${formattedRole})` : 'Unknown User';
  };

  // Fetch appointments for selected date to check availability
  const fetchAppointmentsForDate = async (date: Date) => {
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const response = await apiRequest("GET", "/api/appointments");
      const data = await response.json();

      // Filter appointments for the selected date (excluding the current appointment being edited)
      // Only include SCHEDULED appointments - CANCELLED appointments should not block time slots
      const dayAppointments = data.filter((apt: any) => {
        const aptDate = format(new Date(apt.scheduledAt), "yyyy-MM-dd");
        return aptDate === dateStr && apt.id !== editingAppointment?.id && apt.status === 'SCHEDULED';
      });

      // Extract booked time slots
      const bookedSlots = dayAppointments.map((apt: any) => {
        const aptTime = new Date(apt.scheduledAt);
        return format(aptTime, "h:mm a");
      });

      setBookedTimeSlots(bookedSlots);
      console.log("📅 Booked time slots for", dateStr, ":", bookedSlots);
    } catch (error) {
      console.error("Error fetching appointments for date:", error);
      setBookedTimeSlots([]);
    }
  };

  // Fetch appointments when editing appointment date changes
  React.useEffect(() => {
    if (editingAppointment?.scheduledAt) {
      const selectedDate = new Date(editingAppointment.scheduledAt);
      fetchAppointmentsForDate(selectedDate);
    }
  }, [editingAppointment?.scheduledAt, editingAppointment?.id]);

  // Edit appointment mutation
  const editAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const response = await apiRequest(
        "PUT",
        `/api/appointments/${appointmentData.id}`,
        appointmentData,
      );

      if (!response.ok) {
        throw new Error(`Failed to update appointment: ${response.status}`);
      }

      try {
        return await response.json();
      } catch (jsonError) {
        // If JSON parsing fails but response was successful, return a success indicator
        return { success: true };
      }
    },
    onSuccess: () => {
      setSuccessMessage("The appointment has been successfully updated.");
      setShowSuccessModal(true);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.refetchQueries({ queryKey: ["/api/appointments"] });
      setEditingAppointment(null);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update appointment. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete appointment mutation
  const deleteAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: number) => {
      const response = await apiRequest(
        "DELETE",
        `/api/appointments/${appointmentId}`,
      );
      return response.json();
    },
    onSuccess: () => {
      setSuccessMessage("The appointment has been successfully deleted.");
      setShowSuccessModal(true);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete appointment. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Cancel appointment mutation for patient users
  const cancelAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: number) => {
      const response = await apiRequest(
        "PUT",
        `/api/appointments/${appointmentId}`,
        { status: "cancelled" }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to cancel appointment");
      }
      
      return response.json();
    },
    onSuccess: () => {
      setSuccessMessage("The appointment has been successfully cancelled.");
      setShowSuccessModal(true);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: (error) => {
      toast({
        title: "Cancel Failed",
        description: "Failed to cancel appointment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditAppointment = (appointment: any) => {
    setEditingAppointment(appointment);
  };

  const handleDeleteAppointment = (appointmentId: number) => {
    setDeletingAppointmentId(appointmentId);
  };

  const handleCancelAppointment = (appointmentId: number) => {
    setCancellingAppointmentId(appointmentId);
  };

  const confirmCancelAppointment = () => {
    if (cancellingAppointmentId) {
      cancelAppointmentMutation.mutate(cancellingAppointmentId);
      setCancellingAppointmentId(null);
    }
  };

  const closeCancelModal = () => {
    setCancellingAppointmentId(null);
  };

  const confirmDeleteAppointment = () => {
    if (deletingAppointmentId) {
      deleteAppointmentMutation.mutate(deletingAppointmentId);
      setDeletingAppointmentId(null);
    }
  };

  const cancelDeleteAppointment = () => {
    setDeletingAppointmentId(null);
  };

  const handleSaveEdit = () => {
    if (editingAppointment) {
      editAppointmentMutation.mutate({
        ...editingAppointment,
        patientId: currentPatient?.id,
      });
    }
  };

  const formatTime = (timeString: string) => {
    try {
      // FIXED: Extract time directly from database string without timezone conversion
      // Database format: "2025-09-27T09:00:00.000Z"
      // Extract "09:00" and convert to readable format
      const timeOnly = timeString.split('T')[1]?.substring(0, 5); // Extract "09:00"
      if (!timeOnly) return "Invalid time";
      
      const [hours, minutes] = timeOnly.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch {
      return "Invalid time";
    }
  };

  const formatDate = (timeString: string) => {
    try {
      const date = new Date(timeString);
      return format(date, "EEEE, MMMM d, yyyy");
    } catch {
      return "Invalid date";
    }
  };

  // Get filtered users by selected role
  const filteredUsersByRole = React.useMemo(() => {
    if (!roleFilter || !usersData || !Array.isArray(usersData)) return [];
    // Case-insensitive comparison to handle any uppercase/lowercase mismatches
    return usersData.filter((u: any) => u.role?.toLowerCase() === roleFilter.toLowerCase());
  }, [roleFilter, usersData]);

  // Filter appointments based on patient filters (for patient role)
  const getPatientFilteredAppointments = React.useMemo(() => {
    if (user?.role !== "patient") return appointments;

    // Start with the already patient-filtered appointments (appointments already filtered by currentPatient.id)
    let filtered = appointments;

    // Filter by provider (based on role selection)
    if (providerFilter) {
      filtered = filtered.filter((apt: any) => {
        return apt.providerId === parseInt(providerFilter);
      });
    }

    // Filter by date if selected (compare only date, not time)
    if (dateTimeFilter) {
      filtered = filtered.filter((apt: any) => {
        const aptDateTime = new Date(apt.scheduledAt);
        const filterDate = new Date(dateTimeFilter);
        return isSameDay(aptDateTime, filterDate);
      });
    }

    return filtered;
  }, [
    appointments,
    providerFilter,
    dateTimeFilter,
    user?.role,
  ]);

  // Filter and sort appointments by date for the logged-in patient
  const base = user?.role === "patient" ? getPatientFilteredAppointments : appointments;
  const filteredAppointments = base
    .filter((apt: any) => {
      const appointmentDate = new Date(apt.scheduledAt);

      if (selectedFilter === "upcoming") {
        return isFuture(appointmentDate) || isToday(appointmentDate);
      } else if (selectedFilter === "past") {
        return isPast(appointmentDate) && !isToday(appointmentDate);
      }
      return true;
    })
    .sort(
      (a: any, b: any) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    );

  // Get upcoming appointments for the logged-in patient
  const upcomingAppointments = appointments.filter((apt: any) => {
    const appointmentDate = new Date(apt.scheduledAt);
    return (isFuture(appointmentDate) || isToday(appointmentDate)) && apt.status?.toLowerCase() === 'scheduled';
  });

  const nextAppointment =
    upcomingAppointments.length > 0
      ? upcomingAppointments.sort(
          (a: any, b: any) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime(),
        )[0]
      : null;

  // Upcoming Appointments function with full functionality for dashboard
  const getUpcomingAppointmentsDetails = () => {
    const now = new Date();

    // Filter and sort upcoming appointments
    const sortedUpcomingAppointments = appointments
      .filter((appointment: any) => {
        const appointmentDate = new Date(appointment.scheduledAt);
        return appointmentDate > now || isToday(appointmentDate);
      })
      .sort((a: any, b: any) => {
        return (
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        );
      });

    // Enhanced appointment details for dashboard display
    const enhancedAppointments = sortedUpcomingAppointments.map(
      (appointment: any) => {
        const doctorData = getDoctorSpecialtyData(appointment.providerId);

        return {
          id: appointment.id,
          title: appointment.title || "Medical Consultation",
          doctorName: doctorData.name,
          doctorCategory: doctorData.category,
          doctorSubSpecialty: doctorData.subSpecialty,
          scheduledDate: formatDate(appointment.scheduledAt),
          scheduledTime: formatTime(appointment.scheduledAt),
          rawDateTime: appointment.scheduledAt,
          status: appointment.status,
          statusColor:
            statusColors[appointment.status as keyof typeof statusColors] ||
            "#4A7DFF",
          location: appointment.location || "",
          isVirtual: appointment.isVirtual || false,
          patientId: appointment.patientId,
          providerId: appointment.providerId,
          notes: appointment.notes || "",
          type: appointment.type || "consultation",
        };
      },
    );

    return {
      appointments: enhancedAppointments,
      count: enhancedAppointments.length,
      nextAppointment: enhancedAppointments[0] || null,
      hasUpcomingAppointments: enhancedAppointments.length > 0,
      remainingAppointments: enhancedAppointments.slice(1),
      upcomingInNext7Days: enhancedAppointments.filter((apt: any) => {
        const aptDate = new Date(apt.rawDateTime);
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return aptDate <= weekFromNow;
      }),
      summary: {
        totalUpcoming: enhancedAppointments.length,
        nextInDays:
          enhancedAppointments.length > 0
            ? Math.ceil(
                (new Date(enhancedAppointments[0].rawDateTime).getTime() -
                  now.getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : null,
        doctorNames: [
          ...new Set(
            enhancedAppointments
              .map((apt: any) => apt.doctorName)
              .filter(Boolean),
          ),
        ],
        appointmentTypes: [
          ...new Set(enhancedAppointments.map((apt: any) => apt.type)),
        ],
      },
    };
  };

  // Get detailed upcoming appointments data
  const upcomingAppointmentsDetails = getUpcomingAppointmentsDetails();

  // Get unique medical specialties and sub-specialties for patient filter
  const getPatientFilterOptions = React.useMemo(() => {
    const doctorsResponse = doctorsData as any;
    if (!doctorsResponse?.doctors || !Array.isArray(doctorsResponse.doctors)) {
      return { specialties: [], subSpecialties: [] };
    }

    const specialties = Array.from(
      new Set(
        doctorsResponse.doctors
          .map((doctor: any) => doctor.medicalSpecialtyCategory)
          .filter(Boolean),
      ),
    ) as string[];

    const subSpecialties = Array.from(
      new Set(
        doctorsResponse.doctors
          .map((doctor: any) => doctor.subSpecialty)
          .filter(Boolean),
      ),
    ) as string[];

    return { specialties, subSpecialties };
  }, [doctorsData]);

  // Show loading state when all data is loading
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="patient-appointments-view">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-2xl font-bold text-blue-800">
              My Appointments
            </h2>
            <p className="text-gray-600">
              {user?.firstName} {user?.lastName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === "patient" && (
            <Button
              variant="outline"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2"
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4" />
              {showAdvancedFilters ? "Hide Filters" : "Show Filters"}
            </Button>
          )}
          <Button
            onClick={() => onNewAppointment?.()}
            className="flex items-center gap-2"
            data-testid="button-book-appointment"
          >
            <Plus className="h-3 w-3" />
            Book Appointment
          </Button>
        </div>
      </div>

      {/* Next Appointment Card */}
      {nextAppointment && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-blue-800">
              Next Appointment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-lg">
                    {formatDate(nextAppointment.scheduledAt)} at{" "}
                    {formatTime(nextAppointment.scheduledAt)}
                  </span>
                </div>

                {getDoctorSpecialtyData(nextAppointment.providerId)
                  .subSpecialty && (
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span>
                      {
                        getDoctorSpecialtyData(nextAppointment.providerId)
                          .subSpecialty
                      }
                    </span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span>{nextAppointment.title}</span>
                </div>
                {nextAppointment.location && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    <span>{nextAppointment.location}</span>
                  </div>
                )}
                {nextAppointment.isVirtual && (
                  <div className="flex items-center space-x-2">
                    <Video className="h-5 w-5 text-blue-600" />
                    <span>Virtual Appointment</span>
                  </div>
                )}
              </div>
              <Badge
                style={{
                  backgroundColor:
                    statusColors[
                      nextAppointment.status as keyof typeof statusColors
                    ],
                }}
                className="text-white text-sm"
              >
                {nextAppointment.status.toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-col gap-3">
        {/* Always show Upcoming/Past/All buttons for all users */}
        <div className="flex space-x-2">
          <Button
            variant={selectedFilter === "upcoming" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedFilter("upcoming")}
            data-testid="button-filter-upcoming"
          >
            Upcoming ({upcomingAppointments.length})
          </Button>
          <Button
            variant={selectedFilter === "past" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedFilter("past")}
            data-testid="button-filter-past"
          >
            Past (
            {
              appointments.filter((apt: any) => {
                const appointmentDate = new Date(apt.scheduledAt);
                return isPast(appointmentDate) && !isToday(appointmentDate);
              }).length
            }
            )
          </Button>
          <Button
            variant={selectedFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedFilter("all")}
            data-testid="button-filter-all"
          >
            All ({appointments.length})
          </Button>
        </div>

        {/* Additional patient-specific filters */}
        {user?.role === "patient" && showAdvancedFilters && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {/* Role Filter */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Select Role</Label>
                    <Select value={roleFilter} onValueChange={(value) => {
                      setRoleFilter(value);
                      setProviderFilter("");
                    }}>
                      <SelectTrigger data-testid="select-role-filter">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {rolesData && Array.isArray(rolesData) ? rolesData
                          .filter((role: any) => role.name !== 'patient')
                          .map((role: any) => (
                            <SelectItem 
                              key={role.id} 
                              value={role.name}
                              data-testid={`option-role-${role.name}`}
                            >
                              {role.displayName || role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                            </SelectItem>
                          )) : null}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Provider Name Filter */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Select Provider Name
                    </Label>
                    <Select 
                      value={providerFilter} 
                      onValueChange={setProviderFilter}
                      disabled={!roleFilter}
                    >
                      <SelectTrigger data-testid="select-provider-filter">
                        <SelectValue placeholder={!roleFilter ? "Select role first" : "Select provider"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredUsersByRole.map((provider: any) => (
                          <SelectItem 
                            key={provider.id} 
                            value={provider.id.toString()}
                            data-testid={`option-provider-${provider.id}`}
                          >
                            {provider.firstName} {provider.lastName}
                          </SelectItem>
                        ))}
                        {roleFilter && filteredUsersByRole.length === 0 && (
                          <SelectItem value="none" disabled data-testid="option-provider-none">
                            No providers found
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Filter */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Select Date
                    </Label>
                    <input
                      type="date"
                      value={dateTimeFilter}
                      onChange={(e) => setDateTimeFilter(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      data-testid="input-filter-datetime"
                    />
                  </div>
                </div>

                {/* Clear Filters Button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRoleFilter("");
                      setProviderFilter("");
                      setDateTimeFilter("");
                    }}
                    data-testid="button-clear-filters"
                  >
                    Clear All Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Appointments List */}
      <div className={`space-y-4 ${user?.role === 'patient' ? 'max-h-[700px] overflow-y-auto' : ''}`}>
        {filteredAppointments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-500 mb-2">
                No {selectedFilter !== "all" ? selectedFilter : ""} appointments
                found
              </h3>
              <p className="text-gray-400">
                {selectedFilter === "upcoming"
                  ? "You don't have any upcoming appointments scheduled."
                  : selectedFilter === "past"
                    ? "No past appointments to display."
                    : "You haven't scheduled any appointments yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAppointments.map((appointment: any) => {
            const appointmentDate = new Date(appointment.scheduledAt);
            const isUpcoming =
              isFuture(appointmentDate) || isToday(appointmentDate);
            const serviceInfo = getAppointmentServiceInfo(appointment);

            return (
              <Card
                key={appointment.id}
                className={`border-l-4 ${isUpcoming ? "bg-white" : "bg-gray-50"}`}
                style={{
                  borderLeftColor:
                    statusColors[
                      appointment.status as keyof typeof statusColors
                    ],
                }}
                data-testid={`appointment-${appointment.id}`}
              >
                <CardContent className="p-6">
                  {user?.role === 'patient' && appointment.appointmentId && (
                    <div className="mb-3">
                      <Badge 
                        variant="outline" 
                        className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-medium"
                      >
                        {appointment.appointmentId}
                      </Badge>
                    </div>
                  )}
              <div className="flex items-center justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">
                          {appointment.title}
                        </h3>
                        <div className="flex items-center space-x-2">
                          {normalizeStatus(appointment.status) !== "cancelled" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditAppointment(appointment)}
                              className="h-8 w-8 p-0"
                              data-testid={`button-edit-appointment-${appointment.id}`}
                            >
                              <Edit className="h-4 w-4 text-blue-600" />
                            </Button>
                          )}
                          {/* Cancel Appointment button for patient users */}
                          {user?.role === "patient" && appointment.status === "scheduled" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelAppointment(appointment.id)}
                              className="border-red-500 text-red-500 hover:bg-red-50 text-xs"
                              data-testid={`button-cancel-appointment-${appointment.id}`}
                              title="Cancel Appointment"
                            >
                              Cancel Appointment
                            </Button>
                          )}
                          {user?.role !== "patient" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDeleteAppointment(appointment.id)
                              }
                              className="h-8 w-8 p-0"
                              data-testid={`button-delete-appointment-${appointment.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                          <Badge
                            style={{
                              backgroundColor:
                                statusColors[
                                  appointment.status as keyof typeof statusColors
                                ],
                            }}
                            className="text-white"
                          >
                            {appointment.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">
                            {formatDate(appointment.scheduledAt)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">
                            {formatTime(appointment.scheduledAt)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">
                            {currentPatient
                              ? `${currentPatient.firstName} ${currentPatient.lastName}`
                              : "Patient"}
                          </span>
                        </div>
                        {getDoctorSpecialtyData(appointment.providerId)
                          .name && (
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">
                              {
                                getDoctorSpecialtyData(appointment.providerId)
                                  .name
                              }
                            </span>
                          </div>
                        )}
                        {user?.role === 'patient' && getDoctorSpecialtyData(appointment.providerId)
                          .category && (
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">
                              {
                                getDoctorSpecialtyData(appointment.providerId)
                                  .category
                              }
                            </span>
                          </div>
                        )}
                        {user?.role === 'patient' && getDoctorSpecialtyData(appointment.providerId)
                          .subSpecialty && (
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">
                              {
                                getDoctorSpecialtyData(appointment.providerId)
                                  .subSpecialty
                              }
                            </span>
                          </div>
                        )}
                      </div>

                      {appointment.location && (
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">
                            {appointment.location}
                          </span>
                        </div>
                      )}

                      {appointment.isVirtual && (
                        <div className="flex items-center space-x-2">
                          <Video className="h-4 w-4 text-blue-500" />
                          <span className="text-sm text-blue-600">
                            Virtual Appointment
                          </span>
                        </div>
                      )}

                      {appointment.description && (
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                          {appointment.description}
                        </p>
                      )}

                      {serviceInfo && (
                        <>
                          <div className="flex items-center space-x-2 mt-2">
                            <span
                              className="inline-flex h-2 w-2 rounded-full border border-gray-300"
                              style={{ backgroundColor: serviceInfo.color }}
                            />
                            <span className="text-sm font-medium">
                              Service: {serviceInfo.name}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Appointment Type:{" "}
                            {(serviceInfo.type || "consultation")
                              .toString()
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (char: string) => char.toUpperCase())}
                          </div>
                        </>
                      )}

                      {appointment.createdBy && getCreatorName(appointment.createdBy) && (
                        <div className="flex items-center space-x-2 text-xs text-gray-500 pt-2 border-t">
                          <User className="h-3 w-3" />
                          <span>
                            Booked by: {getCreatorName(appointment.createdBy)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Edit Appointment Modal */}
      {editingAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Edit Appointment
                  </h2>
                  <p className="text-sm text-gray-500">
                    Update appointment details for {user?.firstName}{" "}
                    {user?.lastName}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingAppointment(null)}
                  className="hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Title */}
                  <div>
                    <Label
                      htmlFor="title"
                      className="text-sm font-medium text-gray-700"
                    >
                      Title
                    </Label>
                    <input
                      id="title"
                      type="text"
                      value={editingAppointment.title || ""}
                      onChange={(e) =>
                        setEditingAppointment({
                          ...editingAppointment,
                          title: e.target.value,
                        })
                      }
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter appointment title"
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Type
                    </Label>
                    <Select
                      value={editingAppointment.type || "consultation"}
                      onValueChange={(value) =>
                        setEditingAppointment({
                          ...editingAppointment,
                          type: value,
                        })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="consultation">
                          Consultation
                        </SelectItem>
                        <SelectItem value="checkup">Checkup</SelectItem>
                        <SelectItem value="follow-up">Follow-up</SelectItem>
                        <SelectItem value="screening">Screening</SelectItem>
                        <SelectItem value="procedure">Procedure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Date and Time Selection - Full Width Single Row */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Select Date */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Select Date *
                    </Label>
                    <div className="mt-1 p-4 border border-gray-300 rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          type="button"
                          onClick={() => {
                            const currentDate = new Date(
                              editingAppointment.scheduledAt,
                            );
                            currentDate.setMonth(currentDate.getMonth() - 1);
                            setEditingAppointment({
                              ...editingAppointment,
                              scheduledAt: currentDate,
                            });
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="font-medium">
                          {format(
                            new Date(editingAppointment.scheduledAt),
                            "MMMM yyyy",
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const currentDate = new Date(
                              editingAppointment.scheduledAt,
                            );
                            currentDate.setMonth(currentDate.getMonth() + 1);
                            setEditingAppointment({
                              ...editingAppointment,
                              scheduledAt: currentDate,
                            });
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-xs mb-2">
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(
                          (day) => (
                            <div
                              key={day}
                              className="p-2 text-center font-medium text-gray-500"
                            >
                              {day}
                            </div>
                          ),
                        )}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 42 }, (_, i) => {
                          const currentMonth = new Date(
                            editingAppointment.scheduledAt,
                          ).getMonth();
                          const currentYear = new Date(
                            editingAppointment.scheduledAt,
                          ).getFullYear();
                          const firstDayOfMonth = new Date(
                            currentYear,
                            currentMonth,
                            1,
                          );
                          const startDate = new Date(firstDayOfMonth);
                          startDate.setDate(
                            startDate.getDate() - firstDayOfMonth.getDay(),
                          );
                          const cellDate = new Date(startDate);
                          cellDate.setDate(cellDate.getDate() + i);
                          const isCurrentMonth =
                            cellDate.getMonth() === currentMonth;
                          const isSelected =
                            format(cellDate, "yyyy-MM-dd") ===
                            format(
                              new Date(editingAppointment.scheduledAt),
                              "yyyy-MM-dd",
                            );

                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                const newDate = new Date(
                                  editingAppointment.scheduledAt,
                                );
                                newDate.setFullYear(
                                  cellDate.getFullYear(),
                                  cellDate.getMonth(),
                                  cellDate.getDate(),
                                );
                                setEditingAppointment({
                                  ...editingAppointment,
                                  scheduledAt: newDate,
                                });
                                // Fetch appointments for the new date to update time slot availability
                                fetchAppointmentsForDate(cellDate);
                              }}
                              className={`p-2 text-sm rounded hover:bg-blue-50 ${
                                isSelected
                                  ? "bg-blue-500 text-white"
                                  : isCurrentMonth
                                    ? "text-gray-900"
                                    : "text-gray-400"
                              }`}
                            >
                              {cellDate.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Select Time Slot */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Select Time Slot *
                    </Label>
                    <div className="mt-1 max-h-64 overflow-y-auto border border-gray-300 rounded-md p-3">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          "9:00 AM",
                          "9:30 AM",
                          "10:00 AM",
                          "10:30 AM",
                          "11:00 AM",
                          "11:30 AM",
                          "12:00 PM",
                          "12:30 PM",
                          "1:00 PM",
                          "1:30 PM",
                          "2:00 PM",
                          "2:30 PM",
                          "3:00 PM",
                          "3:30 PM",
                          "4:00 PM",
                          "4:30 PM",
                          "5:00 PM",
                        ].map((timeSlot) => {
                          const currentTime = format(
                            new Date(editingAppointment.scheduledAt),
                            "h:mm a",
                          );
                          const isSelected = timeSlot === currentTime;
                          const isBooked = bookedTimeSlots.includes(timeSlot);

                          return (
                            <button
                              key={timeSlot}
                              type="button"
                              disabled={isBooked}
                              onClick={() => {
                                if (isBooked) return;

                                const [time, period] = timeSlot.split(" ");
                                const [hours, minutes] = time.split(":");
                                let hour24 = parseInt(hours);
                                if (period === "PM" && hour24 !== 12)
                                  hour24 += 12;
                                if (period === "AM" && hour24 === 12)
                                  hour24 = 0;

                                const newDate = new Date(
                                  editingAppointment.scheduledAt,
                                );
                                newDate.setHours(
                                  hour24,
                                  parseInt(minutes),
                                  0,
                                  0,
                                );
                                setEditingAppointment({
                                  ...editingAppointment,
                                  scheduledAt: newDate,
                                });
                              }}
                              className={`p-2 text-sm rounded border text-center ${
                                isSelected
                                  ? "bg-yellow-500 text-white border-yellow-500"
                                  : isBooked
                                    ? "bg-gray-400 text-gray-600 border-gray-400 cursor-not-allowed"
                                    : "bg-green-500 text-white border-green-500 hover:bg-green-600"
                              }`}
                              title={
                                isBooked
                                  ? "Time slot already booked"
                                  : "Available time slot"
                              }
                            >
                              {timeSlot}
                              {isBooked && (
                                <span className="block text-xs mt-1">
                                  Booked
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status and Description */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Status */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700">
                      Status
                    </Label>
                    <Select
                      value={editingAppointment.status || "scheduled"}
                      onValueChange={(value) =>
                        setEditingAppointment({
                          ...editingAppointment,
                          status: value,
                        })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Description */}
                  <div>
                    <Label
                      htmlFor="description"
                      className="text-sm font-medium text-gray-700"
                    >
                      Description
                    </Label>
                    <textarea
                      id="description"
                      value={editingAppointment.description || ""}
                      onChange={(e) =>
                        setEditingAppointment({
                          ...editingAppointment,
                          description: e.target.value,
                        })
                      }
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                      placeholder="Enter appointment description"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => setEditingAppointment(null)}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={editAppointmentMutation.isPending}
                  className="px-6 bg-blue-600 text-white hover:bg-blue-700"
                >
                  {editAppointmentMutation.isPending
                    ? "Saving..."
                    : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAppointmentId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Are you sure you want to delete this appointment?
              </h3>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={cancelDeleteAppointment}
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDeleteAppointment}
                  disabled={deleteAppointmentMutation.isPending}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  data-testid="button-confirm-delete"
                >
                  {deleteAppointmentMutation.isPending ? "Deleting..." : "OK"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Appointment Confirmation Dialog */}
      <Dialog open={!!cancellingAppointmentId} onOpenChange={closeCancelModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>
              Do you want to cancel this appointment?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeCancelModal}>
              No
            </Button>
            <Button 
              onClick={confirmCancelAppointment}
              disabled={cancelAppointmentMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {cancelAppointmentMutation.isPending ? "Cancelling..." : "Yes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Appointment Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {upcomingAppointments.length}
              </div>
              <div className="text-sm text-gray-500">Upcoming</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {
                  appointments.filter((apt: any) => apt.status === "completed")
                    .length
                }
              </div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {appointments.length}
              </div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center py-6 space-y-4">
            {/* Green Check Circle Icon */}
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            
            {/* Title */}
            <h2 className="text-xl font-bold text-gray-900">
              {successMessage.includes("cancelled") 
                ? "Appointment Cancelled Successfully" 
                : successMessage.includes("updated") 
                ? "Appointment Updated Successfully" 
                : "Appointment Deleted Successfully"}
            </h2>
            
            {/* Description */}
            <p className="text-gray-600">
              {successMessage}
            </p>
            
            {/* Close Button */}
            <Button
              onClick={() => {
                setShowSuccessModal(false);
                setSuccessMessage("");
              }}
              className="bg-blue-600 hover:bg-blue-700 w-full"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
